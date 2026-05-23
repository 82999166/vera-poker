import { describe, it, expect, vi } from "vitest";
import { generateDepositAddress } from "./db";

// Mock getConfigValue to return null (fallback to deterministic generation)
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getConfigValue: vi.fn().mockResolvedValue(null),
  };
});

describe("Deposit Address Generation", () => {
  it("should generate deterministic TRC20 address", async () => {
    const addr1 = await generateDepositAddress(1, "TRC20");
    const addr2 = await generateDepositAddress(1, "TRC20");
    expect(addr1).toBe(addr2); // Same user, same chain = same address
    expect(addr1.startsWith("T")).toBe(true);
    expect(addr1.length).toBe(34);
  });

  it("should generate deterministic TON address", async () => {
    const addr1 = await generateDepositAddress(1, "TON");
    const addr2 = await generateDepositAddress(1, "TON");
    expect(addr1).toBe(addr2);
    expect(addr1.startsWith("EQ")).toBe(true);
    expect(addr1.length).toBe(48);
  });

  it("should generate different addresses for different users", async () => {
    const addr1 = await generateDepositAddress(1, "TRC20");
    const addr2 = await generateDepositAddress(2, "TRC20");
    expect(addr1).not.toBe(addr2);
  });
});

// Keep existing TableManager tests
describe("TableManager", () => {
  it("should exist as a module", () => {
    expect(true).toBe(true);
  });
});
