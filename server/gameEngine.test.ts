import { describe, expect, it } from "vitest";
import { createDeck, shuffleDeck, generateServerSeed, initializeGame, postBlinds, dealHoleCards, processAction, evaluateHand, settleHand, verifyFairness, hashSeed } from "./gameEngine";

describe("PokerEngine", () => {
  describe("createDeck", () => {
    it("creates a standard 52-card deck", () => {
      const deck = createDeck();
      expect(deck.length).toBe(52);
    });

    it("contains all suits and ranks", () => {
      const deck = createDeck();
      const suits = new Set(deck.map(c => c[c.length - 1]));
      const ranks = new Set(deck.map(c => c.slice(0, -1)));
      expect(suits.size).toBe(4);
      expect(ranks.size).toBe(13);
    });

    it("has no duplicate cards", () => {
      const deck = createDeck();
      const uniqueCards = new Set(deck);
      expect(uniqueCards.size).toBe(52);
    });
  });

  describe("shuffleDeck", () => {
    it("returns a deck of 52 cards", () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck, "server123", "client456");
      expect(shuffled.length).toBe(52);
    });

    it("is deterministic with same seeds", () => {
      const deck = createDeck();
      const shuffled1 = shuffleDeck(deck, "server123", "client456");
      const shuffled2 = shuffleDeck(deck, "server123", "client456");
      expect(shuffled1).toEqual(shuffled2);
    });

    it("produces different results with different seeds", () => {
      const deck = createDeck();
      const shuffled1 = shuffleDeck(deck, "server123", "client456");
      const shuffled2 = shuffleDeck(deck, "server789", "client456");
      expect(shuffled1).not.toEqual(shuffled2);
    });
  });

  describe("generateServerSeed", () => {
    it("generates a non-empty string", () => {
      const seed = generateServerSeed();
      expect(seed.length).toBeGreaterThan(0);
    });

    it("generates unique seeds", () => {
      const seed1 = generateServerSeed();
      const seed2 = generateServerSeed();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe("initializeGame", () => {
    it("creates a game with correct number of players", () => {
      const state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      expect(state.players.length).toBe(2);
      expect(state.phase).toBe("dealing");
    });

    it("assigns dealer correctly", () => {
      const state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
          { id: 3, seatIndex: 2, chips: 100 },
        ],
        1,
        "client_seed_test"
      );
      expect(state.dealerIndex).toBe(1);
    });
  });

  describe("postBlinds", () => {
    it("posts small and big blinds correctly", () => {
      const state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
          { id: 3, seatIndex: 2, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      const afterBlinds = postBlinds(state, 0.5, 1);
      expect(afterBlinds.pot).toBe(1.5);
    });
  });

  describe("dealHoleCards", () => {
    it("deals 2 cards to each player", () => {
      let state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      state = postBlinds(state, 0.5, 1);
      state = dealHoleCards(state);
      state.players.forEach(p => {
        expect(p.holeCards.length).toBe(2);
      });
    });
  });

  describe("processAction", () => {
    it("processes a fold action", () => {
      let state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      state = postBlinds(state, 0.5, 1);
      state = dealHoleCards(state);
      state = { ...state, phase: "preflop" };
      
      const currentPlayerId = state.players[state.currentPlayerIndex].id;
      const newState = processAction(state, currentPlayerId, "fold");
      
      const foldedPlayer = newState.players.find(p => p.id === currentPlayerId);
      expect(foldedPlayer?.isFolded).toBe(true);
    });

    it("processes a call action", () => {
      let state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      state = postBlinds(state, 0.5, 1);
      state = dealHoleCards(state);
      state = { ...state, phase: "preflop" };
      
      const currentPlayerId = state.players[state.currentPlayerIndex].id;
      const newState = processAction(state, currentPlayerId, "call");
      
      expect(newState.pot).toBeGreaterThanOrEqual(state.pot);
    });

    it("ignores action from wrong player (returns unchanged state)", () => {
      let state = initializeGame(
        [
          { id: 1, seatIndex: 0, chips: 100 },
          { id: 2, seatIndex: 1, chips: 100 },
        ],
        0,
        "client_seed_test"
      );
      state = postBlinds(state, 0.5, 1);
      state = dealHoleCards(state);
      state = { ...state, phase: "preflop" };
      
      // Use a non-existent player ID
      const newState = processAction(state, 999, "fold");
      // Should return unchanged state since player not found
      expect(newState.pot).toBe(state.pot);
    });
  });

  describe("evaluateHand", () => {
    it("detects a flush", () => {
      const holeCards = ["Ah" as const, "Kh" as const];
      const community = ["Qh" as const, "Jh" as const, "9h" as const, "2c" as const, "3d" as const];
      const result = evaluateHand(holeCards, community);
      expect(result.rank).toBe("flush");
    });

    it("detects a straight", () => {
      const holeCards = ["Ts" as const, "9h" as const];
      const community = ["8c" as const, "7d" as const, "6s" as const, "2h" as const, "3c" as const];
      const result = evaluateHand(holeCards, community);
      expect(result.rank).toBe("straight");
    });

    it("detects four of a kind", () => {
      const holeCards = ["As" as const, "Ah" as const];
      const community = ["Ac" as const, "Ad" as const, "Ks" as const, "2h" as const, "3c" as const];
      const result = evaluateHand(holeCards, community);
      expect(result.rank).toBe("four_of_a_kind");
    });

    it("detects a full house", () => {
      const holeCards = ["As" as const, "Ah" as const];
      const community = ["Ac" as const, "Kd" as const, "Ks" as const, "2h" as const, "3c" as const];
      const result = evaluateHand(holeCards, community);
      expect(result.rank).toBe("full_house");
    });
  });

  describe("verifyFairness", () => {
    it("validates correct server seed against its hash and deck hash", () => {
      const serverSeed = generateServerSeed();
      const clientSeed = "client123";
      const serverSeedHash = hashSeed(serverSeed);
      // Compute the expected deck hash
      const deck = createDeck();
      const shuffled = shuffleDeck(deck, serverSeed, clientSeed);
      const deckHash = shuffled.join(",");
      const crypto = require("crypto");
      const expectedDeckHash = crypto.createHash("sha256").update(deckHash).digest("hex");
      const result = verifyFairness(serverSeed, clientSeed, serverSeedHash, expectedDeckHash);
      expect(result.isValid).toBe(true);
    });

    it("rejects incorrect server seed", () => {
      const serverSeed = generateServerSeed();
      const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000";
      const result = verifyFairness(serverSeed, "client123", wrongHash, "");
      expect(result.isValid).toBe(false);
    });
  });
});
