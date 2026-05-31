/**
 * Marketing system DB helpers
 * Covers: broadcast tasks, auto-reply rules, fission campaigns & clicks
 */
import { eq, desc, asc, and, gte, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  broadcastTasks, autoReplyRules, fissionCampaigns, fissionClicks,
  users, transactions, messageTemplates, welcomeTemplates,
  type BroadcastTask, type InsertBroadcastTask,
  type AutoReplyRule, type InsertAutoReplyRule,
  type FissionCampaign, type InsertFissionCampaign,
  type FissionClick,
  type InsertMessageTemplate, type InsertWelcomeTemplate,
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

  // Use enhanced filter if targetFilter is set, otherwise fallback to basic
  const targets = task.targetFilter ? await resolveBroadcastTargetsWithFilter(task) : await resolveBroadcastTargets(task);
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


// ==================== MESSAGE TEMPLATES ====================

export async function listMessageTemplates() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(messageTemplates).orderBy(desc(messageTemplates.updatedAt));
}

export async function createMessageTemplate(data: Omit<InsertMessageTemplate, "id" | "createdAt" | "updatedAt">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(messageTemplates).values(data);
  return result.insertId as number;
}

export async function updateMessageTemplate(id: number, data: Partial<InsertMessageTemplate>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(messageTemplates).set(data).where(eq(messageTemplates.id, id));
}

export async function deleteMessageTemplate(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.delete(messageTemplates).where(eq(messageTemplates.id, id));
}

// ==================== WELCOME TEMPLATES ====================

export async function listWelcomeTemplates() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(welcomeTemplates).orderBy(asc(welcomeTemplates.language));
}

export async function getWelcomeTemplateByLanguage(language: string): Promise<typeof welcomeTemplates.$inferSelect | null> {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  // Try exact match first, then fallback to language prefix (e.g. "zh-hans" -> "zh")
  const rows = await dbInstance.select().from(welcomeTemplates)
    .where(and(eq(welcomeTemplates.language, language), eq(welcomeTemplates.isActive, true)));
  if (rows.length > 0) return rows[0];
  // Try prefix match (e.g. "zh-hans" -> "zh")
  const prefix = language.split("-")[0];
  if (prefix !== language) {
    const prefixRows = await dbInstance.select().from(welcomeTemplates)
      .where(and(eq(welcomeTemplates.language, prefix), eq(welcomeTemplates.isActive, true)));
    if (prefixRows.length > 0) return prefixRows[0];
  }
  // Fallback to "en"
  const enRows = await dbInstance.select().from(welcomeTemplates)
    .where(and(eq(welcomeTemplates.language, "en"), eq(welcomeTemplates.isActive, true)));
  return enRows[0] ?? null;
}

export async function createWelcomeTemplate(data: Omit<InsertWelcomeTemplate, "id" | "createdAt" | "updatedAt">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(welcomeTemplates).values(data);
  return result.insertId as number;
}

export async function updateWelcomeTemplate(id: number, data: Partial<InsertWelcomeTemplate>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(welcomeTemplates).set(data).where(eq(welcomeTemplates.id, id));
}

export async function deleteWelcomeTemplate(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.delete(welcomeTemplates).where(eq(welcomeTemplates.id, id));
}

// ==================== ENHANCED TARGET FILTER ====================

/**
 * Resolve broadcast targets with advanced filter conditions.
 * Supports: language, registration date, last active, deposit amount, games played, bonus status.
 */
export async function resolveBroadcastTargetsWithFilter(task: BroadcastTask): Promise<Array<{ tgId: string; id: number }>> {
  const dbInstance = await getDb();
  if (!dbInstance) return [];

  const filter = task.targetFilter as {
    languages?: string[];
    registeredAfter?: string;
    registeredBefore?: string;
    lastActiveAfter?: string;
    lastActiveBefore?: string;
    minDeposit?: number;
    maxDeposit?: number;
    minGamesPlayed?: number;
    maxGamesPlayed?: number;
    bonusStatus?: "locked" | "unlocked" | "any";
  } | null;

  // If no filter, fall back to basic targetType logic
  if (!filter || Object.keys(filter).length === 0) {
    return resolveBroadcastTargets(task);
  }

  // Build dynamic WHERE conditions
  const conditions: string[] = [`${users.tgId.name} IS NOT NULL AND ${users.tgId.name} != ''`];

  // Also apply basic targetType as base filter
  if (task.targetType === "active") {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
    conditions.push(`lastSignedIn >= '${cutoff}'`);
  } else if (task.targetType === "deposited") {
    conditions.push(`totalDeposited > 0`);
  } else if (task.targetType === "custom" && Array.isArray(task.targetUserIds) && task.targetUserIds.length > 0) {
    conditions.push(`id IN (${task.targetUserIds.join(",")})`);
  }

  // Advanced filter conditions
  if (filter.languages && filter.languages.length > 0) {
    const langs = filter.languages.map(l => `'${l.replace(/'/g, "")}'`).join(",");
    conditions.push(`language IN (${langs})`);
  }
  if (filter.registeredAfter) {
    conditions.push(`createdAt >= '${filter.registeredAfter}'`);
  }
  if (filter.registeredBefore) {
    conditions.push(`createdAt <= '${filter.registeredBefore}'`);
  }
  if (filter.lastActiveAfter) {
    conditions.push(`lastSignedIn >= '${filter.lastActiveAfter}'`);
  }
  if (filter.lastActiveBefore) {
    conditions.push(`lastSignedIn <= '${filter.lastActiveBefore}'`);
  }
  if (filter.minDeposit !== undefined && filter.minDeposit > 0) {
    conditions.push(`totalDeposited >= ${filter.minDeposit}`);
  }
  if (filter.maxDeposit !== undefined && filter.maxDeposit > 0) {
    conditions.push(`totalDeposited <= ${filter.maxDeposit}`);
  }
  if (filter.minGamesPlayed !== undefined && filter.minGamesPlayed > 0) {
    conditions.push(`totalGamesPlayed >= ${filter.minGamesPlayed}`);
  }
  if (filter.maxGamesPlayed !== undefined && filter.maxGamesPlayed > 0) {
    conditions.push(`totalGamesPlayed <= ${filter.maxGamesPlayed}`);
  }
  if (filter.bonusStatus === "locked") {
    conditions.push(`bonusUnlocked = false AND bonusBalance > 0`);
  } else if (filter.bonusStatus === "unlocked") {
    conditions.push(`bonusUnlocked = true`);
  }

  const whereStr = conditions.join(" AND ");
  const rows = await dbInstance.execute(sql.raw(`SELECT tgId, id FROM users WHERE ${whereStr}`));
  return (rows as unknown as any[])[0].filter((r: any) => r.tgId).map((r: any) => ({ tgId: r.tgId, id: r.id }));
}

/** Estimate target count for filter preview */
export async function estimateFilterTargetCount(targetType: string, targetFilter: any, targetUserIds?: number[]): Promise<number> {
  const dbInstance = await getDb();
  if (!dbInstance) return 0;

  const mockTask = {
    targetType,
    targetFilter,
    targetUserIds: targetUserIds || null,
  } as any;

  const targets = await resolveBroadcastTargetsWithFilter(mockTask);
  return targets.length;
}
