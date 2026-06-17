/**
 * 数据库表结构定义 (Drizzle ORM Schema)
 * 包含：用户、房间、牌局、交易、代理、风控、营销、锦标赛等全部表
 */
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint } from "drizzle-orm/mysql-core";
// ==================== 用户表 ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "cs", "finance", "tech"]).default("user").notNull(),
  // Staff login credentials (for admin/cs/finance/tech)
  staffUsername: varchar("staffUsername", { length: 64 }).unique(),
  staffPasswordHash: varchar("staffPasswordHash", { length: 256 }),
  // Backup password login (for users who want password as backup to TG login)
  passwordHash: varchar("passwordHash", { length: 256 }),
  // Telegram specific
  tgId: varchar("tgId", { length: 64 }).unique(),
  tgUsername: varchar("tgUsername", { length: 128 }),
  tgAccountAge: int("tgAccountAge"), // days since TG account creation
  // Game profile
  avatar: text("avatar"),
  nickname: varchar("nickname", { length: 64 }),
  language: varchar("language", { length: 10 }).default("en"),
  // 通知偏好设置（JSON）：各类型通知开关，null 表示全部开启
  notificationPrefs: json("notificationPrefs").$type<{
    privateRoomInvite?: boolean;
    turnAction?: boolean;
    gameStarting?: boolean;
    deposit?: boolean;
    withdrawal?: boolean;
    commission?: boolean;
    tournament?: boolean;
    system?: boolean;
  }>(),
  // Balance
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  frozenBalance: decimal("frozenBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  bonusBalance: decimal("bonusBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  bonusUnlocked: boolean("bonusUnlocked").default(false).notNull(),
  // Agent
  invitedBy: int("invitedBy"), // user id of inviter (level 1 agent)
  inviteCode: varchar("inviteCode", { length: 32 }).unique(),
  agentLevel: mysqlEnum("agentLevel", ["none", "agent"]).default("none").notNull(),
  // Risk control
  riskLevel: mysqlEnum("riskLevel", ["normal", "watch", "frozen", "banned"]).default("normal").notNull(),
  deviceFingerprint: varchar("deviceFingerprint", { length: 256 }),
  lastIp: varchar("lastIp", { length: 64 }),
  sessionVersion: int("sessionVersion").default(1).notNull(), // 递增版本号，用于设备互斥登录
  lastLatitude: decimal("lastLatitude", { precision: 10, scale: 7 }), // 最近GPS纬度
  lastLongitude: decimal("lastLongitude", { precision: 10, scale: 7 }), // 最近GPS经度
  lastLocationAt: timestamp("lastLocationAt"), // 最近位置上报时间
  // Bot flag
  isBot: boolean("isBot").default(false).notNull(),
  // Stats
  totalGamesPlayed: int("totalGamesPlayed").default(0).notNull(),
  totalRakeGenerated: decimal("totalRakeGenerated", { precision: 18, scale: 2 }).default("0.00").notNull(),
  totalDeposited: decimal("totalDeposited", { precision: 18, scale: 2 }).default("0.00").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== 系统配置表 ====================
export const systemConfigs = mysqlTable("system_configs", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 64 }).notNull(), // game, finance, agent, risk, room, notification
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(), // JSON string
  valueType: mysqlEnum("valueType", ["string", "number", "boolean", "json"]).default("string").notNull(),
  label: varchar("label", { length: 256 }).notNull(), // human readable label
  description: text("description"),
  isPublic: boolean("isPublic").default(false).notNull(), // whether frontend can read
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfigs.$inferSelect;

// ==================== 房间表 ====================
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["public", "private"]).default("public").notNull(),
  status: mysqlEnum("status", ["waiting", "playing", "paused", "closed"]).default("waiting").notNull(),
  // Game settings
  gameType: mysqlEnum("gameType", ["texas_holdem", "omaha"]).default("texas_holdem").notNull(),
  smallBlind: decimal("smallBlind", { precision: 18, scale: 2 }).notNull(),
  bigBlind: decimal("bigBlind", { precision: 18, scale: 2 }).notNull(),
  minBuyIn: decimal("minBuyIn", { precision: 18, scale: 2 }).notNull(),
  maxBuyIn: decimal("maxBuyIn", { precision: 18, scale: 2 }).notNull(),
  maxPlayers: int("maxPlayers").default(6).notNull(),
  // Private room settings
  ownerId: int("ownerId"),
  inviteCode: varchar("inviteCode", { length: 32 }).unique(),
  totalRounds: int("totalRounds"), // null = unlimited for public rooms
  playedRounds: int("playedRounds").default(0).notNull(),
  billingMode: mysqlEnum("billingMode", ["standard_rake", "per_round_fee"]).default("standard_rake").notNull(),
  roundFee: decimal("roundFee", { precision: 18, scale: 2 }).default("0.00"),
  // Rake settings (overridable per room, null = use system default)
  rakePercent: decimal("rakePercent", { precision: 5, scale: 2 }),
  rakeCap: decimal("rakeCap", { precision: 18, scale: 2 }),
  // Stats
  currentPlayers: int("currentPlayers").default(0).notNull(),
  // Fairness level
  fairnessLevel: mysqlEnum("fairnessLevel", ["basic", "medium", "high"]).default("basic").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;

// ==================== 房间玩家表 ====================
export const roomPlayers = mysqlTable("room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  seatIndex: int("seatIndex").notNull(),
  chipCount: decimal("chipCount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["active", "sitting_out", "left"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

// ==================== 牌局记录表 ====================
export const gameHands = mysqlTable("game_hands", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  handNumber: int("handNumber").notNull(),
  // Cards
  communityCards: varchar("communityCards", { length: 64 }), // JSON: ["Ah", "Kd", ...]
  // Fairness
  serverSeed: varchar("serverSeed", { length: 128 }),
  serverSeedHash: varchar("serverSeedHash", { length: 128 }),
  clientSeed: varchar("clientSeed", { length: 128 }),
  deckHash: varchar("deckHash", { length: 128 }),
  // On-chain verification (for high-stakes)
  txHash: varchar("txHash", { length: 256 }),
  // Replay data (牌局回放数据)
  actionTimeline: json("actionTimeline").$type<Array<{
    seq: number; // 操作序号
    phase: string; // 当前阶段 preflop/flop/turn/river
    playerId: number;
    playerName: string;
    action: string; // fold/check/call/raise/all_in/post_blind
    amount: number;
    potAfter: number; // 操作后底池
    timestamp: number;
  }>>(),
  playerSnapshot: json("playerSnapshot").$type<Array<{
    id: number;
    name: string;
    seatIndex: number;
    startChips: number; // 本局开始时筹码
    holeCards: string[]; // 手牌（回放时展示）
  }>>(),
  // Results
  potSize: decimal("potSize", { precision: 18, scale: 2 }).default("0.00"),
  rakeAmount: decimal("rakeAmount", { precision: 18, scale: 2 }).default("0.00"),
  winnerId: int("winnerId"),
  winningHand: varchar("winningHand", { length: 64 }),
  // State
  status: mysqlEnum("status", ["dealing", "preflop", "flop", "turn", "river", "showdown", "completed"]).default("dealing").notNull(),
  // Timestamps
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type GameHand = typeof gameHands.$inferSelect;

// ==================== 牌局玩家表 ====================
export const handPlayers = mysqlTable("hand_players", {
  id: int("id").autoincrement().primaryKey(),
  handId: int("handId").notNull(),
  userId: int("userId").notNull(),
  seatIndex: int("seatIndex").notNull(),
  holeCards: varchar("holeCards", { length: 32 }), // encrypted: ["Ah", "Kd"]
  betAmount: decimal("betAmount", { precision: 18, scale: 2 }).default("0.00"),
  winAmount: decimal("winAmount", { precision: 18, scale: 2 }).default("0.00"),
  action: mysqlEnum("action", ["fold", "check", "call", "raise", "all_in", "none"]).default("none"),
  isWinner: boolean("isWinner").default(false),
  finalHand: varchar("finalHand", { length: 64 }), // hand rank description
});

// ==================== 交易记录表 ====================
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "game_win", "game_loss", "rake", "commission", "room_fee", "refund", "adjustment", "buy_in", "leave_table", "rebuy", "tournament_entry", "tournament_refund", "tournament_prize", "bonus", "invite_reward", "checkin", "first_deposit_bonus"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 18, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 18, scale: 2 }).notNull(),
  // Chain info (for deposits/withdrawals)
  chain: varchar("chain", { length: 32 }), // TRC20, ERC20, BEP20, TON, Polygon
  txHash: varchar("txHash", { length: 256 }),
  walletAddress: varchar("walletAddress", { length: 256 }),
  // Status
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "cancelled", "completed"]).default("pending").notNull(),
  // Reference
  referenceType: varchar("referenceType", { length: 64 }), // hand, room, agent
  referenceId: int("referenceId"),
  note: text("note"),
  // Operator info (for manual top-ups by admin staff)
  operatorId: int("operatorId"), // admin_users.id or users.id of the operator
  operatorName: varchar("operatorName", { length: 128 }), // display name of operator
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ==================== 代理关系表 ====================
export const agentRelationships = mysqlTable("agent_relationships", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(), // the agent (inviter)
  downlineId: int("downlineId").notNull(), // the invited user
  level: int("level").notNull(), // 1 = direct, 2 = second level
  // Unlock status
  isUnlocked: boolean("isUnlocked").default(false).notNull(),
  unlockProgress: json("unlockProgress"), // { gamesPlayed: 0, totalDeposit: 0, totalRake: 0 }
  unlockedAt: timestamp("unlockedAt"),
  // Stats
  totalCommissionEarned: decimal("totalCommissionEarned", { precision: 18, scale: 2 }).default("0.00"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 佣金记录表 ====================
export const commissionRecords = mysqlTable("commission_records", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  downlineId: int("downlineId").notNull(),
  handId: int("handId"),
  level: int("level").notNull(), // 1 or 2
  rakeAmount: decimal("rakeAmount", { precision: 18, scale: 2 }).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "settled", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 风控事件表 ====================
export const riskEvents = mysqlTable("risk_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: mysqlEnum("eventType", ["multi_account", "collusion", "bot_behavior", "abnormal_withdraw", "self_play", "ip_cluster", "geo_proximity"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("low").notNull(),
  details: json("details"),
  actionTaken: mysqlEnum("actionTaken", ["none", "flagged", "frozen", "banned"]).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 客服会话表 ====================
export const csConversations = mysqlTable("cs_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["active", "resolved", "escalated"]).default("active").notNull(),
  language: varchar("language", { length: 10 }).default("en"),
  messages: json("messages"), // Array of { role, content, timestamp }
  resolvedBy: mysqlEnum("resolvedBy", ["ai", "human"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== FAQ 知识库表 ====================
export const faqEntries = mysqlTable("faq_entries", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: text("keywords"), // comma separated
  language: varchar("language", { length: 10 }).default("en").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== 通知表 ====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "game", "commission", "system", "security", "room_invite"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 成就表 ====================
export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  nameZh: varchar("nameZh", { length: 128 }).notNull(),
  nameEn: varchar("nameEn", { length: 128 }),
  nameZhTW: varchar("nameZhTW", { length: 128 }),
  description: varchar("description", { length: 512 }).notNull(),
  descriptionZh: varchar("descriptionZh", { length: 512 }).notNull(),
  icon: varchar("icon", { length: 32 }).notNull(), // emoji or icon name
  category: mysqlEnum("category", ["beginner", "veteran", "whale", "social", "lucky"]).notNull(),
  condition: json("condition").notNull(), // { type: "hands_played", threshold: 100 }
  rewardAmount: decimal("rewardAmount", { precision: 18, scale: 2 }).default("0.00"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const playerAchievements = mysqlTable("player_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});


// ==================== 管理员表（平台员工，独立于游戏用户） ====================
export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  role: mysqlEnum("role", ["super_admin", "admin", "cs", "finance", "tech"]).default("cs").notNull(),
  // Permissions (JSON array of allowed sections)
  permissions: json("permissions").$type<string[]>().default([]),
  isActive: boolean("isActive").default(true).notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  lastLoginIp: varchar("lastLoginIp", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

// ==================== 管理日志表（审计追踪） ====================
export const adminLogs = mysqlTable("admin_logs", {
  id: int("id").autoincrement().primaryKey(),
  // Who performed the action
  operatorId: int("operatorId"), // admin_users.id
  operatorName: varchar("operatorName", { length: 128 }),
  operatorRole: varchar("operatorRole", { length: 32 }),
  // What action was performed
  action: varchar("action", { length: 128 }).notNull(), // e.g. "confirm_deposit", "reject_withdrawal", "update_config"
  category: mysqlEnum("category", ["finance", "user", "room", "config", "agent", "system", "auth"]).default("system").notNull(),
  // Details
  targetType: varchar("targetType", { length: 64 }), // e.g. "transaction", "user", "room", "config"
  targetId: varchar("targetId", { length: 64 }), // ID of the affected entity
  detail: json("detail").$type<Record<string, any>>(), // Additional context
  // Request info
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  // Result
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;

// ==================== 客服消息表（聊天记录） ====================
export const csMessages = mysqlTable("cs_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CsMessage = typeof csMessages.$inferSelect;
export type InsertCsMessage = typeof csMessages.$inferInsert;

// ==================== 横幅表（活动/推广） ====================
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 128 }).notNull(),
  imageUrl: text("imageUrl").notNull(), // Banner image URL
  linkUrl: text("linkUrl"), // Click destination URL (optional)
  linkType: mysqlEnum("linkType", ["url", "page", "none"]).default("none").notNull(), // url=external, page=internal route, none=no action
  sortOrder: int("sortOrder").default(0).notNull(), // Lower = higher priority
  isActive: boolean("isActive").default(true).notNull(),
  startTime: timestamp("startTime"), // Scheduled start (null = immediate)
  endTime: timestamp("endTime"), // Scheduled end (null = permanent)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;

// ==================== TOURNAMENTS (锦标赛) ====================
export const tournaments = mysqlTable("tournaments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  // Status
  status: mysqlEnum("status", ["draft", "registration", "running", "finished", "cancelled"]).default("draft").notNull(),
  // Schedule
  startTime: timestamp("startTime").notNull(), // Scheduled start time
  registrationOpenTime: timestamp("registrationOpenTime"), // When registration opens (null = immediately)
  // Entry
  entryFee: decimal("entryFee", { precision: 12, scale: 2 }).notNull(), // Entry fee in USDT
  startingChips: int("startingChips").notNull().default(10000), // Initial tournament chips
  // Limits
  minPlayers: int("minPlayers").notNull().default(10), // Min players to start (else cancel & refund)
  maxPlayers: int("maxPlayers").notNull().default(1000), // Max registrations
  playersPerTable: int("playersPerTable").notNull().default(9), // Players per table
  // Game rules
  totalRounds: int("totalRounds").notNull().default(60), // Total rounds (hands)
  blindLevelDuration: int("blindLevelDuration").notNull().default(10), // Minutes per blind level
  // Blind structure (JSON array of levels)
  blindStructure: json("blindStructure").$type<Array<{ level: number; smallBlind: number; bigBlind: number; ante: number }>>().notNull(),
  // Prize
  platformRake: decimal("platformRake", { precision: 5, scale: 2 }).notNull().default("10.00"), // Platform rake percentage
  prizeDistribution: json("prizeDistribution").$type<Array<{ rank: number; percentage: number }>>().notNull(), // e.g. [{rank:1, percentage:40}, {rank:2, percentage:25}...]
  // Shuffle tables interval (minutes, 0 = no shuffle)
  tableShuffleInterval: int("tableShuffleInterval").notNull().default(15),
  // Final table threshold
  finalTableThreshold: int("finalTableThreshold").notNull().default(9), // Merge to final table when <= this many players
  // Stats (updated during/after tournament)
  registeredCount: int("registeredCount").notNull().default(0),
  totalPrizePool: decimal("totalPrizePool", { precision: 12, scale: 2 }).default("0.00"),
  // Timestamps
  actualStartTime: timestamp("actualStartTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = typeof tournaments.$inferInsert;

// ==================== TOURNAMENT REGISTRATIONS (报名记录) ====================
export const tournamentRegistrations = mysqlTable("tournament_registrations", {
  id: int("id").autoincrement().primaryKey(),
  tournamentId: int("tournamentId").notNull(),
  userId: int("userId").notNull(),
  // Status
  status: mysqlEnum("status", ["registered", "playing", "eliminated", "finished", "refunded"]).default("registered").notNull(),
  // Tournament chips
  currentChips: int("currentChips").notNull().default(0), // Current chip count (0 = eliminated)
  // Table assignment
  tableId: varchar("tableId", { length: 64 }), // Current table assignment
  seatIndex: int("seatIndex"), // Seat at current table
  // Results
  finishRank: int("finishRank"), // Final ranking (1 = winner)
  eliminatedAtRound: int("eliminatedAtRound"), // Which round they were eliminated
  prizeAmount: decimal("prizeAmount", { precision: 12, scale: 2 }).default("0.00"), // Prize won
  // Timestamps
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  eliminatedAt: timestamp("eliminatedAt"),
});

export type TournamentRegistration = typeof tournamentRegistrations.$inferSelect;
export type InsertTournamentRegistration = typeof tournamentRegistrations.$inferInsert;

// ==================== TOURNAMENT RESULTS (比赛结果) ====================
export const tournamentResults = mysqlTable("tournament_results", {
  id: int("id").autoincrement().primaryKey(),
  tournamentId: int("tournamentId").notNull(),
  userId: int("userId").notNull(),
  // Results
  rank: int("rank").notNull(),
  prizeAmount: decimal("prizeAmount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  startingChips: int("startingChips").notNull(),
  finalChips: int("finalChips").notNull().default(0),
  roundsPlayed: int("roundsPlayed").notNull().default(0),
  handsWon: int("handsWon").notNull().default(0),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TournamentResult = typeof tournamentResults.$inferSelect;
export type InsertTournamentResult = typeof tournamentResults.$inferInsert;

// ==================== BROADCAST TASKS (群发任务) ====================
export const broadcastTasks = mysqlTable("broadcast_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"), // Optional image attachment
  buttonText: varchar("buttonText", { length: 128 }), // Optional inline button text (legacy single)
  buttonUrl: text("buttonUrl"), // Optional inline button URL (legacy single)
  buttons: json("buttons").$type<Array<{ text: string; url: string; row?: number }>>(), // Multi-button: [{text, url, row}]
  // Target: "all" = all users with tgId, "active" = users active in last 30 days, "custom" = specific user IDs
  targetType: mysqlEnum("targetType", ["all", "active", "deposited", "custom"]).default("all").notNull(),
  targetUserIds: json("targetUserIds").$type<number[]>(), // Used when targetType = "custom"
  targetFilter: json("targetFilter").$type<{
    languages?: string[]; // Filter by user language
    registeredAfter?: string; // ISO date string
    registeredBefore?: string;
    lastActiveAfter?: string;
    lastActiveBefore?: string;
    minDeposit?: number;
    maxDeposit?: number;
    minGamesPlayed?: number;
    maxGamesPlayed?: number;
    bonusStatus?: "locked" | "unlocked" | "any";
  }>(), // Advanced filter conditions
  // Scheduling
  scheduledAt: timestamp("scheduledAt"), // null = send immediately
  // Status tracking
  status: mysqlEnum("status", ["draft", "pending", "sending", "completed", "cancelled", "failed"]).default("draft").notNull(),
  totalCount: int("totalCount").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  failCount: int("failCount").default(0).notNull(),
  // Metadata
  createdBy: int("createdBy").notNull(), // admin_users.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});
export type BroadcastTask = typeof broadcastTasks.$inferSelect;
export type InsertBroadcastTask = typeof broadcastTasks.$inferInsert;

// ==================== AUTO REPLY RULES (关键词自动回复) ====================
export const autoReplyRules = mysqlTable("auto_reply_rules", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 256 }).notNull(), // Trigger keyword or pattern
  // Match type: "exact" = exact match, "contains" = substring match, "regex" = regex pattern
  matchType: mysqlEnum("matchType", ["exact", "contains", "regex"]).default("contains").notNull(),
  replyContent: text("replyContent").notNull(), // Reply message text
  replyType: mysqlEnum("replyType", ["text", "text_button"]).default("text").notNull(),
  buttonText: varchar("buttonText", { length: 128 }), // Optional button text
  buttonUrl: text("buttonUrl"), // Optional button URL
  isActive: boolean("isActive").default(true).notNull(),
  priority: int("priority").default(0).notNull(), // Higher = matched first
  triggerCount: int("triggerCount").default(0).notNull(), // How many times triggered
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AutoReplyRule = typeof autoReplyRules.$inferSelect;
export type InsertAutoReplyRule = typeof autoReplyRules.$inferInsert;

// ==================== FISSION CAMPAIGNS (裂变活动) ====================
export const fissionCampaigns = mysqlTable("fission_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  // Reward config
  rewardType: mysqlEnum("rewardType", ["balance", "none"]).default("balance").notNull(),
  inviterReward: decimal("inviterReward", { precision: 10, scale: 2 }).default("0.00").notNull(), // Reward for inviter per new register
  inviteeReward: decimal("inviteeReward", { precision: 10, scale: 2 }).default("0.00").notNull(), // Reward for new registrant
  // Conditions
  requireDeposit: boolean("requireDeposit").default(false).notNull(), // Reward only after first deposit
  minDepositAmount: decimal("minDepositAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  maxRewardPerUser: decimal("maxRewardPerUser", { precision: 10, scale: 2 }).default("0.00").notNull(), // 0 = unlimited
  // Tracking
  linkCode: varchar("linkCode", { length: 32 }).notNull().unique(), // Short code for tracking URL
  clickCount: int("clickCount").default(0).notNull(),
  registerCount: int("registerCount").default(0).notNull(),
  rewardPaidCount: int("rewardPaidCount").default(0).notNull(),
  totalRewardPaid: decimal("totalRewardPaid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FissionCampaign = typeof fissionCampaigns.$inferSelect;
export type InsertFissionCampaign = typeof fissionCampaigns.$inferInsert;

// ==================== FISSION CLICKS (裂变点击追踪) ====================
export const fissionClicks = mysqlTable("fission_clicks", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  linkCode: varchar("linkCode", { length: 32 }).notNull(),
  // Who clicked (null if not logged in)
  userId: int("userId"), // Registered user who clicked (if any)
  inviterId: int("inviterId"), // The user who shared the link (from ref param)
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  // Conversion tracking
  registered: boolean("registered").default(false).notNull(), // Did this click lead to registration?
  deposited: boolean("deposited").default(false).notNull(), // Did this click lead to first deposit?
  rewardPaid: boolean("rewardPaid").default(false).notNull(), // Was reward paid out?
  convertedAt: timestamp("convertedAt"), // When they registered
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FissionClick = typeof fissionClicks.$inferSelect;
export type InsertFissionClick = typeof fissionClicks.$inferInsert;

// ==================== 风控规则表 ====================
export const riskRules = mysqlTable("risk_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleKey: varchar("ruleKey", { length: 64 }).notNull().unique(), // e.g. "same_ip_multi_account"
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["fraud", "collusion", "bonus_abuse", "bot", "money_laundering"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  // Configurable thresholds (JSON object with rule-specific params)
  params: json("params"), // e.g. { "maxAccounts": 3, "timeWindowMinutes": 60 }
  // Action when triggered
  action: mysqlEnum("action", ["alert_only", "freeze_balance", "ban_account", "notify_admin"]).default("alert_only").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RiskRule = typeof riskRules.$inferSelect;
export type InsertRiskRule = typeof riskRules.$inferInsert;

// ==================== 风控告警表 ====================
export const riskAlerts = mysqlTable("risk_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ruleId: int("ruleId").notNull(),
  ruleKey: varchar("ruleKey", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved", "ignored"]).default("pending").notNull(),
  // Details
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  evidence: json("evidence"), // { ip, deviceFingerprint, relatedUsers, amounts, etc. }
  aiAnalysis: text("aiAnalysis"), // AI-generated analysis text
  riskScore: int("riskScore"), // 0-100
  // Resolution
  resolvedBy: int("resolvedBy"), // admin user id
  resolvedAt: timestamp("resolvedAt"),
  resolution: text("resolution"), // admin notes
  // Notification
  notificationSent: boolean("notificationSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RiskAlert = typeof riskAlerts.$inferSelect;
export type InsertRiskAlert = typeof riskAlerts.$inferInsert;

// ==================== MESSAGE TEMPLATES (可复用消息模板) ====================
export const messageTemplates = mysqlTable("message_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(), // Template name for identification
  content: text("content").notNull(), // Message text (supports HTML)
  imageUrl: text("imageUrl"), // Optional image URL
  buttons: json("buttons").$type<Array<{ text: string; url: string; row?: number }>>(), // Inline keyboard buttons
  category: varchar("category", { length: 64 }).default("general"), // Category for organization
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

// ==================== WELCOME TEMPLATES (多语言欢迎消息) ====================
export const welcomeTemplates = mysqlTable("welcome_templates", {
  id: int("id").autoincrement().primaryKey(),
  language: varchar("language", { length: 10 }).notNull(), // e.g. "en", "zh", "zh-tw", "ar", "ja"
  content: text("content").notNull(), // Welcome message text
  imageUrl: text("imageUrl"), // Optional welcome image
  buttons: json("buttons").$type<Array<{ text: string; url: string; row?: number }>>(), // Inline keyboard buttons
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WelcomeTemplate = typeof welcomeTemplates.$inferSelect;
export type InsertWelcomeTemplate = typeof welcomeTemplates.$inferInsert;


// ==================== 优惠券/红包 ====================
export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(), // 优惠券名称
  type: mysqlEnum("type", ["fixed", "percent", "chips"]).default("fixed").notNull(), // fixed=固定金额, percent=充值加赠百分比, chips=免费筹码
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(), // 金额或百分比
  maxBonus: decimal("maxBonus", { precision: 18, scale: 2 }), // percent类型时的最大加赠
  minDeposit: decimal("minDeposit", { precision: 18, scale: 2 }), // 最低充值要求（percent类型）
  maxUses: int("maxUses").default(0).notNull(), // 0=无限制
  usedCount: int("usedCount").default(0).notNull(),
  maxPerUser: int("maxPerUser").default(1).notNull(), // 每人限领次数
  expiresAt: timestamp("expiresAt"), // null=永不过期
  status: mysqlEnum("status", ["active", "paused", "expired"]).default("active").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

export const couponClaims = mysqlTable("coupon_claims", {
  id: int("id").autoincrement().primaryKey(),
  couponId: int("couponId").notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(), // 实际获得金额
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
});
export type CouponClaim = typeof couponClaims.$inferSelect;

// ==================== 签到系统 ====================
export const checkinConfigs = mysqlTable("checkin_configs", {
  id: int("id").autoincrement().primaryKey(),
  dayNumber: int("dayNumber").notNull(), // 1-7
  reward: decimal("reward", { precision: 18, scale: 2 }).notNull(), // 该天奖励金额
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CheckinConfig = typeof checkinConfigs.$inferSelect;

export const userCheckins = mysqlTable("user_checkins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  checkinDate: varchar("checkinDate", { length: 10 }).notNull(), // YYYY-MM-DD
  dayNumber: int("dayNumber").notNull(), // 连续签到第几天 (1-7)
  reward: decimal("reward", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserCheckin = typeof userCheckins.$inferSelect;

// ==================== 邀请奖励配置 ====================
export const inviteRewardConfigs = mysqlTable("invite_reward_configs", {
  id: int("id").autoincrement().primaryKey(),
  inviterReward: decimal("inviterReward", { precision: 18, scale: 2 }).default("5.00").notNull(), // 邀请人奖励
  inviteeReward: decimal("inviteeReward", { precision: 18, scale: 2 }).default("3.00").notNull(), // 被邀请人奖励
  maxRewardsPerUser: int("maxRewardsPerUser").default(0).notNull(), // 每人最多邀请奖励次数，0=无限
  requireDeposit: boolean("requireDeposit").default(false).notNull(), // 被邀请人是否需要充值才发放
  minDepositAmount: decimal("minDepositAmount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InviteRewardConfig = typeof inviteRewardConfigs.$inferSelect;

export const inviteRewards = mysqlTable("invite_rewards", {
  id: int("id").autoincrement().primaryKey(),
  inviterId: int("inviterId").notNull(),
  inviteeId: int("inviteeId").notNull(),
  inviterAmount: decimal("inviterAmount", { precision: 18, scale: 2 }).notNull(),
  inviteeAmount: decimal("inviteeAmount", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type InviteReward = typeof inviteRewards.$inferSelect;

// ==================== 首充优惠 ====================
export const firstDepositConfigs = mysqlTable("first_deposit_configs", {
  id: int("id").autoincrement().primaryKey(),
  bonusPercent: int("bonusPercent").default(100).notNull(), // 加赠百分比，如100=首充双倍
  maxBonus: decimal("maxBonus", { precision: 18, scale: 2 }).default("50.00").notNull(), // 最大加赠金额
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FirstDepositConfig = typeof firstDepositConfigs.$inferSelect;

export const firstDepositClaims = mysqlTable("first_deposit_claims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  depositAmount: decimal("depositAmount", { precision: 18, scale: 2 }).notNull(),
  bonusAmount: decimal("bonusAmount", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FirstDepositClaim = typeof firstDepositClaims.$inferSelect;

// ==================== 限时活动 ====================
export const timeLimitedEvents = mysqlTable("time_limited_events", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["double_points", "no_rake", "deposit_bonus", "free_chips", "custom"]).default("custom").notNull(),
  description: text("description"),
  config: json("config").$type<{
    bonusPercent?: number; // deposit_bonus: 加赠百分比
    maxBonus?: number; // deposit_bonus: 最大加赠
    freeChips?: number; // free_chips: 免费筹码数量
    rakeDiscount?: number; // no_rake: 佣金折扣百分比(0=全免)
    pointsMultiplier?: number; // double_points: 积分倍数
    customRules?: string; // custom: 自定义规则描述
  }>(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  status: mysqlEnum("status", ["upcoming", "active", "ended", "cancelled"]).default("upcoming").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TimeLimitedEvent = typeof timeLimitedEvents.$inferSelect;
export type InsertTimeLimitedEvent = typeof timeLimitedEvents.$inferInsert;

// ==================== 定时推送通知 ====================
export const scheduledNotifications = mysqlTable("scheduled_notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  buttons: json("buttons").$type<Array<{ text: string; url: string }>>(),
  targetType: mysqlEnum("targetType", ["all", "active", "deposited", "custom"]).default("all").notNull(),
  targetUserIds: json("targetUserIds").$type<number[]>(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  repeatType: mysqlEnum("repeatType", ["once", "daily", "weekly"]).default("once").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "cancelled", "failed"]).default("pending").notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
});
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = typeof scheduledNotifications.$inferInsert;

// ==================== 房间Bot配置表（每个场次独立配置） ====================
export const roomBotConfig = mysqlTable("room_bot_config", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  botCount: int("botCount").notNull().default(3), // 该场次分配的bot数量
  enabled: boolean("enabled").notNull().default(true), // 该场次是否启用bot
  foldRate: int("foldRate"), // 该场次bot弃牌率(null=使用全局)
  minActionDelay: int("minActionDelay"), // 最小操作延迟ms(null=使用全局)
  maxActionDelay: int("maxActionDelay"), // 最大操作延迟ms(null=使用全局)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RoomBotConfig = typeof roomBotConfig.$inferSelect;
