# Game Engine Audit - International Texas Hold'em Rules

## Issues Found

### 1. Heads-Up (2 Players) Blind Position - CRITICAL
**Problem:** In heads-up play (2 players), the standard rule is:
- Dealer = Small Blind (posts first, acts first preflop but last postflop)
- Other player = Big Blind

Current code (line 116-117):
```
smallBlindIndex = (dealerIndex + 1) % numPlayers
bigBlindIndex = (dealerIndex + 2) % numPlayers
```
With 2 players, this means:
- SB = (dealer + 1) % 2 = the other player
- BB = (dealer + 2) % 2 = dealer himself

This is WRONG for heads-up. In heads-up:
- Dealer = SB (dealer + 0)
- Non-dealer = BB (dealer + 1)

### 2. Preflop Action Order - CRITICAL
**Problem:** In preflop, action starts to the LEFT of the big blind (UTG position).
Current code (line 125): `currentPlayerIndex: (bigBlindIndex + 1) % numPlayers`
This is correct for 3+ players. But in heads-up, preflop action starts with the dealer/SB, which is already handled by the heads-up fix.

### 3. Minimum Raise Logic - MODERATE
**Problem:** Current code (line 240):
```
const minRaise = gs.currentBet * 2;
```
This is WRONG. The minimum raise should be: `currentBet + lastRaiseIncrement`

Standard rule: The minimum raise must be at least equal to the previous raise increment.
- If BB is $2, first raise must be to at least $4 (raise of $2)
- If someone raises to $10 (raise of $8), re-raise must be to at least $18 (raise of $8)

The `minRaise` in gameEngine.ts is tracked but not correctly used in validation.

### 4. Betting Round Completion Check - MODERATE
**Problem:** `isBettingRoundComplete` (line 256-263) only checks if all players matched currentBet.
But it doesn't track whether all players have had a chance to act in the current round.

In preflop, the BB has the option to raise even if everyone just called. The current logic would end the round before BB gets to act if everyone calls.

Actually looking more carefully: the `processAction` moves `currentPlayerIndex` forward, and `isBettingRoundComplete` is called after each action. The issue is that on preflop, BB posts a forced bet, so when action comes back to BB and everyone has just called, BB's currentBet already equals currentBet - the round would be marked complete before BB gets their option.

This is a CRITICAL bug: BB never gets their option to raise preflop if everyone just calls.

### 5. All-In Less Than Minimum Raise - MINOR
**Problem:** When a player goes all-in for less than a full raise, it should NOT reopen betting to players who have already acted. Current code doesn't track this - it just updates currentBet if all-in amount exceeds it.

### 6. Auto-Start Next Hand - DESIGN
**Problem:** Currently auto-starts next hand after 8 seconds. User wants a "Start" button instead.

## Summary of Required Fixes
1. Heads-up blind positions (2 players)
2. BB option preflop (most critical gameplay bug)
3. Minimum raise calculation
4. Start button instead of auto-start
