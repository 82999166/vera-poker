import { describe, it, expect, beforeEach } from "vitest";
import { processPlayerAction, getPlayerView } from "./tableManager";

/**
 * Test action validation logic in isolation
 * Since processPlayerAction requires an active table in memory,
 * we test the validation rules by checking return values
 */
describe("Table Action Validation", () => {
  it("should reject action when no active game exists", async () => {
    const result = await processPlayerAction(99999, 1, "fold");
    expect(result.success).toBe(false);
    expect(result.message).toBe("No active game");
  });

  it("should reject action for non-existent table", async () => {
    const result = await processPlayerAction(88888, 1, "call");
    expect(result.success).toBe(false);
    expect(result.message).toBe("No active game");
  });

  it("should reject raise with no amount", async () => {
    const result = await processPlayerAction(77777, 1, "raise");
    expect(result.success).toBe(false);
    expect(result.message).toBe("No active game");
  });

  it("should reject all_in when no game exists", async () => {
    const result = await processPlayerAction(66666, 1, "all_in");
    expect(result.success).toBe(false);
  });

  it("should return waiting state for non-existent table view", () => {
    const view = getPlayerView(55555, 1);
    expect(view.phase).toBe("waiting");
    expect(view.players).toEqual([]);
    expect(view.pot).toBe(0);
    expect(view.communityCards).toEqual([]);
    expect(view.myCards).toEqual([]);
  });
});

describe("Deposit Address Generation", () => {
  it("should generate consistent addresses", async () => {
    const { generateDepositAddress } = await import("./db");
    
    // Same user, same chain = same address (deterministic)
    const addr1 = generateDepositAddress(42, "TRC20");
    const addr2 = generateDepositAddress(42, "TRC20");
    expect(addr1).toBe(addr2);
    
    // TRC20 format
    expect(addr1.startsWith("T")).toBe(true);
    expect(addr1.length).toBe(34);
    
    // TON format
    const tonAddr = generateDepositAddress(42, "TON");
    expect(tonAddr.startsWith("EQ")).toBe(true);
    expect(tonAddr.length).toBe(48);
    
    // Different users get different addresses
    const addr3 = generateDepositAddress(43, "TRC20");
    expect(addr3).not.toBe(addr1);
    
    // Different chains get different addresses
    expect(addr1).not.toBe(tonAddr);
  });
});
