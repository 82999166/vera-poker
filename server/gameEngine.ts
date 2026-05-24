/**
 * Vera Poker - Texas Hold'em Game Engine
 * Complete state machine for dealing, betting rounds, and settlement
 */
import crypto from "crypto";

// ==================== TYPES ====================
export type Suit = "h" | "d" | "c" | "s"; // hearts, diamonds, clubs, spades
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Card = `${Rank}${Suit}`;

export type HandRank = 
  | "royal_flush" | "straight_flush" | "four_of_a_kind" | "full_house"
  | "flush" | "straight" | "three_of_a_kind" | "two_pair" | "one_pair" | "high_card";

export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";
export type GamePhase = "waiting" | "dealing" | "preflop" | "flop" | "turn" | "river" | "showdown" | "completed";

export interface Player {
  id: number;
  seatIndex: number;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  hasActedThisRound: boolean; // Track if player has acted in current betting round
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  pot: number;
  sidePots: { amount: number; eligiblePlayers: number[] }[];
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  minRaise: number;
  deck: Card[];
  // Fairness
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  deckHash: string;
}

// ==================== DECK & SHUFFLE ====================
const SUITS: Suit[] = ["h", "d", "c", "s"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

/**
 * Provably Fair shuffle using server seed + client seed
 * Fisher-Yates shuffle with cryptographic randomness
 */
export function shuffleDeck(deck: Card[], serverSeed: string, clientSeed: string): Card[] {
  const combined = `${serverSeed}:${clientSeed}`;
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const hash = crypto.createHmac("sha256", combined).update(i.toString()).digest("hex");
    const j = parseInt(hash.substring(0, 8), 16) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function hashDeck(deck: Card[]): string {
  return crypto.createHash("sha256").update(deck.join(",")).digest("hex");
}

// ==================== GAME STATE MACHINE ====================
export function initializeGame(players: { id: number; seatIndex: number; chips: number }[], dealerIndex: number, clientSeed: string): GameState {
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);
  
  let deck = createDeck();
  deck = shuffleDeck(deck, serverSeed, clientSeed);
  const deckHash = hashDeck(deck);

  const gamePlayers: Player[] = players.map(p => ({
    id: p.id,
    seatIndex: p.seatIndex,
    chips: p.chips,
    holeCards: [],
    currentBet: 0,
    totalBet: 0,
    isFolded: false,
    isAllIn: false,
    isActive: true,
    hasActedThisRound: false,
  }));

  const numPlayers = gamePlayers.length;
  // Heads-up (2 players): Dealer = Small Blind, other = Big Blind
  // 3+ players: SB = dealer+1, BB = dealer+2
  const smallBlindIndex = numPlayers === 2 ? dealerIndex : (dealerIndex + 1) % numPlayers;
  const bigBlindIndex = numPlayers === 2 ? (dealerIndex + 1) % numPlayers : (dealerIndex + 2) % numPlayers;
  // Preflop action: starts left of BB (which is SB/dealer in heads-up, UTG in 3+)
  const firstToAct = numPlayers === 2 ? dealerIndex : (bigBlindIndex + 1) % numPlayers;

  return {
    phase: "dealing",
    players: gamePlayers,
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: firstToAct,
    dealerIndex,
    smallBlindIndex,
    bigBlindIndex,
    currentBet: 0,
    minRaise: 0,
    deck,
    serverSeed,
    serverSeedHash,
    clientSeed,
    deckHash,
  };
}

export function postBlinds(state: GameState, smallBlind: number, bigBlind: number): GameState {
  const newState = { ...state };
  const sbPlayer = newState.players[newState.smallBlindIndex];
  const bbPlayer = newState.players[newState.bigBlindIndex];

  const sbAmount = Math.min(smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBet = sbAmount;
  sbPlayer.hasActedThisRound = false; // SB hasn't voluntarily acted yet
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

  const bbAmount = Math.min(bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBet = bbAmount;
  bbPlayer.hasActedThisRound = false; // BB hasn't voluntarily acted yet (BB option)
  if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

  newState.pot = sbAmount + bbAmount;
  newState.currentBet = bbAmount;
  newState.minRaise = bigBlind; // First raise must be at least 1 BB increment
  newState.phase = "preflop";

  return newState;
}

export function dealHoleCards(state: GameState): GameState {
  const newState = { ...state, deck: [...state.deck] };
  for (const player of newState.players) {
    if (player.isActive) {
      player.holeCards = [newState.deck.pop()!, newState.deck.pop()!];
    }
  }
  return newState;
}

export function dealCommunityCards(state: GameState, count: number): GameState {
  const newState = { ...state, deck: [...state.deck], communityCards: [...state.communityCards] };
  // Burn one card
  newState.deck.pop();
  for (let i = 0; i < count; i++) {
    newState.communityCards.push(newState.deck.pop()!);
  }
  return newState;
}

export function processAction(state: GameState, playerId: number, action: PlayerAction, amount?: number): GameState {
  const newState = { ...state, players: state.players.map(p => ({ ...p })) };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;
  
  const player = newState.players[playerIndex];

  switch (action) {
    case "fold":
      player.isFolded = true;
      player.hasActedThisRound = true;
      break;
    case "check":
      player.hasActedThisRound = true;
      break;
    case "call": {
      const callAmount = Math.min(newState.currentBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalBet += callAmount;
      newState.pot += callAmount;
      player.hasActedThisRound = true;
      if (player.chips === 0) player.isAllIn = true;
      break;
    }
    case "raise": {
      const raiseAmount = amount ?? (newState.currentBet + newState.minRaise);
      const totalNeeded = raiseAmount - player.currentBet;
      const actualAmount = Math.min(totalNeeded, player.chips);
      player.chips -= actualAmount;
      player.currentBet += actualAmount;
      player.totalBet += actualAmount;
      newState.pot += actualAmount;
      // Update minRaise: the increment of this raise becomes the new minimum
      const raiseIncrement = player.currentBet - newState.currentBet;
      newState.minRaise = Math.max(raiseIncrement, newState.minRaise);
      newState.currentBet = player.currentBet;
      player.hasActedThisRound = true;
      // A raise reopens action for all other players
      for (const p of newState.players) {
        if (p.id !== player.id && !p.isFolded && !p.isAllIn) {
          p.hasActedThisRound = false;
        }
      }
      if (player.chips === 0) player.isAllIn = true;
      break;
    }
    case "all_in": {
      const allInAmount = player.chips;
      player.currentBet += allInAmount;
      player.totalBet += allInAmount;
      newState.pot += allInAmount;
      player.chips = 0;
      player.isAllIn = true;
      player.hasActedThisRound = true;
      if (player.currentBet > newState.currentBet) {
        const raiseIncrement = player.currentBet - newState.currentBet;
        // Only reopen betting if the all-in is a full raise (>= minRaise)
        if (raiseIncrement >= newState.minRaise) {
          newState.minRaise = raiseIncrement;
          for (const p of newState.players) {
            if (p.id !== player.id && !p.isFolded && !p.isAllIn) {
              p.hasActedThisRound = false;
            }
          }
        }
        newState.currentBet = player.currentBet;
      }
      break;
    }
  }

  // Move to next active player
  newState.currentPlayerIndex = getNextActivePlayer(newState, playerIndex);

  return newState;
}

function getNextActivePlayer(state: GameState, currentIndex: number): number {
  const numPlayers = state.players.length;
  let next = (currentIndex + 1) % numPlayers;
  let attempts = 0;
  while (attempts < numPlayers) {
    const player = state.players[next];
    if (!player.isFolded && !player.isAllIn && player.isActive) {
      return next;
    }
    next = (next + 1) % numPlayers;
    attempts++;
  }
  return -1; // No active players
}

export function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(p => !p.isFolded && p.isActive);
  const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn);
  
  // No one can act (all are all-in or folded) → round is complete
  if (playersWhoCanAct.length === 0) return true;
  
  // Only 1 active player total (everyone else folded) → hand is over
  if (activePlayers.length <= 1) return true;
  
  // All active non-all-in players must have:
  // 1. Matched the current bet (or gone all-in for less)
  // 2. Had at least one chance to act this round (hasActedThisRound)
  // This ensures that when 2 of 3 players go all-in, the 3rd player
  // still gets a chance to call/fold before the round ends.
  return playersWhoCanAct.every(p => p.currentBet === state.currentBet && p.hasActedThisRound);
}

export function advancePhase(state: GameState): GameState {
  const newState = { ...state, players: state.players.map(p => ({ ...p })) };
  
  // Reset current bets and action tracking for new round
  for (const player of newState.players) {
    player.currentBet = 0;
    player.hasActedThisRound = false;
  }
  newState.currentBet = 0;
  newState.minRaise = 0; // Will be set by first bet/raise in new round

  // Find first active player after dealer
  newState.currentPlayerIndex = getNextActivePlayer(newState, newState.dealerIndex);

  switch (state.phase) {
    case "preflop":
      newState.phase = "flop";
      return dealCommunityCards(newState, 3);
    case "flop":
      newState.phase = "turn";
      return dealCommunityCards(newState, 1);
    case "turn":
      newState.phase = "river";
      return dealCommunityCards(newState, 1);
    case "river":
      newState.phase = "showdown";
      break;
  }

  return newState;
}

export function getActivePlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.isFolded && p.isActive);
}

export function isHandComplete(state: GameState): boolean {
  const activePlayers = getActivePlayers(state);
  return activePlayers.length <= 1 || state.phase === "showdown";
}

// ==================== HAND EVALUATION ====================
const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

const HAND_RANK_VALUES: Record<HandRank, number> = {
  "high_card": 1, "one_pair": 2, "two_pair": 3, "three_of_a_kind": 4,
  "straight": 5, "flush": 6, "full_house": 7, "four_of_a_kind": 8,
  "straight_flush": 9, "royal_flush": 10,
};

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  kickers: number[];
  description: string;
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);
  
  let bestHand: HandEvaluation = { rank: "high_card", rankValue: 1, kickers: [0], description: "High Card" };
  
  for (const combo of combinations) {
    const evaluation = evaluateFiveCards(combo);
    if (compareHands(evaluation, bestHand) > 0) {
      bestHand = evaluation;
    }
  }
  
  return bestHand;
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const ranks = cards.map(c => c[0] as Rank);
  const suits = cards.map(c => c[1] as Suit);
  const values = ranks.map(r => RANK_VALUES[r]).sort((a, b) => b - a);
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  
  const rankCounts = new Map<number, number>();
  for (const v of values) {
    rankCounts.set(v, (rankCounts.get(v) || 0) + 1);
  }
  
  const counts = Array.from(rankCounts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight && values[0] === 14 && values[1] === 13) {
    return { rank: "royal_flush", rankValue: 10, kickers: values, description: "Royal Flush" };
  }
  if (isFlush && isStraight) {
    return { rank: "straight_flush", rankValue: 9, kickers: values, description: "Straight Flush" };
  }
  if (counts[0][1] === 4) {
    return { rank: "four_of_a_kind", rankValue: 8, kickers: [counts[0][0], counts[1][0]], description: "Four of a Kind" };
  }
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return { rank: "full_house", rankValue: 7, kickers: [counts[0][0], counts[1][0]], description: "Full House" };
  }
  if (isFlush) {
    return { rank: "flush", rankValue: 6, kickers: values, description: "Flush" };
  }
  if (isStraight) {
    return { rank: "straight", rankValue: 5, kickers: values, description: "Straight" };
  }
  if (counts[0][1] === 3) {
    return { rank: "three_of_a_kind", rankValue: 4, kickers: [counts[0][0], ...values.filter(v => v !== counts[0][0])], description: "Three of a Kind" };
  }
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    return { rank: "two_pair", rankValue: 3, kickers: [counts[0][0], counts[1][0], counts[2][0]], description: "Two Pair" };
  }
  if (counts[0][1] === 2) {
    return { rank: "one_pair", rankValue: 2, kickers: [counts[0][0], ...values.filter(v => v !== counts[0][0])], description: "One Pair" };
  }
  
  return { rank: "high_card", rankValue: 1, kickers: values, description: "High Card" };
}

function checkStraight(values: number[]): boolean {
  const sorted = Array.from(new Set(values)).sort((a, b) => b - a);
  if (sorted.length < 5) return false;
  
  // Normal straight
  if (sorted[0] - sorted[4] === 4) return true;
  // Ace-low straight (A-2-3-4-5)
  if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) return true;
  
  return false;
}

function getCombinations(arr: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  function combine(start: number, current: Card[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}

export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

// ==================== SETTLEMENT ====================
export interface SettlementResult {
  winners: { playerId: number; amount: number; hand: HandEvaluation }[];
  rakeAmount: number;
}

export function settleHand(state: GameState, rakePercent: number, rakeCap: number): SettlementResult {
  const activePlayers = getActivePlayers(state);
  
  // If only one player remains (everyone else folded)
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const rakeAmount = Math.min(state.pot * rakePercent / 100, rakeCap);
    const winAmount = state.pot - rakeAmount;
    return {
      winners: [{ playerId: winner.id, amount: winAmount, hand: { rank: "high_card", rankValue: 0, kickers: [], description: "Last Standing" } }],
      rakeAmount,
    };
  }

  // Evaluate all active players' hands
  const evaluations = activePlayers.map(p => ({
    player: p,
    hand: evaluateHand(p.holeCards, state.communityCards),
  }));

  // Sort by hand strength (descending)
  evaluations.sort((a, b) => compareHands(b.hand, a.hand));

  // Find winner(s) - handle ties
  const bestHand = evaluations[0].hand;
  const winners = evaluations.filter(e => compareHands(e.hand, bestHand) === 0);

  const rakeAmount = Math.min(state.pot * rakePercent / 100, rakeCap);
  const distributablePot = state.pot - rakeAmount;
  const sharePerWinner = distributablePot / winners.length;

  return {
    winners: winners.map(w => ({ playerId: w.player.id, amount: sharePerWinner, hand: w.hand })),
    rakeAmount,
  };
}

// ==================== VERIFICATION ====================
export function verifyFairness(serverSeed: string, clientSeed: string, serverSeedHash: string, deckHash: string): { isValid: boolean; message: string } {
  const computedHash = hashSeed(serverSeed);
  if (computedHash !== serverSeedHash) {
    return { isValid: false, message: "Server seed hash mismatch" };
  }

  let deck = createDeck();
  deck = shuffleDeck(deck, serverSeed, clientSeed);
  const computedDeckHash = hashDeck(deck);
  
  if (computedDeckHash !== deckHash) {
    return { isValid: false, message: "Deck hash mismatch" };
  }

  return { isValid: true, message: "Verification passed - game was provably fair" };
}
