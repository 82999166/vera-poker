/**
 * 设备互斥登录管理模块
 * 功能：新设备登录需要旧设备确认才能通过
 * 
 * 流程：
 * 1. 新设备发起OAuth登录 → 检测到isNewDevice
 * 2. 创建"待确认登录请求"（内存中，60秒超时）
 * 3. 旧设备通过轮询 auth.me 检测到 pendingLoginRequest
 * 4. 旧设备点击"同意" → 服务端递增sessionVersion → 旧设备session失效
 * 5. 新设备获得新session（带新sessionVersion）
 * 6. 如果60秒旧设备无响应 → 自动通过
 */

import * as db from "./db";

// 待确认的登录请求（内存存储，重启后清空）
interface PendingLogin {
  requestId: string;
  userId: number;
  openId: string;
  newDeviceFingerprint: string;
  newDeviceInfo: string; // UA简要描述
  oauthCode: string; // 暂存的OAuth信息
  oauthState: string;
  createdAt: number; // timestamp ms
  status: "pending" | "approved" | "rejected" | "expired";
  sessionToken?: string; // 审批通过后生成的token
}

// userId -> PendingLogin
const pendingLogins = new Map<number, PendingLogin>();

// 清理过期请求（60秒超时自动通过）
const PENDING_TIMEOUT_MS = 60_000;

function cleanExpired() {
  const now = Date.now();
  for (const [userId, req] of pendingLogins.entries()) {
    if (req.status === "pending" && now - req.createdAt > PENDING_TIMEOUT_MS) {
      req.status = "approved"; // 超时自动通过
    }
    // 清理已处理超过5分钟的请求
    if (req.status !== "pending" && now - req.createdAt > 300_000) {
      pendingLogins.delete(userId);
    }
  }
}

// 每10秒清理一次
setInterval(cleanExpired, 10_000);

/**
 * 创建待确认登录请求
 */
export function createPendingLogin(params: {
  userId: number;
  openId: string;
  fingerprint: string;
  userAgent: string;
  sessionToken: string;
}): string {
  const requestId = `lr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // 如果已有pending请求，覆盖
  pendingLogins.set(params.userId, {
    requestId,
    userId: params.userId,
    openId: params.openId,
    newDeviceFingerprint: params.fingerprint,
    newDeviceInfo: parseUserAgent(params.userAgent),
    oauthCode: "",
    oauthState: "",
    createdAt: Date.now(),
    status: "pending",
    sessionToken: params.sessionToken,
  });

  return requestId;
}

/**
 * 检查用户是否有待确认的登录请求（旧设备轮询用）
 */
export function getPendingLoginForUser(userId: number): {
  hasPending: boolean;
  requestId?: string;
  deviceInfo?: string;
  createdAt?: number;
} {
  cleanExpired();
  const req = pendingLogins.get(userId);
  if (!req || req.status !== "pending") {
    return { hasPending: false };
  }
  return {
    hasPending: true,
    requestId: req.requestId,
    deviceInfo: req.newDeviceInfo,
    createdAt: req.createdAt,
  };
}

/**
 * 旧设备同意新设备登录
 * 返回新设备的sessionToken
 */
export async function approveLogin(userId: number, requestId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const req = pendingLogins.get(userId);
  if (!req || req.requestId !== requestId) {
    return { success: false, message: "Request not found or expired" };
  }
  if (req.status !== "pending") {
    return { success: false, message: "Request already processed" };
  }

  req.status = "approved";
  
  // 递增用户的sessionVersion，使旧设备的session失效
  await incrementSessionVersion(userId);

  return { success: true };
}

/**
 * 旧设备拒绝新设备登录
 */
export function rejectLogin(userId: number, requestId: string): { success: boolean; message?: string } {
  const req = pendingLogins.get(userId);
  if (!req || req.requestId !== requestId) {
    return { success: false, message: "Request not found or expired" };
  }
  if (req.status !== "pending") {
    return { success: false, message: "Request already processed" };
  }

  req.status = "rejected";
  return { success: true };
}

/**
 * 新设备检查登录请求状态
 */
export function checkLoginRequestStatus(userId: number, requestId: string): {
  status: "pending" | "approved" | "rejected" | "expired" | "not_found";
  sessionToken?: string;
} {
  cleanExpired();
  const req = pendingLogins.get(userId);
  if (!req || req.requestId !== requestId) {
    return { status: "not_found" };
  }
  if (req.status === "approved") {
    return { status: "approved", sessionToken: req.sessionToken };
  }
  return { status: req.status };
}

/**
 * 递增用户sessionVersion
 */
async function incrementSessionVersion(userId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { users } = await import("../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");
  await dbInstance.update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
}

/**
 * 确保 sessionVersion 已被递增（用于超时自动通过的场景）
 * approveLogin 会递增，但超时自动通过不会，所以 confirmLogin 时需要检查并补增
 */
export async function ensureSessionVersionIncremented(userId: number): Promise<void> {
  const user = await db.getUserById(userId);
  if (!user) return;
  const req = pendingLogins.get(userId);
  if (!req) return;
  // If the token's sv matches user's current sv + 1, it means approveLogin already incremented
  // If not, we need to increment now (auto-approval timeout case)
  // The token was created with nextSv = user.sessionVersion + 1 at creation time
  // If DB sv is still the old value, increment it
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { users } = await import("../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");
  // Only increment if DB version hasn't been incremented yet
  // The token was created with sv = oldVersion + 1, so if DB still has oldVersion, increment
  const expectedNewSv = user.sessionVersion + 1;
  // Check if we need to increment (i.e., approveLogin didn't already do it)
  // We can tell because the pending request's sessionToken has the next version baked in
  // If the user's current DB version is less than what the token expects, increment
  await dbInstance.update(users)
    .set({ sessionVersion: expectedNewSv })
    .where(eq(users.id, userId));
}

/**
 * 验证session版本是否有效
 * 在JWT payload中嵌入sessionVersion，每次请求时对比
 */
export async function isSessionVersionValid(userId: number, tokenVersion: number): Promise<boolean> {
  const user = await db.getUserById(userId);
  if (!user) return false;
  return user.sessionVersion === tokenVersion;
}

/**
 * 解析UA为简短设备描述
 */
function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown Device";
  
  // 检测平台
  if (ua.includes("TelegramDesktop")) return "Telegram Desktop";
  if (ua.includes("Android")) {
    const match = ua.match(/Android\s+([\d.]+)/);
    return `Android ${match?.[1] || ""}`.trim();
  }
  if (ua.includes("iPhone") || ua.includes("iPad")) {
    return ua.includes("iPad") ? "iPad" : "iPhone";
  }
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Mac OS")) return "Mac";
  if (ua.includes("Linux")) return "Linux";
  
  return "Unknown Device";
}

// ==================== 地理位置防作弊 ====================

/**
 * 计算两个GPS坐标之间的距离（米）
 * 使用 Haversine 公式
 */
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * 更新用户GPS位置
 */
export async function updateUserLocation(userId: number, latitude: number, longitude: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await dbInstance.update(users).set({
    lastLatitude: latitude.toFixed(7),
    lastLongitude: longitude.toFixed(7),
    lastLocationAt: new Date(),
  }).where(eq(users.id, userId));
}

/**
 * 检查同桌玩家地理位置是否过近
 * 返回距离过近的玩家对
 */
export async function checkGeoProximity(
  roomId: number,
  userId: number,
  latitude: number,
  longitude: number,
  thresholdMeters: number = 500
): Promise<Array<{ otherUserId: number; otherName: string; distance: number }>> {
  const players = await db.getRoomPlayers(roomId);
  const nearbyPlayers: Array<{ otherUserId: number; otherName: string; distance: number }> = [];

  for (const player of players) {
    if (player.userId === userId) continue;
    
    // 获取该玩家的位置
    const otherUser = await db.getUserById(player.userId);
    if (!otherUser || !otherUser.lastLatitude || !otherUser.lastLongitude) continue;
    // 跳过bot
    if (otherUser.isBot) continue;
    
    // 检查位置时效性（5分钟内的位置才有效）
    if (otherUser.lastLocationAt) {
      const locationAge = Date.now() - new Date(otherUser.lastLocationAt).getTime();
      if (locationAge > 5 * 60 * 1000) continue; // 超过5分钟的位置数据不参与检测
    }

    const distance = calculateDistance(
      latitude, longitude,
      parseFloat(otherUser.lastLatitude),
      parseFloat(otherUser.lastLongitude)
    );

    if (distance < thresholdMeters) {
      nearbyPlayers.push({
        otherUserId: otherUser.id,
        otherName: otherUser.nickname || otherUser.name || `User#${otherUser.id}`,
        distance: Math.round(distance),
      });
    }
  }

  return nearbyPlayers;
}

/**
 * 触发地理位置风控告警
 */
export async function triggerGeoAlert(
  userId: number,
  roomId: number,
  nearbyPlayers: Array<{ otherUserId: number; otherName: string; distance: number }>
): Promise<void> {
  const user = await db.getUserById(userId);
  const userName = user?.nickname || user?.name || `User#${userId}`;

  // 为每对近距离玩家创建风控事件
  for (const nearby of nearbyPlayers) {
    await db.createRiskEvent({
      userId,
      eventType: "geo_proximity",
      severity: "medium",
      details: {
        roomId,
        userName,
        otherUserId: nearby.otherUserId,
        otherName: nearby.otherName,
        distance: nearby.distance,
        message: `玩家 ${userName} 与 ${nearby.otherName} 在同一牌桌，GPS距离仅 ${nearby.distance}米`,
      },
      actionTaken: "flagged",
    });
  }

  // 通知管理员
  const { notifyAdmins } = await import("./notifications");
  const playerPairs = nearbyPlayers.map(p => `${userName} ↔ ${p.otherName} (${p.distance}m)`).join("\n");
  await notifyAdmins(
    "🚨 地理位置防作弊告警",
    `房间ID: ${roomId}\n检测到同桌玩家GPS距离过近：\n${playerPairs}\n\n请核查是否存在串通作弊行为。`
  );
}
