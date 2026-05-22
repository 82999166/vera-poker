/**
 * Table Manager - In-memory game state management for HTTP polling mode
 * Manages active tables, player actions, and game flow without WebSocket
 */
import * as gameEngine from "./gameEngine";
import * as db from "./db";
import type { GameState, PlayerAction, Card } from "./gameEngine";

interface ActiveTable {
  roomId: number;
  gameState: GameState;
  handId: number | null;
  lastActionAt: number;
  turnTimeout: number; // seconds
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
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
export function getPlayerView(roomId: number, playerId: number) {
  const table = activeTables.get(roomId);
  if (!table) {
    return { phase: "waiting", players: [], communityCards: [], pot: 0, currentBet: 0, currentPlayerIndex: -1, myCards: [] };
  }

  const gs = table.gameState;
  const myPlayer = gs.players.find(p => p.id === playerId);
  const myCards = myPlayer?.holeCards || [];

  const players = gs.players.map(p => ({
    id: p.id,
    seatIndex: p.seatIndex,
    chips: p.chips,
    currentBet: p.currentBet,
    totalBet: p.totalBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
    isActive: p.isActive,
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
 * Settle the hand - determine winner, distribute pot, record to DB
 */
async function settleHand(roomId: number) {
  const table = activeTables.get(roomId);
  if (!table) return;

  const gs = table.gameState;
  const activePlayers = gameEngine.getActivePlayers(gs);

  let winnerId: number | undefined;
  let winningHand = "";

  if (activePlayers.length === 1) {
    // Last player standing wins
    winnerId = activePlayers[0].id;
    winningHand = "last_standing";
  } else {
    // Showdown - evaluate hands
    let bestEval: any = null;
    for (const player of activePlayers) {
      const evaluation = gameEngine.evaluateHand(player.holeCards, gs.communityCards);
      if (!bestEval || gameEngine.compareHands(evaluation, bestEval) > 0) {
        bestEval = evaluation;
        winnerId = player.id;
        winningHand = evaluation.rank;
      }
    }
  }

  // Award pot to winner
  if (winnerId) {
    const winnerIdx = gs.players.findIndex(p => p.id === winnerId);
    if (winnerIdx !== -1) {
      gs.players[winnerIdx].chips += gs.pot;
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
      winnerId,
      winningHand,
      completedAt: new Date(),
    });
  }

  // Persist ALL players' updated chip stacks to DB (not just winner)
  for (const player of gs.players) {
    await db.updateRoomPlayerChips(roomId, player.id, player.chips.toFixed(2));
  }

  // Schedule next hand after a delay (3 seconds)
  setTimeout(async () => {
    const currentPlayers = await db.getRoomPlayers(roomId);
    if (currentPlayers.length >= 2) {
      await startNewHand(roomId);
    } else {
      activeTables.delete(roomId);
    }
  }, 3000);
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
