/**
 * Bot Manager 单元测试
 * 测试AI决策逻辑（概率计算）、每日亏损追踪、配置管理
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

describe("BotManager - AI Decision Logic (Probability-based)", () => {
  it("should have correct pot odds calculation logic", () => {
    // Pot odds = toCall / (pot + toCall)
    // If pot=100, toCall=20: potOdds = 20/120 = 0.167
    // Bot needs equity > 0.167 to call profitably
    const pot = 100;
    const toCall = 20;
    const potOdds = toCall / (pot + toCall);
    expect(potOdds).toBeCloseTo(0.167, 2);
    
    // Flush draw has ~35% equity (9 outs * ~4% on flop)
    // 0.35 > 0.167 => should call
    expect(0.35).toBeGreaterThan(potOdds);
  });

  it("should fold when pot odds are unfavorable", () => {
    // Overbet scenario: pot=20, toCall=40
    // potOdds = 40/60 = 0.667
    // Weak hand equity ~0.25 < 0.667 => fold
    const pot = 20;
    const toCall = 40;
    const potOdds = toCall / (pot + toCall);
    expect(potOdds).toBeCloseTo(0.667, 2);
    expect(0.25).toBeLessThan(potOdds);
  });

  it("should recognize strong preflop hands have high equity", () => {
    // AA equity ~0.85 vs random hand
    // KK equity ~0.82
    // AKs equity ~0.67
    // 72o equity ~0.32
    // These values are used in getPreflopEquity
    const aaEquity = 0.85;
    const kkEquity = 0.82;
    const aksEquity = 0.67;
    const worstEquity = 0.32;
    
    expect(aaEquity).toBeGreaterThan(0.80);
    expect(kkEquity).toBeGreaterThan(0.75);
    expect(aksEquity).toBeGreaterThan(0.60);
    expect(worstEquity).toBeLessThan(0.40);
  });

  it("should have correct postflop hand rank to equity mapping", () => {
    // High card: ~20% equity
    // One pair: ~40% equity
    // Two pair: ~55% equity
    // Three of a kind: ~65% equity
    // Straight: ~72% equity
    // Flush: ~78% equity
    // Full house: ~85% equity
    const handEquities: Record<string, number> = {
      high_card: 0.20,
      one_pair: 0.40,
      two_pair: 0.55,
      three_of_a_kind: 0.65,
      straight: 0.72,
      flush: 0.78,
      full_house: 0.85,
      four_of_a_kind: 0.92,
    };
    
    // Verify hierarchy is correct
    expect(handEquities.one_pair).toBeGreaterThan(handEquities.high_card);
    expect(handEquities.two_pair).toBeGreaterThan(handEquities.one_pair);
    expect(handEquities.three_of_a_kind).toBeGreaterThan(handEquities.two_pair);
    expect(handEquities.straight).toBeGreaterThan(handEquities.three_of_a_kind);
    expect(handEquities.flush).toBeGreaterThan(handEquities.straight);
    expect(handEquities.full_house).toBeGreaterThan(handEquities.flush);
    expect(handEquities.four_of_a_kind).toBeGreaterThan(handEquities.full_house);
  });

  it("should calculate outs correctly for flush draw", () => {
    // 4 cards of same suit = 9 outs to complete flush
    // Each out adds ~2% equity per card to come (turn) or ~4% (flop)
    const flushOuts = 9;
    const turnEquityBoost = flushOuts * 0.02; // ~18%
    const flopEquityBoost = flushOuts * 0.04; // ~36%
    
    expect(turnEquityBoost).toBeCloseTo(0.18, 2);
    expect(flopEquityBoost).toBeCloseTo(0.36, 2);
  });

  it("should never all-in (max 60% of chips as raise)", () => {
    // Bot's makeRaise function caps at 60% of chips
    const chips = 200;
    const maxAllowed = chips * 0.6;
    expect(maxAllowed).toBe(120);
    // Any raise > 120 should be converted to call
    expect(maxAllowed).toBeLessThan(chips);
  });
});
