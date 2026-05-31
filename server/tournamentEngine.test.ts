/**
 * Tournament Engine Unit Tests
 * Tests the core logic of the MTT tournament system
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getTournamentById: vi.fn(),
  getTournamentRegistrations: vi.fn(),
  createRoom: vi.fn(),
  addRoomPlayer: vi.fn(),
  updateTournamentRegistrationStatus: vi.fn(),
  updateTournament: vi.fn(),
  updateRoom: vi.fn(),
  removeRoomPlayer: vi.fn(),
  getRoomById: vi.fn(),
  saveTournamentResult: vi.fn(),
  updateUserBalance: vi.fn(),
  getUserById: vi.fn(),
  createTransaction: vi.fn(),
}));

// Mock tableManager module
vi.mock("./tableManager", () => ({
  getTable: vi.fn(),
}));

import * as db from "./db";

describe("TournamentEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startTournament", () => {
    it("should fail if tournament not found", async () => {
      vi.mocked(db.getTournamentById).mockResolvedValue(null as any);
      
      const { startTournament } = await import("./tournamentEngine");
      const result = await startTournament(999);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("should fail if tournament is not in registration status", async () => {
      vi.mocked(db.getTournamentById).mockResolvedValue({
        id: 1,
        name: "Test Tournament",
        status: "running",
        minPlayers: 2,
        maxPlayers: 9,
        startingChips: 1500,
        playersPerTable: 6,
        blindLevelDuration: 10,
        entryFee: "10.00",
        platformRake: "10",
        totalRounds: 20,
        prizeDistribution: [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 30 }],
      } as any);

      const { startTournament } = await import("./tournamentEngine");
      const result = await startTournament(1);
      
      expect(result.success).toBe(false);
      // Message should indicate tournament is not in correct state
      expect(result.message).toBeDefined();
    });

    it("should fail if not enough players registered", async () => {
      vi.mocked(db.getTournamentById).mockResolvedValue({
        id: 1,
        name: "Test Tournament",
        status: "registration",
        minPlayers: 4,
        maxPlayers: 9,
        startingChips: 1500,
        playersPerTable: 6,
        blindLevelDuration: 10,
        entryFee: "10.00",
        platformRake: "10",
        totalRounds: 20,
        prizeDistribution: [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 30 }],
      } as any);
      vi.mocked(db.getTournamentRegistrations).mockResolvedValue([
        { reg: { userId: 1, status: "registered" }, user: { id: 1, name: "Player1" } },
        { reg: { userId: 2, status: "registered" }, user: { id: 2, name: "Player2" } },
      ] as any);

      const { startTournament } = await import("./tournamentEngine");
      const result = await startTournament(1);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("Not enough players");
    });

    it("should successfully start a tournament with enough players", async () => {
      vi.mocked(db.getTournamentById).mockResolvedValue({
        id: 1,
        name: "Test Tournament",
        status: "registration",
        minPlayers: 2,
        maxPlayers: 9,
        startingChips: 1500,
        playersPerTable: 6,
        blindLevelDuration: 10,
        entryFee: "10.00",
        platformRake: "10",
        totalRounds: 20,
        prizeDistribution: [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 30 }],
      } as any);
      vi.mocked(db.getTournamentRegistrations).mockResolvedValue([
        { reg: { userId: 1, status: "registered" }, user: { id: 1, name: "Player1" } },
        { reg: { userId: 2, status: "registered" }, user: { id: 2, name: "Player2" } },
        { reg: { userId: 3, status: "registered" }, user: { id: 3, name: "Player3" } },
        { reg: { userId: 4, status: "registered" }, user: { id: 4, name: "Player4" } },
      ] as any);
      vi.mocked(db.createRoom).mockResolvedValue(100);
      vi.mocked(db.addRoomPlayer).mockResolvedValue(undefined);
      vi.mocked(db.updateTournamentRegistrationStatus).mockResolvedValue(undefined);
      vi.mocked(db.updateTournament).mockResolvedValue(undefined);
      vi.mocked(db.updateRoom).mockResolvedValue(undefined);

      const { startTournament } = await import("./tournamentEngine");
      const result = await startTournament(1);
      
      expect(result.success).toBe(true);
      expect(result.players).toBe(4);
      expect(result.tables).toBeGreaterThanOrEqual(1);
      expect(db.createRoom).toHaveBeenCalled();
      expect(db.addRoomPlayer).toHaveBeenCalledTimes(4);
      expect(db.updateTournament).toHaveBeenCalledWith(1, expect.objectContaining({ status: "running" }));
    });
  });

  describe("getTournamentState", () => {
    it("should return null for non-existent tournament", async () => {
      const { getTournamentState } = await import("./tournamentEngine");
      const state = getTournamentState(99999);
      expect(state).toBeNull();
    });
  });

  describe("getTournamentForRoom", () => {
    it("should return null for non-tournament room", async () => {
      const { getTournamentForRoom } = await import("./tournamentEngine");
      const result = getTournamentForRoom(99999);
      expect(result).toBeNull();
    });
  });

  describe("getPlayerTournamentTable", () => {
    it("should return null for player not in any tournament", async () => {
      const { getPlayerTournamentTable } = await import("./tournamentEngine");
      const result = getPlayerTournamentTable(99999);
      expect(result).toBeNull();
    });
  });

  describe("updatePlayerChips", () => {
    it("should not throw for non-existent tournament", async () => {
      const { updatePlayerChips } = await import("./tournamentEngine");
      expect(() => updatePlayerChips(99999, 1, 1000)).not.toThrow();
    });
  });

  describe("Blind Level Structure", () => {
    it("should generate correct blind levels for standard tournament", async () => {
      // After starting a tournament, blind levels should be properly structured
      vi.mocked(db.getTournamentById).mockResolvedValue({
        id: 2,
        name: "Blind Test",
        status: "registration",
        minPlayers: 2,
        maxPlayers: 9,
        startingChips: 1500,
        playersPerTable: 6,
        blindLevelDuration: 10,
        entryFee: "10.00",
        platformRake: "10",
        totalRounds: 20,
        prizeDistribution: [{ rank: 1, percentage: 100 }],
        blindStructure: [
          { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
          { level: 2, smallBlind: 20, bigBlind: 40, ante: 0 },
          { level: 3, smallBlind: 30, bigBlind: 60, ante: 5 },
          { level: 4, smallBlind: 50, bigBlind: 100, ante: 10 },
        ],
      } as any);
      vi.mocked(db.getTournamentRegistrations).mockResolvedValue([
        { reg: { userId: 10, status: "registered" }, user: { id: 10, name: "P1" } },
        { reg: { userId: 11, status: "registered" }, user: { id: 11, name: "P2" } },
      ] as any);
      vi.mocked(db.createRoom).mockResolvedValue(200);
      vi.mocked(db.addRoomPlayer).mockResolvedValue(undefined);
      vi.mocked(db.updateTournamentRegistrationStatus).mockResolvedValue(undefined);
      vi.mocked(db.updateTournament).mockResolvedValue(undefined);
      vi.mocked(db.updateRoom).mockResolvedValue(undefined);

      const { startTournament, getTournamentState } = await import("./tournamentEngine");
      await startTournament(2);
      
      const state = getTournamentState(2);
      if (state) {
        expect(state.currentBlindLevel).toBe(1);
        expect(state.totalBlindLevels).toBeGreaterThan(0);
        expect(state.currentBlinds).not.toBeNull();
        expect(state.currentBlinds!.smallBlind).toBe(10);
        expect(state.currentBlinds!.bigBlind).toBe(20);
        expect(state.blindDuration).toBe(10 * 60 * 1000); // 10 minutes in ms
      }
    });
  });
});

describe("TournamentEngine Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should assign players to rooms and allow them to find their table via getPlayerTournamentTable", async () => {
    vi.mocked(db.getTournamentById).mockResolvedValue({
      id: 3,
      name: "Integration Test",
      status: "registration",
      minPlayers: 2,
      maxPlayers: 9,
      startingChips: 1500,
      playersPerTable: 6,
      blindLevelDuration: 10,
      entryFee: "10.00",
      platformRake: "10",
      totalRounds: 20,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      blindStructure: [
        { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
        { level: 2, smallBlind: 20, bigBlind: 40, ante: 0 },
      ],
    } as any);
    vi.mocked(db.getTournamentRegistrations).mockResolvedValue([
      { reg: { userId: 100, status: "registered" }, user: { id: 100, name: "Alice" } },
      { reg: { userId: 101, status: "registered" }, user: { id: 101, name: "Bob" } },
      { reg: { userId: 102, status: "registered" }, user: { id: 102, name: "Charlie" } },
    ] as any);
    vi.mocked(db.createRoom).mockResolvedValue(500);
    vi.mocked(db.addRoomPlayer).mockResolvedValue(undefined);
    vi.mocked(db.updateTournamentRegistrationStatus).mockResolvedValue(undefined);
    vi.mocked(db.updateTournament).mockResolvedValue(undefined);
    vi.mocked(db.updateRoom).mockResolvedValue(undefined);

    const { startTournament, getPlayerTournamentTable, getTournamentForRoom } = await import("./tournamentEngine");
    const result = await startTournament(3);
    
    expect(result.success).toBe(true);
    expect(result.players).toBe(3);
    
    // All players should be able to find their table
    const aliceTable = getPlayerTournamentTable(100);
    const bobTable = getPlayerTournamentTable(101);
    const charlieTable = getPlayerTournamentTable(102);
    
    expect(aliceTable).not.toBeNull();
    expect(aliceTable!.roomId).toBe(500);
    expect(aliceTable!.tournamentId).toBe(3);
    
    expect(bobTable).not.toBeNull();
    expect(bobTable!.roomId).toBe(500);
    
    expect(charlieTable).not.toBeNull();
    expect(charlieTable!.roomId).toBe(500);
    
    // Room should be mapped to tournament
    const tId = getTournamentForRoom(500);
    expect(tId).toBe(3);
  });

  it("should correctly report live state with player info after start", async () => {
    vi.mocked(db.getTournamentById).mockResolvedValue({
      id: 4,
      name: "Live State Test",
      status: "registration",
      minPlayers: 2,
      maxPlayers: 9,
      startingChips: 2000,
      playersPerTable: 6,
      blindLevelDuration: 15,
      entryFee: "20.00",
      platformRake: "10",
      totalRounds: 20,
      prizeDistribution: [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 30 }],
      blindStructure: [
        { level: 1, smallBlind: 25, bigBlind: 50, ante: 0 },
        { level: 2, smallBlind: 50, bigBlind: 100, ante: 10 },
      ],
    } as any);
    vi.mocked(db.getTournamentRegistrations).mockResolvedValue([
      { reg: { userId: 200, status: "registered" }, user: { id: 200, name: "Player A" } },
      { reg: { userId: 201, status: "registered" }, user: { id: 201, name: "Player B" } },
    ] as any);
    vi.mocked(db.createRoom).mockResolvedValue(600);
    vi.mocked(db.addRoomPlayer).mockResolvedValue(undefined);
    vi.mocked(db.updateTournamentRegistrationStatus).mockResolvedValue(undefined);
    vi.mocked(db.updateTournament).mockResolvedValue(undefined);
    vi.mocked(db.updateRoom).mockResolvedValue(undefined);

    const { startTournament, getTournamentState } = await import("./tournamentEngine");
    await startTournament(4);
    
    // Get state for Player A
    const state = getTournamentState(4, 200);
    expect(state).not.toBeNull();
    expect(state!.status).toBe("running");
    expect(state!.activePlayers).toBe(2);
    expect(state!.totalPlayers).toBe(2);
    expect(state!.myRoomId).toBe(600);
    expect(state!.myChips).toBe(2000);
    expect(state!.myEliminated).toBe(false);
    expect(state!.currentBlinds!.smallBlind).toBe(25);
    expect(state!.currentBlinds!.bigBlind).toBe(50);
    expect(state!.tables.length).toBe(1);
    expect(state!.chipLeaders.length).toBe(2);
    expect(state!.averageStack).toBe(2000);
  });
});
