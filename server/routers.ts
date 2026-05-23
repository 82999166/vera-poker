import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import * as tableManager from "./tableManager";

// Staff guard - supports both admin_users session and legacy game user roles
const staffProcedure = publicProcedure.use(({ ctx, next }) => {
  // New: admin_users table session
  if (ctx.adminUser) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  // Legacy: game user with staff role
  if (ctx.user && ["admin", "cs", "finance", "tech"].includes(ctx.user.role)) {
    return next({ ctx });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
});

// Admin guard - super_admin or admin role only
const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  // New: admin_users table session with admin/super_admin role
  if (ctx.adminUser && ["super_admin", "admin"].includes(ctx.adminUser.role)) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  // Legacy: game user with admin role
  if (ctx.user && ctx.user.role === "admin") {
    return next({ ctx });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // Admin session check - returns adminUser info if logged in via admin_users table
    adminMe: publicProcedure.query(opts => opts.ctx.adminUser),
    adminLogout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie("vera_admin_session", { path: "/" });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    bindTelegram: protectedProcedure
      .input(z.object({ tgId: z.string(), tgUsername: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.bindTelegramToUser(ctx.user.id, input.tgId, input.tgUsername);
        if (!success) {
          throw new TRPCError({ code: "CONFLICT", message: "Telegram account already bound to another user" });
        }
        return { success: true };
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
    // Resolve invite code to room ID
    resolveInviteCode: publicProcedure.input(z.object({ inviteCode: z.string() })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      const { rooms } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [room] = await dbInstance.select({ id: rooms.id, name: rooms.name, status: rooms.status })
        .from(rooms).where(eq(rooms.inviteCode, input.inviteCode)).limit(1);
      return room || null;
    }),
    // Invite a user to a private room
    invite: protectedProcedure.input(z.object({
      roomId: z.number(),
      targetUserId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const room = await db.getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      if (room.type !== "private") throw new TRPCError({ code: "BAD_REQUEST", message: "Only private rooms support invitations" });
      if (room.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only room owner can invite" });
      const inviter = await db.getUserById(ctx.user.id);
      const inviterName = inviter?.nickname || inviter?.name || "Player";
      // Send TG notification to the target user
      const { notifyPrivateRoomInvite } = await import("./notifications");
      await notifyPrivateRoomInvite(input.targetUserId, room.name, inviterName);
      return { success: true, inviteCode: room.inviteCode };
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
    adminUpdate: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["waiting", "playing", "paused", "closed"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateRoom(id, data);
      return { success: true };
    }),
    adminDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteRoom(input.id);
      return { success: true };
    }),
    adminCreate: adminProcedure.input(z.object({
      name: z.string().min(1).max(128),
      type: z.enum(["public", "private"]).default("public"),
      gameType: z.enum(["texas_holdem", "omaha"]).default("texas_holdem"),
      smallBlind: z.string(),
      bigBlind: z.string(),
      minBuyIn: z.string(),
      maxBuyIn: z.string(),
      maxPlayers: z.number().min(2).max(9).default(6),
      totalRounds: z.number().min(1).max(9999).nullable().optional(),
      billingMode: z.enum(["standard_rake", "per_round_fee"]).default("standard_rake"),
      roundFee: z.string().optional(),
      rakePercent: z.string().nullable().optional(),
      rakeCap: z.string().nullable().optional(),
      fairnessLevel: z.enum(["basic", "medium", "high"]).default("basic"),
    })).mutation(async ({ ctx, input }) => {
      const inviteCode = nanoid(8);
      const ownerId = ctx.adminUser?.adminId ?? ctx.user?.id ?? 0;
      const roomId = await db.createRoom({
        ...input,
        ownerId,
        inviteCode,
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        minBuyIn: input.minBuyIn,
        maxBuyIn: input.maxBuyIn,
        roundFee: input.roundFee ?? "0.00",
        rakePercent: input.rakePercent ?? null,
        rakeCap: input.rakeCap ?? null,
        totalRounds: input.totalRounds ?? null,
      });
      return { roomId, inviteCode };
    }),
    adminEdit: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      type: z.enum(["public", "private"]).optional(),
      status: z.enum(["waiting", "playing", "paused", "closed"]).optional(),
      gameType: z.enum(["texas_holdem", "omaha"]).optional(),
      smallBlind: z.string().optional(),
      bigBlind: z.string().optional(),
      minBuyIn: z.string().optional(),
      maxBuyIn: z.string().optional(),
      maxPlayers: z.number().min(2).max(9).optional(),
      totalRounds: z.number().min(1).max(9999).nullable().optional(),
      billingMode: z.enum(["standard_rake", "per_round_fee"]).optional(),
      roundFee: z.string().optional(),
      rakePercent: z.string().nullable().optional(),
      rakeCap: z.string().nullable().optional(),
      fairnessLevel: z.enum(["basic", "medium", "high"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const room = await db.getRoomById(id);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      await db.updateRoom(id, data);
      return { success: true };
    }),
    // User's own rooms
    myRooms: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserRooms(ctx.user.id);
    }),
  }),

  // ==================== WALLET / TRANSACTIONS ====================
  wallet: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { balance: user?.balance ?? "0.00", frozenBalance: user?.frozenBalance ?? "0.00" };
    }),
    depositAddress: protectedProcedure.input(z.object({
      chain: z.enum(["TRC20", "TON"]),
    })).query(async ({ ctx, input }) => {
      const address = await db.generateDepositAddress(ctx.user.id, input.chain);
      return { address, chain: input.chain };
    }),
    deposit: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "TON"]),
      txHash: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const depositAmount = parseFloat(input.amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid amount" });
      }
      // Check min deposit from config
      const minDeposit = parseFloat(await db.getConfigValue("min_deposit") || "10");
      if (depositAmount < minDeposit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum deposit is $${minDeposit}` });
      }
      // Create pending transaction (balance NOT updated until admin confirms)
      await db.createTransaction({
        userId: ctx.user.id,
        type: "deposit",
        amount: input.amount,
        balanceBefore: user.balance,
        balanceAfter: user.balance, // unchanged until confirmed
        chain: input.chain,
        txHash: input.txHash,
        status: "pending",
      });
      return { success: true, message: "Deposit submitted, awaiting confirmation" };
    }),
    withdraw: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "TON"]),
      walletAddress: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const currentBalance = parseFloat(user.balance);
      const currentFrozen = parseFloat(user.frozenBalance ?? "0");
      const withdrawAmount = parseFloat(input.amount);
      
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid amount" });
      }
      // Check min withdrawal from config
      const minWithdraw = parseFloat(await db.getConfigValue("min_withdraw") || "10");
      if (withdrawAmount < minWithdraw) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum withdrawal is $${minWithdraw}` });
      }
      if (withdrawAmount > currentBalance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      
      // Deduct from balance and add to frozen
      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      const newFrozen = (currentFrozen + withdrawAmount).toFixed(2);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(usersTable).set({ balance: newBalance, frozenBalance: newFrozen }).where(eq(usersTable.id, ctx.user.id));
      
      // Check auto-approve threshold
      const autoApproveLimit = parseFloat(await db.getConfigValue("auto_approve_limit") || "0");
      const isAutoApproved = autoApproveLimit > 0 && withdrawAmount <= autoApproveLimit;

      await db.createTransaction({
        userId: ctx.user.id,
        type: "withdraw",
        amount: input.amount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        chain: input.chain,
        walletAddress: input.walletAddress,
        status: isAutoApproved ? "confirmed" : "pending",
        note: isAutoApproved ? "auto_approved" : undefined,
      });

      // If auto-approved, release frozen balance immediately (amount was already frozen above)
      if (isAutoApproved) {
        const releasedFrozen = Math.max(0, parseFloat(newFrozen) - withdrawAmount).toFixed(2);
        await dbInstance.update(usersTable).set({ frozenBalance: releasedFrozen }).where(eq(usersTable.id, ctx.user.id));
      }

      return { success: true, newBalance, autoApproved: isAutoApproved };
    }),
    transactions: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
      return db.getUserTransactions(ctx.user.id, input.page, input.limit);
    }),
    // Admin
    allTransactions: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20), type: z.string().optional() })).query(async ({ input }) => {
      return db.getAllTransactions(input.page, input.limit, input.type);
    }),
    // Admin confirm deposit
    confirmDeposit: adminProcedure.input(z.object({
      transactionId: z.number(),
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { transactions, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [tx] = await dbInstance.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      if (tx.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction already processed" });
      if (tx.type !== "deposit") throw new TRPCError({ code: "BAD_REQUEST", message: "Not a deposit transaction" });
      // Update user balance
      const [user] = await dbInstance.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const newBalance = (parseFloat(user.balance) + parseFloat(tx.amount)).toFixed(2);
      await dbInstance.update(users).set({ balance: newBalance }).where(eq(users.id, tx.userId));
      // Update transaction status
      await dbInstance.update(transactions).set({ status: "confirmed", balanceAfter: newBalance }).where(eq(transactions.id, input.transactionId));
      return { success: true, newBalance };
    }),
    // Admin reject deposit/withdrawal
    rejectTransaction: adminProcedure.input(z.object({
      transactionId: z.number(),
      reason: z.string().optional(),
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { transactions, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [tx] = await dbInstance.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction already processed" });
      // If withdrawal was rejected, refund from frozen back to balance
      if (tx.type === "withdraw") {
        const [user] = await dbInstance.select().from(users).where(eq(users.id, tx.userId)).limit(1);
        if (user) {
          const refundBalance = (parseFloat(user.balance) + parseFloat(tx.amount)).toFixed(2);
          const newFrozen = Math.max(0, parseFloat(user.frozenBalance ?? "0") - parseFloat(tx.amount)).toFixed(2);
          await dbInstance.update(users).set({ balance: refundBalance, frozenBalance: newFrozen }).where(eq(users.id, tx.userId));
        }
      }
      await dbInstance.update(transactions).set({ status: "failed" }).where(eq(transactions.id, input.transactionId));
      return { success: true };
    }),
    // Admin confirm withdrawal
    confirmWithdrawal: adminProcedure.input(z.object({
      transactionId: z.number(),
      txHash: z.string().optional(),
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { transactions, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [tx] = await dbInstance.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction already processed" });
      if (tx.type !== "withdraw") throw new TRPCError({ code: "BAD_REQUEST", message: "Not a withdrawal" });
      // Reduce frozen balance
      const [user] = await dbInstance.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      if (user) {
        const newFrozen = Math.max(0, parseFloat(user.frozenBalance ?? "0") - parseFloat(tx.amount)).toFixed(2);
        await dbInstance.update(users).set({ frozenBalance: newFrozen }).where(eq(users.id, tx.userId));
      }
      await dbInstance.update(transactions).set({ status: "confirmed", txHash: input.txHash ?? tx.txHash }).where(eq(transactions.id, input.transactionId));
      return { success: true };
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
    // Table state polling endpoint
    tableState: protectedProcedure.input(z.object({ roomId: z.number() })).query(async ({ ctx, input }) => {
      return await tableManager.getPlayerView(input.roomId, ctx.user.id);
    }),
    // Join a table
    join: protectedProcedure.input(z.object({
      roomId: z.number(),
      buyIn: z.number().min(0),
    })).mutation(async ({ ctx, input }) => {
      const room = await db.getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const minBuyIn = parseFloat(room.minBuyIn);
      const maxBuyIn = parseFloat(room.maxBuyIn);
      if (input.buyIn < minBuyIn || input.buyIn > maxBuyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Buy-in must be between ${minBuyIn} and ${maxBuyIn}` });
      }
      // Check user balance
      const user = await db.getUserById(ctx.user.id);
      if (!user || parseFloat(user.balance) < input.buyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      // Deduct from balance
      const newBalance = (parseFloat(user.balance) - input.buyIn).toFixed(2);
      await db.updateUserBalance(ctx.user.id, newBalance);
      const result = await tableManager.joinTable(input.roomId, ctx.user.id, input.buyIn);
      if (!result.success) {
        // Refund
        await db.updateUserBalance(ctx.user.id, user.balance);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Cannot join table" });
      }
      // For private rooms, notify other players that someone joined
      if (room.type === "private") {
        const { notifyPrivateRoomInvite } = await import("./notifications");
        const players = await db.getRoomPlayers(input.roomId);
        const joinerName = user.nickname || user.name || "Player";
        for (const p of players) {
          if (p.userId !== ctx.user.id) {
            notifyPrivateRoomInvite(p.userId, room.name, joinerName).catch(() => {});
          }
        }
      }
      return { seatIndex: result.seatIndex, newBalance };
    }),
    // Leave a table
    leave: protectedProcedure.input(z.object({ roomId: z.number() })).mutation(async ({ ctx, input }) => {
      const result = await tableManager.leaveTable(input.roomId, ctx.user.id);
      // Return remaining chips to user balance
      if (result.remainingChips > 0) {
        const user = await db.getUserById(ctx.user.id);
        if (user) {
          const newBalance = (parseFloat(user.balance) + result.remainingChips).toFixed(2);
          await db.updateUserBalance(ctx.user.id, newBalance);
        }
      }
      return { success: result.success };
    }),
    // Player ready for next hand
    ready: protectedProcedure.input(z.object({ roomId: z.number() })).mutation(async ({ ctx, input }) => {
      const result = await tableManager.playerReady(input.roomId, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Ready failed" });
      }
      return { success: true };
    }),
    // Player action (fold/check/call/raise/all_in)
    action: protectedProcedure.input(z.object({
      roomId: z.number(),
      action: z.enum(["fold", "check", "call", "raise", "all_in"]),
      amount: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await tableManager.processPlayerAction(
        input.roomId,
        ctx.user.id,
        input.action as any,
        input.amount
      );
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Action failed" });
      }
      return { success: true };
    }),
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
    // Hand detail with player info
    handDetail: protectedProcedure.input(z.object({ handId: z.number() })).query(async ({ input }) => {
      const hand = await db.getGameHandById(input.handId);
      if (!hand) throw new TRPCError({ code: "NOT_FOUND", message: "Hand not found" });
      const players = await db.getHandPlayers(input.handId);
      // Enrich with user names
      const enrichedPlayers = await Promise.all(players.map(async (p) => {
        const user = await db.getUserById(p.userId);
        return { ...p, name: user?.name || `Player ${p.seatIndex + 1}` };
      }));
      return { ...hand, players: enrichedPlayers };
    }),
    lookupHand: publicProcedure.input(z.object({
      handId: z.number().optional(),
      txHash: z.string().optional(),
    })).query(async ({ input }) => {
      if (!input.handId && !input.txHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide handId or txHash" });
      }
      const hand = input.handId
        ? await db.getGameHandById(input.handId)
        : await db.getGameHandByTxHash(input.txHash!);
      if (!hand) throw new TRPCError({ code: "NOT_FOUND", message: "Hand not found" });
      return {
        id: hand.id,
        roomId: hand.roomId,
        serverSeed: hand.serverSeed,
        serverSeedHash: hand.serverSeedHash,
        clientSeed: hand.clientSeed,
        deckHash: hand.deckHash,
        communityCards: hand.communityCards,
        potSize: hand.potSize,
        status: hand.status,
        txHash: hand.txHash,
        startedAt: hand.startedAt,
        completedAt: hand.completedAt,
      };
    }),
    myRecentHands: protectedProcedure.input(z.object({ limit: z.number().default(5) })).query(async ({ ctx, input }) => {
      const hands = await db.getPlayerRecentHands(ctx.user.id, input.limit);
      return hands;
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

  // ==================== PROFILE ====================
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        avatar: user.avatar,
        email: user.email,
        language: user.language,
        tgId: user.tgId,
        tgUsername: user.tgUsername,
        balance: user.balance,
        frozenBalance: user.frozenBalance,
        totalGamesPlayed: user.totalGamesPlayed,
        totalRakeGenerated: user.totalRakeGenerated,
        totalDeposited: user.totalDeposited,
        inviteCode: user.inviteCode,
        agentLevel: user.agentLevel,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),
    update: protectedProcedure.input(z.object({
      nickname: z.string().min(1).max(64).optional(),
      avatar: z.string().optional(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.avatar !== undefined) updateData.avatar = input.avatar;
      if (input.language !== undefined) updateData.language = input.language;
      await dbInstance.update(users).set(updateData).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
    unbindTelegram: protectedProcedure.mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(users).set({ tgId: null, tgUsername: null }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
    gameStats: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalHands: 0, wins: 0, winRate: 0, totalProfit: "0.00" };
      const { handPlayers } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");
      const [stats] = await dbInstance.select({
        totalHands: sql<number>`count(*)`,
        wins: sql<number>`SUM(CASE WHEN isWinner = 1 THEN 1 ELSE 0 END)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(winAmount AS DECIMAL(18,2)) - CAST(betAmount AS DECIMAL(18,2))), 0)`,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id));
      const totalHands = stats?.totalHands ?? 0;
      const wins = stats?.wins ?? 0;
      return {
        totalHands,
        wins,
        winRate: totalHands > 0 ? Math.round((wins / totalHands) * 100) : 0,
        totalProfit: parseFloat(stats?.totalProfit ?? "0").toFixed(2),
      };
    }),
    achievements: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { all: [], unlocked: [] };
      const { achievements, playerAchievements, handPlayers, users } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");
      // Get all achievements
      const allAchievements = await dbInstance.select().from(achievements).orderBy(achievements.sortOrder);
      // Get user's unlocked achievements
      const unlocked = await dbInstance.select({
        achievementId: playerAchievements.achievementId,
        unlockedAt: playerAchievements.unlockedAt,
      }).from(playerAchievements).where(eq(playerAchievements.userId, ctx.user.id));
      const unlockedIds = new Set(unlocked.map(u => u.achievementId));
      // Get user stats for progress calculation
      const [stats] = await dbInstance.select({
        totalHands: sql<number>`count(*)`,
        wins: sql<number>`SUM(CASE WHEN isWinner = 1 THEN 1 ELSE 0 END)`,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id));
      const user = await db.getUserById(ctx.user.id);
      // Count invites from agent_relationships
      const { agentRelationships } = await import("../drizzle/schema");
      const { and: andOp } = await import("drizzle-orm");
      const [inviteCount] = await dbInstance.select({
        count: sql<number>`count(*)`,
      }).from(agentRelationships).where(andOp(eq(agentRelationships.agentId, ctx.user.id), eq(agentRelationships.level, 1)));
      // Get biggest pot and win streak from hand_players
      const [bigPot] = await dbInstance.select({
        maxWin: sql<string>`COALESCE(MAX(CAST(winAmount AS DECIMAL(18,2))), 0)`,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id));
      // Win streak: count consecutive wins from most recent hands
      const recentHands = await dbInstance.select({
        isWinner: handPlayers.isWinner,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id)).orderBy(sql`id DESC`).limit(100);
      let winStreak = 0;
      for (const h of recentHands) {
        if (h.isWinner) winStreak++;
        else break;
      }
      const userProgress: UserProgress = {
        hands_played: stats?.totalHands ?? 0,
        wins: stats?.wins ?? 0,
        total_deposited: parseFloat(user?.totalDeposited ?? "0"),
        invites: inviteCount?.count ?? 0,
        win_streak: winStreak,
        biggest_pot: parseFloat(bigPot?.maxWin ?? "0"),
      };
      return {
        all: allAchievements.map(a => ({
          ...a,
          isUnlocked: unlockedIds.has(a.id),
          progress: getAchievementProgress(a.condition as any, userProgress),
        })),
        unlocked: unlocked.map(u => u.achievementId),
      };
    }),
    checkAndUnlock: protectedProcedure.mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { newlyUnlocked: [] };
      const { achievements, playerAchievements, handPlayers, users } = await import("../drizzle/schema");
      const { eq, sql, and, notInArray } = await import("drizzle-orm");
      // Get already unlocked
      const alreadyUnlocked = await dbInstance.select({ achievementId: playerAchievements.achievementId })
        .from(playerAchievements).where(eq(playerAchievements.userId, ctx.user.id));
      const unlockedIds = alreadyUnlocked.map(u => u.achievementId);
      // Get all active achievements not yet unlocked
      let pendingAchievements;
      if (unlockedIds.length > 0) {
        pendingAchievements = await dbInstance.select().from(achievements)
          .where(and(eq(achievements.isActive, true), notInArray(achievements.id, unlockedIds)));
      } else {
        pendingAchievements = await dbInstance.select().from(achievements)
          .where(eq(achievements.isActive, true));
      }
      // Get user stats
      const [stats] = await dbInstance.select({
        totalHands: sql<number>`count(*)`,
        wins: sql<number>`SUM(CASE WHEN isWinner = 1 THEN 1 ELSE 0 END)`,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id));
      const user = await db.getUserById(ctx.user.id);
      // Count invites
      const { agentRelationships } = await import("../drizzle/schema");
      const [inviteCount] = await dbInstance.select({
        count: sql<number>`count(*)`,
      }).from(agentRelationships).where(and(eq(agentRelationships.agentId, ctx.user.id), eq(agentRelationships.level, 1)));
      // Biggest pot
      const [bigPot] = await dbInstance.select({
        maxWin: sql<string>`COALESCE(MAX(CAST(winAmount AS DECIMAL(18,2))), 0)`,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id));
      // Win streak
      const recentHands = await dbInstance.select({
        isWinner: handPlayers.isWinner,
      }).from(handPlayers).where(eq(handPlayers.userId, ctx.user.id)).orderBy(sql`id DESC`).limit(100);
      let winStreak = 0;
      for (const h of recentHands) {
        if (h.isWinner) winStreak++;
        else break;
      }
      const userProgress: UserProgress = {
        hands_played: stats?.totalHands ?? 0,
        wins: stats?.wins ?? 0,
        total_deposited: parseFloat(user?.totalDeposited ?? "0"),
        invites: inviteCount?.count ?? 0,
        win_streak: winStreak,
        biggest_pot: parseFloat(bigPot?.maxWin ?? "0"),
      };
      // Check each pending achievement and accumulate total reward
      const newlyUnlocked: number[] = [];
      let totalReward = 0;
      for (const achievement of pendingAchievements) {
        const condition = achievement.condition as { type: string; threshold: number };
        const progress = getProgressValue(condition.type, userProgress);
        if (progress >= condition.threshold) {
          await dbInstance.insert(playerAchievements).values({
            userId: ctx.user.id,
            achievementId: achievement.id,
          });
          newlyUnlocked.push(achievement.id);
          if (achievement.rewardAmount && parseFloat(achievement.rewardAmount) > 0) {
            totalReward += parseFloat(achievement.rewardAmount);
          }
        }
      }
      // Apply accumulated reward in one operation
      if (totalReward > 0 && user) {
        const newBalance = (parseFloat(user.balance) + totalReward).toFixed(2);
        await db.updateUserBalance(ctx.user.id, newBalance);
      }
      return { newlyUnlocked };
    }),
  }),

  // ==================== LEADERBOARD ====================
  leaderboard: router({
    profit: publicProcedure.input(z.object({ limit: z.number().default(20) })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { handPlayers, users } = await import("../drizzle/schema");
      const { sql, eq, desc } = await import("drizzle-orm");
      const result = await dbInstance.select({
        userId: handPlayers.userId,
        name: users.name,
        nickname: users.nickname,
        avatar: users.avatar,
        totalProfit: sql<string>`CAST(SUM(CAST(${handPlayers.winAmount} AS DECIMAL(18,2)) - CAST(${handPlayers.betAmount} AS DECIMAL(18,2))) AS CHAR)`,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.avatar)
        .orderBy(desc(sql`SUM(CAST(${handPlayers.winAmount} AS DECIMAL(18,2)) - CAST(${handPlayers.betAmount} AS DECIMAL(18,2)))`))
        .limit(input.limit);
      return result;
    }),
    winRate: publicProcedure.input(z.object({ limit: z.number().default(20), minHands: z.number().default(10) })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { handPlayers, users } = await import("../drizzle/schema");
      const { sql, eq, desc } = await import("drizzle-orm");
      const result = await dbInstance.select({
        userId: handPlayers.userId,
        name: users.name,
        nickname: users.nickname,
        avatar: users.avatar,
        winRate: sql<number>`ROUND(SUM(CASE WHEN ${handPlayers.isWinner} = 1 THEN 1 ELSE 0 END) * 100.0 / count(*), 1)`,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.avatar)
        .having(sql`count(*) >= ${input.minHands}`)
        .orderBy(desc(sql`SUM(CASE WHEN ${handPlayers.isWinner} = 1 THEN 1 ELSE 0 END) * 100.0 / count(*)`))
        .limit(input.limit);
      return result;
    }),
    handsPlayed: publicProcedure.input(z.object({ limit: z.number().default(20) })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { handPlayers, users } = await import("../drizzle/schema");
      const { sql, eq, desc } = await import("drizzle-orm");
      const result = await dbInstance.select({
        userId: handPlayers.userId,
        name: users.name,
        nickname: users.nickname,
        avatar: users.avatar,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.avatar)
        .orderBy(desc(sql`count(*)`))
        .limit(input.limit);
      return result;
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
    userDetail: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getUserDetail(input.id);
    }),
    userTransactions: adminProcedure.input(z.object({ userId: z.number(), page: z.number().default(1), limit: z.number().default(20), type: z.string().optional() })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { transactions: [], total: 0 };
      const { transactions } = await import("../drizzle/schema");
      const { eq, and, desc, sql } = await import("drizzle-orm");
      const offset = (input.page - 1) * input.limit;
      const conditions = input.type
        ? and(eq(transactions.userId, input.userId), eq(transactions.type, input.type as any))
        : eq(transactions.userId, input.userId);
      const [data, countResult] = await Promise.all([
        dbInstance.select().from(transactions).where(conditions).orderBy(desc(transactions.createdAt)).limit(input.limit).offset(offset),
        dbInstance.select({ count: sql<number>`count(*)` }).from(transactions).where(conditions),
      ]);
      return { transactions: data, total: countResult[0]?.count ?? 0 };
    }),
    userGameHistory: adminProcedure.input(z.object({ userId: z.number(), page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getUserGameHistory(input.userId, input.page, input.limit);
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
    // Agent management
    agents: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getAllAgentRelationships(input.page, input.limit);
    }),
    commissions: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getAllCommissions(input.page, input.limit);
    }),
    // Staff management (uses admin_users table - separate from game users)
    staffList: adminProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { adminUsers } = await import("../drizzle/schema");
      return dbInstance.select().from(adminUsers).orderBy(adminUsers.createdAt);
    }),
    staffCreate: adminProcedure.input(z.object({
      username: z.string().min(3).max(64),
      password: z.string().min(6).max(128),
      name: z.string().min(1).max(64),
      role: z.enum(["super_admin", "admin", "cs", "finance", "tech"]),
      permissions: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const { createStaffAccount } = await import("./staffAuth");
      const result = await createStaffAccount(input);
      if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      return { success: true, userId: result.userId };
    }),
    staffToggleActive: adminProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { adminUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(adminUsers).set({ isActive: input.isActive }).where(eq(adminUsers.id, input.id));
      return { success: true };
    }),
    staffDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      // Prevent deleting the current admin session user
      if (ctx.adminUser && ctx.adminUser.adminId === input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能删除自己" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { adminUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.delete(adminUsers).where(eq(adminUsers.id, input.id));
      return { success: true };
    }),
    staffResetPassword: adminProcedure.input(z.object({
      id: z.number(),
      newPassword: z.string().min(6).max(128),
    })).mutation(async ({ input }) => {
      const { updateStaffPassword } = await import("./staffAuth");
      const success = await updateStaffPassword(input.id, input.newPassword);
      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { success: true };
    }),
    // Manual top-up for game users
    manualTopUp: adminProcedure.input(z.object({
      userId: z.number(),
      amount: z.number().positive(),
      note: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users, transactions } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");
      const [user] = await dbInstance.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const newBalance = (parseFloat(user.balance) + input.amount).toFixed(2);
      await dbInstance.update(users).set({ balance: newBalance }).where(eq(users.id, input.userId));
      const operatorName = ctx.adminUser?.name || ctx.user?.name || "Admin";
      const operatorId = ctx.adminUser?.adminId || ctx.user?.id;
      await dbInstance.insert(transactions).values({
        userId: input.userId,
        type: "deposit",
        amount: input.amount.toFixed(2),
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        status: "confirmed",
        chain: "manual",
        txHash: `manual_${Date.now()}`,
        referenceType: "admin_topup",
        note: input.note ? `[Admin Top-Up by ${operatorName}] ${input.note}` : `[Admin Top-Up by ${operatorName}]`,
        operatorId: operatorId,
        operatorName: operatorName,
        createdAt: new Date(),
      });
      return { success: true, newBalance };
    }),
    // Stats
    stats: adminProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalUsers: 0, totalRooms: 0, totalTransactions: 0, totalVolume: "0.00", todayNewUsers: 0, todayActiveUsers: 0, totalBalance: "0.00" };
      const { users, rooms, transactions } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      
      const [userCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(users);
      const [roomCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(rooms);
      const [txCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(transactions);
      const [volume] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(transactions);
      // Today new users (registered today)
      const [todayNew] = await dbInstance.select({ count: sql<number>`count(*)` }).from(users)
        .where(sql`DATE(createdAt) = CURDATE()`);
      // Today active users (logged in today)
      const [todayActive] = await dbInstance.select({ count: sql<number>`count(*)` }).from(users)
        .where(sql`DATE(lastSignedIn) = CURDATE()`);
            // Total balance across all game users
      const [totalBal] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(balance), 0)` }).from(users);
      // Pending withdrawals
      const { eq, and } = await import("drizzle-orm");
      const [pendingWithdrawCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(transactions)
        .where(and(eq(transactions.type, "withdraw"), eq(transactions.status, "pending")));
      const [pendingWithdrawAmount] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(transactions)
        .where(and(eq(transactions.type, "withdraw"), eq(transactions.status, "pending")));
      // Rake stats
      const { gameHands } = await import("../drizzle/schema");
      const [totalRake] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(rakeAmount), 0)` }).from(gameHands);
      const [todayRake] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(rakeAmount), 0)` }).from(gameHands)
        .where(sql`DATE(startedAt) = CURDATE()`);
      const [totalHandsCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(gameHands)
        .where(sql`status = 'completed'`);
      const [todayHandsCount] = await dbInstance.select({ count: sql<number>`count(*)` }).from(gameHands)
        .where(sql`DATE(startedAt) = CURDATE() AND status = 'completed'`);
      return {
        totalUsers: userCount?.count ?? 0,
        totalRooms: roomCount?.count ?? 0,
        totalTransactions: txCount?.count ?? 0,
        totalVolume: volume?.total ?? "0.00",
        todayNewUsers: todayNew?.count ?? 0,
        todayActiveUsers: todayActive?.count ?? 0,
        totalBalance: parseFloat(totalBal?.total ?? "0").toFixed(2),
        pendingWithdrawals: pendingWithdrawCount?.count ?? 0,
        pendingWithdrawAmount: parseFloat(pendingWithdrawAmount?.total ?? "0").toFixed(2),
        totalRake: parseFloat(totalRake?.total ?? "0").toFixed(2),
        todayRake: parseFloat(todayRake?.total ?? "0").toFixed(2),
        totalHands: totalHandsCount?.count ?? 0,
        todayHands: todayHandsCount?.count ?? 0,
      };
    }),
    // Trend data for charts
    trends: adminProcedure.input(z.object({ days: z.number().default(14) })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { dailyUsers: [], dailyVolume: [], dailyHands: [] };
      const { users, transactions, gameHands } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      
      // Daily active users (users who signed in on each day)
      const dailyUsers = await dbInstance.select({
        date: sql<string>`DATE(lastSignedIn)`.as("date"),
        count: sql<number>`count(*)`,
      }).from(users)
        .where(sql`lastSignedIn >= DATE_SUB(CURDATE(), INTERVAL ${input.days} DAY)`)
        .groupBy(sql`DATE(lastSignedIn)`)
        .orderBy(sql`DATE(lastSignedIn)`);
      
      // Daily transaction volume
      const dailyVolume = await dbInstance.select({
        date: sql<string>`DATE(createdAt)`.as("date"),
        volume: sql<string>`COALESCE(SUM(amount), 0)`,
        count: sql<number>`count(*)`,
      }).from(transactions)
        .where(sql`createdAt >= DATE_SUB(CURDATE(), INTERVAL ${input.days} DAY)`)
        .groupBy(sql`DATE(createdAt)`)
        .orderBy(sql`DATE(createdAt)`);
      
      // Daily hands played (room usage)
      const dailyHands = await dbInstance.select({
        date: sql<string>`DATE(startedAt)`.as("date"),
        count: sql<number>`count(*)`,
      }).from(gameHands)
        .where(sql`startedAt >= DATE_SUB(CURDATE(), INTERVAL ${input.days} DAY)`)
        .groupBy(sql`DATE(startedAt)`)
        .orderBy(sql`DATE(startedAt)`);
      
      // Daily rake
      const dailyRake = await dbInstance.select({
        date: sql<string>`DATE(startedAt)`.as("date"),
        total: sql<string>`COALESCE(SUM(rakeAmount), 0)`,
        hands: sql<number>`count(*)`,
      }).from(gameHands)
        .where(sql`startedAt >= DATE_SUB(CURDATE(), INTERVAL ${input.days} DAY) AND status = 'completed'`)
        .groupBy(sql`DATE(startedAt)`)
        .orderBy(sql`DATE(startedAt)`);
      
      return { dailyUsers, dailyVolume, dailyHands, dailyRake };
    }),
    // Rake detail records
    rakeRecords: staffProcedure.input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      roomId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { records: [], total: 0, summary: { totalRake: "0.00", totalHands: 0, avgRake: "0.00" } };
      const { gameHands, rooms } = await import("../drizzle/schema");
      const { sql, eq, and, gte, lte } = await import("drizzle-orm");
      
      const conditions: any[] = [sql`${gameHands.status} = 'completed'`, sql`${gameHands.rakeAmount} > 0`];
      if (input.roomId) conditions.push(eq(gameHands.roomId, input.roomId));
      if (input.dateFrom) conditions.push(gte(gameHands.startedAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(gameHands.startedAt, new Date(input.dateTo)));
      
      const whereClause = and(...conditions);
      
      const [countResult] = await dbInstance.select({ count: sql<number>`count(*)` }).from(gameHands).where(whereClause);
      const [sumResult] = await dbInstance.select({ total: sql<string>`COALESCE(SUM(rakeAmount), 0)`, avg: sql<string>`COALESCE(AVG(rakeAmount), 0)` }).from(gameHands).where(whereClause);
      
      const records = await dbInstance.select({
        id: gameHands.id,
        roomId: gameHands.roomId,
        handNumber: gameHands.handNumber,
        potSize: gameHands.potSize,
        rakeAmount: gameHands.rakeAmount,
        startedAt: gameHands.startedAt,
        completedAt: gameHands.completedAt,
      }).from(gameHands)
        .where(whereClause)
        .orderBy(sql`${gameHands.startedAt} DESC`)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      
      return {
        records,
        total: countResult?.count ?? 0,
        summary: {
          totalRake: parseFloat(sumResult?.total ?? "0").toFixed(2),
          totalHands: countResult?.count ?? 0,
          avgRake: parseFloat(sumResult?.avg ?? "0").toFixed(4),
        },
      };
    }),
    // Send notification to user(s)
    sendNotification: adminProcedure.input(z.object({
      userIds: z.array(z.number()),
      title: z.string().min(1),
      body: z.string().min(1),
      type: z.enum(["private_room_invite", "turn_action", "game_starting", "balance_change", "system_announcement"]).default("system_announcement"),
    })).mutation(async ({ input }) => {
      const { sendBatchNotification } = await import("./notifications");
      const result = await sendBatchNotification(input.userIds, input.type, input.title, input.body);
      return result;
    }),
    // Migrate staff users from users table to admin_users
    migrateStaffUsers: adminProcedure.mutation(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { migrated: 0, message: "DB not available" };
      const { users, adminUsers } = await import("../drizzle/schema");
      const { sql, inArray } = await import("drizzle-orm");
      // Find users with staff roles that are not yet in admin_users
      const staffUsers = await dbInstance.select().from(users)
        .where(inArray(users.role, ["admin", "cs", "finance", "tech"]));
      if (staffUsers.length === 0) return { migrated: 0, message: "No staff users to migrate" };
      let migrated = 0;
      for (const u of staffUsers) {
        // Check if already exists in admin_users
        const existing = await dbInstance.select().from(adminUsers)
          .where(sql`${adminUsers.username} = ${u.tgId || u.openId || String(u.id)}`);
        if (existing.length > 0) continue;
        // Create admin_users entry with a simple hash placeholder
        const crypto = await import("crypto");
        const defaultPwd = crypto.createHash("sha256").update("changeme123").digest("hex");
        await dbInstance.insert(adminUsers).values({
          username: u.tgId || u.openId || String(u.id),
          passwordHash: defaultPwd,
          name: u.name || `Staff ${u.id}`,
          role: u.role === "admin" ? "admin" : u.role as any,
          permissions: [],
          isActive: true,
        });
        // Reset user role to 'user'
        await dbInstance.update(users).set({ role: "user" }).where(sql`${users.id} = ${u.id}`);
        migrated++;
      }
      return { migrated, message: `Migrated ${migrated} staff users` };
    }),
    // Get count of unmigrated staff users
    unmigratedStaffCount: staffProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { count: 0 };
      const { users } = await import("../drizzle/schema");
      const { sql, inArray } = await import("drizzle-orm");
      const [result] = await dbInstance.select({ count: sql<number>`count(*)` }).from(users)
        .where(inArray(users.role, ["admin", "cs", "finance", "tech"]));
      return { count: result?.count ?? 0 };
    }),
  }),
});
export type AppRouter = typeof appRouter;

// Achievement progress helpers
interface UserProgress {
  hands_played: number;
  wins: number;
  total_deposited: number;
  invites: number;
  win_streak: number;
  biggest_pot: number;
}

function getProgressValue(type: string, userProgress: UserProgress): number {
  switch (type) {
    case "hands_played": return userProgress.hands_played;
    case "wins": return userProgress.wins;
    case "total_deposited": return userProgress.total_deposited;
    case "invites": return userProgress.invites;
    case "win_streak": return userProgress.win_streak;
    case "biggest_pot": return userProgress.biggest_pot;
    default: return 0;
  }
}

function getAchievementProgress(condition: { type: string; threshold: number }, userProgress: UserProgress): number {
  const current = getProgressValue(condition.type, userProgress);
  return Math.min(Math.round((current / condition.threshold) * 100), 100);
}

