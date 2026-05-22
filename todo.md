# Vera Poker - Project TODO

## Phase 1: Database & Backend Core
- [ ] Database schema design (users, rooms, games, transactions, agents, configs)
- [ ] System config CRUD (all game parameters configurable)
- [ ] User management with TG integration
- [ ] Room management (public + private rooms)
- [ ] Texas Hold'em game engine (state machine, dealing, betting, settlement)
- [ ] Fund system (deposit, withdraw, balance, transaction logs)
- [ ] Agent system (invite links, two-level commission, unlock conditions)
- [ ] Anti-abuse system (registration gates, device fingerprint, behavior analysis)
- [ ] Fairness verification system (hash-based provably fair)
- [ ] AI customer service (LLM integration with RAG)
- [ ] i18n support (multi-language)

## Phase 2: Game Frontend
- [ ] Dark theme with glassmorphism styling (cyber-luxury)
- [ ] Game lobby (room list, filters, quick seat, online count)
- [ ] 2D poker table (animations, chip effects, countdown, all-in effects)
- [ ] Private room creation & management
- [ ] Wallet page (deposit, withdraw, transaction history)
- [ ] Agent dashboard (referral link, downlines, earnings)
- [ ] AI customer service chat interface
- [ ] Multi-language switcher
- [ ] Fairness verification UI

## Phase 3: Admin Dashboard
- [ ] Admin layout with sidebar navigation
- [ ] Game config management (rake, blinds, buy-in ranges)
- [ ] Room management panel
- [ ] User management & risk control
- [ ] Financial reports & transaction monitoring
- [ ] Agent management & commission settings
- [ ] Private room pricing config
- [ ] Anti-abuse rules configuration
- [ ] TG Bot notification settings
- [ ] AI customer service FAQ management
- [ ] System settings (languages, maintenance mode)

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
- [ ] Integration testing
- [ ] Final checkpoint & delivery
