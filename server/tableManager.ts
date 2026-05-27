/**
 * Table Manager - In-memory game state management for HTTP polling mode
 * Manages active tables, player actions, and game flow without WebSocket
 */
import * as gameEngine from "./gameEngine";
import * as db from "./db";
import { notifyTurnAction } from "./notifications";
import type { GameState, PlayerAction, Card } from "./gameEngine";

interface SettlementDetail {
  winners: { playerId: number; name: string; amount: number; handRank: string; handDescription: string }[];
  sidePots: { amount: number; winnerId: number; winnerName: string }[];
  rakeAmount: number;
  showdownPlayers: { playerId: number; name: string; holeCards: string[]; handRank: string; handDescription: string }[];
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
    const waitingPlayers = [];
    for (const sp of seatedPlayers) {
      const user = await db.getUserById(sp.userId);
      waitingPlayers.push({
        id: sp.userId,
        seatIndex: sp.seatIndex,
        chips: parseFloat(sp.chipCount || "0"),
        currentBet: 0,
        totalBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: true,
        name: user?.nickname || user?.name || `Player ${sp.seatIndex + 1}`,
        avatar: user?.avatar || null,
        holeCards: [],
      });
    }
    return { phase: "waiting", players: waitingPlayers, communityCards: [], pot: 0, currentBet: 0, currentPlayerIndex: -1, myCards: [] };
  }

  const gs = table.gameState;
  const myPlayer = gs.players.find(p => p.id === playerId);
  const myCards = myPlayer?.holeCards || [];

  // Fetch player names and avatars from DB
  const playerInfo = new Map<number, { name: string; avatar: string | null }>();
  for (const p of gs.players) {
    const user = await db.getUserById(p.id);
    playerInfo.set(p.id, { name: user?.name || `Player ${p.seatIndex + 1}`, avatar: user?.avatar || null });
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
    holeCards: (p.id === playerId)
      ? p.holeCards  // Always show own cards
      : (gs.phase === "showdown" || gs.phase === "completed")
        ? p.holeCards  // Show opponent cards only at showdown
        : [],          // Hide opponent cards during active betting rounds
  }));

  return {
    phase: gs.phase,
    players,
    communityCards: gs.communityCards,
    pot: gs.pot,
    currentBet: gs.currentBet,
    currentPlayerIndex: gs.currentPlayerIndex,
    currentPlayerId: gs.currentPlayerIndex >= 0 ? gs.players[gs.currentPlayerIndex]?.id : null,
    dealerIndex: gs.dealerIndex,
    myCards,
    handNumber: table.handNumber,
    serverSeedHash: gs.serverSeedHash,
    lastActionAt: table.lastActionAt,
    turnTimeout: table.turnTimeout,
    lastWinner: table.lastWinner || null,
    settlementDetail: table.settlementDetail || null,
    // Ready system
    waitingForReady: table.waitingForReady,
    readyPlayers: Array.from(table.readyPlayers),
    readyDeadline: table.readyDeadline || null,
    readyCountdown: table.readyDeadline ? Math.max(0, Math.ceil((table.readyDeadline - Date.now()) / 1000)) : null,
    // Last action info for voice announcements
    lastActionInfo: (table as any).lastActionInfo || null,
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

  const existingPlayers = await db.getRoomPlayers(roomId);
  
  // Check if already seated at THIS table
  const alreadySeated = existingPlayers.find((p: any) => p.userId === userId);
  if (alreadySeated) {
    return { success: true, seatIndex: alreadySeated.seatIndex, message: "Already seated" };
  }

  // Check if player is already seated at ANOTHER table - one account, one active game at a time
  const activeRoom = await db.getPlayerActiveRoom(userId);
  if (activeRoom && activeRoom.roomId !== roomId) {
    // Reject: same account cannot be in two different games simultaneously
    return { success: false, seatIndex: -1, message: "Already in another game. Please leave your current table first." };
  }

  // Check max players
  if (existingPlayers.length >= room.maxPlayers) {
    return { success: false, seatIndex: -1, message: "Table is full" };
  }

  // Find next available seat
  const takenSeats = new Set(existingPlayers.map((p: any) => p.seatIndex));
  let seatIndex = -1;
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!takenSeats.has(i)) {
      seatIndex = i;
      break;
    }
  }

  if (seatIndex === -1) {
    return { success: false, seatIndex: -1, message: "No available seats" };
  }

  // Add player to room
  await db.addRoomPlayer(roomId, userId, seatIndex, buyIn.toString());
  
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
export async function leaveTable(roomId: number, userId: number): Promise<{ success: boolean; remainingChips: number }> {
  const table = activeTables.get(roomId);
  let remainingChips = 0;

  // Get the player's current chip count BEFORE any modifications
  if (table) {
    const player = table.gameState.players.find(p => p.id === userId);
    if (player) {
      remainingChips = player.chips;
    }
  } else {
    // No active game, get from DB
    const roomPlayers = await db.getRoomPlayers(roomId);
    const myPlayer = roomPlayers.find((p: any) => p.userId === userId && p.status === "active");
    if (myPlayer) {
      remainingChips = parseFloat(myPlayer.chipCount);
    }
  }

  // If game is active, fold the player first
  if (table) {
    const playerIndex = table.gameState.players.findIndex(p => p.id === userId);
    if (playerIndex !== -1 && !table.gameState.players[playerIndex].isFolded) {
      table.gameState = gameEngine.processAction(table.gameState, userId, "fold");
      await checkAndAdvanceGame(roomId);
    }
    // Remove player from in-memory game state
    table.gameState.players = table.gameState.players.filter(p => p.id !== userId);
  }

  await db.removeRoomPlayer(roomId, userId);
  
  // Update player count
  const remaining = await db.getRoomPlayers(roomId);
  await db.updateRoom(roomId, { currentPlayers: remaining.length });

  // If less than 2 players, end the table
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
  if (gs.phase === "waiting" || gs.phase === "completed") {
    return { success: false, message: "Game is not in an active betting phase" };
  }

  // Verify it's this player's turn
  const currentPlayer = gs.players[gs.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== userId) {
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
  // Record last action for voice announcement on other clients
  (table as any).lastActionInfo = {
    playerId: userId,
    playerName: `Player ${currentPlayer.seatIndex + 1}`,
    action,
    amount: amount || 0,
    timestamp: Date.now(),
  };

  // Check if betting round is complete and advance game
  await checkAndAdvanceGame(roomId);

  // NOTE: Do NOT notify next player here - notifications are only sent on timeout auto-fold
  return { success: true };
}

/**
 * Check if betting round is complete and advance game phases
 */
async function checkAndAdvanceGame(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;

  const gs = table.gameState;

  // Check if hand is complete (only 1 player left or showdown)
  if (gameEngine.isHandComplete(gs)) {
    await settleHand(roomId);
    return;
  }

  // Check if betting round is complete
  if (gameEngine.isBettingRoundComplete(gs)) {
    table.gameState = gameEngine.advancePhase(gs);
    table.lastActionAt = Date.now();

    // After advancing, check again if hand is complete
    if (gameEngine.isHandComplete(table.gameState)) {
      await settleHand(roomId);
      return;
    }

    // If all remaining players are all-in, schedule delayed phase advances
    // so the frontend can show each community card stage with animation
    const activePlayers = gameEngine.getActivePlayers(table.gameState);
    const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn);
    if (playersWhoCanAct.length <= 1 && !gameEngine.isHandComplete(table.gameState)) {
      // Schedule sequential phase advances with delays for visual effect
      scheduleAllInAdvance(roomId);
    }
  }
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

    if (gameEngine.isHandComplete(table.gameState)) {
      await settleHand(roomId);
      return;
    }

    if (gameEngine.isBettingRoundComplete(table.gameState)) {
      table.gameState = gameEngine.advancePhase(table.gameState);
      table.lastActionAt = Date.now();

      if (gameEngine.isHandComplete(table.gameState)) {
        await settleHand(roomId);
        return;
      }

      // Check if still need to advance (all players still all-in)
      const activePlayers = gameEngine.getActivePlayers(table.gameState);
      const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn);
      if (playersWhoCanAct.length <= 1 && !gameEngine.isHandComplete(table.gameState)) {
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
    playerNames.set(p.id, user?.name || `Player ${p.seatIndex + 1}`);
  }

  // Get system config for rake
  const rakeConfig = await db.getConfig("rake_percentage");
  const rakeCapConfig = await db.getConfig("rake_cap");
  const rakePercent = rakeConfig ? parseFloat(rakeConfig.value) : 5;
  const rakeCap = rakeCapConfig ? parseFloat(rakeCapConfig.value) : 3;

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
  if (winnerDetails.length > 0) {
    const primary = winnerDetails.sort((a, b) => b.amount - a.amount)[0];
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
    });
  }

  // Persist ALL players' updated chip stacks to DB
  for (const player of gs.players) {
    await db.updateRoomPlayerChips(roomId, player.id, player.chips.toFixed(2));
  }

  // Distribute agent commissions from rake
  if (totalRake > 0 && table.handId) {
    try {
      await distributeAgentCommissions(totalRake, gs.players.map(p => p.id), table.handId);
    } catch (e) {
      console.error("[Commission] Error distributing commissions:", e);
    }
  }

  // Increment playedRounds for private rooms and check if room should close
  const currentRoom = await db.getRoomById(roomId);
  if (currentRoom && currentRoom.type === "private") {
    const newPlayedRounds = (currentRoom.playedRounds ?? 0) + 1;
    await db.updateRoom(roomId, { playedRounds: newPlayedRounds });
    // If totalRounds is set and reached, close the room (inviteCode becomes invalid)
    if (currentRoom.totalRounds && newPlayedRounds >= currentRoom.totalRounds) {
      await db.updateRoom(roomId, { status: "closed" });
      // Remove from active tables
      activeTables.delete(roomId);
      return; // Don't set up ready phase, room is done
    }
  }

  // After settlement, delay showing the "ready" button so settlement UI displays first
  // Settlement display takes ~3.5s on frontend, so we delay 4s before enabling ready state
  table.waitingForReady = false;
  table.readyPlayers = new Set();
  table.settlementStartedAt = Date.now();
  
  // Delay enabling ready state by 4 seconds (after settlement animation completes)
  setTimeout(() => {
    const currentTable = activeTables.get(roomId);
    if (currentTable && currentTable.settlementStartedAt === table.settlementStartedAt) {
      currentTable.waitingForReady = true;
      currentTable.readyDeadline = Date.now() + 30000; // 30 seconds to ready up
    }
  }, 4000);
}

/**
 * Start a new hand at a table
 */
async function startNewHand(roomId: number) {
  const room = await db.getRoomById(roomId);
  if (!room) return;

  const roomPlayersList = await db.getRoomPlayers(roomId);
  if (roomPlayersList.length < 2) return;

  // Remove players with 0 chips - they can't play
  const zeroChipPlayers = roomPlayersList.filter((rp: any) => parseFloat(rp.chipCount) <= 0);
  for (const zp of zeroChipPlayers) {
    await db.removeRoomPlayer(roomId, zp.userId);
  }
  
  // Re-fetch active players after removing zero-chip players
  const activePlayers = roomPlayersList.filter((rp: any) => parseFloat(rp.chipCount) > 0);
  if (activePlayers.length < 2) {
    // Update room player count
    await db.updateRoom(roomId, { currentPlayers: activePlayers.length });
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

  // Initialize game
  let gameState = gameEngine.initializeGame(players, dealerIndex, clientSeed);
  gameState = gameEngine.postBlinds(gameState, parseFloat(room.smallBlind), parseFloat(room.bigBlind));
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

  activeTables.set(roomId, {
    roomId,
    gameState,
    handId: handId ?? null,
    lastActionAt: Date.now(),
    turnTimeout: 30,
    smallBlind: parseFloat(room.smallBlind),
    bigBlind: parseFloat(room.bigBlind),
    handNumber,
    // Clear previous winner info for new hand
    lastWinner: undefined,
    settlementDetail: undefined,
    // Reset ready system
    readyPlayers: new Set(),
    waitingForReady: false,
    readyDeadline: undefined,
  });
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
    
    const elapsed = (now - table.lastActionAt) / 1000;
    if (elapsed > table.turnTimeout) {
      const currentPlayer = table.gameState.players[table.gameState.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isFolded) {
        const timedOutPlayerId = currentPlayer.id;
        // Auto-fold on timeout
        table.gameState = gameEngine.processAction(table.gameState, timedOutPlayerId, "fold");
        table.lastActionAt = now;
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

  const gs = table.gameState;
  const allPlayerIds = gs.players.map(p => p.id);
  const unreadyPlayers = allPlayerIds.filter(id => !table.readyPlayers.has(id));

  // Remove unready players from the room (return chips to balance)
  for (const playerId of unreadyPlayers) {
    const player = gs.players.find(p => p.id === playerId);
    if (player) {
      // Return remaining chips to balance
      const user = await db.getUserById(playerId);
      if (user) {
        const newBalance = (parseFloat(user.balance) + player.chips).toFixed(2);
        await db.updateUserBalance(playerId, newBalance);
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

// Run timeout checker every 5 seconds
setInterval(checkTimeouts, 5000);

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
      
      // Check if unlock conditions are met
      const shouldUnlock = progress.gamesPlayed >= 20 && 
        parseFloat(progress.totalDeposit || "0") >= 10 && 
        parseFloat(progress.totalRake || "0") >= 1;
      
      await dbInstance.update(agentRelationships)
        .set({ 
          unlockProgress: JSON.stringify(progress),
          ...(shouldUnlock ? { isUnlocked: true, unlockedAt: new Date() } : {}),
        })
        .where(eq(agentRelationships.id, rel.id));
      
      continue; // Don't distribute commission until unlocked
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
    
    // Update agent's balance (add commission to current balance)
    const agent = await db.getUserById(rel.agentId);
    if (agent) {
      const newBalance = (parseFloat(agent.balance ?? "0") + commissionAmount).toFixed(2);
      await db.updateUserBalance(rel.agentId, newBalance);
    }
    
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

  // Execute rebuy
  const newBalance = (balance - needed).toFixed(2);
  await db.updateUserBalance(userId, newBalance);
  await addPlayerChips(roomId, userId, needed);

  return { success: true, added: needed };
}
