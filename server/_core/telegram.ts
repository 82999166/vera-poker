import type { Express, Request, Response } from "express";
import * as db from "../db";
import { z } from "zod";

// Telegram webhook request schema
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      language_code: z.string().optional(), // e.g. "zh", "en", "ru"
    }),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    text: z.string().optional(),
  }).optional(),
}).passthrough();

// Bot command responses in multiple languages
function getBotCommandText(langCode: string | undefined): { help: string; balance: string; rooms: string; unknown: string } {
  const lang = (langCode || "en").toLowerCase().split("-")[0];
  const cmdTexts: Record<string, { help: string; balance: string; rooms: string; unknown: string }> = {
    "zh": {
      help: "可用命令：\n/start - 启动机器人\n/balance - 查看余额\n/rooms - 查看活跃房间\n/help - 显示此帮助",
      balance: "请先通过 /start 绑定您的账户",
      rooms: "活跃房间: {count} 个\n\n请进入应用加入游戏！",
      unknown: "未识别的命令。请使用 /help 查看可用命令。",
    },
    "ja": {
      help: "利用可能なコマンド：\n/start - ボットを開始\n/balance - 残高確認\n/rooms - アクティブなルーム一覧\n/help - このヘルプを表示",
      balance: "まず /start でアカウントをリンクしてください",
      rooms: "アクティブなルーム: {count}\n\nアプリでゲームに参加してください！",
      unknown: "認識できないコマンドです。/help で利用可能なコマンドを確認してください。",
    },
    "ko": {
      help: "사용 가능한 명령어:\n/start - 봇 시작\n/balance - 잔액 확인\n/rooms - 활성 룸 목록\n/help - 이 도움말 표시",
      balance: "먼저 /start로 계정을 연결해 주세요",
      rooms: "활성 룸: {count}개\n\n앱에서 게임에 참여하세요!",
      unknown: "인식할 수 없는 명령어입니다. /help로 사용 가능한 명령어를 확인하세요.",
    },
    "ru": {
      help: "Доступные команды:\n/start - Запустить бота\n/balance - Проверить баланс\n/rooms - Список активных комнат\n/help - Показать эту справку",
      balance: "Сначала привяжите аккаунт через /start",
      rooms: "Активных комнат: {count}\n\nОткройте приложение, чтобы присоединиться!",
      unknown: "Не понял эту команду. Используйте /help для списка команд.",
    },
    "vi": {
      help: "Lệnh khả dụng:\n/start - Khởi động bot\n/balance - Kiểm tra số dư\n/rooms - Danh sách phòng hoạt động\n/help - Hiển thị trợ giúp này",
      balance: "Vui lòng liên kết tài khoản trước bằng /start",
      rooms: "Phòng hoạt động: {count}\n\nMở ứng dụng để tham gia trò chơi!",
      unknown: "Không nhận dạng lệnh. Dùng /help để xem các lệnh khả dụng.",
    },
    "th": {
      help: "คำสั่งที่ใช้ได้:\n/start - เริ่มบอท\n/balance - ตรวจสอบยอดเงิน\n/rooms - รายการห้องที่เปิดอยู่\n/help - แสดงความช่วยเหลือนี้",
      balance: "กรุณาเชื่อมต่อบัญชีก่อนโดยใช้ /start",
      rooms: "ห้องที่เปิดอยู่: {count}\n\nเปิดแอปเพื่อเข้าร่วมเกม!",
      unknown: "ไม่รู้จักคำสั่งนี้ ใช้ /help เพื่อดูคำสั่งที่ใช้ได้",
    },
    "es": {
      help: "Comandos disponibles:\n/start - Iniciar el bot\n/balance - Consultar saldo\n/rooms - Listar salas activas\n/help - Mostrar esta ayuda",
      balance: "Primero vincula tu cuenta con /start",
      rooms: "Salas activas: {count}\n\n¡Abre la app para unirte a un juego!",
      unknown: "Comando no reconocido. Usa /help para ver los comandos disponibles.",
    },
    "pt": {
      help: "Comandos disponíveis:\n/start - Iniciar o bot\n/balance - Verificar saldo\n/rooms - Listar salas ativas\n/help - Mostrar esta ajuda",
      balance: "Primeiro vincule sua conta com /start",
      rooms: "Salas ativas: {count}\n\nAbra o app para entrar em um jogo!",
      unknown: "Comando não reconhecido. Use /help para ver os comandos disponíveis.",
    },
    "id": {
      help: "Perintah yang tersedia:\n/start - Mulai bot\n/balance - Cek saldo\n/rooms - Daftar ruangan aktif\n/help - Tampilkan bantuan ini",
      balance: "Silakan hubungkan akun Anda terlebih dahulu dengan /start",
      rooms: "Ruangan aktif: {count}\n\nBuka aplikasi untuk bergabung!",
      unknown: "Perintah tidak dikenali. Gunakan /help untuk melihat perintah yang tersedia.",
    },
    "ar": {
      help: "الأوامر المتاحة:\n/start - تشغيل البوت\n/balance - التحقق من الرصيد\n/rooms - قائمة الغرف النشطة\n/help - عرض هذه المساعدة",
      balance: "يرجى ربط حسابك أولاً باستخدام /start",
      rooms: "الغرف النشطة: {count}\n\nافتح التطبيق للانضمام!",
      unknown: "لم أفهم هذا الأمر. استخدم /help لعرض الأوامر المتاحة.",
    },
  };
  return cmdTexts[lang] || {
    help: "Available commands:\n/start - Start the bot\n/balance - Check your balance\n/rooms - List active rooms\n/help - Show this message",
    balance: "Please link your account first using /start",
    rooms: "Active rooms: {count}\n\nVisit the app to join a game!",
    unknown: "I didn't understand that command. Use /help for available commands.",
  };
}

// Bot welcome messages in multiple languages
function getBotWelcomeText(langCode: string | undefined): { welcome: string; button: string; ref: string; room: string } {
  const lang = (langCode || "en").toLowerCase().split("-")[0];
  const messages: Record<string, { welcome: string; button: string; ref: string; room: string }> = {
    "zh": {
      welcome: "欢迎来到 Vera Poker！🎰\n\n全球首个可验证公平的扑克平台。\n\n点击下方按钮开始游戏！",
      button: "🃏 打开 Vera Poker",
      ref: "欢迎来到 Vera Poker！🎰\n\n您的好友邀请您加入。点击下方开始游戏并赚取奖励！",
      room: "🎰 您已被邀请进入私人房间！\n\n点击下方按钮加入游戏：",
    },
    "ja": {
      welcome: "Vera Pokerへようこそ！🎰\n\n世界初の証明可能なフェアポーカープラットフォーム。\n\n下のボタンをタップしてゲームを始めましょう！",
      button: "🃏 Vera Pokerを開く",
      ref: "Vera Pokerへようこそ！🎰\n\n友達に招待されました。タップしてゲームを始め、報酬を獲得しましょう！",
      room: "🎰 プライベートルームに招待されました！\n\n下のボタンをタップしてゲームに参加：",
    },
    "ko": {
      welcome: "Vera Poker에 오신 것을 환영합니다！🎰\n\n세계 최초 증명 가능한 공정 포커 플랫폼.\n\n아래 버튼을 눌러 게임을 시작하세요！",
      button: "🃏 Vera Poker 열기",
      ref: "Vera Poker에 오신 것을 환영합니다！🎰\n\n친구의 초대를 받으셨습니다. 탭하여 게임을 시작하고 보상을 받으세요！",
      room: "🎰 프라이빗 룸에 초대되었습니다！\n\n아래 버튼을 눌러 게임에 참여하세요：",
    },
    "ru": {
      welcome: "Добро пожаловать в Vera Poker！🎰\n\nПервая в мире платформа для покера с доказуемой честностью.\n\nНажмите кнопку ниже, чтобы начать игру！",
      button: "🃏 Открыть Vera Poker",
      ref: "Добро пожаловать в Vera Poker！🎰\n\nВас пригласил друг. Нажмите, чтобы начать играть и получать награды！",
      room: "🎰 Вас пригласили в приватную комнату！\n\nНажмите кнопку ниже, чтобы присоединиться：",
    },
    "vi": {
      welcome: "Chào mừng đến với Vera Poker！🎰\n\nNền tảng poker công bằng có thể kiểm chứng đầu tiên trên thế giới.\n\nNhấn nút bên dưới để bắt đầu chơi！",
      button: "🃏 Mở Vera Poker",
      ref: "Chào mừng đến với Vera Poker！🎰\n\nBạn được bạn bè mời. Nhấn để bắt đầu chơi và nhận phần thưởng！",
      room: "🎰 Bạn được mời vào phòng riêng！\n\nNhấn nút bên dưới để tham gia：",
    },
    "th": {
      welcome: "ยินดีต้อนรับสู่ Vera Poker！🎰\n\nแพลตฟอร์มโป๊กเกอร์ที่ยุติธรรมและตรวจสอบได้แห่งแรกของโลก\n\nกดปุ่มด้านล่างเพื่อเริ่มเล่น！",
      button: "🃏 เปิด Vera Poker",
      ref: "ยินดีต้อนรับสู่ Vera Poker！🎰\n\nเพื่อนของคุณเชิญคุณมา กดเพื่อเริ่มเล่นและรับรางวัล！",
      room: "🎰 คุณได้รับเชิญเข้าห้องส่วนตัว！\n\nกดปุ่มด้านล่างเพื่อเข้าร่วม：",
    },
    "es": {
      welcome: "¡Bienvenido a Vera Poker！🎰\n\nLa primera plataforma de póker con equidad verificable del mundo.\n\n¡Toca el botón de abajo para empezar a jugar！",
      button: "🃏 Abrir Vera Poker",
      ref: "¡Bienvenido a Vera Poker！🎰\n\nTu amigo te ha invitado. ¡Toca para empezar a jugar y ganar recompensas！",
      room: "🎰 ¡Has sido invitado a una sala privada！\n\nToca el botón de abajo para unirte：",
    },
    "pt": {
      welcome: "Bem-vindo ao Vera Poker！🎰\n\nA primeira plataforma de poker com equidade verificável do mundo.\n\nToque no botão abaixo para começar a jogar！",
      button: "🃏 Abrir Vera Poker",
      ref: "Bem-vindo ao Vera Poker！🎰\n\nSeu amigo te convidou. Toque para começar a jogar e ganhar recompensas！",
      room: "🎰 Você foi convidado para uma sala privada！\n\nToque no botão abaixo para entrar：",
    },
    "id": {
      welcome: "Selamat datang di Vera Poker！🎰\n\nPlatform poker adil yang dapat diverifikasi pertama di dunia.\n\nKetuk tombol di bawah untuk mulai bermain！",
      button: "🃏 Buka Vera Poker",
      ref: "Selamat datang di Vera Poker！🎰\n\nTeman Anda mengundang Anda. Ketuk untuk mulai bermain dan dapatkan hadiah！",
      room: "🎰 Anda diundang ke ruangan privat！\n\nKetuk tombol di bawah untuk bergabung：",
    },
    "ar": {
      welcome: "مرحباً بك في Vera Poker！🎰\n\nأول منصة بوكر عادلة وقابلة للتحقق في العالم.\n\nاضغط على الزر أدناه للبدء في اللعب！",
      button: "🃏 فتح Vera Poker",
      ref: "مرحباً بك في Vera Poker！🎰\n\nدعاك صديقك. اضغط للبدء في اللعب وكسب المكافآت！",
      room: "🎰 تمت دعوتك إلى غرفة خاصة！\n\nاضغط على الزر أدناه للانضمام：",
    },
  };
  return messages[lang] || {
    welcome: "Welcome to Vera Poker！🎰\n\nThe world's first provably fair poker platform.\n\nTap the button below to start playing！",
    button: "🃏 Open Vera Poker",
    ref: "Welcome to Vera Poker！🎰\n\nYou were referred by a friend. Tap below to start playing and earn rewards！",
    room: "🎰 You've been invited to a private room！\n\nTap the button below to join the game：",
  };
}

export function registerTelegramRoutes(app: Express) {
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    try {
      // SECURITY FIX #5: Validate Telegram webhook secret_token header
      const webhookSecret = await db.getConfigValue("tg_webhook_secret");
      if (webhookSecret) {
        const headerToken = req.headers["x-telegram-bot-api-secret-token"];
        if (headerToken !== webhookSecret) {
          console.warn("[Telegram] Webhook request rejected: invalid secret_token");
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      } else {
        console.warn("[Telegram] tg_webhook_secret not configured - webhook requests are not verified!");
      }

      const botToken = await db.getConfigValue("tg_bot_token");
      if (!botToken) {
        console.warn("[Telegram] Bot token not configured (key: tg_bot_token)");
        res.status(400).json({ error: "Bot token not configured" });
        return;
      }

      // Parse and validate update
      const update = TelegramUpdateSchema.parse(req.body);

      // === Auto-track Bot group membership ===
      // Handle my_chat_member events: Bot added/removed from group/channel
      const rawUpdate = req.body as any;
      const myChatMember = rawUpdate.my_chat_member;
      if (myChatMember) {
        const chat = myChatMember.chat;
        const newStatus = myChatMember.new_chat_member?.status;
        if (chat && (chat.type === "group" || chat.type === "supergroup" || chat.type === "channel")) {
          try {
            const { upsertTgGroupFromWebhook } = await import("../marketing");
            const isActive = newStatus === "member" || newStatus === "administrator";
            await upsertTgGroupFromWebhook({
              chatId: String(chat.id),
              name: chat.title || chat.username || String(chat.id),
              type: chat.type,
              isActive,
            });
            console.log(`[Telegram] Bot ${isActive ? 'joined' : 'left'} ${chat.type}: ${chat.title || chat.id}`);
          } catch (e) {
            console.warn("[Telegram] Failed to track group membership:", e);
          }
        }
        res.json({ ok: true });
        return;
      }

      // Auto-discover groups from any message the Bot receives in a group/channel
      const msgChat = rawUpdate.message?.chat || rawUpdate.channel_post?.chat;
      if (msgChat && (msgChat.type === "group" || msgChat.type === "supergroup" || msgChat.type === "channel")) {
        try {
          const { upsertTgGroupFromWebhook } = await import("../marketing");
          await upsertTgGroupFromWebhook({
            chatId: String(msgChat.id),
            name: msgChat.title || msgChat.username || String(msgChat.id),
            type: msgChat.type,
            isActive: true,
          });
        } catch (e) { /* Non-critical */ }
      }

      // === Handle callback_query (inline button clicks, e.g. red packet claims) ===
      const callbackQuery = rawUpdate.callback_query;
      if (callbackQuery) {
        const cbData = callbackQuery.data as string | undefined;
        const cbFrom = callbackQuery.from;
        const cbMessage = callbackQuery.message;
        if (cbData && cbFrom && cbMessage) {
          // ===== Coupon redeem: callback_data = "redeem_coupon_{code}" =====
          if (cbData.startsWith("redeem_coupon_")) {
            const couponCode = cbData.replace("redeem_coupon_", "");
            try {
              const user = await db.getUserByTgId(String(cbFrom.id));
              if (!user) {
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "请先启动 Bot 并注册账号后再领取！", show_alert: true }),
                });
              } else {
                const { redeemCoupon } = await import("../marketing");
                const result = await redeemCoupon(user.id, couponCode);
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: result.success ? `🎉 兑换成功！获得 ${result.amount} USDT，已到账余额。` : (result.message || "兑换失败"),
                    show_alert: true,
                  }),
                });
              }
            } catch (e: any) {
              console.error("[Telegram] Coupon redeem error:", e);
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "系统错误，请稍后重试", show_alert: true }),
              });
            }
            res.json({ ok: true });
            return;
          }

          // ===== Checkin: callback_data = "checkin" =====
          if (cbData === "checkin") {
            try {
              const user = await db.getUserByTgId(String(cbFrom.id));
              if (!user) {
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "请先启动 Bot 并注册账号后再签到！", show_alert: true }),
                });
              } else {
                const { performCheckin } = await import("../marketing");
                const result = await performCheckin(user.id);
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: result.success ? `✅ 签到成功！第${result.dayNumber}天，获得 ${result.reward} USDT 奖励！` : (result.message || "签到失败"),
                    show_alert: true,
                  }),
                });
              }
            } catch (e: any) {
              console.error("[Telegram] Checkin error:", e);
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "系统错误，请稍后重试", show_alert: true }),
              });
            }
            res.json({ ok: true });
            return;
          }

          // ===== Fission: callback_data = "fission_{linkCode}" =====
          if (cbData.startsWith("fission_")) {
            const linkCode = cbData.replace("fission_", "");
            try {
              const user = await db.getUserByTgId(String(cbFrom.id));
              const { getFissionCampaignByCode } = await import("../marketing");
              const campaign = await getFissionCampaignByCode(linkCode);
              if (!campaign) {
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "活动不存在或已结束", show_alert: true }),
                });
              } else {
                // Generate the user's personal referral link
                const miniAppUrl = (await db.getConfigValue("tg_webapp_url")) || "";
                const refLink = user ? `${miniAppUrl}?startapp=fission_${linkCode}_${user.id}` : `${miniAppUrl}?startapp=fission_${linkCode}`;
                const rewardText = Number(campaign.inviterReward) > 0 ? `✨ 每邀请1人奖励 ${campaign.inviterReward} USDT` : "";
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: `🚀 ${campaign.name}\n${rewardText}\n\n您的专属链接：\n${refLink}\n\n分享给朋友即可获得奖励！`,
                    show_alert: true,
                  }),
                });
              }
            } catch (e: any) {
              console.error("[Telegram] Fission error:", e);
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "系统错误，请稍后重试", show_alert: true }),
              });
            }
            res.json({ ok: true });
            return;
          }

          // ===== Event participate: callback_data = "event_{id}" =====
          if (cbData.startsWith("event_")) {
            const eventId = parseInt(cbData.replace("event_", ""), 10);
            try {
              const user = await db.getUserByTgId(String(cbFrom.id));
              if (!user) {
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "请先启动 Bot 并注册账号！", show_alert: true }),
                });
              } else {
                // Just confirm participation - event logic is handled by the game system
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: `✅ 已确认参与活动！请进入游戏开始体验。`,
                    show_alert: true,
                  }),
                });
              }
            } catch (e: any) {
              console.error("[Telegram] Event error:", e);
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "系统错误，请稍后重试", show_alert: true }),
              });
            }
            res.json({ ok: true });
            return;
          }

          // ===== Tournament direct register: callback_data = "tourney_reg_{id}" =====
          if (cbData.startsWith("tourney_reg_")) {
            const tournamentId = parseInt(cbData.replace("tourney_reg_", ""), 10);
            try {
              const user = await db.getUserByTgId(String(cbFrom.id));
              if (!user) {
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "请先启动 Bot 并注册账号后再报名！", show_alert: true }),
                });
              } else {
                // Attempt registration via the same logic as the tRPC endpoint
                const tournament = await db.getTournamentById(tournamentId);
                if (!tournament) {
                  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "比赛不存在", show_alert: true }),
                  });
                } else if (tournament.status !== "registration") {
                  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "报名已截止或比赛已开始", show_alert: true }),
                  });
                } else {
                  // Check if already registered
                  const existing = await db.getRegistration(tournamentId, user.id);
                  if (existing && existing.status !== "refunded") {
                    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "✅ 您已报名此比赛，无需重复报名", show_alert: true }),
                    });
                  } else {
                    // Check max players
                    const count = await db.getRegistrationCount(tournamentId);
                    if (count >= tournament.maxPlayers) {
                      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "报名已满，无法参加", show_alert: true }),
                      });
                    } else {
                      // Check balance
                      const entryFee = parseFloat(tournament.entryFee);
                      if (parseFloat(user.balance) < entryFee) {
                        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ callback_query_id: callbackQuery.id, text: `余额不足！报名费 ${tournament.entryFee} USDT，当前余额 ${user.balance} USDT。请先充值。`, show_alert: true }),
                        });
                      } else {
                        // Deduct balance and register
                        const balanceBefore = user.balance;
                        const deductResult = await db.deductUserBalanceAtomic(user.id, entryFee);
                        if (deductResult === null) {
                          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "余额不足，请先充值", show_alert: true }),
                          });
                        } else {
                          const balanceAfter = (parseFloat(balanceBefore) - entryFee).toFixed(2);
                          await db.createTransaction({
                            userId: user.id,
                            type: "tournament_entry",
                            amount: entryFee.toFixed(2),
                            balanceBefore,
                            balanceAfter,
                            status: "confirmed",
                            referenceType: "tournament",
                            referenceId: tournamentId,
                            note: `报名比赛(TG): ${tournament.name}`,
                          });
                          await db.registerForTournament(tournamentId, user.id, tournament.startingChips);
                          await db.updateTournament(tournamentId, { registeredCount: count + 1 });
                          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ callback_query_id: callbackQuery.id, text: `🎉 报名成功！\n比赛：${tournament.name}\n报名费：${tournament.entryFee} USDT\n剩余余额：${balanceAfter} USDT\n\n请在开赛时间进入游戏！`, show_alert: true }),
                          });
                        }
                      }
                    }
                  }
                }
              }
            } catch (e: any) {
              console.error("[Telegram] Tournament register error:", e);
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "系统错误，请稍后重试", show_alert: true }),
              });
            }
            res.json({ ok: true });
            return;
          }

          // Red packet claim: callback_data = "claim_rp_{id}"
          if (cbData.startsWith("claim_rp_")) {
            const rpId = parseInt(cbData.replace("claim_rp_", ""), 10);
            if (!isNaN(rpId)) {
              try {
                // Find user by tgId
                const user = await db.getUserByTgId(String(cbFrom.id));
                if (!user) {
                  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      callback_query_id: callbackQuery.id,
                      text: "\u8bf7\u5148\u542f\u52a8 Bot \u5e76\u6ce8\u518c\u8d26\u53f7\u540e\u518d\u9886\u53d6\u7ea2\u5305\uff01",
                      show_alert: true,
                    }),
                  });
                } else {
                  const { claimRedPacket, getRedPacket, getRedPacketClaims } = await import("../marketing");
                  const result = await claimRedPacket(user.id, rpId);
                  if (result.success) {
                    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        callback_query_id: callbackQuery.id,
                        text: `\ud83c\udf89 \u606d\u559c\u9886\u53d6 ${result.amount} USDT\uff01\u5df2\u5230\u8d26\u4f59\u989d\u3002`,
                        show_alert: true,
                      }),
                    });
                    // Update the message to show claim leaderboard
                    try {
                      const packet = await getRedPacket(rpId);
                      if (packet) {
                        const claims = await getRedPacketClaims(rpId);
                        let updatedText = `\ud83e\udde7 <b>${packet.title}</b>\n`;
                        if (packet.description) updatedText += `${packet.description}\n`;
                        updatedText += `\n\ud83d\udcb0 ${packet.claimedAmount}/${packet.totalAmount} USDT  \u5df2\u9886 ${packet.claimedCount}/${packet.totalCount} \u4efd\n`;
                        if (claims.length > 0) {
                          updatedText += `\n<b>\ud83c\udfc6 \u9886\u53d6\u8bb0\u5f55\uff1a</b>\n`;
                          for (const c of claims.slice(0, 15)) {
                            updatedText += `  ${c.nickname || c.tgUsername || '\u533f\u540d'} - ${c.amount} USDT\n`;
                          }
                          if (claims.length > 15) updatedText += `  ...\u8fd8\u6709 ${claims.length - 15} \u4eba\n`;
                        }
                        if (packet.claimedCount >= packet.totalCount) {
                          updatedText += `\n\u2705 \u7ea2\u5305\u5df2\u9886\u5b8c\uff01`;
                        } else {
                          updatedText += `\n\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u9886\u53d6\uff01`;
                        }
                        const inlineKeyboard: any[][] = [];
                        if (packet.claimedCount < packet.totalCount) {
                          inlineKeyboard.push([{ text: "\ud83e\udde7 \u62a2\u7ea2\u5305", callback_data: `claim_rp_${rpId}` }]);
                        }
                        // Preserve extra buttons (e.g. 开始游戏) from packet.buttons
                        if (packet.buttons && (packet.buttons as any[]).length > 0) {
                          const miniAppUrl = (await db.getConfigValue("tg_webapp_url")) || (await db.getConfigValue("tg_mini_app_url")) || "";
                          const rowMap = new Map<number, any[]>();
                          for (const btn of packet.buttons as Array<{ text: string; url?: string; callback_data?: string; type?: string; row?: number }>) {
                            const row = (btn.row ?? 0) + 1; // offset by 1 so claim button stays on row 0
                            if (!rowMap.has(row)) rowMap.set(row, []);
                            if (btn.type === "callback" && btn.callback_data) {
                              rowMap.get(row)!.push({ text: btn.text, callback_data: btn.callback_data });
                            } else if (btn.type === "web_app" && miniAppUrl) {
                              const fullUrl = btn.url?.startsWith("/") ? miniAppUrl + btn.url : (btn.url || miniAppUrl);
                              rowMap.get(row)!.push({ text: btn.text, web_app: { url: fullUrl } });
                            } else if (btn.url) {
                              const fullUrl = btn.url.startsWith("http") ? btn.url : (miniAppUrl + btn.url);
                              rowMap.get(row)!.push({ text: btn.text, url: fullUrl });
                            }
                          }
                          for (const [, btns] of [...rowMap.entries()].sort((a, b) => a[0] - b[0])) {
                            inlineKeyboard.push(btns);
                          }
                        }
                        const editBody: Record<string, unknown> = {
                          chat_id: cbMessage.chat.id,
                          message_id: cbMessage.message_id,
                          parse_mode: "HTML",
                        };
                        if (cbMessage.photo) {
                          editBody.caption = updatedText;
                          if (inlineKeyboard.length > 0) editBody.reply_markup = { inline_keyboard: inlineKeyboard };
                          await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(editBody),
                          });
                        } else {
                          editBody.text = updatedText;
                          if (inlineKeyboard.length > 0) editBody.reply_markup = { inline_keyboard: inlineKeyboard };
                          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(editBody),
                          });
                        }
                      }
                    } catch (editErr) {
                      console.warn("[Telegram] Failed to edit message after claim:", editErr);
                    }
                  } else {
                    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        callback_query_id: callbackQuery.id,
                        text: result.error || "\u9886\u53d6\u5931\u8d25",
                        show_alert: true,
                      }),
                    });
                  }
                }
              } catch (claimErr) {
                console.error("[Telegram] Red packet claim error:", claimErr);
                await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: "\u7cfb\u7edf\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
                    show_alert: true,
                  }),
                });
              }
            }
          }
        }
        res.json({ ok: true });
        return;
      }

      const message = update.message;

      if (!message || !message.text) {
        res.json({ ok: true });
        return;
      }

      const text = message.text.toLowerCase().trim();
      const userLang = message.from?.language_code; // TG user's language code
      const botTexts = getBotWelcomeText(userLang);
      let replyText = "";

      // Handle bot commands
      if (text.startsWith("/start")) {
        // Parse deep link parameter: /start room_XXXXX or /start ref_XXXXX
        const param = message.text!.split(" ")[1] || "";
        const miniAppUrl = await db.getConfigValue("tg_mini_app_url") || "";
        
        if (param.startsWith("room_")) {
          const inviteCode = param.replace("room_", "");
          replyText = botTexts.room;
          // Send with inline keyboard to open Mini App with room param
          const telegramApiUrl2 = `https://api.telegram.org/bot${botToken}/sendMessage`;
          await fetch(telegramApiUrl2, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: message.chat.id,
              text: replyText,
              reply_markup: {
                inline_keyboard: [[
                  { text: botTexts.button, web_app: { url: miniAppUrl ? `${miniAppUrl}?startapp=room_${inviteCode}` : "" } }
                ]]
              }
            }),
          });
          res.json({ ok: true });
          return;
        } else if (param.startsWith("ref_")) {
          const refCode = param.replace("ref_", "");
          replyText = botTexts.ref;
          if (miniAppUrl) {
            const telegramApiUrl2 = `https://api.telegram.org/bot${botToken}/sendMessage`;
            // web_app.url does NOT support startapp= param; pass ref code as URL hash fragment
            // Frontend reads location.hash or #tgWebAppStartParam from TG SDK
            const webAppUrl = `${miniAppUrl}#tgWebAppStartParam=ref_${refCode}`;
            await fetch(telegramApiUrl2, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                reply_markup: {
                  inline_keyboard: [[
                    { text: botTexts.button, web_app: { url: webAppUrl } }
                  ]]
                }
              }),
            });
            res.json({ ok: true });
            return;
          }
        } else {
          // Try DB-based welcome template first (multi-language with image+buttons)
          try {
            const { getWelcomeTemplateByLanguage } = await import("../marketing");
            const welcomeTemplate = await getWelcomeTemplateByLanguage(userLang || "en");
            if (welcomeTemplate) {
              // Build inline keyboard from template buttons
              let inlineKeyboard: any[][] = [];
              if (welcomeTemplate.buttons && Array.isArray(welcomeTemplate.buttons) && welcomeTemplate.buttons.length > 0) {
                const rowMap = new Map<number, any[]>();
                for (const btn of welcomeTemplate.buttons as Array<{ text: string; url: string; type?: string; row?: number }>) {
                  const row = btn.row ?? 0;
                  if (!rowMap.has(row)) rowMap.set(row, []);
                  // Use explicit type field: web_app opens Mini App, url opens link
                  if (btn.type === "web_app") {
                    rowMap.get(row)!.push({ text: btn.text, web_app: { url: btn.url } });
                  } else {
                    rowMap.get(row)!.push({ text: btn.text, url: btn.url });
                  }
                }
                inlineKeyboard = [...rowMap.entries()].sort((a, b) => a[0] - b[0]).map(([, btns]) => btns);
              } else if (miniAppUrl) {
                // Default: add a "Play Now" button opening the Mini App
                inlineKeyboard = [[{ text: botTexts.button, web_app: { url: miniAppUrl } }]];
              }

              if (welcomeTemplate.imageUrl) {
                // Send photo with caption
                await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: message.chat.id,
                    photo: welcomeTemplate.imageUrl,
                    caption: welcomeTemplate.content,
                    parse_mode: "HTML",
                    reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
                  }),
                });
              } else {
                // Send text message
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: message.chat.id,
                    text: welcomeTemplate.content,
                    parse_mode: "HTML",
                    reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
                  }),
                });
              }
              res.json({ ok: true });
              return;
            }
          } catch (e) {
            console.warn("[Telegram] Welcome template lookup failed, falling back to hardcoded:", e);
          }

          // Fallback to hardcoded welcome text with user info + menu buttons
          const tgId = String(message.from!.id);
          const existingUser = await db.getUserByTgId(tgId);
          if (existingUser) {
            // Show user info like KKPoker style
            const nickname = existingUser.nickname || existingUser.name || "Player";
            const balance = parseFloat(existingUser.balance || "0").toFixed(2);
            replyText = `欢迎回来 Vera Poker！\n\n` +
              `昵称：${nickname}\n` +
              `ID：${existingUser.id}\n` +
              `💰 资产：${balance} USDT`;
          } else {
            replyText = botTexts.welcome;
          }
          // Build menu buttons: 开始游戏 + 官方频道 + 官方群组
          const channelUrl = await db.getConfigValue("tg_channel_url", "");
          const groupUrl = await db.getConfigValue("tg_group_url", "");
          const startKeyboard: any[][] = [];
          if (miniAppUrl) {
            startKeyboard.push([{ text: "🎮 开始游戏", web_app: { url: miniAppUrl } }]);
          }
          const linkRow: any[] = [];
          if (channelUrl) linkRow.push({ text: "📢 官方频道", url: channelUrl });
          if (groupUrl) linkRow.push({ text: "👥 官方群组", url: groupUrl });
          if (linkRow.length > 0) startKeyboard.push(linkRow);
          if (miniAppUrl || startKeyboard.length > 0) {
            const telegramApiUrl2 = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await fetch(telegramApiUrl2, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                reply_markup: startKeyboard.length > 0 ? { inline_keyboard: startKeyboard } : undefined,
              }),
            });
            res.json({ ok: true });
            return;
          }
        }
      } else if (text.startsWith("/help")) {
        const cmdTexts = getBotCommandText(userLang);
        replyText = cmdTexts.help;
      } else if (text.startsWith("/balance") || text === "/me" || text === "/my") {
        // /me: Show user profile + game stats
        const tgId = String(message.from!.id);
        const user = await db.getUserByTgId(tgId);
        if (!user) {
          replyText = "请先启动 Bot 并注册账号！\n\n点击下方按钮开始：";
          const miniAppUrl = await db.getConfigValue("tg_mini_app_url", "");
          if (miniAppUrl) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                reply_markup: { inline_keyboard: [[{ text: "🎮 开始游戏", web_app: { url: miniAppUrl } }]] }
              }),
            });
            res.json({ ok: true });
            return;
          }
        } else {
          const stats = await db.getUserGameStats(user.id);
          const nickname = user.nickname || user.name || "Player";
          const balance = parseFloat(user.balance || "0").toFixed(2);
          const profitVal = parseFloat(stats?.totalProfit || "0");
          const profitSign = profitVal >= 0 ? "+" : "";
          replyText = `👤 我的信息\n\n` +
            `昵称：${nickname}\n` +
            `ID：${user.id}\n` +
            `💰 资产：${balance} USDT\n\n` +
            `📊 游戏统计\n` +
            `━━━━━━━━━━\n` +
            `🎰 总手数：${stats?.totalHands || 0}\n` +
            `🏆 胜率：${stats?.winRate || "0.0"}%\n` +
            `💵 总盈亏：${profitSign}${stats?.totalProfit || "0.00"} USDT\n` +
            `📈 最大单手赢：${stats?.maxWin || "0.00"} USDT`;
          // Build buttons
          const miniAppUrl = await db.getConfigValue("tg_mini_app_url", "");
          const channelUrl = await db.getConfigValue("tg_channel_url", "");
          const groupUrl = await db.getConfigValue("tg_group_url", "");
          const inlineKeyboard: any[][] = [];
          if (miniAppUrl) {
            inlineKeyboard.push([{ text: "🎮 开始游戏", web_app: { url: miniAppUrl } }]);
          }
          const row2: any[] = [];
          if (channelUrl) row2.push({ text: "📢 官方频道", url: channelUrl });
          if (groupUrl) row2.push({ text: "👥 官方群组", url: groupUrl });
          if (row2.length > 0) inlineKeyboard.push(row2);
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: message.chat.id,
              text: replyText,
              reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
            }),
          });
          res.json({ ok: true });
          return;
        }
      } else if (text.startsWith("/rooms") || text === "/game") {
        // /game: Show active rooms with player counts
        const publicRooms = await db.getPublicRooms();
        const miniAppUrl = await db.getConfigValue("tg_mini_app_url", "");
        if (publicRooms.length === 0) {
          replyText = "🎲 当前没有开放的房间\n\n请稍后再试！";
        } else {
          replyText = `🎲 当前开放房间（${publicRooms.length} 个）\n━━━━━━━━━━\n\n`;
          for (const room of publicRooms.slice(0, 8)) {
            const statusIcon = room.status === "playing" ? "🟢" : "⚪";
            replyText += `${statusIcon} ${room.name}\n`;
            replyText += `   盲注 ${room.smallBlind}/${room.bigBlind} | 买入 ${room.minBuyIn}-${room.maxBuyIn}\n`;
            replyText += `   在线 ${room.currentPlayers}/${room.maxPlayers} 人\n\n`;
          }
        }
        const inlineKeyboard: any[][] = [];
        if (miniAppUrl) {
          inlineKeyboard.push([{ text: "🎮 立即加入", web_app: { url: miniAppUrl } }]);
        }
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: replyText,
            reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
          }),
        });
        res.json({ ok: true });
        return;
      } else {
        // Check auto-reply rules first (keyword matching)
        const { matchAutoReply } = await import("../marketing");
        const autoRule = await matchAutoReply(message.text || text);
        if (autoRule) {
          replyText = autoRule.replyContent;
          if (autoRule.replyType === "text_button" && autoRule.buttonText && autoRule.buttonUrl) {
            const telegramApiUrl2 = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await fetch(telegramApiUrl2, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [[{ text: autoRule.buttonText, url: autoRule.buttonUrl }]]
                }
              }),
            });
            res.json({ ok: true });
            return;
          }
        } else {
          const cmdTexts = getBotCommandText(userLang);
          replyText = cmdTexts.unknown;
        }
      }

      // Send reply via Telegram API
      const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: replyText,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[Telegram] API error:", error);
      }

      // Always return 200 to acknowledge webhook
      res.json({ ok: true });
    } catch (error) {
      console.error("[Telegram] Webhook error:", error);
      res.status(200).json({ ok: true }); // Return 200 even on error to prevent Telegram retries
    }
  });

  // Health check endpoint
  app.get("/api/telegram/health", (req: Request, res: Response) => {
    res.json({ ok: true, service: "telegram-webhook" });
  });

  // Set bot commands (menu button) on startup
  (async () => {
    try {
      const botToken = await db.getConfigValue("tg_bot_token");
      if (!botToken) return;
      await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start", description: "🏠 首页 - 显示个人信息" },
            { command: "game", description: "🎮 游戏 - 查看当前房间" },
            { command: "me", description: "👤 我的 - 查看统计数据" },
          ]
        }),
      });
      console.log("[Telegram] Bot commands registered: /start, /game, /me");
      // Set menu button to web_app (VPoker button) - commands still accessible via / input
      const miniAppUrl = await db.getConfigValue("tg_mini_app_url") || "https://game.verapoker.com/";
      await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: {
            type: "web_app",
            text: "VPoker",
            web_app: { url: miniAppUrl }
          }
        }),
      });
      console.log("[Telegram] Menu button set to web_app (VPoker)");
    } catch (e) {
      console.warn("[Telegram] Failed to set bot commands:", e);
    }
  })();
}
