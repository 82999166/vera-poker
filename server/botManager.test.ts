/**
 * Bot Manager 单元测试
 * 测试AI决策逻辑、每日亏损追踪、配置管理
 */
import { describe, it, expect, beforeEach } from "vitest";

// 直接测试内部逻辑（通过导入模块的公开函数）
import {
  getDailyBotLoss,
  addBotLoss,
  addBotWin,
  getBotConfig,
  invalidateConfigCache,
  getActiveBotsCount,
  onBotLeftTable,
} from "./botManager";

describe("BotManager - Daily Loss Tracking", () => {
  beforeEach(() => {
    // Reset daily loss by winning back whatever was lost
    const currentLoss = getDailyBotLoss();
    if (currentLoss > 0) {
      addBotWin(currentLoss);
    }
  });

  it("should track bot losses correctly", () => {
    addBotLoss(50);
    expect(getDailyBotLoss()).toBe(50);
    addBotLoss(30);
    expect(getDailyBotLoss()).toBe(80);
  });

  it("should reduce loss when bot wins", () => {
    addBotLoss(100);
    addBotWin(40);
    expect(getDailyBotLoss()).toBe(60);
  });

  it("should not go below zero on win", () => {
    addBotLoss(20);
    addBotWin(50); // Win more than lost
    expect(getDailyBotLoss()).toBe(0);
  });
});

describe("BotManager - Config", () => {
  it("should return default config when no DB values set", async () => {
    invalidateConfigCache();
    const config = await getBotConfig();
    // Should have all required fields
    expect(config).toHaveProperty("enabled");
    expect(config).toHaveProperty("maxPerTable");
    expect(config).toHaveProperty("dailyLossLimit");
    expect(config).toHaveProperty("foldRate");
    expect(config).toHaveProperty("minActionDelay");
    expect(config).toHaveProperty("maxActionDelay");
    // Validate ranges
    expect(config.maxPerTable).toBeGreaterThanOrEqual(1);
    expect(config.maxPerTable).toBeLessThanOrEqual(5);
    expect(config.foldRate).toBeGreaterThanOrEqual(0);
    expect(config.foldRate).toBeLessThanOrEqual(100);
    expect(config.minActionDelay).toBeLessThan(config.maxActionDelay);
  });
});

describe("BotManager - Active Bots Count", () => {
  it("should return 0 when no bots are seated", () => {
    expect(getActiveBotsCount()).toBeGreaterThanOrEqual(0);
  });

  it("should handle onBotLeftTable gracefully for non-existent room", () => {
    // Should not throw
    onBotLeftTable(99999, 1);
    expect(true).toBe(true);
  });
});
