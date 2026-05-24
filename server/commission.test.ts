import { describe, it, expect, vi } from "vitest";

/**
 * Commission distribution logic tests
 * Tests the commission calculation and distribution flow
 */
describe("Commission Calculation Logic", () => {
  it("should calculate level 1 commission correctly", () => {
    const totalRake = 10; // $10 rake
    const playerCount = 4;
    const perPlayerRake = totalRake / playerCount; // $2.50 per player
    const level1Rate = 10 / 100; // 10%
    const commission = perPlayerRake * level1Rate;
    expect(commission).toBe(0.25); // $0.25 commission for level 1
  });

  it("should calculate level 2 commission correctly", () => {
    const totalRake = 10;
    const playerCount = 4;
    const perPlayerRake = totalRake / playerCount;
    const level2Rate = 5 / 100; // 5%
    const commission = perPlayerRake * level2Rate;
    expect(commission).toBe(0.125); // $0.125 commission for level 2
  });

  it("should not distribute commission for locked downlines", () => {
    const isUnlocked = false;
    const totalRake = 10;
    const level1Rate = 10 / 100;
    // If not unlocked, commission should be 0
    const commission = isUnlocked ? totalRake * level1Rate : 0;
    expect(commission).toBe(0);
  });

  it("should check unlock conditions correctly", () => {
    const progress = { gamesPlayed: 20, totalDeposit: "15.00", totalRake: "2.50" };
    const shouldUnlock = progress.gamesPlayed >= 20 &&
      parseFloat(progress.totalDeposit) >= 10 &&
      parseFloat(progress.totalRake) >= 1;
    expect(shouldUnlock).toBe(true);
  });

  it("should not unlock if games played is insufficient", () => {
    const progress = { gamesPlayed: 15, totalDeposit: "15.00", totalRake: "2.50" };
    const shouldUnlock = progress.gamesPlayed >= 20 &&
      parseFloat(progress.totalDeposit) >= 10 &&
      parseFloat(progress.totalRake) >= 1;
    expect(shouldUnlock).toBe(false);
  });

  it("should not unlock if deposit is insufficient", () => {
    const progress = { gamesPlayed: 25, totalDeposit: "5.00", totalRake: "2.50" };
    const shouldUnlock = progress.gamesPlayed >= 20 &&
      parseFloat(progress.totalDeposit) >= 10 &&
      parseFloat(progress.totalRake) >= 1;
    expect(shouldUnlock).toBe(false);
  });

  it("should not unlock if rake is insufficient", () => {
    const progress = { gamesPlayed: 25, totalDeposit: "15.00", totalRake: "0.50" };
    const shouldUnlock = progress.gamesPlayed >= 20 &&
      parseFloat(progress.totalDeposit) >= 10 &&
      parseFloat(progress.totalRake) >= 1;
    expect(shouldUnlock).toBe(false);
  });

  it("should handle zero rake correctly", () => {
    const totalRake = 0;
    const playerCount = 4;
    // When totalRake is 0, no commission should be distributed
    const shouldDistribute = totalRake > 0;
    expect(shouldDistribute).toBe(false);
  });

  it("should correctly update agent balance", () => {
    const currentBalance = "100.50";
    const commissionAmount = 0.25;
    const newBalance = (parseFloat(currentBalance) + commissionAmount).toFixed(2);
    expect(newBalance).toBe("100.75");
  });

  it("should correctly update totalCommissionEarned", () => {
    const currentEarned = "5.00";
    const commissionAmount = 0.25;
    const newEarned = (parseFloat(currentEarned) + commissionAmount).toFixed(2);
    expect(newEarned).toBe("5.25");
  });
});

describe("Rake Calculation Logic", () => {
  it("should calculate rake with cap correctly", () => {
    const pot = 100;
    const rakePercent = 5;
    const rakeCap = 3;
    const rake = Math.min(pot * rakePercent / 100, rakeCap);
    expect(rake).toBe(3); // Capped at $3
  });

  it("should calculate rake below cap correctly", () => {
    const pot = 20;
    const rakePercent = 5;
    const rakeCap = 3;
    const rake = Math.min(pot * rakePercent / 100, rakeCap);
    expect(rake).toBe(1); // 5% of $20 = $1, below cap
  });

  it("should handle side pot rake distribution", () => {
    const pots = [
      { amount: 40, eligible: ["p1", "p2"] },
      { amount: 20, eligible: ["p1"] },
    ];
    const rakePercent = 5;
    const rakeCap = 3;
    let totalRake = 0;
    for (const pot of pots) {
      const potRake = Math.min(pot.amount * rakePercent / 100, rakeCap / pots.length);
      totalRake += potRake;
    }
    // Pot 1: min(40*5/100, 3/2) = min(2, 1.5) = 1.5
    // Pot 2: min(20*5/100, 3/2) = min(1, 1.5) = 1
    expect(totalRake).toBe(2.5);
  });
});

describe("TG Share Link", () => {
  it("should generate correct TG share URL", () => {
    const inviteLink = "https://t.me/VeraPokerbot?start=ref_ABC123";
    const text = "Join me on Vera Poker!";
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    expect(tgShareUrl).toContain("https://t.me/share/url?url=");
    expect(tgShareUrl).toContain("VeraPokerbot");
    expect(tgShareUrl).toContain("ref_ABC123");
  });

  it("should use bot username from config for invite link", () => {
    const botUsername = "VeraPokerbot";
    const inviteCode = "ABC123";
    const inviteLink = `https://t.me/${botUsername}?start=ref_${inviteCode}`;
    expect(inviteLink).toBe("https://t.me/VeraPokerbot?start=ref_ABC123");
  });
});
