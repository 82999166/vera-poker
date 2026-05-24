import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getConfigValue: vi.fn(),
  getPendingDeposits: vi.fn(),
  confirmDepositById: vi.fn(),
  createAdminLog: vi.fn(),
}));

// Mock notifications
vi.mock("./notifications", () => ({
  notifyDepositConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { verifyTransaction, processAutoConfirmDeposits } from "./blockchainVerify";
import { getConfigValue, getPendingDeposits, confirmDepositById } from "./db";

describe("Blockchain Verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyTransaction", () => {
    it("returns error for unsupported chain", async () => {
      const result = await verifyTransaction("0x123", "UNKNOWN");
      expect(result.confirmed).toBe(false);
      expect(result.error).toContain("Unsupported chain");
    });

    it("returns error when no API key configured for ERC20", async () => {
      (getConfigValue as any).mockResolvedValue("");
      const result = await verifyTransaction("0x123", "ERC20");
      expect(result.confirmed).toBe(false);
      expect(result.error).toContain("No API key");
    });

    it("verifies TRC20 transaction successfully", async () => {
      (getConfigValue as any).mockResolvedValue("test-api-key");
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{
              contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
              event_name: "Transfer",
              result: { value: "100000000", to: "abc123", from: "def456" }
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ ret: [{ contractRet: "SUCCESS" }] }]
          })
        });

      const result = await verifyTransaction("txhash123", "TRC20");
      expect(result.confirmed).toBe(true);
      expect(result.amount).toBe("100.00");
    });

    it("verifies ERC20 transaction successfully", async () => {
      (getConfigValue as any).mockResolvedValue("test-etherscan-key");
      const usdtContract = "0xdac17f958d2ee523a2206206994597c13d831ec7";
      const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              status: "0x1",
              blockNumber: "0x100",
              logs: [{
                address: usdtContract,
                topics: [transferTopic, "0x000000000000000000000000abc123", "0x000000000000000000000000def456"],
                data: "0x00000000000000000000000000000000000000000000000000000000005f5e100" // 100 USDT (100000000 in hex = 100M / 1e6 = 100)
              }]
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: "0x110" })
        });

      const result = await verifyTransaction("0xtxhash", "ERC20");
      expect(result.confirmed).toBe(true);
      expect(result.confirmations).toBeGreaterThan(0);
    });
  });

  describe("processAutoConfirmDeposits", () => {
    it("returns early when auto-confirm is disabled", async () => {
      (getConfigValue as any).mockResolvedValue("false");
      const result = await processAutoConfirmDeposits();
      expect(result.processed).toBe(0);
      expect(result.errors).toContain("Auto-confirm is disabled");
    });

    it("processes pending deposits when enabled", async () => {
      (getConfigValue as any).mockImplementation((key: string, def?: string) => {
        if (key === "auto_confirm_enabled") return "true";
        if (key === "auto_confirm_min_confirmations") return "1";
        if (key === "trongrid_api_key") return "test-key";
        return def || "";
      });
      
      (getPendingDeposits as any).mockResolvedValue([
        { id: 1, userId: 10, amount: "100.00", chain: "TRC20", txHash: "txhash1" }
      ]);
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{
              contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
              event_name: "Transfer",
              result: { value: "100000000", to: "abc", from: "def" }
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ ret: [{ contractRet: "SUCCESS" }] }]
          })
        });
      
      (confirmDepositById as any).mockResolvedValue({ id: 1, userId: 10, amount: "100.00", chain: "TRC20" });
      
      const result = await processAutoConfirmDeposits();
      expect(result.processed).toBe(1);
      expect(result.confirmed).toBe(1);
      expect(confirmDepositById).toHaveBeenCalledWith(1);
    });

    it("skips deposits without txHash", async () => {
      (getConfigValue as any).mockImplementation((key: string, def?: string) => {
        if (key === "auto_confirm_enabled") return "true";
        if (key === "auto_confirm_min_confirmations") return "1";
        return def || "";
      });
      
      (getPendingDeposits as any).mockResolvedValue([
        { id: 1, userId: 10, amount: "100.00", chain: null, txHash: null }
      ]);
      
      const result = await processAutoConfirmDeposits();
      expect(result.processed).toBe(0);
      expect(result.confirmed).toBe(0);
    });
  });
});
