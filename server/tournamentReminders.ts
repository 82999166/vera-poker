/**
 * 锦标赛提醒服务（多语言版）
 * 在比赛开始前向已报名玩家发送 Telegram 通知：
 * - 提前 3 小时
 * - 提前 1 小时
 * - 提前 10 分钟
 * 
 * 所有通知文本根据用户 languageCode 自动翻译
 * 通过 Heartbeat 定时任务每 5 分钟执行一次
 */
import * as db from "./db";
import { notifyTournamentStartingSoon } from "./notifications";
import { tournaments, tournamentRegistrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// 提醒时间窗口（开赛前多少分钟）
const REMINDER_WINDOWS = [
  { label: "3h", minutesBefore: 180, windowMinutes: 5 },  // 开赛前 3 小时，5 分钟窗口
  { label: "1h", minutesBefore: 60, windowMinutes: 5 },   // 开赛前 1 小时，5 分钟窗口
  { label: "10min", minutesBefore: 10, windowMinutes: 5 }, // 开赛前 10 分钟，5 分钟窗口
];

export async function processTournamentReminders(): Promise<{ reminders: number; errors: number }> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return { reminders: 0, errors: 0 };

  const now = Date.now();
  let totalReminders = 0;
  let totalErrors = 0;

  // 获取所有报名中的锦标赛
  const activeTournaments = await dbInstance.select()
    .from(tournaments)
    .where(eq(tournaments.status, "registration"));

  for (const tournament of activeTournaments) {
    const startTime = new Date(tournament.startTime).getTime();
    const minutesUntilStart = (startTime - now) / 60000;

    for (const window of REMINDER_WINDOWS) {
      // 检查是否在提醒窗口内
      const lowerBound = window.minutesBefore - window.windowMinutes / 2;
      const upperBound = window.minutesBefore + window.windowMinutes / 2;

      if (minutesUntilStart >= lowerBound && minutesUntilStart < upperBound) {
        // 获取所有已报名玩家
        const registrations = await dbInstance.select()
          .from(tournamentRegistrations)
          .where(and(
            eq(tournamentRegistrations.tournamentId, tournament.id),
            eq(tournamentRegistrations.status, "registered")
          ));

        if (registrations.length === 0) continue;

        // 逐个发送多语言通知（使用 notifyTournamentStartingSoon 自动根据用户语言翻译）
        let sent = 0;
        let failed = 0;
        for (const reg of registrations) {
          const success = await notifyTournamentStartingSoon(
            reg.userId,
            tournament.name,
            window.minutesBefore
          );
          if (success) sent++;
          else failed++;
          // Telegram 限速：每秒 30 条
          await new Promise(resolve => setTimeout(resolve, 35));
        }

        totalReminders += sent;
        totalErrors += failed;

        console.log(`[TournamentReminders] ${tournament.name}: sent ${sent} ${window.label} reminders (${failed} failed)`);
      }
    }
  }

  return { reminders: totalReminders, errors: totalErrors };
}
