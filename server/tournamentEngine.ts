/**
 * Tournament Engine - Handles tournament lifecycle:
 * - Table assignment (random seating)
 * - Blind level progression
 * - Elimination detection
 * - Table merging (when players are eliminated)
 * - Table shuffling (anti-collusion)
 * - Prize distribution
 */

import * as db from "./db";

// ==================== TYPES ====================

export interface TournamentTable {
  id: string;
  tournamentId: number;
  players: TournamentPlayer[];
  currentRound: number;
  currentBlindLevel: number;
}

export interface TournamentPlayer {
  userId: number;
  nickname: string | null;
  chips: number;
  tableId: string;
  seatIndex: number;
  status: "playing" | "eliminated" | "disconnected";
  roundsPlayed: number;
  handsWon: number;
  eliminatedAt?: number; // round number when eliminated
}

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface TournamentState {
  tournamentId: number;
  status: "waiting" | "running" | "finished";
  tables: TournamentTable[];
  players: Map<number, TournamentPlayer>; // userId -> player
  eliminatedPlayers: TournamentPlayer[]; // ordered by elimination (last eliminated first)
  currentRound: number;
  totalRounds: number;
  currentBlindLevel: number;
  blindStructure: BlindLevel[];
  blindLevelDuration: number; // minutes per blind level
  blindLevelStartedAt: number; // timestamp
  playersPerTable: number;
  tableShuffleInterval: number; // minutes
  lastShuffleAt: number; // timestamp
  finalTableThreshold: number;
  startingChips: number;
  platformRake: number; // percentage
  prizeDistribution: Array<{ rank: number; percentage: number }>;
  entryFee: number;
  registeredCount: number;
}

// In-memory tournament states
const activeTournaments = new Map<number, TournamentState>();

// ==================== TOURNAMENT LIFECYCLE ====================

/**
 * Initialize and start a tournament
 */
export async function startTournament(tournamentId: number): Promise<TournamentState | null> {
  const tournament = await db.getTournamentById(tournamentId);
  if (!tournament) return null;

  const registrations = await db.getTournamentRegistrations(tournamentId);
  const activeRegs = registrations.filter(r => r.reg.status === "registered");

  // Check minimum players
  if (activeRegs.length < tournament.minPlayers) {
    // Cancel and refund
    await db.updateTournament(tournamentId, { status: "cancelled" });
    return null;
  }

  // Create tournament state
  const state: TournamentState = {
    tournamentId,
    status: "running",
    tables: [],
    players: new Map(),
    eliminatedPlayers: [],
    currentRound: 0,
    totalRounds: tournament.totalRounds,
    currentBlindLevel: 0,
    blindStructure: tournament.blindStructure as BlindLevel[],
    blindLevelDuration: tournament.blindLevelDuration,
    blindLevelStartedAt: Date.now(),
    playersPerTable: tournament.playersPerTable,
    tableShuffleInterval: tournament.tableShuffleInterval,
    lastShuffleAt: Date.now(),
    finalTableThreshold: tournament.finalTableThreshold,
    startingChips: tournament.startingChips,
    platformRake: parseFloat(tournament.platformRake),
    prizeDistribution: tournament.prizeDistribution as Array<{ rank: number; percentage: number }>,
    entryFee: parseFloat(tournament.entryFee),
    registeredCount: activeRegs.length,
  };

  // Create players
  const players: TournamentPlayer[] = activeRegs.map(r => ({
    userId: r.reg.userId,
    nickname: r.user?.nickname || null,
    chips: tournament.startingChips,
    tableId: "",
    seatIndex: 0,
    status: "playing" as const,
    roundsPlayed: 0,
    handsWon: 0,
  }));

  // Random table assignment
  assignTables(state, players);

  // Update DB status
  await db.updateTournament(tournamentId, {
    status: "running",
    actualStartTime: new Date(),
  });

  // Store in memory
  activeTournaments.set(tournamentId, state);

  return state;
}

/**
 * Randomly assign players to tables
 */
function assignTables(state: TournamentState, players: TournamentPlayer[]): void {
  // Shuffle players randomly
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  const numTables = Math.ceil(shuffled.length / state.playersPerTable);
  state.tables = [];

  for (let i = 0; i < numTables; i++) {
    state.tables.push({
      id: `table_${state.tournamentId}_${i + 1}`,
      tournamentId: state.tournamentId,
      players: [],
      currentRound: 0,
      currentBlindLevel: 0,
    });
  }

  // Distribute players evenly across tables
  shuffled.forEach((player, index) => {
    const tableIndex = index % numTables;
    const table = state.tables[tableIndex];
    player.tableId = table.id;
    player.seatIndex = table.players.length;
    table.players.push(player);
    state.players.set(player.userId, player);
  });
}

/**
 * Shuffle tables - redistribute all active players randomly (anti-collusion)
 */
export function shuffleTables(state: TournamentState): void {
  const activePlayers = Array.from(state.players.values()).filter(p => p.status === "playing");
  
  // Clear existing tables
  state.tables.forEach(t => { t.players = []; });

  // Recalculate number of tables needed
  const numTables = Math.ceil(activePlayers.length / state.playersPerTable);
  
  // Trim excess tables
  while (state.tables.length > numTables) {
    state.tables.pop();
  }
  // Add tables if needed
  while (state.tables.length < numTables) {
    state.tables.push({
      id: `table_${state.tournamentId}_${state.tables.length + 1}`,
      tournamentId: state.tournamentId,
      players: [],
      currentRound: 0,
      currentBlindLevel: state.currentBlindLevel,
    });
  }

  // Shuffle and reassign
  const shuffled = activePlayers.sort(() => Math.random() - 0.5);
  shuffled.forEach((player, index) => {
    const tableIndex = index % numTables;
    const table = state.tables[tableIndex];
    player.tableId = table.id;
    player.seatIndex = table.players.length;
    table.players.push(player);
  });

  state.lastShuffleAt = Date.now();
}

/**
 * Check if blind level should advance (time-based)
 */
export function checkBlindLevelAdvance(state: TournamentState): boolean {
  const elapsed = (Date.now() - state.blindLevelStartedAt) / 1000 / 60; // minutes
  if (elapsed >= state.blindLevelDuration && state.currentBlindLevel < state.blindStructure.length - 1) {
    state.currentBlindLevel++;
    state.blindLevelStartedAt = Date.now();
    // Update all tables
    state.tables.forEach(t => { t.currentBlindLevel = state.currentBlindLevel; });
    return true;
  }
  return false;
}

/**
 * Check if table shuffle is needed (time-based, anti-collusion)
 */
export function checkTableShuffle(state: TournamentState): boolean {
  const elapsed = (Date.now() - state.lastShuffleAt) / 1000 / 60; // minutes
  const activePlayers = Array.from(state.players.values()).filter(p => p.status === "playing");
  
  // Don't shuffle if already at final table
  if (activePlayers.length <= state.finalTableThreshold) return false;
  
  if (elapsed >= state.tableShuffleInterval) {
    shuffleTables(state);
    return true;
  }
  return false;
}

/**
 * Eliminate a player (chips reached 0)
 */
export function eliminatePlayer(state: TournamentState, userId: number): void {
  const player = state.players.get(userId);
  if (!player) return;

  player.status = "eliminated";
  player.chips = 0;
  player.eliminatedAt = state.currentRound;
  state.eliminatedPlayers.unshift(player); // most recent first

  // Remove from table
  const table = state.tables.find(t => t.id === player.tableId);
  if (table) {
    table.players = table.players.filter(p => p.userId !== userId);
  }

  // Check if table merge is needed
  checkTableMerge(state);
}

/**
 * Merge tables when player count drops
 */
function checkTableMerge(state: TournamentState): void {
  const activePlayers = Array.from(state.players.values()).filter(p => p.status === "playing");
  const idealTableCount = Math.ceil(activePlayers.length / state.playersPerTable);

  // If we have more tables than needed, merge
  if (state.tables.length > idealTableCount) {
    // Find tables with fewest players and redistribute
    const sortedTables = [...state.tables].sort((a, b) => a.players.length - b.players.length);
    
    while (state.tables.length > idealTableCount) {
      const smallestTable = sortedTables.shift();
      if (!smallestTable || smallestTable.players.length === 0) {
        state.tables = state.tables.filter(t => t.id !== smallestTable?.id);
        continue;
      }

      // Move players from smallest table to others
      for (const player of smallestTable.players) {
        // Find table with most room
        const targetTable = state.tables
          .filter(t => t.id !== smallestTable.id)
          .sort((a, b) => a.players.length - b.players.length)[0];
        
        if (targetTable) {
          player.tableId = targetTable.id;
          player.seatIndex = targetTable.players.length;
          targetTable.players.push(player);
        }
      }

      state.tables = state.tables.filter(t => t.id !== smallestTable.id);
    }
  }

  // Check if final table is reached
  if (activePlayers.length <= state.finalTableThreshold && state.tables.length > 1) {
    // Merge all into one final table
    const finalTable = state.tables[0];
    for (let i = 1; i < state.tables.length; i++) {
      for (const player of state.tables[i].players) {
        player.tableId = finalTable.id;
        player.seatIndex = finalTable.players.length;
        finalTable.players.push(player);
      }
    }
    state.tables = [finalTable];
  }
}

/**
 * Handle player disconnect - auto fold
 */
export function handleDisconnect(state: TournamentState, userId: number): void {
  const player = state.players.get(userId);
  if (!player || player.status !== "playing") return;
  player.status = "disconnected";
  // Player will auto-fold and lose blinds/antes until chips run out
}

/**
 * Handle player reconnect
 */
export function handleReconnect(state: TournamentState, userId: number): void {
  const player = state.players.get(userId);
  if (!player || player.status !== "disconnected") return;
  player.status = "playing";
}

/**
 * Check if tournament should end
 */
export function checkTournamentEnd(state: TournamentState): boolean {
  const activePlayers = Array.from(state.players.values()).filter(p => p.status === "playing");
  
  // End conditions:
  // 1. Only one player remaining
  if (activePlayers.length <= 1) return true;
  
  // 2. All rounds completed
  if (state.currentRound >= state.totalRounds) return true;
  
  // 3. Remaining players <= prize positions
  if (activePlayers.length <= state.prizeDistribution.length) {
    // Optional: can continue until rounds end for final ranking
    if (state.currentRound >= state.totalRounds) return true;
  }

  return false;
}

/**
 * Calculate final rankings and distribute prizes
 */
export async function finishTournament(state: TournamentState): Promise<void> {
  state.status = "finished";

  // Build final ranking
  const activePlayers = Array.from(state.players.values())
    .filter(p => p.status === "playing")
    .sort((a, b) => b.chips - a.chips); // highest chips first

  // Combine: active players ranked by chips + eliminated players in reverse order
  const finalRanking: TournamentPlayer[] = [...activePlayers, ...state.eliminatedPlayers];

  // Calculate prize pool
  const totalPool = state.entryFee * state.registeredCount;
  const platformCut = totalPool * (state.platformRake / 100);
  const prizePool = totalPool - platformCut;

  // Distribute prizes
  for (let i = 0; i < finalRanking.length; i++) {
    const rank = i + 1;
    const player = finalRanking[i];
    const prizeConfig = state.prizeDistribution.find(p => p.rank === rank);
    const prizeAmount = prizeConfig ? prizePool * (prizeConfig.percentage / 100) : 0;

    // Save result to DB
    await db.saveTournamentResult({
      tournamentId: state.tournamentId,
      userId: player.userId,
      rank,
      prizeAmount: prizeAmount.toFixed(2),
      startingChips: state.startingChips,
      finalChips: player.chips,
      roundsPlayed: player.roundsPlayed,
      handsWon: player.handsWon,
    });

    // Credit prize to winner's balance
    if (prizeAmount > 0) {
      await db.updateUserBalance(player.userId, prizeAmount.toFixed(2));
    }
  }

  // Update tournament status
  await db.updateTournament(state.tournamentId, {
    status: "finished",
    endTime: new Date(),
    totalPrizePool: prizePool.toFixed(2),
  });

  // Remove from active tournaments
  activeTournaments.delete(state.tournamentId);
}

/**
 * Advance one round for all tables
 */
export function advanceRound(state: TournamentState): void {
  state.currentRound++;
  state.tables.forEach(t => { t.currentRound = state.currentRound; });
}

/**
 * Get current blind level info
 */
export function getCurrentBlinds(state: TournamentState): BlindLevel {
  return state.blindStructure[state.currentBlindLevel] || state.blindStructure[state.blindStructure.length - 1];
}

/**
 * Get tournament state (for API responses)
 */
export function getTournamentState(tournamentId: number): TournamentState | null {
  return activeTournaments.get(tournamentId) || null;
}

/**
 * Get all active tournament IDs
 */
export function getActiveTournamentIds(): number[] {
  return Array.from(activeTournaments.keys());
}

/**
 * Generate default blind structure
 * Entry fee based: 10U = 10000 chips, blinds start at 50/100
 */
export function generateDefaultBlindStructure(startingChips: number): BlindLevel[] {
  const baseBlind = Math.floor(startingChips / 200); // 1/200 of starting chips
  const levels: BlindLevel[] = [];
  
  for (let i = 0; i < 20; i++) {
    const multiplier = Math.pow(1.5, i);
    const smallBlind = Math.round(baseBlind * multiplier);
    const bigBlind = smallBlind * 2;
    const ante = i >= 3 ? Math.round(smallBlind * 0.2) : 0; // Ante starts at level 4
    
    levels.push({
      level: i + 1,
      smallBlind,
      bigBlind,
      ante,
    });
  }

  return levels;
}
