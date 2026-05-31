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

## Feature: Private Room Invite Poster
- [x] Install qrcode + html2canvas dependencies
- [x] Create RoomInvitePoster component (Canvas-based, 750x1200, dark poker theme)
- [x] QR code generation pointing to TG bot invite link
- [x] Room info cards (blinds, buy-in, players) displayed on poster
- [x] Download button (saves PNG to device)
- [x] Share to TG button (opens TG share dialog)
- [x] Integrate poster button into CreateRoom.tsx success screen
- [x] Integrate poster icon button into Table.tsx header (private rooms only)
- [x] Add room.generatePoster i18n key for all 12 languages
- [x] TypeScript type errors resolved
- [x] All 103 tests passing

## Bug Fix: Game Flow - Settlement/Leave Crash
- [x] Fix "cannot read properties of undefined (reading id)" after settlement
- [x] Add isLeavingRef to prevent roomPlayers re-query triggering showBuyIn after leave
- [x] Add roomClosed field to tableState response when room status=closed (totalRounds reached)
- [x] Detect roomClosed in kickDetected logic, navigate directly without calling leaveMutation
- [x] Guard showBuyIn trigger: skip when room.status=closed or isLeavingRef=true
- [x] Continue polling tableState briefly after unseated to detect roomClosed
- [x] All 103 tests passing

## Feature: Tournament Bot Notifications
- [x] notifications.ts: Add notifyTournamentRegistered() - notify player on successful registration
- [x] notifications.ts: Add notifyTournamentCancelled() - notify player on cancellation + refund
- [x] notifications.ts: Add notifyTournamentStartingSoon() - notify registered players before start
- [x] notifications.ts: Add notifyTournamentResult() - notify player of final ranking + prize
- [x] routers.ts: Call notifyTournamentRegistered + notifyAdmins in tournaments.register
- [x] routers.ts: Call notifyTournamentCancelled in tournaments.cancelRegistration

## Feature: Multi-Admin Chat ID Support
- [x] notifications.ts: notifyAdmins() already supports comma-separated Chat IDs (split + send to all)
- [x] Admin.tsx: Update adminTgChatIdDesc to explain comma-separated format (e.g. 123456789,987654321)
- [x] Admin.tsx: Update adminTgChatIdUnset hint to mention comma-separated support

## Feature: Withdrawal Minimum Limit (20 USDT)
- [x] Wallet.tsx: handleWithdraw validates amount >= 20 USDT before submitting
- [x] Wallet.tsx: Add gold hint box below withdraw amount input showing minimum 20 USDT
- [x] i18n.ts: Add wallet.minWithdraw key for all 12 languages
- [x] i18n.ts: Add wallet.minWithdrawHint key for all 12 languages

## Feature: Tournament Start & Prize Notifications
- [x] routers.ts: adminTournaments.start - batch notify all registered players "tournament starting"
- [x] routers.ts: adminTournaments.distributePrizes - new route: calculate prizes, credit balances, save results, notify each player with rank + prize
- [x] Admin.tsx: Add "发放奖金" button for running tournaments that calls distributePrizes
- [x] Admin.tsx: distributePrizeMutation wired to new backend route

## Feature: Tournament Start & Prize Notifications
- [x] routers.ts: adminTournaments.start - batch notify all registered players "tournament starting"
- [x] routers.ts: adminTournaments.distributePrizes - new route: calculate prizes, credit balances, save results, notify each player with rank + prize
- [x] Admin.tsx: Add "发放奖金" button for running tournaments that calls distributePrizes
- [x] Admin.tsx: distributePrizeMutation wired to new backend route

## Bug Fix: 玩家刚进入牌局就被踢出
- [x] Table.tsx: kicked 检测加入 joinPendingRef 保护，防止 joinMutation 完成后 tableState 刷新前误判被踢
- [x] Table.tsx: isSeated 设为 true 后再等一个 tableState 刷新周期再开始 kicked 检测

## 2026-05-28 四项功能完成
- [x] 问题3：房间管理筛选（初级/中级/高级/VIP/全部）+ 状态筛选 + 桌子张数统计 + 一键复制牌桌
- [x] 问题1：结算界面不重复显示（localStorage handNumber 去重）
- [x] 问题2：僵尸玩家自动踢出（连续3局超时auto-fold后踢出并退还筹码）
- [x] 问题4：大厅/游戏场 i18n 补全（12种语言 table.roomClosed + 移除硬编码中文fallback）

## 2026-05-28 私人房功能
- [x] 私人房打完一局自动解散：退还筹码到余额、清空玩家、销毁房间号（inviteCode=null）、状态变为closed
- [x] 房间管理增加「公开/私人房」类型筛选按钮
- [x] 买入弹窗移到游戏桌内（Lobby 点入座直接跳转，Table.tsx 内弹出全屏买入弹窗）
- [x] 游戏桌全屏自适应布局（fixed 定位 100vw/100dvh，消除 iPhone 7 Plus 空白）

## Bug Fix: 游戏逻辑 - 过牌不推进 + 不结算
- [x] Bug 1: processPlayerAction 增加 showdown/dealing 阶段拦截，防止 4s 延迟期间过期操作触发错误
- [x] Bug 2: checkAndAdvanceGame 改为 while 循环（最多5次），确保连续过牌后每个阶段都能正确推进
- [x] Bug 3: advancePhase 接受 bigBlind 参数，翻牌后 minRaise 正确初始化为大盲注而非 0
- [x] Bug 4: tableManager 所有 advancePhase 调用传入 table.bigBlind
- [x] TypeScript 零错误，103 个测试全部通过

## Bug Fix: 重入座被踢 + 结算动画不显示
- [x] Bug 1: 退出后重入座第一次被强返大厅 - kickDetectedRef/joinSettledRef 在离桌后未重置，新增 prevIsSeatedRef 监听入座变化时完整重置
- [x] Bug 2: isBettingRoundComplete 未处理 currentPlayerIndex=-1 - 增加 -1 即返回 true 的逻辑
- [x] Bug 3: 结算动画不显示（轮询竞态条件）- 重写 winner 检测 useEffect，用 handNumber 作为唯一标识替代 winnerKey 变化检测
- [x] Bug 5: localStorage hasSeenSettlement 在服务器重启后 handNumber 重置导致误判 - 完全移除 localStorage 去重机制，改用纯内存 lastSettledHandRef
- [x] Bug 4: actionMutation.onError 对状态不一致错误改为静默刷新（不弹 toast）
- [x] TypeScript 零错误，103 个测试全部通过

- [x] 修复小屏幕（iPhone 7 Plus）游戏桌面显示不完整
- [x] 进度条改为竖向，避免下注时底部菜单高度变化
- [x] 固定底部操作区高度，消除菜单跳动

## Feature: 游戏体验增强 5 项
- [x] 修复手牌花色重叠问题（CardView rank+suit 并排显示，小字体，不重叠）
- [x] 翻牌动画（CardView flip prop + CSS @keyframes flip-card 3D 翻转效果）
- [x] Showdown 逐个亮牌（按 showdownRevealOrder 顺序，每张间隔 600ms，revealedOpponentIds state 控制）
- [x] 赢家筹码飞行动画（animate-chips-fly CSS 动画，从底池区域向上飞出）
- [x] 实时牌力显示（flop/turn/river 阶段在 hero 手牌下方显示牌力，calcHandStrengthKey 返回 i18n 键，t() 多语言展示，听牌文案已添加 hand.draw.* 多语言键）
- [x] TypeScript 零错误，103 个测试全部通过

## 2026-05-29 UI 三项修复
- [x] 进度条从右侧移到左侧，避免遮住右侧玩家手牌
- [x] 牌面颜色提亮：红色改为鲜红 #e8000a，黑色改为深黑 #111111，中心花色完全不透明
- [x] 发牌动画：手牌从上方飞入，两张牌错开 180ms，preflop 阶段自动触发
- [x] TypeScript 零错误，103 个测试全部通过

## 2026-05-29 游戏逻辑两项功能
- [x] 超时自动 Check/Fold：倒计时归零 → 能 Check 就 Check，面对加注则 Fold
- [x] 等待大盲机制：新玩家进桌观战，当前局结束后自动入座参与下一局
- [x] 前端 UI：等待大盲玩家座位显示琥珀色"等待大盲"标签，操作区显示"等待下一局将自动参与"提示
- [x] TypeScript 零错误，103 个测试全部通过

## 2026-05-29 新手教程 + AI 客服规则说明
- [x] AI 客服系统提示词中增加德州扑克规则、手牌排行、结算说明
- [x] 新建新手教程页面：手牌排行榜（10种牌型）+ 游戏流程 + 结算说明 + 操作说明
- [x] 大厅、Profile、Support 客服页均添加新手教程入口；Support 添加快捷问题按鈕
- [x] TypeScript 零错误，103 个测试全部通过

## 2026-05-31 Admin.tsx Toast 翻译 + 全局中文回退清理
- [x] Admin.tsx: adminI18n 中添加 banner/tournament toast 翻译键（zh-CN/zh-TW/en 三语）
- [x] Admin.tsx: BannersPanel 中 7 个硬编码中文 toast 替换为 at() 调用
- [x] Admin.tsx: TournamentsPanel 中 8 个硬编码中文 toast 替换为 at() 调用
- [x] Admin.tsx: CopyableUrl 组件使用 useAdminLang 获取翻译
- [x] Lobby.tsx: 移除 lobby.playersOnline / lobby.findingTable 中文回退
- [x] Table.tsx: 移除 table.waitingForNextHand / alreadySeatedOtherDevice / waitingBigBlind / allInConfirm / switchTableFailed 中文回退
- [x] Wallet.tsx: 移除 wallet.enterAmountFirst / minDeposit / minWithdraw / minDepositHint / minWithdrawHint 中文回退
- [x] Agent.tsx: 移除所有 poster 相关中文回退（15处）
- [x] Profile.tsx: 备用密码 toast 改用 t() 调用
- [x] i18n.ts: 补充 lobby.playersOnline / lobby.findingTable / table.waitingForNextHand / table.alreadySeatedOtherDevice / table.waitingBigBlind / profile.backupPassword* / admin.banner* 翻译键（12种语言）
- [x] Toaster duration 从 1500ms 改为 1000ms
- [x] TypeScript 零错误

## 2026-05-31 三项修复
- [x] 代理佣金显示为0：修复三个问题 - 1) 未解锁时也写入 pending 佣金记录 2) 移除 totalDeposit>=10 解锁条件 3) 修复 SQL 列名 commission_amount → commissionAmount
- [x] 锦标赛开始后无牌桌/无法进入游戏：重写 tournamentEngine.ts 与 tableManager 集成，创建真实房间并分配玩家
- [x] 全押结算界面金额错误：修复 Table.tsx 中每个赢家显示自己的赢得金额而非最大赢家金额

## 2026-05-31 代理管理增强 + 风控管理 + AI分析 + 告警通知

### 代理管理增强
- [x] 代理关系列表显示TG用户名、昵称
- [x] 代理详情面板：点击展开代理线详细玩家信息
- [x] 解锁进度详情：显示 gamesPlayed/totalRake 进度条
- [x] 手动解锁/锁定代理关系按钮
- [x] 代理佣金汇总（已结算/待结算/累计）

### 风控管理模块
- [x] DB: 创建 risk_rules 表（规则配置）
- [x] DB: 创建 risk_alerts 表（告警记录）
- [x] 后端: 风控规则 CRUD 接口
- [x] 后端: 风控检测引擎（在关键操作时触发检测）
- [x] 前端: 风控管理面板（规则列表、开关、阈值配置）
- [x] 前端: 告警列表面板（未处理/已处理/已忽略）

### 用户收益线索图 + AI分析
- [x] 后端: 用户资金流水汇总接口（所有收益来源）
- [x] 后端: AI分析接口（调用LLM分析用户行为模式）
- [x] 前端: 用户收益线索图（时间轴+分类展示）
- [x] 前端: AI风险评分展示（评分+标签+分析理由）

### 风控告警通知
- [x] 后端: 风控告警触发时自动发送Bot通知
- [x] 后端: 告警状态管理（处理/忽略）
- [x] 前端: 告警通知面板集成到Admin
