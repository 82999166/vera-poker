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

  // Scheduled task: auto-confirm deposits via blockchain verification
  app.post("/api/scheduled/autoConfirmDeposits", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const result = await processAutoConfirmDeposits();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
    }
  });

  // TTS proxy for Android WebView (which doesn't support Web Speech API)
  app.get("/api/tts", async (req, res) => {
    try {
      const text = req.query.text as string;
      if (!text || text.length > 200) {
        return res.status(400).json({ error: "Invalid text" });
      }
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(text)}`;
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
  });
}

startServer().catch(console.error);
