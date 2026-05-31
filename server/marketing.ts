/**
 * Marketing system DB helpers
 * Covers: broadcast tasks, auto-reply rules, fission campaigns & clicks
 */
import { eq, desc, asc, and, gte, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  broadcastTasks, autoReplyRules, fissionCampaigns, fissionClicks,
  users, transactions,
  type BroadcastTask, type InsertBroadcastTask,
  type AutoReplyRule, type InsertAutoReplyRule,
  type FissionCampaign, type InsertFissionCampaign,
  type FissionClick,
} from "../drizzle/schema";
import * as db from "./db";
import { nanoid } from "nanoid";

// ==================== BROADCAST ====================

export async function createBroadcastTask(data: Omit<InsertBroadcastTask, "id" | "createdAt" | "sentCount" | "failCount" | "totalCount" | "status">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(broadcastTasks).values({
    ...data,
    status: "draft",
    totalCount: 0,
    sentCount: 0,
    failCount: 0,
  });
  return result.insertId as number;
}

export async function listBroadcastTasks(limit = 50, offset = 0) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(broadcastTasks)
    .orderBy(desc(broadcastTasks.createdAt))
    .limit(limit).offset(offset);
}

export async function getBroadcastTask(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const rows = await dbInstance.select().from(broadcastTasks).where(eq(broadcastTasks.id, id));
  return rows[0] ?? null;
}

export async function updateBroadcastTask(id: number, data: Partial<BroadcastTask>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(broadcastTasks).set(data).where(eq(broadcastTasks.id, id));
}

export async function cancelBroadcastTask(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(broadcastTasks)
    .set({ status: "cancelled" })
    .where(and(eq(broadcastTasks.id, id), inArray(broadcastTasks.status, ["draft", "pending"])));
}

/** Resolve target user tgIds for a broadcast task */
export async function resolveBroadcastTargets(task: BroadcastTask): Promise<Array<{ tgId: string; id: number }>> {
  const dbInstance = await getDb();
  if (!dbInstance) return [];

  let query = dbInstance.select({ tgId: users.tgId, id: users.id }).from(users);

  if (task.targetType === "all") {
    // All users with a valid tgId
    const rows = await query.where(sql`${users.tgId} IS NOT NULL AND ${users.tgId} != ''`);
    return rows.filter(r => r.tgId) as Array<{ tgId: string; id: number }>;
  } else if (task.targetType === "active") {
    // Active in last 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const rows = await query.where(
      and(sql`${users.tgId} IS NOT NULL AND ${users.tgId} != ''`, gte(users.lastSignedIn, cutoff))
    );
    return rows.filter(r => r.tgId) as Array<{ tgId: string; id: number }>;
  } else if (task.targetType === "deposited") {
    // Users who have ever deposited
    const rows = await query.where(
      and(sql`${users.tgId} IS NOT NULL AND ${users.tgId} != ''`, sql`${users.totalDeposited} > 0`)
    );
    return rows.filter(r => r.tgId) as Array<{ tgId: string; id: number }>;
  } else if (task.targetType === "custom" && Array.isArray(task.targetUserIds) && task.targetUserIds.length > 0) {
    const ids = task.targetUserIds as number[];
    const rows = await query.where(
      and(sql`${users.tgId} IS NOT NULL AND ${users.tgId} != ''`, inArray(users.id, ids))
    );
    return rows.filter(r => r.tgId) as Array<{ tgId: string; id: number }>;
  }
  return [];
}

// ==================== BROADCAST ENGINE ====================

/**
 * Execute a broadcast task: send messages in batches of 30/s to avoid TG rate limits.
 * This runs async in the background after the procedure returns.
 */
export async function executeBroadcast(taskId: number): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  const task = await getBroadcastTask(taskId);
  if (!task || !["pending", "draft"].includes(task.status)) return;

  const botToken = await db.getConfigValue("tg_bot_token");
  if (!botToken) {
    await updateBroadcastTask(taskId, { status: "failed" });
    return;
  }

  const targets = await resolveBroadcastTargets(task);
  await updateBroadcastTask(taskId, {
    status: "sending",
    totalCount: targets.length,
    startedAt: new Date(),
  });

  let sentCount = 0;
  let failCount = 0;
  const BATCH_SIZE = 25; // stay under 30/s TG limit
  const BATCH_DELAY_MS = 1100; // ~1.1s between batches

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (target) => {
      try {
        const body: Record<string, unknown> = {
          chat_id: target.tgId,
          text: task.content,
          parse_mode: "HTML",
        };
        // Add inline buttons if configured
        if (task.buttons && task.buttons.length > 0) {
          // Group buttons by row (default row 0)
          const rowMap = new Map<number, Array<{ text: string; url: string }>>();
          for (const btn of task.buttons) {
            const row = btn.row ?? 0;
            if (!rowMap.has(row)) rowMap.set(row, []);
            rowMap.get(row)!.push({ text: btn.text, url: btn.url });
          }
          const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);
          body.reply_markup = {
            inline_keyboard: sortedRows.map(([, btns]) => btns)
          };
        } else if (task.buttonText && task.buttonUrl) {
          // Legacy single button fallback
          body.reply_markup = {
            inline_keyboard: [[{ text: task.buttonText, url: task.buttonUrl }]]
          };
        }
        // Send photo+caption or plain text
        let apiMethod = "sendMessage";
        if (task.imageUrl) {
          apiMethod = "sendPhoto";
          body.photo = task.imageUrl;
          body.caption = task.content;
          delete body.text;
        }
        const res = await fetch(`https://api.telegram.org/bot${botToken}/${apiMethod}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          sentCount++;
        } else {
          failCount++;
          const errText = await res.text();
          console.warn(`[Broadcast] Failed to send to ${target.tgId}:`, errText);
        }
      } catch (e) {
        failCount++;
        console.warn(`[Broadcast] Error sending to ${target.tgId}:`, e);
      }
    }));

    // Update progress after each batch
    await updateBroadcastTask(taskId, { sentCount, failCount });

    // Rate limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < targets.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  await updateBroadcastTask(taskId, {
    status: "completed",
    sentCount,
    failCount,
    completedAt: new Date(),
  });
}

// ==================== AUTO REPLY RULES ====================

export async function listAutoReplyRules() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(autoReplyRules).orderBy(desc(autoReplyRules.priority), asc(autoReplyRules.id));
}

export async function createAutoReplyRule(data: Omit<InsertAutoReplyRule, "id" | "createdAt" | "updatedAt" | "triggerCount">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(autoReplyRules).values({ ...data, triggerCount: 0 });
  return result.insertId as number;
}

export async function updateAutoReplyRule(id: number, data: Partial<AutoReplyRule>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(autoReplyRules).set(data).where(eq(autoReplyRules.id, id));
}

export async function deleteAutoReplyRule(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.delete(autoReplyRules).where(eq(autoReplyRules.id, id));
}

export async function toggleAutoReplyRule(id: number, isActive: boolean) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(autoReplyRules).set({ isActive }).where(eq(autoReplyRules.id, id));
}

/**
 * Match incoming message text against active auto-reply rules.
 * Returns the first matching rule (highest priority first).
 */
export async function matchAutoReply(text: string): Promise<AutoReplyRule | null> {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const rules = await dbInstance.select().from(autoReplyRules)
    .where(eq(autoReplyRules.isActive, true))
    .orderBy(desc(autoReplyRules.priority));

  const lowerText = text.toLowerCase();
  for (const rule of rules) {
    let matched = false;
    if (rule.matchType === "exact") {
      matched = lowerText === rule.keyword.toLowerCase();
    } else if (rule.matchType === "contains") {
      matched = lowerText.includes(rule.keyword.toLowerCase());
    } else if (rule.matchType === "regex") {
      try {
        matched = new RegExp(rule.keyword, "i").test(text);
      } catch {
        // Invalid regex, skip
      }
    }
    if (matched) {
      // Increment trigger count (fire and forget)
      dbInstance.update(autoReplyRules)
        .set({ triggerCount: sql`${autoReplyRules.triggerCount} + 1` })
        .where(eq(autoReplyRules.id, rule.id))
        .catch(() => {});
      return rule;
    }
  }
  return null;
}

// ==================== FISSION CAMPAIGNS ====================

export async function listFissionCampaigns() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(fissionCampaigns).orderBy(desc(fissionCampaigns.createdAt));
}

export async function getFissionCampaign(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const rows = await dbInstance.select().from(fissionCampaigns).where(eq(fissionCampaigns.id, id));
  return rows[0] ?? null;
}

export async function getFissionCampaignByCode(linkCode: string) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const rows = await dbInstance.select().from(fissionCampaigns).where(eq(fissionCampaigns.linkCode, linkCode));
  return rows[0] ?? null;
}

export async function createFissionCampaign(data: Omit<InsertFissionCampaign, "id" | "createdAt" | "updatedAt" | "clickCount" | "registerCount" | "rewardPaidCount" | "totalRewardPaid" | "linkCode">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const linkCode = nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, "x");
  const [result] = await dbInstance.insert(fissionCampaigns).values({
    ...data,
    linkCode,
    clickCount: 0,
    registerCount: 0,
    rewardPaidCount: 0,
    totalRewardPaid: "0.00",
  });
  return { id: result.insertId as number, linkCode };
}

export async function updateFissionCampaign(id: number, data: Partial<FissionCampaign>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(fissionCampaigns).set(data).where(eq(fissionCampaigns.id, id));
}

export async function deleteFissionCampaign(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.delete(fissionCampaigns).where(eq(fissionCampaigns.id, id));
}

/** Record a fission link click */
export async function recordFissionClick(data: {
  campaignId: number;
  linkCode: string;
  inviterId?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<number> {
  const dbInstance = await getDb();
  if (!dbInstance) return 0;
  // Increment click count on campaign
  await dbInstance.update(fissionCampaigns)
    .set({ clickCount: sql`${fissionCampaigns.clickCount} + 1` })
    .where(eq(fissionCampaigns.id, data.campaignId));
  const [result] = await dbInstance.insert(fissionClicks).values({
    ...data,
    registered: false,
    deposited: false,
    rewardPaid: false,
  });
  return result.insertId as number;
}

/** Mark a fission click as converted (user registered) */
export async function markFissionConverted(clickId: number, userId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(fissionClicks)
    .set({ registered: true, userId, convertedAt: new Date() })
    .where(eq(fissionClicks.id, clickId));
  // Increment register count on campaign
  const click = await dbInstance.select().from(fissionClicks).where(eq(fissionClicks.id, clickId));
  if (click[0]) {
    await dbInstance.update(fissionCampaigns)
      .set({ registerCount: sql`${fissionCampaigns.registerCount} + 1` })
      .where(eq(fissionCampaigns.id, click[0].campaignId));
  }
}

/** Get fission stats for a campaign */
export async function getFissionStats(campaignId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const campaign = await getFissionCampaign(campaignId);
  if (!campaign) return null;
  const conversionRate = campaign.clickCount > 0
    ? Math.round((campaign.registerCount / campaign.clickCount) * 100)
    : 0;
  return {
    ...campaign,
    conversionRate,
  };
}

/** Get recent fission clicks for a campaign */
export async function getFissionClicks(campaignId: number, limit = 50) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select({
    click: fissionClicks,
    user: {
      id: users.id,
      nickname: users.nickname,
      tgUsername: users.tgUsername,
    }
  })
    .from(fissionClicks)
    .leftJoin(users, eq(fissionClicks.userId, users.id))
    .where(eq(fissionClicks.campaignId, campaignId))
    .orderBy(desc(fissionClicks.createdAt))
    .limit(limit);
}
