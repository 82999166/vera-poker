/**
 * 牌桌管理器 - 内存中的游戏状态管理（HTTP 轮询模式）
 * 管理活跃牌桌、玩家操作、游戏流程（无 WebSocket）
 * 包含：开局、下注、超时处理、结算、回放记录
 */
import * as gameEngine from "./gameEngine";
import * as db from "./db";
import { notifyTurnAction } from "./notifications";
import { onHandCompleted } from "./tonChain";
import * as botManager from "./botManager";
// tournamentEngine is imported dynamically to avoid circular dependency
// import * as tournamentEngine from "./tournamentEngine";
import type { GameState, PlayerAction, Card } from "./gameEngine";

// Lazy-loaded tournament module reference for sync access in checkTimeouts
let _tournamentMod: any = null;
function getTournamentMod() {
  if (!_tournamentMod) {
    import("./tournamentEngine").then(m => { _tournamentMod = m; });
  }
  return _tournamentMod;
}

interface SettlementDetail {
  winners: { playerId: number; name: string; amount: number; handRank: string; handDescription: string }[];
  sidePots: { amount: number; winnerId: number; winnerName: string }[];
  rakeAmount: number;
  showdownPlayers: { playerId: number; name: string; holeCards: string[]; handRank: string; handDescription: string }[];
}

// 玩家信息缓存，减少轮询时的 DB 查询（TTL: 30秒）
const playerInfoCache = new Map<number, { name: string; avatar: string | null; cachedAt: number }>();
const PLAYER_CACHE_TTL = 30000; // 30 seconds

async function getCachedPlayerInfo(userId: number): Promise<{ name: string; avatar: string | null }> {
  const cached = playerInfoCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < PLAYER_CACHE_TTL) {
    return { name: cached.name, avatar: cached.avatar };
  }
  const user = await db.getUserById(userId);
  const info = { name: user?.nickname || user?.name || `Player`, avatar: user?.avatar || null };
  playerInfoCache.set(userId, { ...info, cachedAt: Date.now() });
  return info;
}

// Invalidate cache when user updates profile
export function invalidatePlayerCache(userId: number) {
  playerInfoCache.delete(userId);
}

interface ActiveTable {
  roomId: number;
  gameState: GameState;
  handId: number | null;
  lastActionAt: number;
  turnTimeout: number; // seconds
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  lastWinner?: { name: string; amount: number; handDescription?: string };
  settlementDetail?: SettlementDetail;
  // Ready system: players must click "start" after each hand
  readyPlayers: Set<number>; // player IDs who clicked ready
  readyDeadline?: number; // timestamp when unready players get kicked
  waitingForReady: boolean; // true when in between hands waiting for ready clicks
  settlementStartedAt?: number; // timestamp when settlement started (for delayed ready)
  afkFoldCount: Map<number, number>; // playerId -> consecutive auto-fold count (zombie detection)
  lastAggressorId?: number; // playerId of the last player who raised/bet (for showdown reveal order)
  // 牌局回放数据：记录每步操作用于回放
  actionTimeline: Array<{
    seq: number;
    phase: string;
    playerId: number;
    playerName: string;
    action: string;
    amount: number;
    potAfter: number;
    timestamp: number;
  }>;
  playerSnapshot: Array<{
    id: number;
    name: string;
    seatIndex: number;
    startChips: number;
    holeCards: string[];
  }>;
}

// In-memory store of active tables
const activeTables = new Map<number, ActiveTable>();

/**
 * Get or create a table state for a room
 */
export function getTable(roomId: number): ActiveTable | undefined {
  return activeTables.get(roomId);
}

/**
 * Get the current game state visible to a specific player
 * Hides other players' hole cards unless in showdown
 */
export async function getPlayerView(roomId: number, playerId: number) {
  let table = activeTables.get(roomId);
  if (!table) {
    // No active game - return seated players with avatar info
    // Do NOT auto-start here; game should only start via playerReady or joinTable
    const seatedPlayers = await db.getRoomPlayers(roomId);
    const waitingPlayers = await Promise.all(seatedPlayers.map(async (sp) => {
      const info = await getCachedPlayerInfo(sp.userId);
      return {
        id: sp.userId,
        seatIndex: sp.seatIndex,
        chips: parseFloat(sp.chipCount || "0"),
        currentBet: 0,
        totalBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: true,
        name: info.name || `Player ${sp.seatIndex + 1}`,
        avatar: info.avatar,
        holeCards: [],
      };
    }));
    // Also include sitting_out players (spectators waiting for next hand)
    const sittingOutList = await db.getRoomPlayersSittingOut(roomId);
    const activeIds = new Set(waitingPlayers.map(p => p.id));
    const activeSeats = new Set(waitingPlayers.map(p => p.seatIndex));
    const sittingOutWaiting = await Promise.all(
      sittingOutList
        .filter((sp: any) => !activeIds.has(sp.userId) && !activeSeats.has(sp.seatIndex))
        .map(async (sp: any) => {
          const info = await getCachedPlayerInfo(sp.userId);
          return {
            id: sp.userId,
            seatIndex: sp.seatIndex,
            chips: parseFloat(sp.chipCount || "0"),
            currentBet: 0,
            totalBet: 0,
            isFolded: false,
            isAllIn: false,
            isActive: false,
            name: info.name || `Player ${sp.seatIndex + 1}`,
            avatar: info.avatar,
            holeCards: [],
            isSittingOut: true,
          };
        })
    );
    waitingPlayers.push(...sittingOutWaiting);
    // Check if room is closed (e.g. totalRounds reached after settlement)
    const roomInfo = await db.getRoomById(roomId);
    const roomClosed = roomInfo?.status === "closed";
    return { phase: "waiting", players: waitingPlayers, communityCards: [], pot: 0, currentBet: 0, currentPlayerIndex: -1, myCards: [], roomClosed };
  }

  const gs = table.gameState;
  const myPlayer = gs.players.find(p => p.id === playerId);
  const myCards = myPlayer?.holeCards || [];

  // Fetch player names and avatars in parallel (cached to reduce DB load during polling)
  const playerInfo = new Map<number, { name: string; avatar: string | null }>();
  await Promise.all(gs.players.map(async (p) => {
    const info = await getCachedPlayerInfo(p.id);
    playerInfo.set(p.id, { name: info.name || `Player ${p.seatIndex + 1}`, avatar: info.avatar });
  }));

  // Build per-player lastAction map from actionTimeline (current phase)
  const playerLastActionMap = new Map<number, { action: string; amount: number }>();
  if (table.actionTimeline) {
    for (const entry of table.actionTimeline) {
      if (entry.phase === gs.phase) {
        playerLastActionMap.set(entry.playerId, { action: entry.action, amount: entry.amount });
      }
    }
  }

  const players = gs.players.map(p => ({
    id: p.id,
    seatIndex: p.seatIndex,
    chips: p.chips,
    currentBet: p.currentBet,
    totalBet: p.totalBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
    isActive: p.isActive,
    name: playerInfo.get(p.id)?.name || `P${p.seatIndex + 1}`,
    avatar: playerInfo.get(p.id)?.avatar || null,
    // SECURITY: Only reveal opponent hole cards during showdown/completed phase.
    // During preflop/flop/turn/river, opponents must only see face-down cards.
    // The requesting player always sees their own cards.
    // When hand is over (waitingForReady or stale completed) - clear ALL cards to prevent stale display.
    holeCards: (table.waitingForReady || ((gs.phase === "completed" || gs.phase === "showdown") && !table.waitingForReady && table.settlementStartedAt && (Date.now() - table.settlementStartedAt) > 10000))
      ? []  // Hand is over or stale, clear all cards
      : (p.id === playerId)
        ? p.holeCards  // Always show own cards
        : (gs.phase === "showdown" || gs.phase === "completed")
          ? p.holeCards  // Show opponent cards only at showdown
          : [],          // Hide opponent cards during active betting rounds
    isSittingOut: false, // Active game players are never sitting out
    lastAction: playerLastActionMap.get(p.id) || null, // Last action in current phase for UI display
  }));

  // Append sitting_out players (waiting for next hand) to the player list
  // IMPORTANT: Deduplicate by userId AND seatIndex to prevent overlap when
  // activateSittingOutPlayers() runs concurrently with getPlayerView polling.
  const sittingOutList = await db.getRoomPlayersSittingOut(roomId);
  const activePlayerIds = new Set(players.map(p => p.id));
  const activeSeats = new Set(players.map(p => p.seatIndex));
  const sittingOutPlayers = await Promise.all(
    sittingOutList
      .filter((sp: any) => !activePlayerIds.has(sp.userId) && !activeSeats.has(sp.seatIndex))
      .map(async (sp: any) => {
        const info = await getCachedPlayerInfo(sp.userId);
        return {
          id: sp.userId,
          seatIndex: sp.seatIndex,
          chips: parseFloat(sp.chipCount || "0"),
          currentBet: 0,
          totalBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          name: info.name || `Player ${sp.seatIndex + 1}`,
          avatar: info.avatar,
          holeCards: [],
          isSittingOut: true, // Waiting for next hand (Wait for Big Blind)
          lastAction: null,
        };
      })
  );
  players.push(...sittingOutPlayers);

  // Also include active DB players NOT in gs.players (transition window: activateSittingOutPlayers
  // already changed status to active in DB, but initializeGame hasn't added them to gameState yet)
  const dbActivePlayers = await db.getRoomPlayers(roomId);
  const allKnownIds = new Set(players.map(p => p.id));
  const allKnownSeats = new Set(players.map(p => p.seatIndex));
  const transitionPlayers = await Promise.all(
    dbActivePlayers
      .filter((sp: any) => !allKnownIds.has(sp.userId) && !allKnownSeats.has(sp.seatIndex))
      .map(async (sp: any) => {
        const info = await getCachedPlayerInfo(sp.userId);
        return {
          id: sp.userId,
          seatIndex: sp.seatIndex,
          chips: parseFloat(sp.chipCount || "0"),
          currentBet: 0,
          totalBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          name: info.name || `Player ${sp.seatIndex + 1}`,
          avatar: info.avatar,
          holeCards: [],
          isSittingOut: true, // Transitioning - show as sitting out
          lastAction: null,
        };
      })
  );
  players.push(...transitionPlayers);

  // Check if the requesting player is sitting out
  const amISittingOut = sittingOutList.some((sp: any) => sp.userId === playerId);

  // Tournament context: check if this is a tournament table
  const tournamentModule = await import("./tournamentEngine");
  const tournamentIdForRoom = tournamentModule.getTournamentForRoom(roomId);
  let tournamentInfo: {
    isTournament: boolean;
    tournamentId: number | null;
    blindLevel: number;
    currentBlinds: { smallBlind: number; bigBlind: number };
    nextBlinds: { smallBlind: number; bigBlind: number } | null;
    timeUntilNextLevel: number;
    playersRemaining: number;
    totalPlayers: number;
    myRank: number | null;
    myEliminated: boolean;
    myPrize: string | null;
    isPaused: boolean;
    isFinished: boolean;
  } | null = null;

  if (tournamentIdForRoom !== null) {
    const tState = tournamentModule.getTournamentState(tournamentIdForRoom, playerId);
    if (tState) {
      // Look up prize if player is eliminated or tournament finished
      let myPrize: string | null = null;
      if (tState.myRank && tState.myEliminated) {
        // Prize will be calculated and stored in DB by finishTournament
        // For now just show rank; actual prize amount comes from tournament results
        const results = await db.getTournamentResults(tournamentIdForRoom);
        const myResult = results?.find((r) => r.result.userId === playerId);
        if (myResult && parseFloat(myResult.result.prizeAmount) > 0) {
          myPrize = myResult.result.prizeAmount;
        }
      }
      tournamentInfo = {
        isTournament: true,
        tournamentId: tournamentIdForRoom,
        blindLevel: tState.currentBlindLevel,
        currentBlinds: tState.currentBlinds || { smallBlind: 0, bigBlind: 0 },
        nextBlinds: tState.nextBlinds ? { smallBlind: tState.nextBlinds.smallBlind, bigBlind: tState.nextBlinds.bigBlind } : null,
        timeUntilNextLevel: tState.timeUntilNextLevel,
        playersRemaining: tState.activePlayers,
        totalPlayers: tState.totalPlayers,
        myRank: tState.myRank,
        myEliminated: tState.myEliminated,
        myPrize,
        isPaused: tState.status === "paused",
        isFinished: tState.status === "finished",
      };
    }
  }

  // Determine if we should clear stale hand data:
  // 1. waitingForReady is true (normal between-hands state)
  // 2. Phase is completed but waitingForReady is false AND settlement was long ago (>10s)
  //    This catches the edge case where playerReady set waitingForReady=false but startNewHand
  //    failed to start (not enough players), yet the old activeTables entry wasn't cleaned up.
  const settlementAge = table.settlementStartedAt ? (Date.now() - table.settlementStartedAt) : 0;
  const isStaleCompleted = (gs.phase === "completed" || gs.phase === "showdown") && !table.waitingForReady && settlementAge > 10000;
  const shouldClearCards = table.waitingForReady || isStaleCompleted;

  // When hand is over or stale - clear cards so frontend doesn't show stale data
  return {
    phase: shouldClearCards ? 'completed' : gs.phase,
    players,
    communityCards: shouldClearCards ? [] : gs.communityCards,
    pot: shouldClearCards ? 0 : gs.pot,
    currentBet: gs.currentBet,
    currentPlayerIndex: gs.currentPlayerIndex,
    currentPlayerId: gs.currentPlayerIndex >= 0 ? gs.players[gs.currentPlayerIndex]?.id : null,
    dealerIndex: gs.dealerIndex,
    myCards: shouldClearCards ? [] : myCards,
    handNumber: table.handNumber,
    serverSeedHash: gs.serverSeedHash,
    lastActionAt: table.lastActionAt,
    turnTimeout: table.turnTimeout,
    lastWinner: table.lastWinner || null,
    settlementDetail: table.settlementDetail || null,
    // Ready system
    waitingForReady: table.waitingForReady || isStaleCompleted,
    readyPlayers: Array.from(table.readyPlayers),
    readyDeadline: table.readyDeadline || null,
    readyCountdown: table.readyDeadline ? Math.max(0, Math.ceil((table.readyDeadline - Date.now()) / 1000)) : null,
    // Last action info for voice announcements
    lastActionInfo: (table as any).lastActionInfo || null,
    // Showdown reveal order: last aggressor first, then others in seat order
    showdownRevealOrder: (() => {
      const activePlayers = gs.players.filter(p => !p.isFolded);
      if (activePlayers.length <= 1) return activePlayers.map(p => p.id);
      const aggressorId = table.lastAggressorId;
      if (!aggressorId) return activePlayers.map(p => p.id);
      const aggressor = activePlayers.find(p => p.id === aggressorId);
      const others = activePlayers.filter(p => p.id !== aggressorId);
      return aggressor ? [aggressor.id, ...others.map(p => p.id)] : activePlayers.map(p => p.id);
    })(),
    // Waiting for next hand (Wait for Big Blind)
    amISittingOut,
    // Tournament context
    tournamentInfo,
  };
}

/**
 * Join a table - add player to room_players and potentially start a game
 */
export async function joinTable(roomId: number, userId: number, buyIn: number): Promise<{ success: boolean; seatIndex: number; message?: string }> {
  const room = await db.getRoomById(roomId);
  if (!room) return { success: false, seatIndex: -1, message: "Room not found" };
  if (room.status === "closed" || room.status === "paused") {
    return { success: false, seatIndex: -1, message: "Room is not available" };
  }

    // Use getRoomPlayersAll to include both active + sitting_out players for seat occupancy checks
  const existingPlayers = await db.getRoomPlayersAll(roomId);
  // Check if already seated at THIS table (active or sitting_out)
  const alreadySeated = existingPlayers.find((p: any) => p.userId === userId);
  if (alreadySeated) {
    // If player is sitting_out, treat as a successful rejoin (resume their seat)
    if (alreadySeated.status === "sitting_out") {
      return { success: true, seatIndex: alreadySeated.seatIndex, message: "WAITING_FOR_NEXT_HAND" };
    }
    // If player is active in the game, reject (second device scenario)
    return { success: false, seatIndex: alreadySeated.seatIndex, message: "ALREADY_SEATED_THIS_TABLE" };
  }

  // Check if player is already seated at ANOTHER table - one account, one active game at a time
  const activeRoom = await db.getPlayerActiveRoom(userId);
  if (activeRoom && activeRoom.roomId !== roomId) {
    // Reject: same account cannot be in two different games simultaneously
    return { success: false, seatIndex: -1, message: "Already in another game. Please leave your current table first." };
  }

  // Check max players (count all seated players including sitting_out)
  if (existingPlayers.length >= room.maxPlayers) {
    return { success: false, seatIndex: -1, message: "Table is full" };
  }

  // Find available seat for the player
  // For real players: prefer seat 0 (bottom-center position on screen)
  // If seat 0 is taken by a bot, swap the bot to another seat
  const takenSeats = new Set(existingPlayers.map((p: any) => p.seatIndex));
  const botManager = await import("./botManager");
  const botUserIds = await botManager.getBotUserIds();
  const isRealPlayer = !botUserIds.includes(userId);
  let seatIndex = -1;

  if (isRealPlayer) {
    // Real player: try seat 0 first
    if (!takenSeats.has(0)) {
      seatIndex = 0;
    } else {
      // Seat 0 is taken - check if it's a bot we can swap
      const seat0Player = existingPlayers.find((p: any) => p.seatIndex === 0);
      if (seat0Player && botUserIds.includes(seat0Player.userId)) {
        // Find an empty seat for the bot
        let botNewSeat = -1;
        for (let i = 1; i < room.maxPlayers; i++) {
          if (!takenSeats.has(i)) { botNewSeat = i; break; }
        }
        if (botNewSeat !== -1) {
          // Swap bot to new seat
          await db.updateRoomPlayerSeat(roomId, seat0Player.userId, botNewSeat);
          seatIndex = 0;
        } else {
          // No empty seat to swap bot, find any available seat for real player
          for (let i = 1; i < room.maxPlayers; i++) {
            if (!takenSeats.has(i)) { seatIndex = i; break; }
          }
        }
      } else {
        // Seat 0 taken by real player, find next available
        for (let i = 1; i < room.maxPlayers; i++) {
          if (!takenSeats.has(i)) { seatIndex = i; break; }
        }
      }
    }
  } else {
    // Bot: find first available seat (skip seat 0 to reserve for real players)
    for (let i = 1; i < room.maxPlayers; i++) {
      if (!takenSeats.has(i)) { seatIndex = i; break; }
    }
    // If no seat 1-5 available, use seat 0 as last resort
    if (seatIndex === -1 && !takenSeats.has(0)) {
      seatIndex = 0;
    }
  }

  if (seatIndex === -1) {
    return { success: false, seatIndex: -1, message: "No available seats" };
  }

  // Check if a game session exists (active hand, showdown, completed/ready phase, etc.)
  // If activeTables has this room, a game session is in progress or between hands.
  // New players must ALWAYS sit out and wait for the next hand to start.
  // This prevents: joining during completed/ready phase → being dealt cards without readying up.
  const existingTable = activeTables.get(roomId);
  if (existingTable) {
    // Game session exists: add as sitting_out (waiting for next hand)
    const added = await db.addRoomPlayerSittingOut(roomId, userId, seatIndex, buyIn.toString());
    if (!added) {
      return { success: false, seatIndex: -1, message: "Failed to add player to table" };
    }
    await db.updateRoom(roomId, { currentPlayers: existingPlayers.length + 1 });
    return { success: true, seatIndex, message: "WAITING_FOR_NEXT_HAND" };
  }

  // No active game session: add as active player
  const added = await db.addRoomPlayer(roomId, userId, seatIndex, buyIn.toString());
  if (!added) {
    return { success: false, seatIndex: -1, message: "Failed to add player to table" };
  }
  
  // Update room player count
  await db.updateRoom(roomId, { currentPlayers: existingPlayers.length + 1 });

  // If we now have 2+ players and no active game, start one
  const updatedPlayers = await db.getRoomPlayers(roomId);
  if (updatedPlayers.length >= 2 && !activeTables.has(roomId)) {
    await startNewHand(roomId);
  }

  return { success: true, seatIndex };
}

/**
 * Leave a table
 */
export async function leaveTable(roomId: number, userId: number): Promise<{ success: boolean; remainingChips: number; message?: string }> {
  // Tournament tables: players cannot leave mid-tournament
  const { isTournamentTable: isTourney } = require("./tournamentEngine");
  if (isTourney(roomId)) {
    return { success: false, remainingChips: 0, message: "Cannot leave during a tournament" };
  }

  const table = activeTables.get(roomId);
  let remainingChips = 0;

  // Get the player's current chip count BEFORE any modifications
  if (table) {
    const player = table.gameState.players.find(p => p.id === userId);
    if (player) {
      remainingChips = player.chips;
    } else {
      // Player might be sitting_out (waiting for next hand) - get from DB
      const sittingOutPlayers = await db.getRoomPlayersSittingOut(roomId);
      const sittingOutPlayer = sittingOutPlayers.find((p: any) => p.userId === userId);
      if (sittingOutPlayer) {
        remainingChips = parseFloat(sittingOutPlayer.chipCount || "0");
      }
    }
  } else {
    // No active game, get from DB
    const roomPlayers = await db.getRoomPlayers(roomId);
    const myPlayer = roomPlayers.find((p: any) => p.userId === userId && p.status === "active");
    if (myPlayer) {
      remainingChips = parseFloat(myPlayer.chipCount);
    }
  }

  // If game is active, fold the player first then safely remove from players array
  if (table) {
    const gs = table.gameState;
    const playerIndex = gs.players.findIndex(p => p.id === userId);
    if (playerIndex !== -1) {
      // If player hasn't folded yet, fold them and advance game
      if (!gs.players[playerIndex].isFolded) {
        table.gameState = gameEngine.processAction(gs, userId, "fold");
        await checkAndAdvanceGame(roomId);
      }
      // Now safely remove the player and fix currentPlayerIndex
      const gsAfter = table.gameState;
      const removeIdx = gsAfter.players.findIndex(p => p.id === userId);
      if (removeIdx !== -1) {
        // Fix currentPlayerIndex: if it points at or after the removed player, shift it back
        if (gsAfter.currentPlayerIndex > removeIdx) {
          gsAfter.currentPlayerIndex--;
        } else if (gsAfter.currentPlayerIndex === removeIdx) {
          // Current turn was on the leaving player (edge case: already folded but index stuck)
          // After removal, the same index now points to the next player - validate it
          // Will be corrected below after splice
        }
        gsAfter.players.splice(removeIdx, 1);
        // Ensure currentPlayerIndex is within bounds
        if (gsAfter.players.length > 0) {
          if (gsAfter.currentPlayerIndex >= gsAfter.players.length) {
            gsAfter.currentPlayerIndex = gsAfter.currentPlayerIndex % gsAfter.players.length;
          }
          // If the current player is folded/all-in, we need to find the next active player
          const cur = gsAfter.players[gsAfter.currentPlayerIndex];
          if (cur && (cur.isFolded || cur.isAllIn)) {
            // Find next active player from current position
            let next = gsAfter.currentPlayerIndex;
            let found = false;
            for (let i = 0; i < gsAfter.players.length; i++) {
              next = (gsAfter.currentPlayerIndex + i) % gsAfter.players.length;
              const p = gsAfter.players[next];
              if (!p.isFolded && !p.isAllIn && p.isActive) {
                found = true;
                break;
              }
            }
            gsAfter.currentPlayerIndex = found ? next : -1;
          }
        } else {
          gsAfter.currentPlayerIndex = -1;
        }
        // After removing player, re-check if game needs to advance
        // (e.g. only 1 active player left after removal)
        await checkAndAdvanceGame(roomId);
      }
    }
  }

    await db.removeRoomPlayer(roomId, userId);
  // Update player count (include sitting_out players)
  const remaining = await db.getRoomPlayersAll(roomId);
  await db.updateRoom(roomId, { currentPlayers: remaining.length });
  // If less than 2 total players (active + sitting_out), end the table
  if (remaining.length < 2) {
    activeTables.delete(roomId);
  }

  return { success: true, remainingChips };
}

/**
 * Process a player action
 */
export async function processPlayerAction(
  roomId: number,
  userId: number,
  action: PlayerAction,
  amount?: number
): Promise<{ success: boolean; message?: string }> {
  const table = activeTables.get(roomId);
  if (!table) return { success: false, message: "No active game" };

  const gs = table.gameState;
  // Block actions during non-betting phases (including showdown - 4s settle delay)
  if (gs.phase === "waiting" || gs.phase === "completed" || gs.phase === "showdown" || gs.phase === "dealing") {
    return { success: false, message: "Game is not in an active betting phase" };
  }

  // Verify it's this player's turn
  const currentPlayer = gs.players[gs.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== userId) {
    // Special case: if currentPlayerIndex is -1, the round should have already advanced.
    // Trigger advance in case it got stuck, then reject the action.
    if (gs.currentPlayerIndex === -1) {
      await checkAndAdvanceGame(roomId);
    }
    return { success: false, message: "Not your turn" };
  }

  // Validate action based on game state
  if (action === "check" && gs.currentBet > currentPlayer.currentBet) {
    return { success: false, message: "Cannot check, must call or raise" };
  }

  if (action === "call" && gs.currentBet <= currentPlayer.currentBet) {
    return { success: false, message: "Nothing to call, use check instead" };
  }

  if (action === "raise") {
    if (!amount || amount <= 0) {
      return { success: false, message: "Raise amount must be positive" };
    }
    // Minimum raise = currentBet + minRaise increment (standard poker rule)
    const minRaiseTotal = gs.currentBet + gs.minRaise;
    if (amount < minRaiseTotal && amount < currentPlayer.chips + currentPlayer.currentBet) {
      return { success: false, message: `Minimum raise is $${minRaiseTotal.toFixed(2)}` };
    }
    if (amount > currentPlayer.chips + currentPlayer.currentBet) {
      return { success: false, message: "Cannot raise more than your stack" };
    }
  }

  if (currentPlayer.isFolded) {
    return { success: false, message: "You have already folded" };
  }

  if (currentPlayer.isAllIn) {
    return { success: false, message: "You are already all-in" };
  }

  // Process the action
  table.gameState = gameEngine.processAction(gs, userId, action, amount);
  table.lastActionAt = Date.now();
  // Player made a real action → reset their AFK counter
  table.afkFoldCount.delete(userId);
  // Record last aggressor for showdown reveal order
  if (action === "raise" || action === "all_in") {
    table.lastAggressorId = userId;
  }
  // Record last action for voice announcement on other clients
  (table as any).lastActionInfo = {
    playerId: userId,
    playerName: `Player ${currentPlayer.seatIndex + 1}`,
    action,
    amount: amount || 0,
    timestamp: Date.now(),
  };

  // 记录操作到回放时间线
  if (table.actionTimeline) {
    const playerName = table.playerSnapshot?.find(p => p.id === userId)?.name || `Player ${currentPlayer.seatIndex + 1}`;
    table.actionTimeline.push({
      seq: table.actionTimeline.length,
      phase: gs.phase,
      playerId: userId,
      playerName,
      action,
      amount: amount || 0,
      potAfter: table.gameState.pot,
      timestamp: Date.now(),
    });
  }

  // Check if betting round is complete and advance game
  await checkAndAdvanceGame(roomId);

  // NOTE: Do NOT notify next player here - notifications are only sent on timeout auto-fold
  return { success: true };
}

// Tracks pending showdown settle timers (to avoid double-settling)
const showdownTimers = new Map<number, NodeJS.Timeout>();

/**
 * Check if betting round is complete and advance game phases
 */
async function checkAndAdvanceGame(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;

  const gs = table.gameState;

  // Safety: validate currentPlayerIndex is within bounds
  if (gs.players.length > 0 && gs.currentPlayerIndex >= gs.players.length) {
    gs.currentPlayerIndex = gs.currentPlayerIndex % gs.players.length;
  } else if (gs.players.length === 0) {
    gs.currentPlayerIndex = -1;
  }

  // Check if only 1 player left (everyone else folded) → settle immediately, no showdown
  const activePlayers = gameEngine.getActivePlayers(gs);
  if (activePlayers.length <= 1 && gs.phase !== 'showdown' && gs.phase !== 'completed' && gs.phase !== 'waiting') {
    await settleHand(roomId);
    return;
  }

  // If already in showdown phase, do nothing (settle timer is already scheduled)
  if (gs.phase === 'showdown' || gs.phase === 'completed') return;

  // If currentPlayerIndex is -1 (no one can act), treat as round complete
  if (gs.currentPlayerIndex === -1) {
    const newState = gameEngine.advancePhase(gs, table.bigBlind);
    table.gameState = newState;
    table.lastActionAt = Date.now();
    if (newState.phase === 'showdown') {
      scheduleShowdownSettle(roomId);
      return;
    }
    // Continue checking below
  }

  // Check if betting round is complete - loop to handle consecutive phase advances
  // (e.g. both players check on flop → advance to turn → both all-in → advance to river → showdown)
  let maxAdvances = 5; // safety limit to prevent infinite loop
  while (gameEngine.isBettingRoundComplete(table.gameState) && maxAdvances-- > 0) {
    const currentGs = table.gameState;
    // Re-check active players before advancing
    const activeNow = gameEngine.getActivePlayers(currentGs);
    if (activeNow.length <= 1) {
      await settleHand(roomId);
      return;
    }

    // Pass bigBlind so post-flop minRaise is correctly initialized
    const newState = gameEngine.advancePhase(currentGs, table.bigBlind);
    table.gameState = newState;
    table.lastActionAt = Date.now();

    // After advancing to showdown, delay settlement so frontend can show cards
    if (newState.phase === 'showdown') {
      scheduleShowdownSettle(roomId);
      return;
    }

    // If all remaining players are all-in (but not showdown yet), schedule delayed phase advances
    const stillActive = gameEngine.getActivePlayers(table.gameState);
    const canAct = stillActive.filter(p => !p.isAllIn);
    if (canAct.length <= 1 && table.gameState.phase !== 'showdown') {
      scheduleAllInAdvance(roomId);
      return;
    }
    // Otherwise loop again: check if the new phase is also immediately complete
  }
}

/**
 * Schedule showdown settlement with delay so frontend can animate card reveal
 * Delay: 4 seconds (enough for flip animation + hand evaluation display)
 */
function scheduleShowdownSettle(roomId: number) {
  // Clear any existing timer
  const existing = showdownTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const SHOWDOWN_DELAY_MS = 4000; // 4 seconds for card reveal animation
  const timer = setTimeout(async () => {
    showdownTimers.delete(roomId);
    const table = activeTables.get(roomId);
    if (!table) return;
    if (table.gameState.phase === 'showdown') {
      await settleHand(roomId);
    }
  }, SHOWDOWN_DELAY_MS);

  showdownTimers.set(roomId, timer);
}

/**
 * Schedule delayed phase advances for all-in scenarios
 * Each phase advances after a delay so frontend can show card animations
 */
const allInTimers = new Map<number, NodeJS.Timeout>();

function scheduleAllInAdvance(roomId: number) {
  // Clear any existing timer for this room
  const existing = allInTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const DELAY_MS = 1800; // 1.8 seconds between each phase advance

  const timer = setTimeout(async () => {
    allInTimers.delete(roomId);
    const table = activeTables.get(roomId);
    if (!table) return;

    // If only 1 active player (all others folded), settle immediately
    const activeNow = gameEngine.getActivePlayers(table.gameState);
    if (activeNow.length <= 1 && table.gameState.phase !== 'showdown' && table.gameState.phase !== 'completed') {
      await settleHand(roomId);
      return;
    }

    if (gameEngine.isBettingRoundComplete(table.gameState)) {
      const newState = gameEngine.advancePhase(table.gameState, table.bigBlind);
      table.gameState = newState;
      table.lastActionAt = Date.now();

      // If we just entered showdown, schedule delayed settlement
      if (newState.phase === 'showdown') {
        scheduleShowdownSettle(roomId);
        return;
      }

      // Check if still need to advance (all players still all-in)
      const stillActive = gameEngine.getActivePlayers(table.gameState);
      const canAct = stillActive.filter(p => !p.isAllIn);
      if (canAct.length <= 1 && table.gameState.phase !== 'showdown') {
        // Schedule next advance
        scheduleAllInAdvance(roomId);
      }
    }
  }, DELAY_MS);

  allInTimers.set(roomId, timer);
}

/**
 * Calculate side pots when players are all-in with different amounts
 */
function calculateSidePots(players: gameEngine.Player[]): { amount: number; eligiblePlayers: number[] }[] {
  const activePlayers = players.filter(p => !p.isFolded && p.isActive);
  if (activePlayers.length === 0) return [];

  // Sort by totalBet ascending to identify side pot boundaries
  const sorted = [...activePlayers].sort((a, b) => a.totalBet - b.totalBet);
  const pots: { amount: number; eligiblePlayers: number[] }[] = [];
  let prevBet = 0;

  for (let i = 0; i < sorted.length; i++) {
    const currentBet = sorted[i].totalBet;
    if (currentBet <= prevBet) continue;

    const increment = currentBet - prevBet;
    // All players who bet at least this much contribute to this pot
    const eligible = activePlayers.filter(p => p.totalBet >= currentBet);
    // Also count folded players' contributions up to this level
    const allContributors = players.filter(p => p.totalBet > prevBet);
    const potAmount = allContributors.reduce((sum, p) => {
      const contribution = Math.min(p.totalBet - prevBet, increment);
      return sum + Math.max(0, contribution);
    }, 0);

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligiblePlayers: eligible.map(p => p.id) });
    }
    prevBet = currentBet;
  }

  return pots;
}

/**
 * Settle the hand - determine winner, distribute pot with side pots, record to DB
 */
async function settleHand(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;

  const gs = table.gameState;
  const activePlayers = gameEngine.getActivePlayers(gs);

  // Fetch all player names
  const playerNames = new Map<number, string>();
  for (const p of gs.players) {
    const user = await db.getUserById(p.id);
    playerNames.set(p.id, user?.nickname || user?.name || `Player ${p.seatIndex + 1}`);
  }

  // Check if this is a tournament table - tournaments have NO rake
  const tournamentEngineForRake = await import("./tournamentEngine");
  const isTournamentRoom = tournamentEngineForRake.getTournamentForRoom(roomId) !== null;

  // Get system config for rake (0 for tournaments)
  let rakePercent = 0;
  let rakeCap = 0;
  if (!isTournamentRoom) {
    const rakeConfig = await db.getConfig("rake_percentage");
    const rakeCapConfig = await db.getConfig("rake_cap");
    rakePercent = rakeConfig ? parseFloat(rakeConfig.value) : 5;
    rakeCap = rakeCapConfig ? parseFloat(rakeCapConfig.value) : 3;
  }

  let mainWinnerId: number | undefined;
  let winningHand = "";
  let totalRake = 0;
  const winnerDetails: SettlementDetail["winners"] = [];
  const sidePotDetails: SettlementDetail["sidePots"] = [];
  const showdownPlayers: SettlementDetail["showdownPlayers"] = [];
  const playerWinAmounts = new Map<number, number>(); // track total win per player

  if (activePlayers.length === 1) {
    // Last player standing wins - no showdown
    const winner = activePlayers[0];
    mainWinnerId = winner.id;
    winningHand = "last_standing";
    const rake = Math.min(gs.pot * rakePercent / 100, rakeCap);
    totalRake = rake;
    const winAmount = gs.pot - rake;
    const winnerIdx = gs.players.findIndex(p => p.id === winner.id);
    gs.players[winnerIdx].chips += winAmount;
    playerWinAmounts.set(winner.id, winAmount);
    winnerDetails.push({
      playerId: winner.id,
      name: playerNames.get(winner.id) || "Unknown",
      amount: winAmount,
      handRank: "last_standing",
      handDescription: "Last Standing",
    });
  } else {
    // Showdown - calculate side pots and distribute
    const hasAllIn = activePlayers.some(p => p.isAllIn);
    
    // Evaluate all active players' hands for showdown display
    for (const player of activePlayers) {
      const evaluation = gameEngine.evaluateHand(player.holeCards, gs.communityCards);
      showdownPlayers.push({
        playerId: player.id,
        name: playerNames.get(player.id) || "Unknown",
        holeCards: player.holeCards,
        handRank: evaluation.rank,
        handDescription: evaluation.description,
      });
    }

    if (hasAllIn) {
      // Side pot distribution
      const pots = calculateSidePots(gs.players);
      for (const pot of pots) {
        const eligibleActive = activePlayers.filter(p => pot.eligiblePlayers.includes(p.id));
        // Find best hand among eligible players
        let bestEval: any = null;
        let potWinners: typeof eligibleActive = [];
        for (const player of eligibleActive) {
          const evaluation = gameEngine.evaluateHand(player.holeCards, gs.communityCards);
          if (!bestEval || gameEngine.compareHands(evaluation, bestEval) > 0) {
            bestEval = evaluation;
            potWinners = [player];
          } else if (gameEngine.compareHands(evaluation, bestEval) === 0) {
            potWinners.push(player);
          }
        }
        const potRake = Math.min(pot.amount * rakePercent / 100, rakeCap / pots.length);
        totalRake += potRake;
        const distributable = pot.amount - potRake;
        const share = distributable / potWinners.length;
        for (const winner of potWinners) {
          const idx = gs.players.findIndex(p => p.id === winner.id);
          gs.players[idx].chips += share;
          playerWinAmounts.set(winner.id, (playerWinAmounts.get(winner.id) || 0) + share);
          if (!mainWinnerId) {
            mainWinnerId = winner.id;
            winningHand = bestEval.rank;
          }
        }
        sidePotDetails.push({
          amount: pot.amount,
          winnerId: potWinners[0].id,
          winnerName: playerNames.get(potWinners[0].id) || "Unknown",
        });
      }
    } else {
      // Simple pot distribution (no all-in)
      let bestEval: any = null;
      let winners: typeof activePlayers = [];
      for (const player of activePlayers) {
        const evaluation = gameEngine.evaluateHand(player.holeCards, gs.communityCards);
        if (!bestEval || gameEngine.compareHands(evaluation, bestEval) > 0) {
          bestEval = evaluation;
          winners = [player];
        } else if (gameEngine.compareHands(evaluation, bestEval) === 0) {
          winners.push(player);
        }
      }
      const rake = Math.min(gs.pot * rakePercent / 100, rakeCap);
      totalRake = rake;
      const distributable = gs.pot - rake;
      const share = distributable / winners.length;
      for (const winner of winners) {
        const idx = gs.players.findIndex(p => p.id === winner.id);
        gs.players[idx].chips += share;
        playerWinAmounts.set(winner.id, share);
      }
      mainWinnerId = winners[0].id;
      winningHand = bestEval.rank;
    }

    // Build winner details
    for (const [playerId, amount] of playerWinAmounts.entries()) {
      const sp = showdownPlayers.find(s => s.playerId === playerId);
      winnerDetails.push({
        playerId,
        name: playerNames.get(playerId) || "Unknown",
        amount,
        handRank: sp?.handRank || "unknown",
        handDescription: sp?.handDescription || "Unknown",
      });
    }
  }

  // Set lastWinner for UI display (primary winner)
  // In side pot scenarios, show the player with the BEST hand (not highest amount)
  // This prevents confusion where a weaker hand appears to "win" because they won a larger side pot
  if (winnerDetails.length > 0) {
    const HAND_RANK_ORDER: Record<string, number> = {
      "royal_flush": 10, "straight_flush": 9, "four_of_a_kind": 8,
      "full_house": 7, "flush": 6, "straight": 5, "three_of_a_kind": 4,
      "two_pair": 3, "one_pair": 2, "high_card": 1, "last_standing": 0,
    };
    const primary = winnerDetails.sort((a, b) => {
      const rankDiff = (HAND_RANK_ORDER[b.handRank] || 0) - (HAND_RANK_ORDER[a.handRank] || 0);
      if (rankDiff !== 0) return rankDiff;
      return b.amount - a.amount; // tie-break by amount
    })[0];
    // Show total pot won by all winners combined for the banner
    const totalWon = winnerDetails.reduce((sum, w) => sum + w.amount, 0);
    table.lastWinner = { name: primary.name, amount: primary.amount, handDescription: primary.handDescription };
  }

  // Set settlement detail for rich UI
  table.settlementDetail = {
    winners: winnerDetails,
    sidePots: sidePotDetails,
    rakeAmount: totalRake,
    showdownPlayers,
  };

  // Record hand_players data for history
  if (table.handId) {
    for (const player of gs.players) {
      const evaluation = !player.isFolded && gs.communityCards.length >= 3
        ? gameEngine.evaluateHand(player.holeCards, gs.communityCards)
        : null;
      await db.createHandPlayer({
        handId: table.handId,
        userId: player.id,
        seatIndex: player.seatIndex,
        holeCards: JSON.stringify(player.holeCards),
        isWinner: playerWinAmounts.has(player.id),
        betAmount: (player.totalBet || 0).toFixed(2),
        winAmount: (playerWinAmounts.get(player.id) || 0).toFixed(2),
        action: player.isFolded ? "fold" : player.isAllIn ? "all_in" : "none",
      });
    }
  }

  // Update game state to completed
  table.gameState = { ...gs, phase: "completed" as any };

  // Record hand to database
  if (table.handId) {
    await db.updateGameHand(table.handId, {
      status: "completed",
      communityCards: JSON.stringify(gs.communityCards),
      potSize: gs.pot.toFixed(2),
      winnerId: mainWinnerId,
      winningHand,
      rakeAmount: totalRake.toFixed(2),
      completedAt: new Date(),
      // 保存回放数据
      actionTimeline: table.actionTimeline || [],
      playerSnapshot: table.playerSnapshot || [],
    });
  }

  // Persist ALL players' updated chip stacks to DB
  for (const player of gs.players) {
    await db.updateRoomPlayerChips(roomId, player.id, player.chips.toFixed(2));
  }

  // Tournament integration: update chips & detect eliminations
  const tournamentEngine = await import("./tournamentEngine");
  const tId = tournamentEngine.getTournamentForRoom(roomId);
  if (tId !== null) {
    for (const player of gs.players) {
      tournamentEngine.updatePlayerChips(tId, player.id, player.chips);
      if (player.chips <= 0) {
        await tournamentEngine.eliminatePlayer(tId, player.id);
      }
    }
    // Increment tournament hand count and check if totalRounds limit reached
    await tournamentEngine.incrementHandCount(tId);
  }

  // Bot system: track bot winnings/losses for daily limit
  await botManager.processBotSettlement(playerWinAmounts, gs.players.map(p => ({ id: p.id, totalBet: p.totalBet })));

  // Bot system: track hands played and rotate bots if needed
  const botUserIds = await botManager.getBotUserIds();
  const botsInThisHand = gs.players.filter(p => botUserIds.includes(p.id)).map(p => p.id);
  if (botsInThisHand.length > 0) {
    await botManager.trackBotHandAndRotate(roomId, botsInThisHand);
  }

  // Distribute agent commissions from rake (skip for tournaments)
  if (totalRake > 0 && table.handId && !isTournamentRoom) {
    try {
      // All players (including bots) participate in commission distribution
      const allPlayerIds = gs.players.map(p => p.id);
      if (allPlayerIds.length > 0) {
        await distributeAgentCommissions(totalRake, allPlayerIds, table.handId);
      }
    } catch (e) {
      console.error("[Commission] Error distributing commissions:", e);
    }
  }

  // TON On-Chain: write hand hash for high-fairness rooms (fire-and-forget)
  if (table.handId) {
    const room = await db.getRoomById(roomId);
    if (room) {
      onHandCompleted({
        handId: table.handId,
        roomId,
        fairnessLevel: room.fairnessLevel ?? "basic",
        serverSeed: gs.serverSeed ?? null,
        clientSeed: gs.clientSeed ?? null,
        deckHash: gs.deckHash ?? null,
      }).catch(e => console.error("[TON] onHandCompleted error:", e));
    }
  }

  // Trigger risk checks for all players in this hand (async, non-blocking)
  try {
    const { runRiskChecks } = await import("./riskEngine");
    for (const p of gs.players) {
      runRiskChecks(p.id, "game_settle").catch(() => {});
    }
  } catch (_) { /* risk engine not critical */ }

  // Increment playedRounds for private rooms and check if room should close
  // SKIP dissolve logic for tournament tables - they manage their own lifecycle
  const currentRoom = await db.getRoomById(roomId);
  if (currentRoom && currentRoom.type === "private" && tId === null) {
    const newPlayedRounds = (currentRoom.playedRounds ?? 0) + 1;
    await db.updateRoom(roomId, { playedRounds: newPlayedRounds });

    // Determine if this private room should auto-dissolve
    const shouldDissolve =
      // Case 1: totalRounds is set and reached
      (currentRoom.totalRounds != null && newPlayedRounds >= currentRoom.totalRounds) ||
      // Case 2: no totalRounds limit (unlimited) — dissolve after every hand
      (currentRoom.totalRounds == null);

    if (shouldDissolve) {
      // Return remaining chips to each player's balance
      const activePlayers = await db.getRoomPlayers(roomId);
      for (const rp of activePlayers) {
        const chips = parseFloat(rp.chipCount as string);
        if (chips > 0) {
          await db.addUserBalanceAtomic(rp.userId, chips);
          // Record leave_table transaction for dissolved room
          const user = await db.getUserById(rp.userId);
          if (user) {
            await db.createTransaction({
              userId: rp.userId,
              type: "leave_table",
              amount: chips.toFixed(2),
              balanceBefore: ((parseFloat(user.balance) - chips).toFixed(2)), // balance before the atomic add
              balanceAfter: user.balance,
              status: "confirmed",
              referenceType: "room",
              referenceId: roomId,
              note: `Leave table (room dissolved): ${(await db.getRoomById(roomId))?.name || 'Unknown'}`,
            });
          }
        }
      }
      // Clear all players from the room
      await db.clearRoomPlayers(roomId);
      // Invalidate the invite code and close the room
      await db.updateRoom(roomId, {
        status: "closed",
        inviteCode: null as any,
        currentPlayers: 0,
      });
      // Remove from active tables
      activeTables.delete(roomId);
      return; // Don't set up ready phase, room is dissolved
    }
  }

  // === TOURNAMENT vs REGULAR TABLE: different post-settlement behavior ===
  if (tId !== null) {
    // TOURNAMENT TABLE: Auto-start next hand after settlement delay (no ready system)
    // Players stay seated, next hand begins automatically like PokerStars
    table.waitingForReady = false;
    table.readyPlayers = new Set();
    table.settlementStartedAt = Date.now();
    
    // Auto-start next hand after 5 seconds (enough time to see settlement)
    setTimeout(async () => {
      const currentTable = activeTables.get(roomId);
      if (!currentTable) return;
      // Only proceed if this is still the same settlement cycle
      if (currentTable.settlementStartedAt !== table.settlementStartedAt) return;
      
      // Check if tournament is still active and not paused
      const te = await import("./tournamentEngine");
      const tournament = te.getActiveTournament(tId);
      if (!tournament || tournament.isFinished || tournament.isPaused) return;
      
      // Check if enough players remain at this table
      const remainingPlayers = await db.getRoomPlayers(roomId);
      const playablePlayers = remainingPlayers.filter((rp: any) => parseFloat(rp.chipCount) > 0);
      
      if (playablePlayers.length >= 2) {
        // Update blinds from tournament engine (may have increased)
        const tState = te.getTournamentState(tId);
        if (tState && tState.currentBlinds) {
          currentTable.smallBlind = tState.currentBlinds.smallBlind;
          currentTable.bigBlind = tState.currentBlinds.bigBlind;
        }
        await startNewHand(roomId);
      } else if (playablePlayers.length === 1) {
        // Only 1 player left at this table - tournament engine handles table merging
        // For now, just wait; the balance checker in tournamentEngine will handle it
      }
    }, 5000);
  } else {
    // REGULAR TABLE: Use ready system (players must click "ready" for next hand)
    // After settlement, delay showing the "ready" button so settlement UI displays first
    // Timeline: showdown reveal (4s) + winner banner (3.5s) = ~7.5s total
    // We delay 7s before enabling ready state so players can see the full result
    table.waitingForReady = false;
    table.readyPlayers = new Set();
    table.settlementStartedAt = Date.now();
    
    // Delay enabling ready state by 7 seconds (showdown animation + winner banner)
    setTimeout(() => {
      const currentTable = activeTables.get(roomId);
      if (currentTable && currentTable.settlementStartedAt === table.settlementStartedAt) {
        currentTable.waitingForReady = true;
        currentTable.readyDeadline = Date.now() + 30000; // 30 seconds to ready up
        // Bot system: auto-ready all bots after a short delay
        botManager.autoReadyBots(roomId);
      }
    }, 7000);
  }
}

/**
 * Start a new hand at a table
 */
export async function startNewHand(roomId: number) {
  const room = await db.getRoomById(roomId);
  if (!room) return;

  console.log(`[startNewHand] Called for room ${roomId}, activeTables.has=${activeTables.has(roomId)}`);

  try {
  // Activate all sitting_out players (Wait for Big Blind → now joining the game)
  await db.activateSittingOutPlayers(roomId);

  // Bot system: refill zero-chip bots before removing them
  await botManager.refillBotChips(roomId);

  // Bot system: fill bots if not enough real players
  await botManager.checkAndFillBots(roomId, true);

  const roomPlayersList = await db.getRoomPlayers(roomId);
  console.log(`[startNewHand] Room ${roomId}: ${roomPlayersList.length} active players after bot fill`);
  if (roomPlayersList.length < 2) {
    // Not enough players even after bot fill - reset table to waiting state
    // IMPORTANT: Do NOT delete activeTables here! Deleting causes getPlayerView to query DB
    // which can trigger false "kicked" detection on the frontend during async transitions.
    // Instead, set waitingForReady=true so getPlayerView returns clean state with players still visible.
    const existingTbl = activeTables.get(roomId);
    if (existingTbl) {
      existingTbl.waitingForReady = true;
      existingTbl.settlementStartedAt = undefined;
    }
    await db.updateRoom(roomId, { currentPlayers: roomPlayersList.length, status: "waiting" });
    return;
  }

  // Load tournament engine early (needed for elimination + blinds)
  const tournamentEngineModule = await import("./tournamentEngine");
  const tournamentId = tournamentEngineModule.getTournamentForRoom(roomId);

  // Remove players with 0 chips - they can't play
  const zeroChipPlayers = roomPlayersList.filter((rp: any) => parseFloat(rp.chipCount) <= 0);
  for (const zp of zeroChipPlayers) {
    // Tournament: trigger proper elimination instead of just removing
    if (tournamentId !== null) {
      await tournamentEngineModule.eliminatePlayer(tournamentId, zp.userId);
    } else {
      await db.removeRoomPlayer(roomId, zp.userId);
    }
  }
  
  // Re-fetch active players after removing zero-chip players
  // IMPORTANT: Sort by seatIndex to ensure array index matches physical seat order
  // This guarantees dealer/SB/BB rotation follows clockwise seat positions
  const activePlayers = roomPlayersList.filter((rp: any) => parseFloat(rp.chipCount) > 0)
    .sort((a: any, b: any) => a.seatIndex - b.seatIndex);
  if (activePlayers.length < 2) {
    // Not enough players to start a new hand.
    // Reset to waiting state but keep activeTables entry alive so getPlayerView
    // still returns the player list (prevents false "kicked" detection on frontend).
    const existingTbl = activeTables.get(roomId);
    if (existingTbl) {
      existingTbl.waitingForReady = true;
      existingTbl.settlementStartedAt = undefined;
    }
    // Update room player count and status
    await db.updateRoom(roomId, { currentPlayers: activePlayers.length, status: "waiting" });
    return;
  }

  const existingTable = activeTables.get(roomId);
  const handNumber = (existingTable?.handNumber ?? 0) + 1;
  const dealerIndex = handNumber % activePlayers.length;

  const players = activePlayers.map((rp: any) => ({
    id: rp.userId,
    seatIndex: rp.seatIndex,
    chips: parseFloat(rp.chipCount),
  }));

  // Generate client seed from all player IDs + timestamp
  const clientSeed = `${roomId}-${handNumber}-${Date.now()}`;

  // Determine blinds: tournament tables use dynamic blinds from tournament engine
  let effectiveSmallBlind = parseFloat(room.smallBlind);
  let effectiveBigBlind = parseFloat(room.bigBlind);
  if (tournamentId !== null) {
    const tState = tournamentEngineModule.getTournamentState(tournamentId);
    if (tState && tState.currentBlinds) {
      effectiveSmallBlind = tState.currentBlinds.smallBlind;
      effectiveBigBlind = tState.currentBlinds.bigBlind;
    }
  }

  // Initialize game
  let gameState = gameEngine.initializeGame(players, dealerIndex, clientSeed);
  gameState = gameEngine.postBlinds(gameState, effectiveSmallBlind, effectiveBigBlind);
  gameState = gameEngine.dealHoleCards(gameState);

  // Create hand record in DB
  const handId = await db.createGameHand({
    roomId,
    handNumber,
    serverSeed: gameState.serverSeed,
    serverSeedHash: gameState.serverSeedHash,
    clientSeed: gameState.clientSeed,
    deckHash: gameState.deckHash,
    status: "preflop",
    potSize: gameState.pot.toFixed(2),
  });

  // Update room status
  await db.updateRoom(roomId, { status: "playing" });

  // 构建玩家名称映射（回放用）
  const playerNames = new Map<number, string>();
  for (const p of gameState.players) {
    const info = await getCachedPlayerInfo(p.id);
    playerNames.set(p.id, info.name);
  }

  // 构建玩家快照（回放用）
  const playerSnapshotData = gameState.players.map(p => ({
    id: p.id,
    name: playerNames.get(p.id) || `Player ${p.seatIndex + 1}`,
    seatIndex: p.seatIndex,
    startChips: p.chips + p.totalBet, // 开始时筹码 = 当前筹码 + 已下注（因为已发过盲注）
    holeCards: p.holeCards,
  }));

  // 初始化操作时间线，记录盲注操作
  const initialTimeline: ActiveTable["actionTimeline"] = [];
  let seq = 0;
  // 记录小盲注
  const sbPlayerIdx = (dealerIndex + 1) % players.length;
  const bbPlayerIdx = (dealerIndex + 2) % players.length;
  const sbPlayer = gameState.players[sbPlayerIdx];
  const bbPlayer = gameState.players[bbPlayerIdx];
  if (sbPlayer) {
    initialTimeline.push({
      seq: seq++,
      phase: "preflop",
      playerId: sbPlayer.id,
      playerName: playerNames.get(sbPlayer.id) || `Player ${sbPlayer.seatIndex + 1}`,
      action: "post_blind",
      amount: effectiveSmallBlind,
      potAfter: effectiveSmallBlind,
      timestamp: Date.now(),
    });
  }
  if (bbPlayer) {
    initialTimeline.push({
      seq: seq++,
      phase: "preflop",
      playerId: bbPlayer.id,
      playerName: playerNames.get(bbPlayer.id) || `Player ${bbPlayer.seatIndex + 1}`,
      action: "post_blind",
      amount: effectiveBigBlind,
      potAfter: effectiveSmallBlind + effectiveBigBlind,
      timestamp: Date.now(),
    });
  }

  activeTables.set(roomId, {
    roomId,
    gameState,
    handId: handId ?? null,
    lastActionAt: Date.now(),
    turnTimeout: 30,
    smallBlind: effectiveSmallBlind,
    bigBlind: effectiveBigBlind,
    handNumber,
    // Clear previous winner info for new hand
    lastWinner: undefined,
    settlementDetail: undefined,
    // Reset ready system
    readyPlayers: new Set(),
    waitingForReady: false,
    readyDeadline: undefined,
    // Preserve afkFoldCount across hands (reset only on manual action)
    afkFoldCount: activeTables.get(roomId)?.afkFoldCount ?? new Map(),
    // 牌局回放数据
    actionTimeline: initialTimeline,
    playerSnapshot: playerSnapshotData,
  });
  } catch (err: any) {
    console.error(`[startNewHand] Room ${roomId}: ERROR - ${err.message}`, err.stack);
  }
}

/**
 * Auto-fold players who timeout + check ready deadlines
 */
export function checkTimeouts() {
  const now = Date.now();
  for (const [roomId, table] of activeTables.entries()) {
    // Check ready deadline - kick unready players after timeout
    if (table.waitingForReady && table.readyDeadline && now >= table.readyDeadline) {
      handleReadyTimeout(roomId);
      continue;
    }

    if (table.gameState.phase === "waiting" || table.gameState.phase === "completed") continue;
    if (table.waitingForReady) continue; // Don't auto-fold during ready phase
    if (table.gameState.phase === "showdown") continue; // Don't auto-fold during showdown (settle timer is running)
    
    // Bot system: if current player is a bot, trigger bot action (with delay)
    const currentPlayerForBot = table.gameState.players[table.gameState.currentPlayerIndex];
    if (currentPlayerForBot && !currentPlayerForBot.isFolded) {
      const elapsed0 = (now - table.lastActionAt) / 1000;
      // Only trigger bot if at least 0.3 second has passed (prevent duplicate triggers)
      if (elapsed0 >= 0.3) {
        botManager.triggerBotAction(roomId);
      }
    }

    const elapsed = (now - table.lastActionAt) / 1000;
    if (elapsed > table.turnTimeout) {
      const currentPlayer = table.gameState.players[table.gameState.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isFolded) {
        const timedOutPlayerId = currentPlayer.id;
        // Auto-Check if no bet to call (player already matched current bet), otherwise Auto-Fold
        // This matches industry standard: PokerStars / GGPoker behavior
        const canCheck = currentPlayer.currentBet >= table.gameState.currentBet;
        const timeoutAction: PlayerAction = canCheck ? "check" : "fold";
        table.gameState = gameEngine.processAction(table.gameState, timedOutPlayerId, timeoutAction);
        table.lastActionAt = now;

        // 超时操作也记录到回放时间线
        if (table.actionTimeline) {
          const pName = table.playerSnapshot?.find(p => p.id === timedOutPlayerId)?.name || `Player ${currentPlayer.seatIndex + 1}`;
          table.actionTimeline.push({
            seq: table.actionTimeline.length,
            phase: table.gameState.phase,
            playerId: timedOutPlayerId,
            playerName: pName,
            action: timeoutAction,
            amount: 0,
            potAfter: table.gameState.pot,
            timestamp: now,
          });
        }

        // === Zombie player detection: kick after 3 consecutive auto-folds (not auto-checks) ===
        const AFK_KICK_THRESHOLD = 3;
        const prevCount = table.afkFoldCount.get(timedOutPlayerId) ?? 0;
        // Only count as AFK if they actually folded (facing a bet); auto-check doesn't count
        const newCount = timeoutAction === "fold" ? prevCount + 1 : prevCount;
        table.afkFoldCount.set(timedOutPlayerId, newCount);

        if (newCount >= AFK_KICK_THRESHOLD) {
          // Tournament tables: don't kick AFK players, just keep auto-folding them
          // In tournaments, players can only be eliminated by losing all chips
          const tournamentMod = getTournamentMod();
          if (tournamentMod?.isTournamentTable(roomId)) {
            table.afkFoldCount.set(timedOutPlayerId, 0);
            checkAndAdvanceGame(roomId);
            continue;
          }
          // Kick the zombie player synchronously to avoid race conditions
          table.afkFoldCount.delete(timedOutPlayerId);
          const playerInGame = table.gameState.players.find(p => p.id === timedOutPlayerId);
          const chipsToReturn = playerInGame?.chips ?? 0;
          // Remove from in-memory gameState SYNCHRONOUSLY with index fix
          const removeIdx = table.gameState.players.findIndex(p => p.id === timedOutPlayerId);
          if (removeIdx !== -1) {
            if (table.gameState.currentPlayerIndex > removeIdx) {
              table.gameState.currentPlayerIndex--;
            } else if (table.gameState.currentPlayerIndex === removeIdx) {
              // Will point to next player after splice
            }
            table.gameState.players.splice(removeIdx, 1);
            if (table.gameState.players.length > 0) {
              if (table.gameState.currentPlayerIndex >= table.gameState.players.length) {
                table.gameState.currentPlayerIndex = table.gameState.currentPlayerIndex % table.gameState.players.length;
              }
            } else {
              table.gameState.currentPlayerIndex = -1;
            }
          }
          // Async DB cleanup (fire-and-forget, game state already consistent)
          (async () => {
            try {
              // Track bot leaving for seat management
              const isBotPlayer = await botManager.isBot(timedOutPlayerId);
              if (isBotPlayer) {
                botManager.onBotLeftTable(roomId, timedOutPlayerId);
              }
              // All players (including bots) get balance returned and transaction recorded
              const user = await db.getUserById(timedOutPlayerId);
              if (user && chipsToReturn > 0) {
                const balanceBefore = user.balance;
                const newBalance = await db.addUserBalanceAtomic(timedOutPlayerId, chipsToReturn);
                const room = await db.getRoomById(roomId);
                await db.createTransaction({
                  userId: timedOutPlayerId,
                  type: "leave_table",
                  amount: chipsToReturn.toFixed(2),
                  balanceBefore,
                  balanceAfter: newBalance || balanceBefore,
                  status: "confirmed",
                  referenceType: "room",
                  referenceId: roomId,
                  note: `Leave table (AFK kicked): ${room?.name || 'Unknown'}`,
                });
              } else if (user) {
                const room = await db.getRoomById(roomId);
                await db.createTransaction({
                  userId: timedOutPlayerId,
                  type: "leave_table",
                  amount: "0.00",
                  balanceBefore: user.balance,
                  balanceAfter: user.balance,
                  status: "confirmed",
                  referenceType: "room",
                  referenceId: roomId,
                  note: `Leave table (AFK kicked): ${room?.name || 'Unknown'}`,
                });
              }
              await db.removeRoomPlayer(roomId, timedOutPlayerId);
              const remaining = await db.getRoomPlayers(roomId);
              await db.updateRoom(roomId, { currentPlayers: remaining.length });
            } catch (e) { /* non-critical */ }
          })();
        }

        checkAndAdvanceGame(roomId);
        // Notify the timed-out player via Bot (only on timeout, not on normal actions)
        db.getRoomById(roomId).then(room => {
          const roomName = room?.name || `Room #${roomId}`;
          notifyTurnAction(timedOutPlayerId, roomName, 0).catch(() => {});
        }).catch(() => {});
      }
    }
  }
}

/**
 * Handle ready timeout - remove unready players and start if enough remain
 */
async function handleReadyTimeout(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;

  // Tournament tables should NEVER use the ready system or kick players
  const tournamentEngine = await import("./tournamentEngine");
  if (tournamentEngine.isTournamentTable(roomId)) {
    // Reset ready state and auto-start next hand instead
    table.waitingForReady = false;
    table.readyDeadline = undefined;
    const remainingPlayers = await db.getRoomPlayers(roomId);
    if (remainingPlayers.length >= 2) {
      await startNewHand(roomId);
    }
    return;
  }

  const gs = table.gameState;
  const allPlayerIds = gs.players.map(p => p.id);
  const unreadyPlayers = allPlayerIds.filter(id => !table.readyPlayers.has(id));

  // Remove unready players from the room (return chips to balance)
  for (const playerId of unreadyPlayers) {
    const player = gs.players.find(p => p.id === playerId);
    if (player) {
      // Track bot leaving for seat management
      const isBotPlayer = (await botManager.getBotUserIds()).includes(playerId);
      if (isBotPlayer) {
        botManager.onBotLeftTable(roomId, playerId);
      }
      // All players (including bots) get balance returned and transaction recorded
      const user = await db.getUserById(playerId);
      if (user && player.chips > 0) {
        const balanceBefore = user.balance;
        const newBalance = await db.addUserBalanceAtomic(playerId, player.chips);
        // Record leave_table transaction
        const room = await db.getRoomById(roomId);
        await db.createTransaction({
          userId: playerId,
          type: "leave_table",
          amount: player.chips.toFixed(2),
          balanceBefore,
          balanceAfter: newBalance || balanceBefore,
          status: "confirmed",
          referenceType: "room",
          referenceId: roomId,
          note: `Leave table (not ready): ${room?.name || 'Unknown'}`,
        });
      } else if (user && player.chips === 0) {
        const room = await db.getRoomById(roomId);
        await db.createTransaction({
          userId: playerId,
          type: "leave_table",
          amount: "0.00",
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          status: "confirmed",
          referenceType: "room",
          referenceId: roomId,
          note: `Leave table (not ready): ${room?.name || 'Unknown'}`,
        });
      }
      await db.removeRoomPlayer(roomId, playerId);
    }
  }

  // Also remove unready players from in-memory gameState to keep it in sync
  table.gameState.players = gs.players.filter(p => !unreadyPlayers.includes(p.id));

  // Update room player count
  const remaining = await db.getRoomPlayers(roomId);
  await db.updateRoom(roomId, { currentPlayers: remaining.length });

  // If enough ready players remain, start new hand
  if (remaining.length >= 2) {
    table.waitingForReady = false;
    table.readyDeadline = undefined;
    await startNewHand(roomId);
  } else {
    // Not enough players, clean up table
    activeTables.delete(roomId);
    await db.updateRoom(roomId, { status: "waiting" });
  }
}

/**
 * Player clicks "ready" for next hand
 */
export async function playerReady(roomId: number, userId: number): Promise<{ success: boolean; message?: string }> {
  const table = activeTables.get(roomId);
  
  // If no active table exists (waiting state), try to start a new game
  if (!table) {
    const players = await db.getRoomPlayers(roomId);
    if (players.length >= 2) {
      await startNewHand(roomId);
      return { success: true };
    }
    return { success: false, message: "Need at least 2 players" };
  }
  
  if (!table.waitingForReady) return { success: false, message: "Not in ready phase" };

  table.readyPlayers.add(userId);

  // Check if all players are ready
  const gs = table.gameState;
  const activePlayers = gs.players.filter(p => p.isActive);
  const allReady = activePlayers.every(p => table.readyPlayers.has(p.id));

  if (allReady && activePlayers.length >= 2) {
    // All players ready - start next hand immediately
    table.waitingForReady = false;
    table.readyDeadline = undefined;
    await startNewHand(roomId);
  }

  return { success: true };
}

// Run timeout checker every 1 second for faster bot responsiveness
setInterval(checkTimeouts, 1000);

// Bot余额监控：每5分钟检查一次
setInterval(() => {
  botManager.checkBotBalances().catch(e => console.error("[BotManager] Balance check error:", e));
}, 300000);

// 长期在线Bot调度器：每30秒检查并补充bot到目标数量
setInterval(() => {
  botManager.persistentBotScheduler().catch(e => console.error("[BotManager] Persistent scheduler error:", e));
}, 30000);

/**
 * Notify the next player that it's their turn via Telegram
 */
async function notifyNextPlayer(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;
  const gs = table.gameState;
  if (gs.phase === "waiting" || gs.phase === "completed") return;

  const currentPlayer = gs.players[gs.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.isFolded || currentPlayer.isAllIn) return;

  const room = await db.getRoomById(roomId);
  const roomName = room?.name || `Room #${roomId}`;
  const timeLeft = table.turnTimeout;

  // Send notification (non-blocking, fire-and-forget)
  notifyTurnAction(currentPlayer.id, roomName, timeLeft);
}

/**
 * Distribute agent commissions from rake to agents of players at the table
 * For each player, check if they have an agent (level 1 and level 2)
 * and distribute commission based on configured rates from database
 */
async function distributeAgentCommissions(totalRake: number, playerIds: number[], handId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { agentRelationships, commissionRecords } = await import("../drizzle/schema");
  const { eq, and, inArray } = await import("drizzle-orm");
  
  // Get commission rates from database
  const level1Rate = parseFloat(await db.getConfigValue("agent_level1_rate", "10")) / 100;
  const level2Rate = parseFloat(await db.getConfigValue("agent_level2_rate", "5")) / 100;
  
  // Per-player rake share (evenly split for simplicity)
  const perPlayerRake = totalRake / playerIds.length;
  
  // Find all agent relationships for players at this table
  const relationships = await dbInstance.select()
    .from(agentRelationships)
    .where(inArray(agentRelationships.downlineId, playerIds));
  
  if (relationships.length === 0) return;

  for (const rel of relationships) {
    // Only distribute if the downline is unlocked
    if (!rel.isUnlocked) {
      // Update unlock progress (increment gamesPlayed)
      const progress = typeof rel.unlockProgress === "string" 
        ? JSON.parse(rel.unlockProgress) 
        : (rel.unlockProgress ?? { gamesPlayed: 0, totalDeposit: 0, totalRake: 0 });
      progress.gamesPlayed = (progress.gamesPlayed ?? 0) + 1;
      progress.totalRake = parseFloat((parseFloat(progress.totalRake || "0") + perPlayerRake).toFixed(2));
      
      // Check if unlock conditions are met (gamesPlayed >= 20 AND totalRake >= 1)
      const shouldUnlock = progress.gamesPlayed >= 20 && 
        parseFloat(progress.totalRake || "0") >= 1;
      
      await dbInstance.update(agentRelationships)
        .set({ 
          unlockProgress: JSON.stringify(progress),
          ...(shouldUnlock ? { isUnlocked: true, unlockedAt: new Date() } : {}),
        })
        .where(eq(agentRelationships.id, rel.id));
      
      // Even if not unlocked, record pending commission so agent can see potential earnings
      const pendingRate = rel.level === 1 ? level1Rate : level2Rate;
      const pendingAmount = perPlayerRake * pendingRate;
      if (pendingAmount > 0) {
        await dbInstance.insert(commissionRecords).values({
          agentId: rel.agentId,
          downlineId: rel.downlineId,
          handId,
          level: rel.level,
          rakeAmount: perPlayerRake.toFixed(2),
          commissionRate: (pendingRate * 100).toFixed(2),
          commissionAmount: pendingAmount.toFixed(2),
          status: "pending",
        });
      }
      
      // If just unlocked, settle all pending commissions
      if (shouldUnlock) {
        const pendingRecords = await dbInstance.select()
          .from(commissionRecords)
          .where(and(
            eq(commissionRecords.agentId, rel.agentId),
            eq(commissionRecords.downlineId, rel.downlineId),
            eq(commissionRecords.status, "pending")
          ));
        let totalPending = 0;
        for (const pr of pendingRecords) {
          totalPending += parseFloat(pr.commissionAmount ?? "0");
        }
        if (totalPending > 0) {
          await db.addUserBalanceAtomic(rel.agentId, totalPending);
          const currentEarned = parseFloat(rel.totalCommissionEarned ?? "0");
          await dbInstance.update(agentRelationships)
            .set({ totalCommissionEarned: (currentEarned + totalPending).toFixed(2) })
            .where(eq(agentRelationships.id, rel.id));
        }
        // Mark all pending as settled
        await dbInstance.update(commissionRecords)
          .set({ status: "settled" })
          .where(and(
            eq(commissionRecords.agentId, rel.agentId),
            eq(commissionRecords.downlineId, rel.downlineId),
            eq(commissionRecords.status, "pending")
          ));
      }
      continue;
    }
    
    // Calculate commission based on level
    const rate = rel.level === 1 ? level1Rate : level2Rate;
    const commissionAmount = perPlayerRake * rate;
    
    if (commissionAmount <= 0) continue;
    
    // Insert commission record
    await dbInstance.insert(commissionRecords).values({
      agentId: rel.agentId,
      downlineId: rel.downlineId,
      handId,
      level: rel.level,
      rakeAmount: perPlayerRake.toFixed(2),
      commissionRate: (rate * 100).toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      status: "settled",
    });
    
    // Update agent's balance atomically (add commission to current balance)
    await db.addUserBalanceAtomic(rel.agentId, commissionAmount);
    
    // Update totalCommissionEarned in agent_relationships
    const currentEarned = parseFloat(rel.totalCommissionEarned ?? "0");
    await dbInstance.update(agentRelationships)
      .set({ totalCommissionEarned: (currentEarned + commissionAmount).toFixed(2) })
      .where(eq(agentRelationships.id, rel.id));
    // TG notification to agent about commission earned
    const { notifyCommissionEarned } = await import("./notifications");
    notifyCommissionEarned(rel.agentId, commissionAmount.toFixed(2)).catch(() => {});
  }
}

// === Rebuy Functions ===

/** Get player's current chips at the table (returns -1 if not seated) */
export async function getPlayerChips(roomId: number, userId: number): Promise<number> {
  const table = activeTables.get(roomId);
  if (table) {
    const player = table.gameState.players.find(p => p.id === userId);
    if (player) return player.chips;
  }
  // Check room_players table
  const roomPlayersList = await db.getRoomPlayers(roomId);
  const rp = roomPlayersList.find((p: any) => p.userId === userId && p.status === "active");
  if (rp) return parseFloat(rp.chipCount);
  return -1; // Not seated
}

/** Check if player can rebuy (only between hands, not during active play) */
export async function canPlayerRebuy(roomId: number, userId: number): Promise<boolean> {
  const table = activeTables.get(roomId);
  if (!table) return true; // No active game = waiting state, can rebuy

  // If game is in waitingForReady state, allow rebuy
  if (table.waitingForReady) return true;

  // If there's an active game in progress, cannot rebuy
  const gs = table.gameState;
  const player = gs.players.find(p => p.id === userId);
  if (!player) return true; // Player not in current hand (maybe just joined)

  // Cannot rebuy during active hand
  return false;
}

/** Add chips to a player at the table */
export async function addPlayerChips(roomId: number, userId: number, amount: number): Promise<void> {
  // Update room_players table
  const roomPlayersList = await db.getRoomPlayers(roomId);
  const rp = roomPlayersList.find((p: any) => p.userId === userId && p.status === "active");
  if (rp) {
    const newChips = (parseFloat(rp.chipCount) + amount).toFixed(2);
    await db.updateRoomPlayerChips(roomId, userId, newChips);
  }

  // Update in-memory game state if active
  const table = activeTables.get(roomId);
  if (table) {
    const player = table.gameState.players.find(p => p.id === userId);
    if (player) {
      player.chips += amount;
    }
  }
}

/** Auto-rebuy: check if player needs auto-rebuy and execute it */
export async function processAutoRebuy(roomId: number, userId: number, threshold: number, targetAmount: number): Promise<{ success: boolean; added?: number }> {
  const currentChips = await getPlayerChips(roomId, userId);
  if (currentChips < 0 || currentChips >= threshold) return { success: false };

  const canDo = await canPlayerRebuy(roomId, userId);
  if (!canDo) return { success: false };

  const user = await db.getUserById(userId);
  if (!user) return { success: false };

  const balance = parseFloat(user.balance);
  const needed = targetAmount - currentChips;
  if (needed <= 0 || balance < needed) return { success: false };

  // Check max buy-in limit
  const room = await db.getRoomById(roomId);
  if (room) {
    const maxBuyIn = parseFloat(room.maxBuyIn);
    if (currentChips + needed > maxBuyIn) return { success: false };
  }

  // Execute rebuy atomically
  const deducted = await db.deductUserBalanceAtomic(userId, needed);
  if (deducted === null) return { success: false };
  await addPlayerChips(roomId, userId, needed);

  return { success: true, added: needed };
}

/**
 * Remove a table from activeTables (used by tournament engine when force-finishing)
 */
export function removeActiveTable(roomId: number): void {
  activeTables.delete(roomId);
}


/**
 * Get online player statistics per room (real players + bots)
 * Returns total online count and per-room breakdown
 */
export function getOnlineStats(): { total: number; rooms: Array<{ roomId: number; players: number }> } {
  let total = 0;
  const rooms: Array<{ roomId: number; players: number }> = [];
  for (const [roomId, table] of activeTables) {
    const playerCount = table.gameState.players.length;
    total += playerCount;
    rooms.push({ roomId, players: playerCount });
  }
  return { total, rooms };
}
