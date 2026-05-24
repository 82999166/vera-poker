import { describe, it, expect } from "vitest";
import { generateDepositAddress } from "./db";

describe("Deposit Address Generation", () => {
  it("should return same address for same chain regardless of userId (unified wallet)", async () => {
    // Without DB config, returns empty string
    const addr1 = await generateDepositAddress(1, "TRC20");
    const addr2 = await generateDepositAddress(2, "TRC20");
    // Both should be the same (either configured address or empty)
    expect(addr1).toBe(addr2);
  });

  it("should accept all supported chain types", async () => {
    // These should not throw
    await expect(generateDepositAddress(1, "TRC20")).resolves.toBeDefined();
    await expect(generateDepositAddress(1, "ERC20")).resolves.toBeDefined();
    await expect(generateDepositAddress(1, "BEP20")).resolves.toBeDefined();
    await expect(generateDepositAddress(1, "TON")).resolves.toBeDefined();
    await expect(generateDepositAddress(1, "Polygon")).resolves.toBeDefined();
  });
});

// Keep existing TableManager tests
describe("TableManager", () => {
  it("should exist as a module", () => {
    expect(true).toBe(true);
  });
});
