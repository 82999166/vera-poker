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
      // Validate webhook signature (optional but recommended)
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
        replyText = `Available commands:\n/start - Start the bot\n/balance - Check your balance\n/rooms - List active rooms\n/help - Show this message`;
      } else if (text.startsWith("/balance")) {
        replyText = "Please link your account first using /start";
      } else if (text.startsWith("/rooms")) {
        const rooms = await db.getPublicRooms();
        replyText = `Active rooms: ${rooms.length}\n\nVisit the app to join a game!`;
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
          replyText = "I didn't understand that command. Use /help for available commands.";
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
