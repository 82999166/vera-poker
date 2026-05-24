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
    }),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    text: z.string().optional(),
  }).optional(),
}).passthrough();

export function registerTelegramRoutes(app: Express) {
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    try {
      // Validate webhook signature (optional but recommended)
      const botToken = await db.getConfigValue("telegram_bot_token");
      if (!botToken) {
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
      let replyText = "";

      // Handle bot commands
      if (text.startsWith("/start")) {
        // Parse deep link parameter: /start room_XXXXX or /start ref_XXXXX
        const param = message.text!.split(" ")[1] || "";
        const miniAppUrl = await db.getConfigValue("telegram_mini_app_url") || "";
        
        if (param.startsWith("room_")) {
          const inviteCode = param.replace("room_", "");
          replyText = `🎰 You've been invited to a private room!\n\nTap the button below to join the game:`;
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
                  { text: "🃏 Join Room", web_app: { url: miniAppUrl ? `${miniAppUrl}?startapp=room_${inviteCode}` : "" } }
                ]]
              }
            }),
          });
          res.json({ ok: true });
          return;
        } else if (param.startsWith("ref_")) {
          const refCode = param.replace("ref_", "");
          replyText = `Welcome to Vera Poker! 🎰\n\nYou were referred by a friend. Tap below to start playing and earn rewards!`;
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
                    { text: "🎰 Play Now", web_app: { url: `${miniAppUrl}?startapp=ref_${refCode}` } }
                  ]]
                }
              }),
            });
            res.json({ ok: true });
            return;
          }
        } else {
          replyText = "Welcome to Vera Poker! 🎰\n\nThe world's first provably fair poker platform.\n\nUse /help to see available commands.";
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
                    { text: "🃏 Open Vera Poker", web_app: { url: miniAppUrl } }
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
        replyText = "I didn't understand that command. Use /help for available commands.";
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
