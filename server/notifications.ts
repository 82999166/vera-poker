/**
 * Telegram 推送通知服务（多语言版）
 * 通过 Telegram Bot 向玩家发送各类通知
 * 所有通知文本根据用户 languageCode 自动翻译
 */
import * as db from "./db";
import { nt, getUserLang } from "./notificationI18n";

export type NotificationType = 
  | "private_room_invite"     // 被邀请加入私人房
  | "turn_action"             // 轮到操作
  | "game_starting"           // 游戏即将开始
  | "balance_change"          // 余额变动
  | "deposit_confirmed"       // 充值到账
  | "withdrawal_approved"     // 提现已审批
  | "withdrawal_rejected"     // 提现被拒绝
  | "commission_earned"       // 佣金到账
  | "tournament_registered"   // 锦标赛报名成功
  | "tournament_starting"     // 锦标赛即将/已开始
  | "tournament_result"       // 锦标赛结果
  | "system_announcement";    // 系统公告

interface NotificationPayload {
  type: NotificationType;
  userId: number;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// 向指定 TG Chat ID 发送消息
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

// 获取用户的 TG Chat ID
async function getUserTgId(userId: number): Promise<string | null> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await dbInstance.select({ tgId: users.tgId }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.tgId || null;
}

// 检查用户是否启用通知
async function isNotificationEnabled(userId: number): Promise<boolean> {
  const tgId = await getUserTgId(userId);
  return !!tgId;
}

// 格式化通知消息（根据类型添加 emoji 前缀）
function formatNotification(payload: NotificationPayload): string {
  const { type, title, body } = payload;
  
  const emojiMap: Record<NotificationType, string> = {
    private_room_invite: "🎯",
    turn_action: "⏰",
    game_starting: "🎮",
    balance_change: "💰",
    deposit_confirmed: "✅",
    withdrawal_approved: "💸",
    withdrawal_rejected: "❌",
    commission_earned: "💵",
    tournament_registered: "🏆",
    tournament_starting: "🚨",
    tournament_result: "🏅",
    system_announcement: "📢",
  };

  const emoji = emojiMap[type] || "";
  return `${emoji} <b>${title}</b>\n\n${body}`;
}

// 通知类型到偏好 key 的映射
const typeToPrefsKey: Record<NotificationType, string> = {
  private_room_invite: "privateRoomInvite",
  turn_action: "turnAction",
  game_starting: "gameStarting",
  balance_change: "deposit",
  deposit_confirmed: "deposit",
  withdrawal_approved: "withdrawal",
  withdrawal_rejected: "withdrawal",
  commission_earned: "commission",
  tournament_registered: "tournament",
  tournament_starting: "tournament",
  tournament_result: "tournament",
  system_announcement: "system",
};

// 检查用户是否开启了该类型的通知
async function checkNotificationPrefs(userId: number, type: NotificationType): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return true; // 数据库不可用时默认允许
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await dbInstance.select({ notificationPrefs: users.notificationPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.notificationPrefs) return true; // null 表示全部开启
  const prefsKey = typeToPrefsKey[type];
  if (!prefsKey) return true;
  const val = (user.notificationPrefs as any)[prefsKey];
  return val !== false; // 只有明确设为 false 才禁止
}

// 主通知发送函数
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  // 检查用户通知偏好
  const allowed = await checkNotificationPrefs(payload.userId, payload.type);
  if (!allowed) return false;

  const tgId = await getUserTgId(payload.userId);
  if (!tgId) return false;

  const message = formatNotification(payload);
  return sendTelegramMessage(tgId, message);
}

// 批量发送通知
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
    // Telegram 限速：每秒 30 条
    await new Promise(resolve => setTimeout(resolve, 35));
  }

  return { sent, failed };
}

// ==================== 多语言便捷通知函数 ====================

/** 私人房邀请通知 */
export async function notifyPrivateRoomInvite(userId: number, roomName: string, inviterName: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "private_room_invite",
    userId,
    title: nt(lang, "privateRoomInvite.title"),
    body: nt(lang, "privateRoomInvite.body", { inviter: inviterName }) + "\n\n" + nt(lang, "format.room", { value: roomName }),
  });
}

/** 轮到操作 / 操作超时通知 */
export async function notifyTurnAction(userId: number, roomName: string, timeLeft: number): Promise<boolean> {
  const lang = await getUserLang(userId);
  const isTimeout = timeLeft === 0;
  return sendNotification({
    type: "turn_action",
    userId,
    title: isTimeout ? nt(lang, "turnTimeout.title") : nt(lang, "turnAction.title"),
    body: isTimeout
      ? nt(lang, "turnTimeout.body", { room: roomName })
      : nt(lang, "turnAction.body", { room: roomName }) + "\n\n" + nt(lang, "format.timeLeft", { value: String(timeLeft) }),
    data: { timeLeft, isTimeout },
  });
}

/** 游戏即将开始通知 */
export async function notifyGameStarting(userId: number, roomName: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "game_starting",
    userId,
    title: nt(lang, "gameStarting.title"),
    body: nt(lang, "gameStarting.body", { room: roomName }),
  });
}

/** 余额变动通知 */
export async function notifyBalanceChange(userId: number, amount: string, reason: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "balance_change",
    userId,
    title: nt(lang, "balanceChange.title"),
    body: reason + "\n\n" + nt(lang, "format.amount", { value: amount }),
    data: { amount },
  });
}

/** 充值到账通知 */
export async function notifyDepositConfirmed(userId: number, amount: string, chain?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: nt(lang, "deposit.title"),
    body: nt(lang, "deposit.body") + "\n\n" + nt(lang, "format.amount", { value: amount }) + (chain ? nt(lang, "format.chain", { value: chain }) : ""),
    data: { amount, chain },
  });
}

/** 充值申请已收到通知 */
export async function notifyDepositReceived(userId: number, amount: string, chain?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  const chainStr = chain ? ` (${chain})` : "";
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: nt(lang, "depositReceived.title"),
    body: nt(lang, "depositReceived.body", { amount, chain: chainStr }),
    data: { amount, chain },
  });
}

/** 充值被拒绝通知 */
export async function notifyDepositRejected(userId: number, amount: string, reason?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  const reasonStr = reason ? ` (${reason})` : "";
  return sendNotification({
    type: "deposit_confirmed",
    userId,
    title: nt(lang, "depositRejected.title"),
    body: nt(lang, "depositRejected.body", { amount, reason: reasonStr }),
    data: { amount, reason },
  });
}

/** 提现已审批通知 */
export async function notifyWithdrawalApproved(userId: number, amount: string, txHash?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "withdrawal_approved",
    userId,
    title: nt(lang, "withdrawalApproved.title"),
    body: nt(lang, "withdrawalApproved.body") + "\n\n" + nt(lang, "format.amount", { value: amount }) + (txHash ? nt(lang, "format.txHash", { value: txHash }) : ""),
    data: { amount, txHash },
  });
}

/** 提现被拒绝通知 */
export async function notifyWithdrawalRejected(userId: number, amount: string, reason?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "withdrawal_rejected",
    userId,
    title: nt(lang, "withdrawalRejected.title"),
    body: nt(lang, "withdrawalRejected.body") + "\n\n" + nt(lang, "format.amount", { value: amount }) + (reason ? nt(lang, "format.reason", { value: reason }) : ""),
    data: { amount, reason },
  });
}

/** 提现申请已收到通知 */
export async function notifyWithdrawalReceived(userId: number, amount: string, chain?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  const chainStr = chain ? ` (${chain})` : "";
  return sendNotification({
    type: "withdrawal_approved",
    userId,
    title: nt(lang, "withdrawalReceived.title"),
    body: nt(lang, "withdrawalReceived.body", { amount, chain: chainStr }),
    data: { amount, chain },
  });
}

/** 代理佣金到账通知 */
export async function notifyCommissionEarned(userId: number, amount: string, fromUser?: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "commission_earned",
    userId,
    title: nt(lang, "commission.title"),
    body: nt(lang, "commission.body") + "\n\n" + nt(lang, "format.commission", { value: amount }),
    data: { amount, fromUser },
  });
}

/** 新下线绑定通知 */
export async function notifyNewDownline(agentId: number, downlineName: string): Promise<boolean> {
  const lang = await getUserLang(agentId);
  return sendNotification({
    type: "commission_earned",
    userId: agentId,
    title: nt(lang, "newDownline.title"),
    body: nt(lang, "newDownline.body", { name: downlineName }),
    data: { downlineName },
  });
}

// ==================== 管理员通知（不需要多语言） ====================

/** 通知所有管理员（支持逗号分隔多个 Chat ID） */
export async function notifyAdmins(title: string, body: string, data?: Record<string, any>): Promise<void> {
  try {
    const adminChatIdRaw = await db.getConfigValue("admin_tg_chat_id");
    if (!adminChatIdRaw) {
      console.warn("[Notifications] Admin TG chat ID not configured");
      return;
    }
    const adminChatIds = adminChatIdRaw.split(",").map((id: string) => id.trim()).filter(Boolean);
    if (adminChatIds.length === 0) return;
    const message = `🔔 <b>[Admin] ${title}</b>\n\n${body}${data ? `\n\n<pre>${JSON.stringify(data, null, 2)}</pre>` : ""}`;
    await Promise.allSettled(adminChatIds.map((chatId: string) => sendTelegramMessage(chatId, message)));
  } catch (e) {
    console.error("[Notifications] Admin notify failed:", e);
  }
}

// ==================== 锦标赛通知（多语言） ====================

/** 锦标赛报名成功通知 */
export async function notifyTournamentRegistered(userId: number, tournamentName: string, entryFee: string, startTime: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "tournament_registered",
    userId,
    title: nt(lang, "tournamentRegistered.title"),
    body: nt(lang, "tournamentRegistered.body", { name: tournamentName, fee: entryFee, time: startTime }),
    data: { tournamentName, entryFee, startTime },
  });
}

/** 锦标赛报名取消通知 */
export async function notifyTournamentCancelled(userId: number, tournamentName: string, entryFee: string): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "tournament_registered",
    userId,
    title: nt(lang, "tournamentCancelled.title"),
    body: nt(lang, "tournamentCancelled.body", { name: tournamentName, fee: entryFee }),
    data: { tournamentName, entryFee },
  });
}

/** 锦标赛即将开始通知 */
export async function notifyTournamentStartingSoon(userId: number, tournamentName: string, minutesLeft: number): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "tournament_starting",
    userId,
    title: nt(lang, "tournamentStartingSoon.title"),
    body: nt(lang, "tournamentStartingSoon.body", { name: tournamentName, minutes: String(minutesLeft) }),
    data: { tournamentName, minutesLeft },
  });
}

/** 锦标赛正式开始通知 */
export async function notifyTournamentStarted(userId: number, tournamentName: string, playerCount: number, startingChips: number): Promise<boolean> {
  const lang = await getUserLang(userId);
  return sendNotification({
    type: "tournament_starting",
    userId,
    title: nt(lang, "tournamentStarted.title"),
    body: nt(lang, "tournamentStarted.body", { name: tournamentName, players: String(playerCount), chips: startingChips.toLocaleString() }),
    data: { tournamentName, playerCount, startingChips },
  });
}

/** 锦标赛结果通知 */
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
  topRankings?: TopRanking[],
  totalPlayers?: number
): Promise<boolean> {
  const lang = await getUserLang(userId);
  const isWinner = rank <= 3;
  const totalStr = totalPlayers ? `/${totalPlayers}` : "";

  // 构建排行榜摘要
  let topSummary = "";
  if (topRankings && topRankings.length > 0) {
    const medals = ["🥇", "🥈", "🥉"];
    topSummary = nt(lang, "tournamentResult.topHeader");
    for (const tr of topRankings) {
      const medal = medals[tr.rank - 1] || `#${tr.rank}`;
      topSummary += `\n${medal} ${tr.name}: $${tr.prize}`;
    }
  }

  // 个人成绩
  const rankLine = nt(lang, "tournamentResult.rankLine", { rank: String(rank), total: totalStr });
  const prizeLine = parseFloat(prize) > 0 ? nt(lang, "tournamentResult.prizeLine", { prize }) : "";

  const bodyText = isWinner
    ? nt(lang, "tournamentResult.winner.body", { name: tournamentName, rank: String(rank), total: totalStr, prize })
    : nt(lang, "tournamentResult.loser.body", { name: tournamentName });

  return sendNotification({
    type: "tournament_result",
    userId,
    title: isWinner
      ? nt(lang, "tournamentResult.winner.title", { rank: String(rank), total: totalStr })
      : nt(lang, "tournamentResult.loser.title", { rank: String(rank), total: totalStr }),
    body: bodyText + rankLine + prizeLine + topSummary,
    data: { tournamentName, rank, prize, totalPlayers, topRankings },
  });
}

export { sendTelegramMessage, getUserTgId, isNotificationEnabled };
