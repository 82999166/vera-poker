import { eq, and, desc, asc, sql, gte, lte, like, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, systemConfigs, rooms, roomPlayers, gameHands, handPlayers, transactions, agentRelationships, commissionRecords, riskEvents, csConversations, faqEntries, notifications } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "tgId", "tgUsername", "avatar", "nickname", "language"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    (values as any)[field] = value ?? null;
    updateSet[field] = value ?? null;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if ((user as any).lastIp !== undefined) {
    (values as any).lastIp = (user as any).lastIp;
    updateSet.lastIp = (user as any).lastIp;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(users),
  ]);
  
  // Get active players in rooms for online status
  const activePlayers = await db.select({
    userId: roomPlayers.userId,
    roomId: roomPlayers.roomId,
    roomName: rooms.name,
  }).from(roomPlayers)
    .innerJoin(rooms, eq(roomPlayers.roomId, rooms.id))
    .where(eq(roomPlayers.status, "active"));
  
  const playerRoomMap = new Map<number, { roomId: number; roomName: string }>();
  for (const ap of activePlayers) {
    playerRoomMap.set(ap.userId, { roomId: ap.roomId, roomName: ap.roomName });
  }
  
  const usersWithStatus = data.map(u => ({
    ...u,
    onlineStatus: playerRoomMap.has(u.id) 
      ? { online: true, roomId: playerRoomMap.get(u.id)!.roomId, roomName: playerRoomMap.get(u.id)!.roomName }
      : { online: false, roomId: null, roomName: null },
  }));
  
  return { users: usersWithStatus, total: countResult[0]?.count ?? 0 };
}

export async function updateUserBalance(userId: number, amount: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ balance: amount }).where(eq(users.id, userId));
}

// ==================== SYSTEM CONFIG QUERIES ====================
export async function getConfig(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemConfigs).where(eq(systemConfigs.key, key)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getConfigValue(key: string, defaultValue?: string): Promise<string> {
  const config = await getConfig(key);
  return config?.value ?? defaultValue ?? "";
}

export async function getConfigsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfigs).where(eq(systemConfigs.category, category));
}

export async function getPublicConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfigs).where(eq(systemConfigs.isPublic, true));
}

export async function upsertConfig(key: string, value: string, category: string, label: string, valueType: "string" | "number" | "boolean" | "json" = "string", description?: string, isPublic = false) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemConfigs).values({ key, value, category, label, valueType, description, isPublic })
    .onDuplicateKeyUpdate({ set: { value, category, label, valueType, description, isPublic } });
}

export async function getAllConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfigs).orderBy(asc(systemConfigs.category), asc(systemConfigs.key));
}

// ==================== ROOM QUERIES ====================
export async function getPublicRooms() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rooms).where(and(eq(rooms.type, "public"), or(eq(rooms.status, "waiting"), eq(rooms.status, "playing")))).orderBy(asc(rooms.smallBlind));
}

export async function getRoomById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createRoom(data: typeof rooms.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(rooms).values(data);
  return result[0].insertId;
}

export async function updateRoom(id: number, data: Partial<typeof rooms.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(rooms).set(data).where(eq(rooms.id, id));
}

export async function getRoomPlayers(roomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.status, "active")));
}

// ==================== TRANSACTION QUERIES ====================
export async function createTransaction(data: typeof transactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(transactions).values(data);
  return result[0].insertId;
}

export async function getUserTransactions(userId: number, page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(eq(transactions.userId, userId)),
  ]);
  return { transactions: data, total: countResult[0]?.count ?? 0 };
}

export async function getAllTransactions(page = 1, limit = 20, type?: string) {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };
  const offset = (page - 1) * limit;
  const conditions = type ? eq(transactions.type, type as any) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(transactions).where(conditions).orderBy(desc(transactions.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(conditions),
  ]);
  return { transactions: data, total: countResult[0]?.count ?? 0 };
}

// ==================== AGENT QUERIES ====================
export async function getAgentDownlines(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentRelationships).where(eq(agentRelationships.agentId, agentId));
}

export async function createAgentRelationship(agentId: number, downlineId: number, level: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(agentRelationships).values({
    agentId, downlineId, level,
    unlockProgress: JSON.stringify({ gamesPlayed: 0, totalDeposit: 0, totalRake: 0 }),
  });
}

export async function getAgentCommissions(agentId: number, page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { records: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(commissionRecords).where(eq(commissionRecords.agentId, agentId)).orderBy(desc(commissionRecords.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(commissionRecords).where(eq(commissionRecords.agentId, agentId)),
  ]);
  return { records: data, total: countResult[0]?.count ?? 0 };
}

// ==================== GAME QUERIES ====================
export async function createGameHand(data: typeof gameHands.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(gameHands).values(data);
  return result[0].insertId;
}

export async function updateGameHand(id: number, data: Partial<typeof gameHands.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(gameHands).set(data).where(eq(gameHands.id, id));
}

export async function getHandHistory(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameHands).where(eq(gameHands.roomId, roomId)).orderBy(desc(gameHands.startedAt)).limit(limit);
}

// ==================== FAQ QUERIES ====================
export async function getActiveFaqs(language = "en") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqEntries).where(and(eq(faqEntries.isActive, true), eq(faqEntries.language, language))).orderBy(asc(faqEntries.sortOrder));
}

export async function getAllFaqs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqEntries).orderBy(asc(faqEntries.sortOrder));
}

// ==================== NOTIFICATION QUERIES ====================
export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

// ==================== RISK QUERIES ====================
export async function createRiskEvent(data: typeof riskEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(riskEvents).values(data);
}

export async function getRiskEvents(page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { events: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(riskEvents).orderBy(desc(riskEvents.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(riskEvents),
  ]);
  return { events: data, total: countResult[0]?.count ?? 0 };
}

// ==================== GAME HAND LOOKUP (for quick verify) ====================
export async function getGameHandById(handId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(gameHands).where(eq(gameHands.id, handId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getGameHandByTxHash(txHash: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(gameHands).where(eq(gameHands.txHash, txHash)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ==================== ROOM MANAGEMENT ====================
export async function deleteRoom(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(rooms).where(eq(rooms.id, id));
}

export async function getUserRooms(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rooms).where(eq(rooms.ownerId, userId)).orderBy(desc(rooms.createdAt));
}

// ==================== AGENT ADMIN QUERIES ====================
export async function getAllAgentRelationships(page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { relationships: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(agentRelationships).orderBy(desc(agentRelationships.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(agentRelationships),
  ]);
  return { relationships: data, total: countResult[0]?.count ?? 0 };
}

export async function getAllCommissions(page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { records: [], total: 0 };
  const offset = (page - 1) * limit;
  const [data, countResult] = await Promise.all([
    db.select().from(commissionRecords).orderBy(desc(commissionRecords.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(commissionRecords),
  ]);
  return { records: data, total: countResult[0]?.count ?? 0 };
}

// ==================== ROOM PLAYER MANAGEMENT ====================
export async function addRoomPlayer(roomId: number, userId: number, seatIndex: number, chipCount: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(roomPlayers).values({ roomId, userId, seatIndex, chipCount, status: "active" });
}

export async function removeRoomPlayer(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(roomPlayers)
    .set({ status: "left" })
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)));
}

export async function updateRoomPlayerChips(roomId: number, userId: number, chipCount: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(roomPlayers)
    .set({ chipCount })
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId), eq(roomPlayers.status, "active")));
}

// ==================== WALLET ADDRESS GENERATION ====================
import crypto from "crypto";

/**
 * Generate a deterministic deposit address for a user based on their ID and chain
 * In production, this would integrate with a real blockchain wallet service
 */
export async function generateDepositAddress(userId: number, chain: "TRC20" | "TON"): Promise<string> {
  // Try to get configured wallet address from system config
  const configKey = chain === "TRC20" ? "deposit_wallet_trc20" : "deposit_wallet_ton";
  const configuredAddress = await getConfigValue(configKey);
  if (configuredAddress) return configuredAddress;
  
  // Fallback: generate deterministic placeholder (should be replaced via admin config)
  const seed = `vera-poker-deposit-${userId}-${chain}`;
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  
  if (chain === "TRC20") {
    return "T" + hash.substring(0, 33).replace(/[^a-zA-Z0-9]/g, "A");
  } else {
    return "EQ" + hash.substring(0, 46).replace(/[^a-zA-Z0-9]/g, "B");
  }
}

// ==================== HAND PLAYERS QUERIES ====================
export async function createHandPlayer(data: typeof handPlayers.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(handPlayers).values(data);
  return result[0].insertId;
}

export async function getHandPlayers(handId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(handPlayers).where(eq(handPlayers.handId, handId));
}

export async function updateHandPlayer(handId: number, userId: number, data: Partial<typeof handPlayers.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(handPlayers).set(data).where(
    and(eq(handPlayers.handId, handId), eq(handPlayers.userId, userId))
  );
}

export async function getPlayerRecentHands(userId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  // Get recent hands this player participated in
  const playerHands = await db.select({ handId: handPlayers.handId })
    .from(handPlayers)
    .where(eq(handPlayers.userId, userId))
    .orderBy(desc(handPlayers.id))
    .limit(limit);
  if (playerHands.length === 0) return [];
  const handIds = playerHands.map(h => h.handId);
  const hands = await db.select().from(gameHands).where(inArray(gameHands.id, handIds)).orderBy(desc(gameHands.id));
  // Get player's specific data for each hand
  const results = await Promise.all(hands.map(async (hand) => {
    const myData = await db.select().from(handPlayers).where(
      and(eq(handPlayers.handId, hand.id), eq(handPlayers.userId, userId))
    );
    const playerData = myData[0];
    return {
      id: hand.id,
      roomId: hand.roomId,
      potSize: hand.potSize,
      status: hand.status,
      completedAt: hand.completedAt,
      myResult: playerData ? {
        winAmount: playerData.winAmount,
        holeCards: playerData.holeCards,
        isWinner: playerData.isWinner,
      } : null,
    };
  }));
  return results;
}

// ==================== TELEGRAM USER QUERIES ====================

/**
 * Find user by Telegram ID
 */
export async function getUserByTgId(tgId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.tgId, tgId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Find or create a user by Telegram identity.
 * If user exists (by tgId), update their profile and return.
 * If not, create a new user with a generated openId.
 */
export async function findOrCreateTelegramUser(params: {
  tgId: string;
  tgUsername: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string;
  isPremium: boolean;
}) {
  const db = await getDb();
  if (!db) return undefined;

  // Check if user already exists by tgId
  const existing = await getUserByTgId(params.tgId);
  if (existing) {
    // Update profile info
    const updates: Record<string, unknown> = {
      tgUsername: params.tgUsername,
      lastSignedIn: new Date(),
    };
    if (params.photoUrl) updates.avatar = params.photoUrl;
    if (params.firstName) {
      const fullName = params.lastName
        ? `${params.firstName} ${params.lastName}`
        : params.firstName;
      updates.name = fullName;
    }
    if (params.languageCode) updates.language = params.languageCode;

    await db.update(users).set(updates).where(eq(users.id, existing.id));
    return { ...existing, ...updates };
  }

  // Create new user with a Telegram-based openId
  const openId = `tg_${params.tgId}`;
  const fullName = params.lastName
    ? `${params.firstName} ${params.lastName}`
    : params.firstName;

  const insertValues: InsertUser = {
    openId,
    name: fullName,
    tgId: params.tgId,
    tgUsername: params.tgUsername,
    avatar: params.photoUrl,
    nickname: params.tgUsername || params.firstName,
    language: params.languageCode,
    loginMethod: "telegram",
    lastSignedIn: new Date(),
  };

  // Check if owner
  if (openId === ENV.ownerOpenId) {
    insertValues.role = "admin";
  }

  await db.insert(users).values(insertValues);
  return getUserByTgId(params.tgId);
}

/**
 * Bind Telegram identity to an existing user account
 */
export async function bindTelegramToUser(userId: number, tgId: string, tgUsername: string | null) {
  const db = await getDb();
  if (!db) return false;
  
  // Check if tgId is already bound to another user
  const existing = await getUserByTgId(tgId);
  if (existing && existing.id !== userId) {
    return false; // Already bound to different user
  }

  await db.update(users).set({ tgId, tgUsername }).where(eq(users.id, userId));
  return true;
}

// ==================== ADMIN USER DETAIL QUERIES ====================

/**
 * Get comprehensive user detail for admin panel
 */
export async function getUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const user = await getUserById(userId);
  if (!user) return null;

  // Get financial summary from transactions
  const [depositSum, withdrawSum, gameWinSum, gameLossSum, rakeSum, totalBetsSum] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(amount), '0.00')` }).from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "deposit"), eq(transactions.status, "confirmed"))),
    db.select({ total: sql<string>`COALESCE(SUM(amount), '0.00')` }).from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "withdraw"), eq(transactions.status, "confirmed"))),
    db.select({ total: sql<string>`COALESCE(SUM(amount), '0.00')` }).from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "game_win"))),
    db.select({ total: sql<string>`COALESCE(SUM(amount), '0.00')` }).from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "game_loss"))),
    db.select({ total: sql<string>`COALESCE(SUM(amount), '0.00')` }).from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "rake"))),
    db.select({ total: sql<string>`COALESCE(SUM(betAmount), '0.00')` }).from(handPlayers)
      .where(eq(handPlayers.userId, userId)),
  ]);

  // Get agent info
  const agentRel = await db.select().from(agentRelationships)
    .where(eq(agentRelationships.downlineId, userId)).limit(1);
  
  let inviterName = null;
  if (agentRel.length > 0) {
    const inviter = await getUserById(agentRel[0].agentId);
    inviterName = inviter?.name || inviter?.nickname || `#${agentRel[0].agentId}`;
  }

  // Get downline count and commission total
  const [downlineCount, commissionTotal] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(agentRelationships)
      .where(eq(agentRelationships.agentId, userId)),
    db.select({ total: sql<string>`COALESCE(SUM(commissionAmount), '0.00')` }).from(commissionRecords)
      .where(eq(commissionRecords.agentId, userId)),
  ]);

  return {
    ...user,
    financialSummary: {
      totalDeposited: depositSum[0]?.total ?? "0.00",
      totalWithdrawn: withdrawSum[0]?.total ?? "0.00",
      totalGameWin: gameWinSum[0]?.total ?? "0.00",
      totalGameLoss: gameLossSum[0]?.total ?? "0.00",
      totalRake: rakeSum[0]?.total ?? "0.00",
      totalBets: totalBetsSum[0]?.total ?? "0.00",
      netProfit: (parseFloat(gameWinSum[0]?.total ?? "0") - parseFloat(gameLossSum[0]?.total ?? "0")).toFixed(2),
    },
    agentInfo: {
      inviterName,
      downlineCount: downlineCount[0]?.count ?? 0,
      totalCommission: commissionTotal[0]?.total ?? "0.00",
    },
  };
}

/**
 * Get user's game history for admin panel
 */
export async function getUserGameHistory(userId: number, page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return { games: [], total: 0 };
  const offset = (page - 1) * limit;

  // Get hands the user participated in
  const playerHandIds = await db.select({ handId: handPlayers.handId })
    .from(handPlayers)
    .where(eq(handPlayers.userId, userId))
    .orderBy(desc(handPlayers.id))
    .limit(limit)
    .offset(offset);

  if (playerHandIds.length === 0) return { games: [], total: 0 };

  const handIds = playerHandIds.map(h => h.handId);
  const hands = await db.select().from(gameHands).where(inArray(gameHands.id, handIds)).orderBy(desc(gameHands.id));

  // Get room names
  const roomIds = [...new Set(hands.map(h => h.roomId))];
  const roomData = roomIds.length > 0
    ? await db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(inArray(rooms.id, roomIds))
    : [];
  const roomMap = Object.fromEntries(roomData.map(r => [r.id, r.name]));

  // Get player's data for each hand
  const games = await Promise.all(hands.map(async (hand) => {
    const myData = await db.select().from(handPlayers).where(
      and(eq(handPlayers.handId, hand.id), eq(handPlayers.userId, userId))
    );
    const playerData = myData[0];
    return {
      handId: hand.id,
      roomName: roomMap[hand.roomId] || `Room #${hand.roomId}`,
      potSize: hand.potSize,
      rakeAmount: hand.rakeAmount,
      completedAt: hand.completedAt,
      betAmount: playerData?.betAmount ?? "0.00",
      winAmount: playerData?.winAmount ?? "0.00",
      isWinner: playerData?.isWinner ?? false,
      pnl: ((parseFloat(playerData?.winAmount ?? "0")) - parseFloat(playerData?.betAmount ?? "0")).toFixed(2),
    };
  }));

  // Total count
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(handPlayers)
    .where(eq(handPlayers.userId, userId));

  return { games, total: countResult[0]?.count ?? 0 };
}
