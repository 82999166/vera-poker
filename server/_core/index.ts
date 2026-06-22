import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerTelegramRoutes } from "./telegram";
import { registerTelegramAuthRoutes } from "../telegramAuth";
import { staffRouter, bootstrapSuperAdmin, migrateStaffFromUsers } from "../staffAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { processAutoConfirmDeposits } from "../blockchainVerify";

/**
 * On server startup, reconcile orphaned room_players records.
 * If the server crashed/restarted while players were seated, their chips are stuck.
 * This function returns chips to their wallet balance and marks them as 'left'.
 * Only processes non-tournament rooms to avoid interfering with tournament state.
 */
async function reconcileOrphanedPlayers() {
  const dbModule = await import("../db");
  const dbInstance = await dbModule.getDb();
  if (!dbInstance) return;
  const { roomPlayers } = await import("../../drizzle/schema");
  const { eq, or } = await import("drizzle-orm");

  // Find all room_players with status 'active' or 'sitting_out' (orphaned from previous session)
  const orphaned = await dbInstance.select({
    roomId: roomPlayers.roomId,
    userId: roomPlayers.userId,
    chipCount: roomPlayers.chipCount,
    status: roomPlayers.status,
  }).from(roomPlayers)
    .where(or(eq(roomPlayers.status, "active"), eq(roomPlayers.status, "sitting_out")));

  if (orphaned.length === 0) {
    console.log("[Startup] No orphaned room_players found.");
    return;
  }

  console.log(`[Startup] Found ${orphaned.length} orphaned room_players, reconciling...`);

  // Filter out tournament rooms
  // Tournament rooms have inviteCode starting with 'T' (e.g. T5_1_abc123)
  // We check DB directly because in-memory activeTournaments is empty after restart
  const roomIds = [...new Set(orphaned.map(o => o.roomId))];
  const { rooms } = await import("../../drizzle/schema");
  const { inArray } = await import("drizzle-orm");
  const roomInfos = roomIds.length > 0
    ? await dbInstance.select({ id: rooms.id, inviteCode: rooms.inviteCode }).from(rooms).where(inArray(rooms.id, roomIds))
    : [];
  // Tournament rooms: inviteCode starts with 'T' followed by tournament ID
  const tournamentRoomIds = new Set(
    roomInfos.filter(r => r.inviteCode && r.inviteCode.startsWith("T")).map(r => r.id)
  );
  const nonTournamentRoomIds = new Set(
    roomIds.filter(rid => !tournamentRoomIds.has(rid))
  );

  let reconciled = 0;
  for (const record of orphaned) {
    // Skip tournament rooms - their state is managed by tournamentEngine
    if (!nonTournamentRoomIds.has(record.roomId)) continue;

    const chips = parseFloat(record.chipCount || "0");
    if (chips > 0) {
      const user = await dbModule.getUserById(record.userId);
      if (user) {
        const balanceBefore = user.balance;
        const newBalance = await dbModule.addUserBalanceAtomic(record.userId, chips);
        await dbModule.createTransaction({
          userId: record.userId,
          type: "leave_table",
          amount: chips.toFixed(2),
          balanceBefore,
          balanceAfter: newBalance || balanceBefore,
          status: "confirmed",
          referenceType: "room",
          referenceId: record.roomId,
          note: `Leave table (server restart reconcile)`,
        });
      }
    }
    await dbModule.removeRoomPlayer(record.roomId, record.userId);
    reconciled++;
  }

  // Update room player counts
  for (const roomId of roomIds) {
    if (!nonTournamentRoomIds.has(roomId)) continue;
    const remaining = await dbModule.getRoomPlayersAll(roomId);
    await dbModule.updateRoom(roomId, { currentPlayers: remaining.length });
  }

  console.log(`[Startup] Reconciled ${reconciled} orphaned players, chips returned to wallets.`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerTelegramRoutes(app);
  registerTelegramAuthRoutes(app);
  app.use(staffRouter);

  // Fission link click tracking: /api/ref/:code
  app.get("/api/ref/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const { getFissionCampaignByCode, recordFissionClick } = await import("../marketing");
      const campaign = await getFissionCampaignByCode(code);
      const miniAppUrl = await import("../db").then(db => db.getConfigValue("telegram_mini_app_url")) || "/";
      if (!campaign || !campaign.isActive) {
        return res.redirect(miniAppUrl as string);
      }
      // Check if campaign has expired
      const now = new Date();
      if (campaign.endTime && new Date(campaign.endTime) < now) {
        return res.redirect(miniAppUrl as string);
      }
      // Record click
      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";
      const inviterIdStr = req.query.inv as string;
      const inviterId = inviterIdStr ? parseInt(inviterIdStr, 10) : undefined;
      await recordFissionClick({
        campaignId: campaign.id,
        linkCode: code,
        inviterId: inviterId && !isNaN(inviterId) ? inviterId : undefined,
        ipAddress,
        userAgent,
      });
      // Redirect to Mini App with ref param
      const redirectUrl = `${miniAppUrl}?startapp=fission_${code}`;
      return res.redirect(redirectUrl as string);
    } catch (err: any) {
      console.error("[Fission] Click tracking error:", err);
      res.redirect("/");
    }
  });

  // Scheduled task: auto-confirm deposits via blockchain verification
  app.post("/api/scheduled/autoConfirmDeposits", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      // Run both: hash-based verification AND address monitoring
      const { processAddressMonitoring } = await import("../blockchainVerify");
      const [hashResult, monitorResult] = await Promise.all([
        processAutoConfirmDeposits(),
        processAddressMonitoring(),
      ]);
      res.json({ ok: true, hashVerification: hashResult, addressMonitoring: monitorResult });
    } catch (err: any) {
      // SECURITY FIX #10: Hide stack traces in production
      console.error("[Cron] autoConfirmDeposits error:", err);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal error" : err.message, timestamp: new Date().toISOString() });
    }
  });

  // Scheduled task: HD wallet chain scan (detect new deposits)
  app.post("/api/scheduled/hdWalletScan", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const { scanAllDepositAddresses, confirmPendingDeposits } = await import("../hdWallet");
      const [scanResult, confirmResult] = await Promise.all([
        scanAllDepositAddresses(),
        confirmPendingDeposits(),
      ]);
      res.json({ ok: true, scan: scanResult, confirm: confirmResult });
    } catch (err: any) {
      console.error("[Cron] hdWalletScan error:", err);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal error" : err.message });
    }
  });

  // Scheduled task: HD wallet consolidation (move funds to main wallet)
  app.post("/api/scheduled/hdWalletConsolidate", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const { consolidateFunds } = await import("../hdWallet");
      const result = await consolidateFunds();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[Cron] hdWalletConsolidate error:", err);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal error" : err.message });
    }
  });

  // Scheduled task: tournament reminders (3h, 1h, 10min before start)
  app.post("/api/scheduled/tournamentReminders", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const { processTournamentReminders } = await import("../tournamentReminders");
      const result = await processTournamentReminders();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      // SECURITY FIX #10: Hide stack traces in production
      console.error("[Cron] tournamentReminders error:", err);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal error" : err.message, timestamp: new Date().toISOString() });
    }
  });

  // TTS proxy for Android WebView (which doesn't support Web Speech API)
  app.get("/api/tts", async (req, res) => {
    try {
      const text = req.query.text as string;
      const lang = (req.query.lang as string) || "zh-CN";
      if (!text || text.length > 200) {
        return res.status(400).json({ error: "Invalid text" });
      }
      // Map locale codes to Google TTS language codes
      const ttsLangMap: Record<string, string> = {
        "en": "en", "zh-CN": "zh-CN", "zh-TW": "zh-TW",
        "ja": "ja", "ko": "ko", "es": "es", "pt": "pt-BR",
        "ru": "ru", "ar": "ar", "vi": "vi", "th": "th", "id": "id",
      };
      const ttsLang = ttsLangMap[lang] || lang;
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(text)}`;
      const response = await fetch(ttsUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!response.ok) {
        return res.status(502).json({ error: "TTS service unavailable" });
      }
      res.set("Content-Type", "audio/mpeg");
      res.set("Cache-Control", "public, max-age=86400"); // Cache for 24h
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated file upload REST endpoint (bypasses tRPC batch link for large files)
  app.post("/api/upload/banner", async (req, res) => {
    try {
      // Auth: accept both admin session and game user admin
      let isAuthorized = false;
      const cookies = req.headers.cookie || "";
      const adminCookieMatch = cookies.match(/vera_admin_session=([^;]+)/);
      if (adminCookieMatch) {
        const { verifyAdminSession } = await import("../staffAuth");
        const decoded = verifyAdminSession(decodeURIComponent(adminCookieMatch[1]));
        if (decoded) isAuthorized = true;
      }
      if (!isAuthorized) {
        const user = await sdk.authenticateRequest(req).catch(() => null);
        if (user && ["admin", "super_admin"].includes((user as any).role)) isAuthorized = true;
      }
      if (!isAuthorized) return res.status(403).json({ error: "Forbidden" });

      const { fileName, fileData, contentType } = req.body;
      if (!fileName || !fileData) return res.status(400).json({ error: "fileName and fileData required" });
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(fileData, "base64");
      const key = `banners/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { url } = await storagePut(key, buffer, contentType || "image/jpeg");
      res.json({ url });
    } catch (err: any) {
      console.error("[upload/banner]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Marketing image upload endpoint (for message templates, welcome messages, etc.)
  app.post("/api/upload/marketing", async (req, res) => {
    try {
      let isAuthorized = false;
      const cookies = req.headers.cookie || "";
      const adminCookieMatch = cookies.match(/vera_admin_session=([^;]+)/);
      if (adminCookieMatch) {
        const { verifyAdminSession } = await import("../staffAuth");
        const decoded = verifyAdminSession(decodeURIComponent(adminCookieMatch[1]));
        if (decoded) isAuthorized = true;
      }
      if (!isAuthorized) {
        const user = await sdk.authenticateRequest(req).catch(() => null);
        if (user && ["admin", "super_admin"].includes((user as any).role)) isAuthorized = true;
      }
      if (!isAuthorized) return res.status(403).json({ error: "Forbidden" });
      const { fileName, fileData, contentType } = req.body;
      if (!fileName || !fileData) return res.status(400).json({ error: "fileName and fileData required" });
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(fileData, "base64");
      const key = `marketing/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { url } = await storagePut(key, buffer, contentType || "image/jpeg");
      res.json({ url });
    } catch (err: any) {
      console.error("[upload/marketing]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Beacon-based leave endpoint (for browser close / app exit)
  // Uses sendBeacon which only supports POST with simple body
  app.post("/api/beacon-leave", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user || (user as any).isCron) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const { roomId } = req.body || {};
      if (!roomId || typeof roomId !== "number") {
        return res.status(400).json({ error: "roomId required" });
      }
      // Import tableManager and execute leave
      const tableManager = await import("../tableManager");
      const dbModule = await import("../db");
      const result = await tableManager.leaveTable(roomId, user.id);
      // Return chips to balance
      if (result.remainingChips > 0) {
        const leaveUser = await dbModule.getUserById(user.id);
        if (leaveUser) {
          const balanceBefore = leaveUser.balance;
          const newBalance = await dbModule.addUserBalanceAtomic(user.id, result.remainingChips);
          const room = await dbModule.getRoomById(roomId);
          await dbModule.createTransaction({
            userId: user.id,
            type: "leave_table",
            amount: result.remainingChips.toFixed(2),
            balanceBefore,
            balanceAfter: newBalance || balanceBefore,
            status: "confirmed",
            referenceType: "room",
            referenceId: roomId,
            note: `Leave table (browser close): ${room?.name ?? `Room #${roomId}`}`,
          });
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[beacon-leave]", err.message);
      res.status(500).json({ error: "internal" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Bootstrap default super admin account
    bootstrapSuperAdmin();
    migrateStaffFromUsers();
    // On startup: reconcile orphaned room_players (server restart while players were seated)
    // Return their chips to wallet balance and mark them as 'left'
    reconcileOrphanedPlayers().catch((err) => console.error("[Startup] reconcile error:", err));
  });
}

startServer().catch(console.error);
