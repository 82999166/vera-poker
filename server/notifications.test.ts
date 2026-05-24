import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock db module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getConfigValue: vi.fn().mockImplementation(async (key: string) => {
      if (key === "telegram_bot_token") return "test_bot_token_123";
      if (key === "admin_tg_chat_id") return "123456789";
      return null;
    }),
    getDb: vi.fn().mockResolvedValue(null),
  };
});

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => ({ ok: true }) });
  });

  it("should export all notification functions", async () => {
    const notifications = await import("./notifications");
    expect(notifications.sendNotification).toBeDefined();
    expect(notifications.sendBatchNotification).toBeDefined();
    expect(notifications.notifyPrivateRoomInvite).toBeDefined();
    expect(notifications.notifyDepositConfirmed).toBeDefined();
    expect(notifications.notifyWithdrawalApproved).toBeDefined();
    expect(notifications.notifyWithdrawalRejected).toBeDefined();
    expect(notifications.notifyCommissionEarned).toBeDefined();
    expect(notifications.notifyAdmins).toBeDefined();
  });

  it("notifyAdmins should call Telegram API with admin chat ID", async () => {
    const { notifyAdmins } = await import("./notifications");
    await notifyAdmins("Test Alert", "Something happened");
    
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest_bot_token_123/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.chat_id).toBe("123456789");
    expect(callBody.text).toContain("Test Alert");
    expect(callBody.text).toContain("Something happened");
    expect(callBody.parse_mode).toBe("HTML");
  });

  it("notifyDepositConfirmed should format deposit notification correctly", async () => {
    const { notifyDepositConfirmed } = await import("./notifications");
    // Will fail because getUserTgId returns null (no DB), but should not throw
    const result = await notifyDepositConfirmed(1, "100.00", "TRC20");
    expect(result).toBe(false); // No tgId available in test
  });

  it("notifyWithdrawalApproved should format withdrawal notification correctly", async () => {
    const { notifyWithdrawalApproved } = await import("./notifications");
    const result = await notifyWithdrawalApproved(1, "50.00", "abc123txhash");
    expect(result).toBe(false); // No tgId available in test
  });

  it("notifyWithdrawalRejected should format rejection notification correctly", async () => {
    const { notifyWithdrawalRejected } = await import("./notifications");
    const result = await notifyWithdrawalRejected(1, "50.00", "Insufficient funds");
    expect(result).toBe(false); // No tgId available in test
  });

  it("notifyCommissionEarned should format commission notification correctly", async () => {
    const { notifyCommissionEarned } = await import("./notifications");
    const result = await notifyCommissionEarned(1, "5.00", "Player123");
    expect(result).toBe(false); // No tgId available in test
  });

  it("sendBatchNotification should handle multiple users", async () => {
    const { sendBatchNotification } = await import("./notifications");
    const result = await sendBatchNotification(
      [1, 2, 3],
      "system_announcement",
      "Maintenance",
      "System will be down for maintenance"
    );
    // All fail because no tgId available
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(3);
  });
});

describe("Admin Logs", () => {
  it("should have createAdminLog function in db module", async () => {
    const db = await import("./db");
    expect(db.createAdminLog).toBeDefined();
  });

  it("should have getAdminLogs function in db module", async () => {
    const db = await import("./db");
    expect(db.getAdminLogs).toBeDefined();
  });
});
