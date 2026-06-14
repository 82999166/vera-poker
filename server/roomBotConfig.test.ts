/**
 * Room Bot Config Tests
 * 验证场次独立bot配置和长期在线bot调度功能
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getConfigValue: vi.fn().mockResolvedValue("false"),
  getAllRoomBotConfigs: vi.fn().mockResolvedValue([]),
  getRoomBotConfig: vi.fn().mockResolvedValue(null),
  upsertRoomBotConfig: vi.fn().mockResolvedValue(undefined),
  deleteRoomBotConfig: vi.fn().mockResolvedValue(undefined),
  getRoomById: vi.fn().mockResolvedValue({ id: 1, type: "public", maxPlayers: 6, minBuyIn: "10.00", name: "Test Room" }),
  getRoomPlayers: vi.fn().mockResolvedValue([]),
  getPublicRooms: vi.fn().mockResolvedValue([
    { id: 1, type: "public", maxPlayers: 6, minBuyIn: "10.00", name: "Room 1", smallBlind: "0.50", bigBlind: "1.00" },
    { id: 2, type: "public", maxPlayers: 6, minBuyIn: "20.00", name: "Room 2", smallBlind: "1.00", bigBlind: "2.00" },
  ]),
  getUserById: vi.fn().mockResolvedValue({ id: 100, balance: "50.00" }),
  deductUserBalanceAtomic: vi.fn().mockResolvedValue("40.00"),
  addUserBalanceAtomic: vi.fn().mockResolvedValue("50.00"),
  createTransaction: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock tableManager
vi.mock("./tableManager", () => ({
  joinTable: vi.fn().mockResolvedValue({ success: true, seatIndex: 0 }),
  processPlayerAction: vi.fn().mockResolvedValue(undefined),
  getTable: vi.fn().mockReturnValue(null),
}));

// Mock gameEngine
vi.mock("./gameEngine", () => ({}));

// Mock notifications
vi.mock("./notifications", () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

// Mock deepseek
vi.mock("./deepseek", () => ({
  invokeLLM: vi.fn().mockResolvedValue(null),
}));

import * as db from "./db";

describe("Room Bot Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BotConfig interface", () => {
    it("should include persistentOnlineCount field", async () => {
      const { getBotConfig, invalidateConfigCache } = await import("./botManager");
      invalidateConfigCache();
      
      // Mock config values
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "true";
        if (key === "bot_persistent_online_count") return "30";
        return defaultVal;
      });
      
      const config = await getBotConfig();
      expect(config.persistentOnlineCount).toBe(30);
      expect(config.enabled).toBe(true);
    });

    it("should default persistentOnlineCount to 0", async () => {
      const { getBotConfig, invalidateConfigCache } = await import("./botManager");
      invalidateConfigCache();
      
      (db.getConfigValue as any).mockImplementation((_key: string, defaultVal: string) => defaultVal);
      
      const config = await getBotConfig();
      expect(config.persistentOnlineCount).toBe(0);
    });
  });

  describe("Room-level config", () => {
    it("getRoomBotConfig should return null when no config exists", async () => {
      const { getRoomBotConfig, invalidateRoomConfigCache } = await import("./botManager");
      invalidateRoomConfigCache();
      (db.getAllRoomBotConfigs as any).mockResolvedValue([]);
      
      const config = await getRoomBotConfig(1);
      expect(config).toBeNull();
    });

    it("getRoomBotConfig should return config when exists", async () => {
      const { getRoomBotConfig, invalidateRoomConfigCache } = await import("./botManager");
      invalidateRoomConfigCache();
      
      (db.getAllRoomBotConfigs as any).mockResolvedValue([
        { roomId: 1, botCount: 4, enabled: true, foldRate: 75, minActionDelay: 3000, maxActionDelay: 6000 },
        { roomId: 2, botCount: 2, enabled: false, foldRate: null, minActionDelay: null, maxActionDelay: null },
      ]);
      
      const config1 = await getRoomBotConfig(1);
      expect(config1).not.toBeNull();
      expect(config1!.botCount).toBe(4);
      expect(config1!.foldRate).toBe(75);
      
      const config2 = await getRoomBotConfig(2);
      expect(config2).not.toBeNull();
      expect(config2!.enabled).toBe(false);
      expect(config2!.foldRate).toBeNull();
    });

    it("invalidateRoomConfigCache should clear cache", async () => {
      const { getRoomBotConfig, invalidateRoomConfigCache } = await import("./botManager");
      
      (db.getAllRoomBotConfigs as any).mockResolvedValue([
        { roomId: 1, botCount: 4, enabled: true, foldRate: 75, minActionDelay: 3000, maxActionDelay: 6000 },
      ]);
      
      invalidateRoomConfigCache();
      const config = await getRoomBotConfig(1);
      expect(config).not.toBeNull();
      
      // Change mock and invalidate
      (db.getAllRoomBotConfigs as any).mockResolvedValue([]);
      invalidateRoomConfigCache();
      
      const config2 = await getRoomBotConfig(1);
      expect(config2).toBeNull();
    });
  });

  describe("checkAndFillBots with room config", () => {
    it("should respect room-level botCount", async () => {
      const { checkAndFillBots, invalidateConfigCache, invalidateRoomConfigCache } = await import("./botManager");
      invalidateConfigCache();
      invalidateRoomConfigCache();
      
      // Enable bot system
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "true";
        if (key === "bot_daily_loss_limit") return "99999";
        if (key === "bot_auto_refill_enabled") return "true";
        if (key === "bot_auto_refill_amount") return "100";
        return defaultVal;
      });
      
      // Set room config with botCount = 5
      (db.getAllRoomBotConfigs as any).mockResolvedValue([
        { roomId: 1, botCount: 5, enabled: true, foldRate: null, minActionDelay: null, maxActionDelay: null },
      ]);
      
      // Room has 0 players
      (db.getRoomPlayers as any).mockResolvedValue([]);
      
      // No bot users available (empty list from DB)
      (db.getDb as any).mockResolvedValue(null);
      
      // This should not throw
      await checkAndFillBots(1);
    });

    it("should skip room when room config has enabled=false", async () => {
      const { checkAndFillBots, invalidateConfigCache, invalidateRoomConfigCache } = await import("./botManager");
      invalidateConfigCache();
      invalidateRoomConfigCache();
      
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "true";
        if (key === "bot_daily_loss_limit") return "99999";
        return defaultVal;
      });
      
      // Room config disabled
      (db.getAllRoomBotConfigs as any).mockResolvedValue([
        { roomId: 1, botCount: 5, enabled: false, foldRate: null, minActionDelay: null, maxActionDelay: null },
      ]);
      
      (db.getRoomPlayers as any).mockResolvedValue([]);
      
      await checkAndFillBots(1);
      // Should not attempt to add any bot (joinTable not called)
      const { joinTable } = await import("./tableManager");
      expect(joinTable).not.toHaveBeenCalled();
    });
  });

  describe("persistentBotScheduler", () => {
    it("should not run when persistentOnlineCount is 0", async () => {
      const { persistentBotScheduler, invalidateConfigCache } = await import("./botManager");
      invalidateConfigCache();
      
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "true";
        if (key === "bot_persistent_online_count") return "0";
        return defaultVal;
      });
      
      await persistentBotScheduler();
      // Should not call getPublicRooms since count is 0
      expect(db.getPublicRooms).not.toHaveBeenCalled();
    });

    it("should not run when bot system is disabled", async () => {
      const { persistentBotScheduler, invalidateConfigCache } = await import("./botManager");
      invalidateConfigCache();
      
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "false";
        if (key === "bot_persistent_online_count") return "30";
        return defaultVal;
      });
      
      await persistentBotScheduler();
      expect(db.getPublicRooms).not.toHaveBeenCalled();
    });

    it("should attempt to fill bots when online count is below target", async () => {
      const { persistentBotScheduler, invalidateConfigCache, invalidateRoomConfigCache } = await import("./botManager");
      invalidateConfigCache();
      invalidateRoomConfigCache();
      
      (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
        if (key === "bot_enabled") return "true";
        if (key === "bot_persistent_online_count") return "30";
        if (key === "bot_daily_loss_limit") return "99999";
        if (key === "bot_max_per_table") return "5";
        return defaultVal;
      });
      
      (db.getAllRoomBotConfigs as any).mockResolvedValue([]);
      (db.getRoomPlayers as any).mockResolvedValue([]);
      
      await persistentBotScheduler();
      // Should have called getPublicRooms to find rooms to fill
      expect(db.getPublicRooms).toHaveBeenCalled();
    });
  });
});
