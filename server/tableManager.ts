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
    // Auto-recover: if 2+ active players exist but no game running, start one
    const activePlayers = await db.getRoomPlayers(roomId);
    if (activePlayers.length >= 2) {
      await startNewHand(roomId);
      table = activeTables.get(roomId);
    }
    if (!table) {
      return { phase: "waiting", players: [], communityCards: [], pot: 0, currentBet: 0, currentPlayerIndex: -1, myCards: [] };
    }
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
    // Only reveal cards in showdown or for the requesting player
    holeCards: (gs.phase === "showdown" || gs.phase === "completed" || p.id === playerId)
      ? p.holeCards
      : [],
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
  
  // Check if already seated
  const alreadySeated = existingPlayers.find((p: any) => p.userId === userId);
  if (alreadySeated) {
    return { success: true, seatIndex: alreadySeated.seatIndex, message: "Already seated" };
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
    const minRaise = gs.currentBet * 2;
    if (amount < minRaise && amount < currentPlayer.chips) {
      return { success: false, message: `Minimum raise is ${minRaise}` };
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

  // Check if betting round is complete and advance game
  await checkAndAdvanceGame(roomId);

  // Notify next player it's their turn (async, non-blocking)
  notifyNextPlayer(roomId).catch(() => {});

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
    }
  }
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
  const rakeConfig = await db.getConfig("rake_percent");
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
      completedAt: new Date(),
    });
  }

  // Persist ALL players' updated chip stacks to DB
  for (const player of gs.players) {
    await db.updateRoomPlayerChips(roomId, player.id, player.chips.toFixed(2));
  }

  // Schedule next hand after a delay (5 seconds for settlement viewing)
  setTimeout(async () => {
    const currentPlayers = await db.getRoomPlayers(roomId);
    if (currentPlayers.length >= 2) {
      await startNewHand(roomId);
    } else {
      activeTables.delete(roomId);
    }
  }, 5000);
}

/**
 * Start a new hand at a table
 */
async function startNewHand(roomId: number) {
  const room = await db.getRoomById(roomId);
  if (!room) return;

  const roomPlayersList = await db.getRoomPlayers(roomId);
  if (roomPlayersList.length < 2) return;

  const existingTable = activeTables.get(roomId);
  const handNumber = (existingTable?.handNumber ?? 0) + 1;
  const dealerIndex = handNumber % roomPlayersList.length;

  const players = roomPlayersList.map((rp: any) => ({
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
  });
}

/**
 * Auto-fold players who timeout
 */
export function checkTimeouts() {
  const now = Date.now();
  for (const [roomId, table] of activeTables.entries()) {
    if (table.gameState.phase === "waiting" || table.gameState.phase === "completed") continue;
    
    const elapsed = (now - table.lastActionAt) / 1000;
    if (elapsed > table.turnTimeout) {
      const currentPlayer = table.gameState.players[table.gameState.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isFolded) {
        // Auto-fold on timeout
        table.gameState = gameEngine.processAction(table.gameState, currentPlayer.id, "fold");
        table.lastActionAt = now;
        checkAndAdvanceGame(roomId);
      }
    }
  }
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
