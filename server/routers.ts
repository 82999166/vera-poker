import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== CONFIG ====================
  config: router({
    getPublic: publicProcedure.query(async () => {
      const configs = await db.getPublicConfigs();
      const result: Record<string, string> = {};
      for (const c of configs) {
        result[c.key] = c.value;
      }
      return result;
    }),
    getAll: adminProcedure.query(async () => {
      return db.getAllConfigs();
    }),
    getByCategory: adminProcedure.input(z.object({ category: z.string() })).query(async ({ input }) => {
      return db.getConfigsByCategory(input.category);
    }),
    upsert: adminProcedure.input(z.object({
      key: z.string(),
      value: z.string(),
      category: z.string(),
      label: z.string(),
      valueType: z.enum(["string", "number", "boolean", "json"]).default("string"),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
    })).mutation(async ({ input }) => {
      await db.upsertConfig(input.key, input.value, input.category, input.label, input.valueType, input.description, input.isPublic);
      return { success: true };
    }),
  }),

  // ==================== ROOMS ====================
  rooms: router({
    list: publicProcedure.query(async () => {
      return db.getPublicRooms();
    }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getRoomById(input.id);
    }),
    getPlayers: publicProcedure.input(z.object({ roomId: z.number() })).query(async ({ input }) => {
      return db.getRoomPlayers(input.roomId);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(128),
      type: z.enum(["public", "private"]).default("private"),
      gameType: z.enum(["texas_holdem", "omaha"]).default("texas_holdem"),
      smallBlind: z.string(),
      bigBlind: z.string(),
      minBuyIn: z.string(),
      maxBuyIn: z.string(),
      maxPlayers: z.number().min(2).max(9).default(6),
      totalRounds: z.number().min(1).max(200).optional(),
      billingMode: z.enum(["standard_rake", "per_round_fee"]).default("standard_rake"),
      roundFee: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const inviteCode = nanoid(8);
      const roomId = await db.createRoom({
        ...input,
        ownerId: ctx.user.id,
        inviteCode,
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        minBuyIn: input.minBuyIn,
        maxBuyIn: input.maxBuyIn,
        roundFee: input.roundFee ?? "0.00",
      });
      return { roomId, inviteCode };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["waiting", "playing", "paused", "closed"]).optional(),
      currentPlayers: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const room = await db.getRoomById(input.id);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.ownerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, ...data } = input;
      await db.updateRoom(id, data);
      return { success: true };
    }),
    // Admin: manage all rooms
    adminList: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { rooms: [], total: 0 };
      const { rooms: roomsTable } = await import("../drizzle/schema");
      const { desc, sql } = await import("drizzle-orm");
      const offset = (input.page - 1) * input.limit;
      const [data, countResult] = await Promise.all([
        dbInstance.select().from(roomsTable).orderBy(desc(roomsTable.createdAt)).limit(input.limit).offset(offset),
        dbInstance.select({ count: sql<number>`count(*)` }).from(roomsTable),
      ]);
      return { rooms: data, total: countResult[0]?.count ?? 0 };
    }),
  }),

  // ==================== WALLET / TRANSACTIONS ====================
  wallet: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { balance: user?.balance ?? "0.00", frozenBalance: user?.frozenBalance ?? "0.00" };
    }),
    deposit: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "TON"]),
      txHash: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const currentBalance = parseFloat(user.balance);
      const depositAmount = parseFloat(input.amount);
      const newBalance = (currentBalance + depositAmount).toFixed(2);
      
      await db.updateUserBalance(ctx.user.id, newBalance);
      await db.createTransaction({
        userId: ctx.user.id,
        type: "deposit",
        amount: input.amount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        chain: input.chain,
        txHash: input.txHash,
        status: "pending",
      });
      return { success: true, newBalance };
    }),
    withdraw: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "TON"]),
      walletAddress: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const currentBalance = parseFloat(user.balance);
      const withdrawAmount = parseFloat(input.amount);
      
      if (withdrawAmount > currentBalance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      
      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      await db.updateUserBalance(ctx.user.id, newBalance);
      await db.createTransaction({
        userId: ctx.user.id,
        type: "withdraw",
        amount: input.amount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        chain: input.chain,
        walletAddress: input.walletAddress,
        status: "pending",
      });
      return { success: true, newBalance };
    }),
    transactions: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
      return db.getUserTransactions(ctx.user.id, input.page, input.limit);
    }),
    // Admin
    allTransactions: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20), type: z.string().optional() })).query(async ({ input }) => {
      return db.getAllTransactions(input.page, input.limit, input.type);
    }),
  }),

  // ==================== AGENT ====================
  agent: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      
      const downlines = await db.getAgentDownlines(ctx.user.id);
      const commissions = await db.getAgentCommissions(ctx.user.id, 1, 10);
      
      const totalEarnings = downlines.reduce((sum, d) => sum + parseFloat(d.totalCommissionEarned ?? "0"), 0);
      const unlockedCount = downlines.filter(d => d.isUnlocked).length;

      return {
        inviteCode: user.inviteCode ?? "",
        inviteLink: `https://t.me/VeraPokerBot?start=ref_${user.inviteCode ?? ""}`,
        totalDownlines: downlines.length,
        unlockedDownlines: unlockedCount,
        totalEarnings: totalEarnings.toFixed(2),
        availableBalance: user.balance,
        recentCommissions: commissions.records,
      };
    }),
    register: protectedProcedure.input(z.object({ inviteCode: z.string() })).mutation(async ({ ctx, input }) => {
      // Find the inviter
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      const [inviter] = await dbInstance.select().from(users).where(eq(users.inviteCode, input.inviteCode)).limit(1);
      if (!inviter) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      if (inviter.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot invite yourself" });

      // Create level 1 relationship
      await db.createAgentRelationship(inviter.id, ctx.user.id, 1);
      
      // If inviter was also invited, create level 2 relationship
      if (inviter.invitedBy) {
        await db.createAgentRelationship(inviter.invitedBy, ctx.user.id, 2);
      }

      // Update user's invitedBy
      await dbInstance.update(users).set({ invitedBy: inviter.id }).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
    downlines: protectedProcedure.query(async ({ ctx }) => {
      return db.getAgentDownlines(ctx.user.id);
    }),
    commissions: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
      return db.getAgentCommissions(ctx.user.id, input.page, input.limit);
    }),
  }),

  // ==================== GAME ====================
  game: router({
    handHistory: protectedProcedure.input(z.object({ roomId: z.number(), limit: z.number().default(50) })).query(async ({ input }) => {
      return db.getHandHistory(input.roomId, input.limit);
    }),
    verify: publicProcedure.input(z.object({
      serverSeed: z.string(),
      clientSeed: z.string(),
      serverSeedHash: z.string(),
      deckHash: z.string(),
    })).query(({ input }) => {
      const { verifyFairness } = require("./gameEngine");
      return verifyFairness(input.serverSeed, input.clientSeed, input.serverSeedHash, input.deckHash);
    }),
  }),

  // ==================== AI CUSTOMER SERVICE ====================
  cs: router({
    chat: protectedProcedure.input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().default("en"),
    })).mutation(async ({ ctx, input }) => {
      // Get FAQ knowledge base for context
      const faqs = await db.getActiveFaqs(input.language);
      const faqContext = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

      const systemPrompt = `You are Vera Poker's AI customer service assistant. You help players with questions about the game, their accounts, deposits, withdrawals, and general poker rules.

Available FAQ Knowledge:
${faqContext}

Rules:
- Be helpful, concise, and professional
- If you cannot answer a question, suggest the user contact human support
- Respond in the user's language: ${input.language}
- Never reveal sensitive system information
- For account-specific queries, inform the user you can help with general questions but specific account issues need human support`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.message },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const aiResponse = typeof rawContent === "string" ? rawContent : (rawContent ? JSON.stringify(rawContent) : "I'm sorry, I couldn't process your request. Please try again.");
        return { response: aiResponse, resolvedBy: "ai" as const };
      } catch (error) {
        return { response: "I'm experiencing technical difficulties. Please try again later or contact human support.", resolvedBy: "ai" as const };
      }
    }),
    faqs: publicProcedure.input(z.object({ language: z.string().default("en") })).query(async ({ input }) => {
      return db.getActiveFaqs(input.language);
    }),
  }),

  // ==================== NOTIFICATIONS ====================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { notifications } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(notifications).set({ isRead: true }).where(eq(notifications.id, input.id));
      return { success: true };
    }),
  }),

  // ==================== ADMIN ====================
  admin: router({
    users: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getAllUsers(input.page, input.limit);
    }),
    updateUser: adminProcedure.input(z.object({
      id: z.number(),
      riskLevel: z.enum(["normal", "watch", "frozen", "banned"]).optional(),
      role: z.enum(["user", "admin"]).optional(),
      balance: z.string().optional(),
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const updateData: any = {};
      if (input.riskLevel) updateData.riskLevel = input.riskLevel;
      if (input.role) updateData.role = input.role;
      if (input.balance) updateData.balance = input.balance;
      await dbInstance.update(users).set(updateData).where(eq(users.id, input.id));
      return { success: true };
    }),
    riskEvents: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getRiskEvents(input.page, input.limit);
    }),
    // FAQ management
    faqList: adminProcedure.query(async () => {
      return db.getAllFaqs();
    }),
    faqUpsert: adminProcedure.input(z.object({
      id: z.number().optional(),
      category: z.string(),
      question: z.string(),
      answer: z.string(),
      keywords: z.string().optional(),
      language: z.string().default("en"),
      sortOrder: z.number().default(0),
      isActive: z.boolean().default(true),
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { faqEntries } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      if (input.id) {
        const { id, ...data } = input;
        await dbInstance.update(faqEntries).set(data).where(eq(faqEntries.id, id));
      } else {
        const { id, ...data } = input;
        await dbInstance.insert(faqEntries).values(data);
      }
      return { success: true };
    }),
    faqDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { faqEntries } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.delete(faqEntries).where(eq(faqEntries.id, input.id));
      return { success: true };
    }),
    // Stats
    stats: adminProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalUsers: 0, totalRooms: 0, totalTransactions: 0, totalVolume: "0.00" };
      const { users, rooms, transactions } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      
      const [userCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(users);
      const [roomCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(rooms);
      const [txCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(transactions);
      const [volume] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(transactions);
      
      return {
        totalUsers: userCount?.count ?? 0,
        totalRooms: roomCount?.count ?? 0,
        totalTransactions: txCount?.count ?? 0,
        totalVolume: volume?.total ?? "0.00",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
