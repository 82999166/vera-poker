/**
 * AI 陪玩机器人管理器
 * 管理机器人的入座、离座、自动操作、余额监控
 * 机器人策略：基于概率计算的智能决策
 * 机器人作为真实玩家：余额扣除/返还、流水记录、代理佣金正常计算
 */
import * as db from "./db";
import * as gameEngine from "./gameEngine";
import { getTable, joinTable, processPlayerAction, playerReady } from "./tableManager";
import type { GameState, PlayerAction, Card } from "./gameEngine";
import { notifyAdmins } from "./notifications";

// ==================== 配置接口 ====================
interface BotConfig {
  enabled: boolean;
  maxPerTable: number;       // 每桌最多bot数
  minPerTable: number;       // 每桌最少bot数（无真人时）
  dailyLossLimit: number;    // 每日最大亏损（美元）
  foldRate: number;          // 弃牌率 (0-100)
  minActionDelay: number;    // 最小操作延迟(ms)
  maxActionDelay: number;    // 最大操作延迟(ms)
  balanceAlertThreshold: number; // 余额告警阈值（美元）
  autoRefillAmount: number;  // 自动补充金额（美元）
  autoRefillEnabled: boolean; // 是否开启自动补充
  fillWithoutRealPlayers: boolean; // 无真人时是否填充bot自动对玩
  persistentOnlineCount: number; // 长期在线bot总数（分散到各桌）
  rotationHands: number;     // 每桌打多少把后轮换bot（0=不轮换）
  displayOnlineBoost: number; // 大厅显示虚拟在线人数
  // 盈亏控制
  profitControlEnabled: boolean; // 是否启用盈亏控制
  targetEdge: number;        // 目标庄家优势 (0-100, 如5表示bot目标赢5%)
  maxWinStreak: number;      // 玩家最大连赢手数后收紧（0=不限）
}

// 房间级别Bot配置
interface RoomBotConfig {
  roomId: number;
  botCount: number;
  enabled: boolean;
  foldRate: number | null;
  minActionDelay: number | null;
  maxActionDelay: number | null;
}

// 默认配置
const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  maxPerTable: 5,
  minPerTable: 3,
  dailyLossLimit: 500,
  foldRate: 75,
  minActionDelay: 500,
  maxActionDelay: 1500,
  balanceAlertThreshold: 100,
  autoRefillAmount: 10000,
  autoRefillEnabled: true,
  fillWithoutRealPlayers: true,
  persistentOnlineCount: 0,
  rotationHands: 0,
  displayOnlineBoost: 0,
  profitControlEnabled: true,
  targetEdge: 5,
  maxWinStreak: 0,
};

// 房间级别配置缓存
let cachedRoomBotConfigs: Map<number, RoomBotConfig> = new Map();
let roomConfigsCachedAt = 0;
const ROOM_CONFIG_CACHE_TTL = 15000; // 15秒缓存

// Bot轮换跟踪：每个房间中每个bot已打手数
const botHandsPlayed = new Map<string, number>(); // key: "roomId:botId" -> hands played

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

// 盈亏控制：玩家连赢追踪 (userId -> 连续赢手数)
const playerWinStreaks = new Map<number, number>();
// 盈亏控制：当日bot总财务数据
let dailyBotTotalBet = 0;  // bot当日总下注
let dailyBotTotalWin = 0;  // bot当日总赢得

/**
 * 盈亏控制核心：根据当日盈亏状态计算equity调整值
 * 返回值 > 0 表示bot应该打得更紧（提高equity阈值，减少亏损）
 * 返回值 < 0 表示bot应该打得更松（降低equity阈值，让玩家赢一些）
 * 返回值 = 0 表示不调整
 * 
 * v2 优化：
 * - 修复了dailyLossTotal被钳制到0导致盈利分支永远不触发的bug
 * - 增强了targetEdge的控制力度，使用连续函数而非随意阈值
 * - 每手结算后的调整更平滑，避免突然变紧/变松
 */
function getProfitControlAdjustment(config: BotConfig, opponentId?: number): number {
  if (!config.profitControlEnabled) return 0;

  let adjustment = 0;

  // === 基于当日亏损上限调整（硬性保护） ===
  // dailyLossTotal > 0 表示bot当日亏损，< 0 表示bot当日盈利
  if (config.dailyLossLimit > 0) {
    const lossRatio = dailyLossTotal / config.dailyLossLimit;
    
    if (lossRatio >= 1.0) {
      // 已达亏损上限：极度收紧，几乎只打坚果牌
      adjustment += 0.30;
    } else if (lossRatio >= 0.8) {
      // 亏损已达80%上限：强力收紧
      adjustment += 0.20;
    } else if (lossRatio >= 0.5) {
      // 亏损50-80%：中度收紧（线性插值）
      adjustment += 0.08 + (lossRatio - 0.5) * 0.40; // 0.08 ~ 0.20
    } else if (lossRatio >= 0.2) {
      // 亏损20-50%：轻微收紧
      adjustment += (lossRatio - 0.2) * 0.27; // 0 ~ 0.08
    } else if (lossRatio <= -0.5) {
      // bot当日盈利超过亏损上限的50%：明显放松让玩家赢
      adjustment -= 0.12;
    } else if (lossRatio <= -0.3) {
      // bot当日盈利超过亏损上限的30%：放松
      adjustment -= 0.08;
    } else if (lossRatio <= -0.1) {
      // bot小幅盈利：轻微放松
      adjustment -= 0.04;
    }
  }

  // === 基于目标庄家优势调整（精细控制） ===
  // 目标：让bot的实际边际率趋近targetEdge
  // 例如targetEdge=10，表示bot目标赢10%的利润
  if (dailyBotTotalBet > 0) {
    const actualEdge = (dailyBotTotalWin - dailyBotTotalBet) / dailyBotTotalBet * 100;
    const targetEdge = config.targetEdge;
    const edgeDiff = actualEdge - targetEdge; // 正=bot赢太多，负=bot亏太多
    
    // 使用连续函数而非硬阈值，调整更平滑
    // edgeDiff每偏离1%，调整约0.012
    if (edgeDiff < 0) {
      // bot亏得比目标多：收紧（每偏离1%收紧0.015）
      const deficit = Math.abs(edgeDiff);
      adjustment += Math.min(deficit * 0.015, 0.20); // 最多收紧0.20
    } else if (edgeDiff > 0) {
      // bot赢得比目标多：放松（每偏离1%放松0.012）
      adjustment -= Math.min(edgeDiff * 0.012, 0.15); // 最多放松0.15
    }
  }

  // === 基于玩家连赢追踪调整 ===
  if (config.maxWinStreak > 0 && opponentId) {
    const streak = playerWinStreaks.get(opponentId) || 0;
    if (streak >= config.maxWinStreak) {
      // 玩家连赢超过阈值：逐步收紧
      const overStreak = streak - config.maxWinStreak;
      adjustment += 0.06 + Math.min(overStreak, 8) * 0.025; // 0.06 ~ 0.26
    }
  }

  // 封顶调整值：收紧最多0.35，放松最多0.18
  return Math.max(-0.18, Math.min(0.35, adjustment));
}

/**
 * 记录玩家赢牌（更新连赢追踪）
 */
export function recordPlayerWin(userId: number) {
  const current = playerWinStreaks.get(userId) || 0;
  playerWinStreaks.set(userId, current + 1);
}

/**
 * 记录玩家输牌（重置连赢）
 */
export function recordPlayerLoss(userId: number) {
  playerWinStreaks.set(userId, 0);
}

/**
 * 记录bot下注和赢得（用于计算实际边际率）
 */
export function recordBotBetAndWin(betAmount: number, winAmount: number) {
  resetDailyLossIfNeeded();
  dailyBotTotalBet += betAmount;
  dailyBotTotalWin += winAmount;
}

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
  const maxPerTable = await db.getConfigValue("bot_max_per_table", "5");
  const minPerTable = await db.getConfigValue("bot_min_per_table", "3");
  const dailyLossLimit = await db.getConfigValue("bot_daily_loss_limit", "500");
  const foldRate = await db.getConfigValue("bot_fold_rate", "75");
  const minDelay = await db.getConfigValue("bot_min_action_delay", "2000");
  const maxDelay = await db.getConfigValue("bot_max_action_delay", "5000");
  const balanceAlertThreshold = await db.getConfigValue("bot_balance_alert_threshold", "100");
  const autoRefillAmount = await db.getConfigValue("bot_auto_refill_amount", "10000");
  const autoRefillEnabled = await db.getConfigValue("bot_auto_refill_enabled", "true");
  const fillWithoutRealPlayers = await db.getConfigValue("bot_fill_without_real_players", "true");
  const persistentOnlineCount = await db.getConfigValue("bot_persistent_online_count", "0");
  const rotationHands = await db.getConfigValue("bot_rotation_hands", "0");
  const displayOnlineBoost = await db.getConfigValue("bot_display_online_boost", "0");
  const profitControlEnabled = await db.getConfigValue("bot_profit_control_enabled", "true");
  const targetEdge = await db.getConfigValue("bot_target_edge", "5");
  const maxWinStreak = await db.getConfigValue("bot_max_win_streak", "0");

  cachedConfig = {
    enabled: enabled === "true",
    maxPerTable: parseInt(maxPerTable) || DEFAULT_CONFIG.maxPerTable,
    minPerTable: parseInt(minPerTable) || DEFAULT_CONFIG.minPerTable,
    dailyLossLimit: dailyLossLimit !== "" && !isNaN(parseFloat(dailyLossLimit)) ? parseFloat(dailyLossLimit) : DEFAULT_CONFIG.dailyLossLimit,
    foldRate: parseInt(foldRate) || DEFAULT_CONFIG.foldRate,
    minActionDelay: parseInt(minDelay) || DEFAULT_CONFIG.minActionDelay,
    maxActionDelay: parseInt(maxDelay) || DEFAULT_CONFIG.maxActionDelay,
    balanceAlertThreshold: parseFloat(balanceAlertThreshold) || DEFAULT_CONFIG.balanceAlertThreshold,
    autoRefillAmount: parseFloat(autoRefillAmount) || DEFAULT_CONFIG.autoRefillAmount,
    autoRefillEnabled: autoRefillEnabled === "true",
    fillWithoutRealPlayers: fillWithoutRealPlayers === "true",
    persistentOnlineCount: parseInt(persistentOnlineCount) || 0,
    rotationHands: parseInt(rotationHands) || 0,
    displayOnlineBoost: parseInt(displayOnlineBoost) || 0,
    profitControlEnabled: profitControlEnabled === "true",
    targetEdge: targetEdge !== "" && !isNaN(parseFloat(targetEdge)) ? parseFloat(targetEdge) : DEFAULT_CONFIG.targetEdge,
    maxWinStreak: parseInt(maxWinStreak) || 0,
  };
  configCachedAt = now;
  return cachedConfig;
}

/**
 * 获取房间级别的Bot配置（带缓存）
 */
export async function getRoomBotConfig(roomId: number): Promise<RoomBotConfig | null> {
  const now = Date.now();
  if (now - roomConfigsCachedAt < ROOM_CONFIG_CACHE_TTL && cachedRoomBotConfigs.has(roomId)) {
    return cachedRoomBotConfigs.get(roomId)!;
  }
  // 刷新全部房间配置缓存
  await refreshRoomBotConfigs();
  return cachedRoomBotConfigs.get(roomId) || null;
}

async function refreshRoomBotConfigs() {
  const configs = await db.getAllRoomBotConfigs();
  cachedRoomBotConfigs = new Map();
  for (const c of configs) {
    cachedRoomBotConfigs.set(c.roomId, {
      roomId: c.roomId,
      botCount: c.botCount,
      enabled: c.enabled,
      foldRate: c.foldRate,
      minActionDelay: c.minActionDelay,
      maxActionDelay: c.maxActionDelay,
    });
  }
  roomConfigsCachedAt = Date.now();
}

export function invalidateRoomConfigCache() {
  roomConfigsCachedAt = 0;
  cachedRoomBotConfigs.clear();
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
  const { eq, and, ne } = await import("drizzle-orm");
  // Exclude frozen/banned bots (disabled by admin via toggleBots)
  const bots = await dbInstance.select({ id: users.id }).from(users)
    .where(and(eq(users.isBot, true), ne(users.riskLevel, "frozen"), ne(users.riskLevel, "banned")));
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
    dailyBotTotalBet = 0;
    dailyBotTotalWin = 0;
    playerWinStreaks.clear();
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

// Bot赢钱时减少亏损记录（允许负值表示当日盈利）
export function addBotWin(amount: number) {
  resetDailyLossIfNeeded();
  dailyLossTotal -= amount;
  // 不再钳制到0，允许负值表示bot当日盈利，这样盈亏控制才能在bot赢太多时放松
}

// 直接重置每日亏损计数器为0
export function resetDailyLossCounter() {
  dailyLossTotal = 0;
  dailyBotTotalBet = 0;
  dailyBotTotalWin = 0;
  playerWinStreaks.clear();
}

// ==================== Bot入座逻辑 ====================
/**
 * 检查房间是否需要bot填充，并执行入座
 * 调度策略：
 * 1. 优先使用房间级别配置（room_bot_config）的botCount
 * 2. 无房间配置时，根据全局配置动态调整
 * 3. 每次只加一个bot（防止瞬间涌入太多）
 */
export async function checkAndFillBots(roomId: number, calledFromStartNewHand = false): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  // 关键保护：如果有活跃游戏正在进行中，且不是从startNewHand调用的，
  // 则不添加/移除bot，避免DB和内存状态不同步导致前端玩家列表跳动
  const existingTable = getTable(roomId);
  if (existingTable && !calledFromStartNewHand) {
    return;
  }

  // 检查每日亏损限制
  resetDailyLossIfNeeded();
  if (dailyLossTotal >= config.dailyLossLimit) return;

  // 获取房间信息
  const room = await db.getRoomById(roomId);
  if (!room || room.type !== "public") return; // 只在公共房间添加bot

  // 检查房间级别配置
  const roomConfig = await getRoomBotConfig(roomId);
  if (roomConfig && !roomConfig.enabled) return; // 该房间禁用bot

  // 获取当前在座玩家（包含sitting_out，确保不抢占观战玩家座位）
  const roomPlayers = await db.getRoomPlayersAll(roomId);
  const botUserIds = await getBotUserIds();

  // 统计真实玩家和bot玩家
  const realPlayers = roomPlayers.filter((rp: any) => !botUserIds.includes(rp.userId));
  const botsAtTable = roomPlayers.filter((rp: any) => botUserIds.includes(rp.userId));

  // 计算目标bot数量
  let targetBotCount: number;
  
  if (roomConfig) {
    // 使用房间级别配置的botCount作为上限，但不能超过maxPlayers-1（给真人预留1个座位）
    targetBotCount = Math.min(roomConfig.botCount, room.maxPlayers - 1);
  } else {
    // 未配置独立bot的房间，使用全局minPerTable作为目标bot数
    targetBotCount = Math.min(config.minPerTable, room.maxPlayers - 1);
  }

  // 无真人时，根据fillWithoutRealPlayers配置决定是否填充bot
  if (realPlayers.length === 0 && !config.fillWithoutRealPlayers) return;

  // 如果bot超过目标数量，移除多余的bot
  if (botsAtTable.length > targetBotCount) {
    const excessCount = botsAtTable.length - targetBotCount;
    const botsToRemove = botsAtTable.slice(0, excessCount);
    for (const bot of botsToRemove) {
      try {
        // 返还筹码并移除
        const rp = roomPlayers.find((p: any) => p.userId === bot.userId);
        if (rp) {
          const chips = parseFloat(rp.chipCount);
          if (chips > 0) {
            await db.addUserBalanceAtomic(bot.userId, chips);
          }
          await db.removeRoomPlayer(roomId, bot.userId);
          seatedBots.get(roomId)?.delete(bot.userId);
          console.log(`[BotManager] Removed excess bot ${bot.userId} from room ${roomId} (exceeded target count)`);
        }
      } catch (e) {
        console.error(`[BotManager] Error removing excess bot:`, e);
      }
    }
    return;
  }

  // 已达到目标数量
  if (botsAtTable.length >= targetBotCount) return;

  // 检查桌子是否满了
  if (roomPlayers.length >= room.maxPlayers) return;

  // 选择一个可用的bot（不在任何桌上的）
  const allSeatedBotIds = new Set<number>();
  for (const [, bots] of seatedBots) {
    for (const id of bots) allSeatedBotIds.add(id);
  }
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
    const buyIn = parseFloat(room.minBuyIn);
    const botUser = await db.getUserById(selectedBotId);
    if (!botUser) return;
    
    let currentBalance = parseFloat(String(botUser.balance));
    if (currentBalance < buyIn) {
      const refilled = await autoRefillBotBalance(selectedBotId, buyIn);
      if (!refilled) {
        console.log(`[BotManager] Bot ${selectedBotId} insufficient balance and refill failed, skipping`);
        return;
      }
      const updatedUser = await db.getUserById(selectedBotId);
      if (!updatedUser) return;
      currentBalance = parseFloat(String(updatedUser.balance));
      if (currentBalance < buyIn) return;
    }

    const newBalance = await db.deductUserBalanceAtomic(selectedBotId, buyIn);
    if (newBalance === null) {
      console.log(`[BotManager] Bot ${selectedBotId} balance deduction failed, skipping`);
      return;
    }

    // 检查是否有活跃游戏会话
    const existingTable = getTable(roomId);
    
    if (existingTable) {
      // 有活跃游戏：直接将bot作为active状态加入，绕过joinTable的activeTables检查
      // joinTable会在游戏进行中将新玩家标记为sitting_out，但bot在startNewHand中
      // 被调用时需要立即作为active参与游戏
      const existingPlayers = await db.getRoomPlayersAll(roomId);
      const takenSeats = new Set(existingPlayers.map((p: any) => p.seatIndex));
      let seatIndex = -1;
      // Bot入座跳过seat 0，保留给真人玩家
      for (let i = 1; i < room.maxPlayers; i++) {
        if (!takenSeats.has(i)) {
          seatIndex = i;
          break;
        }
      }
      // 只有当seat 1-5全满时才用seat 0
      if (seatIndex === -1 && !takenSeats.has(0)) {
        seatIndex = 0;
      }
      if (seatIndex === -1) {
        await db.addUserBalanceAtomic(selectedBotId, buyIn);
        return;
      }
      const added = await db.addRoomPlayer(roomId, selectedBotId, seatIndex, buyIn.toString());
      if (!added) {
        // Seat conflict or DB error, refund buy-in
        await db.addUserBalanceAtomic(selectedBotId, buyIn);
        console.warn(`[BotManager] Failed to add bot ${selectedBotId} to room ${roomId} at seat ${seatIndex}`);
        return;
      }
      await db.updateRoom(roomId, { currentPlayers: existingPlayers.length + 1 });
      await db.createTransaction({
        userId: selectedBotId,
        type: "buy_in",
        amount: buyIn.toFixed(2),
        balanceBefore: String(currentBalance),
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: roomId,
        note: `买入房间 ${room.name || roomId}`,
      });
      if (!seatedBots.has(roomId)) seatedBots.set(roomId, new Set());
      seatedBots.get(roomId)!.add(selectedBotId);
      console.log(`[BotManager] Bot ${selectedBotId} joined room ${roomId} at seat ${seatIndex}`);

      // If table is in waitingForReady state (no active game), check if we now have enough players to start
      if (existingTable.waitingForReady) {
        const activePlayers = await db.getRoomPlayers(roomId);
        if (activePlayers.length >= 2) {
          console.log(`[BotManager] Table ${roomId} has ${activePlayers.length} active players in waitingForReady state, triggering startNewHand`);
          const { startNewHand } = await import("./tableManager");
          await startNewHand(roomId);
        }
      }
    } else {
      // 没有活跃游戏：使用joinTable（会自动触发startNewHand）
      const result = await joinTable(roomId, selectedBotId, buyIn);
      if (result.success) {
        await db.createTransaction({
          userId: selectedBotId,
          type: "buy_in",
          amount: buyIn.toFixed(2),
          balanceBefore: String(currentBalance),
          balanceAfter: newBalance,
          status: "confirmed",
          referenceType: "room",
          referenceId: roomId,
          note: `买入房间 ${room.name || roomId}`,
        });
        if (!seatedBots.has(roomId)) seatedBots.set(roomId, new Set());
        seatedBots.get(roomId)!.add(selectedBotId);
        console.log(`[BotManager] Bot ${selectedBotId} joined room ${roomId} at seat ${result.seatIndex}`);
      } else {
        await db.addUserBalanceAtomic(selectedBotId, buyIn);
      }
    }
  } catch (e) {
    console.error(`[BotManager] Error adding bot to room ${roomId}:`, e);
  } finally {
    joiningBots.delete(joinKey);
  }
}

/**
 * 长期在线Bot调度器
 * 根据 persistentOnlineCount 配置，确保总共有N个bot分散在各个公共牌桌上
 * 每30秒执行一次，检查并补充bot到目标数量
 */
export async function persistentBotScheduler(): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled || config.persistentOnlineCount <= 0) return;

  // 检查每日亏损限制
  resetDailyLossIfNeeded();
  if (dailyLossTotal >= config.dailyLossLimit) return;

  // 获取所有公共房间
  const publicRooms = await db.getPublicRooms();
  if (publicRooms.length === 0) return;

  const botUserIds = await getBotUserIds();
  
  // 统计当前在线的bot总数
  const currentOnlineCount = getActiveBotsCount();
  const target = config.persistentOnlineCount;

  if (currentOnlineCount >= target) return;

  // 需要补充的bot数量
  const needed = target - currentOnlineCount;

  // 将bot分散到各个房间
  // 每次补充最多3个，加速填充空房间
  for (let i = 0; i < Math.min(needed, 3); i++) {
    // 找到填充率最低的房间（按比例分配，而非绝对数量）
    let bestRoom: typeof publicRooms[0] | null = null;
    let lowestFillRatio = 1.0; // 1.0 = 已满
    for (const room of publicRooms) {
      const roomConfig = await getRoomBotConfig(room.id);
      // 有房间配置但被禁用的房间跳过
      if (roomConfig && !roomConfig.enabled) continue;
      const botsInRoom = seatedBots.get(room.id)?.size || 0;
      // 有房间配置用房间配置的botCount，没有则用全局minPerTable
      const maxAllowed = roomConfig ? roomConfig.botCount : Math.min(config.minPerTable, room.maxPlayers - 1);
      // 实际上限不能超过房间最大玩家数-1
      const effectiveMax = Math.min(maxAllowed, room.maxPlayers - 1);
      if (effectiveMax <= 0) continue;
      // 检查该房间是否有真人玩家（无真人时根据fillWithoutRealPlayers配置决定）
      const roomPlayers = await db.getRoomPlayers(room.id);
      const realCount = roomPlayers.filter((rp: any) => !botUserIds.includes(rp.userId)).length;
      if (realCount === 0 && !config.fillWithoutRealPlayers) continue;
      const fillRatio = botsInRoom / effectiveMax;
      if (fillRatio < 1.0 && fillRatio < lowestFillRatio) {
        lowestFillRatio = fillRatio;
        bestRoom = room;
      }
    }
    if (bestRoom) {
      await checkAndFillBots(bestRoom.id);
    }
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

// ==================== Bot轮换逻辑 ====================
/**
 * 记录bot在某房间打了一手，并检查是否需要轮换
 * 在每手结算后调用
 */
export async function trackBotHandAndRotate(roomId: number, botIdsInHand: number[]): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled || config.rotationHands <= 0) return;

  const botsToRotate: number[] = [];
  
  for (const botId of botIdsInHand) {
    const key = `${roomId}:${botId}`;
    const current = (botHandsPlayed.get(key) || 0) + 1;
    botHandsPlayed.set(key, current);
    
    if (current >= config.rotationHands) {
      botsToRotate.push(botId);
      botHandsPlayed.delete(key);
    }
  }
  
  if (botsToRotate.length === 0) return;
  
  // 轮换：每手最多只移除1个bot，避免座位大幅变动导致前端跳动
  const roomBots = seatedBots.get(roomId);
  const botToRotate = botsToRotate[0]; // 只轮换第一个
  // 其余bot重置计数（下一手再轮换）
  for (let i = 1; i < botsToRotate.length; i++) {
    const key = `${roomId}:${botsToRotate[i]}`;
    botHandsPlayed.set(key, config.rotationHands - 1); // 下一手就轮换
  }

  try {
    await db.removeRoomPlayer(roomId, botToRotate);
    roomBots?.delete(botToRotate);
    console.log(`[BotManager] Rotated bot ${botToRotate} out of room ${roomId} after ${config.rotationHands} hands`);
  } catch (e) {
    console.error(`[BotManager] Error rotating bot ${botToRotate} from room ${roomId}:`, e);
  }
  
  // 更新房间人数
  const remaining = await db.getRoomPlayers(roomId);
  await db.updateRoom(roomId, { currentPlayers: remaining.length });
}

/**
 * 获取bot轮换状态（用于管理后台显示）
 */
export function getBotRotationStatus(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, hands] of botHandsPlayed) {
    result[key] = hands;
  }
  return result;
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

  // 获取房间级别配置（可能覆盖全局配置）
  const roomConfig = await getRoomBotConfig(roomId);
  const effectiveMinDelay = roomConfig?.minActionDelay ?? config.minActionDelay;
  const effectiveMaxDelay = roomConfig?.maxActionDelay ?? config.maxActionDelay;

  // 随机延迟
  const delay = effectiveMinDelay + Math.random() * (effectiveMaxDelay - effectiveMinDelay);

  setTimeout(async () => {
    try {
      const currentTable = getTable(roomId);
      if (!currentTable) return;
      const currentGs = currentTable.gameState;
      if (currentGs.phase === "waiting" || currentGs.phase === "completed" || currentGs.phase === "showdown") return;
      
      const player = currentGs.players[currentGs.currentPlayerIndex];
      if (!player || player.id !== currentPlayer.id) return;

      // AI决策（使用房间级别foldRate或全局foldRate）
      const effectiveConfig = { ...config };
      if (roomConfig?.foldRate !== null && roomConfig?.foldRate !== undefined) {
        effectiveConfig.foldRate = roomConfig.foldRate;
      }
      // 盈亏控制：找到对手真人玩家ID（用于连赢追踪）
      const botIds = await getBotUserIds();
      const realOpponent = currentGs.players.find(p => p.isActive && !p.isFolded && !botIds.includes(p.id));
      const opponentId = realOpponent?.id;
      const decision = decideBotAction(currentGs, player, currentTable.bigBlind, effectiveConfig, opponentId);
      
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
  config: BotConfig,
  opponentId?: number
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

  // === 个性化风格（让每个bot风格不同，更像真人） ===
  // 基于playerId生成稳定的偏差（同一个bot风格一致）
  const personalityBias = ((player.id * 7919) % 100) / 1000 - 0.05; // -0.05 ~ +0.05
  equity += personalityBias;
  
  // 随机波动（模拟真人的不稳定性，每手都有小幅随机偏差）
  const handNoise = (Math.random() - 0.5) * 0.06; // -0.03 ~ +0.03
  equity += handNoise;

  // === 底池赔率计算 ===
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // === 模拟真人“情绪”影响（tilt效应） ===
  // 如果bot刚输了大底池，有小概率会打得更激进（模拟上头）
  // 这个效应通过dailyLossTotal间接体现：亏损多时收紧已经处理
  // 但添加少量随机激进行为让bot更像真人
  if (dailyLossTotal > 0 && Math.random() < 0.05) {
    // 5%概率“上头”：临时放松一下（反向调整）
    equity += 0.05;
  }

  // === 弃牌率配置调整 ===
  // foldRate 67 = 默认（不调整），> 67 = 更容易弃牌（equity阈值上调），< 67 = 更激进（equity阈值下调）
  const foldAdjust = (config.foldRate - 67) / 100; // 例如 foldRate=80 → +0.13, foldRate=50 → -0.17
  equity -= foldAdjust; // foldRate越高，有效equity越低，越容易弃牌

  // === 盈亏控制动态调整 ===
  // 根据当日盈亏状态动态调整bot策略松紧度
  const profitAdj = getProfitControlAdjustment(config, opponentId);
  equity -= profitAdj; // 正调整 = 降低equity = bot更容易fold = 减少亏损

  // === 决策逻辑 ===

  // 特殊情况：面对All-in
  const anyAllIn = gs.players.some(p => p.isAllIn && p.id !== player.id);
  if (anyAllIn) {
    // 面对All-in需要非常强的牍才跟（收紧阈值）
    if (equity < 0.62) return { action: "fold" };
    return { action: "call" };
  }

  // Preflop策略
  if (communityCards.length === 0) {
    return decidePreflopAction(equity, toCall, canCheck, pot, bigBlind, minRaise, player, isLatePosition);
  }

  // Postflop策略
  return decidePostflopAction(equity, potOdds, toCall, canCheck, pot, bigBlind, minRaise, player, gs);
}

/**
 * Preflop决策 - v2 更像真人
 * 特点：变化的加注尺寸、偶尔的偷鸡加注、位置意识更强
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
    // 强牌加注 (equity >= 0.72)
    if (equity >= 0.72) {
      // 60%概率加注，40%慢打（设套）
      if (Math.random() < 0.60) {
        // 变化的加注尺寸（2.2-4.5x BB）
        const raiseSize = bigBlind * (2.2 + Math.random() * 2.3);
        return makeRaise(raiseSize, minRaise, player);
      }
      return { action: "check" }; // 慢打
    }
    // 中等牌偶尔加注（后位更积极）
    if (equity >= 0.55) {
      const raiseProb = isLatePosition ? 0.30 : 0.12;
      if (Math.random() < raiseProb) {
        const raiseSize = bigBlind * (2 + Math.random() * 1.5); // 2-3.5x BB
        return makeRaise(raiseSize, minRaise, player);
      }
      return { action: "check" };
    }
    // 弱牌后位偶尔偷鸡加注（模拟真人的位置偷盗）
    if (isLatePosition && Math.random() < 0.06) {
      const raiseSize = bigBlind * (2 + Math.random());
      return makeRaise(raiseSize, minRaise, player);
    }
    return { action: "check" };
  }

  // 面对加注
  const bbMultiple = toCall / bigBlind;

  // 强牌 (equity >= 0.72): 跟注或反加
  if (equity >= 0.72) {
    // 35%概率反加（真人会更积极）
    if (Math.random() < 0.35 && bbMultiple < 15) {
      // 变化的反加尺寸（2.2-3x 当前注）
      const raiseMulti = 2.2 + Math.random() * 0.8;
      const raiseSize = toCall * raiseMulti;
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "call" };
  }

  // 中等牌 (equity 0.52-0.72)
  if (equity >= 0.52) {
    // 小注跟注（< 3BB）
    if (bbMultiple <= 3) return { action: "call" };
    // 中注看位置（< 6BB 后位跟）
    if (bbMultiple <= 6 && isLatePosition) return { action: "call" };
    // 后位偶尔反加（模拟真人的位置反击）
    if (isLatePosition && bbMultiple <= 4 && Math.random() < 0.12) {
      const raiseSize = toCall * (2.5 + Math.random() * 0.5);
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    // 大注大概率弃牌
    if (bbMultiple > 6 && Math.random() < 0.65) return { action: "fold" };
    return { action: "call" };
  }

  // 较弱牌 (equity 0.40-0.52)
  if (equity >= 0.40) {
    // 小注且后位可以跟
    if (bbMultiple <= 2.5 && isLatePosition) return { action: "call" };
    // 极小注偶尔跟
    if (bbMultiple <= 1.5 && Math.random() < 0.25) return { action: "call" };
    return { action: "fold" };
  }

  // 弱牌 (equity < 0.40)
  // 后位极小注偶尔跟（模拟真人好奇心）
  if (bbMultiple <= 1.5 && isLatePosition && Math.random() < 0.10) {
    return { action: "call" };
  }
  // 极少概率偷鸡加注（后位对小注）
  if (bbMultiple <= 2 && isLatePosition && Math.random() < 0.04) {
    const raiseSize = toCall * (2.5 + Math.random());
    return makeRaise(raiseSize + player.currentBet, minRaise, player);
  }
  return { action: "fold" };
}

/**
 * Postflop决策 - v2 更像真人
 * 特点：变化的下注尺寸、更多慢打和bluff、基于街面纹理的决策
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

  // 街面阶段影响决策（真人在不同街面策略不同）
  const street = gs.communityCards.length; // 3=flop, 4=turn, 5=river
  const isRiver = street === 5;
  const isTurn = street === 4;

  // === 可以check的情况 ===
  if (canCheck) {
    // 强牌（equity >= 0.72）：下注获取价值或慢打
    if (equity >= 0.72) {
      // river更应该下注获取价值，flop可以慢打
      const betProb = isRiver ? 0.70 : (isTurn ? 0.55 : 0.45);
      if (Math.random() < betProb) {
        // 变化的下注尺寸（真人不会总是下同样的比例）
        const sizeFactor = 0.30 + Math.random() * 0.40; // 30-70% pot
        const betSize = pot * sizeFactor;
        return makeRaise(betSize + player.currentBet, minRaise, player);
      }
      return { action: "check" }; // 慢打
    }

    // 中等牌 (equity 0.48-0.72): 偶尔下注
    if (equity >= 0.48) {
      // 后街下注概率更高（真人在turn/river会更积极地保护手牌）
      const betProb = isRiver ? 0.25 : (isTurn ? 0.22 : 0.15);
      if (Math.random() < betProb) {
        const sizeFactor = 0.25 + Math.random() * 0.25; // 25-50% pot
        const betSize = pot * sizeFactor;
        return makeRaise(betSize + player.currentBet, minRaise, player);
      }
      return { action: "check" };
    }

    // 弱牌：偶尔bluff（真人会在可怕的牌面偷鸡）
    // bluff概率根据街面变化：river更容易bluff（因为对手不能再看牌）
    const bluffProb = isRiver ? 0.08 : (isTurn ? 0.05 : 0.03);
    if (Math.random() < bluffProb) {
      // bluff用较大的尺寸（真人偷鸡会下大注）
      const sizeFactor = 0.45 + Math.random() * 0.30; // 45-75% pot
      const betSize = pot * sizeFactor;
      return makeRaise(betSize + player.currentBet, minRaise, player);
    }
    return { action: "check" };
  }

  // === 面对下注的情况 ===

  // 核心决策：equity > potOdds 则跟注有正EV
  const hasPositiveEV = equity > potOdds;
  // 跟注占底池比例（真人会考虑这个）
  const callToPotRatio = toCall / Math.max(pot, 1);

  // 强牌 (equity >= 0.70): 跟注或加注
  if (equity >= 0.70) {
    // 加注概率根据街面变化（river加注更多）
    const raiseProb = isRiver ? 0.30 : (isTurn ? 0.22 : 0.18);
    if (Math.random() < raiseProb) {
      // 变化的加注尺寸
      const raiseMulti = 2.0 + Math.random() * 1.0; // 2-3x
      const raiseSize = toCall * raiseMulti + pot * (0.1 + Math.random() * 0.15);
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "call" };
  }

  // 中等牌 (equity 0.42-0.70)
  if (equity >= 0.42) {
    if (hasPositiveEV && callToPotRatio <= 0.5) {
      // 正EV且跟注不超过半池：跟注
      return { action: "call" };
    }
    if (hasPositiveEV && callToPotRatio <= 0.8) {
      // 正EV但跟注较大：根据街面和equity决定
      const callProb = equity > 0.55 ? 0.60 : 0.35;
      if (Math.random() < callProb) return { action: "call" };
      return { action: "fold" };
    }
    // 负微EV但跟注金额小，偶尔跟（隐含赔率）
    if (callToPotRatio <= 0.25 && Math.random() < 0.30) {
      return { action: "call" };
    }
    // 偶尔bluff加注（真人会在中等牌力时反打）
    if (callToPotRatio <= 0.4 && Math.random() < 0.06) {
      const raiseSize = toCall * (2.2 + Math.random() * 0.8);
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "fold" };
  }

  // 听牌手 (equity 0.25-0.42)
  if (equity >= 0.25) {
    if (hasPositiveEV && callToPotRatio <= 0.30) {
      // 底池赔率足够且跟注小：跟注看牌
      return { action: "call" };
    }
    // 偶尔半赌性跟注（真人有时会“感觉”跟一下）
    if (callToPotRatio <= 0.20 && Math.random() < 0.12) {
      return { action: "call" };
    }
    // 极少概率bluff加注（半偷鸡，真人会偶尔这么做）
    if (!isRiver && callToPotRatio <= 0.35 && Math.random() < 0.03) {
      const raiseSize = toCall * 2.5 + pot * 0.3;
      return makeRaise(raiseSize + player.currentBet, minRaise, player);
    }
    return { action: "fold" };
  }

  // 空气牌 (equity < 0.25)
  // 极少跟注，但偶尔bluff（真人会在绝望时偷鸡）
  if (callToPotRatio <= 0.15 && Math.random() < 0.04) {
    return { action: "call" }; // 极少的好奇心跟注
  }
  // river上的绝望偷鸡（真人会在最后一张牌尝试偷鸡）
  if (isRiver && Math.random() < 0.04) {
    const bluffSize = pot * (0.55 + Math.random() * 0.35); // 55-90% pot
    return makeRaise(bluffSize + player.currentBet, minRaise, player);
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
  // 永不超过40%筹码（更保守，防止大注和all-in）
  const maxAllowed = player.chips * 0.4;
  let amount = Math.max(targetAmount, minRaiseTotal);
  amount = Math.min(amount, maxAllowed);
  
  // 如果计算出的加注量超过筹码或不合理，改为跟注
  if (amount >= player.chips || amount < minRaiseTotal) {
    return { action: "call" };
  }
  
  // 额外保护：如果raise金额超过30%筹码，有概率改为call（避免过大下注）
  if (amount > player.chips * 0.3 && Math.random() < 0.4) {
    return { action: "call" };
  }
  
  return { action: "raise", amount: Math.floor(amount * 100) / 100 };
}

// ==================== Bot筹码管理 ====================
/**
 * 为零筹码的bot补充筹码（从账户余额扣除，和真实玩家rebuy一样）
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
      const refillAmount = parseFloat(room.minBuyIn);
      
      // 检查余额是否足够，不足则尝试自动补充
      const botUser = await db.getUserById(rp.userId);
      if (!botUser) continue;
      let balance = parseFloat(String(botUser.balance));
      if (balance < refillAmount) {
        const refilled = await autoRefillBotBalance(rp.userId, refillAmount);
        if (!refilled) continue;
        const updated = await db.getUserById(rp.userId);
        if (!updated) continue;
        balance = parseFloat(String(updated.balance));
        if (balance < refillAmount) continue;
      }

      // 扣除余额
      const newBalance = await db.deductUserBalanceAtomic(rp.userId, refillAmount);
      if (newBalance === null) continue;

      // 补充筹码
      await db.updateRoomPlayerChips(roomId, rp.userId, refillAmount.toFixed(2));
      
      // 记录流水
      await db.createTransaction({
        userId: rp.userId,
        type: "rebuy",
        amount: refillAmount.toFixed(2),
        balanceBefore: String(balance),
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: roomId,
        note: `Bot自动补码 房间${room.name || roomId}`,
      });
      console.log(`[BotManager] Refilled bot ${rp.userId} in room ${roomId} with $${refillAmount}`);
    }
  }
}

// ==================== 余额自动补充 ====================
/**
 * 自动补充bot余额（当余额不足时）
 * 通过系统调整方式补充（记录为adjustment交易）
 */
async function autoRefillBotBalance(botId: number, minRequired: number): Promise<boolean> {
  const config = await getBotConfig();
  if (!config.autoRefillEnabled) return false;

  const botUser = await db.getUserById(botId);
  if (!botUser) return false;

  const currentBalance = parseFloat(String(botUser.balance));
  if (currentBalance >= minRequired) return true; // 已经足够

  const refillAmount = config.autoRefillAmount;
  
  // 系统补充（直接增加余额）
  await db.addUserBalanceAtomic(botId, refillAmount);
  
  // 记录补充流水
  await db.createTransaction({
    userId: botId,
    type: "adjustment",
    amount: refillAmount.toFixed(2),
    balanceBefore: String(currentBalance),
    balanceAfter: (currentBalance + refillAmount).toFixed(2),
    status: "confirmed",
    referenceType: "room",
    referenceId: 0,
    note: `Bot自动补充余额 (系统)`,
  });

  console.log(`[BotManager] Auto-refilled bot ${botId} with $${refillAmount}`);
  return true;
}

// ==================== 余额监控告警 ====================
// 告警冷却时间（避免重复告警）
let lastAlertTime = 0;
const ALERT_COOLDOWN = 3600000; // 1小时

/**
 * 检查所有bot余额，低于阈值时发送告警
 */
export async function checkBotBalances(): Promise<void> {
  const config = await getBotConfig();
  if (!config.enabled) return;

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN) return;

  const botUserIds = await getBotUserIds();
  const lowBalanceBots: { id: number; name: string; balance: number }[] = [];

  for (const botId of botUserIds) {
    const user = await db.getUserById(botId);
    if (!user) continue;
    const balance = parseFloat(String(user.balance));
    if (balance < config.balanceAlertThreshold) {
      lowBalanceBots.push({ id: botId, name: user.nickname || user.name || `Bot#${botId}`, balance });
    }
  }

  if (lowBalanceBots.length > 0) {
    lastAlertTime = now;
    const botDetails = lowBalanceBots.map(b => `  • ${b.name} (ID:${b.id}): $${b.balance.toFixed(2)}`).join("\n");
    
    if (config.autoRefillEnabled) {
      // 自动补充
      for (const bot of lowBalanceBots) {
        await autoRefillBotBalance(bot.id, config.autoRefillAmount);
      }
      await notifyAdmins(
        "🤖 Bot余额自动补充",
        `以下${lowBalanceBots.length}个Bot余额低于阈值$${config.balanceAlertThreshold}，已自动补充$${config.autoRefillAmount}:\n${botDetails}`
      );
    } else {
      // 只告警不补充
      await notifyAdmins(
        "⚠️ Bot余额不足告警",
        `以下${lowBalanceBots.length}个Bot余额低于阈值$${config.balanceAlertThreshold}，请及时充值:\n${botDetails}\n\n阈值: $${config.balanceAlertThreshold}`
      );
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
    if (botUserIds.includes(player.id)) {
      // Bot结算
      const winAmount = playerWinAmounts.get(player.id) || 0;
      const netProfit = winAmount - player.totalBet;
      
      // 记录bot下注和赢得（用于计算实际边际率）
      recordBotBetAndWin(player.totalBet, winAmount);
      
      if (netProfit < 0) {
        addBotLoss(Math.abs(netProfit));
      } else if (netProfit > 0) {
        addBotWin(netProfit);
      }
    } else {
      // 真人玩家结算：追踪连赢
      const winAmount = playerWinAmounts.get(player.id) || 0;
      const netProfit = winAmount - player.totalBet;
      if (netProfit > 0) {
        recordPlayerWin(player.id);
      } else if (netProfit < 0) {
        recordPlayerLoss(player.id);
      }
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
  if (botId === -1) {
    // Full room cleanup: remove all bot tracking for this room
    seatedBots.delete(roomId);
    return;
  }
  const bots = seatedBots.get(roomId);
  if (bots) {
    bots.delete(botId);
    if (bots.size === 0) seatedBots.delete(roomId);
  }
}

/**
 * 获取bot系统统计信息（含详细数据统计）
 */
export async function getBotStats() {
  resetDailyLossIfNeeded();
  const config = await getBotConfig();
  
  // 获取每个bot的详细统计
  const botDetails = await getBotDetailedStats();
  
  // 计算当前实际边际率
  const actualEdge = dailyBotTotalBet > 0 
    ? ((dailyBotTotalWin - dailyBotTotalBet) / dailyBotTotalBet * 100).toFixed(2)
    : "0.00";
  
  // 计算当前盈亏控制调整值
  const currentAdjustment = getProfitControlAdjustment(config);
  
  return {
    enabled: config.enabled,
    dailyLoss: dailyLossTotal,
    dailyLossLimit: config.dailyLossLimit,
    activeBots: getActiveBotsCount(),
    botsPerRoom: Object.fromEntries(getBotsPerRoom()),
    config,
    botDetails,
    // v2 新增：盈亏控制详情
    profitControl: {
      dailyBotTotalBet,
      dailyBotTotalWin,
      actualEdge: parseFloat(actualEdge),
      targetEdge: config.targetEdge,
      currentAdjustment: parseFloat(currentAdjustment.toFixed(4)),
      adjustmentDirection: currentAdjustment > 0 ? "收紧（bot打得更保守）" : currentAdjustment < 0 ? "放松（让玩家赢）" : "无调整",
    },
  };
}

/**
 * 获取每个bot的详细统计数据（胜率/手数/盈亏/余额）
 */
export async function getBotDetailedStats() {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  
  const { users, handPlayers, transactions } = await import("../drizzle/schema");
  const { eq, sql, and, inArray, gte } = await import("drizzle-orm");
  
  const botUserIds = await getBotUserIds();
  if (botUserIds.length === 0) return [];
  
  // 获取bot基本信息和余额
  const botUsers = await dbInstance.select({
    id: users.id,
    name: users.name,
    nickname: users.nickname,
    balance: users.balance,
  }).from(users).where(inArray(users.id, botUserIds));
  
  // 获取每个bot的手数统计（总手数、胜利手数）
  const handStats = await dbInstance.select({
    userId: handPlayers.userId,
    totalHands: sql<number>`count(*)`,
    wins: sql<number>`sum(case when ${handPlayers.isWinner} = true then 1 else 0 end)`,
    totalBet: sql<string>`COALESCE(sum(${handPlayers.betAmount}), '0')`,
    totalWin: sql<string>`COALESCE(sum(${handPlayers.winAmount}), '0')`,
  }).from(handPlayers)
    .where(inArray(handPlayers.userId, botUserIds))
    .groupBy(handPlayers.userId);
  
  // 获取今日统计
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayHandStats = await dbInstance.select({
    userId: handPlayers.userId,
    todayHands: sql<number>`count(*)`,
    todayWins: sql<number>`sum(case when ${handPlayers.isWinner} = true then 1 else 0 end)`,
    todayBet: sql<string>`COALESCE(sum(${handPlayers.betAmount}), '0')`,
    todayWin: sql<string>`COALESCE(sum(${handPlayers.winAmount}), '0')`,
  }).from(handPlayers)
    .where(and(
      inArray(handPlayers.userId, botUserIds),
      gte(handPlayers.id, sql`(SELECT COALESCE(MIN(id),0) FROM hand_players WHERE id IN (SELECT id FROM game_hands WHERE startedAt >= ${todayStart}))`)
    ))
    .groupBy(handPlayers.userId);
  
  // 获取每个bot的总充值金额（adjustment类型交易）
  const refillStats = await dbInstance.select({
    userId: transactions.userId,
    totalRefill: sql<string>`COALESCE(sum(${transactions.amount}), '0')`,
    refillCount: sql<number>`count(*)`,
  }).from(transactions)
    .where(and(
      inArray(transactions.userId, botUserIds),
      eq(transactions.type, "adjustment"),
      eq(transactions.status, "confirmed")
    ))
    .groupBy(transactions.userId);
  
  // 组装结果
  const handStatsMap = new Map(handStats.map(h => [h.userId, h]));
  const todayStatsMap = new Map(todayHandStats.map(h => [h.userId, h]));
  const refillMap = new Map(refillStats.map(r => [r.userId, r]));
  
  return botUsers.map(bot => {
    const hs = handStatsMap.get(bot.id);
    const ts = todayStatsMap.get(bot.id);
    const rs = refillMap.get(bot.id);
    const totalHands = hs?.totalHands ?? 0;
    const wins = hs?.wins ?? 0;
    const totalBet = parseFloat(hs?.totalBet ?? "0");
    const totalWin = parseFloat(hs?.totalWin ?? "0");
    const todayHands = ts?.todayHands ?? 0;
    const todayWins = ts?.todayWins ?? 0;
    const todayBet = parseFloat(ts?.todayBet ?? "0");
    const todayWin = parseFloat(ts?.todayWin ?? "0");
    
    // 检查bot是否在线
    let isOnline = false;
    let currentRoom: number | null = null;
    for (const [roomId, bots] of seatedBots) {
      if (bots.has(bot.id)) {
        isOnline = true;
        currentRoom = roomId;
        break;
      }
    }
    
    return {
      id: bot.id,
      name: bot.nickname || bot.name || `Bot#${bot.id}`,
      balance: parseFloat(String(bot.balance)),
      isOnline,
      currentRoom,
      // 总统计
      totalHands,
      winRate: totalHands > 0 ? ((wins / totalHands) * 100).toFixed(1) : "0.0",
      totalProfit: (totalWin - totalBet).toFixed(2),
      // 今日统计
      todayHands,
      todayWinRate: todayHands > 0 ? ((todayWins / todayHands) * 100).toFixed(1) : "0.0",
      todayProfit: (todayWin - todayBet).toFixed(2),
      // 补充统计
      totalRefill: parseFloat(rs?.totalRefill ?? "0"),
      refillCount: rs?.refillCount ?? 0,
    };
  });
}
