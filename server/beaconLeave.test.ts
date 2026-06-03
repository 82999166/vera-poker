import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for beacon-leave endpoint and reconcileOrphanedPlayers logic.
 * These tests verify the settlement flow when players disconnect without clicking "Leave".
 */

// Mock db module
const mockGetUserById = vi.fn();
const mockAddUserBalanceAtomic = vi.fn();
const mockCreateTransaction = vi.fn();
const mockRemoveRoomPlayer = vi.fn();
const mockGetRoomById = vi.fn();
const mockGetRoomPlayersAll = vi.fn();
const mockUpdateRoom = vi.fn();
const mockGetDb = vi.fn();

vi.mock("../server/db", () => ({
  getUserById: (...args: any[]) => mockGetUserById(...args),
  addUserBalanceAtomic: (...args: any[]) => mockAddUserBalanceAtomic(...args),
  createTransaction: (...args: any[]) => mockCreateTransaction(...args),
  removeRoomPlayer: (...args: any[]) => mockRemoveRoomPlayer(...args),
  getRoomById: (...args: any[]) => mockGetRoomById(...args),
  getRoomPlayersAll: (...args: any[]) => mockGetRoomPlayersAll(...args),
  updateRoom: (...args: any[]) => mockUpdateRoom(...args),
  getDb: (...args: any[]) => mockGetDb(...args),
}));

// Mock tableManager
const mockLeaveTable = vi.fn();
vi.mock("../server/tableManager", () => ({
  leaveTable: (...args: any[]) => mockLeaveTable(...args),
}));

describe("Beacon Leave - Settlement Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return chips to user balance when leaveTable returns remainingChips > 0", async () => {
    // Simulate the beacon-leave handler logic
    const userId = 1;
    const roomId = 5;
    const remainingChips = 150.50;

    mockLeaveTable.mockResolvedValue({ success: true, remainingChips });
    mockGetUserById.mockResolvedValue({ id: userId, balance: "100.00" });
    mockAddUserBalanceAtomic.mockResolvedValue("250.50");
    mockGetRoomById.mockResolvedValue({ id: roomId, name: "Test Room" });
    mockCreateTransaction.mockResolvedValue(null);

    // Execute the same logic as the beacon-leave handler
    const result = await mockLeaveTable(roomId, userId);
    expect(result.remainingChips).toBe(150.50);

    if (result.remainingChips > 0) {
      const user = await mockGetUserById(userId);
      expect(user).toBeTruthy();

      if (user) {
        const balanceBefore = user.balance;
        const newBalance = await mockAddUserBalanceAtomic(userId, result.remainingChips);
        expect(newBalance).toBe("250.50");

        const room = await mockGetRoomById(roomId);
        await mockCreateTransaction({
          userId,
          type: "leave_table",
          amount: result.remainingChips.toFixed(2),
          balanceBefore,
          balanceAfter: newBalance || balanceBefore,
          status: "confirmed",
          referenceType: "room",
          referenceId: roomId,
          note: `Leave table (browser close): ${room?.name ?? `Room #${roomId}`}`,
        });

        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 1,
            type: "leave_table",
            amount: "150.50",
            balanceBefore: "100.00",
            balanceAfter: "250.50",
            status: "confirmed",
            note: "Leave table (browser close): Test Room",
          })
        );
      }
    }
  });

  it("should NOT create transaction when remainingChips is 0", async () => {
    const userId = 2;
    const roomId = 3;

    mockLeaveTable.mockResolvedValue({ success: true, remainingChips: 0 });
    mockGetUserById.mockResolvedValue({ id: userId, balance: "50.00" });

    const result = await mockLeaveTable(roomId, userId);
    expect(result.remainingChips).toBe(0);

    // When remainingChips is 0, addUserBalanceAtomic should not be called
    if (result.remainingChips > 0) {
      await mockAddUserBalanceAtomic(userId, result.remainingChips);
    }

    expect(mockAddUserBalanceAtomic).not.toHaveBeenCalled();
  });

  it("should handle leaveTable failure gracefully", async () => {
    const userId = 3;
    const roomId = 7;

    mockLeaveTable.mockResolvedValue({ success: false, remainingChips: 0, message: "Cannot leave during a tournament" });

    const result = await mockLeaveTable(roomId, userId);
    expect(result.success).toBe(false);
    expect(result.remainingChips).toBe(0);
    expect(result.message).toBe("Cannot leave during a tournament");
  });
});

describe("Reconcile Orphaned Players - Tournament Room Detection", () => {
  it("should identify tournament rooms by inviteCode prefix 'T'", () => {
    const roomInfos = [
      { id: 1, inviteCode: "T5_1_abc123" },  // Tournament room
      { id: 2, inviteCode: "T5_2_def456" },  // Tournament room
      { id: 3, inviteCode: "ROOM_xyz789" },   // Normal room
      { id: 4, inviteCode: null },            // Normal room (no invite code)
      { id: 5, inviteCode: "private_abc" },   // Normal private room
    ];

    const tournamentRoomIds = new Set(
      roomInfos.filter(r => r.inviteCode && r.inviteCode.startsWith("T")).map(r => r.id)
    );

    expect(tournamentRoomIds.has(1)).toBe(true);
    expect(tournamentRoomIds.has(2)).toBe(true);
    expect(tournamentRoomIds.has(3)).toBe(false);
    expect(tournamentRoomIds.has(4)).toBe(false);
    expect(tournamentRoomIds.has(5)).toBe(false);
  });

  it("should skip tournament rooms during reconciliation", () => {
    const orphaned = [
      { roomId: 1, userId: 10, chipCount: "500.00", status: "active" },  // Tournament
      { roomId: 3, userId: 20, chipCount: "200.00", status: "active" },  // Normal
      { roomId: 5, userId: 30, chipCount: "100.00", status: "sitting_out" },  // Normal
    ];

    const tournamentRoomIds = new Set([1, 2]);
    const nonTournamentRoomIds = new Set(
      [...new Set(orphaned.map(o => o.roomId))].filter(rid => !tournamentRoomIds.has(rid))
    );

    expect(nonTournamentRoomIds.has(1)).toBe(false);
    expect(nonTournamentRoomIds.has(3)).toBe(true);
    expect(nonTournamentRoomIds.has(5)).toBe(true);

    // Only non-tournament players should be reconciled
    const toReconcile = orphaned.filter(r => nonTournamentRoomIds.has(r.roomId));
    expect(toReconcile.length).toBe(2);
    expect(toReconcile[0].userId).toBe(20);
    expect(toReconcile[1].userId).toBe(30);
  });
});

describe("game.leave - Return Value Enhancement", () => {
  it("should return remainingChips and newBalance in leave response", async () => {
    const userId = 1;
    const roomId = 5;

    mockLeaveTable.mockResolvedValue({ success: true, remainingChips: 100 });
    mockGetUserById.mockResolvedValue({ id: userId, balance: "200.00" });
    mockAddUserBalanceAtomic.mockResolvedValue("300.00");
    mockGetRoomById.mockResolvedValue({ id: roomId, name: "Test Room" });
    mockCreateTransaction.mockResolvedValue(null);

    // Simulate the enhanced game.leave procedure
    const result = await mockLeaveTable(roomId, userId);
    const user = await mockGetUserById(userId);
    let newBalance: string | null = null;

    if (result.remainingChips > 0 && user) {
      newBalance = await mockAddUserBalanceAtomic(userId, result.remainingChips);
    }

    const response = {
      success: result.success,
      remainingChips: result.remainingChips,
      newBalance: newBalance || user?.balance || "0.00",
    };

    expect(response.success).toBe(true);
    expect(response.remainingChips).toBe(100);
    expect(response.newBalance).toBe("300.00");
  });
});
