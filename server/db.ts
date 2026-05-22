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

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
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
  return { users: data, total: countResult[0]?.count ?? 0 };
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
