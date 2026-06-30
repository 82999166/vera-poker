import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { parseDeviceInfo } from "../deviceInfo";
// deviceAuth imports kept for pendingLogin/checkLoginStatus procedures in routers.ts

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const { isNew } = await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      // Notify admin about new user registration
      if (isNew) {
        import("../notifications").then(({ notifyAdmins }) => {
          notifyAdmins("新用户注册", `新用户: ${userInfo.name || "Unknown"}\n登录方式: ${userInfo.loginMethod || userInfo.platform || "OAuth"}`).catch(() => {});
        }).catch(() => {});
      }

      const cookieOptions = getSessionCookieOptions(req);

      // Save device info on login
      const ua = req.headers["user-agent"] || "";
      const deviceInfo = parseDeviceInfo(ua);
      const loginIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
      const { parseDeviceInfoFull } = await import("../deviceInfo");
      const fullInfo = parseDeviceInfoFull(ua);
      await db.updateUserDeviceInfo(userInfo.openId, deviceInfo, loginIp, {
        ...fullInfo,
        userAgent: ua,
        platform: "web",
      });

      // Device exclusivity: only kick old device if login comes from a DIFFERENT device
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      if (existingUser && !isNew) {
        const dbInstance = await db.getDb();
        let isSameDevice = false;
        
        if (dbInstance) {
          const { users } = await import("../../drizzle/schema");
          const { eq, sql } = await import("drizzle-orm");
          
          // Check if same device by comparing parsed device string + IP
          const currentDevice = deviceInfo; // already parsed above
          const currentIp = loginIp; // already extracted above
          if (existingUser.lastLoginDevice === currentDevice && existingUser.lastIp === currentIp) {
            isSameDevice = true;
          }
          // Also check by fingerprint in user_devices table
          if (!isSameDevice && existingUser.deviceFingerprint) {
            // If user has a known fingerprint and it matches, same device
            // (fingerprint not available at OAuth callback, so rely on UA+IP)
          }
          
          if (!isSameDevice) {
            // Different device: increment sessionVersion to kick old device
            await dbInstance.update(users)
              .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
              .where(eq(users.id, existingUser.id));
          }
        }
        
        const newSv = isSameDevice ? existingUser.sessionVersion : existingUser.sessionVersion + 1;
        const sessionToken = await sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
          sessionVersion: newSv,
        });
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      } else {
        // New user - sessionVersion starts at 1
        const sessionToken = await sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
          sessionVersion: 1,
        });
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      }
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
