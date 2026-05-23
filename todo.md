# Vera Poker - Project TODO

## Phase 1: Database & Backend Core
- [x] Database schema design (users, rooms, games, transactions, agents, configs)
- [x] System config CRUD (all game parameters configurable)
- [x] User management (Manus OAuth login)
- [x] Room management (public + private rooms)
- [x] Texas Hold'em game engine (state machine, dealing, betting, settlement)
- [x] Fund system (deposit, withdraw, balance, transaction logs)
- [x] Agent system (invite links, two-level commission, unlock conditions)
- [x] Risk events logging system
- [x] Fairness verification system (hash-based provably fair)
- [x] AI customer service (LLM integration with FAQ knowledge base)
- [x] Complete i18n translations for all 12 languages

## Phase 2: Game Frontend
- [x] Dark theme with glassmorphism styling (cyber-luxury)
- [x] Game lobby (room list, filters, quick seat, online count)
- [x] 2D poker table UI (visual layout, cards, chip display, countdown)
- [x] Wire table actions (fold/call/raise/check/all-in) to backend game engine via HTTP polling
- [x] Private room creation form
- [x] Private room management - admin-side done (pause/close/delete in Admin panel)
- [x] Wallet page (deposit, withdraw, transaction history)
- [x] Replace mock deposit address with dynamic wallet generation (deterministic per-user addresses)
- [x] Agent dashboard (referral link, downlines, earnings)
- [x] AI customer service chat interface
- [x] Multi-language switcher UI component (in BottomNav)
- [x] Fairness verification UI (manual verify mode)
- [x] Quick verify by hand ID lookup

## Phase 3: Admin Dashboard
- [x] Admin layout with tab navigation (mobile-first)
- [x] Game config management (rake, blinds, buy-in ranges)
- [x] Room list panel with admin actions (pause/close/delete)
- [x] User management & risk level control
- [x] Financial reports & transaction monitoring
- [x] Agent management panel (view all agents, commissions)
- [x] Private room pricing config
- [x] Risk events log panel
- [x] Anti-abuse rules display
- [x] AI customer service FAQ management
- [x] System settings panel (maintenance mode, TG bot config, language settings)

## Phase 4: Mobile-First & Polish
- [x] Mobile container wrapper (max-width: 430px for Telegram Mini App)
- [x] Fix page title placeholder ({{project_title}} → Vera Poker)
- [x] Add Google Fonts (Inter + JetBrains Mono)
- [x] BottomNav fixed positioning for mobile container
- [x] Telegram WebView safe area & overscroll fixes
- [x] Admin panel: convert sidebar to mobile tab bar
- [x] Admin panel: convert tables to card-based mobile layout
- [x] Admin panel: responsive grid layouts (cols-2 instead of cols-3/4)
- [x] Verify all pages render correctly at 430px width

## Phase 5: Integration & Delivery
- [x] Unit tests for core game logic (22 tests passing)
- [x] i18n system tests (6 tests passing)
- [x] Integration testing (TypeScript compilation clean, all 28 tests pass)
- [x] Final checkpoint & delivery

## Optional Features (Require External Services)
- [x] Real-time poker actions - implemented via HTTP polling (2s interval)
- [x] Dynamic crypto wallet address generation - implemented with deterministic addresses
- [x] Telegram Bot webhook integration (complete)
  - [x] Webhook endpoint for Telegram updates (/api/telegram/webhook)
  - [x] Bot message handler and reply logic (/start, /help, /balance, /rooms)
  - [x] Telegram API integration for sending messages
  - [x] Tests for webhook handling (12 tests passing - unit + e2e)

## Bug Fixes & UI Enhancements
- [x] Persist all players' updated chip stacks at hand settlement (not just winner)
- [x] Fix table leave flow to refund chips before marking player as left
- [x] Add strict server-side validation for raise amounts and out-of-turn actions
- [x] Add UI error recovery for table polling/action failures
- [x] Connection lost banner with retry button
- [x] Disable action buttons when connection is lost
- [x] Add integration tests for invalid table actions (39 tests passing)

## New Requirements
- [x] Admin panel: PC desktop layout with sidebar navigation (responsive)
- [x] Admin panel: Default language Chinese (中文界面)
- [x] Admin panel: Support Chinese, Traditional Chinese, English
- [x] Game: Complete poker table real-time gameplay experience
- [x] Game: Card dealing animation and game flow
- [x] Game: Multi-player interaction and state display
- [x] Table UI: card dealing animations with staggered delays
- [x] Table UI: chip stack visualization
- [x] Table UI: winner announcement overlay
- [x] Table UI: phase change detection and card animations
- [x] Table UI: Chinese text throughout
- [x] Table UI: larger hero cards at bottom
- [x] Table UI: turn indicator ring with pulse animation
- [x] Table UI: improved countdown timer with color change at <10s
- [x] Backend: lastWinner field in table state for winner display
- [x] Admin i18n: all panel strings localized (users risk levels, agents status, risk layers, FAQ categories)
- [x] Table.tsx: all hardcoded strings replaced with i18n (table.left, table.demoMode, table.reconnecting)
- [x] Added missing i18n keys to all 5 major locales (en, zh-CN, zh-TW, ja, ko)
- [x] 51 tests passing across 7 test files

## Game Enhancements (Latest)
- [x] Phase progress indicator in Table.tsx (preflop → flop → turn → river → showdown)
- [x] AnimatedPot / ChipStack animation component
- [x] Settlement detail overlay (side pots, hand type, showdown results)
- [x] Countdown timer vibration + 3-stage color (green → yellow → red)
- [x] HandHistory.tsx page at /history/:roomId with expandable player details
- [x] RecentHandsPreview component in Lobby.tsx
- [x] myRecentHands tRPC endpoint
- [x] getPlayerRecentHands db function
- [x] Side pot calculation in settleHand
- [x] Async getPlayerView with real usernames from database
- [x] Connection lost banner with auto-reconnect

## Telegram Authorization Login
- [x] Backend: Telegram initData validation (HMAC-SHA256 verification)
- [x] Backend: Telegram Login Widget data validation
- [x] Backend: Create/bind user by tgId (upsert with TG profile)
- [x] Backend: Issue session cookie after TG auth
- [x] Backend: getUserByTgId database helper
- [x] Backend: upsertUser support tgId/tgUsername fields
- [x] Frontend: Detect Telegram WebApp environment and auto-login
- [x] Frontend: Telegram Login Widget on Home page for non-TG browsers
- [x] Frontend: Skip Manus OAuth redirect when in TG environment
- [x] Tests: Telegram auth verification unit tests (12 tests passing)

## Admin Panel Fixes
- [x] System config page: show Chinese labels instead of raw config keys

## User Profile Page
- [x] Profile page with avatar, nickname, balance, TG binding status
- [x] Bind/unbind Telegram account from profile
- [x] Display game stats (total hands, win rate, total profit)
- [x] Route /profile added to App.tsx

## Leaderboard & Achievement System
- [x] Backend: leaderboard queries (profit, win rate, hands played)
- [ ] Backend: achievement definitions and unlock logic (deferred)
- [x] Frontend: Leaderboard page in lobby with tabs (profit/winRate/hands)
- [ ] Frontend: Achievement badges display on profile (deferred)
- [ ] DB: achievements table and player_achievements table (deferred)

## Admin Stats Dashboard
- [x] Daily active users chart (line chart, 30 days)
- [x] Daily transaction volume chart (bar chart)
- [x] Room usage rate chart (pie/bar chart)
- [x] Backend: stats aggregation queries

## Admin Permission System
- [x] DB: extend user role enum (admin/cs/finance/tech/user)
- [x] Backend: role-based access control for admin routes
- [x] Independent staff login page (/staff-login) with account/password
- [x] Admin sidebar shows only permitted sections per role
- [x] Staff account CRUD (create/delete/reset password)

## Push Notification System
- [x] Backend: TG notification service module with convenience helpers
- [ ] Wire notifyPrivateRoomInvite into room invite flow (requires game flow integration)
- [ ] Wire notifyTurnAction into game turn logic (requires game flow integration)
- [x] Admin batch notification sending
- [ ] Notification preferences in user profile (deferred)

## Table Sound Effects
- [x] Web Audio API synthesized sound effects (deal, bet, fold, win, timer)
- [x] Sound toggle on table (mute/unmute)
- [x] Play sounds on game state transitions
- [x] Respect user mute preference

## Payment Gateway Integration
- [x] Crypto deposit with admin confirmation flow (pending until approved)
- [x] Configurable wallet addresses from admin system config
- [x] Admin confirm/reject deposit and withdrawal mutations
- [x] Min deposit validation from config
- [ ] Payment callback webhook handler (requires external blockchain API)

## Mini App Link Configuration
- [x] Mini App URL display in admin settings panel
- [x] Webhook URL display and setup instructions
- [x] BotFather configuration guide in admin panel
- [ ] Verify auto-login flow end-to-end in TG client (requires real bot token)
- [ ] Add /start command deep link to specific room (deferred)
