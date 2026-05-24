import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint } from "drizzle-orm/mysql-core";

// ==================== USERS ====================
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
  // Telegram specific
  tgId: varchar("tgId", { length: 64 }).unique(),
  tgUsername: varchar("tgUsername", { length: 128 }),
  tgAccountAge: int("tgAccountAge"), // days since TG account creation
  // Game profile
  avatar: text("avatar"),
  nickname: varchar("nickname", { length: 64 }),
  language: varchar("language", { length: 10 }).default("en"),
  // Balance
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  frozenBalance: decimal("frozenBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  // Agent
  invitedBy: int("invitedBy"), // user id of inviter (level 1 agent)
  inviteCode: varchar("inviteCode", { length: 32 }).unique(),
  agentLevel: mysqlEnum("agentLevel", ["none", "agent"]).default("none").notNull(),
  // Risk control
  riskLevel: mysqlEnum("riskLevel", ["normal", "watch", "frozen", "banned"]).default("normal").notNull(),
  deviceFingerprint: varchar("deviceFingerprint", { length: 256 }),
  lastIp: varchar("lastIp", { length: 64 }),
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

// ==================== SYSTEM CONFIG ====================
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

// ==================== ROOMS ====================
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

// ==================== ROOM PLAYERS ====================
export const roomPlayers = mysqlTable("room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  seatIndex: int("seatIndex").notNull(),
  chipCount: decimal("chipCount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["active", "sitting_out", "left"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

// ==================== GAME HANDS ====================
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

// ==================== HAND PLAYERS ====================
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

// ==================== TRANSACTIONS ====================
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "game_win", "game_loss", "rake", "commission", "room_fee", "refund", "adjustment"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 18, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 18, scale: 2 }).notNull(),
  // Chain info (for deposits/withdrawals)
  chain: varchar("chain", { length: 32 }), // TRC20, ERC20, BEP20, TON, Polygon
  txHash: varchar("txHash", { length: 256 }),
  walletAddress: varchar("walletAddress", { length: 256 }),
  // Status
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "cancelled"]).default("pending").notNull(),
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

// ==================== AGENT RELATIONSHIPS ====================
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

// ==================== COMMISSION RECORDS ====================
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

// ==================== RISK EVENTS ====================
export const riskEvents = mysqlTable("risk_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: mysqlEnum("eventType", ["multi_account", "collusion", "bot_behavior", "abnormal_withdraw", "self_play", "ip_cluster"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("low").notNull(),
  details: json("details"),
  actionTaken: mysqlEnum("actionTaken", ["none", "flagged", "frozen", "banned"]).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== CUSTOMER SERVICE ====================
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

// ==================== FAQ KNOWLEDGE BASE ====================
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

// ==================== NOTIFICATIONS ====================
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

// ==================== ACHIEVEMENTS ====================
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


// ==================== ADMIN USERS (Platform Staff - Separate from Game Users) ====================
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

// ==================== ADMIN LOGS (Audit Trail) ====================
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

// ==================== CS MESSAGES (Chat History) ====================
export const csMessages = mysqlTable("cs_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CsMessage = typeof csMessages.$inferSelect;
export type InsertCsMessage = typeof csMessages.$inferInsert;
