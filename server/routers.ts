/**
 * tRPC 路由定义 - 所有 API 接口的入口
 * 包含：认证、游戏操作、钱包、代理、管理后台、AI客服、锦标赛等
 */
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./deepseek";
import { nanoid } from "nanoid";
import * as tableManager from "./tableManager";
import * as botManager from "./botManager";

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
    clearNewDeviceCookie: publicProcedure.mutation(({ ctx }) => {
      // Clear the short-lived new device cookie
      ctx.res.clearCookie("vera_new_device", { path: "/" });
      return { success: true };
    }),
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Check if this is a new device login (short-lived cookie set by OAuth callback)
      const cookies = opts.ctx.req.headers.cookie || "";
      const newDeviceMatch = cookies.match(/vera_new_device=1/);
      return { ...user, newDeviceLogin: !!newDeviceMatch };
    }),
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

    // ==================== PASSWORD BACKUP LOGIN ====================
    // Check if user has a backup password set
    hasPassword: protectedProcedure.query(async ({ ctx }) => {
      const hash = await db.getUserPasswordHash(ctx.user.id);
      return { hasPassword: !!hash };
    }),

    // Set or update backup password
    setPassword: protectedProcedure
      .input(z.object({
        newPassword: z.string().min(6).max(64),
        currentPassword: z.string().optional(), // required if already has password
      }))
      .mutation(async ({ ctx, input }) => {
        const existingHash = await db.getUserPasswordHash(ctx.user.id);
        // If user already has a password, verify current password first
        if (existingHash) {
          if (!input.currentPassword) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Current password required" });
          }
          const valid = await bcrypt.compare(input.currentPassword, existingHash);
          if (!valid) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password incorrect" });
          }
        }
        const hash = await bcrypt.hash(input.newPassword, 10);
        await db.setUserPasswordHash(ctx.user.id, hash);
        return { success: true };
      }),

    // Remove backup password
    removePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const existingHash = await db.getUserPasswordHash(ctx.user.id);
        if (!existingHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No password set" });
        }
        const valid = await bcrypt.compare(input.currentPassword, existingHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Password incorrect" });
        }
        await db.setUserPasswordHash(ctx.user.id, "");
        return { success: true };
      }),

    // Password login - user provides tgId/nickname + password
    passwordLogin: publicProcedure
      .input(z.object({
        identifier: z.string(), // tgId, tgUsername, or nickname
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByTgIdOrNickname(input.identifier);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        const hash = await db.getUserPasswordHash(user.id);
        if (!hash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Password login not set up for this account" });
        }
        const valid = await bcrypt.compare(input.password, hash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
        }
        // Create session token using the same SDK method as OAuth login
        const { sdk } = await import("./_core/sdk");
        const { ONE_YEAR_MS } = await import("@shared/const");
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.nickname || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: { id: user.id, name: user.name, nickname: user.nickname, tgId: user.tgId } };
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
      db.createAdminLog({ action: "update_config", category: "config", targetType: "config", targetId: input.key, detail: { value: input.value, category: input.category } });
      
      // FIX #2: When share_banner_url is saved, auto-upload to Telegram to get file_id
      if (input.key === "share_banner_url" && input.value) {
        try {
          const botToken = await db.getConfigValue("tg_bot_token");
          if (botToken) {
            // Use the banner URL - if relative, prepend domain
            const photoUrl = input.value.startsWith("http") ? input.value : `https://game.verapoker.com${input.value}`;
            // Send photo to bot's own saved messages (use owner tgId)
            const ownerTgId = "6421271088"; // Bot owner for file upload
            const sendResp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: ownerTgId, photo: photoUrl, caption: "Banner updated" })
            });
            const sendResult = await sendResp.json() as { ok: boolean; result?: { photo?: Array<{ file_id: string }> } };
            if (sendResult.ok && sendResult.result?.photo?.length) {
              const largestPhoto = sendResult.result.photo[sendResult.result.photo.length - 1];
              const newFileId = largestPhoto.file_id;
              // Save the new file_id
              await db.upsertConfig("share_banner_file_id", newFileId, "system", "share_banner_file_id", "string", "Telegram file_id for share banner", false);
              console.log("[Config] Auto-updated share_banner_file_id:", newFileId);
            } else {
              console.error("[Config] Failed to upload banner to TG:", sendResult);
            }
          }
        } catch (err) {
          console.error("[Config] Failed to auto-upload banner to TG:", err);
        }
      }

      // FIX #1: When tg_webhook_secret is saved, auto-call Telegram setWebhook with secret_token
      if (input.key === "tg_webhook_secret" || input.key === "tg_bot_token" || input.key === "tg_webhook_url") {
        try {
          const botToken = input.key === "tg_bot_token" ? input.value : await db.getConfigValue("tg_bot_token");
          const webhookUrl = input.key === "tg_webhook_url" ? input.value : await db.getConfigValue("tg_webhook_url");
          const webhookSecret = input.key === "tg_webhook_secret" ? input.value : await db.getConfigValue("tg_webhook_secret");
          if (botToken && webhookUrl) {
            const params: Record<string, string> = { url: webhookUrl };
            if (webhookSecret) params.secret_token = webhookSecret;
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(params),
            });
            const result = await resp.json();
            console.log("[Config] Auto setWebhook result:", result);
          }
        } catch (err) {
          console.error("[Config] Failed to auto-set webhook:", err);
        }
      }
      
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
      // Return both active and sitting_out players so frontend can correctly identify seated players
      return db.getRoomPlayersAll(input.roomId);
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
      const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
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
      db.createAdminLog({ action: "update_room", category: "room", targetType: "room", targetId: String(id), detail: data });
      return { success: true };
    }),
    adminDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteRoom(input.id);
      db.createAdminLog({ action: "delete_room", category: "room", targetType: "room", targetId: String(input.id) });
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
      const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
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
      db.createAdminLog({ action: "create_room", category: "room", targetType: "room", targetId: String(roomId), detail: { name: input.name, type: input.type } });
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
      db.createAdminLog({ action: "edit_room", category: "room", targetType: "room", targetId: String(id), detail: data });
      return { success: true };
    }),
    // Duplicate a room with the same config (new name suffix, new inviteCode, status=waiting)
    duplicate: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const source = await db.getRoomById(input.id);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
      const ownerId = ctx.adminUser?.adminId ?? ctx.user?.id ?? 0;
      const newRoomId = await db.createRoom({
        name: `${source.name} (Copy)`,
        type: source.type,
        gameType: source.gameType,
        smallBlind: source.smallBlind,
        bigBlind: source.bigBlind,
        minBuyIn: source.minBuyIn,
        maxBuyIn: source.maxBuyIn,
        maxPlayers: source.maxPlayers,
        totalRounds: source.totalRounds ?? null,
        billingMode: source.billingMode,
        roundFee: source.roundFee ?? "0.00",
        rakePercent: source.rakePercent ?? null,
        rakeCap: source.rakeCap ?? null,
        fairnessLevel: source.fairnessLevel,
        ownerId,
        inviteCode,
      });
      db.createAdminLog({ action: "duplicate_room", category: "room", targetType: "room", targetId: String(newRoomId), detail: { sourceId: input.id } });
      return { roomId: newRoomId, inviteCode };
    }),
    // User's own rooms
    myRooms: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserRooms(ctx.user.id);
    }),
    // Get player's currently active room (if seated somewhere)
    myActiveRoom: protectedProcedure.query(async ({ ctx }) => {
      const activeRoom = await db.getPlayerActiveRoom(ctx.user.id);
      if (!activeRoom) return null;
      const room = await db.getRoomById(activeRoom.roomId);
      if (!room) return null;
      return { roomId: activeRoom.roomId, seatIndex: activeRoom.seatIndex, roomName: room.name, blinds: `${room.smallBlind}/${room.bigBlind}`, status: activeRoom.status };
    }),
    // Join by stake level - auto-assign to best available table
    // buyIn=0: only find & return roomId (navigate to table, buy-in dialog shown there)
    // buyIn>0: find table AND join with specified buy-in amount
    joinByStake: protectedProcedure.input(z.object({
      smallBlind: z.string(),
      bigBlind: z.string(),
      buyIn: z.number().min(0),
    })).mutation(async ({ ctx, input }) => {
      const allRooms = await db.getPublicRooms();
      const matchingRooms = allRooms.filter(r =>
        r.smallBlind === input.smallBlind &&
        r.bigBlind === input.bigBlind &&
        (r.status === "waiting" || r.status === "playing") &&
        r.currentPlayers < r.maxPlayers
      );
      if (matchingRooms.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No available tables for this stake level" });
      }
      // Pick table with most players (most action) but not full
      const targetRoom = matchingRooms.sort((a, b) => b.currentPlayers - a.currentPlayers)[0];
      // buyIn=0: lobby navigation mode - just return the roomId, buy-in happens in Table.tsx
      if (input.buyIn === 0) {
        return { roomId: targetRoom.id, seatIndex: -1, newBalance: null, roomName: targetRoom.name };
      }
      // buyIn>0: full join flow
      const minBuyIn = parseFloat(targetRoom.minBuyIn);
      const maxBuyIn = parseFloat(targetRoom.maxBuyIn);
      if (input.buyIn < minBuyIn || input.buyIn > maxBuyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Buy-in must be between ${minBuyIn} and ${maxBuyIn}` });
      }
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (parseFloat(user.balance) < input.buyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      const balanceBefore = user.balance;
      const newBalance = await db.deductUserBalanceAtomic(ctx.user.id, input.buyIn);
      if (newBalance === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      const result = await tableManager.joinTable(targetRoom.id, ctx.user.id, input.buyIn);
      if (!result.success) {
        // Refund atomically instead of setting old balance (prevents race condition)
        await db.addUserBalanceAtomic(ctx.user.id, input.buyIn);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Cannot join table" });
      }
      await db.createTransaction({
        userId: ctx.user.id,
        type: "buy_in",
        amount: input.buyIn.toFixed(2),
        balanceBefore,
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: targetRoom.id,
        note: `Buy-in (auto): ${targetRoom.name}`,
      });
      return { roomId: targetRoom.id, seatIndex: result.seatIndex, newBalance, roomName: targetRoom.name };
    }),
    // Switch table - move to another table at same stake level, carrying chips
    switchTable: protectedProcedure.input(z.object({
      currentRoomId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const currentRoom = await db.getRoomById(input.currentRoomId);
      if (!currentRoom) throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      const currentChips = await tableManager.getPlayerChips(input.currentRoomId, ctx.user.id);
      if (currentChips < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not seated at this table" });
      }
      const allRooms = await db.getPublicRooms();
      const candidates = allRooms.filter(r =>
        r.id !== input.currentRoomId &&
        r.smallBlind === currentRoom.smallBlind &&
        r.bigBlind === currentRoom.bigBlind &&
        (r.status === "waiting" || r.status === "playing") &&
        r.currentPlayers < r.maxPlayers
      );
      if (candidates.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No other tables available at this stake level" });
      }
      const targetRoom = candidates.sort((a, b) => b.currentPlayers - a.currentPlayers)[0];
      const targetMinBuyIn = parseFloat(targetRoom.minBuyIn);
      const targetMaxBuyIn = parseFloat(targetRoom.maxBuyIn);
      const chipsToCarry = Math.min(currentChips, targetMaxBuyIn);
      const lowChips = chipsToCarry < targetMinBuyIn * 0.5;
      // Leave current table
      await tableManager.leaveTable(input.currentRoomId, ctx.user.id);
      // Join target table with carried chips
      const joinResult = await tableManager.joinTable(targetRoom.id, ctx.user.id, chipsToCarry);
      if (!joinResult.success) {
        // Refund chips to balance if join fails
        await db.addUserBalanceAtomic(ctx.user.id, chipsToCarry);
        throw new TRPCError({ code: "BAD_REQUEST", message: joinResult.message || "Cannot join target table" });
      }
      await db.createTransaction({
        userId: ctx.user.id,
        type: "buy_in",
        amount: chipsToCarry.toFixed(2),
        balanceBefore: "0",
        balanceAfter: "0",
        status: "confirmed",
        referenceType: "room",
        referenceId: targetRoom.id,
        note: `Switch table: ${currentRoom.name} -> ${targetRoom.name}`,
      });
      return {
        newRoomId: targetRoom.id,
        newRoomName: targetRoom.name,
        seatIndex: joinResult.seatIndex,
        chips: chipsToCarry,
        lowChips,
        targetMinBuyIn,
      };
    }),
  }),

  // ==================== WALLET / TRANSACTIONS ====================
  wallet: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { 
        balance: user?.balance ?? "0.00", 
        frozenBalance: user?.frozenBalance ?? "0.00",
        bonusBalance: user?.bonusBalance ?? "0.00",
        bonusUnlocked: user?.bonusUnlocked ?? false,
      };
    }),
    bonusProgress: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserBonusProgress(ctx.user.id);
    }),
    depositAddress: protectedProcedure.input(z.object({
      chain: z.enum(["TRC20", "ERC20", "BEP20", "TON", "Polygon"]),
    })).query(async ({ ctx, input }) => {
      const address = await db.generateDepositAddress(ctx.user.id, input.chain);
      return { address, chain: input.chain };
    }),
    deposit: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "ERC20", "BEP20", "TON", "Polygon"]),
      txHash: z.string().optional(), // Optional - if not provided, system will auto-detect via address monitoring
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
      // SECURITY FIX #9: Check txHash uniqueness to prevent replay attacks
      if (input.txHash) {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { transactions: txTable } = await import("../drizzle/schema");
          const { eq: eqOp } = await import("drizzle-orm");
          const [existingTx] = await dbInstance.select({ id: txTable.id }).from(txTable).where(eqOp(txTable.txHash, input.txHash)).limit(1);
          if (existingTx) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This transaction hash has already been submitted" });
          }
        }
      }
      // Create pending transaction (balance NOT updated until admin confirms)
      await db.createTransaction({
        userId: ctx.user.id,
        type: "deposit",
        amount: input.amount,
        balanceBefore: user.balance,
        balanceAfter: user.balance, // unchanged until confirmed
        chain: input.chain,
        txHash: input.txHash || null, // null means waiting for auto-detection
        status: "pending",
      });
      // Notify admin about new deposit request
      const { notifyAdmins: notifyAdminsDeposit } = await import("./notifications");
      const hashInfo = input.txHash ? `TxHash: ${input.txHash}` : "等待链上自动检测";
      notifyAdminsDeposit("新充值申请", `用户#${ctx.user.id} (${user.name || "Unknown"}) 提交充值 $${input.amount}\n链: ${input.chain}\n${hashInfo}`).catch(() => {});
      // Notify player that deposit request was received
      const { notifyDepositReceived } = await import("./notifications");
      notifyDepositReceived(ctx.user.id, input.amount, input.chain).catch(() => {});
      return { success: true, message: input.txHash ? "Deposit submitted, awaiting confirmation" : "Deposit submitted, auto-detecting transfer..." };
    }),
    withdraw: protectedProcedure.input(z.object({
      amount: z.string(),
      chain: z.enum(["TRC20", "ERC20", "BEP20", "TON", "Polygon"]),
      walletAddress: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const currentBalance = parseFloat(user.balance);
      const withdrawAmount = parseFloat(input.amount);
      
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid amount" });
      }
      // Check min withdrawal from config
      const minWithdraw = parseFloat(await db.getConfigValue("min_withdraw") || "10");
      if (withdrawAmount < minWithdraw) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum withdrawal is $${minWithdraw}` });
      }
      // FIX #2: Fixed withdrawal fee in USDT (not percentage)
      const withdrawFee = parseFloat(await db.getConfigValue("withdrawal_fee") || "1");
      const totalDeduction = withdrawAmount + withdrawFee;
      if (totalDeduction > currentBalance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient balance. Need $${totalDeduction.toFixed(2)} (amount $${withdrawAmount} + fee $${withdrawFee})` });
      }

      // Bonus lock check: if bonus not unlocked, cannot withdraw bonus portion
      const bonusAmount = parseFloat(user.bonusBalance ?? "0");
      if (bonusAmount > 0 && !user.bonusUnlocked) {
        // Try to unlock first (maybe conditions are now met)
        const unlocked = await db.checkAndUnlockBonus(ctx.user.id);
        if (!unlocked) {
          // User still has locked bonus - limit withdrawable amount
          const withdrawableBalance = Math.max(0, currentBalance - bonusAmount);
          if (withdrawAmount > withdrawableBalance) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: `Bonus not unlocked. Max withdrawable: $${withdrawableBalance.toFixed(2)}. Play more to unlock your bonus.` 
            });
          }
        }
      }
      
      // SECURITY FIX #1: Atomic balance deduction + frozen increment to prevent race condition
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq, sql: sqlTag } = await import("drizzle-orm");
      // Atomic conditional update: deduct totalDeduction (amount + fee), freeze only the withdraw amount
      const result = await dbInstance.execute(
        sqlTag`UPDATE users SET balance = ROUND(balance - ${totalDeduction}, 2), frozen_balance = ROUND(COALESCE(frozen_balance, 0) + ${withdrawAmount}, 2) WHERE id = ${ctx.user.id} AND balance >= ${totalDeduction}`
      );
      const affectedRows = (result as any)[0]?.affectedRows ?? 0;
      if (affectedRows === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance (concurrent request detected)" });
      }
      // Read updated balance
      const [updatedUser] = await dbInstance.select({ balance: usersTable.balance, frozenBalance: usersTable.frozenBalance }).from(usersTable).where(eq(usersTable.id, ctx.user.id)).limit(1);
      const newBalance = updatedUser?.balance ?? "0";
      const newFrozen = updatedUser?.frozenBalance ?? "0";
      
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
        note: isAutoApproved ? `auto_approved | fee: ${withdrawFee} USDT` : `fee: ${withdrawFee} USDT`,
      });
      // Record fee as a separate transaction for accounting clarity
      if (withdrawFee > 0) {
        await db.createTransaction({
          userId: ctx.user.id,
          type: "rake",
          amount: withdrawFee.toFixed(2),
          balanceBefore: user.balance,
          balanceAfter: newBalance,
          status: "confirmed",
          note: `Withdrawal fee for $${input.amount} withdraw`,
        });
      }

      // If auto-approved, release frozen balance immediately (amount was already frozen above)
      if (isAutoApproved) {
        const releasedFrozen = Math.max(0, parseFloat(newFrozen) - withdrawAmount).toFixed(2);
        await dbInstance.update(usersTable).set({ frozenBalance: releasedFrozen }).where(eq(usersTable.id, ctx.user.id));
      }

      // Notify admin about new withdrawal request
      const { notifyAdmins: notifyAdminsWithdraw } = await import("./notifications");
      if (isAutoApproved) {
        notifyAdminsWithdraw("提现自动审批", `用户#${ctx.user.id} (${user.name || "Unknown"}) 提现 $${input.amount} 已自动审批\n链: ${input.chain}\n地址: ${input.walletAddress}`).catch(() => {});
      } else {
        notifyAdminsWithdraw("新提现申请", `用户#${ctx.user.id} (${user.name || "Unknown"}) 申请提现 $${input.amount}\n链: ${input.chain}\n地址: ${input.walletAddress}\n请登录后台审核`).catch(() => {});
      }
      // Notify player that withdrawal request was received
      const { notifyWithdrawalReceived } = await import("./notifications");
      notifyWithdrawalReceived(ctx.user.id, input.amount, input.chain).catch(() => {});
      // Trigger risk check asynchronously (non-blocking)
      import("./riskEngine").then(({ runRiskChecks }) => runRiskChecks(ctx.user.id, "withdrawal")).catch(() => {});
      return { success: true, newBalance, autoApproved: isAutoApproved };
    }),
    transactions: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20), category: z.enum(['finance', 'game']).optional() })).query(async ({ ctx, input }) => {
      return db.getUserTransactions(ctx.user.id, input.page, input.limit, input.category);
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
      const { eq, sql: sqlTag } = await import("drizzle-orm");
      const [tx] = await dbInstance.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      if (tx.type !== "deposit") throw new TRPCError({ code: "BAD_REQUEST", message: "Not a deposit transaction" });
      // SECURITY FIX #3b: Atomic conditional status update to prevent double-confirmation
      const updateResult = await dbInstance.execute(
        sqlTag`UPDATE transactions SET status = 'confirmed' WHERE id = ${input.transactionId} AND status = 'pending'`
      );
      const affected = (updateResult as any)[0]?.affectedRows ?? 0;
      if (affected === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction already processed (concurrent confirmation detected)" });
      // Atomic balance addition
      const depositAmount = parseFloat(tx.amount);
      await dbInstance.execute(
        sqlTag`UPDATE users SET balance = ROUND(CAST(balance AS DECIMAL(12,2)) + ${depositAmount}, 2) WHERE id = ${tx.userId}`
      );
      // Read new balance for response and transaction record
      const [updatedUser] = await dbInstance.select({ balance: users.balance }).from(users).where(eq(users.id, tx.userId)).limit(1);
      const newBalance = updatedUser?.balance ?? "0";
      // Update transaction with new balance
      await dbInstance.update(transactions).set({ balanceAfter: newBalance }).where(eq(transactions.id, input.transactionId));
      // Log
      db.createAdminLog({ action: "confirm_deposit", category: "finance", targetType: "transaction", targetId: String(input.transactionId), detail: { amount: tx.amount, userId: tx.userId, chain: tx.chain } });
      // TG notifications
      const { notifyDepositConfirmed, notifyAdmins } = await import("./notifications");
      notifyDepositConfirmed(tx.userId, tx.amount, tx.chain ?? undefined).catch(() => {});
      notifyAdmins("充值已确认", `用户#${tx.userId} 充值 $${tx.amount} (${tx.chain || "N/A"}) 已确认`).catch(() => {});
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
      // Log
      db.createAdminLog({ action: "reject_transaction", category: "finance", targetType: "transaction", targetId: String(input.transactionId), detail: { type: tx.type, amount: tx.amount, userId: tx.userId, reason: input.reason } });
      // TG notification to user
      if (tx.type === "withdraw") {
        const { notifyWithdrawalRejected } = await import("./notifications");
        notifyWithdrawalRejected(tx.userId, tx.amount, input.reason || "管理员拒绝").catch(() => {});
      } else if (tx.type === "deposit") {
        const { notifyDepositRejected } = await import("./notifications");
        notifyDepositRejected(tx.userId, tx.amount, input.reason || "管理员拒绝").catch(() => {});
      }
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
      // Log
      db.createAdminLog({ action: "confirm_withdrawal", category: "finance", targetType: "transaction", targetId: String(input.transactionId), detail: { amount: tx.amount, userId: tx.userId, chain: tx.chain } });
      // TG notifications
      const { notifyWithdrawalApproved, notifyAdmins: notifyAdminsW } = await import("./notifications");
      notifyWithdrawalApproved(tx.userId, tx.amount, input.txHash ?? tx.txHash ?? undefined).catch(() => {});
      notifyAdminsW("提现已审批", `用户#${tx.userId} 提现 $${tx.amount} 已审批转账`).catch(() => {});
      return { success: true };
    }),
  }),
  // ==================== AGENT ====================
    agent: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      let user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      // Auto-generate invite code for existing users who don't have one
      if (!user.inviteCode) {
        await db.ensureUserInviteCode(user.id);
        user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      }
      const downlines = await db.getAgentDownlines(ctx.user.id);
      const commissions = await db.getAgentCommissions(ctx.user.id, 1, 10);
      const totalEarnings = downlines.reduce((sum, d) => sum + parseFloat(d.totalCommissionEarned ?? "0"), 0);
      const unlockedCount = downlines.filter(d => d.isUnlocked).length;
      // Read commission rates from database
      const level1RateConfig = await db.getConfig("agent_level1_rate");
      const level2RateConfig = await db.getConfig("agent_level2_rate");
      const level1Rate = level1RateConfig ? parseFloat(level1RateConfig.value) : 10;
      const level2Rate = level2RateConfig ? parseFloat(level2RateConfig.value) : 5;
      // Read TG bot username from database
      const botUsername = await db.getConfigValue("tg_bot_username", "VeraPokerbot");
      // Calculate pending earnings from pending commission records
      const dbInstance = await db.getDb();
      let pendingEarnings = "0.00";
      if (dbInstance) {
        const { commissionRecords } = await import("../drizzle/schema");
        const { eq, and, sql } = await import("drizzle-orm");
        const [result] = await dbInstance.select({
          total: sql<string>`COALESCE(SUM(commissionAmount), '0.00')`,
        }).from(commissionRecords)
          .where(and(
            eq(commissionRecords.agentId, ctx.user.id),
            eq(commissionRecords.status, "pending")
          ));
        pendingEarnings = result?.total ?? "0.00";
      }
      return {
        inviteCode: user.inviteCode ?? "",
        inviteLink: `https://t.me/${botUsername}/app?startapp=ref_${user.inviteCode ?? ""}`,
        totalDownlines: downlines.length,
        unlockedDownlines: unlockedCount,
        totalEarnings: totalEarnings.toFixed(2),
        pendingEarnings,
        availableBalance: user.balance,
        recentCommissions: commissions.records,
        level1Rate,
        level2Rate,
      };
    }),
    register: protectedProcedure.input(z.object({ inviteCode: z.string() })).mutation(async ({ ctx, input }) => {
      // Find the inviter
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Check if user already has an inviter (prevent duplicate registration)
      const [currentUser] = await dbInstance.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (currentUser?.invitedBy) {
        return { success: true }; // Already registered, silently succeed
      }
      
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

      // Notify agent that a new downline has bound their invite code
      const downlineName = currentUser?.nickname || currentUser?.name || `用户#${ctx.user.id}`;
      const { notifyNewDownline } = await import("./notifications");
      notifyNewDownline(inviter.id, downlineName).catch(() => {});

      return { success: true };
    }),
    downlines: protectedProcedure.query(async ({ ctx }) => {
      return db.getAgentDownlines(ctx.user.id);
    }),
    commissions: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
      return db.getAgentCommissions(ctx.user.id, input.page, input.limit);
    }),
    // 通过 Bot API 发送带 InlineKeyboard 的分享消息给当前用户，用户再转发给好友
    getBannerUrl: protectedProcedure
      .query(async () => {
        const botToken = await db.getConfigValue("tg_bot_token");
        const fileId = await db.getConfigValue("share_banner_file_id");
        // Try Telegram CDN first (most reliable in TG WebView)
        if (botToken && fileId) {
          try {
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const data = await resp.json() as { ok: boolean; result?: { file_path: string } };
            if (data.ok && data.result?.file_path) {
              return { url: `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}` };
            }
          } catch (e) {
            console.error("[getBannerUrl] TG getFile error:", e);
          }
        }
        // Fallback: use share_banner_url with signed URL
        const bannerUrl = await db.getConfigValue("share_banner_url");
        if (bannerUrl) {
          if (bannerUrl.startsWith("http")) return { url: bannerUrl };
          // Relative /manus-storage/ path - resolve to signed URL
          if (bannerUrl.startsWith("/manus-storage/")) {
            try {
              const { storageGetSignedUrl } = await import("../server/storage");
              const key = bannerUrl.replace("/manus-storage/", "");
              const signedUrl = await storageGetSignedUrl(key);
              return { url: signedUrl };
            } catch (e) {
              console.error("[getBannerUrl] signed URL error:", e);
            }
          }
          // Last resort: return the raw path (works if same-origin)
          return { url: bannerUrl };
        }
        return { url: null };
      }),

    // 准备分享消息：调用 savePreparedInlineMessage，返回 prepared_message_id
    // 前端用 Telegram.WebApp.shareMessage(id) 弹出联系人选择器
    prepareShareMessage: protectedProcedure
      .input(z.object({
        shareText: z.string().max(1000),
        inviteLink: z.string(),
        startButtonText: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const botToken = await db.getConfigValue("tg_bot_token");
        if (!botToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bot token not configured" });
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        // 获取用户 tgId（用于 savePreparedInlineMessage 的 user_id 参数）
        let tgId = user.tgId;
        if (!tgId && user.openId && user.openId.startsWith("tg_")) {
          tgId = user.openId.replace("tg_", "");
        }
        if (!tgId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Telegram account linked. Please login via Telegram." });
        }
        const buttonText = input.startButtonText || "开始游戏 🎮";
        const bannerFileId = await db.getConfigValue("share_banner_file_id");
        const apiBase = `https://api.telegram.org/bot${botToken}`;

        // 构建 InlineQueryResult
        let result: any;
        if (bannerFileId) {
          // 带图片的分享消息
          result = {
            type: "photo",
            id: "share_" + Date.now(),
            photo_file_id: bannerFileId,
            caption: input.shareText,
            reply_markup: {
              inline_keyboard: [[
                { text: buttonText, url: input.inviteLink }
              ]]
            }
          };
        } else {
          // 纯文字分享消息
          result = {
            type: "article",
            id: "share_" + Date.now(),
            title: "VeraPoker",
            input_message_content: {
              message_text: input.shareText,
            },
            reply_markup: {
              inline_keyboard: [[
                { text: buttonText, url: input.inviteLink }
              ]]
            }
          };
        }

        // 调用 savePreparedInlineMessage
        const resp = await fetch(`${apiBase}/savePreparedInlineMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: parseInt(tgId),
            result: result,
            allow_user_chats: true,
            allow_bot_chats: true,
            allow_group_chats: true,
            allow_channel_chats: true,
          })
        });
        const data = await resp.json() as { ok: boolean; result?: { id: string; expiration_date: number }; description?: string };
        if (!data.ok) {
          console.error("[prepareShareMessage] savePreparedInlineMessage failed:", data.description);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.description || "Failed to prepare share message" });
        }
        return { preparedMessageId: data.result!.id };
      }),

    shareWithBot: protectedProcedure
      .input(z.object({
        shareText: z.string().max(1000),
        inviteLink: z.string().url(),
        startButtonText: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const botToken = await db.getConfigValue("tg_bot_token");
        if (!botToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bot token not configured" });
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        // tgId 可能为 null，尝试从 openId 提取（格式: tg_123456789）
        let tgId = user.tgId;
        if (!tgId && user.openId && user.openId.startsWith("tg_")) {
          tgId = user.openId.replace("tg_", "");
          console.log("[shareWithBot] Extracted tgId from openId:", tgId);
        }
        if (!tgId) {
          console.error("[shareWithBot] No tgId for user:", ctx.user.id, "openId:", user.openId);
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Telegram account linked. Please login via Telegram." });
        }
        const buttonText = input.startButtonText || "开始游戏 🎮";
        const bannerFileId = await db.getConfigValue("share_banner_file_id");
        const bannerUrl = await db.getConfigValue("share_banner_url");
        const apiBase = `https://api.telegram.org/bot${botToken}`;
        let sent = false;
        // 优先用 file_id 发送图片（永久有效，不依赖外部 URL）
        const photoSource = bannerFileId || (bannerUrl ? (bannerUrl.startsWith("http") ? bannerUrl : `https://game.verapoker.com${bannerUrl}`) : null);
        if (photoSource) {
          const photoResp = await fetch(`${apiBase}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: tgId,
              photo: photoSource,
              caption: input.shareText,
              reply_markup: {
                inline_keyboard: [[
                  { text: buttonText, url: input.inviteLink }
                ]]
              }
            })
          });
          const photoResult = await photoResp.json() as { ok: boolean; description?: string };
          if (photoResult.ok) {
            sent = true;
          } else {
            console.warn("[shareWithBot] sendPhoto failed:", photoResult.description, "- falling back to sendMessage");
          }
        }
        // Fallback: 纯文字消息
        if (!sent) {
          const msgResp = await fetch(`${apiBase}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: tgId,
              text: input.shareText,
              reply_markup: {
                inline_keyboard: [[
                  { text: buttonText, url: input.inviteLink }
                ]]
              }
            })
          });
          const msgResult = await msgResp.json() as { ok: boolean; description?: string };
          if (!msgResult.ok) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msgResult.description || "Failed to send message" });
          }
        }
        return { success: true };
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
      // Private room restriction: must have deposited at least once
      if (room.type === "private") {
        const user0 = await db.getUserById(ctx.user.id);
        if (!user0 || parseFloat(user0.totalDeposited) <= 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "PRIVATE_ROOM_DEPOSIT_REQUIRED" });
        }
      }
      const minBuyIn = parseFloat(room.minBuyIn);
      const maxBuyIn = parseFloat(room.maxBuyIn);
      if (input.buyIn < minBuyIn || input.buyIn > maxBuyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Buy-in must be between ${minBuyIn} and ${maxBuyIn}` });
      }
      // Check user balance (pre-check for better error message)
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (parseFloat(user.balance) < input.buyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      // Pre-check: if already seated at this table (active or sitting_out)
      const existingPlayersAll = await db.getRoomPlayersAll(input.roomId);
      const alreadySeated = existingPlayersAll.find((p: any) => p.userId === ctx.user.id);
      if (alreadySeated) {
        if (alreadySeated.status === "sitting_out") {
          // Player is sitting_out (waiting for next hand) - allow rejoin without deducting balance
          return { success: true, seatIndex: alreadySeated.seatIndex, message: "WAITING_FOR_NEXT_HAND" };
        }
        // Active player on another device - reject
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: "ALREADY_SEATED_THIS_TABLE" 
        });
      }
      // Atomically deduct balance (prevents race condition / negative balance)
      const balanceBefore = user.balance;
      const newBalance = await db.deductUserBalanceAtomic(ctx.user.id, input.buyIn);
      if (newBalance === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      const result = await tableManager.joinTable(input.roomId, ctx.user.id, input.buyIn);
      if (!result.success) {
        // Refund atomically (add back the deducted amount)
        await db.addUserBalanceAtomic(ctx.user.id, input.buyIn);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Cannot join table" });
      }
      // Record buy-in transaction
      await db.createTransaction({
        userId: ctx.user.id,
        type: "buy_in",
        amount: input.buyIn.toFixed(2),
        balanceBefore: balanceBefore,
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: input.roomId,
        note: `Buy-in: ${room.name}`,
      });
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
      return { seatIndex: result.seatIndex, newBalance, message: result.message || null };
    }),
    // Leave a table
    leave: protectedProcedure.input(z.object({ roomId: z.number() })).mutation(async ({ ctx, input }) => {
      const result = await tableManager.leaveTable(input.roomId, ctx.user.id);
      // Return remaining chips to user balance atomically
      const leaveUser = await db.getUserById(ctx.user.id);
      let newBalance: string | null = null;
      if (result.remainingChips > 0 && leaveUser) {
        const balanceBefore = leaveUser.balance;
        newBalance = await db.addUserBalanceAtomic(ctx.user.id, result.remainingChips);
        // Record leave-table transaction
        const room = await db.getRoomById(input.roomId);
        await db.createTransaction({
          userId: ctx.user.id,
          type: "leave_table",
          amount: result.remainingChips.toFixed(2),
          balanceBefore,
          balanceAfter: newBalance || balanceBefore,
          status: "confirmed",
          referenceType: "room",
          referenceId: input.roomId,
          note: `Leave table: ${room?.name ?? `Room #${input.roomId}`}`,
        });
      } else if (result.remainingChips === 0 && leaveUser) {
        // Left with zero chips - still record it for full audit trail
        newBalance = leaveUser.balance;
        const room = await db.getRoomById(input.roomId);
        await db.createTransaction({
          userId: ctx.user.id,
          type: "leave_table",
          amount: "0.00",
          balanceBefore: leaveUser.balance,
          balanceAfter: leaveUser.balance,
          status: "confirmed",
          referenceType: "room",
          referenceId: input.roomId,
          note: `Leave table (bust-out): ${room?.name ?? `Room #${input.roomId}`}`,
        });
      }
      return { success: result.success, remainingChips: result.remainingChips, newBalance: newBalance || leaveUser?.balance || "0.00" };
    }),
    // Player ready for next hand
    ready: protectedProcedure.input(z.object({ roomId: z.number() })).mutation(async ({ ctx, input }) => {
      const result = await tableManager.playerReady(input.roomId, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "Ready failed" });
      }
      return { success: true };
    }),
    // Rebuy - add chips at the table without leaving
    rebuy: protectedProcedure.input(z.object({
      roomId: z.number(),
      amount: z.number().min(1),
    })).mutation(async ({ ctx, input }) => {
      const room = await db.getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      
            // Check user balance (pre-check for better error message)
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (parseFloat(user.balance) < input.amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      // Check rebuy limits
      const maxBuyIn = parseFloat(room.maxBuyIn);
      const currentChips = await tableManager.getPlayerChips(input.roomId, ctx.user.id);
      if (currentChips < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not seated at this table" });
      }
      if (currentChips + input.amount > maxBuyIn) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Total chips cannot exceed max buy-in ($${maxBuyIn})` });
      }
      
      // Only allow rebuy when not in active hand (waiting or waitingForReady)
      const canRebuy = await tableManager.canPlayerRebuy(input.roomId, ctx.user.id);
      if (!canRebuy) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only rebuy between hands" });
      }
      
      // Atomically deduct from balance (prevents race condition / negative balance)
      const rebuyBalanceBefore = user.balance;
      const newBalance = await db.deductUserBalanceAtomic(ctx.user.id, input.amount);
      if (newBalance === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      await tableManager.addPlayerChips(input.roomId, ctx.user.id, input.amount);
      // Record rebuy transaction
      await db.createTransaction({
        userId: ctx.user.id,
        type: "rebuy",
        amount: input.amount.toFixed(2),
        balanceBefore: rebuyBalanceBefore,
        balanceAfter: newBalance,
        status: "confirmed",
        referenceType: "room",
        referenceId: input.roomId,
        note: `Rebuy: ${room.name}`,
      });
      return { success: true, newBalance, newChips: currentChips + input.amount };
    }),
    // Player action (fold/check/call/raise/all_in)    // Player action (fold/check/call/raise/all_in)
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
    // 牌局回放列表（个人中心）
    myReplayList: protectedProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
      return db.getPlayerReplayList(ctx.user.id, input.page, input.limit);
    }),
    // 牌局回放详情（包含完整操作时间线）
    replayDetail: protectedProcedure.input(z.object({ handId: z.number() })).query(async ({ ctx, input }) => {
      const hand = await db.getGameHandById(input.handId);
      if (!hand) throw new TRPCError({ code: "NOT_FOUND", message: "Hand not found" });
      // 确保用户参与了这局牌
      const players = await db.getHandPlayers(input.handId);
      const participated = players.some(p => p.userId === ctx.user.id);
      if (!participated) throw new TRPCError({ code: "FORBIDDEN", message: "You did not participate in this hand" });
      // 获取房间信息
      const room = await db.getRoomById(hand.roomId);
      return {
        id: hand.id,
        roomId: hand.roomId,
        roomName: room?.name || "Unknown",
        handNumber: hand.handNumber,
        communityCards: hand.communityCards,
        potSize: hand.potSize,
        winnerId: hand.winnerId,
        winningHand: hand.winningHand,
        status: hand.status,
        startedAt: hand.startedAt,
        completedAt: hand.completedAt,
        actionTimeline: hand.actionTimeline || [],
        playerSnapshot: hand.playerSnapshot || [],
        players: await Promise.all(players.map(async (p) => {
          const user = await db.getUserById(p.userId);
          return { ...p, name: user?.nickname || user?.name || `Player ${p.seatIndex + 1}` };
        })),
      };
    }),
  }),

  // ==================== AI CUSTOMER SERVICE ====================
  cs: router({
    chat: protectedProcedure.input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().default("en"),
    })).mutation(async ({ ctx, input }) => {
      // Save user message to DB
      await db.saveCsMessage(ctx.user.id, "user", input.message);

      // Load AI config from system_configs (DeepSeek API配置统一从 deepseek_* 读取)
      const aiCustomPrompt = await db.getConfigValue("ai_cs_system_prompt", "");
      const aiTemperature = parseFloat(await db.getConfigValue("ai_cs_temperature", "0.7"));

      // Get FAQ knowledge base for context
      const faqs = await db.getActiveFaqs(input.language);
      const faqContext = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

      // Get recent chat history for context (last 10 messages)
      const recentHistory = await db.getCsMessages(ctx.user.id, 10);
      const historyContext = recentHistory.slice(-10).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const systemPrompt = `You are Vera Poker's AI customer service assistant. You help players with questions about the game, their accounts, deposits, withdrawals, and general poker rules.

## Texas Hold'em Poker Rules

### Game Flow
1. **Pre-flop**: Each player receives 2 hole cards (face down). Betting starts from the player left of the big blind.
2. **Flop**: 3 community cards are dealt face up. Betting starts from the player left of the dealer.
3. **Turn**: 1 more community card is dealt. Another round of betting.
4. **River**: The 5th and final community card is dealt. Final betting round.
5. **Showdown**: Remaining players reveal their hands. Best 5-card hand wins the pot.

### Betting Actions
- **Fold**: Give up your hand and forfeit any bets made.
- **Check**: Pass the action to the next player (only when no bet has been made).
- **Call**: Match the current bet.
- **Raise**: Increase the current bet.
- **All-in**: Bet all your remaining chips.

### Blind Structure
- **Small Blind (SB)**: Forced bet by the player left of the dealer button.
- **Big Blind (BB)**: Forced bet (2x small blind) by the player two seats left of the dealer.
- The dealer button rotates clockwise each hand.

### Hand Rankings (Strongest to Weakest)
1. **Royal Flush** (皇家同花顺): A, K, Q, J, 10 of the same suit — the best possible hand.
2. **Straight Flush** (同花顺): Five consecutive cards of the same suit.
3. **Four of a Kind** (四条): Four cards of the same rank.
4. **Full House** (葫芦): Three of a kind + a pair.
5. **Flush** (同花): Five cards of the same suit, not consecutive.
6. **Straight** (顺子): Five consecutive cards of mixed suits.
7. **Three of a Kind** (三条): Three cards of the same rank.
8. **Two Pair** (两对): Two different pairs.
9. **One Pair** (一对): Two cards of the same rank.
10. **High Card** (高牌): No combination — highest single card plays.

### Showdown & Settlement Rules
- The player who made the last aggressive action (bet/raise) on the river must show first.
- If all players checked on the river, the player left of the dealer shows first.
- The pot is awarded to the player with the best 5-card hand using any combination of their 2 hole cards + 5 community cards.
- **Split pot**: If two or more players have identical best hands, the pot is split equally.
- **Side pot**: When a player goes all-in with fewer chips than others, a side pot is created for the remaining players.
- **Rake**: A small percentage of each pot is taken as the platform fee (shown in the game).

### Common Terms
- **Pot**: Total chips bet by all players in the current hand.
- **Position**: Your seat relative to the dealer button. Late position (dealer/button) is advantageous.
- **Hole Cards**: Your 2 private cards.
- **Community Cards**: The 5 shared cards (flop + turn + river).
- **Muck**: To fold without showing your cards.

## Available FAQ Knowledge:
${faqContext}

## Assistant Rules:
- Be helpful, concise, and professional
- If you cannot answer a question, suggest the user contact human support
- Respond in the user's language: ${input.language}
- Never reveal sensitive system information
- For account-specific queries, inform the user you can help with general questions but specific account issues need human support
- When explaining hand rankings or rules, use both English and Chinese terms for clarity`;

      try {
        // Build final system prompt: custom prompt takes priority, fallback to default
        const finalSystemPrompt = aiCustomPrompt ? `${aiCustomPrompt}\n\n## Available FAQ Knowledge:\n${faqContext}\n\n## Assistant Rules:\n- Respond in the user's language: ${input.language}\n- Never reveal sensitive system information` : systemPrompt;

        const messages: Array<{role: "system" | "user" | "assistant"; content: string}> = [
          { role: "system" as const, content: finalSystemPrompt },
          ...historyContext.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];
        // Ensure the last message is the current user message (already in history)
        // If history doesn't include it yet (race condition), add it
        if (messages[messages.length - 1]?.content !== input.message) {
          messages.push({ role: "user", content: input.message });
        }

        let response;
        // 统一使用 DeepSeek API（配置从管理后台 config 表读取）
        response = await invokeLLM({ messages, temperature: aiTemperature, maxTokens: 2048 });
        const rawContent = response.choices?.[0]?.message?.content;
        const aiResponse = typeof rawContent === "string" ? rawContent : (rawContent ? JSON.stringify(rawContent) : "I'm sorry, I couldn't process your request. Please try again.");

        // Save AI response to DB
        await db.saveCsMessage(ctx.user.id, "assistant", aiResponse);

        return { response: aiResponse, resolvedBy: "ai" as const };
      } catch (error) {
        const errorMsg = "I'm experiencing technical difficulties. Please try again later or contact human support.";
        await db.saveCsMessage(ctx.user.id, "assistant", errorMsg);
        return { response: errorMsg, resolvedBy: "ai" as const };
      }
    }),
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const messages = await db.getCsMessages(ctx.user.id, 100);
      return messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        createdAt: m.createdAt,
      }));
    }),
    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      await db.clearCsMessages(ctx.user.id);
      return { success: true };
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
    // 获取通知偏好设置
    getNotificationPrefs: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [user] = await dbInstance.select({ notificationPrefs: users.notificationPrefs }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      // null 表示全部开启，返回默认值
      return user?.notificationPrefs || {
        privateRoomInvite: true,
        turnAction: true,
        gameStarting: true,
        deposit: true,
        withdrawal: true,
        commission: true,
        tournament: true,
        system: true,
      };
    }),
    // 更新通知偏好设置
    updateNotificationPrefs: protectedProcedure.input(z.object({
      privateRoomInvite: z.boolean().optional(),
      turnAction: z.boolean().optional(),
      gameStarting: z.boolean().optional(),
      deposit: z.boolean().optional(),
      withdrawal: z.boolean().optional(),
      commission: z.boolean().optional(),
      tournament: z.boolean().optional(),
      system: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      // 合并现有偏好和新输入
      const [user] = await dbInstance.select({ notificationPrefs: users.notificationPrefs }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const currentPrefs = user?.notificationPrefs || {};
      const newPrefs = { ...currentPrefs, ...input };
      await dbInstance.update(users).set({ notificationPrefs: newPrefs }).where(eq(users.id, ctx.user.id));
      return { success: true, prefs: newPrefs };
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
      // Apply accumulated reward atomically
      if (totalReward > 0) {
        await db.addUserBalanceAtomic(ctx.user.id, totalReward);
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
        tgUsername: users.tgUsername,
        avatar: users.avatar,
        totalProfit: sql<string>`CAST(SUM(CAST(${handPlayers.winAmount} AS DECIMAL(18,2)) - CAST(${handPlayers.betAmount} AS DECIMAL(18,2))) AS CHAR)`,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.tgUsername, users.avatar)
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
        tgUsername: users.tgUsername,
        avatar: users.avatar,
        winRate: sql<number>`ROUND(SUM(CASE WHEN ${handPlayers.isWinner} = 1 THEN 1 ELSE 0 END) * 100.0 / count(*), 1)`,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.tgUsername, users.avatar)
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
        tgUsername: users.tgUsername,
        avatar: users.avatar,
        totalHands: sql<number>`count(*)`,
      }).from(handPlayers)
        .innerJoin(users, eq(handPlayers.userId, users.id))
        .groupBy(handPlayers.userId, users.name, users.nickname, users.tgUsername, users.avatar)
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
    })).mutation(async ({ input, ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      // SECURITY FIX #8: Read old values for audit trail before modification
      const [oldUser] = await dbInstance.select().from(users).where(eq(users.id, input.id)).limit(1);
      if (!oldUser) return { success: false };
      
      const updateData: any = {};
      if (input.riskLevel) updateData.riskLevel = input.riskLevel;
      if (input.role) updateData.role = input.role;
      if (input.balance) updateData.balance = input.balance;
      await dbInstance.update(users).set(updateData).where(eq(users.id, input.id));
      
      // SECURITY FIX #8: Audit log for admin modifications (especially balance changes)
      const changes: Record<string, { from: any; to: any }> = {};
      if (input.riskLevel && input.riskLevel !== oldUser.riskLevel) changes.riskLevel = { from: oldUser.riskLevel, to: input.riskLevel };
      if (input.role && input.role !== oldUser.role) changes.role = { from: oldUser.role, to: input.role };
      if (input.balance && input.balance !== oldUser.balance) changes.balance = { from: oldUser.balance, to: input.balance };
      
      if (Object.keys(changes).length > 0) {
        db.createAdminLog({
          action: "admin_update_user",
          category: "system",
          targetType: "user",
          targetId: String(input.id),
          detail: { changes, adminId: (ctx as any).admin?.adminId || "unknown" },
        });
      }
      
      // If balance was changed, create a transaction record for traceability
      if (input.balance && input.balance !== oldUser.balance) {
        const diff = parseFloat(input.balance) - parseFloat(oldUser.balance);
        await db.createTransaction({
          userId: input.id,
          type: "adjustment",
          amount: Math.abs(diff).toFixed(2),
          balanceBefore: oldUser.balance,
          balanceAfter: input.balance,
          status: "confirmed",
          note: `Admin manual adjustment by admin#${(ctx as any).admin?.adminId || "unknown"}`,
        });
      }
      
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
    userDownlines: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return db.getAdminUserDownlines(input.userId);
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
      const dbInstance = await db.getDb();
      if (!dbInstance) return { relationships: [], total: 0 };
      const { agentRelationships, users } = await import("../drizzle/schema");
      const { desc, sql } = await import("drizzle-orm");
      const offset = (input.page - 1) * input.limit;
      const data = await dbInstance.select().from(agentRelationships).orderBy(desc(agentRelationships.createdAt)).limit(input.limit).offset(offset);
      const [countResult] = await dbInstance.select({ count: sql<number>`count(*)` }).from(agentRelationships);
      const userIds = [...new Set(data.flatMap(r => [r.agentId, r.downlineId]))];
      const userInfos = userIds.length > 0
        ? await dbInstance.select({ id: users.id, name: users.name, tgUsername: users.tgUsername, nickname: users.nickname }).from(users).where(sql`${users.id} IN (${sql.raw(userIds.join(","))})`)
        : [];
      const userMap = Object.fromEntries(userInfos.map(u => [u.id, u]));
      const enriched = data.map(r => ({ ...r, agentInfo: userMap[r.agentId] || null, downlineInfo: userMap[r.downlineId] || null }));
      return { relationships: enriched, total: countResult?.count ?? 0 };
    }),
    agentDetail: adminProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      const { agentRelationships, users, commissionRecords } = await import("../drizzle/schema");
      const { eq, desc, sql } = await import("drizzle-orm");
      const [agentUser] = await dbInstance.select().from(users).where(eq(users.id, input.agentId)).limit(1);
      if (!agentUser) return null;
      const downlines = await dbInstance.select().from(agentRelationships).where(eq(agentRelationships.agentId, input.agentId));
      const downlineIds = downlines.map(d => d.downlineId);
      const downlineUsers = downlineIds.length > 0
        ? await dbInstance.select({ id: users.id, name: users.name, tgUsername: users.tgUsername, nickname: users.nickname, balance: users.balance, riskLevel: users.riskLevel, lastSignedIn: users.lastSignedIn }).from(users).where(sql`${users.id} IN (${sql.raw(downlineIds.join(","))})`)
        : [];
      const [commStats] = await dbInstance.select({
        totalEarned: sql<number>`COALESCE(SUM(CAST(commissionAmount AS DECIMAL(18,2))), 0)`,
        totalRecords: sql<number>`count(*)`,
        settledAmount: sql<number>`COALESCE(SUM(CASE WHEN status='settled' THEN CAST(commissionAmount AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN status='pending' THEN CAST(commissionAmount AS DECIMAL(18,2)) ELSE 0 END), 0)`,
      }).from(commissionRecords).where(eq(commissionRecords.agentId, input.agentId));
      const recentCommissions = await dbInstance.select().from(commissionRecords).where(eq(commissionRecords.agentId, input.agentId)).orderBy(desc(commissionRecords.createdAt)).limit(20);
      return {
        agent: { id: agentUser.id, name: agentUser.name, tgUsername: agentUser.tgUsername, nickname: agentUser.nickname, balance: agentUser.balance },
        downlines: downlines.map(d => ({ ...d, userInfo: downlineUsers.find(u => u.id === d.downlineId) })),
        commissionStats: commStats,
        recentCommissions,
      };
    }),
    agentUnlock: adminProcedure.input(z.object({ relationshipId: z.number(), lock: z.boolean().optional() })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false };
      const { agentRelationships } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(agentRelationships).set({ isUnlocked: input.lock ? false : true }).where(eq(agentRelationships.id, input.relationshipId));
      return { success: true };
    }),
    commissions: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20) })).query(async ({ input }) => {
      return db.getAllCommissions(input.page, input.limit);
    }),
    // Risk Control Management
    riskRules: adminProcedure.query(async () => {
      const { getRiskRules } = await import("./riskEngine");
      return getRiskRules();
    }),
    riskRuleUpdate: adminProcedure.input(z.object({
      ruleId: z.number(),
      enabled: z.boolean().optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      params: z.any().optional(),
      action: z.enum(["alert_only", "freeze_balance", "ban_account", "notify_admin"]).optional(),
    })).mutation(async ({ input }) => {
      const { updateRiskRule } = await import("./riskEngine");
      const { ruleId, ...updates } = input;
      return updateRiskRule(ruleId, updates);
    }),
    riskAlerts: adminProcedure.input(z.object({ page: z.number().default(1), limit: z.number().default(20), status: z.string().optional() })).query(async ({ input }) => {
      const { getRiskAlerts } = await import("./riskEngine");
      return getRiskAlerts(input.page, input.limit, input.status);
    }),
    riskAlertUpdate: adminProcedure.input(z.object({
      alertId: z.number(),
      status: z.enum(["pending", "reviewed", "resolved", "ignored"]),
      resolution: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { updateAlertStatus } = await import("./riskEngine");
      const adminId = ctx.adminUser?.adminId || ctx.user?.id;
      return updateAlertStatus(input.alertId, input.status, adminId, input.resolution);
    }),
    riskAnalyzeUser: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      const { analyzeUserRisk } = await import("./riskEngine");
      return analyzeUserRisk(input.userId);
    }),
    riskRunChecks: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      const { runRiskChecks } = await import("./riskEngine");
      await runRiskChecks(input.userId, "manual_check");
      return { success: true };
    }),
    userEarningsFlow: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const { getUserEarningsFlow } = await import("./riskEngine");
      return getUserEarningsFlow(input.userId);
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
      // TG notification to user about manual top-up
      const { notifyBalanceChange, notifyAdmins: notifyAdminsTopup } = await import("./notifications");
      notifyBalanceChange(input.userId, `+$${input.amount.toFixed(2)}`, `管理员手动充值${input.note ? `: ${input.note}` : ""}`).catch(() => {});
      notifyAdminsTopup("手动充值", `${operatorName} 为用户#${input.userId} 手动充值 $${input.amount.toFixed(2)}${input.note ? `\n备注: ${input.note}` : ""}`).catch(() => {});
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
  // ==================== BOT MANAGEMENT ====================
  adminBot: router({
    // Get bot system stats
    stats: staffProcedure.query(async () => {
      return botManager.getBotStats();
    }),
    // Get all bot users
    list: staffProcedure.query(async () => {
      return botManager.getBotUsers();
    }),
    // Update bot config
    updateConfig: adminProcedure.input(z.object({
      enabled: z.boolean().optional(),
      maxPerTable: z.number().min(1).max(8).optional(),
      minPerTable: z.number().min(2).max(5).optional(),
      dailyLossLimit: z.number().min(0).optional(),
      foldRate: z.number().min(0).max(100).optional(),
      minActionDelay: z.number().min(500).max(10000).optional(),
      maxActionDelay: z.number().min(1000).max(20000).optional(),
      balanceAlertThreshold: z.number().min(0).optional(),
      autoRefillAmount: z.number().min(0).optional(),
      autoRefillEnabled: z.boolean().optional(),
      fillWithoutRealPlayers: z.boolean().optional(),
      persistentOnlineCount: z.number().min(0).max(200).optional(),
      rotationHands: z.number().min(0).max(1000).optional(),
    })).mutation(async ({ input }) => {
      if (input.enabled !== undefined) await db.upsertConfig("bot_enabled", String(input.enabled), "bot", "Bot启用", "boolean");
      if (input.maxPerTable !== undefined) await db.upsertConfig("bot_max_per_table", String(input.maxPerTable), "bot", "每桌最多Bot数", "number");
      if (input.minPerTable !== undefined) await db.upsertConfig("bot_min_per_table", String(input.minPerTable), "bot", "每桌最少Bot数(无真人时)", "number");
      if (input.dailyLossLimit !== undefined) await db.upsertConfig("bot_daily_loss_limit", String(input.dailyLossLimit), "bot", "每日亏损上限", "number");
      if (input.foldRate !== undefined) await db.upsertConfig("bot_fold_rate", String(input.foldRate), "bot", "弃牌率(%)", "number");
      if (input.minActionDelay !== undefined) await db.upsertConfig("bot_min_action_delay", String(input.minActionDelay), "bot", "最小操作延迟(ms)", "number");
      if (input.maxActionDelay !== undefined) await db.upsertConfig("bot_max_action_delay", String(input.maxActionDelay), "bot", "最大操作延迟(ms)", "number");
      if (input.balanceAlertThreshold !== undefined) await db.upsertConfig("bot_balance_alert_threshold", String(input.balanceAlertThreshold), "bot", "余额告警阈值($)", "number");
      if (input.autoRefillAmount !== undefined) await db.upsertConfig("bot_auto_refill_amount", String(input.autoRefillAmount), "bot", "自动补充金额($)", "number");
      if (input.autoRefillEnabled !== undefined) await db.upsertConfig("bot_auto_refill_enabled", String(input.autoRefillEnabled), "bot", "开启自动补充", "boolean");
      if (input.fillWithoutRealPlayers !== undefined) await db.upsertConfig("bot_fill_without_real_players", String(input.fillWithoutRealPlayers), "bot", "无真人时自动对玩", "boolean");
      if (input.persistentOnlineCount !== undefined) await db.upsertConfig("bot_persistent_online_count", String(input.persistentOnlineCount), "bot", "长期在线Bot总数", "number");
      if (input.rotationHands !== undefined) await db.upsertConfig("bot_rotation_hands", String(input.rotationHands), "bot", "每桌轮换手数(0=不轮换)", "number");
      botManager.invalidateConfigCache();
      return { success: true };
    }),
    // Room-level bot config
    roomConfigs: staffProcedure.query(async () => {
      const configs = await db.getAllRoomBotConfigs();
      const publicRooms = await db.getPublicRooms();
      return {
        configs,
        rooms: publicRooms.map(r => ({ id: r.id, name: r.name, smallBlind: r.smallBlind, bigBlind: r.bigBlind, maxPlayers: r.maxPlayers })),
      };
    }),
    upsertRoomConfig: adminProcedure.input(z.object({
      roomId: z.number(),
      botCount: z.number().min(0).max(8).optional(),
      enabled: z.boolean().optional(),
      foldRate: z.number().min(0).max(100).nullable().optional(),
      minActionDelay: z.number().min(500).max(10000).nullable().optional(),
      maxActionDelay: z.number().min(1000).max(20000).nullable().optional(),
    })).mutation(async ({ input }) => {
      const { roomId, ...data } = input;
      await db.upsertRoomBotConfig(roomId, data as any);
      botManager.invalidateRoomConfigCache();
      return { success: true };
    }),
    deleteRoomConfig: adminProcedure.input(z.object({
      roomId: z.number(),
    })).mutation(async ({ input }) => {
      await db.deleteRoomBotConfig(input.roomId);
      botManager.invalidateRoomConfigCache();
      return { success: true };
    }),
    // Reset daily loss counter
    resetDailyLoss: adminProcedure.mutation(async () => {
      botManager.addBotWin(botManager.getDailyBotLoss()); // reset to 0
      return { success: true };
    }),
    // Export bot list as JSON
    exportBots: staffProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { bots: [] };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const bots = await dbInstance.select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        nickname: users.nickname,
        avatar: users.avatar,
        balance: users.balance,
        isBot: users.isBot,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.isBot, true));
      return { bots };
    }),
    // Import bots (batch create bot accounts)
    importBots: adminProcedure.input(z.object({
      bots: z.array(z.object({
        name: z.string().min(1),
        nickname: z.string().optional(),
        avatar: z.string().optional(),
        balance: z.number().default(10000),
      }))
    })).mutation(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { success: false, count: 0 };
      const { users } = await import("../drizzle/schema");
      let count = 0;
      for (const bot of input.bots) {
        const openId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await dbInstance.insert(users).values({
          openId,
          name: bot.name,
          nickname: bot.nickname || bot.name,
          avatar: bot.avatar || null,
          balance: String(bot.balance),
          isBot: true,
          role: "user",
        });
        count++;
      }
      botManager.invalidateConfigCache();
      return { success: true, count };
    }),
    // Get VPIP/PFR behavior metrics for bots
    behaviorMetrics: staffProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { gameHands, users } = await import("../drizzle/schema");
      const { eq, sql, inArray, desc } = await import("drizzle-orm");
      
      const botUserIds = await botManager.getBotUserIds();
      if (botUserIds.length === 0) return [];
      
      // Get bot names
      const botUsers = await dbInstance.select({ id: users.id, name: users.name, nickname: users.nickname })
        .from(users).where(inArray(users.id, botUserIds));
      const nameMap = new Map(botUsers.map(b => [b.id, b.nickname || b.name || `Bot#${b.id}`]));
      
      // Get recent 200 hands with actionTimeline
      const recentHands = await dbInstance.select({
        id: gameHands.id,
        actionTimeline: gameHands.actionTimeline,
        playerSnapshot: gameHands.playerSnapshot,
      }).from(gameHands)
        .where(sql`${gameHands.actionTimeline} IS NOT NULL`)
        .orderBy(desc(gameHands.id))
        .limit(200);
      
      // Calculate VPIP and PFR per bot
      const metrics: Record<number, { hands: number; vpip: number; pfr: number; aggression: number; totalActions: number; aggressiveActions: number }> = {};
      for (const id of botUserIds) {
        metrics[id] = { hands: 0, vpip: 0, pfr: 0, aggression: 0, totalActions: 0, aggressiveActions: 0 };
      }
      
      for (const hand of recentHands) {
        if (!hand.actionTimeline || !hand.playerSnapshot) continue;
        const timeline = hand.actionTimeline as Array<{ phase: string; playerId: number; action: string; amount: number }>;
        const snapshot = hand.playerSnapshot as Array<{ id: number }>;
        
        // Only count hands where bot participated
        const botParticipants = snapshot.filter(p => botUserIds.includes(p.id));
        
        for (const botPlayer of botParticipants) {
          const botId = botPlayer.id;
          if (!metrics[botId]) continue;
          metrics[botId].hands++;
          
          // VPIP: voluntarily put money in pot preflop (call/raise/all_in, excluding blinds)
          const preflopActions = timeline.filter(a => a.phase === "preflop" && a.playerId === botId && a.action !== "post_blind");
          const voluntaryPreflop = preflopActions.some(a => ["call", "raise", "all_in"].includes(a.action));
          if (voluntaryPreflop) metrics[botId].vpip++;
          
          // PFR: preflop raise (raise or all_in preflop, excluding blinds)
          const preflopRaise = preflopActions.some(a => ["raise", "all_in"].includes(a.action));
          if (preflopRaise) metrics[botId].pfr++;
          
          // Aggression factor: (raise + all_in) / (call + check) across all streets
          const allBotActions = timeline.filter(a => a.playerId === botId && a.action !== "post_blind");
          for (const action of allBotActions) {
            if (["raise", "all_in"].includes(action.action)) metrics[botId].aggressiveActions++;
            if (["call", "check", "raise", "all_in"].includes(action.action)) metrics[botId].totalActions++;
          }
        }
      }
      
      return botUserIds.map(id => ({
        id,
        name: nameMap.get(id) || `Bot#${id}`,
        hands: metrics[id].hands,
        vpip: metrics[id].hands > 0 ? ((metrics[id].vpip / metrics[id].hands) * 100).toFixed(1) : "0.0",
        pfr: metrics[id].hands > 0 ? ((metrics[id].pfr / metrics[id].hands) * 100).toFixed(1) : "0.0",
        aggressionFactor: metrics[id].totalActions > 0 
          ? (metrics[id].aggressiveActions / metrics[id].totalActions * 100).toFixed(1) 
          : "0.0",
      }));
    }),
  }),
  // Admin CS Records
  adminCs: router({
    conversations: staffProcedure.input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      userId: z.number().optional(),
      search: z.string().optional(),
    })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { items: [], total: 0 };
      const { csMessages, users } = await import("../drizzle/schema");
      const { sql, eq, desc, like, or, inArray } = await import("drizzle-orm");

      const offset = (input.page - 1) * input.limit;

      if (input.userId) {
        // Get messages for specific user
        const msgs = await dbInstance.select()
          .from(csMessages)
          .where(eq(csMessages.userId, input.userId))
          .orderBy(desc(csMessages.createdAt))
          .limit(200);
        const [countResult] = await dbInstance.select({ count: sql<number>`count(*)` })
          .from(csMessages)
          .where(eq(csMessages.userId, input.userId));
        return { items: msgs, total: countResult?.count ?? 0 };
      }

      // If search query provided, find matching user IDs first
      let filteredUserIds: number[] | null = null;
      if (input.search && input.search.trim()) {
        const searchTerm = `%${input.search.trim()}%`;
        const matchedUsers = await dbInstance.select({ id: users.id })
          .from(users)
          .where(or(
            like(users.name, searchTerm),
            like(users.tgUsername, searchTerm),
            sql`CAST(${users.id} AS CHAR) = ${input.search.trim()}`
          ))
          .limit(100);
        filteredUserIds = matchedUsers.map(u => u.id);
        if (filteredUserIds.length === 0) return { items: [], total: 0 };
      }

      // Build where clause
      const whereClause = filteredUserIds
        ? sql`${csMessages.userId} IN (${sql.raw(filteredUserIds.join(","))})`
        : undefined;

      // Get conversation list grouped by user
      const convosQuery = dbInstance.select({
        userId: csMessages.userId,
        lastMessage: sql<string>`(SELECT content FROM cs_messages m2 WHERE m2.userId = cs_messages.userId ORDER BY m2.createdAt DESC LIMIT 1)`,
        lastTime: sql<Date>`MAX(cs_messages.createdAt)`,
        messageCount: sql<number>`count(*)`,
      })
        .from(csMessages);

      const convos = whereClause
        ? await convosQuery.where(whereClause).groupBy(csMessages.userId).orderBy(sql`MAX(cs_messages.createdAt) DESC`).limit(input.limit).offset(offset)
        : await convosQuery.groupBy(csMessages.userId).orderBy(sql`MAX(cs_messages.createdAt) DESC`).limit(input.limit).offset(offset);

      // Get total unique users
      const totalQuery = whereClause
        ? await dbInstance.select({ count: sql<number>`count(DISTINCT userId)` }).from(csMessages).where(whereClause)
        : await dbInstance.select({ count: sql<number>`count(DISTINCT userId)` }).from(csMessages);
      const totalResult = totalQuery[0];

      // Get user names
      const userIds = convos.map(c => c.userId);
      let userMap: Record<number, string> = {};
      if (userIds.length > 0) {
        const userRows = await dbInstance.select({ id: users.id, name: users.name, nickname: users.nickname, tgUsername: users.tgUsername })
          .from(users)
          .where(sql`${users.id} IN (${sql.raw(userIds.join(","))})`);
        userRows.forEach(u => { userMap[u.id] = u.nickname || u.name || `User#${u.id}`; });
      }

      const items = convos.map(c => ({
        userId: c.userId,
        userName: userMap[c.userId] || `User#${c.userId}`,
        lastMessage: c.lastMessage,
        lastTime: c.lastTime,
        messageCount: c.messageCount,
      }));

      return { items, total: totalResult?.count ?? 0 };
    }),
  }),
  // Public Banners
  banners: router({
    list: publicProcedure.query(async () => {
      const bannerList = await db.getActiveBanners();
      // Resolve /manus-storage/ relative paths to signed CDN URLs for browser display
      const { storageGetSignedUrl } = await import("../server/storage");
      return Promise.all(bannerList.map(async (b) => {
        if (b.imageUrl && b.imageUrl.startsWith("/manus-storage/")) {
          const key = b.imageUrl.replace("/manus-storage/", "");
          try {
            const signedUrl = await storageGetSignedUrl(key);
            return { ...b, imageUrl: signedUrl };
          } catch {
            return b;
          }
        }
        return b;
      }));
    }),
  }),
  // ==================== TOURNAMENTS ====================
  tournaments: router({
    // Public: list active tournaments
    list: publicProcedure.query(async () => {
      return db.getActiveTournaments();
    }),
    // Public: get tournament detail
    detail: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const tournament = await db.getTournamentById(input.id);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      const registrations = await db.getTournamentRegistrations(input.id);
      return { tournament, registrations };
    }),
    // Protected: register for tournament
    register: protectedProcedure.input(z.object({ tournamentId: z.number() })).mutation(async ({ ctx, input }) => {
      const tournament = await db.getTournamentById(input.tournamentId);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      if (tournament.status !== "registration") throw new TRPCError({ code: "BAD_REQUEST", message: "Registration not open" });
      // Check if already registered
      const existing = await db.getRegistration(input.tournamentId, ctx.user.id);
      if (existing && existing.status !== "refunded") throw new TRPCError({ code: "CONFLICT", message: "Already registered" });
      // Check max players
      const count = await db.getRegistrationCount(input.tournamentId);
      if (count >= tournament.maxPlayers) throw new TRPCError({ code: "BAD_REQUEST", message: "Tournament is full" });
      // Deduct entry fee from balance
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const entryFee = parseFloat(tournament.entryFee);
      if (parseFloat(user.balance) < entryFee) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      // Deduct balance atomically
      const balanceBefore = user.balance;
      const deductResult = await db.deductUserBalanceAtomic(ctx.user.id, entryFee);
      if (deductResult === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      const balanceAfter = (parseFloat(balanceBefore) - entryFee).toFixed(2);
      // Write tournament entry transaction
      await db.createTransaction({
        userId: ctx.user.id,
        type: "tournament_entry",
        amount: entryFee.toFixed(2),
        balanceBefore,
        balanceAfter,
        status: "confirmed",
        referenceType: "tournament",
        referenceId: input.tournamentId,
        note: `报名比赛: ${tournament.name}`,
      });
      // Register
      await db.registerForTournament(input.tournamentId, ctx.user.id, tournament.startingChips);
      // Update registered count
      await db.updateTournament(input.tournamentId, { registeredCount: count + 1 });
      // Notify player and admins about successful registration
      const { notifyTournamentRegistered, notifyAdmins: notifyAdminsTournament } = await import("./notifications");
      const startTimeStr = tournament.startTime ? new Date(tournament.startTime).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "待定";
      notifyTournamentRegistered(ctx.user.id, tournament.name, tournament.entryFee, startTimeStr).catch(() => {});
      notifyAdminsTournament("新比赛报名", `用户#${ctx.user.id} (${user.name || user.nickname || "Unknown"}) 报名参加「${tournament.name}」\n报名费: $${tournament.entryFee}\n当前报名: ${count + 1}/${tournament.maxPlayers}`).catch(() => {});
      return { success: true };
    }),
    // Protected: cancel registration
    cancelRegistration: protectedProcedure.input(z.object({ tournamentId: z.number() })).mutation(async ({ ctx, input }) => {
      const tournament = await db.getTournamentById(input.tournamentId);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status !== "registration") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel after tournament started" });
      const reg = await db.getRegistration(input.tournamentId, ctx.user.id);
      if (!reg || reg.status !== "registered") throw new TRPCError({ code: "BAD_REQUEST", message: "Not registered" });
      // Refund entry fee atomically
      const entryFee = parseFloat(tournament.entryFee);
      const userBefore = await db.getUserById(ctx.user.id);
      const balanceBefore = userBefore?.balance ?? "0";
      await db.addUserBalanceAtomic(ctx.user.id, entryFee);
      const balanceAfter = (parseFloat(balanceBefore) + entryFee).toFixed(2);
      // Write tournament refund transaction
      await db.createTransaction({
        userId: ctx.user.id,
        type: "tournament_refund",
        amount: entryFee.toFixed(2),
        balanceBefore,
        balanceAfter,
        status: "confirmed",
        referenceType: "tournament",
        referenceId: input.tournamentId,
        note: `取消报名退费: ${tournament.name}`,
      });
      await db.cancelRegistration(input.tournamentId, ctx.user.id);
      // Update count
      const count = await db.getRegistrationCount(input.tournamentId);
      await db.updateTournament(input.tournamentId, { registeredCount: count });
      // Notify player that registration was cancelled and refunded
      const { notifyTournamentCancelled } = await import("./notifications");
      notifyTournamentCancelled(ctx.user.id, tournament.name, tournament.entryFee).catch(() => {});
      return { success: true };
    }),
    // Protected: get my registration status for a single tournament
    myRegistration: protectedProcedure.input(z.object({ tournamentId: z.number() })).query(async ({ ctx, input }) => {
      return db.getRegistration(input.tournamentId, ctx.user.id);
    }),
    // Protected: get all my active registrations (for lobby "already registered" display)
    myRegistrations: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserActiveRegistrations(ctx.user.id);
    }),
    // Public: get results
    results: publicProcedure.input(z.object({ tournamentId: z.number() })).query(async ({ input }) => {
      return db.getTournamentResults(input.tournamentId);
    }),
    // Protected: get live tournament state (blind level, chip leaders, my table, etc.)
    liveState: protectedProcedure.input(z.object({ tournamentId: z.number() })).query(async ({ ctx, input }) => {
      const { getTournamentState } = await import("./tournamentEngine");
      const state = getTournamentState(input.tournamentId, ctx.user.id);
      if (!state) {
        // Tournament not running in memory - return basic DB info
        const tournament = await db.getTournamentById(input.tournamentId);
        return {
          tournamentId: input.tournamentId,
          name: tournament?.name || "",
          status: tournament?.status || "unknown",
          currentBlindLevel: 0,
          totalBlindLevels: 0,
          currentBlinds: null as { smallBlind: number; bigBlind: number; ante: number } | null,
          nextBlinds: null as { smallBlind: number; bigBlind: number; ante: number } | null,
          timeUntilNextLevel: 0,
          blindDuration: 0,
          activePlayers: 0,
          totalPlayers: 0,
          tables: [] as { roomId: number; playerCount: number }[],
          chipLeaders: [] as { rank: number; userId: number; name: string; chips: number }[],
          myRoomId: null as number | null,
          myChips: null as number | null,
          myRank: null as number | null,
          myEliminated: false,
          startedAt: 0,
          averageStack: 0,
        };
      }
      return state;
    }),
    // Protected: get my tournament table assignment
    myTable: protectedProcedure.query(async ({ ctx }) => {
      const { getPlayerTournamentTable } = await import("./tournamentEngine");
      return getPlayerTournamentTable(ctx.user.id);
    }),
    // Protected: get my tournament history (all past results)
    myHistory: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserTournamentHistory(ctx.user.id);
    }),
    // Public: tournament leaderboard (champions + prize rankings)
    leaderboard: publicProcedure.query(async () => {
      const [champions, prizeLeaders] = await Promise.all([
        db.getTournamentChampions(20),
        db.getTournamentPrizeLeaderboard(20),
      ]);
      return { champions, prizeLeaders };
    }),
  }),
  // Admin Tournaments Management
  adminTournaments: router({
    list: staffProcedure.input(z.object({ status: z.string().optional() })).query(async ({ input }) => {
      const list = await db.listTournaments(input.status);
      // Attach registrations for each tournament
      const result = await Promise.all(list.map(async (t) => {
        const registrations = await db.getTournamentRegistrations(t.id);
        return { ...t, registrations };
      }));
      return result;
    }),
    detail: staffProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const tournament = await db.getTournamentById(input.id);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      const registrations = await db.getTournamentRegistrations(input.id);
      const results = await db.getTournamentResults(input.id);
      return { tournament, registrations, results };
    }),
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      startTime: z.string(), // ISO date string
      registrationOpenTime: z.string().optional(),
      entryFee: z.string(),
      startingChips: z.number().default(10000),
      minPlayers: z.number().default(10),
      maxPlayers: z.number().default(1000),
      playersPerTable: z.number().default(9),
      totalRounds: z.number().default(60),
      blindLevelDuration: z.number().default(10),
      blindStructure: z.array(z.object({ level: z.number(), smallBlind: z.number(), bigBlind: z.number(), ante: z.number() })),
      platformRake: z.string().default("10.00"),
      prizeDistribution: z.array(z.object({ rank: z.number(), percentage: z.number() })),
      tableShuffleInterval: z.number().default(15),
      finalTableThreshold: z.number().default(9),
    })).mutation(async ({ input }) => {
      const id = await db.createTournament({
        ...input,
        startTime: new Date(input.startTime),
        registrationOpenTime: input.registrationOpenTime ? new Date(input.registrationOpenTime) : undefined,
      });
      return { id };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["draft", "registration", "running", "finished", "cancelled"]).optional(),
      startTime: z.string().optional(),
      registrationOpenTime: z.string().optional(),
      entryFee: z.string().optional(),
      startingChips: z.number().optional(),
      minPlayers: z.number().optional(),
      maxPlayers: z.number().optional(),
      playersPerTable: z.number().optional(),
      totalRounds: z.number().optional(),
      blindLevelDuration: z.number().optional(),
      blindStructure: z.array(z.object({ level: z.number(), smallBlind: z.number(), bigBlind: z.number(), ante: z.number() })).optional(),
      platformRake: z.string().optional(),
      prizeDistribution: z.array(z.object({ rank: z.number(), percentage: z.number() })).optional(),
      tableShuffleInterval: z.number().optional(),
      finalTableThreshold: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, startTime, registrationOpenTime, ...rest } = input;
      const updateData: any = { ...rest };
      if (startTime) updateData.startTime = new Date(startTime);
      if (registrationOpenTime) updateData.registrationOpenTime = new Date(registrationOpenTime);
      await db.updateTournament(id, updateData);
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteTournament(input.id);
      return { success: true };
    }),
    // Open registration
    openRegistration: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.updateTournament(input.id, { status: "registration" });
      return { success: true };
    }),
    // Start tournament manually - uses tournamentEngine to create real rooms and seat players
    start: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const tournament = await db.getTournamentById(input.id);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status !== "registration") throw new TRPCError({ code: "BAD_REQUEST", message: "只有报名中的比赛才能开始" });
      const { startTournament } = await import("./tournamentEngine");
      const result = await startTournament(input.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message || "启动锦标赛失败" });
      }
      // Batch notify all registered players that the tournament has started
      const { notifyTournamentStarted } = await import("./notifications");
      const regs = await db.getTournamentRegistrations(input.id);
      const registeredPlayers = regs.filter(r => r.reg.status === "playing");
      await Promise.allSettled(
        registeredPlayers.map(r =>
          notifyTournamentStarted(r.reg.userId, tournament.name, result.players, tournament.startingChips)
        )
      );
      return { success: true, playerCount: result.players, tables: result.tables };
    }),
    // Cancel tournament and refund all - stops running games, kicks players, refunds everyone
    cancel: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const tournament = await db.getTournamentById(input.id);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status !== "registration" && tournament.status !== "running") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能取消报名中或进行中的比赛" });
      }

      // If tournament is running, stop all active tables via tournamentEngine
      if (tournament.status === "running") {
        try {
          const { cancelRunningTournament } = await import("./tournamentEngine");
          await cancelRunningTournament(input.id);
        } catch (e) {
          console.error("[Tournament Cancel] Error stopping engine:", e);
          // Even if engine cleanup fails, continue with refunds
        }
      }

      // Refund all registered/playing players with transaction records
      const regs = await db.getTournamentRegistrations(input.id);
      const entryFee = parseFloat(tournament.entryFee);
      let refundCount = 0;
      for (const r of regs) {
        if (r.reg.status === "registered" || r.reg.status === "playing") {
          const userBefore = await db.getUserById(r.reg.userId);
          const balanceBefore = userBefore?.balance ?? "0";
          await db.addUserBalanceAtomic(r.reg.userId, entryFee);
          const balanceAfter = (parseFloat(balanceBefore) + entryFee).toFixed(2);
          // Write refund transaction
          await db.createTransaction({
            userId: r.reg.userId,
            type: "tournament_refund",
            amount: entryFee.toFixed(2),
            balanceBefore,
            balanceAfter,
            status: "confirmed",
            referenceType: "tournament",
            referenceId: input.id,
            note: `比赛取消退款: ${tournament.name}`,
          });
          await db.cancelRegistration(input.id, r.reg.userId);
          refundCount++;
        }
      }

      // Notify all refunded players
      const { notifyTournamentCancelled } = await import("./notifications");
      for (const r of regs) {
        if (r.reg.status === "registered" || r.reg.status === "playing") {
          notifyTournamentCancelled(r.reg.userId, tournament.name, tournament.entryFee).catch(() => {});
        }
      }

      await db.updateTournament(input.id, { status: "cancelled" });
      return { success: true, refundCount };
    }),
    // Distribute prizes and notify each player of their result
    distributePrizes: adminProcedure.input(z.object({
      id: z.number(),
      results: z.array(z.object({
        userId: z.number(),
        rank: z.number(),
        prizeAmount: z.string(),
        finalChips: z.number().default(0),
        roundsPlayed: z.number().default(0),
        handsWon: z.number().default(0),
      })),
    })).mutation(async ({ input }) => {
      const tournament = await db.getTournamentById(input.id);
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      if (tournament.status !== "running") throw new TRPCError({ code: "BAD_REQUEST", message: "只有进行中的比赛才能发放奖金" });
      const { notifyTournamentResult } = await import("./notifications");
      let distributed = 0;
      for (const r of input.results) {
        // Credit prize to player balance if > 0
        const prizeAmt = parseFloat(r.prizeAmount);
        if (prizeAmt > 0) {
          const prizeUser = await db.getUserById(r.userId);
          const prizeBefore = prizeUser?.balance ?? "0";
          await db.addUserBalanceAtomic(r.userId, prizeAmt);
          const prizeAfter = (parseFloat(prizeBefore) + prizeAmt).toFixed(2);
          // Write tournament prize transaction
          await db.createTransaction({
            userId: r.userId,
            type: "tournament_prize",
            amount: prizeAmt.toFixed(2),
            balanceBefore: prizeBefore,
            balanceAfter: prizeAfter,
            status: "confirmed",
            referenceType: "tournament",
            referenceId: input.id,
            note: `比赛奖金 #${r.rank}: ${tournament.name}`,
          });
          distributed++;
        }
        // Save result record
        await db.saveTournamentResult({
          tournamentId: input.id,
          userId: r.userId,
          rank: r.rank,
          prizeAmount: r.prizeAmount,
          startingChips: tournament.startingChips,
          finalChips: r.finalChips,
          roundsPlayed: r.roundsPlayed,
          handsWon: r.handsWon,
        });
        // Notify player of result
        await notifyTournamentResult(r.userId, tournament.name, r.rank, r.prizeAmount).catch(() => {});
      }
      // Mark tournament as finished
      await db.updateTournament(input.id, { status: "finished" });
      return { success: true, distributed, totalPlayers: input.results.length };
    }),
    // Pause a running tournament
    pause: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { pauseTournament } = await import("./tournamentEngine");
      const ok = await pauseTournament(input.id);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "比赛未在运行中" });
      return { success: true };
    }),
    // Resume a paused tournament
    resume: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { resumeTournament } = await import("./tournamentEngine");
      const ok = await resumeTournament(input.id);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "比赛未在运行中" });
      return { success: true };
    }),
    // Get live state for admin
    liveState: staffProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getTournamentState } = await import("./tournamentEngine");
      return getTournamentState(input.id);
    }),
  }),
  // Admin Banners Management
  adminBanners: router({
    list: staffProcedure.query(async () => {
      const bannerList = await db.getAllBanners();
      // Resolve /manus-storage/ relative paths to signed CDN URLs for browser display
      const { storageGetSignedUrl } = await import("../server/storage");
      return Promise.all(bannerList.map(async (b) => {
        if (b.imageUrl && b.imageUrl.startsWith("/manus-storage/")) {
          const key = b.imageUrl.replace("/manus-storage/", "");
          try {
            const signedUrl = await storageGetSignedUrl(key);
            return { ...b, imageUrl: signedUrl };
          } catch {
            return b;
          }
        }
        return b;
      }));
    }),
    create: staffProcedure.input(z.object({
      title: z.string().min(1),
      imageUrl: z.string().min(1),
      linkUrl: z.string().optional(),
      linkType: z.enum(["url", "page", "none"]).default("none"),
      sortOrder: z.number().default(0),
      isActive: z.boolean().default(true),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createBanner({
        ...input,
        startTime: input.startTime ? new Date(input.startTime) : null,
        endTime: input.endTime ? new Date(input.endTime) : null,
      });
      return { id };
    }),
    update: staffProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      imageUrl: z.string().optional(),
      linkUrl: z.string().nullable().optional(),
      linkType: z.enum(["url", "page", "none"]).optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.startTime !== undefined) updateData.startTime = data.startTime ? new Date(data.startTime) : null;
      if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null;
      await db.updateBanner(id, updateData);
      return { success: true };
    }),
    delete: staffProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteBanner(input.id);
      return { success: true };
    }),
    toggleActive: staffProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ input }) => {
      await db.updateBanner(input.id, { isActive: input.isActive });
      return { success: true };
    }),
    uploadImage: staffProcedure.input(z.object({
      fileName: z.string(),
      fileData: z.string(), // base64 encoded
      contentType: z.string().default("image/png"),
    })).mutation(async ({ input }) => {
      console.log("[uploadImage] start, fileName:", input.fileName, "size:", input.fileData.length);
      const { storagePut } = await import("../server/storage");
      const buffer = Buffer.from(input.fileData, "base64");
      const key = `banners/${Date.now()}-${input.fileName}`;
      console.log("[uploadImage] calling storagePut, key:", key);
      const { url } = await storagePut(key, buffer, input.contentType);
      console.log("[uploadImage] done, url:", url);
      return { url };
    }),
  }),
  // Admin Logs
  adminLogs: router({
    list: staffProcedure.input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      category: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getAdminLogs(input.page, input.limit, {
        category: input.category,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),
    stats: staffProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { today: 0, total: 0, categories: {} };
      const { adminLogs } = await import("../drizzle/schema");
      const { sql, gte } = await import("drizzle-orm");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [totalResult] = await dbInstance.select({ count: sql<number>`count(*)` }).from(adminLogs);
      const [todayResult] = await dbInstance.select({ count: sql<number>`count(*)` }).from(adminLogs)
        .where(gte(adminLogs.createdAt, todayStart));
      const catResults = await dbInstance.select({
        category: adminLogs.category,
        count: sql<number>`count(*)`
      }).from(adminLogs).groupBy(adminLogs.category);
      const categories: Record<string, number> = {};
      catResults.forEach(r => { categories[r.category] = r.count; });
      return { today: todayResult?.count ?? 0, total: totalResult?.count ?? 0, categories };
    }),
  }),

  // ==================== MARKETING ====================
  marketing: router({
    // --- Broadcast ---
    listBroadcasts: adminProcedure.query(async () => {
      const { listBroadcastTasks } = await import("./marketing");
      return listBroadcastTasks();
    }),
    getBroadcast: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getBroadcastTask } = await import("./marketing");
      return getBroadcastTask(input.id);
    }),
    createBroadcast: adminProcedure.input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      buttonText: z.string().optional(),
      buttonUrl: z.string().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string(), row: z.number().optional() })).optional(),
      targetType: z.enum(["all", "active", "deposited", "custom"]),
      targetUserIds: z.array(z.number()).optional(),
      targetFilter: z.object({
        languages: z.array(z.string()).optional(),
        registeredAfter: z.string().optional(),
        registeredBefore: z.string().optional(),
        lastActiveAfter: z.string().optional(),
        lastActiveBefore: z.string().optional(),
        minDeposit: z.number().optional(),
        maxDeposit: z.number().optional(),
        minGamesPlayed: z.number().optional(),
        maxGamesPlayed: z.number().optional(),
        bonusStatus: z.enum(["locked", "unlocked", "any"]).optional(),
      }).optional(),
      scheduledAt: z.date().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { createBroadcastTask } = await import("./marketing");
      const adminId = (ctx.user?.id) ?? 0;
      const id = await createBroadcastTask({ ...input, createdBy: adminId });
      return { id };
    }),
    sendBroadcast: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { updateBroadcastTask, executeBroadcast, getBroadcastTask } = await import("./marketing");
      const task = await getBroadcastTask(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (!['draft', 'pending'].includes(task.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Task already sent or cancelled" });
      await updateBroadcastTask(input.id, { status: "pending" });
      // Execute async (don't await - runs in background)
      executeBroadcast(input.id).catch(e => console.error("[Broadcast] Error:", e));
      return { ok: true };
    }),
    cancelBroadcast: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { cancelBroadcastTask } = await import("./marketing");
      await cancelBroadcastTask(input.id);
      return { ok: true };
    }),

    // --- Auto Reply ---
    listAutoReplies: adminProcedure.query(async () => {
      const { listAutoReplyRules } = await import("./marketing");
      return listAutoReplyRules();
    }),
    createAutoReply: adminProcedure.input(z.object({
      keyword: z.string().min(1),
      matchType: z.enum(["exact", "contains", "regex"]),
      replyContent: z.string().min(1),
      replyType: z.enum(["text", "text_button"]),
      buttonText: z.string().optional(),
      buttonUrl: z.string().optional(),
      isActive: z.boolean().default(true),
      priority: z.number().default(0),
    })).mutation(async ({ input }) => {
      const { createAutoReplyRule } = await import("./marketing");
      const id = await createAutoReplyRule(input);
      return { id };
    }),
    updateAutoReply: adminProcedure.input(z.object({
      id: z.number(),
      keyword: z.string().min(1).optional(),
      matchType: z.enum(["exact", "contains", "regex"]).optional(),
      replyContent: z.string().min(1).optional(),
      replyType: z.enum(["text", "text_button"]).optional(),
      buttonText: z.string().optional(),
      buttonUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      priority: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { updateAutoReplyRule } = await import("./marketing");
      const { id, ...data } = input;
      await updateAutoReplyRule(id, data);
      return { ok: true };
    }),
    deleteAutoReply: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteAutoReplyRule } = await import("./marketing");
      await deleteAutoReplyRule(input.id);
      return { ok: true };
    }),
    toggleAutoReply: adminProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ input }) => {
      const { toggleAutoReplyRule } = await import("./marketing");
      await toggleAutoReplyRule(input.id, input.isActive);
      return { ok: true };
    }),

    // --- Fission Campaigns ---
    listFissions: adminProcedure.query(async () => {
      const { listFissionCampaigns } = await import("./marketing");
      return listFissionCampaigns();
    }),
    getFission: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getFissionStats } = await import("./marketing");
      return getFissionStats(input.id);
    }),
    getFissionClicks: adminProcedure.input(z.object({ id: z.number(), limit: z.number().default(50) })).query(async ({ input }) => {
      const { getFissionClicks } = await import("./marketing");
      return getFissionClicks(input.id, input.limit);
    }),
    createFission: adminProcedure.input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      rewardType: z.enum(["balance", "none"]),
      inviterReward: z.string().default("0.00"),
      inviteeReward: z.string().default("0.00"),
      requireDeposit: z.boolean().default(false),
      minDepositAmount: z.string().default("0.00"),
      maxRewardPerUser: z.string().default("0.00"),
      isActive: z.boolean().default(true),
      startTime: z.date().optional(),
      endTime: z.date().optional(),
    })).mutation(async ({ input }) => {
      const { createFissionCampaign } = await import("./marketing");
      return createFissionCampaign(input);
    }),
    updateFission: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      endTime: z.date().optional(),
    })).mutation(async ({ input }) => {
      const { updateFissionCampaign } = await import("./marketing");
      const { id, ...data } = input;
      await updateFissionCampaign(id, data as any);
      return { ok: true };
    }),
    deleteFission: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteFissionCampaign } = await import("./marketing");
      await deleteFissionCampaign(input.id);
      return { ok: true };
    }),

    // --- Bot Users List ---
    botUsers: adminProcedure.input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      search: z.string().optional(),
    })).query(async ({ input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { users: [], total: 0 };
      const { users } = await import("../drizzle/schema");
      const { isNotNull, like, or, sql, desc } = await import("drizzle-orm");
      const offset = (input.page - 1) * input.limit;
      let whereClause = isNotNull(users.tgId);
      if (input.search) {
        const searchPattern = `%${input.search}%`;
        whereClause = sql`${users.tgId} IS NOT NULL AND (${users.nickname} LIKE ${searchPattern} OR ${users.tgUsername} LIKE ${searchPattern} OR ${users.name} LIKE ${searchPattern})` as any;
      }
      const [data, countResult] = await Promise.all([
        dbInstance.select({
          id: users.id,
          nickname: users.nickname,
          tgUsername: users.tgUsername,
          tgId: users.tgId,
          name: users.name,
          avatar: users.avatar,
          balance: users.balance,
          totalDeposited: users.totalDeposited,
          bonusBalance: users.bonusBalance,
          bonusUnlocked: users.bonusUnlocked,
          lastSignedIn: users.lastSignedIn,
          createdAt: users.createdAt,
          language: users.language,
        }).from(users).where(whereClause).orderBy(desc(users.lastSignedIn)).limit(input.limit).offset(offset),
        dbInstance.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
      ]);
      return { users: data, total: countResult[0]?.count ?? 0 };
    }),

    // --- Message Templates CRUD ---
    listTemplates: adminProcedure.query(async () => {
      const { listMessageTemplates } = await import("./marketing");
      return listMessageTemplates();
    }),
    createTemplate: adminProcedure.input(z.object({
      name: z.string().min(1),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string(), row: z.number().optional() })).optional(),
      category: z.string().default("general"),
    })).mutation(async ({ input, ctx }) => {
      const { createMessageTemplate } = await import("./marketing");
      const id = await createMessageTemplate({ ...input, createdBy: (ctx.user?.id) ?? 0 });
      return { id };
    }),
    updateTemplate: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      imageUrl: z.string().nullable().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string(), row: z.number().optional() })).nullable().optional(),
      category: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { updateMessageTemplate } = await import("./marketing");
      const { id, ...data } = input;
      await updateMessageTemplate(id, data as any);
      return { ok: true };
    }),
    deleteTemplate: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteMessageTemplate } = await import("./marketing");
      await deleteMessageTemplate(input.id);
      return { ok: true };
    }),

    // --- Welcome Templates (Multi-language) ---
    listWelcomeTemplates: adminProcedure.query(async () => {
      const { listWelcomeTemplates } = await import("./marketing");
      return listWelcomeTemplates();
    }),
    createWelcomeTemplate: adminProcedure.input(z.object({
      language: z.string().min(1),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string(), row: z.number().optional() })).optional(),
      isActive: z.boolean().default(true),
    })).mutation(async ({ input, ctx }) => {
      const { createWelcomeTemplate } = await import("./marketing");
      const id = await createWelcomeTemplate({ ...input, createdBy: (ctx.user?.id) ?? 0 });
      return { id };
    }),
    updateWelcomeTemplate: adminProcedure.input(z.object({
      id: z.number(),
      language: z.string().optional(),
      content: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string(), row: z.number().optional() })).nullable().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { updateWelcomeTemplate } = await import("./marketing");
      const { id, ...data } = input;
      await updateWelcomeTemplate(id, data as any);
      return { ok: true };
    }),
    deleteWelcomeTemplate: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteWelcomeTemplate } = await import("./marketing");
      await deleteWelcomeTemplate(input.id);
      return { ok: true };
    }),

    // --- Estimate target count for filter preview ---
    estimateTargetCount: adminProcedure.input(z.object({
      targetType: z.enum(["all", "active", "deposited", "custom"]),
      targetFilter: z.object({
        languages: z.array(z.string()).optional(),
        registeredAfter: z.string().optional(),
        registeredBefore: z.string().optional(),
        lastActiveAfter: z.string().optional(),
        lastActiveBefore: z.string().optional(),
        minDeposit: z.number().optional(),
        maxDeposit: z.number().optional(),
        minGamesPlayed: z.number().optional(),
        maxGamesPlayed: z.number().optional(),
        bonusStatus: z.enum(["locked", "unlocked", "any"]).optional(),
      }).optional(),
      targetUserIds: z.array(z.number()).optional(),
    })).query(async ({ input }) => {
      const { estimateFilterTargetCount } = await import("./marketing");
      const count = await estimateFilterTargetCount(input.targetType, input.targetFilter, input.targetUserIds);
      return { count };
    }),

    // ==================== 优惠券/红包 ====================
    couponList: protectedProcedure.query(async () => {
      const { listCoupons } = await import("./marketing");
      return listCoupons();
    }),
    couponCreate: protectedProcedure.input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(["fixed", "percent", "chips"]),
      amount: z.string(),
      maxBonus: z.string().optional(),
      minDeposit: z.string().optional(),
      maxUses: z.number().default(0),
      maxPerUser: z.number().default(1),
      expiresAt: z.date().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { createCoupon } = await import("./marketing");
      return createCoupon({ ...input, createdBy: ctx.user.id });
    }),
    couponUpdate: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["active", "paused", "expired"]).optional(),
      maxUses: z.number().optional(),
      maxPerUser: z.number().optional(),
      expiresAt: z.date().optional(),
    })).mutation(async ({ input }) => {
      const { updateCoupon } = await import("./marketing");
      const { id, ...data } = input;
      await updateCoupon(id, data as any);
    }),
    couponDelete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteCoupon } = await import("./marketing");
      await deleteCoupon(input.id);
    }),
    couponClaims: protectedProcedure.input(z.object({ couponId: z.number() })).query(async ({ input }) => {
      const { getCouponClaims } = await import("./marketing");
      return getCouponClaims(input.couponId);
    }),
    couponRedeem: protectedProcedure.input(z.object({ code: z.string() })).mutation(async ({ input, ctx }) => {
      const { redeemCoupon } = await import("./marketing");
      return redeemCoupon(ctx.user.id, input.code);
    }),

    // ==================== 签到系统 ====================
    checkinConfig: protectedProcedure.query(async () => {
      const { getCheckinConfig } = await import("./marketing");
      return getCheckinConfig();
    }),
    checkinConfigUpdate: protectedProcedure.input(z.array(z.object({
      dayNumber: z.number(),
      reward: z.string(),
    }))).mutation(async ({ input }) => {
      const { updateCheckinConfig } = await import("./marketing");
      await updateCheckinConfig(input);
    }),
    checkinPerform: protectedProcedure.mutation(async ({ ctx }) => {
      const { performCheckin } = await import("./marketing");
      return performCheckin(ctx.user.id);
    }),
    checkinStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getUserCheckinStatus } = await import("./marketing");
      return getUserCheckinStatus(ctx.user.id);
    }),

    // ==================== 邀请奖励 ====================
    inviteRewardConfig: protectedProcedure.query(async () => {
      const { getInviteRewardConfig } = await import("./marketing");
      return getInviteRewardConfig();
    }),
    inviteRewardConfigUpdate: protectedProcedure.input(z.object({
      inviterReward: z.string(),
      inviteeReward: z.string(),
      maxRewardsPerUser: z.number(),
      requireDeposit: z.boolean(),
      minDepositAmount: z.string(),
      enabled: z.boolean(),
    })).mutation(async ({ input }) => {
      const { updateInviteRewardConfig } = await import("./marketing");
      await updateInviteRewardConfig(input);
    }),
    inviteRewardStats: protectedProcedure.query(async () => {
      const { getInviteRewardStats } = await import("./marketing");
      return getInviteRewardStats();
    }),

    // ==================== 首充优惠 ====================
    firstDepositConfig: protectedProcedure.query(async () => {
      const { getFirstDepositConfig } = await import("./marketing");
      return getFirstDepositConfig();
    }),
    firstDepositConfigUpdate: protectedProcedure.input(z.object({
      bonusPercent: z.number(),
      maxBonus: z.string(),
      enabled: z.boolean(),
    })).mutation(async ({ input }) => {
      const { updateFirstDepositConfig } = await import("./marketing");
      await updateFirstDepositConfig(input);
    }),

    // ==================== 限时活动 ====================
    eventList: protectedProcedure.query(async () => {
      const { listTimeLimitedEvents } = await import("./marketing");
      return listTimeLimitedEvents();
    }),
    eventCreate: protectedProcedure.input(z.object({
      name: z.string().min(1),
      type: z.enum(["double_points", "no_rake", "deposit_bonus", "free_chips", "custom"]),
      description: z.string().optional(),
      config: z.any().optional(),
      startTime: z.date(),
      endTime: z.date(),
    })).mutation(async ({ input, ctx }) => {
      const { createTimeLimitedEvent } = await import("./marketing");
      return createTimeLimitedEvent({ ...input, createdBy: ctx.user.id });
    }),
    eventUpdate: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: z.enum(["double_points", "no_rake", "deposit_bonus", "free_chips", "custom"]).optional(),
      description: z.string().optional(),
      config: z.any().optional(),
      startTime: z.date().optional(),
      endTime: z.date().optional(),
      status: z.enum(["upcoming", "active", "ended", "cancelled"]).optional(),
    })).mutation(async ({ input }) => {
      const { updateTimeLimitedEvent } = await import("./marketing");
      const { id, ...data } = input;
      await updateTimeLimitedEvent(id, data as any);
    }),
    eventDelete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { deleteTimeLimitedEvent } = await import("./marketing");
      await deleteTimeLimitedEvent(input.id);
    }),
    activeEvents: publicProcedure.query(async () => {
      const { getActiveEvents } = await import("./marketing");
      return getActiveEvents();
    }),

    // ==================== 定时推送通知 ====================
    notificationList: protectedProcedure.query(async () => {
      const { listScheduledNotifications } = await import("./marketing");
      return listScheduledNotifications();
    }),
    notificationCreate: protectedProcedure.input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      buttons: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
      targetType: z.enum(["all", "active", "deposited", "custom"]).default("all"),
      targetUserIds: z.array(z.number()).optional(),
      scheduledAt: z.date(),
      repeatType: z.enum(["once", "daily", "weekly"]).default("once"),
    })).mutation(async ({ input, ctx }) => {
      const { createScheduledNotification } = await import("./marketing");
      return createScheduledNotification({ ...input, createdBy: ctx.user.id });
    }),
    notificationCancel: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { cancelScheduledNotification } = await import("./marketing");
      await cancelScheduledNotification(input.id);
    }),
    notificationExecute: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const { executeScheduledNotification } = await import("./marketing");
      await executeScheduledNotification(input.id);
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

