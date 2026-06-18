/**
 * 营销系统数据库帮助函数
 * 包含：广播任务、自动回复规则、裂变活动与点击跟踪、消息模板、欢迎语
 */
import { eq, desc, asc, and, gte, lte, sql, inArray, isNotNull, ne, gt, lt } from "drizzle-orm";
import { getDb } from "./db";
import {
  broadcastTasks, autoReplyRules, fissionCampaigns, fissionClicks,
  users, transactions, messageTemplates, welcomeTemplates,
  redPackets, redPacketClaims, tgGroups,
  type BroadcastTask, type InsertBroadcastTask,
  type AutoReplyRule, type InsertAutoReplyRule,
  type FissionCampaign, type InsertFissionCampaign,
  type FissionClick,
  type InsertMessageTemplate, type InsertWelcomeTemplate,
  type RedPacket, type InsertRedPacket,
  type InsertTgGroup,
} from "../drizzle/schema";
import * as db from "./db";
import { nanoid } from "nanoid";
import { storageGetSignedUrl } from "./storage";

// ==================== 广播任务 ====================

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

// ==================== 广播执行引擎 ====================

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

  // Pre-resolve image URL: /manus-storage/ paths need signed URLs for TG API access
  let resolvedImageUrl: string | null = null;
  if (task.imageUrl) {
    if (task.imageUrl.startsWith("/manus-storage/")) {
      try {
        const key = task.imageUrl.replace("/manus-storage/", "");
        resolvedImageUrl = await storageGetSignedUrl(key);
      } catch (e) {
        console.warn("[Broadcast] Failed to resolve image URL:", e);
        resolvedImageUrl = null;
      }
    } else {
      resolvedImageUrl = task.imageUrl;
    }
  }

  // Pre-resolve web_app button URLs: relative paths need the mini app base URL
  const miniAppUrl = await db.getConfigValue("tg_mini_app_url") || "";

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
          const rowMap = new Map<number, Array<Record<string, unknown>>>();
          for (const btn of task.buttons as Array<{ text: string; url: string; type?: string; row?: number }>) {
            const row = btn.row ?? 0;
            if (!rowMap.has(row)) rowMap.set(row, []);
            // NOTE: web_app buttons CANNOT be sent via Bot private chat (DM).
            // TG API restriction: web_app inline buttons only work in group/channel messages.
            // For broadcast (private chat), always convert web_app buttons to regular url buttons.
            let btnUrl = btn.url;
            if (btnUrl.startsWith("/") && miniAppUrl) {
              btnUrl = miniAppUrl + btnUrl;
            } else if (!btnUrl.startsWith("http") && miniAppUrl) {
              btnUrl = miniAppUrl + (btnUrl.startsWith("/") ? "" : "/") + btnUrl;
            }
            rowMap.get(row)!.push({ text: btn.text, url: btnUrl });
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
        if (resolvedImageUrl) {
          apiMethod = "sendPhoto";
          body.photo = resolvedImageUrl;
          body.caption = task.content;
          // TG sendPhoto uses parse_mode for caption formatting (same param name as sendMessage)
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

// ==================== 自动回复规则 ====================

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

// ==================== 裂变活动 ====================

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


// ==================== 消息模板 ====================

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

  // SECURITY FIX #2: Use parameterized Drizzle ORM queries instead of raw SQL string concatenation
  // Build type-safe WHERE conditions to prevent SQL injection
  const conditions: any[] = [isNotNull(users.tgId), ne(users.tgId, "")];

  // Also apply basic targetType as base filter
  if (task.targetType === "active") {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    conditions.push(gte(users.lastSignedIn, cutoff));
  } else if (task.targetType === "deposited") {
    conditions.push(gt(users.totalDeposited, "0"));
  } else if (task.targetType === "custom" && Array.isArray(task.targetUserIds) && task.targetUserIds.length > 0) {
    conditions.push(inArray(users.id, task.targetUserIds.map(Number)));
  }

  // Advanced filter conditions - all parameterized
  if (filter.languages && filter.languages.length > 0) {
    conditions.push(inArray(users.language, filter.languages));
  }
  if (filter.registeredAfter) {
    conditions.push(gte(users.createdAt, new Date(filter.registeredAfter)));
  }
  if (filter.registeredBefore) {
    conditions.push(lte(users.createdAt, new Date(filter.registeredBefore)));
  }
  if (filter.lastActiveAfter) {
    conditions.push(gte(users.lastSignedIn, new Date(filter.lastActiveAfter)));
  }
  if (filter.lastActiveBefore) {
    conditions.push(lte(users.lastSignedIn, new Date(filter.lastActiveBefore)));
  }
  if (filter.minDeposit !== undefined && filter.minDeposit > 0) {
    conditions.push(gte(users.totalDeposited, String(filter.minDeposit)));
  }
  if (filter.maxDeposit !== undefined && filter.maxDeposit > 0) {
    conditions.push(lte(users.totalDeposited, String(filter.maxDeposit)));
  }
  if (filter.minGamesPlayed !== undefined && filter.minGamesPlayed > 0) {
    conditions.push(gte(users.totalGamesPlayed, filter.minGamesPlayed));
  }
  if (filter.maxGamesPlayed !== undefined && filter.maxGamesPlayed > 0) {
    conditions.push(lte(users.totalGamesPlayed, filter.maxGamesPlayed));
  }
  if (filter.bonusStatus === "locked") {
    conditions.push(eq(users.bonusUnlocked, false));
    conditions.push(gt(users.bonusBalance, "0"));
  } else if (filter.bonusStatus === "unlocked") {
    conditions.push(eq(users.bonusUnlocked, true));
  }

  const rows = await dbInstance.select({ tgId: users.tgId, id: users.id })
    .from(users)
    .where(and(...conditions));
  return rows.filter((r) => r.tgId).map((r) => ({ tgId: r.tgId!, id: r.id }));
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


// ==================== 优惠券/红包系统 ====================
import {
  coupons, couponClaims, userCheckins, checkinConfigs,
  inviteRewardConfigs, inviteRewards, firstDepositConfigs, firstDepositClaims,
  timeLimitedEvents, scheduledNotifications,
  type Coupon, type InsertCoupon,
  type InsertTimeLimitedEvent,
  type InsertScheduledNotification,
} from "../drizzle/schema";

export async function createCoupon(data: {
  code: string;
  name: string;
  type: "fixed" | "percent" | "chips";
  amount: string;
  maxBonus?: string;
  minDeposit?: string;
  maxUses: number;
  maxPerUser: number;
  expiresAt?: Date;
  createdBy: number;
}) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(coupons).values(data);
  return result.insertId;
}

export async function listCoupons(limit = 50, offset = 0) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(coupons).orderBy(desc(coupons.createdAt)).limit(limit).offset(offset);
}

export async function updateCoupon(id: number, data: Partial<Coupon>) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.update(coupons).set(data).where(eq(coupons.id, id));
}

export async function deleteCoupon(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.delete(coupons).where(eq(coupons.id, id));
}

export async function redeemCoupon(userId: number, code: string): Promise<{ success: boolean; message: string; amount?: number }> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");

  // Find coupon
  const [coupon] = await dbInstance.select().from(coupons).where(eq(coupons.code, code));
  if (!coupon) return { success: false, message: "优惠码不存在" };
  if (coupon.status !== "active") return { success: false, message: "优惠码已停用" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { success: false, message: "优惠码已过期" };
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return { success: false, message: "优惠码已被领完" };

  // Check per-user limit
  const userClaims = await dbInstance.select().from(couponClaims)
    .where(and(eq(couponClaims.couponId, coupon.id), eq(couponClaims.userId, userId)));
  if (userClaims.length >= coupon.maxPerUser) return { success: false, message: "您已领取过该优惠码" };

  // Calculate reward amount
  let rewardAmount = Number(coupon.amount);
  if (coupon.type === "percent") {
    // percent type needs deposit context, just give fixed for now
    rewardAmount = Number(coupon.amount);
  }

  // Credit user balance
  await db.addUserBalanceAtomic(userId, rewardAmount);

  // Record claim
  await dbInstance.insert(couponClaims).values({
    couponId: coupon.id,
    userId,
    amount: String(rewardAmount),
  });

  // Update used count
  await dbInstance.update(coupons).set({ usedCount: coupon.usedCount + 1 }).where(eq(coupons.id, coupon.id));

  // Write transaction record
  const user = await db.getUserById(userId);
  const balAfter = user ? String(Number(user.balance)) : "0.00";
  const balBefore = String(Number(balAfter) - rewardAmount);
  await db.createTransaction({
    userId,
    type: "bonus",
    amount: String(rewardAmount),
    balanceBefore: balBefore,
    balanceAfter: balAfter,
    status: "completed",
    note: `兑换优惠码: ${code}`,
  });

  return { success: true, message: "兑换成功", amount: rewardAmount };
}

export async function getCouponClaims(couponId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select({
    id: couponClaims.id,
    userId: couponClaims.userId,
    amount: couponClaims.amount,
    claimedAt: couponClaims.claimedAt,
    userName: users.nickname,
    tgUsername: users.tgUsername,
  }).from(couponClaims)
    .leftJoin(users, eq(couponClaims.userId, users.id))
    .where(eq(couponClaims.couponId, couponId))
    .orderBy(desc(couponClaims.claimedAt));
}

// ==================== 签到系统 ====================
export async function getCheckinConfig() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  const configs = await dbInstance.select().from(checkinConfigs).orderBy(asc(checkinConfigs.dayNumber));
  // If no config, return defaults
  if (configs.length === 0) {
    return [
      { dayNumber: 1, reward: "1.00" },
      { dayNumber: 2, reward: "1.50" },
      { dayNumber: 3, reward: "2.00" },
      { dayNumber: 4, reward: "2.50" },
      { dayNumber: 5, reward: "3.00" },
      { dayNumber: 6, reward: "4.00" },
      { dayNumber: 7, reward: "5.00" },
    ];
  }
  return configs;
}

export async function updateCheckinConfig(configs: Array<{ dayNumber: number; reward: string }>) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  // Delete existing and re-insert
  await dbInstance.delete(checkinConfigs);
  for (const c of configs) {
    await dbInstance.insert(checkinConfigs).values({ dayNumber: c.dayNumber, reward: c.reward });
  }
}

export async function performCheckin(userId: number): Promise<{ success: boolean; message: string; reward?: number; dayNumber?: number }> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Check if already checked in today
  const [existing] = await dbInstance.select().from(userCheckins)
    .where(and(eq(userCheckins.userId, userId), eq(userCheckins.checkinDate, today)));
  if (existing) return { success: false, message: "今日已签到" };

  // Get yesterday's checkin to determine streak
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const [yesterdayCheckin] = await dbInstance.select().from(userCheckins)
    .where(and(eq(userCheckins.userId, userId), eq(userCheckins.checkinDate, yesterday)));

  let dayNumber = 1;
  if (yesterdayCheckin) {
    dayNumber = (yesterdayCheckin.dayNumber % 7) + 1; // Cycle 1-7
  }

  // Get reward for this day
  const configs = await getCheckinConfig();
  const dayConfig = configs.find(c => Number(c.dayNumber) === dayNumber);
  const reward = dayConfig ? Number(dayConfig.reward) : 1.0;

  // Record checkin
  await dbInstance.insert(userCheckins).values({
    userId,
    checkinDate: today,
    dayNumber,
    reward: String(reward),
  });

  // Credit balance
  await db.addUserBalanceAtomic(userId, reward);

  // Write transaction
  const userAfter = await db.getUserById(userId);
  const checkinBalAfter = userAfter ? String(Number(userAfter.balance)) : "0.00";
  const checkinBalBefore = String(Number(checkinBalAfter) - reward);
  await db.createTransaction({
    userId,
    type: "checkin",
    amount: String(reward),
    balanceBefore: checkinBalBefore,
    balanceAfter: checkinBalAfter,
    status: "completed",
    note: `签到奖励 (第${dayNumber}天)`,
  });

  return { success: true, message: "签到成功", reward, dayNumber };
}

export async function getUserCheckinStatus(userId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return { checkedInToday: false, streak: 0, history: [] };

  const today = new Date().toISOString().split("T")[0];
  const [todayCheckin] = await dbInstance.select().from(userCheckins)
    .where(and(eq(userCheckins.userId, userId), eq(userCheckins.checkinDate, today)));

  // Get last 7 days of checkins
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const history = await dbInstance.select().from(userCheckins)
    .where(and(eq(userCheckins.userId, userId), gte(userCheckins.checkinDate, sevenDaysAgo)))
    .orderBy(desc(userCheckins.checkinDate));

  // Calculate current streak
  let streak = 0;
  let checkDate = new Date();
  if (!todayCheckin) {
    // If not checked in today, streak starts from yesterday
    checkDate = new Date(Date.now() - 86400000);
  }
  for (let i = 0; i < 7; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const found = history.find(h => h.checkinDate === dateStr);
    if (found) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return {
    checkedInToday: !!todayCheckin,
    streak: todayCheckin ? (todayCheckin.dayNumber) : streak,
    history: history.map(h => ({ date: h.checkinDate, dayNumber: h.dayNumber, reward: h.reward })),
  };
}

// ==================== 邀请奖励 ====================
export async function getInviteRewardConfig() {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const [config] = await dbInstance.select().from(inviteRewardConfigs).limit(1);
  return config || {
    inviterReward: "5.00",
    inviteeReward: "3.00",
    maxRewardsPerUser: 0,
    requireDeposit: false,
    minDepositAmount: "0.00",
    enabled: true,
  };
}

export async function updateInviteRewardConfig(data: {
  inviterReward: string;
  inviteeReward: string;
  maxRewardsPerUser: number;
  requireDeposit: boolean;
  minDepositAmount: string;
  enabled: boolean;
}) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [existing] = await dbInstance.select().from(inviteRewardConfigs).limit(1);
  if (existing) {
    await dbInstance.update(inviteRewardConfigs).set(data).where(eq(inviteRewardConfigs.id, existing.id));
  } else {
    await dbInstance.insert(inviteRewardConfigs).values(data);
  }
}

export async function processInviteReward(inviterId: number, inviteeId: number): Promise<boolean> {
  const dbInstance = await getDb();
  if (!dbInstance) return false;

  const config = await getInviteRewardConfig();
  if (!config || !config.enabled) return false;

  // Check if already rewarded for this pair
  const [existing] = await dbInstance.select().from(inviteRewards)
    .where(and(eq(inviteRewards.inviterId, inviterId), eq(inviteRewards.inviteeId, inviteeId)));
  if (existing) return false;

  // Check max rewards per user
  if (config.maxRewardsPerUser > 0) {
    const inviterRewardCount = await dbInstance.select({ count: sql<number>`count(*)` })
      .from(inviteRewards).where(eq(inviteRewards.inviterId, inviterId));
    if (inviterRewardCount[0]?.count >= config.maxRewardsPerUser) return false;
  }

  const inviterAmount = Number(config.inviterReward);
  const inviteeAmount = Number(config.inviteeReward);

  // Record reward
  await dbInstance.insert(inviteRewards).values({
    inviterId,
    inviteeId,
    inviterAmount: String(inviterAmount),
    inviteeAmount: String(inviteeAmount),
    status: "completed",
    completedAt: new Date(),
  });

  // Credit both users
  if (inviterAmount > 0) {
    await db.addUserBalanceAtomic(inviterId, inviterAmount);
    const inviterUser = await db.getUserById(inviterId);
    const inviterBal = inviterUser ? String(Number(inviterUser.balance)) : "0.00";
    await db.createTransaction({
      userId: inviterId,
      type: "invite_reward",
      amount: String(inviterAmount),
      balanceBefore: String(Number(inviterBal) - inviterAmount),
      balanceAfter: inviterBal,
      status: "completed",
      note: `邀请奖励 (邀请用户#${inviteeId})`,
    });
  }
  if (inviteeAmount > 0) {
    await db.addUserBalanceAtomic(inviteeId, inviteeAmount);
    const inviteeUser = await db.getUserById(inviteeId);
    const inviteeBal = inviteeUser ? String(Number(inviteeUser.balance)) : "0.00";
    await db.createTransaction({
      userId: inviteeId,
      type: "invite_reward",
      amount: String(inviteeAmount),
      balanceBefore: String(Number(inviteeBal) - inviteeAmount),
      balanceAfter: inviteeBal,
      status: "completed",
      note: `新用户注册奖励`,
    });
  }

  return true;
}

export async function getInviteRewardStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalRewards: 0, totalAmount: "0.00", recentRewards: [] };
  const [stats] = await dbInstance.select({
    totalRewards: sql<number>`count(*)`,
    totalAmount: sql<string>`COALESCE(SUM(inviterAmount + inviteeAmount), 0)`,
  }).from(inviteRewards).where(eq(inviteRewards.status, "completed"));

  const recentRewards = await dbInstance.select({
    id: inviteRewards.id,
    inviterId: inviteRewards.inviterId,
    inviteeId: inviteRewards.inviteeId,
    inviterAmount: inviteRewards.inviterAmount,
    inviteeAmount: inviteRewards.inviteeAmount,
    createdAt: inviteRewards.createdAt,
  }).from(inviteRewards).orderBy(desc(inviteRewards.createdAt)).limit(20);

  return { totalRewards: stats?.totalRewards || 0, totalAmount: stats?.totalAmount || "0.00", recentRewards };
}

// ==================== 首充优惠 ====================
export async function getFirstDepositConfig() {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const [config] = await dbInstance.select().from(firstDepositConfigs).limit(1);
  return config || { bonusPercent: 100, maxBonus: "50.00", enabled: true };
}

export async function updateFirstDepositConfig(data: { bonusPercent: number; maxBonus: string; enabled: boolean }) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [existing] = await dbInstance.select().from(firstDepositConfigs).limit(1);
  if (existing) {
    await dbInstance.update(firstDepositConfigs).set(data).where(eq(firstDepositConfigs.id, existing.id));
  } else {
    await dbInstance.insert(firstDepositConfigs).values(data);
  }
}

export async function processFirstDepositBonus(userId: number, depositAmount: number): Promise<number> {
  const dbInstance = await getDb();
  if (!dbInstance) return 0;

  const config = await getFirstDepositConfig();
  if (!config || !config.enabled) return 0;

  // Check if user already claimed
  const [existing] = await dbInstance.select().from(firstDepositClaims).where(eq(firstDepositClaims.userId, userId));
  if (existing) return 0;

  // Calculate bonus
  let bonus = depositAmount * (config.bonusPercent / 100);
  const maxBonus = Number(config.maxBonus);
  if (bonus > maxBonus) bonus = maxBonus;

  // Record claim
  await dbInstance.insert(firstDepositClaims).values({
    userId,
    depositAmount: String(depositAmount),
    bonusAmount: String(bonus),
  });

  // Credit bonus
  await db.addUserBalanceAtomic(userId, bonus);
  const fdUser = await db.getUserById(userId);
  const fdBal = fdUser ? String(Number(fdUser.balance)) : "0.00";
  await db.createTransaction({
    userId,
    type: "first_deposit_bonus",
    amount: String(bonus),
    balanceBefore: String(Number(fdBal) - bonus),
    balanceAfter: fdBal,
    status: "completed",
    note: `首充加赠 (${config.bonusPercent}%)`,
  });

  return bonus;
}

// ==================== 限时活动 ====================
export async function createTimeLimitedEvent(data: Omit<InsertTimeLimitedEvent, "id" | "createdAt" | "updatedAt" | "status">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(timeLimitedEvents).values({ ...data, status: "upcoming" });
  return result.insertId;
}

export async function listTimeLimitedEvents() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(timeLimitedEvents).orderBy(desc(timeLimitedEvents.createdAt));
}

export async function updateTimeLimitedEvent(id: number, data: Partial<InsertTimeLimitedEvent>) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.update(timeLimitedEvents).set(data).where(eq(timeLimitedEvents.id, id));
}

export async function deleteTimeLimitedEvent(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.delete(timeLimitedEvents).where(eq(timeLimitedEvents.id, id));
}

export async function getActiveEvents() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  const now = new Date();
  return dbInstance.select().from(timeLimitedEvents)
    .where(and(eq(timeLimitedEvents.status, "active"), lte(timeLimitedEvents.startTime, now), gte(timeLimitedEvents.endTime, now)));
}

// ==================== 定时推送通知 ====================
export async function createScheduledNotification(data: Omit<InsertScheduledNotification, "id" | "createdAt" | "sentAt" | "sentCount" | "status">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(scheduledNotifications).values({ ...data, status: "pending" });
  return result.insertId;
}

export async function listScheduledNotifications(limit = 50, offset = 0) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(scheduledNotifications).orderBy(desc(scheduledNotifications.createdAt)).limit(limit).offset(offset);
}

export async function updateScheduledNotification(id: number, data: Partial<InsertScheduledNotification>) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.update(scheduledNotifications).set(data).where(eq(scheduledNotifications.id, id));
}

export async function cancelScheduledNotification(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  await dbInstance.update(scheduledNotifications).set({ status: "cancelled" }).where(eq(scheduledNotifications.id, id));
}

export async function executeScheduledNotification(id: number): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");

  const [notification] = await dbInstance.select().from(scheduledNotifications).where(eq(scheduledNotifications.id, id));
  if (!notification || notification.status !== "pending") return;

  // Create a broadcast task from this notification
  const broadcastId = await createBroadcastTask({
    title: notification.title,
    content: notification.content,
    imageUrl: notification.imageUrl,
    buttons: notification.buttons,
    targetType: notification.targetType,
    targetUserIds: notification.targetUserIds,
    targetFilter: null,
    scheduledAt: null,
    createdBy: notification.createdBy,
  });

  // Execute the broadcast
  await executeBroadcast(broadcastId);

  // Update notification status
  await dbInstance.update(scheduledNotifications).set({
    status: "sent",
    sentAt: new Date(),
  }).where(eq(scheduledNotifications.id, id));
}


// ==================== 抢红包系统 ====================

export async function createRedPacket(data: {
  title: string;
  description?: string;
  totalAmount: string;
  totalCount: number;
  type: "random" | "fixed";
  condition?: any;
  imageUrl?: string;
  expiresAt?: Date | null;
  createdBy: number;
  buttons?: Array<{ text: string; url: string; type?: string; row?: number }>;
}): Promise<number> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB unavailable");
  const [result] = await dbInstance.insert(redPackets).values({
    title: data.title,
    description: data.description || null,
    totalAmount: data.totalAmount,
    totalCount: data.totalCount,
    type: data.type,
    condition: data.condition || null,
    imageUrl: data.imageUrl || null,
    buttons: data.buttons || null,
    expiresAt: data.expiresAt || null,
    createdBy: data.createdBy,
    status: "active",
    claimedCount: 0,
    claimedAmount: "0.00",
  });
  return result.insertId as number;
}

export async function listRedPackets(limit = 50, offset = 0) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(redPackets)
    .orderBy(desc(redPackets.createdAt))
    .limit(limit).offset(offset);
}

export async function getRedPacket(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;
  const rows = await dbInstance.select().from(redPackets).where(eq(redPackets.id, id));
  return rows[0] ?? null;
}

export async function updateRedPacketStatus(id: number, status: "active" | "paused" | "completed" | "expired") {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.update(redPackets).set({ status }).where(eq(redPackets.id, id));
}

export async function deleteRedPacket(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  await dbInstance.delete(redPackets).where(eq(redPackets.id, id));
  await dbInstance.delete(redPacketClaims).where(eq(redPacketClaims.redPacketId, id));
}

export async function getRedPacketClaims(redPacketId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  const claims = await dbInstance.select({
    id: redPacketClaims.id,
    userId: redPacketClaims.userId,
    amount: redPacketClaims.amount,
    claimedAt: redPacketClaims.claimedAt,
    nickname: users.nickname,
    tgUsername: users.tgUsername,
    avatar: users.avatar,
  })
    .from(redPacketClaims)
    .leftJoin(users, eq(redPacketClaims.userId, users.id))
    .where(eq(redPacketClaims.redPacketId, redPacketId))
    .orderBy(desc(redPacketClaims.amount));
  return claims;
}

/**
 * Claim a red packet - handles random amount allocation and condition checking
 */
export async function claimRedPacket(userId: number, redPacketId: number): Promise<{ success: boolean; amount?: string; error?: string }> {
  const dbInstance = await getDb();
  if (!dbInstance) return { success: false, error: "DB unavailable" };

  // Get the red packet
  const [packet] = await dbInstance.select().from(redPackets).where(eq(redPackets.id, redPacketId));
  if (!packet) return { success: false, error: "红包不存在" };
  if (packet.status !== "active") return { success: false, error: "红包已结束" };
  if (packet.expiresAt && new Date(packet.expiresAt) < new Date()) {
    await dbInstance.update(redPackets).set({ status: "expired" }).where(eq(redPackets.id, redPacketId));
    return { success: false, error: "红包已过期" };
  }
  if (packet.claimedCount >= packet.totalCount) {
    await dbInstance.update(redPackets).set({ status: "completed" }).where(eq(redPackets.id, redPacketId));
    return { success: false, error: "红包已被领完" };
  }

  // Check if user already claimed
  const existingClaim = await dbInstance.select().from(redPacketClaims)
    .where(and(eq(redPacketClaims.redPacketId, redPacketId), eq(redPacketClaims.userId, userId)));
  if (existingClaim.length > 0) return { success: false, error: "你已经领过了" };

  // Check conditions
  if (packet.condition) {
    const cond = packet.condition as any;
    const [user] = await dbInstance.select().from(users).where(eq(users.id, userId));
    if (!user) return { success: false, error: "用户不存在" };

    if (cond.minDeposit && parseFloat(String(user.totalDeposited)) < cond.minDeposit) {
      return { success: false, error: `需要充值 ≥ ${cond.minDeposit} USDT` };
    }
    if (cond.minGamesPlayed && (user.totalGamesPlayed || 0) < cond.minGamesPlayed) {
      return { success: false, error: `需要游戏手数 ≥ ${cond.minGamesPlayed}` };
    }
    if (cond.recentDays && cond.recentHands) {
      // Check recent hands in last N days - use totalGamesPlayed as approximation
      if ((user.totalGamesPlayed || 0) < cond.recentHands) {
        return { success: false, error: `需要最近${cond.recentDays}天手数 ≥ ${cond.recentHands}` };
      }
    }
    if (cond.newUserOnly) {
      const daysSinceRegister = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceRegister > 7) {
        return { success: false, error: "仅限新用户领取（注册7天内）" };
      }
    }
  }

  // Calculate claim amount
  let claimAmount: number;
  const totalAmount = parseFloat(packet.totalAmount);
  const claimedAmount = parseFloat(packet.claimedAmount);
  const remaining = totalAmount - claimedAmount;
  const remainingCount = packet.totalCount - packet.claimedCount;

  if (packet.type === "fixed") {
    // Fixed: equal split
    claimAmount = Math.round((totalAmount / packet.totalCount) * 100) / 100;
  } else {
    // Random: 二倍均值法 (double average method)
    if (remainingCount === 1) {
      // Last one gets all remaining
      claimAmount = Math.round(remaining * 100) / 100;
    } else {
      const avg = remaining / remainingCount;
      const max = avg * 2;
      const min = 0.01; // minimum 0.01 USDT
      claimAmount = Math.round((Math.random() * (max - min) + min) * 100) / 100;
      // Ensure we don't exceed remaining
      if (claimAmount > remaining - (remainingCount - 1) * 0.01) {
        claimAmount = Math.round((remaining - (remainingCount - 1) * 0.01) * 100) / 100;
      }
    }
  }

  // Ensure minimum
  if (claimAmount < 0.01) claimAmount = 0.01;
  // Ensure doesn't exceed remaining
  if (claimAmount > remaining) claimAmount = Math.round(remaining * 100) / 100;

  const claimAmountStr = claimAmount.toFixed(2);

  // Insert claim record
  await dbInstance.insert(redPacketClaims).values({
    redPacketId,
    userId,
    amount: claimAmountStr,
  });

  // Update red packet counters
  const newClaimedCount = packet.claimedCount + 1;
  const newClaimedAmount = (claimedAmount + claimAmount).toFixed(2);
  const isCompleted = newClaimedCount >= packet.totalCount;
  await dbInstance.update(redPackets).set({
    claimedCount: newClaimedCount,
    claimedAmount: newClaimedAmount,
    status: isCompleted ? "completed" : "active",
  }).where(eq(redPackets.id, redPacketId));

  // Add balance to user
  await dbInstance.update(users).set({
    balance: sql`${users.balance} + ${claimAmountStr}`,
  }).where(eq(users.id, userId));

  // Record transaction - get user balance for before/after
  const [userRow] = await dbInstance.select({ balance: users.balance }).from(users).where(eq(users.id, userId));
  const balBefore = userRow ? parseFloat(userRow.balance) - claimAmount : 0;
  await dbInstance.insert(transactions).values({
    userId,
    type: "bonus",
    amount: claimAmountStr,
    balanceBefore: balBefore.toFixed(2),
    balanceAfter: userRow ? userRow.balance : claimAmountStr,
    status: "completed",
    note: `领取红包: ${packet.title}`,
    referenceType: "red_packet",
    referenceId: redPacketId,
  });

  return { success: true, amount: claimAmountStr };
}

/** Get red packet with claim status for a user */
export async function getRedPacketForUser(redPacketId: number, userId: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return null;

  const [packet] = await dbInstance.select().from(redPackets).where(eq(redPackets.id, redPacketId));
  if (!packet) return null;

  // Check if user already claimed
  const [userClaim] = await dbInstance.select().from(redPacketClaims)
    .where(and(eq(redPacketClaims.redPacketId, redPacketId), eq(redPacketClaims.userId, userId)));

  // Get top claims for leaderboard
  const topClaims = await dbInstance.select({
    id: redPacketClaims.id,
    userId: redPacketClaims.userId,
    amount: redPacketClaims.amount,
    claimedAt: redPacketClaims.claimedAt,
    nickname: users.nickname,
    tgUsername: users.tgUsername,
    avatar: users.avatar,
  })
    .from(redPacketClaims)
    .leftJoin(users, eq(redPacketClaims.userId, users.id))
    .where(eq(redPacketClaims.redPacketId, redPacketId))
    .orderBy(desc(redPacketClaims.amount))
    .limit(15);

  return {
    ...packet,
    userClaim: userClaim || null,
    topClaims,
  };
}

/** List active red packets for user */
export async function listActiveRedPackets() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(redPackets)
    .where(eq(redPackets.status, "active"))
    .orderBy(desc(redPackets.createdAt));
}


// ==================== 营销活动资金统计 ====================

/** Coupon financial stats */
export async function getCouponStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalClaims: 0, totalAmount: "0.00", recentClaims: [] };
  const [stats] = await dbInstance.select({
    totalClaims: sql<number>`COUNT(*)`,
    totalAmount: sql<string>`COALESCE(SUM(${couponClaims.amount}), 0)`,
  }).from(couponClaims);
  const recentClaims = await dbInstance.select({
    id: couponClaims.id,
    couponId: couponClaims.couponId,
    userId: couponClaims.userId,
    amount: couponClaims.amount,
    claimedAt: couponClaims.claimedAt,
    nickname: users.nickname,
    tgUsername: users.tgUsername,
    couponCode: coupons.code,
    couponName: coupons.name,
  }).from(couponClaims)
    .leftJoin(users, eq(couponClaims.userId, users.id))
    .leftJoin(coupons, eq(couponClaims.couponId, coupons.id))
    .orderBy(desc(couponClaims.claimedAt))
    .limit(50);
  return { totalClaims: stats?.totalClaims || 0, totalAmount: stats?.totalAmount || "0.00", recentClaims };
}

/** Checkin financial stats */
export async function getCheckinStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalCheckins: 0, totalReward: "0.00", todayCheckins: 0, recentCheckins: [] };
  const [stats] = await dbInstance.select({
    totalCheckins: sql<number>`COUNT(*)`,
    totalReward: sql<string>`COALESCE(SUM(${userCheckins.reward}), 0)`,
  }).from(userCheckins);
  const today = new Date().toISOString().slice(0, 10);
  const [todayStats] = await dbInstance.select({
    count: sql<number>`COUNT(*)`,
  }).from(userCheckins).where(eq(userCheckins.checkinDate, today));
  const recentCheckins = await dbInstance.select({
    id: userCheckins.id,
    userId: userCheckins.userId,
    checkinDate: userCheckins.checkinDate,
    dayNumber: userCheckins.dayNumber,
    reward: userCheckins.reward,
    createdAt: userCheckins.createdAt,
    nickname: users.nickname,
    tgUsername: users.tgUsername,
  }).from(userCheckins)
    .leftJoin(users, eq(userCheckins.userId, users.id))
    .orderBy(desc(userCheckins.createdAt))
    .limit(50);
  return {
    totalCheckins: stats?.totalCheckins || 0,
    totalReward: stats?.totalReward || "0.00",
    todayCheckins: todayStats?.count || 0,
    recentCheckins,
  };
}

/** First deposit bonus stats */
export async function getFirstDepositStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalClaims: 0, totalBonus: "0.00", totalDeposits: "0.00", recentClaims: [] };
  const [stats] = await dbInstance.select({
    totalClaims: sql<number>`COUNT(*)`,
    totalBonus: sql<string>`COALESCE(SUM(${firstDepositClaims.bonusAmount}), 0)`,
    totalDeposits: sql<string>`COALESCE(SUM(${firstDepositClaims.depositAmount}), 0)`,
  }).from(firstDepositClaims);
  const recentClaims = await dbInstance.select({
    id: firstDepositClaims.id,
    userId: firstDepositClaims.userId,
    depositAmount: firstDepositClaims.depositAmount,
    bonusAmount: firstDepositClaims.bonusAmount,
    createdAt: firstDepositClaims.createdAt,
    nickname: users.nickname,
    tgUsername: users.tgUsername,
  }).from(firstDepositClaims)
    .leftJoin(users, eq(firstDepositClaims.userId, users.id))
    .orderBy(desc(firstDepositClaims.createdAt))
    .limit(50);
  return {
    totalClaims: stats?.totalClaims || 0,
    totalBonus: stats?.totalBonus || "0.00",
    totalDeposits: stats?.totalDeposits || "0.00",
    recentClaims,
  };
}

/** Red packet overall stats (all packets combined) */
export async function getRedPacketStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalPackets: 0, totalAmount: "0.00", totalClaimed: "0.00", totalClaims: 0 };
  const [stats] = await dbInstance.select({
    totalPackets: sql<number>`COUNT(*)`,
    totalAmount: sql<string>`COALESCE(SUM(${redPackets.totalAmount}), 0)`,
    totalClaimed: sql<string>`COALESCE(SUM(${redPackets.claimedAmount}), 0)`,
  }).from(redPackets);
  const [claimStats] = await dbInstance.select({
    totalClaims: sql<number>`COUNT(*)`,
  }).from(redPacketClaims);
  return {
    totalPackets: stats?.totalPackets || 0,
    totalAmount: stats?.totalAmount || "0.00",
    totalClaimed: stats?.totalClaimed || "0.00",
    totalClaims: claimStats?.totalClaims || 0,
  };
}

/** Fission overall stats (all campaigns combined) */
export async function getFissionOverallStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalCampaigns: 0, totalClicks: 0, totalRegisters: 0, totalRewardPaid: "0.00" };
  const [stats] = await dbInstance.select({
    totalCampaigns: sql<number>`COUNT(*)`,
    totalClicks: sql<number>`COALESCE(SUM(${fissionCampaigns.clickCount}), 0)`,
    totalRegisters: sql<number>`COALESCE(SUM(${fissionCampaigns.registerCount}), 0)`,
    totalRewardPaid: sql<string>`COALESCE(SUM(${fissionCampaigns.totalRewardPaid}), 0)`,
  }).from(fissionCampaigns);
  return {
    totalCampaigns: stats?.totalCampaigns || 0,
    totalClicks: stats?.totalClicks || 0,
    totalRegisters: stats?.totalRegisters || 0,
    totalRewardPaid: stats?.totalRewardPaid || "0.00",
  };
}

export async function getEventStats() {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalEvents: 0, activeEvents: 0, endedEvents: 0, upcomingEvents: 0 };
  const allEvents = await dbInstance.select().from(timeLimitedEvents);
  const now = Date.now();
  let activeEvents = 0, endedEvents = 0, upcomingEvents = 0;
  for (const ev of allEvents) {
    const started = new Date(ev.startTime).getTime() <= now;
    const ended = new Date(ev.endTime).getTime() <= now;
    if (ended) endedEvents++;
    else if (started) activeEvents++;
    else upcomingEvents++;
  }
  return {
    totalEvents: allEvents.length,
    activeEvents,
    endedEvents,
    upcomingEvents,
  };
}

// ==================== TG 群组/频道管理 ====================

export async function listTgGroups() {
  const dbInstance = await getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(tgGroups).orderBy(tgGroups.createdAt);
}

export async function createTgGroup(data: Omit<InsertTgGroup, "id" | "createdAt" | "updatedAt">) {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB not available");
  const [result] = await dbInstance.insert(tgGroups).values(data);
  return (result as any).insertId as number;
}

export async function updateTgGroup(id: number, data: Partial<Pick<InsertTgGroup, "name" | "chatId" | "type" | "description" | "enabled">>) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  const { eq } = await import("drizzle-orm");
  await dbInstance.update(tgGroups).set(data).where(eq(tgGroups.id, id));
}

export async function deleteTgGroup(id: number) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  const { eq } = await import("drizzle-orm");
  await dbInstance.delete(tgGroups).where(eq(tgGroups.id, id));
}

export async function sendMessageToGroups(groupIds: number[], message: {
  content: string;
  imageUrl?: string | null;
  buttons?: Array<{ text: string; url: string; type?: string; row?: number }>;
}) {
  const dbInstance = await getDb();
  if (!dbInstance) return { sent: 0, failed: 0, results: [] as Array<{ name: string; chatId: string; success: boolean; error?: string }> };
  const { inArray } = await import("drizzle-orm");
  const groups = await dbInstance.select().from(tgGroups).where(inArray(tgGroups.id, groupIds));
  const botToken = await db.getConfigValue("tg_bot_token");
  if (!botToken) throw new Error("Bot Token 未配置");
  const miniAppUrl = (await db.getConfigValue("tg_mini_app_url")) || "";

  // Pre-resolve image URL
  let resolvedImageUrl: string | null = null;
  if (message.imageUrl) {
    if (message.imageUrl.startsWith("/manus-storage/")) {
      try {
        const key = message.imageUrl.replace("/manus-storage/", "");
        resolvedImageUrl = await storageGetSignedUrl(key);
      } catch { resolvedImageUrl = null; }
    } else {
      resolvedImageUrl = message.imageUrl;
    }
  }

  // Build inline keyboard
  let replyMarkup: Record<string, unknown> | undefined;
  if (message.buttons && message.buttons.length > 0) {
    const rowMap = new Map<number, Array<Record<string, unknown>>>();
    for (const btn of message.buttons) {
      const row = btn.row ?? 0;
      if (!rowMap.has(row)) rowMap.set(row, []);
      let webAppUrl = btn.url;
      if (btn.type === "web_app") {
        if (webAppUrl.startsWith("/") && miniAppUrl) webAppUrl = miniAppUrl + webAppUrl;
        rowMap.get(row)!.push({ text: btn.text, web_app: { url: webAppUrl } });
      } else {
        rowMap.get(row)!.push({ text: btn.text, url: btn.url });
      }
    }
    const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);
    replyMarkup = { inline_keyboard: sortedRows.map(([, btns]) => btns) };
  }

  let sent = 0, failed = 0;
  const results: Array<{ name: string; chatId: string; success: boolean; error?: string }> = [];
  for (const group of groups) {
    if (!group.enabled) continue;
    try {
      const body: Record<string, unknown> = {
        chat_id: group.chatId,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      };
      let apiMethod = "sendMessage";
      if (resolvedImageUrl) {
        apiMethod = "sendPhoto";
        body.photo = resolvedImageUrl;
        body.caption = message.content;
      } else {
        body.text = message.content;
      }
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${apiMethod}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (res.ok) {
        sent++;
        results.push({ name: group.name, chatId: group.chatId, success: true });
      } else {
        failed++;
        results.push({ name: group.name, chatId: group.chatId, success: false, error: data.description });
      }
    } catch (e: any) {
      failed++;
      results.push({ name: group.name, chatId: group.chatId, success: false, error: e.message });
    }
  }
  return { sent, failed, results };
}

/** Upsert a TG group discovered via webhook events (my_chat_member or group messages).
 * If a group with the same chatId already exists, update its name/type/isActive.
 * If not, create a new entry with enabled=true (if isActive) or enabled=false (if kicked).
 */
export async function upsertTgGroupFromWebhook(data: {
  chatId: string;
  name: string;
  type: string;
  isActive: boolean;
}) {
  const dbInstance = await getDb();
  if (!dbInstance) return;
  const { eq } = await import("drizzle-orm");
  const existing = await dbInstance.select().from(tgGroups).where(eq(tgGroups.chatId, data.chatId));
  if (existing.length > 0) {
    // Update existing group
    await dbInstance.update(tgGroups)
      .set({
        name: data.name,
        type: data.type as any,
        enabled: data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(tgGroups.chatId, data.chatId));
  } else if (data.isActive) {
    // Only create new entry if Bot is active in the group
    await dbInstance.insert(tgGroups).values({
      chatId: data.chatId,
      name: data.name,
      type: data.type as any,
      enabled: true,
      description: `Auto-discovered via webhook`,
    });
  }
}
