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
- [ ] Wire table actions (fold/call/raise) to backend game engine (requires WebSocket for real-time, out of scope for HTTP-only deploy)
- [x] Private room creation form
- [x] Private room management - admin-side done (pause/close/delete in Admin panel)
- [x] Wallet page (deposit, withdraw, transaction history)
- [ ] Replace mock deposit address with dynamic wallet generation (requires blockchain API, out of scope for MVP)
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

## Known Limitations (Require External Services)
- [ ] Real-time poker actions via WebSocket (needs persistent connection server)
- [ ] Dynamic crypto wallet address generation (needs blockchain API integration)
- [ ] Telegram Bot webhook integration (needs bot token from BotFather)
