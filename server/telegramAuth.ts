import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import * as db from "./db";

// ==================== TYPES ====================

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramLoginWidgetData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// ==================== VALIDATION ====================

/**
 * Validate Telegram Mini App initData using HMAC-SHA256
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    // Remove hash from params and sort alphabetically
    params.delete("hash");
    const sortedEntries = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Create secret key: HMAC-SHA256 of bot token with "WebAppData" as key
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Generate data check hash
    const dataCheck = crypto
      .createHmac("sha256", secretKey)
      .update(sortedEntries)
      .digest("hex");

    return dataCheck === hash;
  } catch (error) {
    console.error("[TG Auth] initData validation error:", error);
    return false;
  }
}

/**
 * Parse user data from initData string
 */
export function parseInitDataUser(initData: string): TelegramWebAppUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramWebAppUser;
  } catch {
    return null;
  }
}

/**
 * Validate Telegram Login Widget data using SHA-256 hash
 * Reference: https://core.telegram.org/widgets/login#checking-authorization
 */
export function validateLoginWidget(
  data: TelegramLoginWidgetData,
  botToken: string
): boolean {
  if (!data || !botToken) return false;

  try {
    const { hash, ...rest } = data;
    if (!hash) return false;

    // Check auth_date is not too old (allow 24 hours)
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400) return false;

    // Create data check string (sorted key=value pairs)
    const checkString = Object.entries(rest)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Secret key is SHA-256 of bot token
    const secretKey = crypto.createHash("sha256").update(botToken).digest();

    // HMAC-SHA-256 of data check string
    const hmac = crypto
      .createHmac("sha256", secretKey)
      .update(checkString)
      .digest("hex");

    return hmac === hash;
  } catch (error) {
    console.error("[TG Auth] Login widget validation error:", error);
    return false;
  }
}

// ==================== ROUTE HANDLERS ====================

/**
 * Register Telegram authentication routes
 */
export function registerTelegramAuthRoutes(app: Express) {
  /**
   * POST /api/telegram/auth/webapp
   * Authenticate via Telegram Mini App initData
   * Body: { initData: string }
   */
  app.post("/api/telegram/auth/webapp", async (req: Request, res: Response) => {
    try {
      const { initData } = req.body;
      if (!initData || typeof initData !== "string") {
        res.status(400).json({ error: "initData is required" });
        return;
      }

      // Get bot token from system config
      const botToken = await db.getConfigValue("telegram_bot_token");
      if (!botToken) {
        res.status(500).json({ error: "Telegram bot not configured" });
        return;
      }

      // Validate initData
      if (!validateInitData(initData, botToken)) {
        res.status(401).json({ error: "Invalid initData signature" });
        return;
      }

      // Parse user from initData
      const tgUser = parseInitDataUser(initData);
      if (!tgUser || !tgUser.id) {
        res.status(400).json({ error: "No user data in initData" });
        return;
      }

      // Find or create user by tgId
      const user = await db.findOrCreateTelegramUser({
        tgId: String(tgUser.id),
        tgUsername: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        photoUrl: tgUser.photo_url || null,
        languageCode: tgUser.language_code || "en",
        isPremium: tgUser.is_premium || false,
      });

      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Create session token
      const displayName = tgUser.username
        ? `@${tgUser.username}`
        : `${tgUser.first_name}${tgUser.last_name ? " " + tgUser.last_name : ""}`;

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          tgUsername: user.tgUsername,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error("[TG Auth] WebApp auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * POST /api/telegram/auth/widget
   * Authenticate via Telegram Login Widget
   * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
   */
  app.post("/api/telegram/auth/widget", async (req: Request, res: Response) => {
    try {
      const data = req.body as TelegramLoginWidgetData;
      if (!data || !data.id || !data.hash || !data.auth_date) {
        res.status(400).json({ error: "Invalid login widget data" });
        return;
      }

      // Get bot token from system config
      const botToken = await db.getConfigValue("telegram_bot_token");
      if (!botToken) {
        res.status(500).json({ error: "Telegram bot not configured" });
        return;
      }

      // Validate login widget data
      if (!validateLoginWidget(data, botToken)) {
        res.status(401).json({ error: "Invalid login widget signature" });
        return;
      }

      // Find or create user by tgId
      const user = await db.findOrCreateTelegramUser({
        tgId: String(data.id),
        tgUsername: data.username || null,
        firstName: data.first_name,
        lastName: data.last_name || null,
        photoUrl: data.photo_url || null,
        languageCode: "en",
        isPremium: false,
      });

      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Create session token
      const displayName = data.username
        ? `@${data.username}`
        : `${data.first_name}${data.last_name ? " " + data.last_name : ""}`;

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          tgUsername: user.tgUsername,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error("[TG Auth] Widget auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * GET /api/telegram/auth/status
   * Check if current session is TG-authenticated
   */
  app.get("/api/telegram/auth/status", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user && user.tgId) {
        res.json({ authenticated: true, tgId: user.tgId, tgUsername: user.tgUsername });
      } else if (user) {
        res.json({ authenticated: true, tgId: null });
      } else {
        res.json({ authenticated: false });
      }
    } catch {
      res.json({ authenticated: false });
    }
  });
}
