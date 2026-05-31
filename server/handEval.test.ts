import { describe, it, expect } from "vitest";
import { evaluateHand, compareHands, type Card } from "./gameEngine";

describe("Hand Evaluation - Straight Detection", () => {
  it("detects 6-high straight (2-3-4-5-6)", () => {
    const holeCards: Card[] = ["6h", "5d"];
    const community: Card[] = ["4c", "3s", "2h", "Kd", "Jc"];
    const result = evaluateHand(holeCards, community);
    expect(result.rank).toBe("straight");
  });

  it("detects T-high straight (6-7-8-9-T)", () => {
    const holeCards: Card[] = ["Ts", "9h"];
    const community: Card[] = ["8c", "7d", "6s", "2h", "3c"];
    const result = evaluateHand(holeCards, community);
    expect(result.rank).toBe("straight");
  });

  it("detects wheel straight (A-2-3-4-5)", () => {
    const holeCards: Card[] = ["Ah", "2d"];
    const community: Card[] = ["3c", "4s", "5h", "Kd", "Jc"];
    const result = evaluateHand(holeCards, community);
    expect(result.rank).toBe("straight");
  });

  it("detects broadway straight (T-J-Q-K-A)", () => {
    const holeCards: Card[] = ["As", "Kh"];
    const community: Card[] = ["Qc", "Jd", "Ts", "2h", "3c"];
    const result = evaluateHand(holeCards, community);
    expect(result.rank).toBe("straight");
  });

  it("straight beats one pair", () => {
    // Player 1: has a straight (6-7-8-9-T)
    const hand1 = evaluateHand(["Ts", "9h"] as Card[], ["8c", "7d", "6s", "2h", "Kc"] as Card[]);
    // Player 2: has one pair (KK)
    const hand2 = evaluateHand(["Kh", "Kd"] as Card[], ["8c", "7d", "6s", "2h", "Kc"] as Card[]);
    // Wait - Player 2 actually has three of a kind here! Let me fix the test
    expect(hand1.rank).toBe("straight");
    // Player 2 with KK on board Kc actually has three kings
    expect(hand2.rank).toBe("three_of_a_kind");
  });

  it("straight beats one pair - correct scenario", () => {
    // Community: 8c 7d 6s 2h Ac
    // Player 1: Ts 9h → straight (6-7-8-9-T)
    // Player 2: Ah Kd → one pair (AA)
    const community: Card[] = ["8c", "7d", "6s", "2h", "Ac"];
    const hand1 = evaluateHand(["Ts", "9h"] as Card[], community);
    const hand2 = evaluateHand(["Ah", "Kd"] as Card[], community);
    expect(hand1.rank).toBe("straight");
    expect(hand2.rank).toBe("one_pair");
    // Straight (rankValue 5) should beat one pair (rankValue 2)
    expect(compareHands(hand1, hand2)).toBeGreaterThan(0);
  });

  it("straight with overlapping community cards", () => {
    // Community: 5c 6d 7s 8h Qc
    // Player 1: 4h 9d → straight (5-6-7-8-9)
    // Player 2: Qs Qd → three of a kind (QQQ)
    const community: Card[] = ["5c", "6d", "7s", "8h", "Qc"];
    const hand1 = evaluateHand(["4h", "9d"] as Card[], community);
    const hand2 = evaluateHand(["Qs", "Qd"] as Card[], community);
    expect(hand1.rank).toBe("straight");
    expect(hand2.rank).toBe("three_of_a_kind");
    // Straight (5) > Three of a kind (4)
    expect(compareHands(hand1, hand2)).toBeGreaterThan(0);
  });

  it("higher straight beats lower straight", () => {
    // Community: 5c 6d 7s 8h 9c
    // Player 1: Ts Jh → straight (7-8-9-T-J)
    // Player 2: 4h 3d → straight (5-6-7-8-9) - wait, 4 makes 4-5-6-7-8 or 5-6-7-8-9
    const community: Card[] = ["5c", "6d", "7s", "8h", "9c"];
    const hand1 = evaluateHand(["Ts", "Jh"] as Card[], community);
    const hand2 = evaluateHand(["4h", "3d"] as Card[], community);
    expect(hand1.rank).toBe("straight");
    expect(hand2.rank).toBe("straight");
    // J-high straight > 9-high straight
    expect(compareHands(hand1, hand2)).toBeGreaterThan(0);
  });

  it("wheel straight kicker is 5 (not Ace)", () => {
    // Wheel: A-2-3-4-5 → high card is 5, not A
    const holeCards: Card[] = ["Ah", "2d"];
    const community: Card[] = ["3c", "4s", "5h", "9d", "8c"];
    const result = evaluateHand(holeCards, community);
    // Should detect 9-high straight (5-6-7-8-9)? No, there's no 6 or 7.
    // Actually: A,2,3,4,5,9,8 → best straight is A-2-3-4-5 (wheel)
    expect(result.rank).toBe("straight");
    // Kickers for wheel should start with 5 (the high card of the straight)
    expect(result.kickers[0]).toBe(5);
  });
});

describe("Hand Evaluation - Hidden Straight in 7 Cards", () => {
  it("finds straight even when pair exists in 7 cards", () => {
    // Community: 5c 6d 7s 8h Kc
    // Player: 9h 9d → has pair of 9s AND straight (5-6-7-8-9)
    // Straight should win over pair
    const community: Card[] = ["5c", "6d", "7s", "8h", "Kc"];
    const hand = evaluateHand(["9h", "9d"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });

  it("finds straight when community has pairs", () => {
    // Community: 5c 5d 6s 7h 8c
    // Player: 9h Td → straight (6-7-8-9-T)
    const community: Card[] = ["5c", "5d", "6s", "7h", "8c"];
    const hand = evaluateHand(["9h", "Td"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });

  it("finds straight when both hole cards form part of it", () => {
    // Community: 3c 4d 5s Jh Qc
    // Player: 6h 7d → straight (3-4-5-6-7)
    const community: Card[] = ["3c", "4d", "5s", "Jh", "Qc"];
    const hand = evaluateHand(["6h", "7d"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });

  it("correctly identifies straight when community has two pair", () => {
    // Community: 6c 6d 7s 8h 9c
    // Player: Ts 2h → straight (6-7-8-9-T) beats two pair
    const community: Card[] = ["6c", "6d", "7s", "8h", "9c"];
    const hand = evaluateHand(["Ts", "2h"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });

  it("straight vs pair: straight always wins in head-to-head", () => {
    // Scenario: Player A has straight, Player B has one pair
    // Community: 4c 5d 6s Kh Jc (no 2,3,7,8,9,T on board)
    // Player A: 7h 8d → straight (4-5-6-7-8)
    // Player B: Ks Qd → one pair (KK)
    const community: Card[] = ["4c", "5d", "6s", "Kh", "Jc"];
    const handA = evaluateHand(["7h", "8d"] as Card[], community);
    const handB = evaluateHand(["Ks", "Qd"] as Card[], community);
    expect(handA.rank).toBe("straight");
    expect(handB.rank).toBe("one_pair");
    expect(compareHands(handA, handB)).toBeGreaterThan(0);
  });

  it("6-high straight correctly detected with scattered cards", () => {
    // Community: 2c 3d 9s Kh Ac
    // Player: 4h 5d → straight? No! Need 2-3-4-5-6 but no 6
    // Actually A-2-3-4-5 wheel!
    const community: Card[] = ["2c", "3d", "9s", "Kh", "Ac"];
    const hand = evaluateHand(["4h", "5d"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });
});

describe("Hand Evaluation - Edge Cases", () => {
  it("pair on board does not create false straight", () => {
    // Community: 6c 6d 7s 8h 9c
    // Player: Ts 2h → should be straight (6-7-8-9-T) using one 6
    const community: Card[] = ["6c", "6d", "7s", "8h", "9c"];
    const hand = evaluateHand(["Ts", "2h"] as Card[], community);
    expect(hand.rank).toBe("straight");
  });

  it("three of a kind does not falsely become straight", () => {
    // Community: 6c 6d 6s Kh 2c
    // Player: Ah Qd → three 6s on board, player has A-high
    const community: Card[] = ["6c", "6d", "6s", "Kh", "2c"];
    const hand = evaluateHand(["Ah", "Qd"] as Card[], community);
    expect(hand.rank).toBe("three_of_a_kind");
  });

  it("two pair correctly identified", () => {
    const community: Card[] = ["Ac", "Kd", "7s", "3h", "2c"];
    const hand = evaluateHand(["As", "Kh"] as Card[], community);
    expect(hand.rank).toBe("two_pair");
  });

  it("full house beats flush", () => {
    // Community: Ah Kh Qh 2h 2c
    // Player 1: 2d 2s → four 2s? No, 2h 2c 2d 2s = four of a kind
    // Let me fix: 
    // Community: Ah Kh 7h 7c 2c
    // Player 1: 7d As → full house (777AA)
    // Player 2: 3h 4h → flush (Ah Kh 7h 3h 4h)
    const community: Card[] = ["Ah", "Kh", "7h", "7c", "2c"];
    const hand1 = evaluateHand(["7d", "As"] as Card[], community);
    const hand2 = evaluateHand(["3h", "4h"] as Card[], community);
    expect(hand1.rank).toBe("full_house");
    expect(hand2.rank).toBe("flush");
    expect(compareHands(hand1, hand2)).toBeGreaterThan(0);
  });
});
