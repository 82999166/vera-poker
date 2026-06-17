import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { createPendingLogin, checkLoginRequestStatus } from "../deviceAuth";

/** Build a lightweight device fingerprint from request headers */
function buildDeviceFingerprint(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  const lang = req.headers["accept-language"] || "";
  // Use a hash-like combo: UA + language (IP is too volatile for mobile)
  const raw = `${ua}|${lang}`;
  // Simple djb2 hash
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

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

      // Device fingerprint check (skip for new users)
      let isNewDevice = false;
      if (!isNew) {
        const fingerprint = buildDeviceFingerprint(req);
        const result = await db.updateUserDeviceFingerprint(userInfo.openId, fingerprint);
        isNewDevice = result.isNewDevice;
      } else {
        // Store fingerprint for new users
        const fingerprint = buildDeviceFingerprint(req);
        await db.updateUserDeviceFingerprint(userInfo.openId, fingerprint);
      }

      const cookieOptions = getSessionCookieOptions(req);

      // 如果是新设备且用户已存在，需要旧设备确认
      if (isNewDevice) {
        const existingUser = await db.getUserByOpenId(userInfo.openId);
        if (existingUser) {
          // Create session token with NEXT sessionVersion (will be set after approval)
          const nextSv = existingUser.sessionVersion + 1;
          const sessionToken = await sdk.createSessionToken(userInfo.openId, {
            name: userInfo.name || "",
            expiresInMs: ONE_YEAR_MS,
            sessionVersion: nextSv,
          });
          // 创建待确认登录请求
          const requestId = createPendingLogin({
            userId: existingUser.id,
            openId: userInfo.openId,
            fingerprint: buildDeviceFingerprint(req),
            userAgent: req.headers["user-agent"] || "",
            sessionToken,
          });
          // 重定向到等待确认页面
          res.redirect(302, `/verify-login?pendingLogin=${requestId}&userId=${existingUser.id}`);
          return;
        }
      }

      // 正常登录（非新设备或新用户）- include current sessionVersion in token
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const currentSv = existingUser?.sessionVersion ?? 1;
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
        sessionVersion: currentSv,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
