/**
 * 锦标赛提醒服务
 * 在比赛开始前向已报名玩家发送 Telegram 通知：
 * - 提前 3 小时
 * - 提前 1 小时
 * - 提前 10 分钟
 * 
 * 通过 Heartbeat 定时任务每 5 分钟执行一次
 */
import * as db from "./db";
import { sendBatchNotification } from "./notifications";
import { tournaments, tournamentRegistrations } from "../drizzle/schema";
import { eq, and, or, between, gte, lte } from "drizzle-orm";

// Reminder windows (in minutes before start)
const REMINDER_WINDOWS = [
  { label: "3h", minutesBefore: 180, windowMinutes: 5 },  // 3 hours before, 5-min window
  { label: "1h", minutesBefore: 60, windowMinutes: 5 },   // 1 hour before, 5-min window
  { label: "10min", minutesBefore: 10, windowMinutes: 5 }, // 10 minutes before, 5-min window
];

export async function processTournamentReminders(): Promise<{ reminders: number; errors: number }> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return { reminders: 0, errors: 0 };

  const now = Date.now();
  let totalReminders = 0;
  let totalErrors = 0;

  // Get all tournaments in "registration" status
  const activeTournaments = await dbInstance.select()
    .from(tournaments)
    .where(eq(tournaments.status, "registration"));

  for (const tournament of activeTournaments) {
    const startTime = new Date(tournament.startTime).getTime();
    const minutesUntilStart = (startTime - now) / 60000;

    for (const window of REMINDER_WINDOWS) {
      // Check if we're within the reminder window
      // e.g., for 3h reminder: between 177.5 and 182.5 minutes before start
      const lowerBound = window.minutesBefore - window.windowMinutes / 2;
      const upperBound = window.minutesBefore + window.windowMinutes / 2;

      if (minutesUntilStart >= lowerBound && minutesUntilStart < upperBound) {
        // Send reminders to all registered players
        const registrations = await dbInstance.select()
          .from(tournamentRegistrations)
          .where(and(
            eq(tournamentRegistrations.tournamentId, tournament.id),
            eq(tournamentRegistrations.status, "registered")
          ));

        if (registrations.length === 0) continue;

        const userIds = registrations.map(r => r.userId);
        const timeLabel = getTimeLabel(window.label);
        const startTimeStr = new Date(tournament.startTime).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

        const result = await sendBatchNotification(
          userIds,
          "game_starting",
          `🏆 锦标赛即将开始`,
          `${tournament.name}\n⏰ 开赛时间: ${startTimeStr}\n⏳ ${timeLabel}后开赛\n💰 奖金池: ${tournament.registeredCount}人 × ${tournament.entryFee} USDT\n\n请准时参赛！`,
          { tournamentId: tournament.id, reminderType: window.label }
        );

        totalReminders += result.sent;
        totalErrors += result.failed;

        console.log(`[TournamentReminders] ${tournament.name}: sent ${result.sent} ${window.label} reminders (${result.failed} failed)`);
      }
    }
  }

  return { reminders: totalReminders, errors: totalErrors };
}

function getTimeLabel(label: string): string {
  switch (label) {
    case "3h": return "3小时";
    case "1h": return "1小时";
    case "10min": return "10分钟";
    default: return label;
  }
}
