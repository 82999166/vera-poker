# Vera Poker TODO

## Bug Fix: Buy-in / Leave not writing transactions
- [x] Backend: Write buy_in transaction record when player joins table (deduct from balance)
- [x] Backend: Write leave_table transaction record when player leaves table (return chips to balance)
- [x] Backend: Write rebuy transaction record when player rebuys chips
- [x] Admin: New "Game Flow" tab in user detail panel showing buy_in / leave_table / rebuy with summary stats
- [x] DB: Extended transactions.type enum to include buy_in, leave_table, rebuy

## Feature: Game Amount Display Decimals + Low Balance Warning
- [x] Table.tsx: Show chip amounts with 2 decimal places (e.g. 12.50 not 12)
- [x] Table.tsx: Show player balance with decimals in buy-in dialog
- [x] Table.tsx: When balance < min buy-in, show warning toast/banner with link to wallet

## Feature: Wallet Page Game Flow Tab
- [x] Backend: Add userGameFlow procedure to fetch buy_in/leave_table/rebuy transactions for current user
- [x] Frontend: Wallet.tsx - Add game flow tab alongside existing tabs
- [x] Frontend: Display buy_in (red), leave_table (green), rebuy (orange) with summary stats

## Bug Fix: Negative Balance Protection
- [x] Backend: game.join procedure - check balance >= buyIn before deducting, throw error if insufficient
- [x] Backend: game.rebuy procedure - same check
- [x] Use database transaction to prevent race condition (deductUserBalanceAtomic)

## Feature: Home Page Feature Cards i18n
- [x] i18n.ts: Add home.feature.* keys for all 12 languages
- [x] Home.tsx: Replace hardcoded English feature card text with t() calls
