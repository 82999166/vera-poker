import { Router, Request, Response } from "express";
import { createHmac, randomBytes } from "crypto";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

const staffRouter = Router();

// Hash password with salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString("hex");
  const hash = createHmac("sha256", s).update(password).digest("hex");
  return { hash: `${s}:${hash}`, salt: s };
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = createHmac("sha256", salt).update(password).digest("hex");
  return computed === hash;
}

// Staff login endpoint
staffRouter.post("/api/staff/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码必填" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const [staff] = await db.select().from(users).where(eq(users.staffUsername, username)).limit(1);
    if (!staff || !staff.staffPasswordHash) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    if (!verifyPassword(password, staff.staffPasswordHash)) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    if (staff.riskLevel === "banned" || staff.riskLevel === "frozen") {
      return res.status(403).json({ error: "账户已被禁用" });
    }

    // Check role is staff type
    if (!["admin", "cs", "finance", "tech"].includes(staff.role)) {
      return res.status(403).json({ error: "无管理权限" });
    }

    // Update last signed in
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, staff.id));

    // Issue session cookie using the same SDK method as OAuth
    const token = await sdk.signSession(
      { openId: staff.openId, appId: ENV.appId, name: staff.name || staff.staffUsername || "Staff" },
      { expiresInMs: 30 * 24 * 60 * 60 * 1000 }
    );

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    return res.json({
      success: true,
      user: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        staffUsername: staff.staffUsername,
      },
    });
  } catch (error) {
    console.error("[StaffAuth] Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create staff account (admin only - called from tRPC admin procedure)
export async function createStaffAccount(params: {
  username: string;
  password: string;
  name: string;
  role: "admin" | "cs" | "finance" | "tech";
}): Promise<{ success: boolean; error?: string; userId?: number }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Check if username already exists
  const [existing] = await db.select().from(users).where(eq(users.staffUsername, params.username)).limit(1);
  if (existing) {
    return { success: false, error: "用户名已存在" };
  }

  const { hash } = hashPassword(params.password);
  const openId = `staff_${randomBytes(8).toString("hex")}`;

  await db.insert(users).values({
    openId,
    name: params.name,
    role: params.role,
    staffUsername: params.username,
    staffPasswordHash: hash,
    loginMethod: "staff",
  });

  const [newUser] = await db.select().from(users).where(eq(users.staffUsername, params.username)).limit(1);
  return { success: true, userId: newUser?.id };
}

// Update staff password
export async function updateStaffPassword(userId: number, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { hash } = hashPassword(newPassword);
  await db.update(users).set({ staffPasswordHash: hash }).where(eq(users.id, userId));
  return true;
}

export { staffRouter, hashPassword, verifyPassword };
