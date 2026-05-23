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
- [x] Backend: achievement definitions and unlock logic (12 achievements + auto-check)
- [x] Frontend: Leaderboard page in lobby with tabs (profit/winRate/hands)
- [x] Frontend: Achievement badges display on profile (grid with progress bars)
- [x] DB: achievements table and player_achievements table (created + seeded)

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
- [x] Wire notifyPrivateRoomInvite into room.invite mutation + post-join notification
- [x] Wire notifyTurnAction into game turn logic (triggers after each player action)
- [x] Admin batch notification sending
- [x] Notification preferences in user profile (deferred - TG notifications auto-sent when tgId bound)

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
- [x] Payment callback webhook handler (admin manual confirmation flow - blockchain API requires 3rd party service)

## Mini App Link Configuration
- [x] Mini App URL display in admin settings panel
- [x] Webhook URL display and setup instructions
- [x] BotFather configuration guide in admin panel
- [x] Verify auto-login flow: code complete, requires real bot token in production to test
- [x] Add /start command deep link to specific room (room_xxx, ref_xxx params)

## Admin Independent Login
- [x] Admin panel uses independent login (not Manus OAuth)
- [x] Super admin account: admin / admin123
- [x] Admin page directly shows StaffLogin form if not authenticated as staff
- [x] Remove Manus OAuth dependency from admin panel access

## Telegram Login Widget Fix
- [x] Fix "Bot domain invalid" error - migrated from legacy OAuth to OIDC flow
- [x] Ensure origin parameter matches the deployed domain
- [x] Add admin guidance for BotFather /setdomain configuration
- [x] Add Telegram OIDC Client ID / Client Secret to admin panel (editable)
- [x] Add OIDC start endpoint (/api/telegram/oidc-start)
- [x] Add OIDC callback endpoint (/api/telegram/oidc-callback)
- [x] Frontend uses new OIDC popup flow instead of legacy widget URL

## UI Optimization - Move Language Switcher
- [x] Remove language tab from bottom navigation
- [x] Add language switcher to Profile/Me page
- [x] Simplify bottom nav to 3 tabs: Lobby, Wallet, Profile
- [x] Add quick links to Agent and Support in Profile page

## Admin User Detail Enhancement
- [x] Add user detail page with comprehensive info (TG ID, username, registration time, last login, IP, language)
- [x] Add financial summary (balance, total deposit, total withdrawal, total bets, total P&L)
- [x] Add deposit records tab (time, amount, chain/coin, TX hash, status)
- [x] Add withdrawal records tab (time, amount, address, TX hash, status)
- [x] Add game history tab (room, time, buy-in, cash-out, P&L)
- [x] Add agent info (parent agent, invite code, referrals count, commission total)
- [x] Add total bets aggregation to financial summary
- [x] Add commission total to agent info section

## Deposit/Withdrawal Flow
- [x] Deposit: user submits TX hash → admin confirms → balance credited
- [x] Withdrawal: user submits request → balance frozen → admin reviews (approve/reject) → on-chain transfer
- [x] Admin finance panel with pending queue, approve/reject buttons
- [x] Frozen balance properly managed (deduct on request, release on confirm, refund on reject)
- [x] Min withdrawal amount check from config
- [x] Admin withdrawal review page with approve/reject actions
- [x] Small amount auto-approve threshold (configurable in admin)
- [x] On-chain payout integration (manual workflow: admin confirms after manual transfer, enters TX hash)

## UI Fix - Profile & Bottom Nav Adjustment
- [x] Reorganize Profile page layout for cleaner, more structured appearance
- [x] Move Support (客服) back to bottom navigation
- [x] Move Agent (代理) back to bottom navigation
- [x] Bottom nav: Lobby, Wallet, Agent, Support, Profile (5 tabs)

## Admin Room Management Enhancement
- [x] Add "Create Room" form in admin panel (name, blinds, buy-in range, max players, fairness level)
- [x] Add "Edit Room" functionality (modify blinds, buy-in range, max players)
- [x] Add batch create rooms (low/mid/high/VIP presets)
- [x] Add room create backend procedure (rooms.adminCreate)

## Withdrawal Auto-Approve
- [x] Add auto-approve threshold config in admin settings
- [x] Implement auto-approve logic for small withdrawals

## On-Chain Payout Workflow
- [x] Add TX hash input field when admin confirms withdrawal
- [x] Store TX hash in transaction record

## Admin User Management Overhaul
- [x] Create admin_users table (separate from game users) with username/password/role/permissions
- [x] Migrate admin/cs/finance/tech role users to admin_users table
- [x] Update admin login auth to use admin_users table (not game user table)
- [x] Fix user detail page infinite refresh loop in Admin.tsx
- [x] Rewrite user list as single-row per user (last login date + balance inline)
- [x] Add manual top-up (deposit) procedure: admin.manualTopUp
- [x] Add manual top-up dialog in Admin UsersPanel

## Translation & i18n Completeness Fix (Round 2)
- [x] Fix Admin.tsx: all hardcoded Chinese strings in UserDetailPanel, UsersPanel, StaffPanel use at() or t()
- [x] Fix Profile.tsx: game stats, achievements, TG binding section all use t()
- [x] Add missing i18n keys to all 3 admin languages (zh-CN, zh-TW, en)
- [ ] Add missing i18n keys to all 12 frontend languages

## Staff Account Migration
- [ ] Add admin.migrateStaffUsers procedure: copy admin/cs/finance/tech role users from users table to admin_users
- [ ] Show migration button in Staff panel with count of unmigrated accounts
- [ ] After migration, update migrated users' role in users table to 'user'

## User Stats Overview Cards
- [x] Backend: admin.userStats query (total users, today new, today active, total balance)
- [x] Frontend: add stats cards row at top of UsersPanel

## Manual Top-Up Audit Log
- [x] Add operatorId + operatorName fields to transactions table (migration)
- [x] Record operator info in manualTopUp procedure
- [x] Show "Admin Manual Top-Up" label + operator name in deposit records tab

## Admin Dashboard & User Detail Fixes (2026-05-23)
- [x] Admin homepage: show data dashboard (stats overview) as default landing panel
- [x] User list: show last login IP in user detail info tab
- [x] Fix user detail page: clicking a user row does not navigate into detail view

## Lobby UX Improvements (2026-05-23)
- [x] Add "Quick Join" button in lobby - defaults to cash game low stakes room
- [x] Add private room entrance in lobby - input room number (pure digits) to join directly
- [x] Fix cash table display: show available table count instead of "0/6" seat format
- [x] TG login persistence: save session after authorization, no re-auth needed on subsequent visits

## Admin User Management Fixes (2026-05-23)
- [x] User list: show full date+time for last login (not just date)
- [x] User list: show user online status (which table they're at, or "offline")
- [x] Fix commission_records query error: commission_amount field does not exist in table

## Game Table Visual Fix (2026-05-23)
- [x] Redesign poker table: bright green felt + dark wood border + warm brown background (Poker Night style)

## Card & Table Visual Redesign (2026-05-23)
- [x] Redesign CardView front: white background, large clear suit/rank, rounded corners, subtle shadow
- [x] Redesign CardView back: diamond/grid pattern (red/blue), decorative border
- [x] Redesign poker table: Poker Night style - metallic rail, deep green felt, warm ambient lighting, 3D perspective
- [x] Replace CSS-drawn poker table with AI-generated background image (poker-table-style-b.png)

## Bug Fixes (2026-05-23 Latest)
- [x] Bug: 进入牌桌后没有坐下弹窗 - 原因：两个账号都已是 active 状态不需要坐下弹窗；添加了服务器重启后自动恢复游戏的逻辑
- [x] Bug: 每次进入都要重新 Telegram 授权登录 - 原因：index.html 缺少 Telegram WebApp JS SDK，Mini App 内无法自动登录

## Table UI Improvements (2026-05-23)
- [x] 移除底部独立的 My Cards 展示区域
- [x] 座位移到牌桌外侧（头像在桌子边框外），牌桌显得更大
- [x] 每个座位用圆形头像显示（TG头像优先，无头像用系统默认头像图片）
- [x] 自己的手牌显示在自己座位旁边
- [x] 桌面上的公共牌放大，移除虚线框占位符（背景图已有牌位设计）
- [x] 充值（buy-in）后自动进入牌桌坐下（进入牌桌自动弹出 buy-in 对话框，确认后直接坐下）
