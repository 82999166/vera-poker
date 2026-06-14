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
    
    // 直接入座（bot不需要扣余额，使用系统虚拟资金池）
    const result = await joinTable(roomId, selectedBotId, buyIn);
    if (result.success) {
      // 记录bot入座
      if (!seatedBots.has(roomId)) seatedBots.set(roomId, new Set());
      seatedBots.get(roomId)!.add(selectedBotId);
      console.log(`[BotManager] Bot ${selectedBotId} joined room ${roomId} at seat ${result.seatIndex}`);
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

      // AI决策
      const decision = decideBotAction(currentGs, player, config);
      
      // 执行操作
      await processPlayerAction(roomId, player.id, decision.action, decision.amount);
    } catch (e) {
      console.error(`[BotManager] Error executing bot action in room ${roomId}:`, e);
    } finally {
      pendingActions.delete(actionKey);
    }
  }, delay);
}

/**
 * Bot AI 决策引擎
 * 策略：偏弱，高弃牌率，不跟大注，永不All-in
 */
function decideBotAction(
  gs: GameState,
  player: typeof gs.players[0],
  config: BotConfig
): { action: PlayerAction; amount?: number } {
  const { currentBet, communityCards, pot } = gs;
  const toCall = currentBet - player.currentBet;
  const canCheck = toCall <= 0;

  // 评估手牌强度（如果有公共牌）
  let handStrength = 0; // 0-10 scale
  if (communityCards.length >= 3 && player.holeCards.length === 2) {
    const evaluation = gameEngine.evaluateHand(player.holeCards, communityCards);
    handStrength = evaluation.rankValue; // 1-10
  } else if (player.holeCards.length === 2) {
    // Preflop: 简单评估起手牌强度
    handStrength = evaluatePreflopStrength(player.holeCards);
  }

  // === 核心策略 ===

  // 1. 面对大注（> 3x大盲）且手牌弱：高概率弃牌
  const bigBlind = gs.players.length >= 2 ? currentBet : 1; // 近似
  if (toCall > bigBlind * 3 && handStrength < 5) {
    // 90%弃牌
    if (Math.random() < 0.9) {
      return { action: "fold" };
    }
  }

  // 2. 面对All-in：除非手牌很强，否则弃牌
  const anyAllIn = gs.players.some(p => p.isAllIn && p.id !== player.id);
  if (anyAllIn && handStrength < 7) {
    return { action: "fold" };
  }

  // 3. 基础弃牌率判断
  if (!canCheck && Math.random() * 100 < config.foldRate) {
    // 但如果手牌很强(>=7)，降低弃牌概率
    if (handStrength < 7) {
      return { action: "fold" };
    }
  }

  // 4. 可以check时：大部分时间check，偶尔小额加注
  if (canCheck) {
    // 手牌强时偶尔加注（20%概率）
    if (handStrength >= 6 && Math.random() < 0.2) {
      const raiseAmount = Math.min(
        currentBet + gs.minRaise + Math.floor(Math.random() * gs.minRaise),
        player.chips * 0.3 // 永远不超过30%筹码
      );
      if (raiseAmount >= currentBet + gs.minRaise && raiseAmount < player.chips) {
        return { action: "raise", amount: Math.floor(raiseAmount * 100) / 100 };
      }
    }
    return { action: "check" };
  }

  // 5. 需要跟注：根据手牌强度和底池赔率决定
  const potOdds = toCall / (pot + toCall);
  
  // 手牌中等以上或底池赔率好：跟注
  if (handStrength >= 4 || potOdds < 0.25) {
    // 偶尔加注（手牌强时15%概率）
    if (handStrength >= 7 && Math.random() < 0.15) {
      const raiseAmount = currentBet + gs.minRaise + Math.floor(Math.random() * gs.minRaise * 2);
      // 永不超过50%筹码（模拟保守玩家）
      const maxRaise = player.chips * 0.5;
      if (raiseAmount <= maxRaise && raiseAmount < player.chips) {
        return { action: "raise", amount: Math.floor(raiseAmount * 100) / 100 };
      }
    }
    return { action: "call" };
  }

  // 6. 手牌弱但跟注金额小（< 2x大盲）：偶尔跟注
  if (toCall <= bigBlind * 2 && Math.random() < 0.3) {
    return { action: "call" };
  }

  // 默认弃牌
  return { action: "fold" };
}

/**
 * Preflop手牌强度简单评估 (0-10)
 */
function evaluatePreflopStrength(holeCards: Card[]): number {
  if (holeCards.length < 2) return 3;
  
  const RANK_VALUES: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
  };

  const r1 = RANK_VALUES[holeCards[0][0]] || 2;
  const r2 = RANK_VALUES[holeCards[1][0]] || 2;
  const suited = holeCards[0][1] === holeCards[1][1];
  const paired = r1 === r2;

  let strength = 0;

  // 对子
  if (paired) {
    strength = Math.min(3 + r1 / 2, 10); // AA=10, KK=9.5, 22=4
  } else {
    // 高牌值
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);
    strength = (high + low) / 5; // AK=5.4, 72=1.8
    
    // 同花加分
    if (suited) strength += 1;
    
    // 连牌加分
    if (Math.abs(r1 - r2) === 1) strength += 0.5;
    if (Math.abs(r1 - r2) === 2) strength += 0.25;
  }

  return Math.min(Math.max(strength, 1), 10);
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
