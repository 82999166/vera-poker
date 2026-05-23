import { describe, it, expect } from "vitest";
import { generateDepositAddress } from "./db";

describe("Deposit Address Generation", () => {
  it("should generate deterministic TRC20 address", () => {
    const addr1 = generateDepositAddress(1, "TRC20");
    const addr2 = generateDepositAddress(1, "TRC20");
    expect(addr1).toBe(addr2); // Same user, same chain = same address
    expect(addr1.startsWith("T")).toBe(true);
    expect(addr1.length).toBe(34);
  });

  it("should generate deterministic TON address", () => {
    const addr1 = generateDepositAddress(1, "TON");
    const addr2 = generateDepositAddress(1, "TON");
    expect(addr1).toBe(addr2);
    expect(addr1.startsWith("EQ")).toBe(true);
    expect(addr1.length).toBe(48);
  });

  it("should generate different addresses for different users", () => {
    const addr1 = generateDepositAddress(1, "TRC20");
    const addr2 = generateDepositAddress(2, "TRC20");
    expect(addr1).not.toBe(addr2);
  });

  it("should generate different addresses for different chains", () => {
    const addrTRC = generateDepositAddress(1, "TRC20");
    const addrTON = generateDepositAddress(1, "TON");
    expect(addrTRC).not.toBe(addrTON);
  });
});

describe("Table Manager - getPlayerView", () => {
  it("should return waiting state for non-existent table", async () => {
    const { getPlayerView } = await import("./tableManager");
    const view = await getPlayerView(99999, 1);
    expect(view.phase).toBe("waiting");
    expect(view.players).toEqual([]);
    expect(view.communityCards).toEqual([]);
    expect(view.pot).toBe(0);
  });
});
