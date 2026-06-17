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

## 2026-05-31 余额异常 + UI修改

- [x] 排查 QQXL9999 账号余额自动减少原因：updateUserBalance 函数被错误使用（设绝对值而非增减）
- [x] 修复余额异常减少的 bug：所有 updateUserBalance 改为 deductUserBalanceAtomic/addUserBalanceAtomic，恢复7个受影响用户余额（user 31800 余额偏高未调整）
- [x] Lobby 顶部：将 "Vera Poker / 真相发牌" 替换为用户头像+用户名+TG用户名

## 2026-05-31 锦标赛流程修复

- [x] 锦标赛牌桌自动开始下一局（不需要手动点 Ready）
- [x] 锦标赛中禁止离开（隐藏离开按钮）
- [x] 前端识别锦标赛牌桌（显示盲注级别、剩余人数等）
- [x] 淘汰时显示排名信息而非 kicked 提示
- [x] 锦标赛结束时显示最终排名和奖金

## 2026-05-31 锦标赛三项 Bug 修复

- [x] Bug 1: 总局数设置无效 → 添加 incrementHandCount + forceFinishByChips 逻辑，达到 totalRounds 时按筹码排名强制结束
- [x] Bug 2: 比赛结果卡住 → finishTournament/forceFinishByChips 中 removeActiveTable + 延迟清理 activeTournaments，前端检测 isFinished 正确导航
- [x] Bug 3: 牌力判断错误 → 修复 wheel straight kicker（A-2-3-4-5 高牌应为5而非14）+ side pot 显示优先显示最强牌力赢家

## 2026-05-31 六项功能需求

- [x] 1. 所有按钮点击声音（全局 click 音效 - useClickSound hook + App.tsx 事件委托）
- [x] 2. 比赛结果通知所有参赛者（含第1/2/3名奖金明细 - notifyTournamentResult 增加 topRankings 参数）
- [x] 3. 管理后台锦标赛详情（比赛结束后可查看详细比赛数据 - Detail Modal with results table）
- [x] 4. 验证 totalRounds=2 限制逻辑正确性（incrementHandCount + forceFinishByChips 链路完整）
- [x] 5. 锦标赛断线重连（Lobby 检测进行中锦标赛自动跳转 - trpc.tournaments.myTable + useEffect navigate）
- [x] 6. 个人中心锦标赛历史页面（参赛记录+排名+奖金 - TournamentHistorySection in Profile.tsx）

## 2026-05-31 锦标赛排行榜

- [x] 后端：添加锦标赛排行榜查询接口（冠军榜 + 总奖金榜）
- [x] 前端：大厅添加排行榜 Tab/面板展示

## 2026-05-31 比赛结束提示优化

- [x] 比赛结束时在牌桌显示醒目的结束弹窗（排名、奖金、返回大厅按钮）

## 2026-05-31 用户名显示改为 TG 名

- [x] Lobby 顶部用户名优先显示 TG 名（tgUsername）
- [x] 比赛结果通知中玩家名显示 TG 名
- [x] 排行榜中玩家名显示 TG 名
- [x] 牌桌上玩家名显示 TG 名
- [x] 锦标赛详情/结果中玩家名显示 TG 名

## 2026-05-31 注册送现金（含防薅羊毛机制）

- [x] 数据库：users 表添加 bonus_balance 字段（赠送余额，独立于可提现余额）
- [x] 数据库：system_configs 添加注册奖金配置项（金额、解锁条件）
- [x] 后端：新用户注册时自动发放奖金到 bonus_balance
- [x] 后端：bonus_balance 可用于游戏下注，但提现时需满足解锁条件
- [x] 后端：解锁条件 = 有效手数 >= N 且 总下注流水 >= 奖金 * M 倍
- [x] 管理后台：系统设置中添加注册奖金金额和解锁条件配置
- [x] 前端：钱包页面显示赠送余额和解锁进度
- [x] 前端：提现时如未解锁则提示解锁条件
- [x] 未充值用户不能进入私人房（加入时检查 totalDeposited > 0，否则提示先充值）

## 2026-05-31 UI 修复

- [x] Lobby 顶部适配 iPhone 安全区域（TG Mini App 状态栏空隙）- viewport-fit=cover + safe-top class
- [x] 全项目用户名统一显示 TG 昵称（nickname），不显示 @username（防止暴露联系方式）
- [x] Profile.tsx 个人资料页去掉 @username 显示
- [x] 管理后台保留 @username 显示（管理员需要联系玩家）

## 2026-05-31 七项功能需求

### 1. 营销群发系统（管理后台）
- [x] 后端：获取 Bot 所有关注用户列表接口（从 TG Bot API 获取 + 本地 users 表匹配）
- [x] 后端：群发消息接口（支持图片+文案+按钮，调用 TG Bot sendPhoto/sendMessage）
- [x] 后端：群发历史记录存储
- [x] 前端：营销面板 - 用户列表展示（TG昵称、注册时间、最后活跃）
- [x] 前端：消息编辑器（图片上传、文案编辑、inline keyboard 按钮配置）
- [x] 前端：群发执行 + 进度展示 + 历史记录

### 2. Admin at() 回退清理
- [x] 移除 Admin.tsx 中约 35 处 at("key") || "中文" 格式的回退，已将所有 key 添加到 adminI18n 三语言字典

### 3. 阿拉伯语 RTL 布局适配
- [x] 根据语言动态设置 html dir="rtl"（已在 i18n.ts 中实现）
- [x] 关键布局组件 RTL 兼容

### 4. 新用户引导弹窗
- [x] 首次进入大厅弹出欢迎弹窗（注册奖金提示 + 解锁规则 + 引导去公共房）

### 5. TG Bot 比赛倒计时推送
- [x] 比赛开始前 5 分钟通过 Bot 推送提醒所有已报名玩家（已有 tournamentReminders 实现 3h/1h/10min 提醒）

### 6. 奖金解锁成功通知
- [x] 用户达成解锁条件时通过 TG Bot 推送恭喜消息

### 7. 管理后台奖金状态列
- [x] 用户管理列表增加“奖金状态”列（已解锁/进度百分比）

## 2026-05-31 iOS TG Mini App 顶部空白修复（第二轮）

- [x] 研究根本原因：iOS WebView 不支持标准 env(safe-area-inset-*)，需要用 TG 自带 CSS 变量 + visualViewport API
- [x] main.tsx 添加 visualViewport 高度同步 + 防 overscroll + 早期 expand()
- [x] index.css safe-top/safe-bottom 改用 var(--tg-content-safe-area-inset-*) 优先
- [x] index.html viewport meta 添加 shrink-to-fit=no
- [x] 防止 body rubber-banding（touchmove 拦截，允许内部滚动容器）

## 2026-05-31 iOS 滚动修复（第三轮 - 回退过度拦截）

- [x] 移除 main.tsx 中 visualViewport 高度锁定（导致内容被截断）
- [x] 移除 main.tsx 中 touchmove 拦截（导致所有页面无法滚动）
- [x] 移除 main.tsx 中 window.scrollTo(0,0) 强制锁定（阻止正常滚动）
- [x] 保留 tg.ready() + tg.expand() + setHeaderColor/setBackgroundColor('#1a1a2e') 使顶部色带与 app 背景融合
- [x] index.css 移除 touch-action: pan-x pan-y（阻止了正常触摸滚动）
- [x] App.tsx MobileContainer 内层从 overflow-hidden 改为 overflow-y-auto（允许页面垂直滚动）
- [x] 保留 overscroll-behavior: none（CSS 层面防止 rubber-banding，不阻止正常滚动）
- [x] TypeScript 零错误，152 个测试全部通过

## 2026-06-01 营销系统三项增强

### 需求2：消息模板 - 图片上传 + 按钮编辑
- [x] 后端：新增图片上传接口（/api/upload/marketing，S3 storagePut）
- [x] 前端：群发编辑器中 imageUrl 输入框改为 ImageUploader 组件（上传按钮+URL输入双模式）
- [x] 数据库：新增 message_templates 表（可保存复用的消息模板）
- [x] 前端：消息模板管理 Tab（创建/编辑/删除模板）
- [x] 前端：模板编辑器包含图片上传、文案编辑、多按钮 inline keyboard 配置

### 需求3：群发增加玩家筛选功能
- [x] 数据库：broadcastTasks 增加 targetFilter JSON 字段（组合筛选条件）
- [x] 后端：resolveBroadcastTargetsWithFilter 支持动态筛选条件（语言/注册时间/充值金额/活跃时间/游戏局数/奖金状态）
- [x] 前端：群发编辑器增加 TargetFilterEditor 组件（多维度组合筛选）
- [x] 前端：实时预估目标人数显示（estimateTargetCount 接口）

### 需求1：首次关注多语言欢迎消息
- [x] 数据库：新增 welcome_templates 表（language, content, imageUrl, buttons JSON, isActive）
- [x] 后端：管理后台 CRUD 接口（每种语言独立配置欢迎消息）
- [x] 前端：管理后台「欢迎消息」配置面板（WelcomePanel，多语言列表+图片上传+按钮编辑）
- [x] 后端：webhook /start 逻辑改造 - 读取 language_code → getWelcomeTemplateByLanguage → sendPhoto/sendMessage 带图片+caption+buttons
- [x] 后端：语言 fallback 逻辑（精确匹配 → 前缀匹配 → en 兜底）

## 2026-06-01 安全审计漏洞修复

### Critical
- [x] #1 提现竞态条件 - 改为原子 SQL 条件更新
- [x] #2 SQL 注入（营销筛选）- 改为 Drizzle ORM 参数化查询
- [x] #3 充值双重确认 - confirmDepositById 添加原子条件更新

### High
- [x] #4 管理员 Token 伪造 - 移除 fallback secret
- [x] #5 Telegram Webhook 无签名验证 - 添加 secret_token 验证
- [x] #6 postMessage targetOrigin 通配符 - 改为明确 origin
- [x] #7 无速率限制 - 添加登录速率限制

### Medium
- [x] #8 admin updateUser 余额修改无审计 - 添加审计日志
- [x] #9 txHash 重放攻击 - 添加唯一性检查
- [x] #10 定时任务堆栈信息泄露 - 生产环境隐藏堆栈

### Low
- [x] #11 SameSite=None CSRF - 改为 SameSite=Lax
- [x] #12 默认密码硬编码 - 改为随机生成并通知 Owner

## 2026-06-01 三项修复

- [x] #1 webhook secret 自动配置：管理后台设置 tg_webhook_secret 时自动调用 setWebhook API 传入 secret_token
- [x] #2 提现手续费改为固定U金额（不按百分比）
- [x] #3 新手教程返回大厅显示404 - 修复路由，返回按钮应直接导航到游戏大厅

## 2026-06-01 游戏体验优化

- [x] #1 游戏操作延迟优化：轮询间隔从2s降至800ms，自己回合加速到500ms，操作后立即invalidate+乐观更新，后端添加玩家信息缓存
- [x] #2 游戏弹窗消息翻译：添加 translateError 函数将后端英文错误消息映射为 i18n key，支持中/繁/英
- [x] #3 结算提示增强：all-in runout 时显示「全押摊牌」通知，进入 showdown 时显示「进入摊牌」通知

## 2026-06-01 头像倒计时进度环

- [x] 将当前操作玩家头像的 animate-pulse 黄色圈改为 SVG 圆环倒计时进度条
- [x] 进度条颜色随时间变化：>10s 金色、5-10s 橙色、<5s 红色闪烁
- [x] 右下角显示倒计时秒数 badge
- [x] 对所有玩家（不仅自己）都显示倒计时环，让对方操作时也能看到剩余时间
- [x] 最后5秒进度条脉冲闪烁 + 发光效果增强紧迫感

## 2026-06-01 比牌提示 + 错误消息翻译补全

- [x] #1 比牌时增加视觉提示：showdown 阶段在牌桌中央显示「比牌中...」横幅（金色脉冲动画）
- [x] #2 "Cannot raise more than your stack" 等错误消息翻译补全：新增 5 个 error key（raiseExceedsStack/minimumRaise/roomNotAvailable/noAvailableSeats/cannotLeaveTournament），中/繁/英三语
- [x] #3 比牌提示 i18n key（table.comparingHands）添加到中/繁/英三语

## 2026-06-01 比牌体验增强三项

- [x] #1 加注上限提示前置：raise slider 拖到最大值时显示「已达筹码上限」灰色提示
- [x] #2 比牌动画增强：showdown 时逐个翻开各玩家手牌 + 牌力文字标签（赢家金色发光，输家暗色），hero 也显示最终牌力
- [x] #3 比牌音效：showdown 阶段每个对手翻牌时播放 cardFlip 音效（已有，间隔600ms）

## 2026-06-01 牌局回放功能

- [x] 数据库：gameHands 表新增 actionTimeline + playerSnapshot JSON 列
- [x] 后端：settleHand 时自动保存完整操作时间线和玩家快照
- [x] 后端：startNewHand 初始化 timeline 并记录盲注操作
- [x] 后端：processPlayerAction 中每步操作追加到 timeline
- [x] 后端：超时自动操作也记录到 timeline
- [x] 后端：查询接口 game.myReplayList（分页）
- [x] 后端：查询接口 game.replayDetail（完整时间线）
- [x] 前端：个人中心添加「牌局回放」入口
- [x] 前端：ReplayList 页面（时间、盲注、盈亏、对手数、分页）
- [x] 前端：ReplayPlayer 回放播放器（逐步操作 + 公共牌 + 底池变化 + 结果）
- [x] i18n：添加回放相关多语言 key（中/英）

## 2026-06-01 代码清理与中文注释

- [x] 删除无用的 ComponentShowcase.tsx（未被任何路由引用）
- [x] 所有 server/*.ts 文件添加中文文件头注释
- [x] 所有 client/src/pages/*.tsx 文件添加中文文件头注释
- [x] hooks / lib / shared 文件添加中文注释
- [x] drizzle/schema.ts 所有表 section 注释中文化
- [x] gameEngine.ts 核心函数和 section 注释中文化

## 2026-06-01 用户显示名称修复

- [x] 用户注册/登录时使用 TG 显示名称（first_name + last_name）而非 username
- [x] TG 注册用户未收到注册赠送 - findOrCreateTelegramUser 中新增读取 registration_bonus_amount 配置

## 2026-06-01 平台通知全面多语言化

- [x] 创建服务端通知多语言翻译模块 (server/notificationI18n.ts)
- [x] 改造 notifications.ts 中所有通知函数支持多语言（根据用户 languageCode）
- [x] 改造 db.ts 中注册欢迎通知和 bonus unlock 通知支持多语言
- [x] 改造 formatNotification 中的固定中文文本为多语言
- [x] 支持 12 种语言（中/繁/英/日/韩/西/葡/俄/阿/越/泰/印尼）

## 2026-06-01 首次登录语言同步 + 通知偏好设置

- [x] 首次登录时自动同步 TG 语言到数据库（仅在用户未手动设置过时同步）
- [x] 通知偏好设置：数据库新增 notificationPrefs JSON 字段
- [x] 通知偏好设置：后端 API（getNotificationPrefs / updateNotificationPrefs）
- [x] 通知偏好设置：发送通知时检查用户偏好（checkNotificationPrefs）
- [x] 通知偏好设置：前端个人中心 UI（8类通知开关）

## 2026-06-01 通知偏好多语言化 + 锦标赛通知独立

- [x] 通知偏好 UI 多语言化：NotificationPrefsSection 标签扩展到 12 种语言
- [x] 锦标赛通知类型独立：新增 tournament_registered / tournament_starting / tournament_result NotificationType
- [x] 锦标赛通知偏好：typeToPrefsKey 映射锦标赛类型到 "tournament" key
- [x] 锦标赛通知多语言文案：notificationI18n.ts 已有锦标赛翻译 + tournamentReminders.ts 改用多语言
- [x] 前端通知偏好 i18n：i18n.ts 添加 profile.notifPrefs.* 翻译 key（12种语言）

## 2026-06-01 Bug 修复

- [x] 分享链接注册时，前端语言自动识别当前 TG 用户的语言（三层修复：App级别全局同步 + 后端返回 language + 每次登录更新DB）

## 2026-06-02 手牌历史牌面显示优化

- [x] 手牌历史页面：牌面从圆形图标改为白底矩形扑克牌样式（HandHistory + ReplayList + ReplayPlayer 三个页面统一更新）

## 2026-06-02 Bug 修复：中途加入玩家不应被发牌

- [x] 后端：牌局进行中新加入的玩家不应被发牌（修复：只要 activeTables 存在就标记为 sitting_out，包括 completed/ready 阶段）
- [x] 前端：等待中的玩家显示提示“等待下一局开始，将自动参与”（已有 amISittingOut UI）

## 2026-06-02 观战视角增强

- [x] sitting_out 玩家不显示操作按钮区域（弃牌/过牌/加注/全押）
- [x] sitting_out 玩家显示“观战中，下一局自动参与”的大提示
- [x] 确保 sitting_out 玩家头像边不显示任何牌面（牌背也不显示）

## 2026-06-02 Bug 修复：sitting_out 玩家退出/重入�- [x] 后端：sitting_out 玩家退出时正确清理 room_players 记录（leaveTable 已支持）
- [x] 后端：重新加入时不再误判“已在游戏中”（sitting_out 玩家重新 join 直接恢复座位）
- [x] 前端：大厅显示“返回游戏”按钮（getPlayerActiveRoom 同时查 active + sitting_out）
- [x] 前端：观战视角增强 - 操作按钮区域改为大提示“观战中” + 离开按钮 + 12种语言翻译�动参与"

## 2026-06-02 Bug 修复：新一局开始时残留上一局牌面信息

- [x] 前端/后端：新一局开始（preflop）时，清除上一局的公区牌和玩家手牌显示

## 2026-06-02 Bug 修复：玩家弃牌返回大厅导致整桌卡死

- [x] 修复：4人局中玩家弃牌后返回大厅，其他玩家卡死无法继续游戏

## 2026-06-02 优化：游戏中异常场景状态处理

- [x] 后端：玩家断网后超时处理（checkTimeouts zombie kick 同步化 + currentPlayerIndex 修正）
- [x] 后端：玩家重进游戏时正确恢复牌桌状态（getPlayerView 已正确返回当前状态）
- [x] 后端：玩家中途离开（关闭页面/返回大厅）后游戏正常推进（leaveTable + checkAndAdvanceGame 完善）
- [x] 后端：多人同时断线的极端场景处理（checkAndAdvanceGame 增加 currentPlayerIndex 有效性校验）
- [x] 后端：settlement/showdown 阶段玩家离开不影响结算（leaveTable 在 showdown/completed 不强制 fold）
- [x] 前端：断网检测和重连提示 UI（connectionLost banner + retry 按钮）
- [x] 前端：重连后正确恢复牌桌视觉状态（online/visibilitychange 事件监听 + invalidate）
- [x] 前端：网络恢复后自动刷新牌桌数据（QueryClient refetchOnReconnect/refetchOnWindowFocus: always）

## Bug Fix: Leave Table Settlement - Direct Exit Protection
- [x] Backend: game.leave returns remainingChips and newBalance to frontend
- [x] Frontend: leaveMutation onSuccess shows "+$X" toast with returned chips amount
- [x] Backend: /api/beacon-leave REST endpoint for sendBeacon-based leave on browser close
- [x] Frontend: pagehide + beforeunload events fire sendBeacon to /api/beacon-leave
- [x] Backend: reconcileOrphanedPlayers() on server startup - returns stuck chips to wallets
- [x] Backend: Tournament room detection via inviteCode prefix 'T' (safe after restart)
- [x] All 158 tests passing

## Bug Fix: Tournament (比赛场) Should Not Have Rake
- [x] settleHand: Skip rake calculation for tournament tables (rakePercent=0, rakeCap=0)
- [x] settleHand: Skip agent commission distribution for tournament tables

## Bug Fix: 5 Issues Batch Fix
- [x] 1. Settlement animation replays when player returns after being away - should only play once
- [x] 2. Tournament table shows buy-in dialog when entering - should skip for tournaments
- [x] 3. Tournament list: add register button on the right side of each tournament item
- [x] 4. Tournament start: auto-navigate to table without requiring manual refresh
- [x] 5. Table game responsiveness: reduce polling interval to minimize 1-2s delay between actions

## 2026-06-03 UI 优化 + 代码清理

- [x] SSE 实时推送替代轮询（sseHub.ts + useTableSSE.ts）
- [x] 比赛列表已报名状态标签
- [x] 牌桌操作乐观更新（Optimistic UI）
- [x] 成就徽章：插入10种成就定义数据
- [x] Profile 头像区域紧凑化（水平布局：头像左侧 + 名称/ID/TG右侧 + 余额/局数/等级统计行）
- [x] 账户信息合并为紧凑单行（注册时间 + 最后登录）
- [x] 通知设置紧凑化（移除描述段落，减少间距 py-2→py-1.5，缩小开关 w-11→w-10 h-6→h-5）
- [x] 通知设置改为2列网格布局（一行两个）+ 修复开关点击无反应（改用乐观更新 optimistic UI）
- [x] 游戏结算时操作按钮不可点击（showdown/completed/showWinner 阶段完全隐藏按钮区域 + all-in弹窗也禁用）
- [x] Bot入口路由修复（统一 tg_mini_app_url config key）
- [x] Admin.tsx 移除已删除的 MarketingPanel 引用（修复 Vite pre-transform 错误）

## 2026-06-03 比赛流水 + 钱包流水完善

- [x] 后端：比赛报名时写入 transaction 记录（type 新增 tournament_entry）
- [x] 后端：取消报名退费时写入 transaction 记录（type 新增 tournament_refund）
- [x] 后端：发放奖金时写入 transaction 记录（type 新增 tournament_prize）
- [x] 数据库：transactions.type 枚举扩展（tournament_entry, tournament_refund, tournament_prize）
- [x] 后端：financeTypes 过滤列表添加新类型 + 修复 withdrawal→withdraw 不匹配
- [x] 前端：typeLabels 添加新类型的翻译标签
- [x] 前端：isPositive 判断添加新的正向类型（tournament_refund, tournament_prize）
- [x] i18n：添加新流水类型的多语言翻译 key（11种语言全部覆盖）
- [x] tournamentEngine.ts：两个 finishTournament 函数中奖金发放同步写入流水记录

## 2026-06-03 �- [x] Admin比赛管理：显示已报名玩家数量
- [x] Admin比赛管理：显示已报名玩家列表（昵称、ID、报名时间）
- [x] 比赛中途取消：停止所有进行中的游戏
- [x] 比赛中途取消：所有玩家退出比赛
- [x] 比赛中途取消：退还所有已报名玩家的报名费（写入 tournament_refund 流水）
- [x] 大厅首页：报名成功后按钮变为“已报名”状态（不可再次点击）（不可再次点击）

## 2026-06-03 结算界面赢家排序优化

- [x] 结算界面赢家从上往下按金额排序（最大赢家在最上面）
- [x] 最大财家名字前加冠军图标（Trophy）+ 名字颜色用金色突出 + 金额更大更亮
- [x] 其他赢家显示排名序号 + 普通颜色 + 较小字体

## 2026-06-03 营销系统7大模块

### 1. 群发消息
- [x] DB: broadcast_messages 表（复用已有 broadcastTasks 表）
- [x] 后端: 创建群发任务、执行群发（通过TG Bot）、查看历史
- [x] 前端: Admin 群发面板（编辑消息、选择目标用户群、发送、历史记录）

### 2. 优惠券/红包
- [x] DB: coupons 表 + coupon_redemptions 表
- [x] 后端: 创建优惠码、兑换优惠码、停用优惠码、查看列表
- [x] 前端: Admin 优惠码管理面板 + 用户端兑换弹窗

### 3. 邀请奖励活动
- [x] DB: invite_rewards 表 + invite_reward_config 表
- [x] 后端: 配置邀请奖励规则、查看邀请统计、发放奖励
- [x] 前端: Admin 邀请奖励配置 + 统计面板

### 4. 签到奖励
- [x] DB: checkin_configs 表 + checkin_records 表
- [x] 后端: 签到接口、签到状态查询、连续签到计算、配置更新
- [x] 前端: Admin 签到配置面板 + 用户端签到弹窗（7天网格 + 签到按钮）

### 5. 首充优惠
- [x] DB: first_deposit_configs 表
- [x] 后端: 首充配置查询/更新、首充奖励发放
- [x] 前端: Admin 首充配置面板

### 6. 限时活动
- [x] DB: time_limited_events 表
- [x] 后端: 创建/列表/启停限时活动
- [x] 前端: Admin 限时活动管理面板

### 7. 推送通知管理
- [x] DB: scheduled_notifications 表
- [x] 后端: 创建定时推送、执行推送、查看历史
- [x] 前端: Admin 推送管理面板（创建、定时、历史）

## 2026-06-03 AI客服API配置接口

- [x] 后端：cs.chat 从 systemConfigs 读取自定义 AI API 配置（apiUrl, apiKey, model, systemPrompt, temperature）
- [x] 前端：Admin 系统设置中添加 AI 客服配置区块（API地址、API Key、模型名称、系统提示词、温度）
- [x] 当配置为空时使用内置默�## 2026-06-03 签到/兑换码移到我的页面
- [x] 将签到按钮从大厅快捷区移到“我的”页面
- [x] 将兑换码按钮从大厅快捷区移到“我的”页面

## 2026-06-11 三项功能
- [x] 换设备登录检测：记录设备指纹，新设备登录弹出提示
- [x] 管理后台：分享文案配置（可编辑默认分享文案）
- [x] 管理后台：分享 Banner 图配置（可上传/切换不同活动 Banner）
- [x] 前端分享卡片：读取后台配置的动态 Banner 图和默认分享文案
- [x] 玩家分享前可编辑分享文案（一句话个性化）
�页面�捷区移到"我的"页面

## 2026-06-11 分享功能升级：Telegram WebApp.shareMessage

- [x] 分享文案跟随用户语言自动翻译（i18n 12种语言）
- [x] Banner 图压缩（4.8MB→101KB）避免加载超时
- [x] Banner 图通过 Telegram CDN URL 显示（避免 /manus-storage/ 307 重定向问题）
- [x] 后端 prepareShareMessage 接口（savePreparedInlineMessage API）
- [x] 前端调用 Telegram.WebApp.shareMessage 弹出联系人选择器
- [x] 分享链接带邀请码自动绑定代理关系
- [x] i18n 添加 agent.startGameBtn / agent.shareSuccess 翻译（12种语言）
- [x] 旧版 TG 不支持 shareMessage 时 fallback 到 t.me/share/url

## 2026-06-12 牌型显示字体放大

- [x] 实时牌力标签（卡顺听牌等）字体从 9px 放大到 13px，内边距加大
- [x] Showdown 自己牌型标签从 9px 放大到 13px
- [x] 对手牌型标签从 8px 放大到 12px

## 2026-06-12 弃牌后UI优化

- [x] 弃牌后弃牌图标持续显示（不因阶段变化而消失）
- [x] 弃牌后该玩家头像变灰（grayscale）

## 2026-06-12 牌盒 + 发牌动画

- [x] 牌桌右上角添加牌盒（deck shoe）视觉元素
- [x] 发牌动画改为从牌盒位置飞出到各玩家手中
- [x] 公共牌发牌也从牌盒飞出
- [x] 发牌音效优化（更真实的卡片滑出声）
- [x] flop/turn/river公共牌也播放发牌音效
- [x] 修复：只有新发的公共牌才有动画（turn只动第4张，river只动第5张）
- [x] 修复：flop三张牌一张一张从牌盒飞出（间隔250ms）
- [x] 修复：发牌动画方向正确从右上角牌盒位置飞出

## 2026-06-12 音效优化

- [x] 每张公共牌飞出时各播放一次独立的dealSingle音效（与450ms间隔同步）
- [x] 投注/跟注操作配金币落下声（coinDrop）
- [x] 对手的bet/call/raise也播放coinDrop金币声
- [x] 对手的fold/check/allIn也播放对应音效

## 2026-06-14 UI优化

- [x] 游戏桌面隐藏顶部工具栏，改为浮动汉堡菜单（仿KKPOKER）
- [x] 大厅界面字体加粗加大，白天可读性优化

## 2026-06-14 UI修复

- [x] 大厅房间卡片高度统一（紧凑布局+whitespace-nowrap防换行）
- [x] 大厅字体对比度提升（text-muted-foreground改为text-foreground/70）
- [x] 游戏桌面全屏显示修复（添加requestFullscreen+disableVerticalSwipes）

## 2026-06-14 UI修复 Round 2

- [x] 汉堡菜单内容检查（已确认完整：返回大厅/离开/手牌历史/验证/海报/语音）
- [x] 全屏模式顶部safe area适配（使用--tg-safe-area-inset-top + --tg-content-safe-area-inset-top双变量）
- [x] 大厅卡片间距加大（space-y-4 + p-4 + gap-4 + mt-1）
- [x] 所有页面顶部safe-top类统一使用TG双变量计算

## 2026-06-14 UI修复 Round 3

- [x] 客服页面顶部header加safe area间距（返回按钮被TG状态栏遮挡）
- [x] 游戏桌面布局重新调整（桌面大小、位置、所有玩家座位位置优化）

## 2026-06-14 UI修复 Round 4

- [x] 大厅房间卡片：在线人数/盲注/买入行距加大，字体改白色加粗
- [x] 进入游戏加载页面居中往下调
- [x] 游戏中竖向时间进度条高度缩短
- [x] 游戏桌面整体再往下移一点

## 2026-06-14 UI修复 Round 5

- [x] 充值建议金额往下减几分钱（避免用户觉得多收）
- [x] 牌背面透明问题修复 + 时间进度条颜色从紫色改为金色/蓝色
- [x] 大厅卡片行距从mt-2加大到mt-4
- [x] 对手牌尺寸偏高，缩小高度

## 2026-06-14 UI修复 Round 6

- [x] 首页启动界面内容居中显示（当前偏上，下方空白太多）
- [x] 对手牌背面高度进一步缩小（当前仍然太高）

## 2026-06-14 UI修复 Round 7

- [x] 首页启动界面loading等待时间加长（让用户看清）
- [x] 游戏其它界面和底部tab所有白色字加粗

## 2026-06-14 UI修复 Round 8

- [x] 全局渐变兼容性修复：所有页面bg-gradient改为inline style（iPhone 7 Plus兼容）
  - Table.tsx: 进度条、牌盒、筹码、主容器、侧边菜单、操作按钮、rebuy弹窗
  - Lobby.tsx: 创建房间按钮、加入按钮
  - Wallet.tsx: 充值/提现按钮
  - Home.tsx: 登录按钮、进入游戏按钮
  - CreateRoom.tsx: 创建按钮
  - Profile.tsx: 头像渐变
  - Agent.tsx: 底部渐变、header渐变
  - Tutorial.tsx: 牌型卡片、时间线、showdown示意
  - ReplayPlayer.tsx: 牌背面
  - StaffLogin.tsx: Logo、登录按钮
  - Admin.tsx: 所有渐变元素
  - NotFound.tsx: 背景渐变
  - RoomInvitePoster.tsx: 底部渐变
  - Leaderboard.tsx: 头像渐变

## 2026-06-14 UI修复 Round 9

- [x] 管理后台风控开关字段名修复（isEnabled→enabled，数据库字段名不匹配导致永远显示关闭）
- [x] 全局oklch颜色改为hex：index.css @theme所有变量从oklch改为标准hex/rgba
- [x] Switch组件改为inline style确保老iOS兼容
- [x] BottomNav/Admin中残留oklch清理

## 2026-06-14 陪玩机器人系统
- [x] DB: users表添加isBot字段，8个bot账户已插入
- [x] DB: 使用系统config表存储bot配置（无需独立表）
- [x] DB: 每日亏损追踪使用内存变量（无需独立表，重启重置）
- [x] 后端: botManager.ts - AI决策引擎（手牌评估、策略决策、随机延迟2-5秒）
- [x] 后端: botManager.ts - 机器人管理器（自动入座/退出、亏损控制、生命周期）
- [x] 后端: 与tableManager集成（机器人参与游戏循环：startNewHand/checkTimeouts/settleHand/readyPhase）
- [x] 后端: admin路由 - 机器人配置管理、统计查询、每日亏损重置
- [x] 前端: Admin机器人管理面板（开关、参数配置、机器人列表、亏损进度）
- [x] 隐蔽性: 排行榜排除bot、代理佣金排除bot、AFK踢出不返还余额、随机延迟操作
- [x] 测试: botManager.test.ts 6个测试全部通过

## 2026-06-14 AI对接切换：Manus LLM → DeepSeek API
- [x] 后端: 创建server/deepseek.ts模块（替代_core/llm.ts的invokeLLM）
- [x] 后端: 从系统config表读取deepseek_api_key和deepseek_model配置（带缓存60秒）
- [x] 后端: 替换所有invokeLLM调用为deepseek模块（routers.ts + riskEngine.ts）
- [x] 前端: 管理后台DeepSeek配置面板（API Key/URL/模型/MaxTokens/Temperature + 客服专属配置）
- [x] 移除对BUILT_IN_FORGE_API_KEY/URL的LLM依赖（不再引用_core/llm.ts）
- [x] 测试验证: 169个测试全部通过（含5个deepseek专属测试）

## 2026-06-14 AI机器人决策引擎优化（概率计算）
- [x] 重写决策引擎：基于手牌强度+公共牌面计算胜率(equity)
- [x] 实现preflop手牌分级（AA=85%、KK=82%、AKs=67%、弱牌72o=32%）
- [x] 实现postflop牌力评估（成牌强度+听牌数outs+顶对/底对识别）
- [x] 实现底池赔率计算（equity > potOdds 则跟注有正EV）
- [x] 加入位置因素（后位+3%、前位-2%）
- [x] 加入个性化偏差（基于playerId生成稳定风格偏差±5%）
- [x] 测试验证: 175个测试全部通过（含12个botManager测试）

## 2026-06-14 AI机器人改为完全真实玩家模式
- [x] botManager.ts: bot入座时走真实余额扣除+流水记录（deductUserBalanceAtomic + createTransaction）
- [x] tableManager.ts: handleReadyTimeout中bot和真人走同样的余额返还+流水记录
- [x] tableManager.ts: checkTimeouts(AFK kick)中bot和真人走同样流程
- [x] tableManager.ts: settleHand中代理佣金不再排除bot，所有玩家正常参与
- [x] routers.ts: 排行榜3个查询移除eq(users.isBot, false)条件
- [x] DB: 8个bot账户余额设为100,000 USDT
- [x] 测试验证: 175个测试全部通过

## 2026-06-14 AI机器人5项增强
- [x] 1. Bot数据统计：每个bot的胜率/手数/盈亏/今日数据/补充次数（从transactions+handPlayers聚合）
- [x] 2. 按在线人数动态调度bot（真人越多bot越少，真人越少bot越多）
- [x] 3. 无真人时bot自动对玩，每桌配minPerTable(3)-maxPerTable(5)个bot
- [x] 4. 余额监控告警：每5分钟检查，低于阈值时notifyOwner告警
- [x] 5. 自动补充余额：余额不足时自动补充到指定金额（并记录adjustment流水）
- [x] 管理后台：bot统计表格（名称/状态/余额/手数/胜率/盈亏/今日数据/补充次数）
- [x] 管理后台：余额监控+自动补充配置（告警阈值/开关/补充金额/低余额列表）
- [x] 测试验证: 175个测试全部通过

## 2026-06-14 机器人增强第二批
- [x] Bug修复：新一局开始时公共牌面未清除（getPlayerView在waitingForReady时返回空牌面）
- [x] 机器人列表导出功能（JSON格式，含名称/头像/余额/统计）
- [x] 机器人列表导入功能（批量创建bot账户并标记isBot）
- [x] 完善bot数据统计（每个bot输赢金额+胜率+总体汇总）
- [x] Bot行为指标监控（VPIP/PFR/激进度/风格判定，最近200手）
- [x] 机器人自玩自嗨开关（fillWithoutRealPlayers配置控制，管理后台独立开关）
- [x] bot系统默认配置：每桌最多5个、最少3个、亏损上限500
- [x] 测试验证: 175个测试全部通过

## 2026-06-14 机器人增强第三批
- [x] 在线人数统计包含bot（joinTable已更新currentPlayers，无需额外修改）
- [x] 批量生成200个机器人（randomuser.me真实头像+随机英文名，余额1-10万随机）
- [x] 补全现有8个机器人头像（更新为randomuser.me真实头像）
- [x] 弃牌率配置已修复生效（通过foldAdjust调整equity阈值，foldRate越高越容易弃牌）
- [x] 测试验证: 175个测试全部通过

## 2026-06-14 机器人增强第四批
- [x] 长期在线bot人数配置（persistentOnlineCount字段，每30秒调度器检查并补充）
- [x] 所有机器人余额改为100以内（已批量更新数据库 RAND()*90+10）
- [x] 机器人按场次独立配置（room_bot_config表，每个房间可独立设置botCount/enabled/foldRate/delay）
- [x] 管理后台UI：场次独立bot配置面板（RoomBotConfigPanel组件）
- [x] 测试验证: 185个测试全部通过

## 2026-06-14 机器人增强第五批
- [x] 机器人行为指标合并到用户列表（BotDetailTableMerged组件，VPIP/PFR/激进度/风格判定直接显示在bot统计表格中）
- [x] 机器人轮换设置（rotationHands配置，每桌打N把后自动换bot，settleHand中触发轮换）
- [x] 测试验证: 185个测试全部通过

## 2026-06-14 Bot分配修复 + 自动扩桌
- [x] Bot只分配到明确配置了bot的场次（未配置的场次不分配bot）
- [x] 牌桌满员时自动创建同级别新桌（自动扩桌机制）
- [x] 测试验证: 185个测试全部通过

## 2026-06-14 AI机器人后台Tab重构
- [x] 重构BotManagementPanel为4个Tab：机器人用户、设置、调度与策略、余额监控
- [x] 机器人用户Tab：机器人列表+行为指标合并表格 + 导入导出
- [x] 设置Tab：全局配置+场次独立配置
- [x] 调度与策略Tab：长期在线调度、轮换设置、延迟参数、策略说明
- [x] 余额监控Tab：自动补充、告警阈值、低余额列表、余额分布概览

## 2026-06-14 自动扩桌前端修复
- [x] 移除前端满员检查，允许请求到达后端触发自动扩桌
- [x] 移除“已满”按钮禁用状态，始终显示“入座”可点击
- [x] 185个测试全部通过

## 2026-06-14 Bug修复：新手牌开始后仍显示上一局牌面
- [x] 后端修复：waitingForReady=true时清空所有玩家holeCards（防止旧牌泄露到新手牌）
- [x] 前端修复：添加phase转换清理逻辑（showdown/completed→preflop/waiting时立即清除所有showdown视觉状态）
- [x] 185个测试全部通过

## 2026-06-14 数据统计：在线人数统计
- [x] 后台数据统计增加在线人数总数（真人+bot，实时从内存读取）
- [x] 每个场次的在线人数明细（场次名、盲注、总人数、真人、Bot）
- [x] 185个测试全部通过

## 2026-06-14 Bot匹配逻辑优化：1:1比例 + maxPerTable生效
- [x] 真人在牌桌等待时，自动匹配1个bot就位（每次只添加1个）
- [x] 机器人与真人比例1:1（bot数 <= 真人数，无真人不添加bot）
- [x] maxPerTable全局限制生效（targetBotCount受maxPerTable约束）
- [x] 超额bot自动移除（真人离开后，多余bot会在下一手开始前被移除）
- [x] persistentBotScheduler也遵守1:1比例和maxPerTable
- [x] 185个测试全部通过

## 2026-06-14 Bug修复：bot输光被替换后新一局仍显示旧牌面
- [x] 后端：bot输光离桌+新bot入座后，确保getPlayerView返回干净状态（无旧牌面）
- [x] 后端：readyForNextHand/startNewHand时彻底清除所有牌面数据
- [x] 前端：检测到新玩家入座或phase变为waiting/preflop时强制清除所有牌面状态


## 2026-06-14 UI调整：牌桌布局优化
- [x] 游戏牌桌信息（底池、阶段）移到牌桌中间，确保不被公共牌遮住
- [x] 顶部玩家位置：头像移到牌的上面

## 2026-06-14 重大Bug：观战者加入后座位重叠
- [x] 修复：观战者加入牌桌后，游戏重新开始时两个玩家头像重叠在同一座位上

## 2026-06-14 重大Bug：游戏结束时所有玩家被踢出牌桌
- [x] 修复：观战者进入后游戏结束时，所有人被踢出牌桌返回大厅
- [x] 修复：真实玩家弃牌后游戏结束，所有人被踢出牌桌返回大厅
## 2026-06-14 机器人配置优化 + 头像显示Bug
- [x] 移除机器人与真人1:1的限制，改为直接使用AI机器人后台设置的数量
- [x] 修复真人玩家进入牌桌后看不到机器人头像的bug（根因：room_players重复记录+useEffect无限循环）

## 2026-06-15 投注延迟 + UI调整
- [x] 优化投注轮转延迟（bot延迟500-1500ms，checkTimeouts间隔1s，触发等待0.3s）
- [x] 牌桌信息栏（NL Hold'em 0.5/1）位置上移（top 56% → 48%）
- [x] 修复游戏进行中玩家人数和位置不断变化的bug（阻止persistentBotScheduler在游戏中修改DB）
- [x] 修复room_players表重复记录导致座位显示混乱（添加防重复检查到addRoomPlayer/addRoomPlayerSittingOut）
- [x] 清理room_players脏数据（495条重复记录）
- [x] 修复玩家进入牌桌后直接被弹回（Table.tsx:1055 Maximum update depth exceeded - showdown reveal useEffect无限循环）
- [x] 修复Bot无法启动游戏的bug（根因：orphaned cleanup标记bot为left → 新bot只尝试seat 0 → 座位冲突。修复：addRoomPlayer只检查active/sitting_out状态的座位冲突，忽略left记录并在插入前清理）
- [x] 修复startNewHand未捕获异常导致游戏静默失败（添加try-catch包裹）

## 2026-06-15 生成300个中国人名机器人
- [x] 生成300个中国人名bot（姓氏100个+男女名字随机组合，确保不重复）
- [x] 每个bot配备DiceBear随机头像（8种风格随机分配）
- [x] 批量插入数据库（isBot=true, 余额20-100随机）
- [x] 验证：数据库总bot数508个（原208+新300）
- [x] 修复座位跳动问题：用户未入座时固定heroSeatIndex=0不旋转
- [x] 修复bot轮换导致座位全部变化：每手最多只轮换1个bot（逐个替换）
- [x] 座位旋转重构：基于自己seatIndex旋转，每个玩家看到自己在底部，未入座时不旋转
- [x] 真人玩家优先分配seat 0（底部中间），bot占据时自动让座
- [x] Bot入座跳过seat 0，优先使用seat 1-5
- [x] 牌桌整体下移（SEAT_POSITIONS top值增加）布局更美观

## 2026-06-16 Bot盈亏控制系统
- [x] 实时追踪bot当日盈亏（dailyBotTotalBet/Win + 玩家连赢追踪 playerWinStreaks）
- [x] 根据盈亏状态动态调整bot equity阈值（getProfitControlAdjustment函数）
- [x] 后台管理界面增加盈亏控制配置（profitControlEnabled/targetEdge/maxWinStreak）
- [x] system_configs存储盈亏控制字段（bot_profit_control_enabled/bot_target_edge/bot_max_win_streak）

## 2026-06-16 Bug修复：座位抢占 + 盈亏统计
- [x] Bot入座时检查sitting_out状态的真人玩家座位，不能抢占（getRoomPlayersAll+跳过seat 0）
- [x] Bot盈亏统计增加累计总盈亏卡片（totalAllTimeProfit）

## 2026-06-16 Bug修复：牌桌显示 + 重入问题
- [x] Bug1: 两台手机不同账号显示同一玩家（确认为同一TG账号多设备登录，行为正确）
- [x] Bug2: 返回大厅找不到牌桌（修复beacon-leave误触发 + 增加kicked保护）
- [x] Bug3: 下注顺序跳跃（代码按seatIndex排序正确，视觉因bot快速行动）
- [x] Bug4: 观战玩家被误踢（增加KICK_GRACE_THRESHOLD到6 + getPlayerView覆盖状态转换窗口）

## 2026-06-17 Bot数量上限 + 虚拟在线人数
- [x] 去除单场bot数量上限（前后端max=50限制全部移除）
- [x] 房间级别botCount不再受全局maxPerTable限制
- [x] 新增"大厅显示虚拟在线人数"配置项（后台可设置，大厅totalOnline加上此数值）

## 2026-06-17 Bot AI策略收紧（更难打/减少all-in）
- [x] 默认foldRate从67提高到75（bot更倾向弃牌）
- [x] Preflop: raise阈值从0.70提高到0.75，中等牌跟注范围从≤5BB收紧到≤3BB
- [x] Preflop: 弱牌跟注范围从equity≥0.38收紧到≥0.42，偷鸡概率从15%降到8%
- [x] Postflop: value bet阈值从0.70提高到0.75，bluff频率从8%降到3%
- [x] Postflop: 强牌加注阈值从0.65提高到0.72，加注概率从30%降到20%
- [x] Postflop: 中等牌跟注增加条件限制（需toCall≤pot*0.5才跟）
- [x] makeRaise: 筹码上限从60%降到40%，超过30%筹码有40%概率改为call
- [x] 面对All-in: 跟注阈值从equity≥0.55提高到≥0.62

## 2026-06-17 Bot分配修复：所有公共房间自动填充bot
- [x] 修改checkAndFillBots：没有room_bot_config的公共房间使用全局配置的minPerTable作为目标bot数
- [x] 修改persistentBotScheduler：遍历所有公共房间而非仅有room_bot_config的房间，改用填充率最低优先算法

## 2026-06-17 Bug: TG桌面端打开游戏桌面变全屏
- [x] 修复电脑端Telegram打开游戏时牌桌铺满全屏的问题，限制最大宽度为9:16比例居中显示

## 2026-06-17 安全功能：设备互斥登录 + 地理位置防作弊
- [x] 新设备登录需旧设备确认：新设备发起登录请求→旧设备收到通知→旧设备同意后新设备才能登录
- [x] 地理位置防作弊：前端上报GPS坐标，同桌玩家距离过近时触发风险提示给管理员

## 2026-06-17 Bug: Bot占满牌桌导致真人无法入座
- [x] Bot填充时预留座位：checkAndFillBots中targetBotCount限制为min(botCount, maxPlayers-1)
- [x] game.join满了时自动跳转到同级别有空位的桌（或自动创建新桌）

## 2026-06-17 Bug: 管理后台跳转到Manus OAuth登录
- [x] 修复main.tsx中全局UNAUTHORIZED错误处理：admin路径下不触发OAuth重定向，使用独立的员工账号密码登录

## 2026-06-17 i18n 多语言翻译键补全
- [x] 添加 table.redirectedToTable 多语言翻译键（12种语言）
- [x] 添加 agent.tgLoginRequired / agent.sendFailed / agent.shareSending 多语言翻译键（12种语言）
- [x] 添加 checkin.* / coupon.redeemSuccess 多语言翻译键（12种语言）
- [x] 修复 Agent.tsx 中硬编码中文 toast 改为 t() 调用
- [x] 修复 Profile.tsx CheckinWidget/CouponRedeemWidget 中硬编码双语文本改为 t() 调用
