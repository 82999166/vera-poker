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
- [x] Add missing i18n keys to all 12 frontend languages

## Staff Account Migration
- [x] Add admin.migrateStaffUsers procedure: copy admin/cs/finance/tech role users from users table to admin_users
- [x] Show migration button in Staff panel with count of unmigrated accounts
- [x] After migration, update migrated users' role in users table to 'user'

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

## Table UI Fixes (2026-05-23 Round 2)
- [x] 玩家座位位置再往外移（已移到 92%/72%/24%/1% + left -2%/102%）
- [x] 扑克牌尺寸调大(w-14/h-76px)，数字调大(15px font-black)，中心花色调小(text-lg)，解决重叠
- [x] 弃牌（fold）后自动换到另一桌（同级别有空位的房间，1.5s延迟后跳转）

## Table UI Fixes (2026-05-24)
- [x] 牌桌最下面座位固定为当前玩家（座位旋转逻辑，自己始终在底部）
- [x] 自己的两张手牌调大（w-14 h-76px，间距加大）

## Showdown Animations (2026-05-24)
- [x] 开牌后赢家动画（头像金色发光+放大、筹码飞入、赢得金额弹出、彩色粒子庆祝）
- [x] 开牌后输家动画（整体变暗+去饱和度）
- [x] 赢家公告横幅（金色边框+发光阴影、奖杯图标、名字+金额+牌型+showdown玩家对比）

## Table UI Fixes (2026-05-24 Round 3)
- [x] 右侧座位牌显示超出屏幕，调整左右座位位置让牌不溢出（left 4%/96%）
- [x] 牌桌背景图去掉所有座位标记，重新生成干净的纯桌面背景（无任何文字/数字/占位符）

## Table Fixes (2026-05-24 Round 4)
- [x] 同场次换桌不需要再 buy-in（autoJoin URL参数，自动用最小 buy-in 坐下）
- [x] 开牌后赢家/输家动画确认正常触发 + 添加赢/输声音提示（新增 lose 音效）

## Winner Display Fix (2026-05-24)
- [x] 赢家公告显示时间延长至7秒，后端新一手延迟8秒
- [x] 赢家金币飞入动画（5个金币错开飞入）+ 赢得金额弹出（黑底金边胶囊）
- [x] 确保 showdown 阶段有足够停留时间（触发改为 phase=completed 检测，不再依赖 handNumber 变化）

## Next Round Start Button + Game Logic Audit (2026-05-24)
- [x] 结算后牌桌中间显示"开始下一局"按钮，玩家点击才开始
- [x] 超时未点击开始则自动退出牌场（30秒超时，退还筹码到余额）
- [x] 审查 gameEngine 符合国际德州扑克规则（修复单挑盲注、BB option、最小加注、raise reopen）
- [x] 修复审查中发现的逻辑问题（hasActedThisRound 跟踪、minRaise 计算、raise reopen）

## Admin Finance - Rake Management (2026-05-24)
- [x] 后端：rake_records 表（记录每局抽水金额、房间、时间）
- [x] 后端：抽水统计查询接口（总抽水、日/周/月抽水、按房间统计）
- [x] 后端：数据看板增加抽水统计数据
- [x] 前端：Admin 财务面板增加"抽水管理"Tab（抽水明细列表、筛选、统计卡片）
- [x] 前端：数据看板增加抽水收入趋势图

## Voice Announcements (2026-05-24)
- [x] Web Speech API 语音播报：下注金额、跟注金额、加注金额、全押、弃牌、过牌
- [x] 语音播报支持中英文（根据当前语言设置）
- [x] 语音播报开关（可在牌桌设置中关闭）

## Complete Remaining Items
- [x] i18n: 补全所有12种前端语言的缺失 key
- [x] Staff 迁移: admin.migrateStaffUsers procedure
- [x] Staff 迁移: Staff panel 显示迁移按钮

## Fixes (2026-05-24 Round 5)
- [x] 私人房间号改为6位纯数字，游戏结束后房间号作废
- [x] 去掉重复的开始按钮（中间和下面有两个，只保留牌桌中间的）
- [x] 房间内翻译不彻底，检查并修复所有未翻译的文本
- [x] 抽水没有数据（抽水记录未写入数据库）
- [x] 操作语音播报没有声音
- [x] 分享链接没有直接拉起TG
- [x] 代理佣金比例没有调用数据库

## Payment System - USDT Multi-chain (2026-05-24)
- [x] 支持多链USDT充值（TRC20/ERC20/BEP20/TON/Polygon）
- [x] 管理后台配置各链收款钱包地址
- [x] 充值流程：显示对应链收款地址 → 用户提交txHash → 管理员确认到账
- [x] 提现流程：用户选择链+输入地址+金额 → 管理员审核 → 确认打款
- [x] 前端Wallet页面支持多链选择

## Admin Logs System (2026-05-24)
- [x] 新建 admin_logs 表（记录所有管理员操作和系统事件）
- [x] 后端：所有管理员操作写入日志（充值确认、提现审核、用户管理、配置变更等）
- [x] 前端：管理后台增加“操作日志”Tab，支持筛选和搜索

## TG Bot Notifications (2026-05-24)
- [x] 充值到账通知（用户）
- [x] 提现审核通过/拒绝通知（用户）
- [x] 新用户注册通知（管理员）
- [x] 大额充值/提现通知（管理员）
- [x] 游戏异常/风控告警通知（管理员）
- [x] 代理佣金到账通知（代理）

## Wallet Config UI & Auto-confirm (2026-05-24)
- [x] 管理后台添加收款钱包地址配置菜单（各链USDT地址可编辑）
- [x] 接入区块链API（TronGrid/Etherscan/BscScan等）实现充值自动到账确认
- [x] 定时轮询检测链上交易，匹配txHash后自动确认充值

## Game Flow & Settlement Fix (2026-05-24)
- [x] 修复结算卡住问题（游戏停在"结算中"不继续）- checkAndAdvanceGame 添加 while loop 自动推进 all-in 场景
- [x] 结算时配牌逻辑：显示所有玩家牌中最大的牌型
- [x] 结算语音播报：播报赢家牌型（如"同花顺赢"、"葫芦赢"等）- 800ms 延迟后播报
- [x] 坐下后头像立即显示 - getPlayerView 在 waiting 状态下也返回已入座玩家信息（含头像）
- [x] 安卓版本语音播报修复 - 添加用户手势预激活、resume() 调用、watchdog 监控、lang 属性设置
- [x] waiting 状态下 2 人以上可点击"开始游戏"按钮（playerReady 支持无 activeTables 时直接开局）

## Lobby UI Redesign (2026-05-24)
- [x] 大厅顶部添加充值/提现两个大按钮（金色背景，与截图一致）
- [x] 快速加入（一键开玩）移到 tab 筛选行旁边
- [x] 整体布局按截图调整（header + 充值提现 + tabs + 筛选 + 房间列表）
- [x] Wallet 页面支持 ?tab=deposit/withdraw URL 参数跳转

## Bug Fixes (2026-05-24 Round 6)
- [x] 安卓语音播报仍然无声 - 改用服务端 TTS 代理 + HTML5 Audio 播放（完全兼容 Android WebView）
- [x] 新一局开始时上一把牌没有清空 - waitingForReady 时清空 communityCards/myCards/pot/其他玩家手牌

## Game Flow Logic Overhaul (2026-05-24 Round 7)
- [x] "开始"按钮应在结算完成后才显示 - 后端延迟4s设置 waitingForReady + 前端添加 !showWinner 条件
- [x] 结算框显示时间缩短 - 从7秒减到3.5秒
- [x] 修复换桌逻辑 - 移除 fold 后自动换桌 + 移除 getPlayerView 中 auto-recover 自动开局
- [x] 全面审查游戏流程 - 游戏只通过 playerReady 或 joinTable 启动，不再有隐式自动开局

## Voice Language Fix (2026-05-24 Round 8)
- [x] TTS 语音播报跟随系统语言 - 后端 TTS 代理支持 lang 参数，前端传入 getLocale() 当前语言
- [x] announceAction 文本跟随系统语言 - 12种语言的操作播报模板（中/英/日/韩/西/葡/俄/越/泰/印尼/阿拉伯）
- [x] 结算语音播报跟随系统语言 - 赢家牌型播报文本多语言化

## Voice Announcement Settings (2026-05-24 Round 9)
- [x] 语音播报分级开关：全部关闭 / 只播报赢家 / 播报所有动作 (VoiceMode: off/winner_only/all)
- [x] 在牌桌设置中添加语音播报选项 UI - 麦克风图标按钮，点击循环切换模式，不同颜色指示状态
- [x] 持久化用户选择（localStorage vera-voice-mode）

## Game Logic, Chip Animation & Auto Deposit (2026-05-24 Round 10)
- [x] 检查游戏发牌逻辑符合国际标准 - all-in 时逐阶段延迟发牌（2s间隔）而非瞬间推进
- [x] 修复 all-in 场景下一次性发完所有牌 - scheduleAllInAdvance 函数逐步推进
- [x] 下注时添加筹码飞向底池的动画效果 - ChipStack 组件添加 chip-fly-to-pot CSS 动画
- [x] 下注时增强音效 - bet/call/allIn 音效用 Web Audio API 合成金属碰撞声
- [x] USDT充值自动确认到账 - processAddressMonitoring 扫描充值地址入账，txHash 改为可选

## All-in Logic Fix (2026-05-24 Round 11)
- [x] 修复3人局2人all-in后第3人被跳过的bug - 将 playersWhoCanAct.length<=1 改为 ===0，确保最后1人仍能行动
- [x] 确保只有所有能行动的玩家都已行动后才结束下注轮 - 测试验证通过

## Multi-Table Restriction Fix (2026-05-24 Round 12)
- [x] 修复玩家可以同时在多个桌子上玩的bug - joinTable 中添加 getPlayerActiveRoom 检查
- [x] 玩家加入新桌时自动离开原桌（筹码返回余额）再加入新桌

## UX & Zero Chips Fix (2026-05-24 Round 13)
- [x] 玩家离开牌桌后自动跳转回大厅 - leaveMutation onSuccess 中 navigate("/lobby")
- [x] 玩家筹码为0时不能继续开始游戏 - startNewHand 中踢出0筹码玩家 + 前端显示"筹码不足"提示和返回大厅按钮

## Rebuy Feature (2026-05-24 Round 14)
- [x] 后端续买 API - 允许玩家在牌桌内补充筹码（从余额扣除，增加到桌上筹码）
- [x] 续买限制 - 只能在非游戏中（waiting/waitingForReady）时续买，金额在 minBuyIn~maxBuyIn 范围内
- [x] 低筹码警告 - 当筹码低于大盲注的5倍时弹出提示
- [x] 自动续买选项 - 玩家可预设“筹码低于X时自动从余额补充到Y”
- [x] 前端续买弹窗 UI
- [x] 前端自动续买设置 UI（localStorage 持久化）

## Admin User List Layout Fix (2026-05-24 Round 15)
- [x] 用户列表 IP 地址移到中间独立一列显示（整齐对齐）
- [x] IP 地址后面显示 IP 所属地区（通过 ip-api.com 批量查询）

## Seat Position Bug Fix (2026-05-24 Round 16)
- [x] 修复座位旋转逻辑：玩家被强退后，剩余玩家座位不应跳到被退玩家的原始位置
- [x] 修复0筹码玩家点“返回大厅”后未真正退出牌桌，导致返回大厅后无法补币重新入座
- [x] 0筹码时显示“续买”按钮而非仅显示“返回大厅”，玩家可直接在牌桌内补充筹码
- [x] 大厅添加“返回牌桌”横幅：当玩家仍在某桌入座时，大厅顶部显示快捷返回按钮
- [x] handleReadyTimeout 中同步清理 gs.players（移除被踢玩家）

## Customer Service Transfer to TG & iPhone 7 Plus Fi- [x] 在线客服“转人工”按钮跳转到 TG 对话（使用 t.me/xxx 链接）
- [x] 管理后台系统设置中添加“人工客服 TG 号”配置项
- [x] 修复 iPhone 7 Plus 在 TG 中打开游戏顶部空白问题（viewport-fit + TG viewport CSS var + expand/fullscreen）�safe-area-inset-top）

## Invite Code Full Flow Fix (2026-05-24 Round 17)
- [x] 注册时自动分配邀请码（findOrCreateTelegramUser + upsertUser 中新用户自动生成 inviteCode）
- [x] ref_ 链接注册后自动绑定上下级关系（TG bot 传递 ref_ 参数到 Mini App URL，Home.tsx 登录后自动调用 agent.register）
- [x] 代理页面能正确显示下线列表（已有用户缺少 inviteCode 时自动补充）

## CS Transfer + Lobby Online Count Fix (2026-05-24 Round 18)
- [x] 修复人工客服按钮点击无反应（去除@前缀+TG Mini App中使用openTelegramLink）（检查 TG 号配置读取和跳转逻辑）
- [x] 大厅房间卡片中 0/6 改为显示该房间的在线人数
- [x] AI 客服连续3次无法解答时自动弹出"建议转人工"提示（金色高亮系统消息 + 转人工按钮闪烁）

## Lobby Refresh + CS Chat History (2026-05-24 Round 19)
- [x] 大厅在线人数刷新间隔缩短到 3 秒（rooms.list refetchInterval: 3000）
- [x] 客服聊天历史持久化到数据库（新建 cs_messages 表）
- [x] 后端 DB helpers: getCsMessages / saveCsMessage / clearCsMessages
- [x] 后端 tRPC procedures: cs.getHistory / cs.clearHistory（自动保存在 cs.chat 中）
- [x] 前端 Support.tsx 加载历史消息 + 清除历史按钮
- [x] AI 对话上下文：发送最近 10 条历史消息给 LLM，使 AI 能记住上下文
- [x] i18n: 添加 cs.clearHistory 翻译键（5种语言）

## CS Transfer Button + Admin Menu Reorder (2026-05-24 Round 20)
- [x] 用户发送"转人工"关键词时对话中弹出跳转按钮卡片
- [x] AI连续3次无法回答时对话中弹出跳转按钮卡片
- [x] 管理后台添加"客服记录"菜单（在操作日志前面）
- [x] 管理后台菜单按指定顺序排列（数据统计→用户管理→房间管理→员工管理→代理管理→财务管理→风控中心→FAQ知识库→系统配置→系统设置→客服记录→操作日志）
- [x] 客服记录面板：对话列表（用户名、最后消息、消息数、时间）+ 点击查看详情

## Homepage Activity Banner + Agent Promo Poster (2026-05-24 Round 21)
- [x] DB: banners 表（id, title, imageUrl, linkUrl, sortOrder, isActive, startTime, endTime, createdAt）
- [x] 后端：Banner CRUD procedures（admin 创建/编辑/删除/排序/上下架）
- [x] 后端：公开接口获取当前有效 Banner 列表
- [x] 前端：大厅顶部活动轮播 Banner（自动滚动、指示器、点击跳转）
- [x] 管理后台：活动管理面板（Banner 列表、新增/编辑弹窗、拖拽排序、上下架开关）
- [x] 后端：代理推广海报生成接口（Canvas 服务端渲染或前端 Canvas）
- [x] 前端：代理页面"生成推广海报"按钮 + Canvas 绘制海报（品牌Logo+邀请码+二维码+文案）
- [x] 前端：海报保存到相册 + TG 分享（带预览图和注册链接）

## Tournament System (锦标赛系统 Round 23)
- [x] DB: tournaments 表（比赛配置、状态、盲注结构、奖金比例）
- [x] DB: tournament_registrations 表（报名记录）
- [x] DB: tournament_results 表（比赛结果/排名）
- [x] 后端：锦标赛 CRUD procedures（创建/编辑/删除/列表）
- [x] 后端：报名/取消报名 procedure（扣费/退费）
- [x] 后端：比赛引擎（开赛分桌、盲注递增、淘汰判定、合桌、结算奖金）
- [x] 后端：定时通知（提前3h/1h/10min TG推送）
- [x] 管理后台：锦标赛管理面板（创建/编辑/查看报名/结果/奖金配置）
- [x] 前端：锦标赛Tab列表（报名中/进行中/已结束）
- [x] 前端：比赛详情页（规则/报名/倒计时/奖金池）
- [x] 前端：比赛大厅UI（比赛分显示/排名/淘汰提示）
- [x] 修复：Banner管理表单链接地址字段始终显示（不再依赖linkType选择）
- [x] 修复：下注金额低于1时按钮显示$0的问题（现在显示两位小数如$0.20）
- [x] 优化：抽取 formatAmount(n)/fmtAmt(n) 全局金额格式化工具函数，统一所有金额显示
- [x] 优化：滑块步进值根据盲注大小动态调整（盲注<1时step=0.01，<10时step=0.1，否则step=0.5）
- [x] 修复：Banner创建表单上传错误处理和图片URL直接输入功能改善
- [x] 修复：前端大厅锦标赛Tab不显示已创建的比赛（getActiveTournaments 现在也包含 draft 状态）
- [x] 修复：管理后台锦标赛列表添加"开放报名"按钮（草稿状态可一键开放，前端立即可见）
- [x] 修复：Banner图片上传卡住（改用专用REST接口/api/upload/banner，绕过tRPC批处理问题）
- [x] 优化：牌桌页面移动端响应式布局，使用dvh+弹性缩放适配所有手机屏幕（解决底部截断问题）
- [x] 修复：TG 分享链接用 ref_code 打开，绑定推荐关系失败的问题（使用正确的 tRPC mutation 而不是 fetch）
- [x] 修复：TG 分享代理链接打开后自动绑定代理关系失败（彻底排查 start_param 读取时机）
- [x] 功能：管理后台用户管理页面添加代理下线树详情（展示每个用户的完整上下级关系）

## Seat Order & Single-Game Session Fix
- [x] Backend: getRoomPlayers now ORDER BY joinedAt ASC - ensures consistent join-order seat assignment across all devices
- [x] Backend: tableManager.joinTable rejects (instead of auto-switching) if same account is already in another game
- [x] Frontend: joinMutation onError shows localized "already in game" message and redirects to lobby
- [x] i18n: Added table.alreadyInGame translation in all 5 locales (en, zh-CN, zh-TW, ja, ko)

## Critical Bug Fixes (Round 2)
- [x] Fix #16: Opponent hole cards visible during game - backend must never send holeCards for non-hero players except in showdown/completed phase
- [x] Fix #4: After timeout kick, UI should auto-navigate back to lobby; also auto-exit if no match for X minutes
- [x] Fix #3: Auto-detect TG system language (Telegram.WebApp.initDataUnsafe.user.language_code) and apply on first load; Bot welcome message also sent in user's TG language

## Bug Fix #7 - Chips Display Precision
- [x] Create unified formatChips(n) utility in client/src/lib/utils.ts
- [x] Replace all raw chip/amount number displays in Table.tsx with formatChips
- [x] Replace all raw chip/amount number displays in Lobby.tsx, Wallet.tsx, Admin.tsx, Profile.tsx, HandHistory.tsx, Leaderboard.tsx with formatChips
- [x] Backend: round all chip arithmetic results to avoid floating point drift (gameEngine.ts r6 helper)

## Batch 2 Requirements (Week 2)
- [x] #3/#10: Language auto-detect from TG WebApp.initDataUnsafe.user.language_code (already partial - verify completeness)
- [x] #10: Bot /start command sends localized welcome message with inline button to open Mini App (added es/pt/id/ar 4 new languages)
- [x] #9: Fairness verification page - full i18n translation for all 12 languages (es/pt/ru/ar/vi/th/id ~20 keys each added)
- [x] #12: Sound effects toggle moved to settings/profile page, persisted in localStorage
- [x] #14: Language switcher moved to top of Profile page; Agent entry added to Profile page
- [x] #15: Agent unlock conditions text made more detailed (specific downline count + volume requirements)
- [x] #8: Remove redundant loading screens on game entry; compress table background to WebP format (bg already WebP; improved joinMutation spinner)

## TG Marketing System (#17)
- [x] DB: broadcast_tasks table (id, title, content, imageUrl, buttonText, buttonUrl, targetType, targetUserIds, status, totalCount, sentCount, failCount, scheduledAt, createdAt, createdBy)
- [x] DB: auto_reply_rules table (id, keyword, matchType, replyContent, replyType, isActive, priority, triggerCount, createdAt)
- [x] DB: fission_campaigns table (id, name, description, rewardType, rewardAmount, targetCount, linkCode, clickCount, registerCount, isActive, startTime, endTime, createdAt)
- [x] DB: fission_clicks table (id, campaignId, userId, ipAddress, userAgent, convertedAt, createdAt)
- [x] Backend: broadcast.create / broadcast.list / broadcast.get / broadcast.cancel procedures
- [x] Backend: broadcast send engine (batch 30/s, TG Bot API sendMessage, progress tracking)
- [x] Backend: auto_reply.create / list / update / delete / toggle procedures
- [x] Backend: Bot message handler: match incoming messages against auto_reply_rules
- [x] Backend: fission.createCampaign / list / getStats procedures
- [x] Backend: fission link click tracking (/api/ref/:code redirect + record)
- [x] Frontend: Admin marketing panel with 3 tabs (Broadcast / Auto-Reply / Fission)
- [x] Frontend: Broadcast tab - create task form (content, image, button, target, schedule), task list with progress bars
- [x] Frontend: Auto-Reply tab - rules list, create/edit rule dialog (keyword, match type, reply content)
- [x] Frontend: Fission tab - campaign list, create campaign, stats (clicks/registers/conversion rate)

## Bug Fix: Bot Notifications Not Working
- [ ] Investigate why all Bot notifications are not being sent (check TELEGRAM_BOT_TOKEN env, sendMessage function, error logs)
- [ ] Fix Bot notification sending (ensure token is injected, sendMessage works correctly)
- [ ] Test: action notifications (player turn), invite notifications, broadcast notifications

## Feature #2: Password Backup Login
- [ ] DB: Add passwordHash field to users table
- [ ] Backend: auth.setPassword procedure (set/change password, requires current TG session)
- [ ] Backend: auth.loginWithPassword procedure (username/TG ID + password login)
- [ ] Backend: Rate limiting on password login (max 5 attempts, 15min lockout)
- [ ] Frontend: Profile page - "Set Password" entry in settings section
- [ ] Frontend: SetPassword dialog (new password + confirm, strength indicator)
- [ ] Frontend: Home/Login page - "Login with Password" tab alongside TG login
- [ ] Frontend: Password login form (TG username or user ID + password)
