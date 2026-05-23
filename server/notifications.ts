/**
 * Telegram Push Notification Service
 * Sends notifications to players via Telegram Bot
 */
import * as db from "./db";

export type NotificationType = 
  | "private_room_invite"   // 被邀请加入私人房
  | "turn_action"           // 轮到操作
  | "game_starting"         // 游戏即将开始
  | "balance_change"        // 余额变动
  | "system_announcement";  // 系统公告

interface NotificationPayload {
  type: NotificationType;
  userId: number;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Send a Telegram message to a user by their tgId
async function sendTelegramMessage(tgChatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  try {
    const botToken = await db.getConfigValue("telegram_bot_token");
    if (!botToken) {
      console.warn("[Notifications] Bot token not configured");
      return false;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Notifications] TG send error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Notifications] Send failed:", error);
    return false;
  }
}

// Get user's TG chat ID (same as tgId for private chats)
async function getUserTgId(userId: number): Promise<string | null> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await dbInstance.select({ tgId: users.tgId }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.tgId || null;
}

// Check if notifications are enabled for this user (could be extended with per-user preferences)
async function isNotificationEnabled(userId: number): Promise<boolean> {
  const tgId = await getUserTgId(userId);
  return !!tgId;
}

// Format notification message based on type
function formatNotification(payload: NotificationPayload): string {
  const { type, title, body, data } = payload;
  
  switch (type) {
    case "private_room_invite":
      return `🎯 <b>${title}</b>\n\n${body}\n\n${data?.roomName ? `房间: ${data.roomName}` : ""}`;
    case "turn_action":
      return `⏰ <b>${title}</b>\n\n${body}\n\n${data?.timeLeft ? `剩余时间: ${data.timeLeft}秒` : ""}`;
    case "game_starting":
      return `🎮 <b>${title}</b>\n\n${body}`;
    case "balance_change":
      return `💰 <b>${title}</b>\n\n${body}\n\n${data?.amount ? `金额: ${data.amount}` : ""}`;
    case "system_announcement":
      return `📢 <b>${title}</b>\n\n${body}`;
    default:
      return `<b>${title}</b>\n\n${body}`;
  }
}

// Main notification sender
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  const tgId = await getUserTgId(payload.userId);
  if (!tgId) return false;

  const message = formatNotification(payload);
  return sendTelegramMessage(tgId, message);
}

// Batch send to multiple users
export async function sendBatchNotification(
  userIds: number[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const success = await sendNotification({ type, userId, title, body, data });
    if (success) sent++;
    else failed++;
    // Rate limit: 30 messages per second for Telegram
    await new Promise(resolve => setTimeout(resolve, 35));
  }

  return { sent, failed };
}

// Convenience functions for common notifications
export async function notifyPrivateRoomInvite(userId: number, roomName: string, inviterName: string): Promise<boolean> {
  return sendNotification({
    type: "private_room_invite",
    userId,
    title: "私人房邀请",
    body: `${inviterName} 邀请你加入私人房`,
    data: { roomName },
  });
}

export async function notifyTurnAction(userId: number, roomName: string, timeLeft: number): Promise<boolean> {
  return sendNotification({
    type: "turn_action",
    userId,
    title: "轮到你操作",
    body: `在 ${roomName} 中轮到你行动了`,
    data: { timeLeft },
  });
}

export async function notifyGameStarting(userId: number, roomName: string): Promise<boolean> {
  return sendNotification({
    type: "game_starting",
    userId,
    title: "游戏即将开始",
    body: `${roomName} 的游戏即将开始，请准备就绪！`,
  });
}

export async function notifyBalanceChange(userId: number, amount: string, reason: string): Promise<boolean> {
  return sendNotification({
    type: "balance_change",
    userId,
    title: "余额变动",
    body: reason,
    data: { amount },
  });
}

export { sendTelegramMessage, getUserTgId, isNotificationEnabled };
