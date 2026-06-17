import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
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

      // Device exclusivity: every login increments sessionVersion to invalidate old sessions
      // This ensures only ONE device can be active at a time
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      if (existingUser && !isNew) {
        // Increment sessionVersion in DB
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { users } = await import("../../drizzle/schema");
          const { eq, sql } = await import("drizzle-orm");
          await dbInstance.update(users)
            .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
            .where(eq(users.id, existingUser.id));
        }
        // Create token with the NEW sessionVersion
        const newSv = existingUser.sessionVersion + 1;
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
