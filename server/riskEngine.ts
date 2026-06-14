/**
 * 风控引擎
 * - 可配置的风控规则（支持开关）
 * - AI 驱动的用户行为分析
 * - 自动告警生成与 Bot 通知
 */
import * as db from "./db";
import { invokeLLM } from "./deepseek";
import { notifyAdmins } from "./notifications";

// ==================== TYPES ====================
interface RiskRule {
  id: number;
  ruleKey: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  severity: string;
  params: any;
  action: string;
}

interface UserRiskProfile {
  userId: number;
  tgUsername: string | null;
  nickname: string | null;
  balance: string;
  totalDeposited: string;
  totalGamesPlayed: number;
  totalRakeGenerated: string;
  riskLevel: string;
  lastIp: string | null;
  deviceFingerprint: string | null;
  createdAt: Date;
  // Computed
  transactions: any[];
  agentRelationships: any[];
  commissionRecords: any[];
  gameStats: any;
}

// ==================== RULE ENGINE ====================

/**
 * Get all risk rules (cached for performance)
 */
export async function getRiskRules(): Promise<RiskRule[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  const { riskRules } = await import("../drizzle/schema");
  return dbInstance.select().from(riskRules);
}

/**
 * Get enabled rules only
 */
export async function getEnabledRules(): Promise<RiskRule[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  const { riskRules } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  return dbInstance.select().from(riskRules).where(eq(riskRules.enabled, true));
}

/**
 * Update rule (toggle, params, action)
 */
export async function updateRiskRule(ruleId: number, updates: Partial<{ enabled: boolean; severity: string; params: any; action: string }>) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return false;
  const { riskRules } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await dbInstance.update(riskRules).set(updates as any).where(eq(riskRules.id, ruleId));
  return true;
}

// ==================== RISK DETECTION ====================

/**
 * Run all enabled risk checks for a user
 * Called on key events: deposit, withdrawal, game end, login
 */
export async function runRiskChecks(userId: number, triggerEvent: string): Promise<void> {
  try {
    const rules = await getEnabledRules();
    if (rules.length === 0) return;

    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await dbInstance.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;

    for (const rule of rules) {
      try {
        const triggered = await checkRule(rule, user, dbInstance);
        if (triggered) {
          await createAlert(rule, userId, triggered.title, triggered.description, triggered.evidence);
        }
      } catch (e) {
        console.error(`[RiskEngine] Rule ${rule.ruleKey} check failed:`, e);
      }
    }
  } catch (e) {
    console.error("[RiskEngine] runRiskChecks failed:", e);
  }
}

async function checkRule(rule: RiskRule, user: any, dbInstance: any): Promise<{ title: string; description: string; evidence: any } | null> {
  const params = rule.params || {};

  switch (rule.ruleKey) {
    case "same_ip_multi_account":
      return checkSameIpMultiAccount(user, params, dbInstance);
    case "abnormal_deposit_withdraw":
      return checkAbnormalDepositWithdraw(user, params, dbInstance);
    case "agent_self_play":
      return checkAgentSelfPlay(user, params, dbInstance);
    case "device_fingerprint_cluster":
      return checkDeviceFingerprintCluster(user, params, dbInstance);
    case "bonus_abuse_multi_deposit":
      return checkBonusAbuseMultiDeposit(user, params, dbInstance);
    default:
      return null;
  }
}

async function checkSameIpMultiAccount(user: any, params: any, dbInstance: any) {
  if (!user.lastIp) return null;
  const { users } = await import("../drizzle/schema");
  const { eq, and, ne, sql } = await import("drizzle-orm");
  const maxAccounts = params.maxAccounts || 3;

  const sameIpUsers = await dbInstance.select({ id: users.id, name: users.name, tgUsername: users.tgUsername })
    .from(users)
    .where(and(eq(users.lastIp, user.lastIp), ne(users.id, user.id)));

  if (sameIpUsers.length >= maxAccounts - 1) {
    return {
      title: `同IP多账号: ${user.lastIp}`,
      description: `用户 #${user.id} (${user.tgUsername || user.nickname || "未知"}) 与其他 ${sameIpUsers.length} 个账号共享IP ${user.lastIp}`,
      evidence: { ip: user.lastIp, relatedUsers: sameIpUsers.map((u: any) => ({ id: u.id, name: u.name, tgUsername: u.tgUsername })) },
    };
  }
  return null;
}

async function checkAbnormalDepositWithdraw(user: any, params: any, dbInstance: any) {
  const { transactions } = await import("../drizzle/schema");
  const { eq, and, desc, sql, gte } = await import("drizzle-orm");
  const timeWindow = params.withdrawTimeMinutes || 30;
  const minDeposit = params.minDepositAmount || 100;
  const withdrawRatio = params.withdrawRatio || 0.8;

  const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
  const recentTxs = await dbInstance.select()
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), gte(transactions.createdAt, cutoff)))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  const deposits = recentTxs.filter((t: any) => t.type === "deposit" && t.status === "confirmed");
  const withdrawals = recentTxs.filter((t: any) => t.type === "withdrawal" && (t.status === "confirmed" || t.status === "pending"));

  const totalDeposit = deposits.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
  const totalWithdraw = withdrawals.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  if (totalDeposit >= minDeposit && totalWithdraw >= totalDeposit * withdrawRatio) {
    return {
      title: `异常充提: 用户#${user.id}`,
      description: `${timeWindow}分钟内充值$${totalDeposit.toFixed(2)}，提现$${totalWithdraw.toFixed(2)}（比例${(totalWithdraw / totalDeposit * 100).toFixed(0)}%）`,
      evidence: { totalDeposit, totalWithdraw, ratio: totalWithdraw / totalDeposit, timeWindowMinutes: timeWindow },
    };
  }
  return null;
}

async function checkAgentSelfPlay(user: any, params: any, dbInstance: any) {
  const { agentRelationships, handPlayers } = await import("../drizzle/schema");
  const { eq, and, or, sql, gte, desc } = await import("drizzle-orm");
  const minHands = params.minHandsTogether || 5;
  const timeWindow = params.timeWindowHours || 24;

  // Get user's agent relationships (both as agent and downline)
  const relationships = await dbInstance.select()
    .from(agentRelationships)
    .where(or(eq(agentRelationships.agentId, user.id), eq(agentRelationships.downlineId, user.id)));

  if (relationships.length === 0) return null;

  // Get related user IDs
  const relatedIds = relationships.map((r: any) => r.agentId === user.id ? r.downlineId : r.agentId);

  // Check if they played at the same table recently
  const cutoff = new Date(Date.now() - timeWindow * 3600 * 1000);
  const userHands = await dbInstance.select({ handId: handPlayers.handId })
    .from(handPlayers)
    .where(eq(handPlayers.userId, user.id));

  if (userHands.length === 0) return null;

  const handIds = userHands.map((h: any) => h.handId);
  // Check overlap with related users
  for (const relatedId of relatedIds) {
    const overlap = await dbInstance.select({ count: sql<number>`count(*)` })
      .from(handPlayers)
      .where(and(
        eq(handPlayers.userId, relatedId),
        sql`${handPlayers.handId} IN (${sql.raw(handIds.join(","))})`
      ));

    if (overlap[0]?.count >= minHands) {
      return {
        title: `代理自弹自唱: #${user.id} ↔ #${relatedId}`,
        description: `用户#${user.id}与其代理关系用户#${relatedId}在${timeWindow}小时内同桌${overlap[0].count}手`,
        evidence: { userId: user.id, relatedUserId: relatedId, handsTogetherCount: overlap[0].count },
      };
    }
  }
  return null;
}

async function checkDeviceFingerprintCluster(user: any, params: any, dbInstance: any) {
  if (!user.deviceFingerprint) return null;
  const { users } = await import("../drizzle/schema");
  const { eq, and, ne } = await import("drizzle-orm");
  const maxAccounts = params.maxAccountsPerDevice || 2;

  const sameDeviceUsers = await dbInstance.select({ id: users.id, name: users.name, tgUsername: users.tgUsername })
    .from(users)
    .where(and(eq(users.deviceFingerprint, user.deviceFingerprint), ne(users.id, user.id)));

  if (sameDeviceUsers.length >= maxAccounts) {
    return {
      title: `设备指纹关联: ${user.deviceFingerprint?.substring(0, 16)}...`,
      description: `用户#${user.id}与其他${sameDeviceUsers.length}个账号使用相同设备`,
      evidence: { deviceFingerprint: user.deviceFingerprint, relatedUsers: sameDeviceUsers },
    };
  }
  return null;
}

async function checkBonusAbuseMultiDeposit(user: any, params: any, dbInstance: any) {
  const { transactions } = await import("../drizzle/schema");
  const { eq, and, gte, sql } = await import("drizzle-orm");
  const maxDepositsPerDay = params.maxDepositsPerDay || 5;
  const minAmount = params.minAmount || 1;
  const maxAmount = params.maxAmount || 10;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDeposits = await dbInstance.select()
    .from(transactions)
    .where(and(
      eq(transactions.userId, user.id),
      eq(transactions.type, "deposit"),
      eq(transactions.status, "confirmed"),
      gte(transactions.createdAt, today)
    ));

  const smallDeposits = todayDeposits.filter((t: any) => {
    const amount = parseFloat(t.amount);
    return amount >= minAmount && amount <= maxAmount;
  });

  if (smallDeposits.length >= maxDepositsPerDay) {
    return {
      title: `小额多次充值: 用户#${user.id}`,
      description: `今日${smallDeposits.length}笔小额充值（$${minAmount}-$${maxAmount}），疑似撸奖励`,
      evidence: { depositsCount: smallDeposits.length, amounts: smallDeposits.map((t: any) => parseFloat(t.amount)) },
    };
  }
  return null;
}

// ==================== ALERT MANAGEMENT ====================

async function createAlert(rule: RiskRule, userId: number, title: string, description: string, evidence: any) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { riskAlerts } = await import("../drizzle/schema");
  const { and, eq, gte, sql } = await import("drizzle-orm");

  // Dedup: don't create duplicate alerts for same user+rule within 24h
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const existing = await dbInstance.select({ count: sql<number>`count(*)` })
    .from(riskAlerts)
    .where(and(
      eq(riskAlerts.userId, userId),
      eq(riskAlerts.ruleKey, rule.ruleKey),
      gte(riskAlerts.createdAt, cutoff)
    ));

  if (existing[0]?.count > 0) return; // Already alerted recently

  // Create alert
  await dbInstance.insert(riskAlerts).values({
    userId,
    ruleId: rule.id,
    ruleKey: rule.ruleKey,
    severity: rule.severity as any,
    title,
    description,
    evidence,
    notificationSent: false,
  });

  // Execute action
  if (rule.action === "freeze_balance") {
    const { users } = await import("../drizzle/schema");
    const { eq: eqOp } = await import("drizzle-orm");
    await dbInstance.update(users).set({ riskLevel: "frozen" }).where(eqOp(users.id, userId));
  } else if (rule.action === "ban_account") {
    const { users } = await import("../drizzle/schema");
    const { eq: eqOp } = await import("drizzle-orm");
    await dbInstance.update(users).set({ riskLevel: "banned" }).where(eqOp(users.id, userId));
  }

  // Send Bot notification
  if (rule.action === "notify_admin" || rule.severity === "high" || rule.severity === "critical") {
    const severityEmoji = { low: "ℹ️", medium: "⚠️", high: "🚨", critical: "🔴" }[rule.severity] || "⚠️";
    await notifyAdmins(
      `${severityEmoji} 风控告警`,
      `规则: ${rule.name}\n用户: #${userId}\n${description}`,
      evidence
    );

    // Mark notification sent
    const { riskAlerts: alertsTable } = await import("../drizzle/schema");
    const { eq: eqOp, desc } = await import("drizzle-orm");
    const [latestAlert] = await dbInstance.select()
      .from(alertsTable)
      .where(and(eq(alertsTable.userId, userId), eq(alertsTable.ruleKey, rule.ruleKey)))
      .orderBy(desc(alertsTable.createdAt))
      .limit(1);
    if (latestAlert) {
      await dbInstance.update(alertsTable).set({ notificationSent: true }).where(eqOp(alertsTable.id, latestAlert.id));
    }
  }
}

// ==================== AI ANALYSIS ====================

/**
 * AI-powered user risk analysis
 * Analyzes user behavior patterns to detect wool-pulling (撸羊毛)
 */
export async function analyzeUserRisk(userId: number): Promise<{
  riskScore: number;
  riskLabels: string[];
  analysis: string;
  recommendation: string;
}> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return { riskScore: 0, riskLabels: [], analysis: "数据库不可用", recommendation: "" };

  const { users, transactions, agentRelationships, commissionRecords, handPlayers, gameHands } = await import("../drizzle/schema");
  const { eq, desc, sql, and } = await import("drizzle-orm");

  // Gather user data
  const [user] = await dbInstance.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { riskScore: 0, riskLabels: [], analysis: "用户不存在", recommendation: "" };

  // Get transactions
  const txs = await dbInstance.select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

  // Get agent relationships
  const agentRels = await dbInstance.select()
    .from(agentRelationships)
    .where(eq(agentRelationships.agentId, userId));

  const asDownline = await dbInstance.select()
    .from(agentRelationships)
    .where(eq(agentRelationships.downlineId, userId));

  // Get commission records
  const commissions = await dbInstance.select()
    .from(commissionRecords)
    .where(eq(commissionRecords.agentId, userId))
    .orderBy(desc(commissionRecords.createdAt))
    .limit(50);

  // Get game stats (winAmount - betAmount = net)
  const [gameStats] = await dbInstance.select({
    totalHands: sql<number>`count(*)`,
    totalWon: sql<number>`COALESCE(SUM(CAST(${handPlayers.winAmount} AS DECIMAL(18,2))), 0)`,
    totalBet: sql<number>`COALESCE(SUM(CAST(${handPlayers.betAmount} AS DECIMAL(18,2))), 0)`,
  }).from(handPlayers).where(eq(handPlayers.userId, userId));

  // Compute metrics
  const deposits = txs.filter(t => t.type === "deposit" && t.status === "confirmed");
  const withdrawals = txs.filter(t => t.type === "withdraw" && (t.status === "confirmed" || t.status === "pending"));
  const totalDeposit = deposits.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalWithdraw = withdrawals.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalCommission = commissions.reduce((s, c) => s + parseFloat(c.commissionAmount), 0);

  // Build analysis prompt
  const prompt = `你是一个在线扑克平台的风控AI分析师。请分析以下用户数据，判断该用户是否为"撸羊毛"用户（即利用平台奖励机制获利而非真正参与游戏的用户）。

用户基本信息:
- 用户ID: ${userId}
- TG用户名: ${user.tgUsername || "未设置"}
- 昵称: ${user.nickname || "未设置"}
- 注册时间: ${user.createdAt}
- 当前余额: $${user.balance}
- 风险等级: ${user.riskLevel}
- TG账号年龄: ${user.tgAccountAge || "未知"}天

资金数据:
- 总充值: $${totalDeposit.toFixed(2)} (${deposits.length}笔)
- 总提现: $${totalWithdraw.toFixed(2)} (${withdrawals.length}笔)
- 充提比: ${totalDeposit > 0 ? (totalWithdraw / totalDeposit * 100).toFixed(0) : 0}%
- 佣金收入: $${totalCommission.toFixed(2)} (${commissions.length}笔)

游戏数据:
- 总手牌数: ${gameStats?.totalHands || 0}
- 总赢得: $${(gameStats?.totalWon || 0).toFixed(2)}
- 总投注: $${(gameStats?.totalBet || 0).toFixed(2)}
- 净盈亏: $${((gameStats?.totalWon || 0) - (gameStats?.totalBet || 0)).toFixed(2)}

代理关系:
- 作为代理的下线数: ${agentRels.length}
- 作为下线的上级数: ${asDownline.length}
- 代理关系是否有循环: ${agentRels.some(r => asDownline.some(d => d.agentId === r.downlineId)) ? "是" : "否"}

最近交易模式:
${txs.slice(0, 10).map(t => `  ${t.type} $${t.amount} (${t.status}) - ${t.createdAt}`).join("\n")}

请输出JSON格式的分析结果。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "你是一个专业的在线博彩平台风控分析师。请基于数据给出客观分析。" },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "risk_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              riskScore: { type: "integer", description: "风险评分 0-100，0为最安全，100为最危险" },
              riskLabels: { type: "array", items: { type: "string" }, description: "风险标签列表，如：撸羊毛、洗钱嫌疑、机器人、正常用户等" },
              analysis: { type: "string", description: "详细分析说明（200字以内）" },
              recommendation: { type: "string", description: "建议处理方式" },
            },
            required: ["riskScore", "riskLabels", "analysis", "recommendation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (content && typeof content === "string") {
      const result = JSON.parse(content);
      // Save AI analysis to latest alert if exists
      const { riskAlerts } = await import("../drizzle/schema");
      const [latestAlert] = await dbInstance.select()
        .from(riskAlerts)
        .where(eq(riskAlerts.userId, userId))
        .orderBy(desc(riskAlerts.createdAt))
        .limit(1);
      if (latestAlert) {
        await dbInstance.update(riskAlerts)
          .set({ aiAnalysis: result.analysis, riskScore: result.riskScore })
          .where(eq(riskAlerts.id, latestAlert.id));
      }
      return result;
    }
  } catch (e) {
    console.error("[RiskEngine] AI analysis failed:", e);
  }

  return { riskScore: 50, riskLabels: ["分析失败"], analysis: "AI分析暂时不可用", recommendation: "请人工审核" };
}

// ==================== USER EARNINGS FLOW ====================

/**
 * Get user's complete earnings flow (for visualization)
 */
export async function getUserEarningsFlow(userId: number): Promise<{
  summary: { totalDeposit: number; totalWithdraw: number; totalGameWin: number; totalGameLoss: number; totalCommission: number; totalBonus: number; netProfit: number };
  timeline: Array<{ date: string; type: string; amount: number; description: string }>;
  relatedUsers: Array<{ id: number; name: string | null; tgUsername: string | null; relationship: string }>;
}> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return { summary: { totalDeposit: 0, totalWithdraw: 0, totalGameWin: 0, totalGameLoss: 0, totalCommission: 0, totalBonus: 0, netProfit: 0 }, timeline: [], relatedUsers: [] };

  const { users, transactions, commissionRecords, agentRelationships, handPlayers, gameHands } = await import("../drizzle/schema");
  const { eq, desc, or, sql } = await import("drizzle-orm");

  // Transactions
  const txs = await dbInstance.select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(200);

  // Commission records (as agent)
  const commissions = await dbInstance.select()
    .from(commissionRecords)
    .where(eq(commissionRecords.agentId, userId))
    .orderBy(desc(commissionRecords.createdAt))
    .limit(100);

  // Game results - handPlayers has winAmount and betAmount, compute net from those
  // Join with gameHands to get createdAt
  const gameResults = await dbInstance.select({
    date: sql<string>`DATE(${gameHands.startedAt})`,
    totalWon: sql<number>`COALESCE(SUM(CAST(${handPlayers.winAmount} AS DECIMAL(18,2))), 0)`,
    totalBet: sql<number>`COALESCE(SUM(CAST(${handPlayers.betAmount} AS DECIMAL(18,2))), 0)`,
    hands: sql<number>`count(*)`,
  }).from(handPlayers)
    .innerJoin(gameHands, eq(handPlayers.handId, gameHands.id))
    .where(eq(handPlayers.userId, userId))
    .groupBy(sql`DATE(${gameHands.startedAt})`)
    .orderBy(desc(sql`DATE(${gameHands.startedAt})`))
    .limit(30);

  // Related users (agent relationships)
  const rels = await dbInstance.select()
    .from(agentRelationships)
    .where(or(eq(agentRelationships.agentId, userId), eq(agentRelationships.downlineId, userId)));

  const relatedUserIds = [...new Set(rels.map(r => r.agentId === userId ? r.downlineId : r.agentId))];
  const relatedUsers: Array<{ id: number; name: string | null; tgUsername: string | null; relationship: string }> = [];

  if (relatedUserIds.length > 0) {
    const relUsers = await dbInstance.select({ id: users.id, name: users.name, tgUsername: users.tgUsername })
      .from(users)
      .where(sql`${users.id} IN (${sql.raw(relatedUserIds.join(","))})`);

    for (const u of relUsers) {
      const rel = rels.find(r => (r.agentId === userId && r.downlineId === u.id) || (r.downlineId === userId && r.agentId === u.id));
      relatedUsers.push({
        id: u.id,
        name: u.name,
        tgUsername: u.tgUsername,
        relationship: rel?.agentId === userId ? `下线(L${rel.level})` : `上级(L${rel?.level})`,
      });
    }
  }

  // Compute summary
  const confirmedTxs = txs.filter(t => t.status === "confirmed");
  const totalDeposit = confirmedTxs.filter(t => t.type === "deposit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalWithdraw = confirmedTxs.filter(t => t.type === "withdraw").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalCommission = commissions.filter(c => c.status === "settled").reduce((s, c) => s + parseFloat(c.commissionAmount), 0);
  const totalGameWin = gameResults.reduce((s, g) => s + (g.totalWon || 0), 0);
  const totalGameLoss = gameResults.reduce((s, g) => s + (g.totalBet || 0), 0);

  // Build timeline
  const timeline: Array<{ date: string; type: string; amount: number; description: string }> = [];

  for (const tx of confirmedTxs.slice(0, 50)) {
    timeline.push({
      date: tx.createdAt?.toISOString().split("T")[0] || "",
      type: tx.type,
      amount: parseFloat(tx.amount),
      description: `${tx.type === "deposit" ? "充值" : "提现"} $${tx.amount} (${tx.chain || "unknown"})`,
    });
  }

  for (const c of commissions.slice(0, 30)) {
    timeline.push({
      date: c.createdAt?.toISOString().split("T")[0] || "",
      type: "commission",
      amount: parseFloat(c.commissionAmount),
      description: `佣金 $${c.commissionAmount} (L${c.level} 下线#${c.downlineId})`,
    });
  }

  for (const g of gameResults) {
    if (g.totalWon > 0) {
      timeline.push({ date: g.date, type: "game_win", amount: g.totalWon, description: `游戏赢利 $${g.totalWon.toFixed(2)} (${g.hands}手)` });
    }
    if (g.totalBet > 0) {
      timeline.push({ date: g.date, type: "game_loss", amount: -g.totalBet, description: `游戏投注 -$${g.totalBet.toFixed(2)} (${g.hands}手)` });
    }
  }

  // Sort by date desc
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  return {
    summary: {
      totalDeposit,
      totalWithdraw,
      totalGameWin,
      totalGameLoss,
      totalCommission,
      totalBonus: 0, // TODO: implement bonus tracking
      netProfit: totalGameWin - totalGameLoss + totalCommission - totalWithdraw + totalDeposit,
    },
    timeline: timeline.slice(0, 100),
    relatedUsers,
  };
}

// ==================== ALERT QUERIES ====================

export async function getRiskAlerts(page = 1, limit = 20, status?: string) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return { alerts: [], total: 0 };
  const { riskAlerts } = await import("../drizzle/schema");
  const { desc, sql, eq, and } = await import("drizzle-orm");
  const offset = (page - 1) * limit;

  const condition = status ? eq(riskAlerts.status, status as any) : undefined;

  const [data, countResult] = await Promise.all([
    condition
      ? dbInstance.select().from(riskAlerts).where(condition).orderBy(desc(riskAlerts.createdAt)).limit(limit).offset(offset)
      : dbInstance.select().from(riskAlerts).orderBy(desc(riskAlerts.createdAt)).limit(limit).offset(offset),
    condition
      ? dbInstance.select({ count: sql<number>`count(*)` }).from(riskAlerts).where(condition)
      : dbInstance.select({ count: sql<number>`count(*)` }).from(riskAlerts),
  ]);

  return { alerts: data, total: countResult[0]?.count ?? 0 };
}

export async function updateAlertStatus(alertId: number, status: string, resolvedBy?: number, resolution?: string) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return false;
  const { riskAlerts } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const updates: any = { status };
  if (status === "resolved" || status === "ignored") {
    updates.resolvedAt = new Date();
    if (resolvedBy) updates.resolvedBy = resolvedBy;
    if (resolution) updates.resolution = resolution;
  }

  await dbInstance.update(riskAlerts).set(updates).where(eq(riskAlerts.id, alertId));
  return true;
}
