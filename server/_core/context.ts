import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyAdminSession } from "../staffAuth";

export type AdminSessionUser = {
  adminId: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  isAdminSession: true;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  adminUser: AdminSessionUser | null;
  sessionExpiredOtherDevice: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let adminUser: AdminSessionUser | null = null;

  // Try admin session first (vera_admin_session cookie)
  try {
    const cookies = opts.req.headers.cookie || "";
    const adminCookieMatch = cookies.match(/vera_admin_session=([^;]+)/);
    if (adminCookieMatch) {
      const decoded = verifyAdminSession(decodeURIComponent(adminCookieMatch[1]));
      if (decoded) {
        adminUser = { ...decoded, isAdminSession: true };
      }
    }
  } catch {
    adminUser = null;
  }

  // Try game user session (only if no admin session)
  let sessionExpiredOtherDevice = false;
  if (!adminUser) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (err: any) {
      user = null;
      if (err?.message === "SESSION_EXPIRED_OTHER_DEVICE") {
        sessionExpiredOtherDevice = true;
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    adminUser,
    sessionExpiredOtherDevice,
  };
}
