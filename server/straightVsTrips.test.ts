import { describe, it, expect } from "vitest";
import { evaluateHand, compareHands, type Card } from "./gameEngine";

/**
 * Comprehensive tests for straight vs three-of-a-kind scenarios
 * User reported: "should be straight wins but system judged three-of-a-kind wins"
 */
describe("Straight vs Three of a Kind - Settlement", () => {
  it("straight (rankValue=5) beats three_of_a_kind (rankValue=4)", () => {
    // Community: 5c 6d 7s Jh Qc
    // Player A: 8h 9d → straight (5-6-7-8-9)
    // Player B: Qs Qd → three queens
    const community: Card[] = ["5c", "6d", "7s", "Jh", "Qc"];
    const handA = evaluateHand(["8h", "9d"] as Card[], community);
    const handB = evaluateHand(["Qs", "Qd"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handA.rankValue).toBe(5);
    expect(handB.rank).toBe("three_of_a_kind");
    expect(handB.rankValue).toBe(4);
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("straight beats trips when community has a pair", () => {
    // Community: 6c 6d 7s 8h 9c
    // Player A: Ts 2h → straight (6-7-8-9-T)
    // Player B: 6h Kd → three 6s
    const community: Card[] = ["6c", "6d", "7s", "8h", "9c"];
    const handA = evaluateHand(["Ts", "2h"] as Card[], community);
    const handB = evaluateHand(["6h", "Kd"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("three_of_a_kind");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("straight beats trips - low straight scenario", () => {
    // Community: 3c 4d 5s Kh Kc
    // Player A: 6h 7d → straight (3-4-5-6-7)
    // Player B: Ks 2d → three kings
    const community: Card[] = ["3c", "4d", "5s", "Kh", "Kc"];
    const handA = evaluateHand(["6h", "7d"] as Card[], community);
    const handB = evaluateHand(["Ks", "2d"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("three_of_a_kind");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("wheel straight beats trips", () => {
    // Community: 2c 3d 4s Jh Jc
    // Player A: Ah 5d → wheel straight (A-2-3-4-5)
    // Player B: Js 9d → three jacks
    const community: Card[] = ["2c", "3d", "4s", "Jh", "Jc"];
    const handA = evaluateHand(["Ah", "5d"] as Card[], community);
    const handB = evaluateHand(["Js", "9d"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("three_of_a_kind");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("player with both straight and trips possibilities - straight wins", () => {
    // Community: 5c 5d 6s 7h 8c
    // Player: 5h 9d → has three 5s AND straight (5-6-7-8-9)
    // Best hand should be straight (higher rankValue)
    const community: Card[] = ["5c", "5d", "6s", "7h", "8c"];
    const hand = evaluateHand(["5h", "9d"] as Card[], community);
    // Player has trips (5,5,5) but also straight (5-6-7-8-9)
    // Straight should be chosen as it's higher
    expect(hand.rank).toBe("straight");
  });

  it("player with trips and possible straight on board - correctly picks best", () => {
    // Community: 4c 5d 6s 7h 7c
    // Player: 7d 2h → three 7s, but also straight 4-5-6-7-8? No, no 8.
    // Best hand: three 7s
    const community: Card[] = ["4c", "5d", "6s", "7h", "7c"];
    const hand = evaluateHand(["7d", "2h"] as Card[], community);
    expect(hand.rank).toBe("three_of_a_kind");
  });

  it("community straight available - player with trips still loses to straight", () => {
    // Community: 4c 5d 6s 7h 8c
    // Player A: 2h 3d → straight (4-5-6-7-8) from community
    // Player B: 4h 4d → three 4s, BUT also has straight (4-5-6-7-8)!
    const community: Card[] = ["4c", "5d", "6s", "7h", "8c"];
    const handA = evaluateHand(["2h", "3d"] as Card[], community);
    const handB = evaluateHand(["4h", "4d"] as Card[], community);
    // Both should have straight! Player B has 4-5-6-7-8 straight too
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("straight");
    // Same straight, should be a tie
    expect(compareHands(handA, handB)).toBe(0);
  });

  it("trips on board but one player has higher straight", () => {
    // Community: 5c 5d 5s 6h 7c
    // Player A: 8h 9d → straight (5-6-7-8-9) 
    // Player B: Ah Kd → three 5s with A kicker
    const community: Card[] = ["5c", "5d", "5s", "6h", "7c"];
    const handA = evaluateHand(["8h", "9d"] as Card[], community);
    const handB = evaluateHand(["Ah", "Kd"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("three_of_a_kind");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("tricky case: trips on board, one player completes straight", () => {
    // Community: 7c 7d 7s 8h 9c
    // Player A: Ts Jd → straight (7-8-9-T-J)
    // Player B: Ah Kd → three 7s with A kicker
    const community: Card[] = ["7c", "7d", "7s", "8h", "9c"];
    const handA = evaluateHand(["Ts", "Jd"] as Card[], community);
    const handB = evaluateHand(["Ah", "Kd"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("three_of_a_kind");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("full house beats straight (not a bug - just confirming)", () => {
    // Community: 5c 5d 6s 7h 8c
    // Player A: 9h Td → straight (6-7-8-9-T)
    // Player B: 5h 6d → full house (555-66)
    const community: Card[] = ["5c", "5d", "6s", "7h", "8c"];
    const handA = evaluateHand(["9h", "Td"] as Card[], community);
    const handB = evaluateHand(["5h", "6d"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("full_house");
    // Full house beats straight - this is correct
    expect(compareHands(handA, handB)).toBeLessThan(0);
  });
});

describe("getCombinations correctness", () => {
  it("evaluateHand finds the best 5-card combo from 7 cards", () => {
    // 7 cards: Ah, 2h, 3h, 4h, 5h, Kc, Qd
    // Best hand: straight flush (A-2-3-4-5 of hearts)
    const hand = evaluateHand(["Ah", "2h"] as Card[], ["3h", "4h", "5h", "Kc", "Qd"] as Card[]);
    expect(hand.rank).toBe("straight_flush");
  });

  it("evaluateHand correctly picks straight over pair in 7 cards", () => {
    // 7 cards: 6h, 7d, 8c, 9s, Ts, 6d, Kc
    // Has pair of 6s, but also straight (6-7-8-9-T)
    const hand = evaluateHand(["6h", "Ts"] as Card[], ["7d", "8c", "9s", "6d", "Kc"] as Card[]);
    expect(hand.rank).toBe("straight");
  });

  it("evaluateHand correctly picks straight over two pair in 7 cards", () => {
    // 7 cards: 6h, 7d, 8c, 9s, Ts, 6d, 7c
    // Has two pair (6s and 7s), but also straight (6-7-8-9-T)
    const hand = evaluateHand(["6h", "Ts"] as Card[], ["7d", "8c", "9s", "6d", "7c"] as Card[]);
    expect(hand.rank).toBe("straight");
  });
});
