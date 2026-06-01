/**
 * 后台管理员认证服务
 * 处理 admin_users 表的登录、会话管理、密码验证
 */
import { Router, Request, Response } from "express";
import { createHmac, randomBytes } from "crypto";
import { getDb } from "./db";
import { adminUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// SECURITY FIX #4: Enforce JWT_SECRET - no fallback
const ADMIN_SESSION_SECRET = process.env.JWT_SECRET;
if (!ADMIN_SESSION_SECRET) {
  console.error("[SECURITY] FATAL: JWT_SECRET environment variable is not set! Admin sessions will be insecure.");
}
function getSessionSecret(): string {
  if (!ADMIN_SESSION_SECRET) throw new Error("JWT_SECRET not configured");
  return ADMIN_SESSION_SECRET;
}

// SECURITY FIX #7: In-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes lockout

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  // Check lockout
  if (record.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  // Reset if window expired
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION;
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_DURATION / 1000) };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 });
  } else {
    record.count++;
  }
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (now - record.firstAttempt > RATE_LIMIT_WINDOW && record.lockedUntil < now) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

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

// Staff login endpoint - uses admin_users table (separate from game users)
staffRouter.post("/api/staff/login", async (req: Request, res: Response) => {
  try {
    // SECURITY FIX #7: Rate limiting
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: `Too many login attempts. Try again in ${rateCheck.retryAfter}s` });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码必填" });
    }
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const [staff] = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
    if (!staff) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    if (!verifyPassword(password, staff.passwordHash)) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    if (!staff.isActive) {
      return res.status(403).json({ error: "账户已被禁用" });
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(clientIp);

    // Update last login
    await db.update(adminUsers).set({ lastLoginAt: new Date(), lastLoginIp: clientIp }).where(eq(adminUsers.id, staff.id));

    // SECURITY FIX #4: Use enforced secret (no fallback)
    // Issue admin session cookie (separate from game user session)
    const sessionData = {
      adminId: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
      permissions: staff.permissions || [],
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const sig = createHmac("sha256", getSessionSecret())
      .update(sessionToken)
      .digest("hex");
    const cookie = `${sessionToken}.${sig}`;

    res.cookie("vera_admin_session", cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      success: true,
      user: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        username: staff.username,
        permissions: staff.permissions || [],
      },
    });
  } catch (error) {
    console.error("[StaffAuth] Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Staff logout
staffRouter.post("/api/staff/logout", (_req: Request, res: Response) => {
  res.clearCookie("vera_admin_session", { path: "/" });
  return res.json({ success: true });
});

// Verify admin session from cookie
export function verifyAdminSession(cookieValue: string): {
  adminId: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
} | null {
  try {
    // SECURITY FIX #4: Use enforced secret (no fallback)
    const secret = process.env.JWT_SECRET;
    if (!secret) return null; // Cannot verify without secret
    const [token, sig] = cookieValue.split(".");
    if (!token || !sig) return null;
    const expectedSig = createHmac("sha256", secret)
      .update(token)
      .digest("hex");
    if (expectedSig !== sig) return null;
    const data = JSON.parse(Buffer.from(token, "base64").toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// Create staff account (admin only - uses admin_users table)
export async function createStaffAccount(params: {
  username: string;
  password: string;
  name: string;
  role: "super_admin" | "admin" | "cs" | "finance" | "tech";
  permissions?: string[];
}): Promise<{ success: boolean; error?: string; userId?: number }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.username, params.username)).limit(1);
  if (existing) {
    return { success: false, error: "用户名已存在" };
  }
  const { hash } = hashPassword(params.password);
  await db.insert(adminUsers).values({
    username: params.username,
    passwordHash: hash,
    name: params.name,
    role: params.role,
    permissions: params.permissions || [],
    isActive: true,
  });
  const [newUser] = await db.select().from(adminUsers).where(eq(adminUsers.username, params.username)).limit(1);
  return { success: true, userId: newUser?.id };
}

// Update staff password
export async function updateStaffPassword(adminUserId: number, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { hash } = hashPassword(newPassword);
  await db.update(adminUsers).set({ passwordHash: hash }).where(eq(adminUsers.id, adminUserId));
  return true;
}

// Migrate legacy staff accounts from game users table to admin_users table
export async function migrateStaffFromUsers(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { users } = await import("../drizzle/schema");
    const { inArray } = await import("drizzle-orm");

    // Find all game users with staff roles
    const staffUsers = await db.select().from(users)
      .where(inArray(users.role, ["admin", "cs", "finance", "tech"] as any[]));

    if (staffUsers.length === 0) {
      console.log("[StaffAuth] No legacy staff accounts to migrate");
      return;
    }

    let migrated = 0;
    for (const u of staffUsers) {
      // Use staffUsername if available, otherwise generate from name/id
      const username = u.staffUsername || `staff_${u.id}`;
      // Check if already migrated
      const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
      if (existing) {
        console.log(`[StaffAuth] Staff ${username} already exists in admin_users, skipping`);
        continue;
      }
      // Use existing staffPasswordHash if available, otherwise set temp password
      let passwordHash: string;
      if (u.staffPasswordHash) {
        passwordHash = u.staffPasswordHash;
      } else {
        const { hash } = hashPassword("changeme123");
        passwordHash = hash;
      }
      // Map role: admin stays admin, others keep their role
      const adminRole = (u.role === "admin" ? "admin" : u.role) as "admin" | "cs" | "finance" | "tech";
      await db.insert(adminUsers).values({
        username,
        passwordHash,
        name: u.name || username,
        role: adminRole,
        permissions: [],
        isActive: true,
      });
      // Downgrade game user role to 'user' so they no longer have admin access via game session
      await db.update(users).set({ role: "user" }).where(eq(users.id, u.id));
      migrated++;
      console.log(`[StaffAuth] Migrated staff user ${username} (role: ${adminRole}) to admin_users`);
    }
    if (migrated > 0) {
      console.log(`[StaffAuth] Migration complete: ${migrated} staff accounts moved to admin_users`);
    }
  } catch (error) {
    console.error("[StaffAuth] Migration failed:", error);
  }
}

// SECURITY FIX #12: Bootstrap super admin with random password (not hardcoded)
export async function bootstrapSuperAdmin() {
  try {
    const db = await getDb();
    if (!db) return;
    const [existingAdmin] = await db.select().from(adminUsers).where(eq(adminUsers.username, "admin")).limit(1);
    if (existingAdmin) {
      console.log("[StaffAuth] Super admin account already exists in admin_users table");
      return;
    }
    // Generate cryptographically random password
    const randomPwd = randomBytes(12).toString("base64url");
    const { hash } = hashPassword(randomPwd);
    await db.insert(adminUsers).values({
      username: "admin",
      passwordHash: hash,
      name: "Super Admin",
      role: "super_admin",
      permissions: [],
      isActive: true,
    });
    // Log password securely (should be changed immediately after first login)
    console.log(`[StaffAuth] Super admin created. Initial password: ${randomPwd}`);
    console.log("[StaffAuth] ⚠️  CHANGE THIS PASSWORD IMMEDIATELY after first login!");
    // Try to notify owner via TG
    try {
      const { notifyOwner } = await import("./_core/notification");
      await notifyOwner({ title: "管理员账户已创建", content: `用户名: admin\n初始密码: ${randomPwd}\n请立即登录后台修改密码！` });
    } catch { /* notification is best-effort */ }
  } catch (error) {
    console.error("[StaffAuth] Failed to bootstrap super admin:", error);
  }
}

export { staffRouter, hashPassword, verifyPassword };
