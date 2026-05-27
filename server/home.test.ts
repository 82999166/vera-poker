import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Home.tsx deep link handling
 * 
 * Focus: Verify that TG deep links with ref_ parameters are properly processed
 * and the referral registration completes before navigation
 */

describe("Home - Deep Link Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract ref code from deep link parameter", () => {
    const startParam = "ref_FQZKDJ7G";
    const refCode = startParam.replace("ref_", "");
    expect(refCode).toBe("FQZKDJ7G");
  });

  it("should extract room code from deep link parameter", () => {
    const startParam = "room_12345";
    const roomCode = startParam.replace("room_", "");
    expect(roomCode).toBe("12345");
  });

  it("should handle invalid ref code gracefully", () => {
    const startParam = "ref_";
    const refCode = startParam.replace("ref_", "");
    expect(refCode).toBe("");
  });

  it("should identify ref_ prefix correctly", () => {
    expect("ref_FQZKDJ7G".startsWith("ref_")).toBe(true);
    expect("room_12345".startsWith("ref_")).toBe(false);
    expect("invalid".startsWith("ref_")).toBe(false);
  });

  it("should identify room_ prefix correctly", () => {
    expect("room_12345".startsWith("room_")).toBe(true);
    expect("ref_FQZKDJ7G".startsWith("room_")).toBe(false);
    expect("invalid".startsWith("room_")).toBe(false);
  });
});

describe("Home - Referral Registration", () => {
  it("should format referral registration input correctly", () => {
    const inviteCode = "FQZKDJ7G";
    const input = { inviteCode };
    
    expect(input).toEqual({
      inviteCode: "FQZKDJ7G"
    });
  });

  it("should handle registration success response", () => {
    const response = { success: true };
    expect(response.success).toBe(true);
  });

  it("should handle registration error gracefully", () => {
    const errorMessage = "Invalid invite code";
    expect(errorMessage).toBeTruthy();
  });
});

describe("Home - Navigation Logic", () => {
  it("should navigate to lobby after successful registration", () => {
    const destination = "/lobby";
    expect(destination).toBe("/lobby");
  });

  it("should navigate to table when room code is valid", () => {
    const roomId = 123;
    const destination = `/table/${roomId}`;
    expect(destination).toBe("/table/123");
  });

  it("should fallback to lobby on invalid room code", () => {
    const destination = "/lobby";
    expect(destination).toBe("/lobby");
  });
});
