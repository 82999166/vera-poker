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
  | "deposit_confirmed"     // 充值到账
  | "withdrawal_approved"   // 提现已审批
  | "withdrawal_rejected"   // 提现被拒绝
  | "commission_earned"     // 佣金到账
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
    const botToken = await db.getConfigValue("tg_bot_token");
    if (!botToken) {
      console.warn("[Notifications] Bot token not configured (key: tg_bot_token)");
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
      return data?.isTimeout
        ? `⏱ <b>${title}</b>\n\n${body}`
        : `⏰ <b>${title}</b>\n\n${body}\n\n${data?.timeLeft ? `剩余时间: ${data.timeLeft}秒` : ""}`;
    case "game_starting":
      return `🎮 <b>${title}</b>\n\n${body}`;
    case "balance_change":
      return `💰 <b>${title}</b>\n\n${body}\n\n${data?.amount ? `金额: ${data.amount}` : ""}`;
    case "deposit_confirmed":
      return `✅ <b>${title}</b>\n\n${body}\n\n${data?.amount ? `金额: $${data.amount}` : ""}${data?.chain ? `\n链: ${data.chain}` : ""}`;
    case "withdrawal_approved":
      return `💸 <b>${title}</b>\n\n${body}\n\n${data?.amount ? `金额: $${data.amount}` : ""}${data?.txHash ? `\nTX: ${data.txHash}` : ""}`;
    case "withdrawal_rejected":
      return `❌ <b>${title}</b>\n\n${body}\n\n${data?.amount ? `金额: $${data.amount}` : ""}${data?.reason ? `\n原因: ${data.reason}` : ""}`;
    case "commission_earned":
      return `💵 <b>${title}</b>\n\n${body}\n\n${data?.amount ? `佣金: $${data.amount}` : ""}`;
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
  const isTimeout = timeLeft === 0;
  return sendNotification({
    type: "turn_action",
    userId,
    title: isTimeout ? "操作超时，已自动弃牌" : "轮到你操作",
    body: isTimeout
      ? `你在 ${roomName} 中操作超时，已自动弃牌并离开游戏`
      : `在 ${roomName} 中轮到你行动了`,
    data: { timeLeft, isTimeout },
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

// ==================== ADMIN NOTIFICATIONS ====================
// Notify all admins about important events (supports comma-separated multiple Chat IDs)
export async function notifyAdmins(title: string, body: string, data?: Record<string, any>): Promise<void> {
  try {
    // Get admin notification chat IDs from config (supports comma-separated multiple IDs)
    const adminChatIdRaw = await db.getConfigValue("admin_tg_chat_id");
    if (!adminChatIdRaw) {
      console.warn("[Notifications] Admin TG chat ID not configured");
      return;
    }
    // Parse comma-separated IDs, trim whitespace
    const adminChatIds = adminChatIdRaw.split(",").map((id: string) => id.trim()).filter(Boolean);
    if (adminChatIds.length === 0) return;
    const message = `🔔 <b>[Admin] ${title}</b>\n\n${body}${data ? `\n\n<pre>${JSON.stringify(data, null, 2)}</pre>` : ""}`;
    // Send to all admins concurrently
    await Promise.allSettled(adminChatIds.map((chatId: string) => sendTelegramMessage(chatId, message)));
  } catch (e) {
    console.error("[Notifications] Admin notify failed:", e);
  }
}

// Notify user about deposit confirmation
export async function notifyDepositConfirmed(userId: number, amount: string, chain?: string): Promise<boolean> {
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: "充值到账",
    body: `您的充值已确认到账`,
    data: { amount, chain },
  });
}

// Notify user about withdrawal approval
export async function notifyWithdrawalApproved(userId: number, amount: string, txHash?: string): Promise<boolean> {
  return sendNotification({
    type: "withdrawal_approved",
    userId,
    title: "提现已审批",
    body: `您的提现申请已通过并完成转账`,
    data: { amount, txHash },
  });
}

// Notify user about withdrawal rejection
export async function notifyWithdrawalRejected(userId: number, amount: string, reason?: string): Promise<boolean> {
  return sendNotification({
    type: "withdrawal_rejected",
    userId,
    title: "提现被拒绝",
    body: `您的提现申请未通过审核，资金已退回`,
    data: { amount, reason },
  });
}

// Notify agent about commission earned
export async function notifyCommissionEarned(userId: number, amount: string, fromUser?: string): Promise<boolean> {
  return sendNotification({
    type: "commission_earned",
    userId,
    title: "佣金到账",
    body: `您获得了一笔代理佣金`,
    data: { amount, fromUser },
  });
}

// Notify user that deposit request was received (pending review)
export async function notifyDepositReceived(userId: number, amount: string, chain?: string): Promise<boolean> {
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: "充值申请已收到",
    body: `您的充值申请 $${amount}${chain ? ` (${chain})` : ""} 已提交，请等待管理员确认到账`,
    data: { amount, chain },
  });
}

// Notify user that deposit was rejected
export async function notifyDepositRejected(userId: number, amount: string, reason?: string): Promise<boolean> {
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: "充值申请被拒绝",
    body: `您的充值申请 $${amount} 未通过审核${reason ? `，原因：${reason}` : "，请联系客服确认"}`,
    data: { amount, reason },
  });
}

// Notify user that withdrawal request was received (pending review)
export async function notifyWithdrawalReceived(userId: number, amount: string, chain?: string): Promise<boolean> {
  return sendNotification({
    type: "withdrawal_approved",
    userId,
    title: "提现申请已收到",
    body: `您的提现申请 $${amount}${chain ? ` (${chain})` : ""} 已提交，请等待管理员审核处理`,
    data: { amount, chain },
  });
}

// Notify agent that a new downline has bound their invite code
export async function notifyNewDownline(agentId: number, downlineName: string): Promise<boolean> {
  return sendNotification({
    type: "commission_earned",
    userId: agentId,
    title: "新下线绑定成功",
    body: `${downlineName} 已通过您的邀请码成功注册并绑定，开始为您产生佣金`,
    data: { downlineName },
  });
}

// ==================== TOURNAMENT NOTIFICATIONS ====================
// Notify user that tournament registration was successful
export async function notifyTournamentRegistered(userId: number, tournamentName: string, entryFee: string, startTime: string): Promise<boolean> {
  return sendNotification({
    type: "system_announcement",
    userId,
    title: "比赛报名成功",
    body: `您已成功报名参加「${tournamentName}」\n报名费: $${entryFee}\n开赛时间: ${startTime}\n请准时参赛，祝您好运！`,
    data: { tournamentName, entryFee, startTime },
  });
}

// Notify user that tournament registration was cancelled (refunded)
export async function notifyTournamentCancelled(userId: number, tournamentName: string, entryFee: string): Promise<boolean> {
  return sendNotification({
    type: "balance_change",
    userId,
    title: "比赛报名已取消",
    body: `您已取消报名「${tournamentName}」\n报名费 $${entryFee} 已退回到您的账户`,
    data: { tournamentName, entryFee },
  });
}

// Notify all registered users that tournament is starting soon
export async function notifyTournamentStartingSoon(userId: number, tournamentName: string, minutesLeft: number): Promise<boolean> {
  return sendNotification({
    type: "game_starting",
    userId,
    title: "比赛即将开始",
    body: `「${tournamentName}」将在 ${minutesLeft} 分钟后开始，请做好准备！`,
    data: { tournamentName, minutesLeft },
  });
}

// Notify user that tournament has officially started (admin manually triggered)
export async function notifyTournamentStarted(userId: number, tournamentName: string, playerCount: number, startingChips: number): Promise<boolean> {
  return sendNotification({
    type: "game_starting",
    userId,
    title: "🚀 比赛正式开始！",
    body: `「${tournamentName}」已正式开始！\n参赛人数: ${playerCount} 人 | 初始筹码: ${startingChips.toLocaleString()}\n请立即进入游戏大厅参赛，祝您好运！`,
    data: { tournamentName, playerCount, startingChips },
  });
}

// Notify user of their tournament result
export interface TopRanking {
  rank: number;
  name: string;
  prize: string;
}

export async function notifyTournamentResult(
  userId: number,
  tournamentName: string,
  rank: number,
  prize: string,
  topRankings?: TopRanking[]
): Promise<boolean> {
  const isWinner = rank <= 3;
  
  // Build top-3 summary
  let topSummary = "";
  if (topRankings && topRankings.length > 0) {
    const medals = ["🥇", "🥈", "🥉"];
    topSummary = "\n\n--- 比赛结果 ---";
    for (const tr of topRankings) {
      const medal = medals[tr.rank - 1] || `#${tr.rank}`;
      topSummary += `\n${medal} ${tr.name}: $${tr.prize}`;
    }
  }

  const myResult = isWinner
    ? `恭喜您在「${tournamentName}」中获得第${rank}名！\n奖金 $${prize} 已发放到您的账户`
    : `「${tournamentName}」已结束，您的最终排名为第${rank}名${parseFloat(prize) > 0 ? `\n奖金 $${prize} 已发放到您的账户` : ""}`;

  return sendNotification({
    type: "balance_change",
    userId,
    title: isWinner ? `🏆 比赛获奖 - 第${rank}名` : `比赛结束 - 第${rank}名`,
    body: myResult + topSummary,
    data: { tournamentName, rank, prize, topRankings },
  });
}

export { sendTelegramMessage, getUserTgId, isNotificationEnabled };
