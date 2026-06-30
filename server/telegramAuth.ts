/**
 * Telegram 认证服务
 * 处理 Telegram Mini App / Login Widget 的用户认证流程
 * 包含：签名验证、用户创建/更新、会话 Cookie 签发
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { resolveAvatarUrl } from "./storage";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { parseDeviceInfo } from "./deviceInfo";

/** Helper: save device info + IP after successful Telegram login */
async function saveDeviceInfoOnLogin(req: Request, openId: string, extraDeviceInfo?: {
  screenWidth?: number; screenHeight?: number; language?: string;
  timezone?: string; fingerprint?: string; platform?: string;
}) {
  try {
    const ua = req.headers["user-agent"] || "";
    const deviceInfo = parseDeviceInfo(ua);
    const loginIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    const { parseDeviceInfoFull } = await import("./deviceInfo");
    const fullInfo = parseDeviceInfoFull(ua);
    await db.updateUserDeviceInfo(openId, deviceInfo, loginIp, {
      ...fullInfo,
      userAgent: ua,
      screenWidth: extraDeviceInfo?.screenWidth,
      screenHeight: extraDeviceInfo?.screenHeight,
      language: extraDeviceInfo?.language,
      timezone: extraDeviceInfo?.timezone,
      fingerprint: extraDeviceInfo?.fingerprint,
      platform: extraDeviceInfo?.platform || "telegram",
    });
  } catch (e) {
    console.error("[TelegramAuth] Failed to save device info:", e);
  }
}

/**
 * Helper: Create session token with device exclusivity.
 * Only increments sessionVersion (kicks old device) when a DIFFERENT device logs in.
 * Same device re-login (matched by UA + IP) just refreshes the cookie without kicking.
 */
async function createExclusiveSessionToken(
  req: Request,
  res: Response,
  user: { id: number; openId: string; sessionVersion: number },
  displayName: string,
  isNew: boolean
) {
  const cookieOptions = getSessionCookieOptions(req);

  if (!isNew) {
    // Check if this is the same device as last login (by UA + IP)
    const currentUA = req.headers["user-agent"] || "";
    const currentIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    
    // Get user's last known device info from DB
    const dbInstance = await db.getDb();
    let isSameDevice = false;
    
    if (dbInstance) {
      const { users } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      // Fetch last login device + IP
      const [dbUser] = await dbInstance.select({
        lastLoginDevice: users.lastLoginDevice,
        lastIp: users.lastIp,
        deviceFingerprint: users.deviceFingerprint,
      }).from(users).where(eq(users.id, user.id)).limit(1);
      
      if (dbUser) {
        const lastDevice = parseDeviceInfo(currentUA);
        // Same device if: same parsed device string AND (same IP OR same fingerprint)
        if (dbUser.lastLoginDevice === lastDevice && 
            (dbUser.lastIp === currentIp || (dbUser.deviceFingerprint && dbUser.deviceFingerprint === (req as any).__fingerprint))) {
          isSameDevice = true;
        }
        // Also check user_devices table by fingerprint if available
        if (!isSameDevice && (req as any).__fingerprint) {
          try {
            const { userDevices } = await import("../drizzle/schema");
            const { and } = await import("drizzle-orm");
            const [existingDevice] = await dbInstance.select({ id: userDevices.id })
              .from(userDevices)
              .where(and(eq(userDevices.userId, user.id), eq(userDevices.fingerprint, (req as any).__fingerprint)))
              .limit(1);
            if (existingDevice) isSameDevice = true;
          } catch (_) { /* ignore */ }
        }
        // Fallback: if same UA and same IP, treat as same device
        if (!isSameDevice && dbUser.lastLoginDevice === lastDevice && dbUser.lastIp === currentIp) {
          isSameDevice = true;
        }
      }
      
      if (!isSameDevice) {
        // Different device: increment sessionVersion to kick old device
        await dbInstance.update(users)
          .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
          .where(eq(users.id, user.id));
      }
    }
    
    const newSv = isSameDevice ? user.sessionVersion : user.sessionVersion + 1;
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: displayName,
      expiresInMs: ONE_YEAR_MS,
      sessionVersion: newSv,
    });
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  } else {
    // New user: sessionVersion starts at 1
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: displayName,
      expiresInMs: ONE_YEAR_MS,
      sessionVersion: 1,
    });
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  }
}

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
      const { initData, refCode } = req.body;
      if (!initData || typeof initData !== "string") {
        res.status(400).json({ error: "initData is required" });
        return;
      }

      // Get bot token from system config
      const botToken = await db.getConfigValue("tg_bot_token");
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

      // Check if user already exists (to determine isNew for device exclusivity)
      const existingBefore = await db.getUserByTgId(String(tgUser.id));
      const isNew = !existingBefore;

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

      // Save device info on Telegram login
      await saveDeviceInfoOnLogin(req, user.openId);

      // Create session token with device exclusivity (increments sessionVersion)
      const displayName = `${tgUser.first_name}${tgUser.last_name ? " " + tgUser.last_name : ""}`;
      await createExclusiveSessionToken(req, res, {
        id: user.id,
        openId: user.openId,
        sessionVersion: (user as any).sessionVersion ?? 1,
      }, displayName, isNew);

      // If refCode provided, bind referral relationship atomically during auth
      let refBound = false;
      if (refCode && typeof refCode === "string" && refCode.length > 0) {
        try {
          const { users } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const dbInstance = await db.getDb();
          if (dbInstance) {
            // Only bind if user has no inviter yet
            const [currentUser] = await dbInstance.select().from(users).where(eq(users.id, user.id)).limit(1);
            if (!currentUser?.invitedBy) {
              const [inviter] = await dbInstance.select().from(users).where(eq(users.inviteCode, refCode)).limit(1);
              if (inviter && inviter.id !== user.id) {
                // Create level 1 relationship
                await db.createAgentRelationship(inviter.id, user.id, 1);
                // If inviter was also invited, create level 2 relationship
                if (inviter.invitedBy) {
                  await db.createAgentRelationship(inviter.invitedBy, user.id, 2);
                }
                // Update user's invitedBy
                await dbInstance.update(users).set({ invitedBy: inviter.id }).where(eq(users.id, user.id));
                refBound = true;
                console.log(`[TG Auth] Referral bound: user ${user.id} -> inviter ${inviter.id}`);
              }
            } else {
              refBound = true; // Already bound, treat as success
            }
          }
        } catch (refErr) {
          console.error("[TG Auth] Referral bind error:", refErr);
          // Non-fatal: auth still succeeds even if ref binding fails
        }
      }

      const resolvedAvatar = await resolveAvatarUrl(user.avatar);
      res.json({
        success: true,
        refBound,
        user: {
          id: user.id,
          name: user.name,
          tgUsername: user.tgUsername,
          avatar: resolvedAvatar,
          language: user.language || tgUser.language_code || "en",
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
      const botToken = await db.getConfigValue("tg_bot_token");
      if (!botToken) {
        res.status(500).json({ error: "Telegram bot not configured" });
        return;
      }

      // Validate login widget data
      if (!validateLoginWidget(data, botToken)) {
        res.status(401).json({ error: "Invalid login widget signature" });
        return;
      }

      // Check if user already exists (to determine isNew for device exclusivity)
      const existingBefore2 = await db.getUserByTgId(String(data.id));
      const isNew2 = !existingBefore2;

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

      // Save device info on Telegram widget login
      await saveDeviceInfoOnLogin(req, user.openId);

      // Create session token with device exclusivity (increments sessionVersion)
      const displayName = `${data.first_name}${data.last_name ? " " + data.last_name : ""}`;
      await createExclusiveSessionToken(req, res, {
        id: user.id,
        openId: user.openId,
        sessionVersion: (user as any).sessionVersion ?? 1,
      }, displayName, isNew2);

      const resolvedAvatar2 = await resolveAvatarUrl(user.avatar);
      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          tgUsername: user.tgUsername,
          avatar: resolvedAvatar2,
        },
      });
    } catch (error) {
      console.error("[TG Auth] Widget auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * GET /api/telegram/widget-callback
   * Handle Telegram Login Widget redirect callback.
   * Telegram redirects here with auth data in query params.
   * We validate, create session, then redirect to the app.
   */
  app.get("/api/telegram/widget-callback", async (req: Request, res: Response) => {
    try {
      const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query as Record<string, string>;

      if (!id || !hash || !auth_date) {
        // If no query params, it might be a postMessage flow - serve a page that posts to opener
        // SECURITY FIX #6: Use window.location.origin instead of '*' for postMessage
        res.send(`<!DOCTYPE html><html><body><script>
          const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
          const data = Object.fromEntries(params.entries());
          if (data.id && window.opener) {
            window.opener.postMessage(data, window.location.origin);
            window.close();
          } else {
            window.location.href = '/';
          }
        </script></body></html>`);
        return;
      }

      // Get bot token from system config
      const botToken = await db.getConfigValue("tg_bot_token");
      if (!botToken) {
        res.status(500).send("Bot not configured");
        return;
      }

      const widgetData: TelegramLoginWidgetData = {
        id: Number(id),
        first_name: first_name || "",
        last_name: last_name || undefined,
        username: username || undefined,
        photo_url: photo_url || undefined,
        auth_date: Number(auth_date),
        hash,
      };

      // Validate
      if (!validateLoginWidget(widgetData, botToken)) {
        res.status(401).send("Invalid signature");
        return;
      }

      // Check if user already exists (to determine isNew for device exclusivity)
      const existingBefore3 = await db.getUserByTgId(String(widgetData.id));
      const isNew3 = !existingBefore3;

      // Find or create user
      const user = await db.findOrCreateTelegramUser({
        tgId: String(widgetData.id),
        tgUsername: widgetData.username || null,
        firstName: widgetData.first_name,
        lastName: widgetData.last_name || null,
        photoUrl: widgetData.photo_url || null,
        languageCode: "en",
        isPremium: false,
      });

      if (!user) {
        res.status(500).send("Failed to create user");
        return;
      }

      // Save device info on Telegram widget callback login
      await saveDeviceInfoOnLogin(req, user.openId);

      // Create session token with device exclusivity (increments sessionVersion)
      const displayName = `${widgetData.first_name}${widgetData.last_name ? " " + widgetData.last_name : ""}`;
      await createExclusiveSessionToken(req, res, {
        id: user.id,
        openId: user.openId,
        sessionVersion: (user as any).sessionVersion ?? 1,
      }, displayName, isNew3);

      // SECURITY FIX #6: Use window.location.origin instead of '*' for postMessage
      res.send(`<!DOCTYPE html><html><body><script>
        if (window.opener) {
          window.opener.postMessage({ id: ${widgetData.id}, success: true }, window.location.origin);
          window.close();
        } else {
          window.location.href = '/lobby';
        }
      </script></body></html>`);
    } catch (error) {
      console.error("[TG Auth] Widget callback error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  /**
   * GET /api/telegram/bot-info
   * Public endpoint to get bot config for Login Widget
   */
  app.get("/api/telegram/bot-info", async (_req: Request, res: Response) => {
    try {
      const botToken = await db.getConfigValue("tg_bot_token");
      const botUsername = await db.getConfigValue("tg_bot_username");
      const clientId = await db.getConfigValue("tg_client_id");
      
      // Extract bot ID from token (format: 123456789:ABCxxx)
      let botId = "";
      if (botToken && botToken.includes(":")) {
        botId = botToken.split(":")[0];
      }
      
      res.json({ botId, botUsername, clientId: clientId || botId });
    } catch {
      res.json({ botId: "", botUsername: "", clientId: "" });
    }
  });

  /**
   * GET /api/telegram/oidc-start
   * Initiate Telegram OIDC login flow.
   * Returns the authorization URL for the frontend to redirect/open popup.
   */
  app.get("/api/telegram/oidc-start", async (req: Request, res: Response) => {
    try {
      const clientId = await db.getConfigValue("tg_client_id");
      if (!clientId) {
        res.status(500).json({ error: "Telegram OIDC not configured (missing client_id)" });
        return;
      }

      // Get origin from query param (frontend passes it)
      const origin = (req.query.origin as string) || "";
      if (!origin) {
        res.status(400).json({ error: "origin parameter required" });
        return;
      }

      // Validate origin against allowed domains
      const miniAppUrl = await db.getConfigValue("telegram_mini_app_url");
      const allowedOrigins = [
        miniAppUrl ? new URL(miniAppUrl).origin : null,
        "https://game.verapoker.com",
      ].filter(Boolean) as string[];
      // Also allow the current request origin for dev
      const requestOrigin = `${req.protocol}://${req.get("host")}`;
      allowedOrigins.push(requestOrigin);
      if (!allowedOrigins.includes(origin)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }

      const redirectUri = `${origin}/api/telegram/oidc-callback`;

      // Generate PKCE code_verifier and code_challenge
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

      // Generate state for CSRF protection (encode codeVerifier in it)
      const statePayload = JSON.stringify({ cv: codeVerifier, origin, ts: Date.now() });
      const state = Buffer.from(statePayload).toString("base64url");

      const authUrl = `https://oauth.telegram.org/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      res.json({ authUrl, state });
    } catch (error) {
      console.error("[TG OIDC] Start error:", error);
      res.status(500).json({ error: "Failed to initiate OIDC flow" });
    }
  });

  /**
   * GET /api/telegram/oidc-callback
   * Handle Telegram OIDC callback with authorization code.
   * Exchanges code for id_token, validates JWT, creates session.
   */
  app.get("/api/telegram/oidc-callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query as Record<string, string>;

      if (!code || !state) {
        res.status(400).send("Missing code or state");
        return;
      }

      // Decode state to get codeVerifier and origin
      let statePayload: { cv: string; origin: string; ts: number };
      try {
        statePayload = JSON.parse(Buffer.from(state, "base64url").toString());
      } catch {
        res.status(400).send("Invalid state");
        return;
      }

      const { cv: codeVerifier, origin } = statePayload;
      const redirectUri = `${origin}/api/telegram/oidc-callback`;

      // Get client credentials
      const clientId = await db.getConfigValue("tg_client_id");
      const clientSecret = await db.getConfigValue("tg_client_secret");

      if (!clientId || !clientSecret) {
        res.status(500).send("OIDC not configured");
        return;
      }

      // Exchange code for tokens
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://oauth.telegram.org/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[TG OIDC] Token exchange failed:", errText);
        res.status(401).send("Token exchange failed");
        return;
      }

      const tokenData = await tokenRes.json() as { id_token?: string; access_token?: string };
      if (!tokenData.id_token) {
        res.status(401).send("No id_token received");
        return;
      }

      // Verify id_token cryptographically using Telegram's JWKS
      const JWKS = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));
      let payload: {
        sub: string;
        id?: number;
        name?: string;
        preferred_username?: string;
        picture?: string;
        phone_number?: string;
        iss?: string;
        aud?: string;
        exp?: number;
      };
      try {
        const { payload: verified } = await jwtVerify(tokenData.id_token, JWKS, {
          issuer: "https://oauth.telegram.org",
          audience: clientId,
        });
        payload = verified as typeof payload;
      } catch (jwtErr) {
        console.error("[TG OIDC] JWT verification failed:", jwtErr);
        res.status(401).send("Token verification failed");
        return;
      }

      const tgId = String(payload.id || payload.sub);
      const username = payload.preferred_username || null;
      const name = payload.name || username || "Telegram User";
      const photoUrl = payload.picture || null;

            // Check if user already exists (to determine isNew for device exclusivity)
      const existingBefore4 = await db.getUserByTgId(tgId);
      const isNew4 = !existingBefore4;

      // Find or create user
      const user = await db.findOrCreateTelegramUser({
        tgId,
        tgUsername: username,
        firstName: name,
        lastName: null,
        photoUrl,
        languageCode: "en",
        isPremium: false,
      });

      if (!user) {
        res.status(500).send("Failed to create user");
        return;
      }

      // Save device info on OIDC login
      await saveDeviceInfoOnLogin(req, user.openId);

      // Create session token with device exclusivity (increments sessionVersion)
      const displayName = name || username || "Player";
      await createExclusiveSessionToken(req, res, {
        id: user.id,
        openId: user.openId,
        sessionVersion: (user as any).sessionVersion ?? 1,
      }, displayName, isNew4);

      // Serve a page that notifies the opener (popup) and closes, or redirects
      res.send(`<!DOCTYPE html><html><body><script>
        if (window.opener) {
          window.opener.postMessage({ success: true, tgId: "${tgId}" }, "${origin}");
          window.close();
        } else {
          window.location.href = '/lobby';
        }
      </script></body></html>`);
    } catch (error) {
      console.error("[TG OIDC] Callback error:", error);
      res.status(500).send("Authentication failed");
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
