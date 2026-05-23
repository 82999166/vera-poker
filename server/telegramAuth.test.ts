import { describe, it, expect } from "vitest";
import { validateInitData, parseInitDataUser, validateLoginWidget } from "./telegramAuth";
import crypto from "crypto";

// Helper to generate valid initData for testing
function generateTestInitData(botToken: string, userData: Record<string, unknown>) {
  const user = JSON.stringify(userData);
  const authDate = Math.floor(Date.now() / 1000);

  const params = new URLSearchParams();
  params.set("user", user);
  params.set("auth_date", String(authDate));
  params.set("query_id", "test_query_123");

  // Sort and create data check string
  const sortedData = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Create secret key
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // Generate hash
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(sortedData)
    .digest("hex");

  params.set("hash", hash);
  return params.toString();
}

// Helper to generate valid login widget data
function generateTestWidgetData(botToken: string, userData: Record<string, unknown>) {
  const authDate = Math.floor(Date.now() / 1000);
  const data = { ...userData, auth_date: authDate };

  // Create data check string (sorted, excluding hash)
  const checkString = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Secret key is SHA-256 of bot token
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  // HMAC-SHA-256
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  return { ...data, hash } as any;
}

describe("Telegram Auth - initData Validation", () => {
  const TEST_BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789";

  it("should validate correct initData", () => {
    const initData = generateTestInitData(TEST_BOT_TOKEN, {
      id: 123456789,
      first_name: "Test",
      username: "testuser",
    });

    expect(validateInitData(initData, TEST_BOT_TOKEN)).toBe(true);
  });

  it("should reject initData with wrong token", () => {
    const initData = generateTestInitData(TEST_BOT_TOKEN, {
      id: 123456789,
      first_name: "Test",
    });

    expect(validateInitData(initData, "wrong_token")).toBe(false);
  });

  it("should reject tampered initData", () => {
    const initData = generateTestInitData(TEST_BOT_TOKEN, {
      id: 123456789,
      first_name: "Test",
    });

    // Tamper with the data
    const tampered = initData.replace("Test", "Hacker");
    expect(validateInitData(tampered, TEST_BOT_TOKEN)).toBe(false);
  });

  it("should reject empty initData", () => {
    expect(validateInitData("", TEST_BOT_TOKEN)).toBe(false);
    expect(validateInitData("no_hash_here", TEST_BOT_TOKEN)).toBe(false);
  });

  it("should reject null/undefined inputs", () => {
    expect(validateInitData(null as any, TEST_BOT_TOKEN)).toBe(false);
    expect(validateInitData("test", null as any)).toBe(false);
  });
});

describe("Telegram Auth - parseInitDataUser", () => {
  it("should parse user from valid initData", () => {
    const params = new URLSearchParams();
    params.set("user", JSON.stringify({ id: 123, first_name: "Alice", username: "alice" }));
    params.set("auth_date", "1700000000");
    params.set("hash", "abc123");

    const user = parseInitDataUser(params.toString());
    expect(user).not.toBeNull();
    expect(user!.id).toBe(123);
    expect(user!.first_name).toBe("Alice");
    expect(user!.username).toBe("alice");
  });

  it("should return null for initData without user", () => {
    const params = new URLSearchParams();
    params.set("auth_date", "1700000000");
    params.set("hash", "abc123");

    expect(parseInitDataUser(params.toString())).toBeNull();
  });

  it("should return null for invalid JSON in user field", () => {
    const params = new URLSearchParams();
    params.set("user", "not_json");
    params.set("hash", "abc123");

    expect(parseInitDataUser(params.toString())).toBeNull();
  });
});

describe("Telegram Auth - Login Widget Validation", () => {
  const TEST_BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789";

  it("should validate correct widget data", () => {
    const widgetData = generateTestWidgetData(TEST_BOT_TOKEN, {
      id: 123456789,
      first_name: "Test",
      username: "testuser",
    });

    expect(validateLoginWidget(widgetData, TEST_BOT_TOKEN)).toBe(true);
  });

  it("should reject widget data with wrong token", () => {
    const widgetData = generateTestWidgetData(TEST_BOT_TOKEN, {
      id: 123456789,
      first_name: "Test",
    });

    expect(validateLoginWidget(widgetData, "wrong_token")).toBe(false);
  });

  it("should reject expired widget data (>24h)", () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const data = {
      id: 123456789,
      first_name: "Test",
      auth_date: oldAuthDate,
    };

    // Generate hash with old auth_date
    const checkString = Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHash("sha256").update(TEST_BOT_TOKEN).digest();
    const hash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

    expect(validateLoginWidget({ ...data, hash } as any, TEST_BOT_TOKEN)).toBe(false);
  });

  it("should reject null/undefined inputs", () => {
    expect(validateLoginWidget(null as any, TEST_BOT_TOKEN)).toBe(false);
    expect(validateLoginWidget({} as any, TEST_BOT_TOKEN)).toBe(false);
  });
});
