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

          // Fallback to hardcoded welcome text
          replyText = botTexts.welcome;
          if (miniAppUrl) {
            const telegramApiUrl2 = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await fetch(telegramApiUrl2, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                reply_markup: {
                  inline_keyboard: [[
                    { text: botTexts.button, web_app: { url: miniAppUrl } }
                  ]]
                }
              }),
            });
            res.json({ ok: true });
            return;
          }
        }
      } else if (text.startsWith("/help")) {
        const cmdTexts = getBotCommandText(userLang);
        replyText = cmdTexts.help;
      } else if (text.startsWith("/balance")) {
        const cmdTexts = getBotCommandText(userLang);
        replyText = cmdTexts.balance;
      } else if (text.startsWith("/rooms")) {
        const cmdTexts = getBotCommandText(userLang);
        const rooms = await db.getPublicRooms();
        replyText = cmdTexts.rooms.replace("{count}", String(rooms.length));
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
}
