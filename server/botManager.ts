/**
 * AI 陪玩机器人管理器
 * 管理机器人的入座、离座、自动操作、每日亏损限制
 * 机器人策略：偏弱（高弃牌率、不跟大注、不All-in）
 * 机器人筹码来自系统虚拟资金池，不影响真实用户余额
 */
import * as db from "./db";
import * as gameEngine from "./gameEngine";
import { getTable, joinTable, processPlayerAction, playerReady } from "./tableManager";
import type { GameState, PlayerAction, Card } from "./gameEngine";

// ==================== 配置接口 ====================
interface BotConfig {
  enabled: boolean;
  maxPerTable: number;       // 每桌最多bot数
  dailyLossLimit: number;    // 每日最大亏损（美元）
  foldRate: number;          // 弃牌率 (0-100)
  minActionDelay: number;    // 最小操作延迟(ms)
  maxActionDelay: number;    // 最大操作延迟(ms)
}

// 默认配置
const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  maxPerTable: 2,
  dailyLossLimit: 200,
  foldRate: 67,
  minActionDelay: 2000,
  maxActionDelay: 5000,
};

// ==================== 内存状态 ====================
// 当前配置缓存
let cachedConfig: BotConfig | null = null;
let configCachedAt = 0;
const CONFIG_CACHE_TTL = 10000; // 10秒缓存

// bot用户ID列表缓存
let cachedBotUserIds: number[] = [];
let botUsersCachedAt = 0;
const BOT_USERS_CACHE_TTL = 60000; // 60秒缓存

// 每日亏损追踪
let dailyLossTotal = 0;
let dailyLossDate = new Date().toDateString();

// 当前已入座的bot: roomId -> Set<botUserId>
const seatedBots = new Map<number, Set<number>>();

// 正在执行操作的bot（防止重复触发）
const pendingActions = new Set<string>(); // "roomId:botId"

// 正在加入桌子的bot（防止并发加入）
const joiningBots = new Set<string>(); // "roomId:botId"

// ==================== 配置管理 ====================
export async function getBotConfig(): Promise<BotConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCachedAt < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const enabled = await db.getConfigValue("bot_enabled", "false");
  const maxPerTable = await db.getConfigValue("bot_max_per_table", "2");
  const dailyLossLimit = await db.getConfigValue("bot_daily_loss_limit", "200");
  const foldRate = await db.getConfigValue("bot_fold_rate", "67");
  const minDelay = await db.getConfigValue("bot_min_action_delay", "2000");
  const maxDelay = await db.getConfigValue("bot_max_action_delay", "5000");

  cachedConfig = {
    enabled: enabled === "true",
    maxPerTable: parseInt(maxPerTable) || DEFAULT_CONFIG.maxPerTable,
    dailyLossLimit: parseFloat(dailyLossLimit) || DEFAULT_CONFIG.dailyLossLimit,
    foldRate: parseInt(foldRate) || DEFAULT_CONFIG.foldRate,
    minActionDelay: parseInt(minDelay) || DEFAULT_CONFIG.minActionDelay,
    maxActionDelay: parseInt(maxDelay) || DEFAULT_CONFIG.maxActionDelay,
  };
  configCachedAt = now;
  return cachedConfig;
}

// 强制刷新配置缓存
export function invalidateConfigCache() {
  cachedConfig = null;
  configCachedAt = 0;
}

// ==================== Bot用户管理 ====================
export async function getBotUserIds(): Promise<number[]> {
  const now = Date.now();
  if (cachedBotUserIds.length > 0 && now - botUsersCachedAt < BOT_USERS_CACHE_TTL) {
    return cachedBotUserIds;
  }

  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const bots = await dbInstance.select({ id: users.id }).from(users).where(eq(users.isBot, true));
  cachedBotUserIds = bots.map(b => b.id);
  botUsersCachedAt = now;
  return cachedBotUserIds;
}

export async function getBotUsers() {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  return dbInstance.select({
    id: users.id,
    name: users.name,
    nickname: users.nickname,
    avatar: users.avatar,
    openId: users.openId,
  }).from(users).where(eq(users.isBot, true));
}

// ==================== 每日亏损追踪 ====================
function resetDailyLossIfNeeded() {
  const today = new Date().toDateString();
  if (today !== dailyLossDate) {
    dailyLossTotal = 0;
    dailyLossDate = today;
  }
}

export function getDailyBotLoss(): number {
  resetDailyLossIfNeeded();
  return dailyLossTotal;
}

export function addBotLoss(amount: number) {
  resetDailyLossIfNeeded();
  dailyLossTotal += amount;
}

// Bot赢钱时减少亏损记录
export function addBotWin(amount: number) {
  resetDailyLossIfNeeded();
  dailyLossTotal -= amount;
  if (dailyLossTotal < 0) dailyLossTotal = 0;
}

// ==================== Bot入座逻辑 ====================
/**
 * 检查房间是否需要bot填充，并执行入座
 * 条件：bot系统启用 + 真实玩家 < 3 + 桌上bot未达上限 + 每日亏损未达上限
 */
export async function checkAndFillBots(roomId: number): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  // 检查每日亏损限制
  resetDailyLossIfNeeded();
  if (dailyLossTotal >= config.dailyLossLimit) return;

  // 获取房间信息
  const room = await db.getRoomById(roomId);
  if (!room || room.type !== "public") return; // 只在公共房间添加bot

  // 获取当前在座玩家
  const roomPlayers = await db.getRoomPlayers(roomId);
  const botUserIds = await getBotUserIds();

  // 统计真实玩家和bot玩家
  const realPlayers = roomPlayers.filter((rp: any) => !botUserIds.includes(rp.userId));
  const botsAtTable = roomPlayers.filter((rp: any) => botUserIds.includes(rp.userId));

  // 只有当真实玩家 >= 1 且 < 3 时才添加bot（需要有真人才加bot）
  if (realPlayers.length < 1 || realPlayers.length >= 3) return;

  // 检查bot上限
  if (botsAtTable.length >= config.maxPerTable) return;

  // 检查桌子是否满了
  if (roomPlayers.length >= room.maxPlayers) return;

  // 选择一个可用的bot（不在任何桌上的）
  const allSeatedBotIds = new Set<number>();
  for (const [, bots] of seatedBots) {
    for (const id of bots) allSeatedBotIds.add(id);
  }
  // 也检查DB中已入座的bot
  for (const rp of roomPlayers) {
    if (botUserIds.includes(rp.userId)) allSeatedBotIds.add(rp.userId);
  }

  const availableBots = botUserIds.filter(id => !allSeatedBotIds.has(id));
  if (availableBots.length === 0) return;

  // 随机选择一个bot
  const selectedBotId = availableBots[Math.floor(Math.random() * availableBots.length)];
  const joinKey = `${roomId}:${selectedBotId}`;
  if (joiningBots.has(joinKey)) return;
  joiningBots.add(joinKey);

  try {
    // Bot买入金额：使用房间最小买入
    const buyIn = parseFloat(room.minBuyIn);
    
    // 检查bot余额是否足够
    const botUser = await db.getUserById(selectedBotId);
    if (!botUser || parseFloat(String(botUser.balance)) < buyIn) {
      console.log(`[BotManager] Bot ${selectedBotId} insufficient balance (${botUser?.balance ?? 0} < ${buyIn}), skipping`);
      return;
    }

    // 真实扣除余额（和真实玩家一样）
    const newBalance = await db.deductUserBalanceAtomic(selectedBotId, buyIn);
    if (newBalance === null) {
      console.log(`[BotManager] Bot ${selectedBotId} balance deduction failed, skipping`);
      return;
    }

    const result = await joinTable(roomId, selectedBotId, buyIn);
    if (result.success) {
      // 记录买入交易流水
      await db.createTransaction({
        userId: selectedBotId,
        type: "buy_in",
        amount: buyIn.toFixed(2),
        balanceBefore: botUser.balance,
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: roomId,
        note: `买入房间 ${room.name || roomId}`,
      });
      // 记录bot入座
      if (!seatedBots.has(roomId)) seatedBots.set(roomId, new Set());
      seatedBots.get(roomId)!.add(selectedBotId);
      console.log(`[BotManager] Bot ${selectedBotId} joined room ${roomId} at seat ${result.seatIndex}`);
    } else {
      // 入座失败，退回余额
      await db.addUserBalanceAtomic(selectedBotId, buyIn);
    }
  } catch (e) {
    console.error(`[BotManager] Error adding bot to room ${roomId}:`, e);
  } finally {
    joiningBots.delete(joinKey);
  }
}

/**
 * 移除房间中的所有bot
 */
export async function removeBotsFromRoom(roomId: number): Promise<void> {
  const bots = seatedBots.get(roomId);
  if (!bots || bots.size === 0) return;

  for (const botId of bots) {
    try {
      await db.removeRoomPlayer(roomId, botId);
    } catch (e) {
      console.error(`[BotManager] Error removing bot ${botId} from room ${roomId}:`, e);
    }
  }
  seatedBots.delete(roomId);
}

// ==================== Bot自动Ready ====================
/**
 * 在ready阶段自动为所有bot点击ready
 * 延迟1-3秒模拟人类行为
 */
export async function autoReadyBots(roomId: number): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  const botUserIds = await getBotUserIds();
  const table = getTable(roomId);
  if (!table) return;

  const botsInGame = table.gameState.players.filter(p => botUserIds.includes(p.id));

  for (const bot of botsInGame) {
    const delay = 1000 + Math.random() * 2000; // 1-3秒
    setTimeout(async () => {
      try {
        const currentTable = getTable(roomId);
        if (currentTable && currentTable.waitingForReady) {
          await playerReady(roomId, bot.id);
        }
      } catch (e) {
        console.error(`[BotManager] Error auto-ready bot ${bot.id}:`, e);
      }
    }, delay);
  }
}

// ==================== Bot AI 决策 ====================
/**
 * 触发bot操作（如果当前轮到bot行动）
 * 在checkTimeouts中调用，检测到当前玩家是bot时触发
 */
export async function triggerBotAction(roomId: number): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  const table = getTable(roomId);
  if (!table) return;

  const gs = table.gameState;
  if (gs.phase === "waiting" || gs.phase === "completed" || gs.phase === "showdown" || gs.phase === "dealing") return;
  if (table.waitingForReady) return;

  const currentPlayer = gs.players[gs.currentPlayerIndex];
  if (!currentPlayer) return;

  const botUserIds = await getBotUserIds();
  if (!botUserIds.includes(currentPlayer.id)) return;

  // 防止重复触发
  const actionKey = `${roomId}:${currentPlayer.id}`;
  if (pendingActions.has(actionKey)) return;
  pendingActions.add(actionKey);

  // 随机延迟2-5秒
  const delay = config.minActionDelay + Math.random() * (config.maxActionDelay - config.minActionDelay);

  setTimeout(async () => {
    try {
      // 重新获取最新状态（延迟期间可能已变化）
      const currentTable = getTable(roomId);
      if (!currentTable) return;
      const currentGs = currentTable.gameState;
      if (currentGs.phase === "waiting" || currentGs.phase === "completed" || currentGs.phase === "showdown") return;
      
      const player = currentGs.players[currentGs.currentPlayerIndex];
      if (!player || player.id !== currentPlayer.id) return; // 不再是这个bot的回合

      // AI决策（基于概率计算）
      const decision = decideBotAction(currentGs, player, currentTable.bigBlind, config);
      
      // 执行操作
      await processPlayerAction(roomId, player.id, decision.action, decision.amount);
    } catch (e) {
      console.error(`[BotManager] Error executing bot action in room ${roomId}:`, e);
    } finally {
      pendingActions.delete(actionKey);
    }
  }, delay);
}

// ==================== 智能决策引擎（基于概率计算） ====================

/**
 * Preflop手牌分级表（基于德州扎古典起手牌表）
 * 返回 equity 估计值 0-1
 */
function getPreflopEquity(holeCards: Card[]): number {
  if (holeCards.length < 2) return 0.3;
  
  const RANK_VAL: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
  };

  const r1 = RANK_VAL[holeCards[0][0]] || 2;
  const r2 = RANK_VAL[holeCards[1][0]] || 2;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = holeCards[0][1] === holeCards[1][1];
  const paired = r1 === r2;
  const gap = high - low;

  // 对子胜率表（近似值，基于全桦胜率统计）
  if (paired) {
    // AA=85%, KK=82%, QQ=80%, JJ=77%, TT=75%, 99=72%, 88=69%, 77=66%, 66=63%, 55=60%, 44=57%, 33=54%, 22=51%
    const pairEquity: Record<number, number> = {
      14: 0.85, 13: 0.82, 12: 0.80, 11: 0.77, 10: 0.75,
      9: 0.72, 8: 0.69, 7: 0.66, 6: 0.63, 5: 0.60, 4: 0.57, 3: 0.54, 2: 0.51
    };
    return pairEquity[r1] || 0.55;
  }

  // 非对子手牌胜率估算
  let equity = 0.30; // 基础值

  // 高牌加成
  if (high === 14) equity += 0.12; // A高牌
  else if (high === 13) equity += 0.09;
  else if (high === 12) equity += 0.07;
  else if (high === 11) equity += 0.05;
  else if (high === 10) equity += 0.03;

  // 低牌加成
  if (low >= 10) equity += 0.06;
  else if (low >= 8) equity += 0.03;
  else if (low >= 6) equity += 0.01;

  // 同花加成（约+3-4%胜率）
  if (suited) equity += 0.035;

  // 连牌加成（顺子潜力）
  if (gap === 1) equity += 0.025;
  else if (gap === 2) equity += 0.015;
  else if (gap === 3) equity += 0.008;
  // gap >= 4 无加成

  // 经典强牌组合修正
  // AKs ~ 67%, AKo ~ 65%, AQs ~ 66%, AJs ~ 65%
  if (high === 14 && low === 13) equity = suited ? 0.67 : 0.65;
  else if (high === 14 && low === 12) equity = suited ? 0.66 : 0.64;
  else if (high === 14 && low === 11) equity = suited ? 0.65 : 0.63;
  else if (high === 14 && low === 10) equity = suited ? 0.63 : 0.61;
  else if (high === 13 && low === 12) equity = suited ? 0.63 : 0.61;
  else if (high === 13 && low === 11) equity = suited ? 0.62 : 0.60;
  else if (high === 12 && low === 11) equity = suited ? 0.60 : 0.58;

  return Math.min(Math.max(equity, 0.20), 0.90);
}

/**
 * Postflop牌力评估：结合成牌强度 + 听牌潜力
 * 返回 equity 估计值 0-1
 */
function getPostflopEquity(holeCards: Card[], communityCards: Card[], gs: GameState): number {
  // 评估当前成牌
  const evaluation = gameEngine.evaluateHand(holeCards, communityCards);
  const rankValue = evaluation.rankValue; // 1-10

  // 基础胜率（根据牌型）
  const baseEquity: Record<number, number> = {
    1: 0.20,  // 高牌
    2: 0.40,  // 一对
    3: 0.55,  // 两对
    4: 0.65,  // 三条
    5: 0.72,  // 顺子
    6: 0.78,  // 同花
    7: 0.85,  // 葫芦
    8: 0.92,  // 四条
    9: 0.97,  // 同花顺
    10: 0.99, // 皇家同花顺
  };
  let equity = baseEquity[rankValue] || 0.20;

  // 对子质量调整（顶对 vs 底对）
  if (rankValue === 2) {
    const RANK_VAL: Record<string, number> = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
      "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
    };
    // 检查是否是顶对（手牌与公共牌最大牌配对）
    const holeRanks = holeCards.map(c => RANK_VAL[c[0]] || 2);
    const communityRanks = communityCards.map(c => RANK_VAL[c[0]] || 2);
    const maxCommunityRank = Math.max(...communityRanks);
    const hasTopPair = holeRanks.some(r => r === maxCommunityRank);
    const hasOverpair = holeRanks[0] === holeRanks[1] && holeRanks[0] > maxCommunityRank;
    
    if (hasOverpair) equity = 0.55; // 超对
    else if (hasTopPair) {
      // 顶对质量取决于kicker
      const kicker = Math.max(...holeRanks.filter(r => r !== maxCommunityRank), 0);
      equity = kicker >= 12 ? 0.50 : kicker >= 9 ? 0.42 : 0.35;
    } else {
      equity = 0.28; // 中对/底对
    }
  }

  // 听牌加成（只在flop和turn时计算，因为river无听牌价值）
  if (communityCards.length < 5 && rankValue <= 2) {
    const outs = countOuts(holeCards, communityCards);
    // 每个out约增加2%胜率（flop到river约4%，turn到river约2%）
    const outMultiplier = communityCards.length === 3 ? 0.04 : 0.02;
    equity += outs * outMultiplier;
  }

  // 根据对手数量调整（多人底池胜率降低）
  const activePlayers = gs.players.filter(p => !p.isFolded && p.isActive).length;
  if (activePlayers > 2) {
    equity *= (1 - (activePlayers - 2) * 0.08); // 每多一个对手降低8%
  }

  return Math.min(Math.max(equity, 0.05), 0.99);
}

/**
 * 计算听牌数（outs）
 * 检查同花听牌、顺子听牌
 */
function countOuts(holeCards: Card[], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  const suits = allCards.map(c => c[1]);
  const RANK_VAL: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
  };
  const values = allCards.map(c => RANK_VAL[c[0]] || 2);
  let outs = 0;

  // 同花听牌：4张同花 = 9 outs
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  for (const count of Object.values(suitCounts)) {
    if (count === 4) { outs += 9; break; }
  }

  // 顺子听牌：两头听顺 = 8 outs，单头听顺 = 4 outs
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  for (let i = 1; i < uniqueValues.length; i++) {
    if (uniqueValues[i] - uniqueValues[i - 1] === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  // A也可以作为1用于A2345顺子
  if (uniqueValues.includes(14)) {
    const withAceLow = [1, ...uniqueValues.filter(v => v !== 14)].sort((a, b) => a - b);
    let tempConsec = 1;
    for (let i = 1; i < withAceLow.length; i++) {
      if (withAceLow[i] - withAceLow[i - 1] === 1) {
        tempConsec++;
        maxConsecutive = Math.max(maxConsecutive, tempConsec);
      } else {
        tempConsec = 1;
      }
    }
  }

  if (maxConsecutive === 4) {
    // 检查是否两头听顺（两端都可以接）
    // 简化：如果4连牌不包含A和不包含最低牌，则两头听顺
    const min4 = uniqueValues.find((_, i) => {
      if (i + 3 >= uniqueValues.length) return false;
      return uniqueValues[i + 3] - uniqueValues[i] === 3;
    });
    if (min4 && min4 > 2 && (min4 + 3) < 14) {
      outs += 8; // 两头听顺 (open-ended straight draw)
    } else {
      outs += 4; // 单头听顺 (gutshot)
    }
  } else if (maxConsecutive === 3) {
    // 3连牌，可能有单头听顺
    outs += 4; // gutshot
  }

  // 避免重复计算（同花顺子听牌重叠）
  if (outs > 15) outs = 15; // 封顶

  return outs;
}

/**
 * Bot AI 智能决策引擎
 * 基于手牌胜率(equity) vs 底池赔率(pot odds) 做出数学正确的决策
 * 同时加入位置、随机性、个性化因素让行为更像真人
 */
function decideBotAction(
  gs: GameState,
  player: typeof gs.players[0],
  bigBlind: number,
  config: BotConfig
): { action: PlayerAction; amount?: number } {
  const { currentBet, communityCards, pot, minRaise } = gs;
  const toCall = currentBet - player.currentBet;
  const canCheck = toCall <= 0;

  // === 计算手牌胜率 (equity) ===
  let equity: number;
  if (communityCards.length === 0) {
    // Preflop
    equity = getPreflopEquity(player.holeCards);
  } else {
    // Postflop
    equity = getPostflopEquity(player.holeCards, communityCards, gs);
  }

  // === 位置调整 ===
  // 后位加成（后位信息优势，可以稍微放宽）
  const totalPlayers = gs.players.filter(p => p.isActive).length;
  const positionFromDealer = (player.seatIndex - gs.dealerIndex + totalPlayers) % totalPlayers;
  const isLatePosition = positionFromDealer >= totalPlayers - 2; // 最后两个位置
  const isEarlyPosition = positionFromDealer <= 1; // 前两个位置
  
  if (isLatePosition) equity += 0.03; // 后位加成
  if (isEarlyPosition) equity -= 0.02; // 前位惩罚

  // === 个性化随机偏差（让每个bot风格不同） ===
  // 基于playerId生成稳定的偏差（同一个bot风格一致）
  const personalityBias = ((player.id * 7919) % 100) / 1000 - 0.05; // -0.05 ~ +0.05
  equity += personalityBias;

  // === 底池赔率计算 ===
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // === 决策逻辑 ===

  // 特殊情况：面对All-in
  const anyAllIn = gs.players.some(p => p.isAllIn && p.id !== player.id);
  if (anyAllIn) {
    // 面对All-in需要很强的牌才跟
    if (equity < 0.55) return { action: "fold" };
    if (equity >= 0.55) return { action: "call" };
  }

  // Preflop策略
  if (communityCards.length === 0) {
    return decidePreflopAction(equity, toCall, canCheck, pot, bigBlind, minRaise, player, isLatePosition);
  }

  // Postflop策略
  return decidePostflopAction(equity, potOdds, toCall, canCheck, pot, bigBlind, minRaise, player, gs);
}

/**
 * Preflop决策
 */
function decidePreflopAction(
  equity: number,
  toCall: number,
  canCheck: boolean,
  pot: number,
  bigBlind: number,
  minRaise: number,
  player: { chips: number; currentBet: number },
  isLatePosition: boolean
): { action: PlayerAction; amount?: number } {

  // 可以check（大盲位置无人加注）
  if (canCheck) {
    // 强牌加注 (equity >= 0.70)
    if (equity >= 0.70 && Math.random() < 0.65) {
      const raiseSize = bigBlind * (2.5 + Math.random() * 1.5); // 2.5-4x BB
      return makeRaise(raiseSize, minRaise, player);
    }
    // 中等牌偶尔加注
    if (equity >= 0.55 && Math.random() < 0.30) {
      const raiseSize = bigBlind * (2 + Math.random()); // 2-3x BB
      return makeRaise(raiseSize, minRaise, player);
    }
    return { action: "check" };
  }

  // 面对加注
  const bbMultiple = toCall / bigBlind;

  // 强牌 (equity >= 0.70): 跟注或反加
  if (equity >= 0.70) {
    // 40%概率反加
    if (Math.random() < 0.40 && bbMultiple < 15) {
      const raiseSize = toCall * (2.2 + Math.random() * 0.8); // 2.2-3x 当前注
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "call" };
  }

  // 中等牌 (equity 0.50-0.70)
  if (equity >= 0.50) {
    // 小注跟注（< 5BB）
    if (bbMultiple <= 5) return { action: "call" };
    // 中注看位置
    if (bbMultiple <= 10 && isLatePosition) return { action: "call" };
    // 大注有概率弃牌
    if (Math.random() < 0.4) return { action: "fold" };
    return { action: "call" };
  }

  // 较弱牌 (equity 0.38-0.50)
  if (equity >= 0.38) {
    // 小注且后位可以跟
    if (bbMultiple <= 3 && isLatePosition) return { action: "call" };
    // 小注偏向跟注
    if (bbMultiple <= 2 && Math.random() < 0.5) return { action: "call" };
    return { action: "fold" };
  }

  // 弱牌 (equity < 0.38)
  // 小注偶尔跟（偷鸡）
  if (bbMultiple <= 2 && isLatePosition && Math.random() < 0.15) {
    return { action: "call" };
  }
  return { action: "fold" };
}

/**
 * Postflop决策（基于equity vs pot odds）
 */
function decidePostflopAction(
  equity: number,
  potOdds: number,
  toCall: number,
  canCheck: boolean,
  pot: number,
  bigBlind: number,
  minRaise: number,
  player: { chips: number; currentBet: number },
  gs: GameState
): { action: PlayerAction; amount?: number } {

  // === 可以check的情况 ===
  if (canCheck) {
    // 强牌（equity >= 0.70）：下注获取价值
    if (equity >= 0.70) {
      // 60%概率下注，40%慢打（设套）
      if (Math.random() < 0.60) {
        const betSize = pot * (0.4 + Math.random() * 0.3); // 40-70% pot
        return makeRaise(betSize + player.currentBet, minRaise, player);
      }
      return { action: "check" }; // 慢打
    }

    // 中等牌 (equity 0.45-0.70): 偶尔下注
    if (equity >= 0.45) {
      if (Math.random() < 0.30) {
        const betSize = pot * (0.3 + Math.random() * 0.2); // 30-50% pot
        return makeRaise(betSize + player.currentBet, minRaise, player);
      }
      return { action: "check" };
    }

    // 弱牌：check（偶尔bluff）
    if (Math.random() < 0.08) {
      // 8%概率bluff
      const betSize = pot * (0.3 + Math.random() * 0.2);
      return makeRaise(betSize + player.currentBet, minRaise, player);
    }
    return { action: "check" };
  }

  // === 面对下注的情况 ===

  // 核心决策：equity > potOdds 则跟注有正EV
  const hasPositiveEV = equity > potOdds;

  // 强牌 (equity >= 0.65): 跟注或加注
  if (equity >= 0.65) {
    // 30%概率加注
    if (Math.random() < 0.30) {
      const raiseSize = toCall * 2.5 + pot * 0.3;
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "call" };
  }

  // 中等牌 (equity 0.40-0.65)
  if (equity >= 0.40) {
    if (hasPositiveEV) {
      // 正EV跟注
      return { action: "call" };
    }
    // 负微EV但跟注金额小，偶尔跟（隐含赔率）
    if (toCall <= bigBlind * 3 && Math.random() < 0.35) {
      return { action: "call" };
    }
    // 负大EV弃牌
    return { action: "fold" };
  }

  // 听牌手 (equity 0.25-0.40)
  if (equity >= 0.25) {
    if (hasPositiveEV) {
      // 底池赔率足够，跟注看牌
      return { action: "call" };
    }
    // 赔率不够但跟注小，偶尔跟
    if (toCall <= bigBlind * 2 && Math.random() < 0.20) {
      return { action: "call" };
    }
    return { action: "fold" };
  }

  // 空气牌 (equity < 0.25)
  // 偶尔bluff（小注时）
  if (toCall <= bigBlind * 2 && Math.random() < 0.05) {
    return { action: "call" }; // 偷鸡跟注
  }
  return { action: "fold" };
}

/**
 * 安全的加注操作（确保不超过筹码上限，不低于最小加注）
 */
function makeRaise(
  targetAmount: number,
  minRaise: number,
  player: { chips: number; currentBet: number }
): { action: PlayerAction; amount?: number } {
  const minRaiseTotal = player.currentBet + minRaise;
  // 永不超过60%筹码（模拟保守玩家，不All-in）
  const maxAllowed = player.chips * 0.6;
  let amount = Math.max(targetAmount, minRaiseTotal);
  amount = Math.min(amount, maxAllowed);
  
  // 如果计算出的加注量超过筹码或不合理，改为跟注
  if (amount >= player.chips || amount < minRaiseTotal) {
    return { action: "call" };
  }
  
  return { action: "raise", amount: Math.floor(amount * 100) / 100 };
}

// ==================== Bot筹码管理 ====================
/**
 * 为零筹码的bot补充筹码（从系统虚拟资金池）
 * 在startNewHand中调用，替代踢出零筹码bot
 */
export async function refillBotChips(roomId: number): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  const room = await db.getRoomById(roomId);
  if (!room) return;

  const botUserIds = await getBotUserIds();
  const roomPlayers = await db.getRoomPlayers(roomId);
  
  for (const rp of roomPlayers) {
    if (!botUserIds.includes(rp.userId)) continue;
    const chips = parseFloat(rp.chipCount as string);
    if (chips <= 0) {
      // 补充到最小买入
      const refillAmount = parseFloat(room.minBuyIn);
      await db.updateRoomPlayerChips(roomId, rp.userId, refillAmount.toFixed(2));
      console.log(`[BotManager] Refilled bot ${rp.userId} in room ${roomId} with $${refillAmount}`);
    }
  }
}

/**
 * 处理bot的结算：记录盈亏到每日统计
 * 在settleHand后调用
 */
export async function processBotSettlement(playerWinAmounts: Map<number, number>, players: { id: number; totalBet: number }[]): Promise<void> {
  const botUserIds = await getBotUserIds();
  
  for (const player of players) {
    if (!botUserIds.includes(player.id)) continue;
    
    const winAmount = playerWinAmounts.get(player.id) || 0;
    const netProfit = winAmount - player.totalBet;
    
    if (netProfit < 0) {
      // Bot亏损
      addBotLoss(Math.abs(netProfit));
    } else if (netProfit > 0) {
      // Bot赢钱（减少亏损记录）
      addBotWin(netProfit);
    }
  }
}

// ==================== 状态查询 ====================
export function getActiveBotsCount(): number {
  let count = 0;
  for (const [, bots] of seatedBots) {
    count += bots.size;
  }
  return count;
}

export function getBotsPerRoom(): Map<number, number> {
  const result = new Map<number, number>();
  for (const [roomId, bots] of seatedBots) {
    result.set(roomId, bots.size);
  }
  return result;
}

/**
 * 检查某个用户是否是bot
 */
export async function isBot(userId: number): Promise<boolean> {
  const botIds = await getBotUserIds();
  return botIds.includes(userId);
}

/**
 * 当bot离开桌子时清理状态
 */
export function onBotLeftTable(roomId: number, botId: number) {
  const bots = seatedBots.get(roomId);
  if (bots) {
    bots.delete(botId);
    if (bots.size === 0) seatedBots.delete(roomId);
  }
}

/**
 * 获取bot系统统计信息
 */
export async function getBotStats() {
  resetDailyLossIfNeeded();
  const config = await getBotConfig();
  return {
    enabled: config.enabled,
    dailyLoss: dailyLossTotal,
    dailyLossLimit: config.dailyLossLimit,
    activeBots: getActiveBotsCount(),
    botsPerRoom: Object.fromEntries(getBotsPerRoom()),
    config,
  };
}
