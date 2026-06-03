/**
 * 锦标赛引擎 - 多桌锦标赛（MTT）系统
 * 
 * 架构：仿 PokerStars 的 MTT，与真实房间集成：
 * - 通过 db.createRoom() 创建实际数据库房间
 * - 通过 db.addRoomPlayer() 入座玩家
 * - 使用现有 tableManager 处理每桌游戏逻辑
 * - 盲注级别递增（基于时间）
 * - 桌子平衡（人数差 >= 2 时移动玩家）
 * - 桌子合并（人数过少时合并）
 * - 决赛桌形成
 * - 淘汰跟踪与排名
 * - 奖金分配
 */

import * as db from "./db";
// tableManager is imported dynamically to avoid circular dependency
async function getTableManager() {
  return await import("./tableManager");
}

// ==================== Types ====================

interface TournamentTable {
  roomId: number;
  playerCount: number; // active player count (not eliminated)
  isActive: boolean;
}

interface TournamentPlayer {
  userId: number;
  name: string;
  chips: number;
  roomId: number; // current room
  seatIndex: number;
  isEliminated: boolean;
  eliminatedAt?: number; // timestamp
  finishRank?: number;
}

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

interface ActiveTournament {
  id: number;
  name: string;
  tables: Map<number, TournamentTable>; // roomId -> table
  players: Map<number, TournamentPlayer>; // userId -> player
  currentBlindLevel: number;
  blindLevelStartedAt: number; // timestamp
  blindStructure: BlindLevel[];
  blindLevelDuration: number; // minutes
  startedAt: number;
  eliminationOrder: number[]; // userId in order of elimination (first = first eliminated)
  isPaused: boolean;
  isFinished: boolean;
  startingChips: number;
  entryFee: number;
  platformRake: number; // percentage
  prizeDistribution: Array<{ rank: number; percentage: number }>;
  playersPerTable: number;
  finalTableThreshold: number;
  totalPlayers: number;
  totalRounds: number | null; // max hands before forced finish (null = unlimited, play until 1 left)
  handsPlayed: number; // total hands completed across all tables
  blindTimer?: ReturnType<typeof setInterval>;
  balanceTimer?: ReturnType<typeof setInterval>;
}

// ==================== In-Memory Store ====================

const activeTournaments = new Map<number, ActiveTournament>();

// ==================== Public API ====================

/**
 * Start a tournament: create real rooms, assign players, begin play
 */
export async function startTournament(tournamentId: number): Promise<{
  success: boolean;
  tables: number;
  players: number;
  message?: string;
}> {
  const tournament = await db.getTournamentById(tournamentId);
  if (!tournament) return { success: false, tables: 0, players: 0, message: "Tournament not found" };
  if (tournament.status !== "registration") {
    return { success: false, tables: 0, players: 0, message: `Tournament is not in registration status (current: ${tournament.status})` };
  }

  const regs = await db.getTournamentRegistrations(tournamentId);
  const registeredPlayers = regs.filter(r => r.reg.status === "registered");
  const playerCount = registeredPlayers.length;

  if (playerCount < tournament.minPlayers) {
    return { success: false, tables: 0, players: 0, message: `Not enough players: ${playerCount}/${tournament.minPlayers}` };
  }

  // Calculate number of tables needed
  const playersPerTable = tournament.playersPerTable || 9;
  const numTables = Math.ceil(playerCount / playersPerTable);

  // Get first blind level
  const blindStructure = (tournament.blindStructure as BlindLevel[]) || [];
  const firstLevel = blindStructure[0] || { smallBlind: 25, bigBlind: 50, ante: 0 };

  // Create real tournament rooms
  const tables = new Map<number, TournamentTable>();
  const createdRoomIds: number[] = [];

  for (let i = 0; i < numTables; i++) {
    const roomId = await db.createRoom({
      name: `${tournament.name} - Table ${i + 1}`,
      type: "private",
      status: "waiting",
      gameType: "texas_holdem",
      smallBlind: String(firstLevel.smallBlind),
      bigBlind: String(firstLevel.bigBlind),
      minBuyIn: String(tournament.startingChips),
      maxBuyIn: String(tournament.startingChips),
      maxPlayers: playersPerTable,
      ownerId: null,
      inviteCode: `T${tournamentId}_${i + 1}_${Date.now().toString(36)}`,
      totalRounds: null, // unlimited for tournament
      billingMode: "standard_rake",
      roundFee: "0",
      rakePercent: "0", // No rake in tournament
      rakeCap: "0",
      fairnessLevel: "high",
    });

    if (roomId) {
      tables.set(roomId, { roomId, playerCount: 0, isActive: true });
      createdRoomIds.push(roomId);
    }
  }

  if (createdRoomIds.length === 0) {
    return { success: false, tables: 0, players: 0, message: "Failed to create tournament rooms" };
  }

  // Randomly assign players to tables
  const shuffledPlayers = [...registeredPlayers].sort(() => Math.random() - 0.5);
  const players = new Map<number, TournamentPlayer>();

  for (let i = 0; i < shuffledPlayers.length; i++) {
    const reg = shuffledPlayers[i];
    const tableIndex = i % createdRoomIds.length;
    const roomId = createdRoomIds[tableIndex];
    const table = tables.get(roomId)!;
    const seatIndex = table.playerCount;

    const user = await db.getUserById(reg.reg.userId);
    const player: TournamentPlayer = {
      userId: reg.reg.userId,
      name: user?.nickname || user?.name || `Player ${reg.reg.userId}`,
      chips: tournament.startingChips,
      roomId,
      seatIndex,
      isEliminated: false,
    };

    players.set(reg.reg.userId, player);
    table.playerCount++;

    // Seat player in the real room
    await db.addRoomPlayer(roomId, reg.reg.userId, seatIndex, String(tournament.startingChips));

    // Update registration status
    await db.updateTournamentRegistrationStatus(
      tournamentId, reg.reg.userId, "playing",
      String(roomId), seatIndex, tournament.startingChips
    );
  }

  // Create active tournament state
  const activeTournament: ActiveTournament = {
    id: tournamentId,
    name: tournament.name,
    tables,
    players,
    currentBlindLevel: 0,
    blindLevelStartedAt: Date.now(),
    blindStructure,
    blindLevelDuration: tournament.blindLevelDuration,
    startedAt: Date.now(),
    eliminationOrder: [],
    isPaused: false,
    isFinished: false,
    startingChips: tournament.startingChips,
    entryFee: parseFloat(tournament.entryFee),
    platformRake: parseFloat(tournament.platformRake || "10"),
    prizeDistribution: (tournament.prizeDistribution as Array<{ rank: number; percentage: number }>) || [],
    playersPerTable,
    finalTableThreshold: tournament.finalTableThreshold || 9,
    totalPlayers: playerCount,
    totalRounds: tournament.totalRounds || null, // max hands (null = unlimited)
    handsPlayed: 0,
  };

  activeTournaments.set(tournamentId, activeTournament);

  // Start blind level timer
  startBlindTimer(tournamentId);

  // Start table balance checker
  startBalanceChecker(tournamentId);

  // Update tournament status in DB
  await db.updateTournament(tournamentId, {
    status: "running",
    actualStartTime: new Date(),
  });

  // Update room player counts
  for (const [roomId, table] of tables) {
    await db.updateRoom(roomId, { currentPlayers: table.playerCount, status: "waiting" });
  }

  return { success: true, tables: createdRoomIds.length, players: playerCount };
}

/**
 * Get tournament state for a player (which table they're at, blind level, etc.)
 */
export function getTournamentState(tournamentId: number, userId?: number) {
  const t = activeTournaments.get(tournamentId);
  if (!t) return null;

  const currentBlinds = t.blindStructure[t.currentBlindLevel] || t.blindStructure[t.blindStructure.length - 1];
  const nextBlinds = t.blindStructure[t.currentBlindLevel + 1] || null;

  const blindDuration = t.blindLevelDuration * 60 * 1000; // ms
  const timeUntilNextLevel = Math.max(0, blindDuration - (Date.now() - t.blindLevelStartedAt));

  const activePlayers = Array.from(t.players.values()).filter(p => !p.isEliminated);

  // Player's own info
  let myRoomId: number | null = null;
  let myChips: number | null = null;
  let myRank: number | null = null;
  let myEliminated = false;
  if (userId) {
    const player = t.players.get(userId);
    if (player) {
      myRoomId = player.isEliminated ? null : player.roomId;
      myChips = player.chips;
      myEliminated = player.isEliminated;
      if (player.isEliminated) {
        myRank = player.finishRank || null;
      }
    }
  }

  // Table info
  const tableInfo = Array.from(t.tables.values())
    .filter(tbl => tbl.isActive)
    .map(tbl => ({
      roomId: tbl.roomId,
      playerCount: tbl.playerCount,
    }));

  // Chip leaders
  const chipLeaders = activePlayers
    .sort((a, b) => b.chips - a.chips)
    .slice(0, 10)
    .map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      name: p.name,
      chips: p.chips,
    }));

  return {
    tournamentId,
    name: t.name,
    status: t.isFinished ? "finished" : t.isPaused ? "paused" : "running",
    currentBlindLevel: t.currentBlindLevel + 1,
    totalBlindLevels: t.blindStructure.length,
    currentBlinds: currentBlinds ? { smallBlind: currentBlinds.smallBlind, bigBlind: currentBlinds.bigBlind, ante: currentBlinds.ante } : null,
    nextBlinds: nextBlinds ? { smallBlind: nextBlinds.smallBlind, bigBlind: nextBlinds.bigBlind, ante: nextBlinds.ante } : null,
    timeUntilNextLevel,
    blindDuration,
    activePlayers: activePlayers.length,
    totalPlayers: t.totalPlayers,
    tables: tableInfo,
    chipLeaders,
    myRoomId,
    myChips,
    myRank,
    myEliminated,
    startedAt: t.startedAt,
    averageStack: activePlayers.length > 0 ? Math.round(activePlayers.reduce((s, p) => s + p.chips, 0) / activePlayers.length) : 0,
    totalRounds: t.totalRounds,
    handsPlayed: t.handsPlayed,
  };
}

/**
 * Handle player elimination (called when a player busts out - chips reach 0)
 */
export async function eliminatePlayer(tournamentId: number, userId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  const player = t.players.get(userId);
  if (!player || player.isEliminated) return;

  player.isEliminated = true;
  player.eliminatedAt = Date.now();
  player.chips = 0;

  // Calculate finish rank (remaining active players + 1)
  const activePlayers = Array.from(t.players.values()).filter(p => !p.isEliminated);
  player.finishRank = activePlayers.length + 1;

  t.eliminationOrder.push(userId);

  // Update table player count
  const table = t.tables.get(player.roomId);
  if (table) {
    table.playerCount = Math.max(0, table.playerCount - 1);
  }

  // Update DB registration status
  await db.updateTournamentRegistrationStatus(
    tournamentId, userId, "eliminated", null, null, 0
  );

  // Remove player from room
  await db.removeRoomPlayer(player.roomId, userId);

  console.log(`[Tournament ${tournamentId}] Player ${player.name} (${userId}) eliminated at rank ${player.finishRank}. ${activePlayers.length} players remaining.`);

  // Check if tournament is over (1 player left)
  if (activePlayers.length === 1) {
    await finishTournament(tournamentId, activePlayers[0]);
    return;
  }

  // Check if table needs breaking/balancing
  await checkTableBalance(tournamentId);
}

/**
 * Update player chips after a hand (called from tableManager settlement)
 */
export function updatePlayerChips(tournamentId: number, userId: number, newChips: number): void {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  const player = t.players.get(userId);
  if (!player) return;

  player.chips = newChips;
}

/**
 * Get the tournament ID for a room (if it's a tournament table)
 */
export function getTournamentForRoom(roomId: number): number | null {
  for (const [tournamentId, t] of activeTournaments) {
    if (t.tables.has(roomId)) return tournamentId;
  }
  return null;
}

/**
 * Check if a room is a tournament table
 */
export function isTournamentTable(roomId: number): boolean {
  return getTournamentForRoom(roomId) !== null;
}

/**
 * Get active tournament by ID
 */
export function getActiveTournament(tournamentId: number): ActiveTournament | undefined {
  return activeTournaments.get(tournamentId);
}

/**
 * Pause/resume tournament
 */
export async function pauseTournament(tournamentId: number): Promise<boolean> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return false;
  t.isPaused = true;
  return true;
}

export async function resumeTournament(tournamentId: number): Promise<boolean> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return false;
  t.isPaused = false;
  t.blindLevelStartedAt = Date.now(); // Reset blind timer
  return true;
}

/**
 * Check if user is in an active tournament and return their table
 */
export function getPlayerTournamentTable(userId: number): { tournamentId: number; roomId: number } | null {
  for (const [tournamentId, t] of activeTournaments) {
    const player = t.players.get(userId);
    if (player && !player.isEliminated) {
      return { tournamentId, roomId: player.roomId };
    }
  }
  return null;
}

/**
 * Get all active tournaments (for lobby display)
 */
export function getAllActiveTournaments(): Array<{
  id: number;
  name: string;
  activePlayers: number;
  totalPlayers: number;
  tables: number;
  currentBlindLevel: number;
}> {
  const result = [];
  for (const [id, t] of activeTournaments) {
    const activePlayers = Array.from(t.players.values()).filter(p => !p.isEliminated).length;
    result.push({
      id,
      name: t.name,
      activePlayers,
      totalPlayers: t.totalPlayers,
      tables: Array.from(t.tables.values()).filter(tbl => tbl.isActive).length,
      currentBlindLevel: t.currentBlindLevel + 1,
    });
  }
  return result;
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

/**
 * Increment the hand count for a tournament.
 * If totalRounds is set and reached, force-finish the tournament by chip ranking.
 */
export async function incrementHandCount(tournamentId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t || t.isFinished) return;

  t.handsPlayed++;

  // Check if totalRounds limit reached
  if (t.totalRounds !== null && t.handsPlayed >= t.totalRounds) {
    console.log(`[Tournament ${tournamentId}] totalRounds limit reached (${t.handsPlayed}/${t.totalRounds}). Force-finishing by chip count.`);
    await forceFinishByChips(tournamentId);
  }
}

/**
 * Force-finish a tournament by ranking all remaining players by chip count.
 * Used when totalRounds limit is reached.
 */
async function forceFinishByChips(tournamentId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t || t.isFinished) return;

  t.isFinished = true;

  // Stop timers
  if (t.blindTimer) clearInterval(t.blindTimer);
  if (t.balanceTimer) clearInterval(t.balanceTimer);

  // Rank remaining active players by chips (descending)
  const activePlayers = Array.from(t.players.values()).filter(p => !p.isEliminated);
  activePlayers.sort((a, b) => b.chips - a.chips);

  // Assign ranks: active players get ranks 1..N, already eliminated keep their ranks
  for (let i = 0; i < activePlayers.length; i++) {
    activePlayers[i].finishRank = i + 1;
    activePlayers[i].isEliminated = true;
    activePlayers[i].eliminatedAt = Date.now();
  }

  // Calculate prize pool
  const totalPrizePool = t.entryFee * t.totalPlayers * (1 - t.platformRake / 100);

  // Build final rankings: active players by chips first, then previously eliminated
  const rankings: { userId: number; rank: number; prizeAmount: number }[] = [];

  for (const p of activePlayers) {
    rankings.push({ userId: p.userId, rank: p.finishRank!, prizeAmount: 0 });
  }

  // Previously eliminated players keep their existing ranks
  const eliminatedReversed = [...t.eliminationOrder].reverse();
  for (let i = 0; i < eliminatedReversed.length; i++) {
    const rank = activePlayers.length + i + 1;
    rankings.push({ userId: eliminatedReversed[i], rank, prizeAmount: 0 });
  }

  // Assign prizes based on distribution
  for (const r of rankings) {
    const prizeEntry = t.prizeDistribution.find(p => p.rank === r.rank);
    if (prizeEntry) {
      r.prizeAmount = parseFloat((totalPrizePool * prizeEntry.percentage / 100).toFixed(2));
    }
  }

  // Import notification helper
  const { notifyTournamentResult } = await import("./notifications");

  // Build top-3 rankings for notification
  const topRankings: Array<{ rank: number; name: string; prize: string }> = rankings
    .filter(r => r.rank <= 3)
    .map(r => ({
      rank: r.rank,
      name: t.players.get(r.userId)?.name || `Player ${r.userId}`,
      prize: r.prizeAmount.toFixed(2),
    }));

  // Save results and distribute prizes
  for (const r of rankings) {
    if (r.prizeAmount > 0) {
      const prizeUser = await db.getUserById(r.userId);
      const prizeBefore = prizeUser?.balance ?? "0";
      await db.addUserBalanceAtomic(r.userId, r.prizeAmount);
      const prizeAfter = (parseFloat(prizeBefore) + r.prizeAmount).toFixed(2);
      // Write tournament prize transaction record
      await db.createTransaction({
        userId: r.userId,
        type: "tournament_prize",
        amount: r.prizeAmount.toFixed(2),
        balanceBefore: prizeBefore,
        balanceAfter: prizeAfter,
        status: "confirmed",
        referenceType: "tournament",
        referenceId: tournamentId,
        note: `比赛奖金 #${r.rank}: ${t.name}`,
      });
    }

    await db.saveTournamentResult({
      tournamentId,
      userId: r.userId,
      rank: r.rank,
      prizeAmount: r.prizeAmount.toFixed(2),
      startingChips: t.startingChips,
      finalChips: t.players.get(r.userId)?.chips || 0,
      roundsPlayed: t.handsPlayed,
      handsWon: 0,
    });

    // Notify player with top-3 summary
    await notifyTournamentResult(r.userId, t.name, r.rank, r.prizeAmount.toFixed(2), topRankings, rankings.length).catch(() => {});
  }

  // Close all tournament tables and remove from activeTables (prevents auto-start race)
  const tableManagerModule = await import("./tableManager");
  for (const [roomId] of t.tables) {
    // Remove from in-memory active tables first (stops any pending auto-start timers)
    tableManagerModule.removeActiveTable(roomId);
    // Remove players from room DB
    const roomPlayers = await db.getRoomPlayers(roomId);
    for (const rp of roomPlayers) {
      await db.removeRoomPlayer(roomId, rp.userId);
    }
    await db.updateRoom(roomId, { status: "closed", currentPlayers: 0 });
  }

  // Update tournament status
  await db.updateTournament(tournamentId, {
    status: "finished",
    endTime: new Date(),
    totalPrizePool: totalPrizePool.toFixed(2),
  });

  console.log(`[Tournament ${tournamentId}] Force-finished by totalRounds! Winner: ${activePlayers[0]?.name}. Prize pool: $${totalPrizePool.toFixed(2)}`);

  // Clean up after a delay
  setTimeout(() => {
    activeTournaments.delete(tournamentId);
  }, 5 * 60 * 1000);
}

// ==================== Internal Logic ====================

/**
 * Blind level progression timer
 */
function startBlindTimer(tournamentId: number) {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  const blindDuration = t.blindLevelDuration * 60 * 1000; // ms

  t.blindTimer = setInterval(async () => {
    if (t.isPaused || t.isFinished) return;

    if (t.currentBlindLevel < t.blindStructure.length - 1) {
      t.currentBlindLevel++;
      t.blindLevelStartedAt = Date.now();

      const newBlinds = t.blindStructure[t.currentBlindLevel];
      console.log(`[Tournament ${tournamentId}] Blind level advanced to ${t.currentBlindLevel + 1}: ${newBlinds.smallBlind}/${newBlinds.bigBlind}`);

      // Update all active tables with new blinds
      for (const [roomId, table] of t.tables) {
        if (!table.isActive) continue;
        await db.updateRoom(roomId, {
          smallBlind: String(newBlinds.smallBlind),
          bigBlind: String(newBlinds.bigBlind),
        });
        // Update in-memory table state if game is active
        const tm = await getTableManager();
        const activeTable = tm.getTable(roomId);
        if (activeTable) {
          activeTable.smallBlind = newBlinds.smallBlind;
          activeTable.bigBlind = newBlinds.bigBlind;
        }
      }
    }
  }, blindDuration);
}

/**
 * Table balance checker - runs periodically
 */
function startBalanceChecker(tournamentId: number) {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  t.balanceTimer = setInterval(async () => {
    if (t.isPaused || t.isFinished) return;
    await checkTableBalance(tournamentId);
  }, 15000); // Check every 15 seconds
}

/**
 * Table balancing algorithm (PokerStars-style)
 * 
 * Rules:
 * 1. If total remaining players <= finalTableThreshold, merge to final table
 * 2. If any table has <= 2 players, break it and redistribute
 * 3. If any table has 2+ more players than another, move from big to small
 */
async function checkTableBalance(tournamentId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t || t.isFinished) return;

  const activeTablesList = Array.from(t.tables.values()).filter(tbl => tbl.isActive);
  if (activeTablesList.length <= 1) return;

  const activePlayers = Array.from(t.players.values()).filter(p => !p.isEliminated);

  // Check for final table
  if (activePlayers.length <= t.finalTableThreshold) {
    await formFinalTable(tournamentId);
    return;
  }

  // Check for tables that need breaking (too few players)
  for (const table of activeTablesList) {
    if (table.playerCount <= 2 && activeTablesList.length > 1) {
      await breakTable(tournamentId, table.roomId);
      return; // Re-check after breaking
    }
  }

  // Balance tables (move from largest to smallest when diff >= 2)
  const sorted = [...activeTablesList].sort((a, b) => b.playerCount - a.playerCount);
  if (sorted.length >= 2) {
    const largest = sorted[0];
    const smallest = sorted[sorted.length - 1];

    if (largest.playerCount - smallest.playerCount >= 2) {
      await movePlayerBetweenTables(tournamentId, largest.roomId, smallest.roomId);
    }
  }
}

/**
 * Move a player from one table to another (for balancing)
 * Only moves players who are NOT currently in an active hand
 */
async function movePlayerBetweenTables(tournamentId: number, fromRoomId: number, toRoomId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  // Don't move if from-table has an active hand
  const tm = await getTableManager();
  const fromActiveTable = tm.getTable(fromRoomId);
  if (fromActiveTable && (fromActiveTable.gameState as any).phase !== "completed") return;

  const fromTable = t.tables.get(fromRoomId);
  const toTable = t.tables.get(toRoomId);
  if (!fromTable || !toTable) return;

  // Pick a random player from the from-table
  const playersAtFrom = Array.from(t.players.values()).filter(
    p => !p.isEliminated && p.roomId === fromRoomId
  );
  if (playersAtFrom.length === 0) return;

  const playerToMove = playersAtFrom[Math.floor(Math.random() * playersAtFrom.length)];

  // Remove from old table (DB + in-memory)
  await db.removeRoomPlayer(fromRoomId, playerToMove.userId);
  fromTable.playerCount--;

  // Remove from old table's in-memory gameState if exists
  if (fromActiveTable) {
    fromActiveTable.gameState.players = fromActiveTable.gameState.players.filter(
      (p: any) => p.id !== playerToMove.userId
    );
  }

  // Add to new table
  const newSeatIndex = toTable.playerCount;
  await db.addRoomPlayer(toRoomId, playerToMove.userId, newSeatIndex, String(playerToMove.chips));
  playerToMove.roomId = toRoomId;
  playerToMove.seatIndex = newSeatIndex;
  toTable.playerCount++;

  // Also add to new table's in-memory gameState so they participate in next hand
  const toActiveTable = tm.getTable(toRoomId);
  if (toActiveTable) {
    // Add as a sitting-out player; they'll be included in startNewHand
    // The player will be picked up from room_players on next hand start
  }

  // Update registration
  await db.updateTournamentRegistrationStatus(
    tournamentId, playerToMove.userId, "playing",
    String(toRoomId), newSeatIndex, playerToMove.chips
  );

  console.log(`[Tournament ${tournamentId}] Moved ${playerToMove.name} from table ${fromRoomId} to ${toRoomId}`);
}

/**
 * Break a table and redistribute its players to other tables
 */
async function breakTable(tournamentId: number, roomId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  // Don't break if there's an active hand
  const tm2 = await getTableManager();
  const activeTable = tm2.getTable(roomId);
  if (activeTable && (activeTable.gameState as any).phase !== "completed") return;

  const table = t.tables.get(roomId);
  if (!table) return;

  const playersToMove = Array.from(t.players.values()).filter(
    p => !p.isEliminated && p.roomId === roomId
  );

  table.isActive = false;
  table.playerCount = 0;

  // Get other active tables sorted by player count (smallest first)
  const otherTables = Array.from(t.tables.values())
    .filter(tbl => tbl.isActive && tbl.roomId !== roomId)
    .sort((a, b) => a.playerCount - b.playerCount);

  if (otherTables.length === 0) return;

  // Distribute players round-robin to smallest tables
  for (let i = 0; i < playersToMove.length; i++) {
    const player = playersToMove[i];
    const targetTable = otherTables[i % otherTables.length];

    // Remove from old table
    await db.removeRoomPlayer(roomId, player.userId);

    // Add to new table
    const newSeatIndex = targetTable.playerCount;
    await db.addRoomPlayer(targetTable.roomId, player.userId, newSeatIndex, String(player.chips));
    player.roomId = targetTable.roomId;
    player.seatIndex = newSeatIndex;
    targetTable.playerCount++;

    // Update registration
    await db.updateTournamentRegistrationStatus(
      tournamentId, player.userId, "playing",
      String(targetTable.roomId), newSeatIndex, player.chips
    );
  }

  // Close the broken table room
  await db.updateRoom(roomId, { status: "closed" });
  console.log(`[Tournament ${tournamentId}] Table ${roomId} broken, ${playersToMove.length} players redistributed`);
}

/**
 * Form the final table - merge all remaining players into one table
 */
async function formFinalTable(tournamentId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  const activeTablesList = Array.from(t.tables.values()).filter(tbl => tbl.isActive);
  if (activeTablesList.length <= 1) return; // Already at final table

  // Don't form final table if any table has an active hand
  for (const table of activeTablesList) {
    const tm3 = await getTableManager();
    const activeTable = tm3.getTable(table.roomId);
    if (activeTable && (activeTable.gameState as any).phase !== "completed") return;
  }

  // Pick the table with the most players as the final table
  const sortedTables = [...activeTablesList].sort((a, b) => b.playerCount - a.playerCount);
  const finalTable = sortedTables[0];

  // Move all players from other tables to final table
  for (const table of sortedTables.slice(1)) {
    const playersToMove = Array.from(t.players.values()).filter(
      p => !p.isEliminated && p.roomId === table.roomId
    );

    for (const player of playersToMove) {
      await db.removeRoomPlayer(table.roomId, player.userId);

      const newSeatIndex = finalTable.playerCount;
      await db.addRoomPlayer(finalTable.roomId, player.userId, newSeatIndex, String(player.chips));
      player.roomId = finalTable.roomId;
      player.seatIndex = newSeatIndex;
      finalTable.playerCount++;

      await db.updateTournamentRegistrationStatus(
        tournamentId, player.userId, "playing",
        String(finalTable.roomId), newSeatIndex, player.chips
      );
    }

    table.isActive = false;
    table.playerCount = 0;
    await db.updateRoom(table.roomId, { status: "closed" });
  }

  // Rename final table
  await db.updateRoom(finalTable.roomId, { name: `${t.name} - Final Table` });
  console.log(`[Tournament ${tournamentId}] Final table formed at room ${finalTable.roomId}`);
}

/**
 * Finish tournament - declare winner, calculate prizes
 */
async function finishTournament(tournamentId: number, winner: TournamentPlayer): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) return;

  t.isFinished = true;
  winner.finishRank = 1;

  // Stop timers
  if (t.blindTimer) clearInterval(t.blindTimer);
  if (t.balanceTimer) clearInterval(t.balanceTimer);

  // Calculate prize pool
  const totalPrizePool = t.entryFee * t.totalPlayers * (1 - t.platformRake / 100);

  // Build final rankings: winner first, then elimination order reversed
  const rankings: { userId: number; rank: number; prizeAmount: number }[] = [];

  // Winner = rank 1
  rankings.push({ userId: winner.userId, rank: 1, prizeAmount: 0 });

  // Eliminated players: last eliminated = 2nd place, etc.
  const eliminatedReversed = [...t.eliminationOrder].reverse();
  for (let i = 0; i < eliminatedReversed.length; i++) {
    rankings.push({ userId: eliminatedReversed[i], rank: i + 2, prizeAmount: 0 });
  }

  // Assign prizes based on distribution
  for (const r of rankings) {
    const prizeEntry = t.prizeDistribution.find(p => p.rank === r.rank);
    if (prizeEntry) {
      r.prizeAmount = parseFloat((totalPrizePool * prizeEntry.percentage / 100).toFixed(2));
    }
  }

  // Import notification helper
  const { notifyTournamentResult } = await import("./notifications");

  // Build top-3 rankings for notification
  const topRankings: Array<{ rank: number; name: string; prize: string }> = rankings
    .filter(r => r.rank <= 3)
    .map(r => ({
      rank: r.rank,
      name: t.players.get(r.userId)?.name || `Player ${r.userId}`,
      prize: r.prizeAmount.toFixed(2),
    }));

  // Save results and distribute prizes
  for (const r of rankings) {
    if (r.prizeAmount > 0) {
      const prizeUser = await db.getUserById(r.userId);
      const prizeBefore = prizeUser?.balance ?? "0";
      await db.addUserBalanceAtomic(r.userId, r.prizeAmount);
      const prizeAfter = (parseFloat(prizeBefore) + r.prizeAmount).toFixed(2);
      // Write tournament prize transaction record
      await db.createTransaction({
        userId: r.userId,
        type: "tournament_prize",
        amount: r.prizeAmount.toFixed(2),
        balanceBefore: prizeBefore,
        balanceAfter: prizeAfter,
        status: "confirmed",
        referenceType: "tournament",
        referenceId: tournamentId,
        note: `比赛奖金 #${r.rank}: ${t.name}`,
      });
    }

    await db.saveTournamentResult({
      tournamentId,
      userId: r.userId,
      rank: r.rank,
      prizeAmount: r.prizeAmount.toFixed(2),
      startingChips: t.startingChips,
      finalChips: t.players.get(r.userId)?.chips || 0,
      roundsPlayed: t.handsPlayed,
      handsWon: 0,
    });

    // Notify player with top-3 summary
    await notifyTournamentResult(r.userId, t.name, r.rank, r.prizeAmount.toFixed(2), topRankings, rankings.length).catch(() => {});
  }

  // Update tournament status
  await db.updateTournament(tournamentId, {
    status: "finished",
    endTime: new Date(),
    totalPrizePool: totalPrizePool.toFixed(2),
  });

  // Close all tournament tables and clean up in-memory state
  const tableManagerModule = await import("./tableManager");
  for (const [roomId] of t.tables) {
    tableManagerModule.removeActiveTable(roomId);
    // Remove remaining players from room
    const roomPlayers = await db.getRoomPlayers(roomId);
    for (const rp of roomPlayers) {
      await db.removeRoomPlayer(roomId, rp.userId);
    }
    await db.updateRoom(roomId, { status: "closed", currentPlayers: 0 });
  }

  console.log(`[Tournament ${tournamentId}] Finished! Winner: ${winner.name}. Prize pool: $${totalPrizePool.toFixed(2)}`);

  // Clean up after a delay (keep state for API queries for 5 minutes)
  setTimeout(() => {
    activeTournaments.delete(tournamentId);
  }, 5 * 60 * 1000);
}

/**
 * Cancel a running tournament: stop all timers, close all tables, remove players.
 * Refunds are handled by the caller (routers.ts cancel mutation).
 */
export async function cancelRunningTournament(tournamentId: number): Promise<void> {
  const t = activeTournaments.get(tournamentId);
  if (!t) {
    console.log(`[Tournament ${tournamentId}] Not found in active tournaments, skipping engine cleanup`);
    return;
  }

  t.isFinished = true;

  // Stop timers
  if (t.blindTimer) clearInterval(t.blindTimer);
  if (t.balanceTimer) clearInterval(t.balanceTimer);

  // Close all tournament tables and remove players
  const tableManagerModule = await import("./tableManager");
  for (const [roomId] of t.tables) {
    // Force end any active game on this table
    try {
      tableManagerModule.removeActiveTable(roomId);
    } catch (e) {
      console.error(`[Tournament ${tournamentId}] Error removing table ${roomId}:`, e);
    }
    // Remove all players from the room
    const roomPlayers = await db.getRoomPlayers(roomId);
    for (const rp of roomPlayers) {
      await db.removeRoomPlayer(roomId, rp.userId);
    }
    await db.updateRoom(roomId, { status: "closed", currentPlayers: 0 });
  }

  // Update all playing registrations to refunded status
  for (const [userId] of t.players) {
    await db.updateTournamentRegistrationStatus(tournamentId, userId, "refunded");
  }

  console.log(`[Tournament ${tournamentId}] Cancelled! ${t.players.size} players removed from ${t.tables.size} tables.`);

  // Clean up immediately
  activeTournaments.delete(tournamentId);
}
