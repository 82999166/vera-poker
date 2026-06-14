/** 管理后台页面 - 用户管理、财务审核、系统配置、营销工具 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";

import {
  Settings, Users, DollarSign, Shield, BarChart3, Save, RefreshCw,
  Plus, Trash2, ArrowLeft, UserCheck, Pause, Play, X, MessageSquare,
  Globe, LogOut, PanelLeft, Layers, Copy, Check, Eye, EyeOff, LogIn, Pencil, Trophy, Megaphone, Bot
} from "lucide-react";
import { toast } from "sonner";
import { formatBalance, formatAmount } from "@/lib/utils";
import { MarketingPanel } from "./MarketingPanel";

// ==================== ADMIN I18N ====================
type AdminLang = "zh-CN" | "zh-TW" | "en";

const adminI18n: Record<AdminLang, Record<string, string>> = {
  "zh-CN": {
    "admin.title": "Vera 管理后台",
    "admin.subtitle": "管理控制台",
    "admin.back": "返回",
    "admin.signIn": "登录以继续",
    "admin.signInDesc": "访问管理后台需要管理员权限",
    "admin.signInBtn": "登录",
    "admin.accessDenied": "访问被拒绝",
    "admin.accessDeniedDesc": "需要管理员权限",
    "tab.config": "系统配置",
    "tab.users": "用户管理",
    "tab.rooms": "房间管理",
    "tab.finance": "财务管理",
    "tab.agents": "代理管理",
    "tab.risk": "风控中心",
    "tab.faq": "FAQ知识库",
    "tab.settings": "系统设置",
    "tab.stats": "数据统计",
    "tab.staff": "员工管理",
    "tab.csRecords": "客服记录",
    "tab.banners": "活动管理",
    "tab.tournaments": "锦标赛管理",
    "tab.logs": "操作日志",
    "tab.marketing": "营销系统",
    "logs.title": "操作日志",
    "logs.noLogs": "暂无日志记录",
    "logs.all": "全部",
    "logs.finance": "财务",
    "logs.user": "用户",
    "logs.room": "房间",
    "logs.config": "配置",
    "logs.agent": "代理",
    "logs.system": "系统",
    "logs.auth": "认证",
    "logs.today": "今日操作",
    "logs.total": "总操作数",
    "logs.operator": "操作人",
    "logs.action": "操作",
    "logs.target": "目标",
    "logs.time": "时间",
    "logs.status": "状态",
    "logs.detail": "详情",
    "logs.success": "成功",
    "logs.failed": "失败",
    "staff.title": "员工管理",
    "staff.create": "创建员工账户",
    "staff.username": "登录用户名",
    "staff.password": "登录密码",
    "staff.role": "角色",
    "staff.roleCsLabel": "客服",
    "staff.roleFinanceLabel": "财务",
    "staff.roleTechLabel": "技术",
    "staff.createBtn": "创建",
    "staff.list": "员工列表",
    "staff.noStaff": "暂无员工账户",
    "staff.resetPwd": "重置密码",
    "staff.delete": "删除",
    "staff.confirmDelete": "确认删除该员工？",
    "staff.created": "创建成功",
    "staff.deleted": "已删除",
    "staff.pwdReset": "密码已重置",
    "config.title": "系统配置",
    "config.gameSettings": "游戏设置",
    "config.agentSystem": "代理系统",
    "config.finance": "财务设置",
    "config.riskControl": "风控设置",
    "config.privateRoom": "私人房设置",
    "config.walletAddress": "收款钱包地址",
    "config.blockchainApi": "区块链 API 配置",
    "config.tonOnchain": "TON 上链钱包配置",
    "config.addNew": "新增配置",
    "config.key": "键名",
    "config.value": "值",
    "config.label": "标签",
    "config.category": "分类",
    "config.saved": "配置已保存！",
    "config.keyValueRequired": "键名和值为必填项",
    "users.title": "用户管理",
    "users.noUsers": "暂无用户",
    "users.updated": "用户已更新",
    "rooms.title": "房间管理",
    "rooms.noRooms": "暂无房间",
    "rooms.updated": "房间已更新",
    "rooms.deleted": "房间已删除",
    "rooms.deleteConfirm": "确定永久删除此房间？",
    "rooms.pause": "暂停",
    "rooms.resume": "恢复",
    "rooms.close": "关闭",
    "rooms.delete": "删除",
    "rooms.players": "玩家",
    "rooms.create": "创建房间",
    "rooms.edit": "编辑",
    "rooms.created": "房间创建成功",
    "rooms.createTitle": "创建新房间",
    "rooms.editTitle": "编辑房间",
    "rooms.name": "房间名称",
    "rooms.type": "类型",
    "rooms.gameType": "游戏类型",
    "rooms.smallBlind": "小盲",
    "rooms.bigBlind": "大盲",
    "rooms.minBuyIn": "最小买入",
    "rooms.maxBuyIn": "最大买入",
    "rooms.maxPlayers": "最大玩家数",
    "rooms.totalRounds": "总手数",
    "rooms.billingMode": "计费模式",
    "rooms.roundFee": "每手费用",
    "rooms.rakePercent": "抽水比例(%)",
    "rooms.rakeCap": "抽水上限",
    "rooms.fairnessLevel": "公平等级",
    "rooms.public": "公开",
    "rooms.private": "私密",
    "rooms.texasHoldem": "德州扑克",
    "rooms.omaha": "奥马哈",
    "rooms.standardRake": "标准抽水",
    "rooms.perRoundFee": "每手固定费",
    "rooms.basic": "基础",
    "rooms.medium": "中等",
    "rooms.high": "高级",
    "rooms.unlimited": "无限制",
    "rooms.presets": "快速预设",
    "rooms.presetLow": "低级桌",
    "rooms.presetMid": "中级桌",
    "rooms.presetHigh": "高级桌",
    "rooms.presetVip": "VIP桌",
    "rooms.save": "保存",
    "rooms.cancel": "取消",
    "rooms.inviteCode": "邀请码",
    "rooms.tableNo": "桌号",
    "rooms.status": "状态",
    "rooms.duplicate": "复制",
    "rooms.duplicated": "房间已复制",
    "rooms.filterAll": "全部场次",
    "rooms.filterBeginner": "初级场",
    "rooms.filterIntermediate": "中级场",
    "rooms.filterAdvanced": "高级场",
    "rooms.filterVip": "VIP场",
    "rooms.filterStatusAll": "全部状态",
    "rooms.filterStatusOpen": "开放中",
    "rooms.filterStatusPlaying": "进行中",
    "rooms.filterStatusClosed": "已关闭",
    "rooms.statTotal": "总桌数",
    "rooms.statOpen": "开放中",
    "rooms.statPlaying": "进行中",
    "rooms.statClosed": "已关闭",
    "rooms.beginner": "初级场",
    "rooms.intermediate": "中级场",
    "rooms.advanced": "高级场",
    "rooms.vip": "VIP场",
    "finance.title": "财务概览",
    "finance.totalVolume": "总交易额",
    "finance.totalTx": "总交易数",
    "finance.recentTx": "最近交易",
    "finance.noTx": "暂无交易记录",
    "agents.title": "代理管理",
    "agents.totalRel": "代理关系数",
    "agents.totalComm": "佣金记录数",
    "agents.relationships": "代理关系",
    "agents.noRel": "暂无代理关系",
    "agents.recentComm": "最近佣金",
    "agents.noComm": "暂无佣金记录",
    "risk.title": "风控中心",
    "risk.flagged": "标记事件",
    "risk.antiAbuse": "反作弊",
    "risk.rules": "反作弊规则",
    "risk.regGate": "注册门槛",
    "risk.deviceFp": "设备指纹",
    "risk.behavior": "行为分析",
    "risk.sameTable": "同桌比例检测",
    "risk.active": "已启用",
    "risk.configHint": "在 系统配置 → 风控设置 中调整阈值",
    "risk.log": "检测日志",
    "risk.noEvents": "暂无可疑活动",
    "faq.title": "FAQ管理（AI知识库）",
    "faq.addEntry": "新增FAQ",
    "faq.question": "问题",
    "faq.answer": "回答",
    "faq.saved": "FAQ已保存！",
    "faq.deleted": "FAQ已删除",
    "faq.qaRequired": "问题和回答为必填项",
    "faq.existing": "已有FAQ",
    "faq.noEntries": "暂无FAQ。添加一些来驱动AI客服。",
    "settings.title": "系统设置",
    "settings.maintenance": "维护模式",
    "settings.maintenanceDesc": "启用后玩家无法进入游戏",
    "settings.defaultLang": "默认语言",
    "settings.tgBot": "Telegram Bot 配置",
    "settings.botUsername": "Bot 用户名",
    "settings.botToken": "Bot Token（隐藏）",
    "settings.csTg": "人工客服 TG 号",
    "settings.csTgDesc": "玩家在在线客服中点击\u201c转人工\u201d时，将跳转到此 Telegram 账号的对话",
    "settings.supportedLangs": "支持语言列表",
    "settings.saved": "设置已保存！",
    "settings.aiCsTitle": "AI 客服 API 配置",
    "settings.aiCsDesc": "配置自定义 AI 模型接口。留空则使用内置 AI 服务。",
    "settings.aiCsApiUrl": "API 地址",
    "settings.aiCsApiUrlHint": "兼容 OpenAI 格式的 API 地址，如 https://api.openai.com",
    "settings.aiCsApiKey": "API Key",
    "settings.aiCsModel": "模型名称",
    "settings.aiCsModelHint": "如 gpt-4o-mini、gpt-4o、claude-3-haiku 等",
    "settings.aiCsTemperature": "温度（创造性）",
    "settings.aiCsPrompt": "自定义系统提示词",
    "settings.aiCsPromptPlaceholder": "输入自定义的 AI 客服系统提示词。留空则使用内置的德州扑克客服提示词。",
    "settings.aiCsDefault": "当前使用内置 AI 服务（无需配置）",
    "stats.title": "数据看板",
    "stats.totalUsers": "总用户数",
    "stats.totalRooms": "总房间数",
    "stats.totalTx": "总交易数",
    "stats.totalVolume": "总交易额",
    "stats.dau": "日活跃用户",
    "stats.dailyVolume": "每日交易量",
    "stats.dailyHands": "每日牌局数",
    "stats.trend": "趋势图表",
    "stats.last14days": "近14天",
    "stats.users": "用户数",
    "stats.volume": "交易额",
    "stats.hands": "牌局数",
    "stats.today": "今日新增",
    "stats.todayNew": "今日新增",
    "stats.todayActive": "今日活跃",
    "stats.totalBalance": "平台总余额",
    "stats.platformFunds": "用户资金",
    "stats.pendingWithdrawals": "待审批提现",
    "common.user": "用户",
    "common.agent": "代理",
    "common.level": "等级",
    "users.normal": "正常",
    "users.watch": "观察",
    "users.frozen": "冻结",
    "users.banned": "封禁",
    "agents.unlocked": "已解锁",
    "agents.pending": "待解锁",
    "risk.layers": "4层防御",
    "faq.catGeneral": "综合",
    "faq.catDeposit": "充值",
    "faq.catWithdraw": "提现",
    "faq.catGame": "游戏规则",
    "faq.catAgent": "代理",
    "faq.catSecurity": "安全",
    "users.totalGameUsers": "游戏用户",
    "users.todayNew": "今日新增",
    "users.todayActive": "今日活跃",
    "users.totalBalance": "平台总余额",
    "users.search": "搜索用户名 / TG ID / 用户ID...",
    "users.colUser": "用户",
    "users.colIp": "IP / 地区",
    "users.colLastLogin": "最后登录",
    "users.colBalance": "余额",
    "users.colStatus": "状态",
    "users.prevPage": "上一页",
    "users.nextPage": "下一页",
    "users.manualTopUp": "手动充值",
    "users.topUpAmount": "充值金额",
    "users.topUpNote": "备注（可选）",
    "users.confirmTopUp": "确认充值",
    "users.topUpSuccess": "充值成功",
    "users.topUpTitle": "管理员手动充值",
    "users.infoTab": "基本信息",
    "users.depositsTab": "充值记录",
    "users.withdrawalsTab": "提现记录",
    "users.gamesTab": "游戏记录",
    "users.gameFlowTab": "游戏流水",
    "users.balance": "余额",
    "users.totalHands": "总手数",
    "users.totalWins": "胜场",
    "users.winRate": "胜率",
    "users.totalDeposited": "累计充值",
    "users.totalWithdrawn": "累计提现",
    "users.riskLevel": "风控等级",
    "users.agentLevel": "代理等级",
    "users.regularUser": "普通用户",
    "users.registeredAt": "注册时间",
    "users.lastLogin": "最后登录",
    "users.noTx": "暂无记录",
    "users.noGames": "暂无游戏记录",
    "users.adminTopUp": "管理员充值",
    "users.online": "在线",
    "users.offline": "离线",
    "users.atTable": "在桌",
    "config.gameCat": "游戏设置",
    "config.agentCat": "代理系统",
    "config.financeCat": "财务设置",
    "config.riskCat": "风控设置",
    "config.roomCat": "私人房设置",
    "staff.newPassword": "新密码",
    "staff.confirm": "确认",
    "common.copied": "已复制",
    "common.copy": "复制",
    "common.noData": "暂无数据",
    "finance.pendingWithdrawals": "待审批提现",
    "finance.noPending": "暂无待审批提现",
    "finance.approveWithdrawal": "审批提现",
    "finance.txHash": "链上交易哈希 (TX Hash)",
    "finance.txHashPlaceholder": "0x...",
    "finance.confirmApprove": "确认转账完成",
    "finance.cancelApprove": "取消",
    "finance.approved": "已审批",
    "finance.rejected": "已拒绝",
    "finance.reject": "拒绝",
    "finance.approve": "审批",
    "finance.amount": "金额",
    "finance.chain": "链",
    "finance.address": "地址",
    "finance.status": "状态",
    "finance.time": "时间",
    "finance.user": "用户",
    "finance.type": "类型",
    "finance.deposit": "充值",
    "finance.withdraw": "提现",
    "finance.rake": "抽水",
    "finance.commission": "佣金",
    "finance.manualTopUp": "手动充值",
    "finance.autoApproveLimit": "小额自动审批上限",
    "login.title": "Vera 管理后台",
    "login.subtitle": "员工登录",
    "login.username": "用户名",
    "login.password": "密码",
    "login.usernamePlaceholder": "请输入员工账号",
    "login.passwordPlaceholder": "请输入密码",
    "login.submit": "登录",
    "login.emptyError": "请输入用户名和密码",
    "login.failed": "登录失败",
    "login.welcome": "欢迎回来",
    "login.networkError": "网络错误，请重试",
    "finance.confirmDeposit": "确认充值",
    "finance.confirmTransfer": "确认转账",
    "finance.pendingCount": "待审核",
    "finance.chainAddr": "链 / 地址",
    "finance.withdrawAmount": "提现金额",
    "finance.confirmWithdrawTitle": "确认提现转账",
    "finance.txHashLabel": "转账 TX Hash",
    "finance.txHashHint": "(必填，请先完成链上转账)",
    "finance.txHashPlaceholder2": "输入链上转账的 Transaction Hash",
    "finance.txHashRequired": "请输入转账 TX Hash",
    "finance.confirmTransferDone": "确认已转账",
    "finance.depositConfirmed": "充值已确认",
    "finance.withdrawConfirmed": "提现已确认",
    "finance.rejectConfirm": "确定拒绝该交易？",
    "finance.rejectReason": "管理员拒绝",
    "finance.rejected2": "已拒绝",
    "finance.tabPending": "待审核",
    "finance.tabDeposits": "充值",
    "finance.tabWithdrawals": "提现",
    "finance.tabAll": "全部",
    "finance.totalVolume2": "总流水",
    "finance.totalTxCount": "总交易数",
    "finance.pendingReview": "待审核",
    "finance.chainLabel": "链",
    "finance.statusLabel": "状态",
    "finance.statusPending": "待审核",
    "finance.statusConfirmed": "已确认",
    "finance.statusFailed": "已拒绝",
    "finance.addressLabel": "地址",
    "finance.timeLabel": "时间",
    "finance.userLabel": "用户",
    "finance.noPendingReview": "暂无待审核交易",
    "finance.tabRake": "抽水",
    "finance.rakeTotal": "总抽水",
    "finance.rakeToday": "今日抽水",
    "finance.rakeTotalHands": "总局数",
    "finance.rakeTodayHands": "今日局数",
    "finance.rakeTrend": "抽水趋势（14天）",
    "finance.rakeRecords": "抽水明细",
    "finance.rakeAvg": "平均抽水",
    "finance.noRakeRecords": "暂无抽水记录",
    "tg.oidcTitle": "Telegram Login (OIDC)",
    "tg.clientId": "Client ID",
    "tg.clientIdHint": "BotFather → Login Widget 中显示的 Client ID（数字）",
    "tg.clientSecret": "Client Secret",
    "tg.clientSecretHint": "BotFather → Login Widget 中显示的 Client Secret",
    "tg.redirectUri": "Redirect URI",
    "tg.redirectUriHint": "在 BotFather → Login Widget → Redirect URIs 中添加此地址",
    "tg.trustedOrigin": "Trusted Origin",
    "tg.trustedOriginHint": "在 BotFather → Login Widget → Trusted Origins 中添加此地址",
    "tg.miniAppTitle": "Mini App 配置",
    "tg.miniAppUrl": "Mini App URL",
    "tg.miniAppUrlHint": "在 BotFather 中设置 Web App URL 为此地址",
    "tg.webhookUrl": "Webhook URL",
    "tg.webhookUrlHint": "在 BotFather 或 API 中设置 Webhook 为此地址",
    "tg.setWebhookCmd": "设置 Webhook 命令",
    "tg.botUsernameHint": "填写 Bot 的用户名（如 VeraPokerBot），不含 @",
    "tg.botTokenHint": "完整 Token（如 123456789:ABCxxx），Bot ID 会自动提取",
    "settings.adminTgChatId": "管理员通知 TG Chat ID",
    "settings.adminTgChatIdDesc": "支持多个管理员，用英文逗号分隔（如：123456789,987654321）。充值/提现/新用户注册等事件将通过 Bot 推送给所有配置的管理员。发送任意消息给 @userinfobot 可获取您的 Chat ID",
    "settings.adminTgChatIdSet": "✓ 已配置，管理员将收到充值/提现/注册等 Bot 通知",
    "settings.adminTgChatIdUnset": "⚠ 未配置，管理员将无法收到 Bot 通知。发送任意消息给 @userinfobot 可获取您的 Chat ID，支持多个 ID 用英文逗号分隔",
    "config.catGame": "游戏设置",
    "config.catAgent": "代理系统",
    "config.catFinance": "财务设置",
    "config.catRisk": "风控设置",
    "config.catRoom": "私人房设置",
    "toast.copied": "已复制",
    "toast.bannerUploading": "图片正在上传中，请稍候...",
    "toast.bannerTitleRequired": "请填写标题",
    "toast.bannerImageRequired": "请上传图片或输入图片 URL",
    "toast.bannerSizeExceeded": "图片不能超过 5MB",
    "toast.bannerUploadSuccess": "图片上传成功，可点击创建",
    "toast.bannerUploadFailed": "图片上传失败",
    "toast.bannerReadFileFailed": "读取文件失败",
    "toast.tournamentCreated": "创建成功",
    "toast.tournamentUpdated": "更新成功",
    "toast.tournamentDeleted": "删除成功",
    "toast.tournamentRegOpen": "已开放报名，前端大厅现在可见",
    "toast.tournamentStarted": "比赛已开始，系统已自动分桌",
    "toast.tournamentCancelled": "比赛已取消，已退款",
    "toast.tournamentPrizesDone": "奖金发放完成！共发放 {count} 人，比赛已结束",
    "toast.tournamentNameTimeRequired": "请填写比赛名称和开赛时间",
    "banners.add": "添加 Banner",
    "banners.edit": "编辑 Banner",
    "banners.empty": "暂无 Banner，点击上方按钮添加",
    "banners.linkType": "点击动作",
    "banners.linkUrl": "链接地址",
    "banners.sortOrder": "排序（小的在前）",
    "banners.title": "标题",
    "csRecords.clear": "清除",
    "csRecords.count": "消息数",
    "csRecords.detail": "对话详情",
    "csRecords.empty": "暂无客服对话记录",
    "csRecords.lastMsg": "最后消息",
    "csRecords.search": "搜索",
    "csRecords.searchPlaceholder": "搜索用户名 / TG用户名 / 用户ID",
    "csRecords.searchResult": "搜索结果",
    "csRecords.time": "时间",
    "csRecords.user": "用户",
    "csRecords.users": "个用户",
    "settings.registrationBonus": "注册奖金设置",
    "settings.registrationBonusDesc": "新用户注册自动发放奖金，需满足条件后才能提现（防薅羊毛）",
    "settings.bonusAmount": "注册赠送金额 (USDT)",
    "settings.bonusAmountHint": "设为 0 则不发放注册奖金",
    "settings.bonusMinHands": "解锁最低有效手数",
    "settings.bonusMinHandsHint": "仅公共房间 ≥3人牌局计入有效手数（私房不计入）",
    "settings.bonusWagerMultiplier": "解锁流水倍数",
    "settings.bonusWagerHint": "需下注流水 ≥ 奖金 × 倍数才能解锁提现",
    "settings.bonusSummary": "当前规则摘要",
    "settings.bonusSummary1": "注册赠送",
    "settings.bonusSummary2": "解锁条件",
    "settings.bonusSummary2b": "有效手数",
    "settings.bonusSummary2c": "有效流水",
    "settings.bonusSummary3": "防薅机制",
    "settings.bonusSummary3b": "仅公共房 ≥3人牌局计入，私房不计入",
    "settings.bonusSummary4": "未充值用户不能进入私人房间",
    "users.colBonus": "奖金",
  },
  "zh-TW": {
    "admin.title": "Vera 管理後台",
    "admin.subtitle": "管理控制台",
    "admin.back": "返回",
    "admin.signIn": "登入以繼續",
    "admin.signInDesc": "訪問管理後台需要管理員權限",
    "admin.signInBtn": "登入",
    "admin.accessDenied": "訪問被拒絕",
    "admin.accessDeniedDesc": "需要管理員權限",
    "tab.config": "系統配置",
    "tab.users": "用戶管理",
    "tab.rooms": "房間管理",
    "tab.finance": "財務管理",
    "tab.agents": "代理管理",
    "tab.risk": "風控中心",
    "tab.faq": "FAQ知識庫",
    "tab.settings": "系統設置",
    "tab.stats": "數據統計",
    "tab.staff": "員工管理",
    "tab.csRecords": "客服記錄",
    "tab.banners": "活動管理",
    "tab.tournaments": "錦標賽管理",
    "tab.logs": "操作日誌",
    "logs.title": "操作日誌",
    "logs.noLogs": "暫無日誌記錄",
    "logs.all": "全部",
    "logs.finance": "財務",
    "logs.user": "用戶",
    "logs.room": "房間",
    "logs.config": "配置",
    "logs.agent": "代理",
    "logs.system": "系統",
    "logs.auth": "認證",
    "logs.today": "今日操作",
    "logs.total": "總操作數",
    "logs.operator": "操作人",
    "logs.action": "操作",
    "logs.target": "目標",
    "logs.time": "時間",
    "logs.status": "狀態",
    "logs.detail": "詳情",
    "logs.success": "成功",
    "logs.failed": "失敗",
    "staff.title": "員工管理",
    "staff.create": "創建員工帳戶",
    "staff.username": "登入用戶名",
    "staff.password": "登入密碼",
    "staff.role": "角色",
    "staff.roleCsLabel": "客服",
    "staff.roleFinanceLabel": "財務",
    "staff.roleTechLabel": "技術",
    "staff.createBtn": "創建",
    "staff.list": "員工列表",
    "staff.noStaff": "暫無員工帳戶",
    "staff.resetPwd": "重置密碼",
    "staff.delete": "刪除",
    "staff.confirmDelete": "確認刪除該員工？",
    "staff.created": "創建成功",
    "staff.deleted": "已刪除",
    "staff.pwdReset": "密碼已重置",
    "config.title": "系統配置",
    "config.gameSettings": "遊戲設置",
    "config.agentSystem": "代理系統",
    "config.finance": "財務設置",
    "config.riskControl": "風控設置",
    "config.privateRoom": "私人房設置",
    "config.walletAddress": "收款錢包地址",
    "config.blockchainApi": "區塊鏈 API 配置",
    "config.tonOnchain": "TON 上鏈錢包配置",
    "config.addNew": "新增配置",
    "config.key": "鍵名",
    "config.value": "值",
    "config.label": "標籤",
    "config.category": "分類",
    "config.saved": "配置已保存！",
    "config.keyValueRequired": "鍵名和值為必填項",
    "users.title": "用戶管理",
    "users.noUsers": "暫無用戶",
    "users.updated": "用戶已更新",
    "rooms.title": "房間管理",
    "rooms.noRooms": "暫無房間",
    "rooms.updated": "房間已更新",
    "rooms.deleted": "房間已刪除",
    "rooms.deleteConfirm": "確定永久刪除此房間？",
    "rooms.pause": "暫停",
    "rooms.resume": "恢復",
    "rooms.close": "關閉",
    "rooms.delete": "刪除",
    "rooms.players": "玩家",
    "rooms.create": "建立房間",
    "rooms.edit": "編輯",
    "rooms.created": "房間建立成功",
    "rooms.createTitle": "建立新房間",
    "rooms.editTitle": "編輯房間",
    "rooms.name": "房間名稱",
    "rooms.type": "類型",
    "rooms.gameType": "遊戲類型",
    "rooms.smallBlind": "小盲",
    "rooms.bigBlind": "大盲",
    "rooms.minBuyIn": "最小買入",
    "rooms.maxBuyIn": "最大買入",
    "rooms.maxPlayers": "最大玩家數",
    "rooms.totalRounds": "總手數",
    "rooms.billingMode": "計費模式",
    "rooms.roundFee": "每手費用",
    "rooms.rakePercent": "抽水比例(%)",
    "rooms.rakeCap": "抽水上限",
    "rooms.fairnessLevel": "公平等級",
    "rooms.public": "公開",
    "rooms.private": "私密",
    "rooms.texasHoldem": "德州撲克",
    "rooms.omaha": "奧馬哈",
    "rooms.standardRake": "標準抽水",
    "rooms.perRoundFee": "每手固定費",
    "rooms.basic": "基礎",
    "rooms.medium": "中等",
    "rooms.high": "高級",
    "rooms.unlimited": "無限制",
    "rooms.presets": "快速預設",
    "rooms.presetLow": "低級桌",
    "rooms.presetMid": "中級桌",
    "rooms.presetHigh": "高級桌",
    "rooms.presetVip": "VIP桌",
    "rooms.save": "儲存",
    "rooms.cancel": "取消",
    "rooms.inviteCode": "邀請碼",
    "rooms.tableNo": "桌號",
    "rooms.status": "狀態",
    "finance.title": "財務概覽",
    "finance.totalVolume": "總交易額",
    "finance.totalTx": "總交易數",
    "finance.recentTx": "最近交易",
    "finance.noTx": "暫無交易記錄",
    "agents.title": "代理管理",
    "agents.totalRel": "代理關係數",
    "agents.totalComm": "佣金記錄數",
    "agents.relationships": "代理關係",
    "agents.noRel": "暫無代理關係",
    "agents.recentComm": "最近佣金",
    "agents.noComm": "暫無佣金記錄",
    "risk.title": "風控中心",
    "risk.flagged": "標記事件",
    "risk.antiAbuse": "反作弊",
    "risk.rules": "反作弊規則",
    "risk.regGate": "註冊門檻",
    "risk.deviceFp": "設備指紋",
    "risk.behavior": "行為分析",
    "risk.sameTable": "同桌比例檢測",
    "risk.active": "已啟用",
    "risk.configHint": "在 系統配置 → 風控設置 中調整閾值",
    "risk.log": "檢測日誌",
    "risk.noEvents": "暫無可疑活動",
    "faq.title": "FAQ管理（AI知識庫）",
    "faq.addEntry": "新增FAQ",
    "faq.question": "問題",
    "faq.answer": "回答",
    "faq.saved": "FAQ已保存！",
    "faq.deleted": "FAQ已刪除",
    "faq.qaRequired": "問題和回答為必填項",
    "faq.existing": "已有FAQ",
    "faq.noEntries": "暫無FAQ。添加一些來驅動AI客服。",
    "settings.title": "系統設置",
    "settings.maintenance": "維護模式",
    "settings.maintenanceDesc": "啟用後玩家無法進入遊戲",
    "settings.defaultLang": "默認語言",
    "settings.tgBot": "Telegram Bot 配置",
    "settings.botUsername": "Bot 用戶名",
    "settings.botToken": "Bot Token（隱藏）",
    "settings.csTg": "人工客服 TG 號",
    "settings.csTgDesc": "玩家在在線客服中點擊\u201c轉人工\u201d時，將跳轉到此 Telegram 帳號的對話",
    "settings.supportedLangs": "支持語言列表",
    "settings.saved": "設置已保存！",
    "stats.title": "數據看板",
    "stats.totalUsers": "總用戶數",
    "stats.totalRooms": "總房間數",
    "stats.totalTx": "總交易數",
    "stats.totalVolume": "總交易額",
    "stats.dau": "日活躍用戶",
    "stats.dailyVolume": "每日交易量",
    "stats.dailyHands": "每日牌局數",
    "stats.trend": "趨勢圖表",
    "stats.last14days": "近14天",
    "stats.users": "用戶數",
    "stats.volume": "交易額",
    "stats.hands": "牌局數",
    "stats.today": "今日新增",
    "stats.todayNew": "今日新增",
    "stats.todayActive": "今日活躍",
    "stats.totalBalance": "平台總余額",
    "stats.platformFunds": "用戶資金",
    "stats.pendingWithdrawals": "待審批提現",
    "common.user": "用戶",
    "common.agent": "代理",
    "common.level": "等級",
    "users.normal": "正常",
    "users.watch": "觀察",
    "users.frozen": "凍結",
    "users.banned": "封禁",
    "agents.unlocked": "已解鎖",
    "agents.pending": "待解鎖",
    "risk.layers": "4層防禦",
    "faq.catGeneral": "綜合",
    "faq.catDeposit": "充值",
    "faq.catWithdraw": "提現",
    "faq.catGame": "遊戲規則",
    "faq.catAgent": "代理",
    "faq.catSecurity": "安全",
    "users.totalGameUsers": "遊戲用戶",
    "users.todayNew": "今日新增",
    "users.todayActive": "今日活躍",
    "users.totalBalance": "平台總餘額",
    "users.search": "搜尋用戶名 / TG ID / 用戶ID...",
    "users.colUser": "用戶",
    "users.colIp": "IP / 地區",
    "users.colLastLogin": "最後登入",
    "users.colBalance": "餘額",
    "users.colStatus": "狀態",
    "users.prevPage": "上一頁",
    "users.nextPage": "下一頁",
    "users.manualTopUp": "手動充值",
    "users.topUpAmount": "充值金額",
    "users.topUpNote": "備注（可選）",
    "users.confirmTopUp": "確認充值",
    "users.topUpSuccess": "充值成功",
    "users.topUpTitle": "管理員手動充值",
    "users.infoTab": "基本資訊",
    "users.depositsTab": "充值記錄",
    "users.withdrawalsTab": "提現記錄",
    "users.gamesTab": "遊戲記錄",
    "users.gameFlowTab": "遊戲流水",
    "users.balance": "餘額",
    "users.totalHands": "總手數",
    "users.totalWins": "勝場",
    "users.winRate": "勝率",
    "users.totalDeposited": "累計充值",
    "users.totalWithdrawn": "累計提現",
    "users.riskLevel": "風控等級",
    "users.agentLevel": "代理等級",
    "users.regularUser": "普通用戶",
    "users.registeredAt": "注冊時間",
    "users.lastLogin": "最後登入",
    "users.noTx": "暫無記錄",
    "users.noGames": "暫無遊戲記錄",
    "users.adminTopUp": "管理員充值",
    "users.online": "在線",
    "users.offline": "離線",
    "users.atTable": "在桌",
    "config.gameCat": "遊戲設置",
    "config.agentCat": "代理系統",
    "config.financeCat": "財務設置",
    "config.riskCat": "風控設置",
    "config.roomCat": "私人房設置",
    "staff.newPassword": "新密碼",
    "staff.confirm": "確認",
    "common.copied": "已複製",
    "common.copy": "複製",
    "common.noData": "暫無數據",
    "finance.pendingWithdrawals": "待審批提現",
    "finance.noPending": "暫無待審批提現",
    "finance.approveWithdrawal": "審批提現",
    "finance.txHash": "鏈上交易哈希 (TX Hash)",
    "finance.txHashPlaceholder": "0x...",
    "finance.confirmApprove": "確認轉賬完成",
    "finance.cancelApprove": "取消",
    "finance.approved": "已審批",
    "finance.rejected": "已拒絕",
    "finance.reject": "拒絕",
    "finance.approve": "審批",
    "finance.amount": "金額",
    "finance.chain": "鏈",
    "finance.address": "地址",
    "finance.status": "狀態",
    "finance.time": "時間",
    "finance.user": "用戶",
    "finance.type": "類型",
    "finance.deposit": "充值",
    "finance.withdraw": "提現",
    "finance.rake": "抽水",
    "finance.commission": "佣金",
    "finance.manualTopUp": "手動充值",
    "finance.autoApproveLimit": "小額自動審批上限",
    "login.title": "Vera 管理後台",
    "login.subtitle": "員工登入",
    "login.username": "用戶名",
    "login.password": "密碼",
    "login.usernamePlaceholder": "請輸入員工帳號",
    "login.passwordPlaceholder": "請輸入密碼",
    "login.submit": "登入",
    "login.emptyError": "請輸入用戶名和密碼",
    "login.failed": "登入失敗",
    "login.welcome": "歡迎回來",
    "login.networkError": "網路錯誤，請重試",
    "finance.confirmDeposit": "確認充値",
    "finance.confirmTransfer": "確認轉賬",
    "finance.pendingCount": "待審核",
    "finance.chainAddr": "鏈 / 地址",
    "finance.withdrawAmount": "提現金額",
    "finance.confirmWithdrawTitle": "確認提現轉賬",
    "finance.txHashLabel": "轉賬 TX Hash",
    "finance.txHashHint": "(必填，請先完成鏈上轉賬)",
    "finance.txHashPlaceholder2": "輸入鏈上轉賬的 Transaction Hash",
    "finance.txHashRequired": "請輸入轉賬 TX Hash",
    "finance.confirmTransferDone": "確認已轉賬",
    "finance.depositConfirmed": "充値已確認",
    "finance.withdrawConfirmed": "提現已確認",
    "finance.rejectConfirm": "確定拒絕該交易？",
    "finance.rejectReason": "管理員拒絕",
    "finance.rejected2": "已拒絕",
    "finance.tabPending": "待審核",
    "finance.tabDeposits": "充値",
    "finance.tabWithdrawals": "提現",
    "finance.tabAll": "全部",
    "finance.totalVolume2": "總流水",
    "finance.totalTxCount": "總交易數",
    "finance.pendingReview": "待審核",
    "finance.chainLabel": "鏈",
    "finance.statusLabel": "狀態",
    "finance.statusPending": "待審核",
    "finance.statusConfirmed": "已確認",
    "finance.statusFailed": "已拒絕",
    "finance.addressLabel": "地址",
    "finance.timeLabel": "時間",
    "finance.userLabel": "用戶",
    "finance.noPendingReview": "暫無待審核交易",
    "finance.tabRake": "抽水",
    "finance.rakeTotal": "總抽水",
    "finance.rakeToday": "今日抽水",
    "finance.rakeTotalHands": "總局數",
    "finance.rakeTodayHands": "今日局數",
    "finance.rakeTrend": "抽水趨勢（14天）",
    "finance.rakeRecords": "抽水明細",
    "finance.rakeAvg": "平均抽水",
    "finance.noRakeRecords": "暫無抽水記錄",
    "tg.oidcTitle": "Telegram Login (OIDC)",
    "tg.clientId": "Client ID",
    "tg.clientIdHint": "BotFather → Login Widget 中顯示的 Client ID（數字）",
    "tg.clientSecret": "Client Secret",
    "tg.clientSecretHint": "BotFather → Login Widget 中顯示的 Client Secret",
    "tg.redirectUri": "Redirect URI",
    "tg.redirectUriHint": "在 BotFather → Login Widget → Redirect URIs 中添加此地址",
    "tg.trustedOrigin": "Trusted Origin",
    "tg.trustedOriginHint": "在 BotFather → Login Widget → Trusted Origins 中添加此地址",
    "tg.miniAppTitle": "Mini App 配置",
    "tg.miniAppUrl": "Mini App URL",
    "tg.miniAppUrlHint": "在 BotFather 中設置 Web App URL 為此地址",
    "tg.webhookUrl": "Webhook URL",
    "tg.webhookUrlHint": "在 BotFather 或 API 中設置 Webhook 為此地址",
    "tg.setWebhookCmd": "設置 Webhook 命令",
    "tg.botUsernameHint": "填寫 Bot 的用戶名（如 VeraPokerBot），不含 @",
    "tg.botTokenHint": "完整 Token（如 123456789:ABCxxx），Bot ID 會自動提取",
    "config.catGame": "遂戲設置",
    "config.catAgent": "代理系統",
    "config.catFinance": "財務設置",
    "config.catRisk": "風控設置",
    "config.catRoom": "私人房設置",
    "toast.copied": "已複製",
    "toast.bannerUploading": "圖片正在上傳中，請稍候...",
    "toast.bannerTitleRequired": "請填寫標題",
    "toast.bannerImageRequired": "請上傳圖片或輸入圖片 URL",
    "toast.bannerSizeExceeded": "圖片不能超過 5MB",
    "toast.bannerUploadSuccess": "圖片上傳成功，可點擊建立",
    "toast.bannerUploadFailed": "圖片上傳失敗",
    "toast.bannerReadFileFailed": "讀取檔案失敗",
    "toast.tournamentCreated": "建立成功",
    "toast.tournamentUpdated": "更新成功",
    "toast.tournamentDeleted": "刪除成功",
    "toast.tournamentRegOpen": "已開放報名，前端大廳現在可見",
    "toast.tournamentStarted": "比賽已開始，系統已自動分桌",
    "toast.tournamentCancelled": "比賽已取消，已退款",
    "toast.tournamentPrizesDone": "獎金發放完成！共發放 {count} 人，比賽已結束",
    "toast.tournamentNameTimeRequired": "請填寫比賽名稱和開賽時間",
    "banners.add": "添加 Banner",
    "banners.edit": "編輯 Banner",
    "banners.empty": "暫無 Banner，點擊上方按鈕添加",
    "banners.linkType": "點擊動作",
    "banners.linkUrl": "鏈接地址",
    "banners.sortOrder": "排序（小的在前）",
    "banners.title": "標題",
    "csRecords.clear": "清除",
    "csRecords.count": "消息數",
    "csRecords.detail": "對話詳情",
    "csRecords.empty": "暫無客服對話記錄",
    "csRecords.lastMsg": "最後消息",
    "csRecords.search": "搜索",
    "csRecords.searchPlaceholder": "搜索用戶名 / TG用戶名 / 用戶ID",
    "csRecords.searchResult": "搜索結果",
    "csRecords.time": "時間",
    "csRecords.user": "用戶",
    "csRecords.users": "個用戶",
    "settings.registrationBonus": "註冊獎金設置",
    "settings.registrationBonusDesc": "新用戶註冊自動發放獎金，需滿足條件後才能提現（防薅羊毛）",
    "settings.bonusAmount": "註冊贈送金額 (USDT)",
    "settings.bonusAmountHint": "設為 0 則不發放註冊獎金",
    "settings.bonusMinHands": "解鎖最低有效手數",
    "settings.bonusMinHandsHint": "僅公共房間 ≥3人牌局計入有效手數（私房不計入）",
    "settings.bonusWagerMultiplier": "解鎖流水倍數",
    "settings.bonusWagerHint": "需下注流水 ≥ 獎金 × 倍數才能解鎖提現",
    "settings.bonusSummary": "當前規則摘要",
    "settings.bonusSummary1": "註冊贈送",
    "settings.bonusSummary2": "解鎖條件",
    "settings.bonusSummary2b": "有效手數",
    "settings.bonusSummary2c": "有效流水",
    "settings.bonusSummary3": "防薅機制",
    "settings.bonusSummary3b": "僅公共房 ≥3人牌局計入，私房不計入",
    "settings.bonusSummary4": "未充值用戶不能進入私人房間",
    "users.colBonus": "獎金",
  },
  "en": {
    "admin.title": "Vera Admin",
    "admin.subtitle": "Management Console",
    "admin.back": "Back",
    "admin.signIn": "Sign in to continue",
    "admin.signInDesc": "Admin privileges required to access this panel",
    "admin.signInBtn": "Sign In",
    "admin.accessDenied": "Access Denied",
    "admin.accessDeniedDesc": "Admin privileges required",
    "tab.config": "Configuration",
    "tab.users": "Users",
    "tab.rooms": "Rooms",
    "tab.finance": "Finance",
    "tab.agents": "Agents",
    "tab.risk": "Risk Control",
    "tab.faq": "FAQ",
    "tab.settings": "System",
    "tab.stats": "Statistics",
    "tab.staff": "Staff",
    "tab.csRecords": "CS Records",
    "tab.banners": "Banners",
    "tab.tournaments": "Tournaments",
    "tab.logs": "Logs",
    "logs.title": "Operation Logs",
    "logs.noLogs": "No logs yet",
    "logs.all": "All",
    "logs.finance": "Finance",
    "logs.user": "User",
    "logs.room": "Room",
    "logs.config": "Config",
    "logs.agent": "Agent",
    "logs.system": "System",
    "logs.auth": "Auth",
    "logs.today": "Today",
    "logs.total": "Total",
    "logs.operator": "Operator",
    "logs.action": "Action",
    "logs.target": "Target",
    "logs.time": "Time",
    "logs.status": "Status",
    "logs.detail": "Detail",
    "logs.success": "Success",
    "logs.failed": "Failed",
    "staff.title": "Staff Management",
    "staff.create": "Create Staff Account",
    "staff.username": "Username",
    "staff.password": "Password",
    "staff.role": "Role",
    "staff.roleCsLabel": "Customer Service",
    "staff.roleFinanceLabel": "Finance",
    "staff.roleTechLabel": "Tech",
    "staff.createBtn": "Create",
    "staff.list": "Staff List",
    "staff.noStaff": "No staff accounts",
    "staff.resetPwd": "Reset Password",
    "staff.delete": "Delete",
    "staff.confirmDelete": "Confirm delete this staff?",
    "staff.created": "Created successfully",
    "staff.deleted": "Deleted",
    "staff.pwdReset": "Password reset",
    "config.title": "System Configuration",
    "config.gameSettings": "Game Settings",
    "config.agentSystem": "Agent System",
    "config.finance": "Finance",
    "config.riskControl": "Risk Control",
    "config.privateRoom": "Private Room",
    "config.walletAddress": "Wallet Addresses",
    "config.blockchainApi": "Blockchain API Config",
    "config.tonOnchain": "TON On-Chain Wallet Config",
    "config.addNew": "Add New Configuration",
    "config.key": "Key",
    "config.value": "Value",
    "config.label": "Label",
    "config.category": "Category",
    "config.saved": "Configuration saved!",
    "config.keyValueRequired": "Key and value required",
    "users.title": "User Management",
    "users.noUsers": "No users yet",
    "users.updated": "User updated",
    "rooms.title": "Room Management",
    "rooms.noRooms": "No rooms created yet",
    "rooms.updated": "Room updated",
    "rooms.deleted": "Room deleted",
    "rooms.deleteConfirm": "Delete this room permanently?",
    "rooms.pause": "Pause",
    "rooms.resume": "Resume",
    "rooms.close": "Close",
    "rooms.delete": "Delete",
    "rooms.players": "players",
    "rooms.create": "Create Room",
    "rooms.edit": "Edit",
    "rooms.created": "Room created successfully",
    "rooms.createTitle": "Create New Room",
    "rooms.editTitle": "Edit Room",
    "rooms.name": "Room Name",
    "rooms.type": "Type",
    "rooms.gameType": "Game Type",
    "rooms.smallBlind": "Small Blind",
    "rooms.bigBlind": "Big Blind",
    "rooms.minBuyIn": "Min Buy-In",
    "rooms.maxBuyIn": "Max Buy-In",
    "rooms.maxPlayers": "Max Players",
    "rooms.totalRounds": "Total Rounds",
    "rooms.billingMode": "Billing Mode",
    "rooms.roundFee": "Round Fee",
    "rooms.rakePercent": "Rake %",
    "rooms.rakeCap": "Rake Cap",
    "rooms.fairnessLevel": "Fairness Level",
    "rooms.public": "Public",
    "rooms.private": "Private",
    "rooms.texasHoldem": "Texas Hold'em",
    "rooms.omaha": "Omaha",
    "rooms.standardRake": "Standard Rake",
    "rooms.perRoundFee": "Per Round Fee",
    "rooms.basic": "Basic",
    "rooms.medium": "Medium",
    "rooms.high": "High",
    "rooms.unlimited": "Unlimited",
    "rooms.presets": "Quick Presets",
    "rooms.presetLow": "Low Stakes",
    "rooms.presetMid": "Mid Stakes",
    "rooms.presetHigh": "High Stakes",
    "rooms.presetVip": "VIP Table",
    "rooms.save": "Save",
    "rooms.cancel": "Cancel",
    "rooms.inviteCode": "Invite Code",
    "rooms.tableNo": "Table No.",
    "rooms.status": "Status",
    "finance.title": "Financial Overview",
    "finance.totalVolume": "Total Volume",
    "finance.totalTx": "Total Transactions",
    "finance.recentTx": "Recent Transactions",
    "finance.noTx": "No transactions yet",
    "agents.title": "Agent Management",
    "agents.totalRel": "Total Relationships",
    "agents.totalComm": "Total Commissions",
    "agents.relationships": "Agent Relationships",
    "agents.noRel": "No agent relationships yet",
    "agents.recentComm": "Recent Commissions",
    "agents.noComm": "No commission records yet",
    "risk.title": "Risk Control",
    "risk.flagged": "Flagged Events",
    "risk.antiAbuse": "Anti-Abuse",
    "risk.rules": "Anti-Abuse Rules",
    "risk.regGate": "Registration Gate",
    "risk.deviceFp": "Device Fingerprint",
    "risk.behavior": "Behavior Analysis",
    "risk.sameTable": "Same-table Ratio Check",
    "risk.active": "Active",
    "risk.configHint": "Configure thresholds in Config → Risk Control section",
    "risk.log": "Detection Log",
    "risk.noEvents": "No suspicious activity detected",
    "faq.title": "FAQ Management (AI Knowledge Base)",
    "faq.addEntry": "Add FAQ Entry",
    "faq.question": "Question",
    "faq.answer": "Answer",
    "faq.saved": "FAQ saved!",
    "faq.deleted": "FAQ deleted",
    "faq.qaRequired": "Question and answer required",
    "faq.existing": "Existing FAQs",
    "faq.noEntries": "No FAQ entries. Add some to power the AI customer service.",
    "settings.title": "System Settings",
    "settings.maintenance": "Maintenance Mode",
    "settings.maintenanceDesc": "When enabled, players cannot access the game",
    "settings.defaultLang": "Default Language",
    "settings.tgBot": "Telegram Bot Configuration",
    "settings.botUsername": "Bot Username",
    "settings.botToken": "Bot Token (hidden)",
    "settings.csTg": "Human CS Telegram",
    "settings.csTgDesc": "When players click 'Transfer to Human' in AI chat, they will be redirected to this Telegram account",
    "settings.supportedLangs": "Supported Languages",
    "settings.saved": "Setting saved!",
    "stats.title": "Analytics Dashboard",
    "stats.totalUsers": "Total Users",
    "stats.totalRooms": "Total Rooms",
    "stats.totalTx": "Total Transactions",
    "stats.totalVolume": "Total Volume",
    "stats.dau": "Daily Active Users",
    "stats.dailyVolume": "Daily Volume",
    "stats.dailyHands": "Daily Hands",
    "stats.trend": "Trend Charts",
    "stats.last14days": "Last 14 Days",
    "stats.users": "Users",
    "stats.volume": "Volume",
    "stats.hands": "Hands",
    "stats.today": "Today",
    "stats.todayNew": "Today New",
    "stats.todayActive": "Today Active",
    "stats.totalBalance": "Total Balance",
    "stats.platformFunds": "User Funds",
    "stats.pendingWithdrawals": "Pending Withdrawals",
    "common.user": "User",
    "common.agent": "Agent",
    "common.level": "Level",
    "users.normal": "Normal",
    "users.watch": "Watch",
    "users.frozen": "Frozen",
    "users.banned": "Banned",
    "agents.unlocked": "Unlocked",
    "agents.pending": "Pending",
    "risk.layers": "4-Layer Defense",
    "faq.catGeneral": "General",
    "faq.catDeposit": "Deposit",
    "faq.catWithdraw": "Withdraw",
    "faq.catGame": "Game Rules",
    "faq.catAgent": "Agent",
    "faq.catSecurity": "Security",
    "users.totalGameUsers": "Game Users",
    "users.todayNew": "New Today",
    "users.todayActive": "Active Today",
    "users.totalBalance": "Platform Balance",
    "users.search": "Search username / TG ID / User ID...",
    "users.colUser": "User",
    "users.colIp": "IP / Region",
    "users.colLastLogin": "Last Login",
    "users.colBalance": "Balance",
    "users.colStatus": "Status",
    "users.prevPage": "Prev",
    "users.nextPage": "Next",
    "users.manualTopUp": "Manual Top-Up",
    "users.topUpAmount": "Amount",
    "users.topUpNote": "Note (optional)",
    "users.confirmTopUp": "Confirm Top-Up",
    "users.topUpSuccess": "Top-up successful",
    "users.topUpTitle": "Admin Manual Top-Up",
    "users.infoTab": "Info",
    "users.depositsTab": "Deposits",
    "users.withdrawalsTab": "Withdrawals",
    "users.gamesTab": "Game History",
    "users.gameFlowTab": "Game Flow",
    "users.balance": "Balance",
    "users.totalHands": "Total Hands",
    "users.totalWins": "Wins",
    "users.winRate": "Win Rate",
    "users.totalDeposited": "Total Deposited",
    "users.totalWithdrawn": "Total Withdrawn",
    "users.riskLevel": "Risk Level",
    "users.agentLevel": "Agent Level",
    "users.regularUser": "Regular User",
    "users.registeredAt": "Registered",
    "users.lastLogin": "Last Login",
    "users.noTx": "No records",
    "users.noGames": "No game history",
    "users.adminTopUp": "Admin Top-Up",
    "users.online": "Online",
    "users.offline": "Offline",
    "users.atTable": "At Table",
    "config.gameCat": "Game Settings",
    "config.agentCat": "Agent System",
    "config.financeCat": "Finance",
    "config.riskCat": "Risk Control",
    "config.roomCat": "Private Room",
    "staff.newPassword": "New Password",
    "staff.confirm": "Confirm",
    "common.copied": "Copied",
    "common.copy": "Copy",
    "common.noData": "No data",
    "finance.pendingWithdrawals": "Pending Withdrawals",
    "finance.noPending": "No pending withdrawals",
    "finance.approveWithdrawal": "Approve Withdrawal",
    "finance.txHash": "On-chain TX Hash",
    "finance.txHashPlaceholder": "0x...",
    "finance.confirmApprove": "Confirm Transfer Done",
    "finance.cancelApprove": "Cancel",
    "finance.approved": "Approved",
    "finance.rejected": "Rejected",
    "finance.reject": "Reject",
    "finance.approve": "Approve",
    "finance.amount": "Amount",
    "finance.chain": "Chain",
    "finance.address": "Address",
    "finance.status": "Status",
    "finance.time": "Time",
    "finance.user": "User",
    "finance.type": "Type",
    "finance.deposit": "Deposit",
    "finance.withdraw": "Withdrawal",
    "finance.rake": "Rake",
    "finance.commission": "Commission",
    "finance.manualTopUp": "Manual Top-Up",
    "finance.autoApproveLimit": "Auto-Approve Limit",
    "login.title": "Vera Admin",
    "login.subtitle": "Staff Login",
    "login.username": "Username",
    "login.password": "Password",
    "login.usernamePlaceholder": "Enter staff account",
    "login.passwordPlaceholder": "Enter password",
    "login.submit": "Sign In",
    "login.emptyError": "Please enter username and password",
    "login.failed": "Login failed",
    "login.welcome": "Welcome back",
    "login.networkError": "Network error, please retry",
    "finance.confirmDeposit": "Confirm Deposit",
    "finance.confirmTransfer": "Confirm Transfer",
    "finance.pendingCount": "Pending",
    "finance.chainAddr": "Chain / Address",
    "finance.withdrawAmount": "Withdrawal Amount",
    "finance.confirmWithdrawTitle": "Confirm Withdrawal Transfer",
    "finance.txHashLabel": "Transfer TX Hash",
    "finance.txHashHint": "(Required - complete on-chain transfer first)",
    "finance.txHashPlaceholder2": "Enter on-chain Transaction Hash",
    "finance.txHashRequired": "Please enter TX Hash",
    "finance.confirmTransferDone": "Confirm Transfer Done",
    "finance.depositConfirmed": "Deposit confirmed",
    "finance.withdrawConfirmed": "Withdrawal confirmed",
    "finance.rejectConfirm": "Reject this transaction?",
    "finance.rejectReason": "Admin rejected",
    "finance.rejected2": "Rejected",
    "finance.tabPending": "Pending",
    "finance.tabDeposits": "Deposits",
    "finance.tabWithdrawals": "Withdrawals",
    "finance.tabAll": "All",
    "finance.totalVolume2": "Total Volume",
    "finance.totalTxCount": "Total Transactions",
    "finance.pendingReview": "Pending Review",
    "finance.chainLabel": "Chain",
    "finance.statusLabel": "Status",
    "finance.statusPending": "Pending",
    "finance.statusConfirmed": "Confirmed",
    "finance.statusFailed": "Rejected",
    "finance.addressLabel": "Address",
    "finance.timeLabel": "Time",
    "finance.userLabel": "User",
    "finance.noPendingReview": "No pending transactions",
    "finance.tabRake": "Rake",
    "finance.rakeTotal": "Total Rake",
    "finance.rakeToday": "Today Rake",
    "finance.rakeTotalHands": "Total Hands",
    "finance.rakeTodayHands": "Today Hands",
    "finance.rakeTrend": "Rake Trend (14 days)",
    "finance.rakeRecords": "Rake Records",
    "finance.rakeAvg": "Avg Rake",
    "finance.noRakeRecords": "No rake records",
    "tg.oidcTitle": "Telegram Login (OIDC)",
    "tg.clientId": "Client ID",
    "tg.clientIdHint": "Client ID shown in BotFather → Login Widget (numeric)",
    "tg.clientSecret": "Client Secret",
    "tg.clientSecretHint": "Client Secret shown in BotFather → Login Widget",
    "tg.redirectUri": "Redirect URI",
    "tg.redirectUriHint": "Add this URL in BotFather → Login Widget → Redirect URIs",
    "tg.trustedOrigin": "Trusted Origin",
    "tg.trustedOriginHint": "Add this URL in BotFather → Login Widget → Trusted Origins",
    "tg.miniAppTitle": "Mini App Configuration",
    "tg.miniAppUrl": "Mini App URL",
    "tg.miniAppUrlHint": "Set Web App URL to this address in BotFather",
    "tg.webhookUrl": "Webhook URL",
    "tg.webhookUrlHint": "Set Webhook to this address in BotFather or API",
    "tg.setWebhookCmd": "Set Webhook Command",
    "tg.botUsernameHint": "Enter Bot username (e.g. VeraPokerBot), without @",
    "tg.botTokenHint": "Full token (e.g. 123456789:ABCxxx), Bot ID will be extracted automatically",
    "config.catGame": "Game Settings",
    "config.catAgent": "Agent System",
    "config.catFinance": "Finance",
    "config.catRisk": "Risk Control",
    "config.catRoom": "Private Room",
    "toast.copied": "Copied",
    "toast.bannerUploading": "Image is uploading, please wait...",
    "toast.bannerTitleRequired": "Please enter a title",
    "toast.bannerImageRequired": "Please upload an image or enter image URL",
    "toast.bannerSizeExceeded": "Image cannot exceed 5MB",
    "toast.bannerUploadSuccess": "Image uploaded successfully",
    "toast.bannerUploadFailed": "Image upload failed",
    "toast.bannerReadFileFailed": "Failed to read file",
    "toast.tournamentCreated": "Created successfully",
    "toast.tournamentUpdated": "Updated successfully",
    "toast.tournamentDeleted": "Deleted successfully",
    "toast.tournamentRegOpen": "Registration opened, now visible in lobby",
    "toast.tournamentStarted": "Tournament started, tables assigned automatically",
    "toast.tournamentCancelled": "Tournament cancelled, refunds issued",
    "toast.tournamentPrizesDone": "Prizes distributed to {count} players, tournament ended",
    "toast.tournamentNameTimeRequired": "Please enter tournament name and start time",
    "banners.add": "Add Banner",
    "banners.edit": "Edit Banner",
    "banners.empty": "No banners yet, click above to add",
    "banners.linkType": "Click Action",
    "banners.linkUrl": "Link URL",
    "banners.sortOrder": "Sort Order (smaller first)",
    "banners.title": "Title",
    "csRecords.clear": "Clear",
    "csRecords.count": "Messages",
    "csRecords.detail": "Chat Details",
    "csRecords.empty": "No customer service records",
    "csRecords.lastMsg": "Last Message",
    "csRecords.search": "Search",
    "csRecords.searchPlaceholder": "Search username / TG username / User ID",
    "csRecords.searchResult": "Search Results",
    "csRecords.time": "Time",
    "csRecords.user": "User",
    "csRecords.users": "users",
    "settings.registrationBonus": "Registration Bonus",
    "settings.registrationBonusDesc": "Auto-grant bonus on registration, withdrawal requires meeting conditions (anti-abuse)",
    "settings.bonusAmount": "Bonus Amount (USDT)",
    "settings.bonusAmountHint": "Set to 0 to disable registration bonus",
    "settings.bonusMinHands": "Min Valid Hands to Unlock",
    "settings.bonusMinHandsHint": "Only public room hands with 3+ players count (private rooms excluded)",
    "settings.bonusWagerMultiplier": "Wagering Multiplier",
    "settings.bonusWagerHint": "Total wagering must be >= bonus × multiplier to unlock withdrawal",
    "settings.bonusSummary": "Current Rules Summary",
    "settings.bonusSummary1": "Registration Bonus",
    "settings.bonusSummary2": "Unlock Conditions",
    "settings.bonusSummary2b": "Valid Hands",
    "settings.bonusSummary2c": "Valid Wagering",
    "settings.bonusSummary3": "Anti-Abuse",
    "settings.bonusSummary3b": "Only public rooms with 3+ players count, private rooms excluded",
    "settings.bonusSummary4": "Users without deposits cannot enter private rooms",
    "users.colBonus": "Bonus",
  },
};

function useAdminLang() {
  const [lang, setLang] = useState<AdminLang>(() => {
    const saved = localStorage.getItem("vera-admin-lang") as AdminLang | null;
    return saved || "zh-CN";
  });
  const changeLang = (newLang: AdminLang) => {
    setLang(newLang);
    localStorage.setItem("vera-admin-lang", newLang);
  };
  const at = (key: string): string => adminI18n[lang]?.[key] || adminI18n["en"]?.[key] || key;
  return { lang, changeLang, at };
}

// ==================== INLINE STAFF LOGIN ====================
function InlineStaffLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { at } = useAdminLang();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(at("login.emptyError"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || at("login.failed"));
        return;
      }
      toast.success(`${at("login.welcome")}，${data.user.name}`);
      onSuccess();
    } catch (err) {
      toast.error(at("login.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold/20" style={{ background: "linear-gradient(to bottom right, #eab308, #a78b00)" }}>
            <Shield className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{at("login.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{at("login.subtitle")}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{at("login.username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={at("login.usernamePlaceholder")}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{at("login.password")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={at("login.passwordPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-background font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.97]" style={{ background: "linear-gradient(to right, #eab308, #a78b00)" }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{at("login.submit")}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==================== ADMIN TABS ====================
type AdminTab = "config" | "users" | "rooms" | "finance" | "risk" | "agents" | "faq" | "settings" | "stats" | "staff" | "logs" | "csRecords" | "banners" | "tournaments" | "marketing" | "bots";

// ==================== MAIN ADMIN COMPONENT ====================
export default function Admin() {
  // Support both admin_users session AND game user admin role (dual auth)
  const { data: adminUser, isLoading: adminLoading } = trpc.auth.adminMe.useQuery();
  const { user: gameUser, loading: gameUserLoading } = useAuth();
  const adminLogoutMutation = trpc.auth.adminLogout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const [activeTab, setActiveTab] = useState<AdminTab>("stats");
  const isMobile = useIsMobile();
  const { lang, changeLang, at } = useAdminLang();

  // Loading state - wait for both auth checks
  if (adminLoading || gameUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  // Check if user has admin access via either method
  const isGameAdmin = gameUser && ["admin", "super_admin"].includes(gameUser.role);
  const hasAdminAccess = !!adminUser || isGameAdmin;

  // Not logged in with any admin credentials → show staff login
  if (!hasAdminAccess) {
    return <InlineStaffLogin onSuccess={() => window.location.reload()} />;
  }

  // Determine effective role and name (admin_users session takes priority)
  const effectiveRole = adminUser?.role ?? (isGameAdmin ? "admin" : "user");
  const effectiveName = adminUser?.name ?? gameUser?.name ?? "Admin";
  const handleLogout = () => {
    if (adminUser) {
      adminLogoutMutation.mutate();
    } else {
      logoutMutation.mutate();
    }
  };

  // Role-based tab permissions
  const roleTabMap: Record<string, AdminTab[]> = {
    super_admin: ["stats", "users", "rooms", "staff", "agents", "finance", "risk", "faq", "config", "settings", "banners", "tournaments", "csRecords", "logs", "marketing", "bots"],
    admin: ["stats", "users", "rooms", "staff", "agents", "finance", "risk", "faq", "config", "settings", "banners", "tournaments", "csRecords", "logs", "marketing", "bots"],
    cs: ["stats", "users", "rooms", "faq", "csRecords"],
    finance: ["stats", "finance", "agents"],
    tech: ["stats", "config", "rooms", "risk", "settings", "banners"],
  };
  const allowedTabs = roleTabMap[effectiveRole] || ["stats"];

  const allTabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: "stats", icon: BarChart3, label: at("tab.stats") },
    { key: "users", icon: Users, label: at("tab.users") },
    { key: "rooms", icon: Layers, label: at("tab.rooms") },
    { key: "staff", icon: Shield, label: at("tab.staff") },
    { key: "agents", icon: UserCheck, label: at("tab.agents") },
    { key: "finance", icon: DollarSign, label: at("tab.finance") },
    { key: "risk", icon: Shield, label: at("tab.risk") },
    { key: "faq", icon: MessageSquare, label: at("tab.faq") },
    { key: "config", icon: Settings, label: at("tab.config") },
    { key: "settings", icon: Settings, label: at("tab.settings") },
    { key: "banners", icon: Layers, label: at("tab.banners") },
    { key: "tournaments", icon: Trophy, label: at("tab.tournaments") },
    { key: "csRecords", icon: MessageSquare, label: at("tab.csRecords") },
    { key: "logs", icon: Eye, label: at("tab.logs") },
    { key: "marketing", icon: Megaphone, label: at("tab.marketing") },
    { key: "bots", icon: Bot, label: "AI机器人" },
  ];
  const tabs = allTabs.filter(t => allowedTabs.includes(t.key));

  // ==================== PC LAYOUT (>= 768px) ====================
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col sticky top-0 h-screen">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(to bottom right, #eab308, #a78b00)" }}>
                <span className="text-sm font-bold text-background">V</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">{at("admin.title")}</h1>
                <p className="text-[10px] text-muted-foreground">{at("admin.subtitle")}</p>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-gold/10 text-gold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-border space-y-2">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 px-2">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              {(["zh-CN", "zh-TW", "en"] as AdminLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    lang === l ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l === "zh-CN" ? "简" : l === "zh-TW" ? "繁" : "EN"}
                </button>
              ))}
            </div>
            {/* User Info */}
            <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-gold">{effectiveName?.charAt(0) || "A"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium truncate max-w-[100px] block">{effectiveName}</span>
                  <span className="text-[9px] text-muted-foreground">{effectiveRole}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => window.location.href = "/lobby"} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title={at("admin.back")}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleLogout} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-danger" title="Logout">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">
            <PanelContent tab={activeTab} at={at} onNavigate={(t) => setActiveTab(t as AdminTab)} />
          </div>
        </main>
      </div>
    );
  }

  // ==================== MOBILE LAYOUT (< 768px) ====================
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(to bottom right, #eab308, #a78b00)" }}>
              <span className="text-[10px] font-bold text-background">V</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gold">{at("admin.title")}</h1>
              <p className="text-[10px] text-muted-foreground">{at("admin.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center gap-0.5">
              {(["zh-CN", "zh-TW", "en"] as AdminLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    lang === l ? "bg-gold/10 text-gold" : "text-muted-foreground"
                  }`}
                >
                  {l === "zh-CN" ? "简" : l === "zh-TW" ? "繁" : "EN"}
                </button>
              ))}
            </div>
            <button onClick={() => window.location.href = "/lobby"} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-3 h-3" />
            </button>
          </div>
        </div>
        {/* Scrollable Tab Bar */}
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <PanelContent tab={activeTab} at={at} onNavigate={(t) => setActiveTab(t as AdminTab)} />
      </main>
    </div>
  );
}

// ==================== PANEL CONTENT ROUTER ====================
function PanelContent({ tab, at, onNavigate }: { tab: AdminTab; at: (key: string) => string; onNavigate: (tab: string) => void }) {
  switch (tab) {
    case "config": return <ConfigPanel at={at} />;
    case "users": return <UsersPanel at={at} />;
    case "rooms": return <RoomsPanel at={at} />;
    case "finance": return <FinancePanel at={at} />;
    case "agents": return <AgentsPanel at={at} />;
    case "risk": return <RiskPanel at={at} />;
    case "faq": return <FaqPanel at={at} />;
    case "settings": return <SystemSettingsPanel at={at} />;
    case "stats": return <StatsPanel at={at} onNavigate={onNavigate} />;
    case "staff": return <StaffPanel at={at} />;
    case "logs": return <LogsPanel at={at} />;
    case "csRecords": return <CsRecordsPanel at={at} />;
    case "banners": return <BannersPanel at={at} />;
    case "tournaments": return <TournamentsPanel at={at} />;
    case "marketing": return <MarketingPanel at={at} />;
    case "bots": return <BotManagementPanel at={at} />;
    default: return null;
  }
}

// ==================== CONFIG PANEL ====================
function ConfigPanel({ at }: { at: (k: string) => string }) {
  const { data: configs, isLoading, refetch } = trpc.config.getAll.useQuery();
  const upsertMutation = trpc.config.upsert.useMutation({
    onSuccess: () => { toast.success(at("config.saved")); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newConfig, setNewConfig] = useState({ key: "", value: "", category: "game", label: "", valueType: "string" as const, isPublic: false });
  const [showSensitiveFields, setShowSensitiveFields] = useState<Record<string, boolean>>({});

  // Chinese labels for config keys
  const configLabels: Record<string, string> = {
    rake_percentage: "抽水比例 (%)",
    rake_cap: "抽水上限",
    min_players_to_start: "最少开局人数",
    turn_timeout_seconds: "回合超时 (秒)",
    max_players_per_table: "每桌最大人数",
    agent_level1_rate: "一级代理佣金率 (%)",
    agent_level2_rate: "二级代理佣金率 (%)",
    unlock_min_hands: "解锁最低手数",
    unlock_min_deposit: "解锁最低充值",
    unlock_min_rake: "解锁最低贡献抽水",
    max_daily_commission: "每日佣金上限",
    min_deposit: "最低充值金额",
    min_withdrawal: "最低提现金额",
    auto_approve_limit: "自动审批限额",
    withdrawal_fee: "提现手续费 (固定U)",
    withdrawal_fee_rate: "提现手续费率 (%) [已废弃]",
    daily_withdrawal_limit: "每日提现限额",
    min_account_age_days: "最低账龄 (天)",
    observation_period_days: "观察期 (天)",
    max_same_table_ratio: "同桌比例上限",
    room_fee_micro: "私人房费用 - 微注",
    room_fee_low: "私人房费用 - 低注",
    room_fee_mid: "私人房费用 - 中注",
    room_fee_high: "私人房费用 - 高注",
    room_fee_premium: "私人房费用 - 豪华",
    discount_5_rounds: "5局折扣",
    discount_10_rounds: "10局折扣",
    discount_20_rounds: "20局折扣",
    discount_50_rounds: "50局折扣",
    deposit_wallet_trc20: "TRC20 收款地址",
    deposit_wallet_erc20: "ERC20 收款地址",
    deposit_wallet_bep20: "BEP20 收款地址",
    deposit_wallet_ton: "TON 收款地址",
    deposit_wallet_polygon: "Polygon 收款地址",
    trongrid_api_key: "TronGrid API Key",
    etherscan_api_key: "Etherscan API Key",
    bscscan_api_key: "BscScan API Key",
    polygonscan_api_key: "PolygonScan API Key",
    auto_confirm_enabled: "自动确认充值 (true/false)",
    auto_confirm_min_confirmations: "最少确认数",
    ton_onchain_wallet_address: "TON 上链钱包地址（用于写入区块链）",
    ton_onchain_wallet_mnemonic: "TON 上链钱包助记词（24个单词，空格分隔）",
  };

  const configGroups: Record<string, string[]> = {
    [at("config.gameSettings")]: ["rake_percentage", "rake_cap", "min_players_to_start", "turn_timeout_seconds", "max_players_per_table"],
    [at("config.agentSystem")]: ["agent_level1_rate", "agent_level2_rate", "unlock_min_hands", "unlock_min_deposit", "unlock_min_rake", "max_daily_commission"],
    [at("config.finance")]: ["min_deposit", "min_withdrawal", "auto_approve_limit", "withdrawal_fee", "daily_withdrawal_limit"],
    [at("config.riskControl")]: ["min_account_age_days", "observation_period_days", "max_same_table_ratio"],
    [at("config.privateRoom")]: ["room_fee_micro", "room_fee_low", "room_fee_mid", "room_fee_high", "room_fee_premium", "discount_5_rounds", "discount_10_rounds", "discount_20_rounds", "discount_50_rounds"],
    [at("config.walletAddress")]: ["deposit_wallet_trc20", "deposit_wallet_erc20", "deposit_wallet_bep20", "deposit_wallet_ton", "deposit_wallet_polygon"],
    [at("config.blockchainApi")]: ["trongrid_api_key", "etherscan_api_key", "bscscan_api_key", "polygonscan_api_key", "auto_confirm_enabled", "auto_confirm_min_confirmations"],
    [at("config.tonOnchain")]: ["ton_onchain_wallet_address", "ton_onchain_wallet_mnemonic"],
    ["Telegram Bot"]: ["tg_bot_token", "tg_bot_username", "tg_webhook_url", "tg_webhook_secret"],
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c]) ?? []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">{at("config.title")}</h2>

      {Object.entries(configGroups).map(([group, keys]) => (
        <div key={group} className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gold mb-3">{group}</h3>
          <div className="space-y-3">
            {keys.map(key => {
              const config = configMap.get(key) as any;
              const currentValue = editValues[key] ?? config?.value ?? "";
              const isSensitive = key.includes("mnemonic") || key.includes("private_key") || key.includes("secret") || key.includes("token");
              const isVisible = showSensitiveFields[key] ?? false;
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <label className="text-xs text-muted-foreground sm:w-48 shrink-0">{configLabels[key] || config?.label || key}</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type={isSensitive && !isVisible ? "password" : "text"}
                      value={currentValue}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 glass rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-gold"
                    />
                    {isSensitive && (
                      <button
                        onClick={() => setShowSensitiveFields(prev => ({ ...prev, [key]: !isVisible }))}
                        className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                        title={isVisible ? "隐藏" : "显示"}
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => upsertMutation.mutate({ key, value: editValues[key] ?? currentValue, category: config?.category ?? "game", label: config?.label ?? key, valueType: config?.valueType ?? "string", isPublic: config?.isPublic ?? false })}
                      className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add New Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-truth-blue mb-3">{at("config.addNew")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder={at("config.key")} value={newConfig.key} onChange={e => setNewConfig(p => ({ ...p, key: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <input placeholder={at("config.value")} value={newConfig.value} onChange={e => setNewConfig(p => ({ ...p, value: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <input placeholder={at("config.label")} value={newConfig.label} onChange={e => setNewConfig(p => ({ ...p, label: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <select value={newConfig.category} onChange={e => setNewConfig(p => ({ ...p, category: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue bg-transparent">
            <option value="game">游戏设置</option>
            <option value="agent">代理系统</option>
            <option value="finance">财务设置</option>
            <option value="risk">风控设置</option>
            <option value="room">私人房设置</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (!newConfig.key || !newConfig.value) return toast.error(at("config.keyValueRequired"));
            upsertMutation.mutate({ ...newConfig, description: "" });
            setNewConfig({ key: "", value: "", category: "game", label: "", valueType: "string", isPublic: false });
          }}
          className="mt-3 px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> {at("config.addNew")}
        </button>
      </div>
    </div>
  );
}

// ==================== USERS PANEL ====================
function UsersPanel({ at }: { at: (k: string) => string }) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = trpc.admin.users.useQuery({ page, limit: 20 });
  const { data: statsData } = trpc.admin.stats.useQuery();
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success(at("users.updated")); refetch(); },
  });

  if (selectedUserId) {
    return <UserDetailPanel userId={selectedUserId} onBack={() => setSelectedUserId(null)} at={at} />;
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const users = (data as any)?.users ?? data ?? [];
  const total = (data as any)?.total ?? 0;
  const filtered = search
    ? (users as any[]).filter((u: any) => 
        (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.tgUsername || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.tgId || "").includes(search) ||
        String(u.id).includes(search)
      )
    : users;

  const riskColors: Record<string, string> = {
    normal: "bg-success/20 text-success",
    watch: "bg-warning/20 text-warning",
    frozen: "bg-blue-500/20 text-blue-400",
    banned: "bg-danger/20 text-danger",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{at("users.title")}</h2>
        <span className="text-xs text-muted-foreground">{total} {at("users.totalGameUsers")}</span>
      </div>
      {/* Stats overview cards */}
      {statsData && (
        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{at("users.totalGameUsers")}</span>
            <span className="text-lg font-bold text-gold">{(statsData as any).totalUsers ?? 0}</span>
          </div>
          <div className="glass rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{at("users.todayNew")}</span>
            <span className="text-lg font-bold text-success">{(statsData as any).todayNewUsers ?? 0}</span>
          </div>
          <div className="glass rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{at("users.todayActive")}</span>
            <span className="text-lg font-bold text-truth-blue">{(statsData as any).todayActiveUsers ?? 0}</span>
          </div>
          <div className="glass rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{at("users.totalBalance")}</span>
            <span className="text-lg font-bold text-gold">${(statsData as any).totalBalance ?? "0.00"}</span>
          </div>
        </div>
      )}
      <input
        type="text"
        placeholder={at("users.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
      {/* Column Header */}
      <div className="grid grid-cols-[1fr_minmax(140px,auto)_auto_auto_auto_auto_auto] gap-2 px-3 text-[10px] text-muted-foreground font-medium">
        <span>{at("users.colUser")}</span>
        <span className="text-center">{at("users.colIp")}</span>
        <span className="text-right w-28">{at("users.colLastLogin")}</span>
        <span className="text-right w-16">{at("users.colBalance")}</span>
        <span className="text-right w-16">{at("users.colBonus")}</span>
        <span className="text-right w-20">{at("users.colStatus")}</span>
        <span className="text-right w-14"></span>
      </div>
      <div className="space-y-1.5">
        {(filtered as any[])?.map((u: any) => (
          <div
            key={u.id}
            className="glass rounded-xl px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={() => setSelectedUserId(u.id)}
          >
            {/* Single row layout */}
            <div className="grid grid-cols-[1fr_minmax(140px,auto)_auto_auto_auto_auto_auto] gap-2 items-center">
              {/* User info */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(to bottom right, rgba(234,179,8,0.3), rgba(234,179,8,0.1))" }}>
                  <span className="text-[10px] font-bold text-gold">{(u.name || u.nickname || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{u.name || u.nickname || "Anonymous"}</span>
                    {u.role !== "user" && (
                      <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-medium ${
                        u.role === "admin" ? "bg-gold/20 text-gold" : "bg-secondary text-muted-foreground"
                      }`}>{u.role}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">#{u.id}{u.tgUsername ? ` @${u.tgUsername}` : ""}</span>
                </div>
              </div>
              {/* IP + Region column */}
              <div className="text-center min-w-0">
                {u.lastIp ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-yellow-400">{u.lastIp}</span>
                    <span className="text-[9px] text-muted-foreground">{u.ipRegion || ""}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">-</span>
                )}
              </div>
              {/* Last login - full date + time */}
              <span className="text-[10px] text-muted-foreground text-right w-28 shrink-0">
                {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
              </span>
              {/* Balance */}
              <span className="text-sm font-mono text-gold text-right w-16 shrink-0">${formatBalance(u.balance)}</span>
              {/* Bonus Status */}
              <div className="w-16 shrink-0 flex justify-end">
                {u.bonusUnlocked ? (
                  <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400">✓ 已解锁</span>
                ) : parseFloat(u.bonusBalance || "0") > 0 ? (
                  <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-400">${formatBalance(parseFloat(u.bonusBalance))}</span>
                ) : (
                  <span className="text-[9px] text-muted-foreground">-</span>
                )}
              </div>
              {/* Online status */}
              <div className="w-20 shrink-0 flex justify-end">
                {u.onlineStatus?.online ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400">
                    {at("users.atTable")}: {u.onlineStatus.roomName}
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground">{at("users.offline")}</span>
                )}
              </div>
              {/* Risk status */}
              <div className="w-14 shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
                <select
                  value={u.riskLevel ?? "normal"}
                  onChange={(e) => { updateMutation.mutate({ id: u.id, riskLevel: e.target.value as any }); }}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium bg-transparent outline-none border-0 cursor-pointer ${
                    riskColors[u.riskLevel ?? "normal"]
                  }`}
                >
                  <option value="normal">{at("users.normal")}</option>
                  <option value="watch">{at("users.watch")}</option>
                  <option value="frozen">{at("users.frozen")}</option>
                  <option value="banned">{at("users.banned")}</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        {((filtered as any[])?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{at("users.noUsers")}</p>
        )}
      </div>
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-xs glass rounded disabled:opacity-50">{at("users.prevPage")}</button>
          <span className="text-xs text-muted-foreground">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 text-xs glass rounded disabled:opacity-50">{at("users.nextPage")}</button>
        </div>
      )}
    </div>
  );
}

// ==================== USER DETAIL PANEL ====================
function UserDetailPanel({ userId, onBack, at }: { userId: number; onBack: () => void; at: (k: string) => string }) {
  const [activeTab, setActiveTab] = useState<"info" | "deposits" | "withdrawals" | "gameflow" | "games" | "downlines">("info");
  // Fix: stabilize query inputs to prevent infinite re-fetch loop
  const [stableUserId] = useState(userId);
  const { data: user, isLoading, error: userError, refetch: refetchUser } = trpc.admin.userDetail.useQuery(
    { id: stableUserId },
    { staleTime: 30_000, retry: 1 }  // 30s cache, only retry once to prevent loops
  );
  const { data: txData } = trpc.admin.userTransactions.useQuery(
    { userId: stableUserId, page: 1, limit: 50, type: activeTab === "deposits" ? "deposit" : activeTab === "withdrawals" ? "withdraw" : undefined },
    { enabled: activeTab === "deposits" || activeTab === "withdrawals", staleTime: 30_000 }
  );
  const { data: gameFlowData } = trpc.admin.userTransactions.useQuery(
    { userId: stableUserId, page: 1, limit: 200 },
    { enabled: activeTab === "gameflow", staleTime: 30_000 }
  );
  const { data: gameData } = trpc.admin.userGameHistory.useQuery(
    { userId: stableUserId, page: 1, limit: 50 },
    { enabled: activeTab === "games", staleTime: 30_000 }
  );
  const { data: downlinesData, isLoading: downlinesLoading } = trpc.admin.userDownlines.useQuery(
    { userId: stableUserId },
    { enabled: activeTab === "downlines", staleTime: 30_000 }
  );
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success(at("users.updated")); refetchUser(); },
  });
  // Manual top-up state
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const topUpMutation = trpc.admin.manualTopUp.useMutation({
    onSuccess: (data) => {
      toast.success(`${at("users.topUpSuccess")} $${data.newBalance}`);
      setShowTopUp(false);
      setTopUpAmount("");
      setTopUpNote("");
      refetchUser();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;
  if (userError || !user) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-sm text-muted-foreground">{userError?.message || at("common.noData")}</p>
      <button onClick={onBack} className="text-xs text-gold hover:underline">{at("admin.back")}</button>
    </div>
  );

  const tabs = [
    { key: "info" as const, label: at("users.infoTab") },
    { key: "deposits" as const, label: at("users.depositsTab") },
    { key: "withdrawals" as const, label: at("users.withdrawalsTab") },
    { key: "gameflow" as const, label: at("users.gameFlowTab") },
    { key: "games" as const, label: at("users.gamesTab") },
    { key: "downlines" as const, label: "下线" },
  ];

  return (
    <div className="space-y-4">
      {/* Manual Top-Up Dialog */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTopUp(false)}>
          <div className="glass-strong rounded-2xl p-5 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gold">{at("users.manualTopUp")}</h3>
              <button onClick={() => setShowTopUp(false)} className="p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{at("users.colUser")}: {(user as any).name || (user as any).nickname} (ID: {(user as any).id})</p>
              <p className="text-xs text-muted-foreground">{at("users.balance")}: <span className="text-gold font-mono">${formatBalance((user as any).balance)}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{at("users.topUpAmount")} (USDT)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={topUpAmount}
                  onChange={e => setTopUpAmount(e.target.value)}
                  className="w-full glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground border border-border focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{at("users.topUpNote")}</label>
                <input
                  type="text"
                  placeholder="充值原因..."
                  value={topUpNote}
                  onChange={e => setTopUpNote(e.target.value)}
                  className="w-full glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground border border-border focus:border-gold"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTopUp(false)} className="flex-1 px-3 py-2 text-sm glass rounded-lg hover:bg-secondary">{at("rooms.cancel")}</button>
              <button
                onClick={() => {
                  const amount = parseFloat(topUpAmount);
                  if (isNaN(amount) || amount <= 0) { toast.error(at("users.topUpAmount")); return; }
                  topUpMutation.mutate({ userId: stableUserId, amount, note: topUpNote || undefined });
                }}
                disabled={topUpMutation.isPending || !topUpAmount}
                className="flex-1 px-3 py-2 text-sm bg-gold text-background rounded-lg font-medium hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {topUpMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                {at("users.confirmTopUp")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 glass rounded-lg hover:bg-secondary/50"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{(user as any).name || (user as any).nickname || "Anonymous"}</h2>
          <span className="text-xs text-muted-foreground">ID: {(user as any).id} {(user as any).tgUsername ? `@${(user as any).tgUsername}` : ""}</span>
        </div>
        <button
          onClick={() => setShowTopUp(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 text-gold rounded-lg text-xs font-medium hover:bg-gold/30 transition-colors"
        >
          <DollarSign className="w-3.5 h-3.5" />
          {at("users.manualTopUp")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.key ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === "info" && (
        <div className="space-y-4">
          {/* Financial Summary */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-gold" />{at("finance.title")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label={at("users.balance")} value={`$${formatBalance((user as any).balance)}`} color="text-gold" />
              <InfoCard label={at("users.colBalance")} value={`$${formatBalance((user as any).frozenBalance)}`} color="text-orange-400" />
              <InfoCard label={at("users.totalDeposited")} value={`$${formatBalance((user as any).financialSummary?.totalDeposited)}`} color="text-emerald-400" />
              <InfoCard label={at("users.totalWithdrawn")} value={`$${formatBalance((user as any).financialSummary?.totalWithdrawn)}`} color="text-red-400" />
              <InfoCard label={at("users.totalHands")} value={`$${formatBalance((user as any).financialSummary?.totalBets)}`} color="text-blue-400" />
              <InfoCard label={at("users.winRate")} value={`$${formatBalance((user as any).financialSummary?.netProfit)}`} color={parseFloat((user as any).financialSummary?.netProfit ?? "0") >= 0 ? "text-emerald-400" : "text-red-400"} />
              <InfoCard label={at("finance.rake")} value={`$${formatBalance((user as any).financialSummary?.totalRake)}`} color="text-purple-400" />
              <InfoCard label={at("finance.commission")} value={`$${formatBalance((user as any).agentInfo?.totalCommission)}`} color="text-amber-400" />
            </div>
          </div>

          {/* Account Info */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-400" />{at("tab.users")}</h3>
            <div className="space-y-2 text-xs">
              <DetailRow label={at("users.colUser") + " ID"} value={String((user as any).id)} />
              <DetailRow label="Telegram ID" value={(user as any).tgId || "-"} />
              <DetailRow label="TG" value={(user as any).tgUsername ? `@${(user as any).tgUsername}` : "-"} />
              <DetailRow label={at("users.colUser")} value={(user as any).nickname || "-"} />
              <DetailRow label="Email" value={(user as any).email || "-"} />
              <DetailRow label={at("settings.defaultLang")} value={(user as any).language || "-"} />
              <DetailRow label="IP" value={(user as any).lastIp || "-"} />
              <DetailRow label={at("users.lastLogin")} value={(user as any).lastSignedIn ? new Date((user as any).lastSignedIn).toLocaleString() : "-"} />
              <DetailRow label={at("users.registeredAt")} value={(user as any).createdAt ? new Date((user as any).createdAt).toLocaleString() : "-"} />
            </div>
          </div>

          {/* Agent Info */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" />{at("tab.agents")}</h3>
            <div className="space-y-2 text-xs">
              <DetailRow label={at("users.agentLevel")} value={(user as any).agentLevel === "agent" ? at("common.agent") : at("users.regularUser")} />
              <DetailRow label={at("rooms.inviteCode")} value={(user as any).inviteCode || "-"} />
              <DetailRow label={at("common.agent")} value={(user as any).agentInfo?.inviterName || "-"} />
              <DetailRow label={at("agents.totalRel")} value={String((user as any).agentInfo?.downlineCount ?? 0)} />
              <DetailRow label={at("finance.commission")} value={`$${(user as any).agentInfo?.totalCommission ?? "0.00"}`} />
              <DetailRow label={at("users.totalHands")} value={String((user as any).totalGamesPlayed ?? 0)} />
            </div>
          </div>

          {/* Risk Control */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-red-400" />{at("users.riskLevel")}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs">{at("finance.status")}:</span>
              <select
                defaultValue={(user as any).riskLevel ?? "normal"}
                onChange={(e) => updateMutation.mutate({ id: userId, riskLevel: e.target.value as any })}
                className="glass rounded px-3 py-1.5 text-xs bg-transparent outline-none"
              >
                <option value="normal">{at("users.normal")}</option>
                <option value="watch">{at("users.watch")}</option>
                <option value="frozen">{at("users.frozen")}</option>
                <option value="banned">{at("users.banned")}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Deposits Tab */}
      {activeTab === "deposits" && (
        <div className="space-y-2">
          {(txData as any)?.transactions?.length > 0 ? (
            (txData as any).transactions.map((tx: any) => (
              <div key={tx.id} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-emerald-400">+${formatBalance(tx.amount)}</span>
                    {tx.referenceType === "admin_topup" && (
                      <span className="px-1 py-0.5 rounded text-[9px] bg-gold/20 text-gold">{at("users.adminTopUp")}</span>
                    )}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    tx.status === "confirmed" ? "bg-success/20 text-success" :
                    tx.status === "pending" ? "bg-warning/20 text-warning" :
                    "bg-danger/20 text-danger"
                  }`}>{tx.status === "confirmed" ? at("finance.approved") : tx.status === "pending" ? at("agents.pending") : at("finance.rejected")}</span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>{at("finance.chain")}: {tx.chain || "-"} | TX: {tx.txHash ? tx.txHash.substring(0, 16) + "..." : "-"}</div>
                  {tx.operatorName && <div className="text-[9px] text-gold/70">{at("users.adminTopUp")}: {tx.operatorName}</div>}
                  {tx.note && !tx.note.startsWith('[Admin Top-Up') && <div className="text-[9px] italic opacity-70">{tx.note}</div>}
                  <div>{at("finance.time")}: {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{at("users.noTx")}</p>
          )}
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === "withdrawals" && (
        <div className="space-y-2">
          {(txData as any)?.transactions?.length > 0 ? (
            (txData as any).transactions.map((tx: any) => (
              <div key={tx.id} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-red-400">-${formatBalance(tx.amount)}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    tx.status === "confirmed" ? "bg-success/20 text-success" :
                    tx.status === "pending" ? "bg-warning/20 text-warning" :
                    tx.status === "cancelled" ? "bg-danger/20 text-danger" :
                    "bg-secondary text-muted-foreground"
                  }`}>{tx.status === "confirmed" ? at("finance.approved") : tx.status === "pending" ? at("agents.pending") : tx.status === "cancelled" ? at("finance.rejected") : tx.status}</span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>{at("finance.address")}: {tx.walletAddress ? tx.walletAddress.substring(0, 20) + "..." : "-"}</div>
                  <div>{at("finance.chain")}: {tx.chain || "-"} | TX: {tx.txHash ? tx.txHash.substring(0, 16) + "..." : "-"}</div>
                  <div>{at("finance.time")}: {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{at("users.noTx")}</p>
          )}
        </div>
      )}

      {/* Game Flow Tab - buy_in / leave_table / rebuy transactions */}
      {activeTab === "gameflow" && (
        <div className="space-y-2">
          {(() => {
            const flowTxs = ((gameFlowData as any)?.transactions ?? []).filter((t: any) => ["buy_in","leave_table","rebuy"].includes(t.type));
            if (flowTxs.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">暂无游戏流水记录</p>;
            const totalBuyIn = flowTxs.filter((t: any) => t.type === "buy_in" || t.type === "rebuy").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
            const totalReturn = flowTxs.filter((t: any) => t.type === "leave_table").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
            const netPnl = totalReturn - totalBuyIn;
            return (
              <>
                <div className="glass rounded-xl p-3 mb-1">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-[10px] text-muted-foreground">总买入</div><div className="text-xs font-mono text-red-400">-${formatBalance(totalBuyIn.toFixed(2))}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">总返还</div><div className="text-xs font-mono text-emerald-400">+${formatBalance(totalReturn.toFixed(2))}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">净盈亏</div><div className={`text-xs font-mono ${netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{netPnl >= 0 ? "+" : ""}${formatBalance(netPnl.toFixed(2))}</div></div>
                  </div>
                </div>
                {flowTxs.map((tx: any) => (
                  <div key={tx.id} className="glass rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          tx.type === "buy_in" ? "bg-red-500/20 text-red-400" :
                          tx.type === "rebuy" ? "bg-orange-500/20 text-orange-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        }`}>{tx.type === "buy_in" ? "买入" : tx.type === "rebuy" ? "补码" : "离桌返还"}</span>
                        <span className={`text-xs font-mono ${tx.type === "leave_table" ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.type === "leave_table" ? "+" : "-"}${formatBalance(tx.amount)}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>{tx.note || "-"}</span>
                      <span>余额: ${formatBalance(tx.balanceBefore)} → ${formatBalance(tx.balanceAfter)}</span>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* Games Tab */}
      {activeTab === "games" && (
        <div className="space-y-2">
          {(gameData as any)?.games?.length > 0 ? (
            (gameData as any).games.map((g: any) => (
              <div key={g.handId} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{g.roomName}</span>
                  <span className={`text-xs font-mono ${parseFloat(g.pnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {parseFloat(g.pnl) >= 0 ? "+" : ""}${formatBalance(g.pnl)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span>{at("finance.amount")}: ${formatBalance(g.betAmount)} | {at("users.totalWins")}: ${formatBalance(g.winAmount)}</span>
                  <div>{g.completedAt ? new Date(g.completedAt).toLocaleString() : "-"}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{at("users.noGames")}</p>
          )}
        </div>
      )}

      {/* Downlines Tab */}
      {activeTab === "downlines" && (
        <div className="space-y-4">
          {downlinesLoading ? (
            <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-gold" /></div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="glass rounded-xl p-3 text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">直接下线（一级）</div>
                  <div className="text-lg font-bold text-emerald-400">{(downlinesData as any)?.level1?.length ?? 0}</div>
                </div>
                <div className="glass rounded-xl p-3 text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">间接下线（二级）</div>
                  <div className="text-lg font-bold text-blue-400">{(downlinesData as any)?.level2?.length ?? 0}</div>
                </div>
              </div>

              {/* Level 1 downlines */}
              {(downlinesData as any)?.level1?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-400/20 flex items-center justify-center text-[9px]">1</span>
                    直接下线 ({(downlinesData as any).level1.length})
                  </h4>
                  <div className="space-y-1.5">
                    {(downlinesData as any).level1.map((rel: any) => (
                      <div key={rel.downlineId} className="glass rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(to bottom right, rgba(52,211,153,0.3), rgba(52,211,153,0.1))" }}>
                              <span className="text-[10px] font-bold text-emerald-400">
                                {(rel.user?.name || rel.user?.nickname || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium">{rel.user?.name || rel.user?.nickname || "Anonymous"}</div>
                              <div className="text-[10px] text-muted-foreground">
                                #{rel.downlineId}{rel.user?.tgUsername ? ` @${rel.user.tgUsername}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-gold">${formatBalance(rel.user?.balance)}</div>
                            <div className="text-[10px] text-muted-foreground">余额</div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/30 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[10px] text-muted-foreground">贡献佣金</div>
                            <div className="text-xs font-mono text-amber-400">${formatBalance(rel.commissionEarned)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">自己下线</div>
                            <div className="text-xs font-mono text-blue-400">{rel.ownDownlineCount} 人</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">注册时间</div>
                            <div className="text-[10px] text-muted-foreground">
                              {rel.user?.createdAt ? new Date(rel.user.createdAt).toLocaleDateString("zh-CN") : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Level 2 downlines */}
              {(downlinesData as any)?.level2?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-blue-400/20 flex items-center justify-center text-[9px]">2</span>
                    间接下线 ({(downlinesData as any).level2.length})
                  </h4>
                  <div className="space-y-1.5">
                    {(downlinesData as any).level2.map((rel: any) => (
                      <div key={rel.downlineId} className="glass rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(to bottom right, rgba(96,165,250,0.3), rgba(96,165,250,0.1))" }}>
                              <span className="text-[9px] font-bold text-blue-400">
                                {(rel.user?.name || rel.user?.nickname || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-xs font-medium">{rel.user?.name || rel.user?.nickname || "Anonymous"}</div>
                              <div className="text-[10px] text-muted-foreground">
                                #{rel.downlineId}{rel.user?.tgUsername ? ` @${rel.user.tgUsername}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono text-gold">${formatBalance(rel.user?.balance)}</div>
                            <div className="text-[10px] text-muted-foreground">余额</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(downlinesData as any)?.level1?.length === 0 && (downlinesData as any)?.level2?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Users className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">暂无下线</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-lg p-2.5 text-center">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ==================== ROOMS PANEL ====================
const defaultRoomForm = {
  name: "",
  type: "public" as "public" | "private",
  gameType: "texas_holdem" as "texas_holdem" | "omaha",
  smallBlind: "1",
  bigBlind: "2",
  minBuyIn: "40",
  maxBuyIn: "200",
  maxPlayers: 6,
  totalRounds: null as number | null,
  billingMode: "standard_rake" as "standard_rake" | "per_round_fee",
  roundFee: "0",
  rakePercent: "",
  rakeCap: "",
  fairnessLevel: "basic" as "basic" | "medium" | "high",
};

const roomPresets = {
  low: { name: "Low Stakes", smallBlind: "1", bigBlind: "2", minBuyIn: "40", maxBuyIn: "200", maxPlayers: 6, type: "public" as const },
  mid: { name: "Mid Stakes", smallBlind: "5", bigBlind: "10", minBuyIn: "200", maxBuyIn: "1000", maxPlayers: 6, type: "public" as const },
  high: { name: "High Stakes", smallBlind: "25", bigBlind: "50", minBuyIn: "1000", maxBuyIn: "5000", maxPlayers: 6, type: "public" as const },
  vip: { name: "VIP Table", smallBlind: "100", bigBlind: "200", minBuyIn: "5000", maxBuyIn: "20000", maxPlayers: 9, type: "private" as const },
};

function RoomFormModal({ at, open, onClose, editRoom, onSuccess }: {
  at: (k: string) => string;
  open: boolean;
  onClose: () => void;
  editRoom?: any;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...defaultRoomForm });
  const isEdit = !!editRoom;

  useEffect(() => {
    if (editRoom) {
      setForm({
        name: editRoom.name || "",
        type: editRoom.type || "public",
        gameType: editRoom.gameType || "texas_holdem",
        smallBlind: editRoom.smallBlind || "1",
        bigBlind: editRoom.bigBlind || "2",
        minBuyIn: editRoom.minBuyIn || "40",
        maxBuyIn: editRoom.maxBuyIn || "200",
        maxPlayers: editRoom.maxPlayers || 6,
        totalRounds: editRoom.totalRounds || null,
        billingMode: editRoom.billingMode || "standard_rake",
        roundFee: editRoom.roundFee || "0",
        rakePercent: editRoom.rakePercent || "",
        rakeCap: editRoom.rakeCap || "",
        fairnessLevel: editRoom.fairnessLevel || "basic",
      });
    } else {
      setForm({ ...defaultRoomForm });
    }
  }, [editRoom, open]);

  const createMutation = trpc.rooms.adminCreate.useMutation({
    onSuccess: () => { toast.success(at("rooms.created")); onSuccess(); onClose(); },
    onError: (err) => toast.error(err.message),
  });
  const editMutation = trpc.rooms.adminEdit.useMutation({
    onSuccess: () => { toast.success(at("rooms.updated")); onSuccess(); onClose(); },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error(at("rooms.name") + " required"); return; }
    if (isEdit) {
      editMutation.mutate({
        id: editRoom.id,
        name: form.name,
        type: form.type,
        gameType: form.gameType,
        smallBlind: form.smallBlind,
        bigBlind: form.bigBlind,
        minBuyIn: form.minBuyIn,
        maxBuyIn: form.maxBuyIn,
        maxPlayers: form.maxPlayers,
        totalRounds: form.totalRounds,
        billingMode: form.billingMode,
        roundFee: form.roundFee,
        rakePercent: form.rakePercent || null,
        rakeCap: form.rakeCap || null,
        fairnessLevel: form.fairnessLevel,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        type: form.type,
        gameType: form.gameType,
        smallBlind: form.smallBlind,
        bigBlind: form.bigBlind,
        minBuyIn: form.minBuyIn,
        maxBuyIn: form.maxBuyIn,
        maxPlayers: form.maxPlayers,
        totalRounds: form.totalRounds,
        billingMode: form.billingMode,
        roundFee: form.roundFee,
        rakePercent: form.rakePercent || null,
        rakeCap: form.rakeCap || null,
        fairnessLevel: form.fairnessLevel,
      });
    }
  };

  const applyPreset = (preset: keyof typeof roomPresets) => {
    const p = roomPresets[preset];
    setForm(prev => ({ ...prev, ...p }));
  };

  if (!open) return null;

  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";
  const selectCls = "w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{isEdit ? at("rooms.editTitle") : at("rooms.createTitle")}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
        </div>

        {/* Presets (only for create) */}
        {!isEdit && (
          <div className="mb-4">
            <span className="text-xs font-medium text-muted-foreground">{at("rooms.presets")}:</span>
            <div className="flex gap-2 mt-1 flex-wrap">
              <button onClick={() => applyPreset("low")} className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20">{at("rooms.presetLow")}</button>
              <button onClick={() => applyPreset("mid")} className="px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20">{at("rooms.presetMid")}</button>
              <button onClick={() => applyPreset("high")} className="px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20">{at("rooms.presetHigh")}</button>
              <button onClick={() => applyPreset("vip")} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20">{at("rooms.presetVip")}</button>
            </div>
          </div>
        )}

        {/* Form grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Room Name */}
          <div className="md:col-span-2">
            <label className={labelCls}>{at("rooms.name")}</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. VIP Room #1" />
          </div>
          {/* Type */}
          <div>
            <label className={labelCls}>{at("rooms.type")}</label>
            <select className={selectCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              <option value="public">{at("rooms.public")}</option>
              <option value="private">{at("rooms.private")}</option>
            </select>
          </div>
          {/* Game Type */}
          <div>
            <label className={labelCls}>{at("rooms.gameType")}</label>
            <select className={selectCls} value={form.gameType} onChange={e => setForm(f => ({ ...f, gameType: e.target.value as any }))}>
              <option value="texas_holdem">{at("rooms.texasHoldem")}</option>
              <option value="omaha">{at("rooms.omaha")}</option>
            </select>
          </div>
          {/* Small Blind */}
          <div>
            <label className={labelCls}>{at("rooms.smallBlind")}</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.smallBlind} onChange={e => setForm(f => ({ ...f, smallBlind: e.target.value }))} />
          </div>
          {/* Big Blind */}
          <div>
            <label className={labelCls}>{at("rooms.bigBlind")}</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.bigBlind} onChange={e => setForm(f => ({ ...f, bigBlind: e.target.value }))} />
          </div>
          {/* Min Buy-In */}
          <div>
            <label className={labelCls}>{at("rooms.minBuyIn")}</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.minBuyIn} onChange={e => setForm(f => ({ ...f, minBuyIn: e.target.value }))} />
          </div>
          {/* Max Buy-In */}
          <div>
            <label className={labelCls}>{at("rooms.maxBuyIn")}</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.maxBuyIn} onChange={e => setForm(f => ({ ...f, maxBuyIn: e.target.value }))} />
          </div>
          {/* Max Players */}
          <div>
            <label className={labelCls}>{at("rooms.maxPlayers")}</label>
            <select className={selectCls} value={form.maxPlayers} onChange={e => setForm(f => ({ ...f, maxPlayers: Number(e.target.value) }))}>
              {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {/* Total Rounds */}
          <div>
            <label className={labelCls}>{at("rooms.totalRounds")}</label>
            <input className={inputCls} type="number" min="0" value={form.totalRounds ?? ""} onChange={e => setForm(f => ({ ...f, totalRounds: e.target.value ? Number(e.target.value) : null }))} placeholder={at("rooms.unlimited")} />
          </div>
          {/* Billing Mode */}
          <div>
            <label className={labelCls}>{at("rooms.billingMode")}</label>
            <select className={selectCls} value={form.billingMode} onChange={e => setForm(f => ({ ...f, billingMode: e.target.value as any }))}>
              <option value="standard_rake">{at("rooms.standardRake")}</option>
              <option value="per_round_fee">{at("rooms.perRoundFee")}</option>
            </select>
          </div>
          {/* Round Fee (shown when per_round_fee) */}
          {form.billingMode === "per_round_fee" && (
            <div>
              <label className={labelCls}>{at("rooms.roundFee")}</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={form.roundFee} onChange={e => setForm(f => ({ ...f, roundFee: e.target.value }))} />
            </div>
          )}
          {/* Rake Percent */}
          <div>
            <label className={labelCls}>{at("rooms.rakePercent")}</label>
            <input className={inputCls} type="number" min="0" max="100" step="0.1" value={form.rakePercent} onChange={e => setForm(f => ({ ...f, rakePercent: e.target.value }))} placeholder="5.00" />
          </div>
          {/* Rake Cap */}
          <div>
            <label className={labelCls}>{at("rooms.rakeCap")}</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.rakeCap} onChange={e => setForm(f => ({ ...f, rakeCap: e.target.value }))} placeholder="10.00" />
          </div>
          {/* Fairness Level */}
          <div>
            <label className={labelCls}>{at("rooms.fairnessLevel")}</label>
            <select className={selectCls} value={form.fairnessLevel} onChange={e => setForm(f => ({ ...f, fairnessLevel: e.target.value as any }))}>
              <option value="basic">{at("rooms.basic")}</option>
              <option value="medium">{at("rooms.medium")}</option>
              <option value="high">{at("rooms.high")}</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">{at("rooms.cancel")}</button>
          <button onClick={handleSubmit} disabled={createMutation.isPending || editMutation.isPending} className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold hover:bg-gold/90 disabled:opacity-50">
            {(createMutation.isPending || editMutation.isPending) ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : <Save className="w-4 h-4 inline mr-1" />}
            {at("rooms.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomsPanel({ at }: { at: (k: string) => string }) {
  const { data, isLoading, refetch } = trpc.rooms.adminList.useQuery({ page: 1, limit: 200 });
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [filterStake, setFilterStake] = useState<"all" | "beginner" | "intermediate" | "advanced" | "vip">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "waiting" | "playing" | "paused" | "closed">("all");
  const [filterType, setFilterType] = useState<"all" | "public" | "private">("all");

  const updateMutation = trpc.rooms.adminUpdate.useMutation({
    onSuccess: () => { toast.success(at("rooms.updated")); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.rooms.adminDelete.useMutation({
    onSuccess: () => { toast.success(at("rooms.deleted")); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const duplicateMutation = trpc.rooms.duplicate.useMutation({
    onSuccess: () => { toast.success(at("rooms.duplicated")); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const allRooms = (data as any)?.rooms ?? [];

  // Classify stake level by big blind
  const getStakeLevel = (bigBlind: string) => {
    const bb = parseFloat(bigBlind);
    if (bb <= 0.10) return "beginner";
    if (bb <= 1.00) return "intermediate";
    if (bb <= 10.00) return "advanced";
    return "vip";
  };

  const getStakeLabel = (bigBlind: string) => {
    const level = getStakeLevel(bigBlind);
    return at(`rooms.${level}`);
  };

  const stakeColor = (bigBlind: string) => {
    const level = getStakeLevel(bigBlind);
    if (level === "beginner") return "bg-emerald-500/20 text-emerald-400";
    if (level === "intermediate") return "bg-truth-blue/20 text-truth-blue";
    if (level === "advanced") return "bg-gold/20 text-gold";
    return "bg-purple-500/20 text-purple-400";
  };

  // Filter
  const filteredRooms = allRooms.filter((r: any) => {
    const stakeOk = filterStake === "all" || getStakeLevel(r.bigBlind) === filterStake;
    const statusOk = filterStatus === "all" || r.status === filterStatus;
    const typeOk = filterType === "all" || r.type === filterType;
    return stakeOk && statusOk && typeOk;
  });

  // Stats
  const statTotal = allRooms.length;
  const statOpen = allRooms.filter((r: any) => r.status === "waiting").length;
  const statPlaying = allRooms.filter((r: any) => r.status === "playing").length;
  const statClosed = allRooms.filter((r: any) => r.status === "closed" || r.status === "paused").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{at("rooms.title")}</h2>
        <button onClick={() => { setEditRoom(null); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold text-black text-sm font-bold hover:bg-gold/90">
          <Plus className="w-4 h-4" /> {at("rooms.create")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: at("rooms.statTotal"), value: statTotal, color: "text-foreground" },
          { label: at("rooms.statOpen"), value: statOpen, color: "text-warning" },
          { label: at("rooms.statPlaying"), value: statPlaying, color: "text-success" },
          { label: at("rooms.statClosed"), value: statClosed, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 glass rounded-lg p-1">
          {(["all", "beginner", "intermediate", "advanced", "vip"] as const).map((k) => (
            <button key={k} onClick={() => setFilterStake(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStake === k ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"
              }`}>
              {k === "all" ? at("rooms.filterAll") : at(`rooms.filter${k.charAt(0).toUpperCase() + k.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 glass rounded-lg p-1">
          {(["all", "public", "private"] as const).map((k) => (
            <button key={k} onClick={() => setFilterType(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterType === k ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"
              }`}>
              {k === "all" ? at("rooms.filterAll") : k === "public" ? at("rooms.public") : at("rooms.private")}
            </button>
          ))}
        </div>
        <div className="flex gap-1 glass rounded-lg p-1">
          {(["all", "waiting", "playing", "paused", "closed"] as const).map((k) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === k ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"
              }`}>
              {k === "all" ? at("rooms.filterStatusAll") :
               k === "waiting" ? at("rooms.filterStatusOpen") :
               k === "playing" ? at("rooms.filterStatusPlaying") :
               at("rooms.filterStatusClosed")}
            </button>
          ))}
        </div>
      </div>

      {/* Room Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filteredRooms.map((r: any) => (
          <div key={r.id} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">#{r.id}</span>
                <span className="text-sm font-medium">{r.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${stakeColor(r.bigBlind)}`}>
                  {getStakeLabel(r.bigBlind)}
                </span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.status === "playing" ? "bg-success/20 text-success" :
                r.status === "waiting" ? "bg-warning/20 text-warning" :
                r.status === "paused" ? "bg-truth-blue/20 text-truth-blue" :
                "bg-secondary text-muted-foreground"
              }`}>{r.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.type === "public" ? "bg-truth-blue/20 text-truth-blue" : "bg-purple-500/20 text-purple-400"
              }`}>{r.type === "public" ? at("rooms.public") : at("rooms.private")}</span>
              <span className="font-mono">${r.smallBlind}/${r.bigBlind}</span>
              <span>{r.currentPlayers}/{r.maxPlayers} {at("rooms.players")}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span>{at("rooms.billingMode")}: {r.billingMode === "standard_rake" ? at("rooms.standardRake") : at("rooms.perRoundFee")}</span>
              {r.type === "public" && <span>{at("rooms.tableNo")}: <code className="font-mono text-gold">#{r.id}</code></span>}
              {r.type === "private" && r.inviteCode && <span>{at("rooms.inviteCode")}: <code className="font-mono text-gold">{r.inviteCode}</code></span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setEditRoom(r); setShowModal(true); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-truth-blue/10 text-truth-blue text-xs font-medium hover:bg-truth-blue/20">
                <Pencil className="w-3 h-3" /> {at("rooms.edit")}
              </button>
              <button onClick={() => duplicateMutation.mutate({ id: r.id })} disabled={duplicateMutation.isPending} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                <Copy className="w-3 h-3" /> {at("rooms.duplicate")}
              </button>
              {r.status !== "paused" && r.status !== "closed" && (
                <button onClick={() => updateMutation.mutate({ id: r.id, status: "paused" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20">
                  <Pause className="w-3 h-3" /> {at("rooms.pause")}
                </button>
              )}
              {r.status === "paused" && (
                <button onClick={() => updateMutation.mutate({ id: r.id, status: "waiting" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20">
                  <Play className="w-3 h-3" /> {at("rooms.resume")}
                </button>
              )}
              {r.status !== "closed" && (
                <button onClick={() => updateMutation.mutate({ id: r.id, status: "closed" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20">
                  <X className="w-3 h-3" /> {at("rooms.close")}
                </button>
              )}
              <button onClick={() => { if (confirm(at("rooms.deleteConfirm"))) deleteMutation.mutate({ id: r.id }); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20">
                <Trash2 className="w-3 h-3" /> {at("rooms.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {filteredRooms.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{at("rooms.noRooms")}</p>
      )}
      <RoomFormModal at={at} open={showModal} onClose={() => setShowModal(false)} editRoom={editRoom} onSuccess={refetch} />
    </div>
  );
}

// ==================== FINANCE PANEL ====================
function FinancePanel({ at }: { at: (k: string) => string }) {
  const [financeTab, setFinanceTab] = useState<"pending" | "deposits" | "withdrawals" | "all" | "rake">("pending");
  const [approveDialog, setApproveDialog] = useState<{ txId: number; amount: string; address: string; chain: string } | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const utils = trpc.useUtils();
  const { data: txData, isLoading } = trpc.wallet.allTransactions.useQuery({ page: 1, limit: 50, type: financeTab === "deposits" ? "deposit" : financeTab === "withdrawals" ? "withdraw" : undefined });
  const { data: stats } = trpc.admin.stats.useQuery();

  const confirmDepositMutation = trpc.wallet.confirmDeposit.useMutation({
    onSuccess: () => { toast.success(at("finance.depositConfirmed")); utils.wallet.allTransactions.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const confirmWithdrawMutation = trpc.wallet.confirmWithdrawal.useMutation({
    onSuccess: () => { toast.success(at("finance.withdrawConfirmed")); utils.wallet.allTransactions.invalidate(); setApproveDialog(null); setTxHashInput(""); },
    onError: (err) => toast.error(err.message),
  });
  const rejectMutation = trpc.wallet.rejectTransaction.useMutation({
    onSuccess: () => { toast.success(at("finance.rejected2")); utils.wallet.allTransactions.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const allTx = (txData as any)?.transactions ?? [];
  const pendingTx = allTx.filter((tx: any) => tx.status === "pending");
  const displayTx = financeTab === "pending" ? pendingTx : allTx;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("finance.title")}</h2>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.totalVolume2")}</p>
          <p className="text-lg font-bold text-gold">${stats?.totalVolume ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.totalTxCount")}</p>
          <p className="text-lg font-bold text-truth-blue">{stats?.totalTransactions ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.pendingReview")}</p>
          <p className="text-lg font-bold text-warning">{pendingTx.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-lg p-1">
        {(["pending", "deposits", "withdrawals", "all", "rake"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFinanceTab(tab)}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              financeTab === tab ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "pending" ? `${at("finance.tabPending")}(${pendingTx.length})` : tab === "deposits" ? at("finance.tabDeposits") : tab === "withdrawals" ? at("finance.tabWithdrawals") : tab === "rake" ? at("finance.tabRake") : at("finance.tabAll")}
          </button>
        ))}
      </div>

      {/* Rake Tab */}
      {financeTab === "rake" && <RakePanel at={at} />}

      {/* Transaction List */}
      {financeTab !== "rake" && <div className="space-y-2">
        {displayTx.length > 0 ? (
          displayTx.map((tx: any) => (
            <div key={tx.id} className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    tx.type === "deposit" ? "bg-emerald-500/20 text-emerald-400" :
                    tx.type === "withdraw" ? "bg-red-500/20 text-red-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>{tx.type === "deposit" ? at("finance.tabDeposits") : tx.type === "withdraw" ? at("finance.tabWithdrawals") : tx.type}</span>
                  <span className="text-xs text-muted-foreground">{at("finance.userLabel")} #{tx.userId}</span>
                  <span className="text-xs text-muted-foreground">#{tx.id}</span>
                </div>
                <span className="text-sm font-mono font-medium">${formatBalance(tx.amount)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5 mb-2">
                <div>{at("finance.chainLabel")}: {tx.chain || "-"} | {at("finance.statusLabel")}: <span className={tx.status === "pending" ? "text-warning" : tx.status === "confirmed" ? "text-success" : "text-danger"}>{tx.status === "pending" ? at("finance.statusPending") : tx.status === "confirmed" ? at("finance.statusConfirmed") : tx.status === "failed" ? at("finance.statusFailed") : tx.status}</span></div>
                {tx.txHash && <div>TX: {tx.txHash.substring(0, 24)}...</div>}
                {tx.walletAddress && <div>{at("finance.addressLabel")}: {tx.walletAddress.substring(0, 24)}...</div>}
                <div>{at("finance.timeLabel")}: {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</div>
              </div>
              {/* Action buttons for pending */}
              {tx.status === "pending" && (
                <div className="flex gap-2 pt-1 border-t border-border/30">
                  {tx.type === "deposit" && (
                    <button
                      onClick={() => confirmDepositMutation.mutate({ transactionId: tx.id })}
                      disabled={confirmDepositMutation.isPending}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >{at("finance.confirmDeposit")}</button>
                  )}
                  {tx.type === "withdraw" && (
                    <button
                      onClick={() => { setApproveDialog({ txId: tx.id, amount: tx.amount, address: tx.walletAddress || "", chain: tx.chain || "" }); setTxHashInput(""); }}
                      disabled={confirmWithdrawMutation.isPending}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >{at("finance.confirmTransfer")}</button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(at("finance.rejectConfirm"))) {
                        rejectMutation.mutate({ transactionId: tx.id, reason: at("finance.rejectReason") });
                      }
                    }}
                    disabled={rejectMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >{at("finance.reject")}</button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">{financeTab === "pending" ? at("finance.noPendingReview") : at("finance.noTx")}</p>
        )}
      </div>}

      {/* Withdrawal Approve Dialog */}
      {approveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setApproveDialog(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{at("finance.confirmWithdrawTitle")}</h3>
              <button onClick={() => setApproveDialog(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="glass rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{at("finance.withdrawAmount")}</div>
                <div className="text-lg font-bold text-gold">${formatBalance(approveDialog.amount)}</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{at("finance.chainAddr")}</div>
                <div className="text-sm font-mono">{approveDialog.chain} | {approveDialog.address || "-"}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{at("finance.txHashLabel")} <span className="text-muted-foreground/60">{at("finance.txHashHint")}</span></label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gold"
                  placeholder={at("finance.txHashPlaceholder2")}
                  value={txHashInput}
                  onChange={e => setTxHashInput(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveDialog(null)} className="flex-1 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">{at("finance.cancelApprove")}</button>
              <button
                onClick={() => {
                  if (!txHashInput.trim()) { toast.error(at("finance.txHashRequired")); return; }
                  confirmWithdrawMutation.mutate({ transactionId: approveDialog.txId, txHash: txHashInput.trim() });
                }}
                disabled={confirmWithdrawMutation.isPending || !txHashInput.trim()}
                className="flex-1 py-2 rounded-lg bg-gold text-black text-sm font-bold hover:bg-gold/90 disabled:opacity-50"
              >
                {confirmWithdrawMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : null}
                {at("finance.confirmTransferDone")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== RAKE PANEL ====================
function RakePanel({ at }: { at: (k: string) => string }) {
  const [rakePage, setRakePage] = useState(1);
  const { data: rakeData, isLoading } = trpc.admin.rakeRecords.useQuery({ page: rakePage, pageSize: 20 });
  const { data: stats } = trpc.admin.stats.useQuery();
  const { data: trends } = trpc.admin.trends.useQuery({ days: 14 });

  if (isLoading) return <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-gold" /></div>;

  const records = rakeData?.records ?? [];
  const summary = rakeData?.summary ?? { totalRake: "0.00", totalHands: 0, avgRake: "0.00" };
  const dailyRake = (trends as any)?.dailyRake ?? [];

  return (
    <div className="space-y-4">
      {/* Rake Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.rakeTotal")}</p>
          <p className="text-lg font-bold text-gold">${stats?.totalRake ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.rakeToday")}</p>
          <p className="text-lg font-bold text-emerald-400">${stats?.todayRake ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.rakeTotalHands")}</p>
          <p className="text-lg font-bold text-truth-blue">{stats?.totalHands ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{at("finance.rakeTodayHands")}</p>
          <p className="text-lg font-bold text-purple-400">{stats?.todayHands ?? 0}</p>
        </div>
      </div>

      {/* Daily Rake Trend */}
      {dailyRake.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{at("finance.rakeTrend")}</h3>
          <div className="flex items-end gap-1 h-24">
            {dailyRake.map((d: any, i: number) => {
              const maxVal = Math.max(...dailyRake.map((r: any) => parseFloat(r.total || "0")), 1);
              const height = (parseFloat(d.total || "0") / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-muted-foreground">${formatAmount(d.total)}</span>
                  <div className="w-full bg-gold/30 rounded-t" style={{ height: `${Math.max(height, 4)}%` }}>
                    <div className="w-full h-full bg-gold/70 rounded-t" />
                  </div>
                  <span className="text-[7px] text-muted-foreground">{d.date?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rake Records Table */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{at("finance.rakeRecords")}</h3>
          <span className="text-xs text-muted-foreground">{at("finance.rakeAvg")}: ${formatBalance(summary.avgRake)}</span>
        </div>
        <div className="space-y-2">
          {records.length > 0 ? records.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div>
                <span className="text-xs font-medium">#{r.handNumber}</span>
                <span className="text-[10px] text-muted-foreground ml-2">Room #{r.roomId}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gold">${formatBalance(r.rakeAmount)}</span>
                <span className="text-[10px] text-muted-foreground ml-2">/ ${formatBalance(r.potSize)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{r.startedAt ? new Date(r.startedAt).toLocaleString() : "-"}</span>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-4">{at("finance.noRakeRecords")}</p>
          )}
        </div>
        {/* Pagination */}
        {(rakeData?.total ?? 0) > 20 && (
          <div className="flex justify-center gap-2 mt-3">
            <button onClick={() => setRakePage(p => Math.max(1, p - 1))} disabled={rakePage === 1} className="px-3 py-1 rounded bg-secondary text-xs disabled:opacity-50">←</button>
            <span className="text-xs text-muted-foreground self-center">{rakePage} / {Math.ceil((rakeData?.total ?? 0) / 20)}</span>
            <button onClick={() => setRakePage(p => p + 1)} disabled={rakePage >= Math.ceil((rakeData?.total ?? 0) / 20)} className="px-3 py-1 rounded bg-secondary text-xs disabled:opacity-50">→</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== AGENTS PANEL ====================
function AgentsPanel({ at }: { at: (k: string) => string }) {
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const { data: agentData, isLoading, refetch } = trpc.admin.agents.useQuery({ page: 1, limit: 50 });
  const { data: commissionData } = trpc.admin.commissions.useQuery({ page: 1, limit: 20 });
  const { data: agentDetail } = trpc.admin.agentDetail.useQuery(
    { agentId: selectedAgent! },
    { enabled: !!selectedAgent }
  );
  const unlockMutation = trpc.admin.agentUnlock.useMutation({
    onSuccess: () => { toast.success("解锁成功"); refetch(); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const relationships = (agentData as any)?.relationships ?? [];
  const commissions = (commissionData as any)?.records ?? [];

  // Agent Detail View
  if (selectedAgent && agentDetail) {
    const detail = agentDetail as any;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedAgent(null)} className="text-xs text-truth-blue hover:underline">← 返回列表</button>
          <h2 className="text-lg font-bold">代理详情 - {detail.agent?.nickname || detail.agent?.name || `#${detail.agent?.id}`}</h2>
        </div>

        {/* Agent Info Card */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">代理信息</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">#{detail.agent?.id}</span></div>
            <div><span className="text-muted-foreground">昵称:</span> <span>{detail.agent?.nickname || "-"}</span></div>
            <div><span className="text-muted-foreground">TG用户名:</span> <span className="text-truth-blue">@{detail.agent?.tgUsername || "-"}</span></div>
            <div><span className="text-muted-foreground">余额:</span> <span className="text-gold font-mono">${formatBalance(detail.agent?.balance)}</span></div>
          </div>
        </div>

        {/* Commission Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">总佣金</p>
            <p className="text-lg font-bold text-gold">${formatBalance(detail.commissionStats?.totalEarned)}</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">已结算</p>
            <p className="text-lg font-bold text-success">${formatBalance(detail.commissionStats?.settledAmount)}</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">待结算</p>
            <p className="text-lg font-bold text-warning">${formatBalance(detail.commissionStats?.pendingAmount)}</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">佣金记录数</p>
            <p className="text-lg font-bold text-truth-blue">{detail.commissionStats?.totalRecords ?? 0}</p>
          </div>
        </div>

        {/* Downlines */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">下线玩家 ({detail.downlines?.length ?? 0})</h3>
          {detail.downlines?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border/30 text-muted-foreground">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">昵称</th>
                  <th className="text-left py-2">TG用户名</th>
                  <th className="text-left py-2">级别</th>
                  <th className="text-left py-2">解锁进度</th>
                  <th className="text-left py-2">状态</th>
                  <th className="text-left py-2">操作</th>
                </tr></thead>
                <tbody>
                  {detail.downlines.map((d: any) => {
                    const progress = d.unlockProgress ? (typeof d.unlockProgress === "string" ? JSON.parse(d.unlockProgress) : d.unlockProgress) : {};
                    return (
                      <tr key={d.id} className="border-b border-border/20">
                        <td className="py-2 font-mono">#{d.downlineId}</td>
                        <td className="py-2">{d.userInfo?.nickname || d.userInfo?.name || "-"}</td>
                        <td className="py-2 text-truth-blue">@{d.userInfo?.tgUsername || "-"}</td>
                        <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${d.level === 1 ? "bg-gold/20 text-gold" : "bg-truth-blue/20 text-truth-blue"}`}>L{d.level}</span></td>
                        <td className="py-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground w-6">局数</span>
                              <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                                <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.min(100, ((progress.gamesPlayed ?? 0) / 20) * 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-mono w-8 text-right">{progress.gamesPlayed ?? 0}/20</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground w-6">抽水</span>
                              <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                                <div className="h-full bg-truth-blue rounded-full transition-all" style={{ width: `${Math.min(100, (Number(progress.totalRake ?? 0) / 1) * 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-mono w-8 text-right">${Number(progress.totalRake ?? 0).toFixed(1)}/1</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${d.isUnlocked ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                            {d.isUnlocked ? "已解锁" : "待解锁"}
                          </span>
                        </td>
                        <td className="py-2">
                          {!d.isUnlocked ? (
                            <button onClick={() => unlockMutation.mutate({ relationshipId: d.id })} className="px-2 py-0.5 bg-success/20 text-success rounded text-[10px] hover:bg-success/30">
                              解锁
                            </button>
                          ) : (
                            <button onClick={() => unlockMutation.mutate({ relationshipId: d.id, lock: true })} className="px-2 py-0.5 bg-danger/20 text-danger rounded text-[10px] hover:bg-danger/30">
                              锁定
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground">暂无下线</p>}
        </div>

        {/* Recent Commissions */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">最近佣金记录</h3>
          {detail.recentCommissions?.length > 0 ? (
            <div className="space-y-1">
              {detail.recentCommissions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/20 text-xs">
                  <div>
                    <span className="text-muted-foreground">来源玩家 #{c.sourceUserId}</span>
                    <span className="ml-2 text-muted-foreground">L{c.level}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gold">${formatBalance(c.commissionAmount)}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] ${c.status === "settled" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{c.status}</span>
                    <span className="text-[10px] text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">暂无佣金记录</p>}
        </div>
      </div>
    );
  }

  // Main List View
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("agents.title")}</h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("agents.totalRel")}</p>
          <p className="text-xl font-bold text-gold">{(agentData as any)?.total ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("agents.totalComm")}</p>
          <p className="text-xl font-bold text-truth-blue">{(commissionData as any)?.total ?? 0}</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("agents.relationships")}</h3>
        {relationships.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border/30 text-muted-foreground">
                <th className="text-left py-2">代理</th>
                <th className="text-left py-2">TG用户名</th>
                <th className="text-left py-2">下线</th>
                <th className="text-left py-2">下线TG</th>
                <th className="text-left py-2">级别</th>
                <th className="text-left py-2">状态</th>
                <th className="text-left py-2">总佣金</th>
                <th className="text-left py-2">操作</th>
              </tr></thead>
              <tbody>
                {relationships.map((rel: any) => (
                  <tr key={rel.id} className="border-b border-border/20 hover:bg-white/5">
                    <td className="py-2">
                      <span className="font-mono">#{rel.agentId}</span>
                      <span className="ml-1 text-muted-foreground">{rel.agentInfo?.nickname || ""}</span>
                    </td>
                    <td className="py-2 text-truth-blue">@{rel.agentInfo?.tgUsername || "-"}</td>
                    <td className="py-2">
                      <span className="font-mono">#{rel.downlineId}</span>
                      <span className="ml-1 text-muted-foreground">{rel.downlineInfo?.nickname || ""}</span>
                    </td>
                    <td className="py-2 text-truth-blue">@{rel.downlineInfo?.tgUsername || "-"}</td>
                    <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rel.level === 1 ? "bg-gold/20 text-gold" : "bg-truth-blue/20 text-truth-blue"}`}>L{rel.level}</span></td>
                    <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rel.isUnlocked ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{rel.isUnlocked ? "已解锁" : "待解锁"}</span></td>
                    <td className="py-2 font-mono text-gold">${formatBalance(rel.totalCommissionEarned)}</td>
                    <td className="py-2">
                      <button onClick={() => setSelectedAgent(rel.agentId)} className="px-2 py-0.5 bg-truth-blue/20 text-truth-blue rounded text-[10px] hover:bg-truth-blue/30">详情</button>
                      {!rel.isUnlocked && (
                        <button onClick={() => unlockMutation.mutate({ relationshipId: rel.id })} className="ml-1 px-2 py-0.5 bg-success/20 text-success rounded text-[10px] hover:bg-success/30">解锁</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{at("agents.noRel")}</p>
        )}
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("agents.recentComm")}</h3>
        {commissions.length > 0 ? (
          <div className="space-y-2">
            {commissions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium">{at("common.agent")} #{c.agentId}</span>
                  <span className="text-xs text-muted-foreground ml-2">← #{c.sourceUserId}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-gold">${formatBalance(c.amount)}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">L{c.level}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{at("agents.noComm")}</p>
        )}
      </div>
    </div>
  );
}

// ==================== RISK PANEL ====================
function RiskPanel({ at }: { at: (k: string) => string }) {
  const [riskTab, setRiskTab] = useState<"rules" | "alerts" | "analyze">("rules");
  const [analyzeUserId, setAnalyzeUserId] = useState("");
  const [earningsUserId, setEarningsUserId] = useState<number | null>(null);

  const { data: rulesData, isLoading: rulesLoading, refetch: refetchRules } = trpc.admin.riskRules.useQuery();
  const { data: alertsData, refetch: refetchAlerts } = trpc.admin.riskAlerts.useQuery({ page: 1, limit: 30 });
  const { data: earningsData } = trpc.admin.userEarningsFlow.useQuery(
    { userId: earningsUserId! },
    { enabled: !!earningsUserId }
  );

  const updateRuleMutation = trpc.admin.riskRuleUpdate.useMutation({
    onSuccess: () => { toast.success("规则已更新"); refetchRules(); },
  });
  const analyzeMutation = trpc.admin.riskAnalyzeUser.useMutation({
    onSuccess: (data: any) => {
      if (data?.riskScore !== undefined) {
        toast.success(`AI分析完成 - 风险分: ${data.riskScore}/100`);
        refetchAlerts();
      } else {
        toast.info("分析完成");
      }
    },
    onError: () => toast.error("分析失败"),
  });
  const updateAlertMutation = trpc.admin.riskAlertUpdate.useMutation({
    onSuccess: () => { toast.success("已更新"); refetchAlerts(); },
  });
  const runChecksMutation = trpc.admin.riskRunChecks.useMutation({
    onSuccess: () => { toast.success("风控检查完成"); refetchAlerts(); },
  });

  if (rulesLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const rules = (rulesData as any) ?? [];
  const alerts = (alertsData as any)?.alerts ?? [];
  const pendingAlerts = alerts.filter((a: any) => a.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">风控管理</h2>
        <div className="flex gap-1">
          {(["rules", "alerts", "analyze"] as const).map(tab => (
            <button key={tab} onClick={() => setRiskTab(tab)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${riskTab === tab ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {tab === "rules" ? "规则配置" : tab === "alerts" ? `告警(${pendingAlerts.length})` : "AI分析"}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-danger mb-2" />
          <p className="text-xs font-semibold">待处理告警</p>
          <p className="text-xl font-bold text-danger mt-1">{pendingAlerts.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-success mb-2" />
          <p className="text-xs font-semibold">启用规则</p>
          <p className="text-xl font-bold text-success mt-1">{rules.filter((r: any) => r.enabled).length}/{rules.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-warning mb-2" />
          <p className="text-xs font-semibold">总告警数</p>
          <p className="text-xl font-bold text-warning mt-1">{alerts.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-truth-blue mb-2" />
          <p className="text-xs font-semibold">反欺诈引擎</p>
          <p className="text-[10px] text-success mt-1">运行中</p>
        </div>
      </div>

      {/* Rules Tab */}
      {riskTab === "rules" && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">风控规则配置 (点击开关启用/禁用)</h3>
          <div className="space-y-2">
            {rules.map((rule: any) => (
              <div key={rule.id} className="flex items-center justify-between py-2.5 px-3 border border-border/30 rounded-lg hover:bg-white/5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{rule.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      rule.severity === "critical" ? "bg-danger/20 text-danger" :
                      rule.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                      rule.severity === "medium" ? "bg-warning/20 text-warning" :
                      "bg-muted/20 text-muted-foreground"
                    }`}>{rule.severity}</span>
                    <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-muted/10 rounded">{rule.action}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{rule.description}</p>
                </div>
                <button
                  onClick={() => updateRuleMutation.mutate({ ruleId: rule.id, enabled: !rule.enabled })}
                  className="w-10 h-5 rounded-full transition-colors relative"
                  style={{ background: rule.enabled ? '#22c55e' : 'rgba(100,100,100,0.3)' }}
                >
                  <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: '#ffffff', left: rule.enabled ? '20px' : '2px' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {riskTab === "alerts" && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">风控告警列表</h3>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="border border-border/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        alert.severity === "critical" ? "bg-danger/20 text-danger" :
                        alert.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                        "bg-warning/20 text-warning"
                      }`}>{alert.severity}</span>
                      <span className="text-xs font-medium">{alert.ruleType}</span>
                      <span className="text-xs text-muted-foreground">用户 #{alert.userId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        alert.status === "pending" ? "bg-warning/20 text-warning" :
                        alert.status === "resolved" ? "bg-success/20 text-success" :
                        "bg-muted/20 text-muted-foreground"
                      }`}>{alert.status}</span>
                      {alert.status === "pending" && (
                        <>
                          <button onClick={() => updateAlertMutation.mutate({ alertId: alert.id, status: "resolved" })} className="px-1.5 py-0.5 bg-success/20 text-success rounded text-[9px] hover:bg-success/30">处理</button>
                          <button onClick={() => updateAlertMutation.mutate({ alertId: alert.id, status: "ignored" })} className="px-1.5 py-0.5 bg-muted/20 text-muted-foreground rounded text-[9px] hover:bg-muted/30">忽略</button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{alert.description}</p>
                  {alert.aiAnalysis && (
                    <div className="mt-2 p-2 bg-truth-blue/5 rounded text-[10px]">
                      <span className="text-truth-blue font-medium">AI分析:</span>
                      <span className="ml-1">{typeof alert.aiAnalysis === "string" ? alert.aiAnalysis : JSON.stringify(alert.aiAnalysis)}</span>
                    </div>
                  )}
                  <span className="text-[9px] text-muted-foreground">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无风控告警</p>
          )}
        </div>
      )}

      {/* AI Analyze Tab */}
      {riskTab === "analyze" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">用户风控分析</h3>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="输入用户ID"
                value={analyzeUserId}
                onChange={e => setAnalyzeUserId(e.target.value)}
                className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue flex-1"
              />
              <button
                onClick={() => {
                  const uid = parseInt(analyzeUserId);
                  if (uid) {
                    analyzeMutation.mutate({ userId: uid });
                    setEarningsUserId(uid);
                  }
                }}
                disabled={analyzeMutation.isPending}
                className="px-4 py-2 bg-truth-blue/20 text-truth-blue rounded-lg text-xs font-medium hover:bg-truth-blue/30 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? "AI分析中..." : "AI分析"}
              </button>
              <button
                onClick={() => {
                  const uid = parseInt(analyzeUserId);
                  if (uid) { runChecksMutation.mutate({ userId: uid }); }
                }}
                disabled={runChecksMutation.isPending}
                className="px-4 py-2 bg-warning/20 text-warning rounded-lg text-xs font-medium hover:bg-warning/30 disabled:opacity-50"
              >
                {runChecksMutation.isPending ? "检查中..." : "运行风控检查"}
              </button>
              <button
                onClick={() => {
                  const uid = parseInt(analyzeUserId);
                  if (uid) setEarningsUserId(uid);
                }}
                className="px-4 py-2 bg-gold/20 text-gold rounded-lg text-xs font-medium hover:bg-gold/30"
              >
                查看收益图
              </button>
            </div>

            {/* AI Analysis Result */}
            {analyzeMutation.data && (
              <div className="mt-4 p-4 border border-truth-blue/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">AI风控分析结果</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    (analyzeMutation.data as any)?.riskScore > 70 ? "bg-danger/20 text-danger" :
                    (analyzeMutation.data as any)?.riskScore > 40 ? "bg-warning/20 text-warning" :
                    "bg-success/20 text-success"
                  }`}>风险分: {(analyzeMutation.data as any)?.riskScore ?? "-"}/100</span>
                </div>
                {/* Risk Labels */}
                {(analyzeMutation.data as any)?.riskLabels?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {((analyzeMutation.data as any).riskLabels as string[]).map((label: string, i: number) => (
                      <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        label.includes("正常") ? "bg-success/20 text-success" :
                        label.includes("羊毛") || label.includes("欺诈") || label.includes("洗钱") ? "bg-danger/20 text-danger" :
                        label.includes("可疑") || label.includes("机器人") ? "bg-warning/20 text-warning" :
                        "bg-truth-blue/20 text-truth-blue"
                      }`}>{label}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{(analyzeMutation.data as any)?.analysis || "无分析结果"}</p>
                {(analyzeMutation.data as any)?.recommendations && (
                  <div className="mt-2">
                    <span className="text-[10px] font-medium text-warning">建议措施:</span>
                    <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                      {((analyzeMutation.data as any).recommendations as string[]).map((r: string, i: number) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Earnings Flow Chart */}
          {earningsUserId && earningsData && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">用户收益线索图 - #{earningsUserId}</h3>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                <div className="p-2 bg-success/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">充值</p>
                  <p className="text-xs font-bold text-success">${Number((earningsData as any)?.summary?.totalDeposit ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-2 bg-danger/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">提现</p>
                  <p className="text-xs font-bold text-danger">${Number((earningsData as any)?.summary?.totalWithdraw ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-2 bg-gold/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">游戏赢</p>
                  <p className="text-xs font-bold text-gold">${Number((earningsData as any)?.summary?.totalGameWin ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-2 bg-orange-500/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">游戏输</p>
                  <p className="text-xs font-bold text-orange-400">${Number((earningsData as any)?.summary?.totalGameLoss ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-2 bg-truth-blue/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">佣金</p>
                  <p className="text-xs font-bold text-truth-blue">${Number((earningsData as any)?.summary?.totalCommission ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-lg text-center">
                  <p className="text-[9px] text-muted-foreground">净利润</p>
                  <p className={`text-xs font-bold ${Number((earningsData as any)?.summary?.netProfit ?? 0) >= 0 ? "text-success" : "text-danger"}`}>${Number((earningsData as any)?.summary?.netProfit ?? 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-border/30 pt-3">
                <h4 className="text-xs font-medium mb-2">收益时间线 (最近30天)</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {((earningsData as any)?.timeline ?? []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16">{item.date}</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          item.type === "deposit" ? "bg-success/20 text-success" :
                          item.type === "withdraw" ? "bg-danger/20 text-danger" :
                          item.type === "game_win" ? "bg-gold/20 text-gold" :
                          item.type === "game_loss" ? "bg-orange-500/20 text-orange-400" :
                          item.type === "commission" ? "bg-truth-blue/20 text-truth-blue" :
                          "bg-muted/20 text-muted-foreground"
                        }`}>{item.type}</span>
                      </div>
                      <span className={`font-mono ${item.amount >= 0 ? "text-success" : "text-danger"}`}>
                        {item.amount >= 0 ? "+" : ""}${Number(item.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Users */}
              {((earningsData as any)?.relatedUsers ?? []).length > 0 && (
                <div className="border-t border-border/30 pt-3 mt-3">
                  <h4 className="text-xs font-medium mb-2">关联用户</h4>
                  <div className="flex flex-wrap gap-2">
                    {((earningsData as any)?.relatedUsers ?? []).map((u: any) => (
                      <div key={u.id} className="px-2 py-1 bg-muted/10 rounded text-[10px]">
                        <span className="font-mono">#{u.id}</span>
                        <span className="ml-1">{u.name || u.tgUsername || "-"}</span>
                        <span className="ml-1 text-muted-foreground">({u.relationship})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== FAQ PANEL ====================
function FaqPanel({ at }: { at: (k: string) => string }) {
  const { data: faqs, isLoading, refetch } = trpc.admin.faqList.useQuery();
  const upsertMutation = trpc.admin.faqUpsert.useMutation({
    onSuccess: () => { toast.success(at("faq.saved")); refetch(); },
  });
  const deleteMutation = trpc.admin.faqDelete.useMutation({
    onSuccess: () => { toast.success(at("faq.deleted")); refetch(); },
  });

  const [newFaq, setNewFaq] = useState({ category: "general", question: "", answer: "", language: "en" });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("faq.title")}</h2>
      
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-truth-blue mb-3">{at("faq.addEntry")}</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <select value={newFaq.category} onChange={e => setNewFaq(p => ({ ...p, category: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none flex-1">
              <option value="general">{at("faq.catGeneral")}</option>
              <option value="deposit">{at("faq.catDeposit")}</option>
              <option value="withdraw">{at("faq.catWithdraw")}</option>
              <option value="game">{at("faq.catGame")}</option>
              <option value="agent">{at("faq.catAgent")}</option>
              <option value="security">{at("faq.catSecurity")}</option>
            </select>
            <select value={newFaq.language} onChange={e => setNewFaq(p => ({ ...p, language: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none flex-1">
              <option value="en">English</option>
              <option value="zh-CN">中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <input placeholder={at("faq.question")} value={newFaq.question} onChange={e => setNewFaq(p => ({ ...p, question: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <textarea placeholder={at("faq.answer")} value={newFaq.answer} onChange={e => setNewFaq(p => ({ ...p, answer: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue h-20 resize-none" />
          <button
            onClick={() => {
              if (!newFaq.question || !newFaq.answer) return toast.error(at("faq.qaRequired"));
              upsertMutation.mutate(newFaq);
              setNewFaq({ category: "general", question: "", answer: "", language: "en" });
            }}
            className="px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> {at("faq.addEntry")}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("faq.existing")} ({(faqs as any[])?.length ?? 0})</h3>
        <div className="space-y-2">
          {(faqs as any[])?.map((faq: any) => (
            <div key={faq.id} className="flex items-start justify-between py-2 border-b border-border/30">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{faq.category}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/20 text-truth-blue">{faq.language}</span>
                </div>
                <p className="text-xs font-medium">{faq.question}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{faq.answer}</p>
              </div>
              <button onClick={() => deleteMutation.mutate({ id: faq.id })} className="p-1 text-danger/60 hover:text-danger ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {((faqs as any[])?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">{at("faq.noEntries")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== SYSTEM SETTINGS PANEL ====================
function SystemSettingsPanel({ at }: { at: (k: string) => string }) {
  const { data: configs, refetch } = trpc.config.getAll.useQuery();
  const upsertMutation = trpc.config.upsert.useMutation({
    onSuccess: () => { toast.success(at("settings.saved")); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgBotUsername, setTgBotUsername] = useState("");
  const [tgClientId, setTgClientId] = useState("");
  const [tgClientSecret, setTgClientSecret] = useState("");
  const [csTgUsername, setCsTgUsername] = useState("");
  const [tgMiniAppUrl, setTgMiniAppUrl] = useState("");
  const [adminTgChatId, setAdminTgChatId] = useState("");
  // DeepSeek AI 配置（全局AI服务）
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekApiUrl, setDeepseekApiUrl] = useState("https://api.deepseek.com");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [deepseekMaxTokens, setDeepseekMaxTokens] = useState("4096");
  const [deepseekTemperature, setDeepseekTemperature] = useState("0.7");
  // AI客服专属配置
  const [aiCsSystemPrompt, setAiCsSystemPrompt] = useState("");
  const [aiCsTemperature, setAiCsTemperature] = useState("0.7");
  // Share card config
  const [shareDefaultText, setShareDefaultText] = useState("");
  const [shareBannerUrl, setShareBannerUrl] = useState("");
  const [shareUploading, setShareUploading] = useState(false);

  useEffect(() => {
    if (configs) {
      const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c.value]) ?? []);
      setMaintenanceMode(configMap.get("maintenance_mode") === "true");
      setDefaultLanguage(configMap.get("default_language") ?? "en");
      setTgBotToken(configMap.get("tg_bot_token") ?? "");
      setTgBotUsername(configMap.get("tg_bot_username") ?? "");
      setTgClientId(configMap.get("tg_client_id") ?? "");
      setTgClientSecret(configMap.get("tg_client_secret") ?? "");
      setCsTgUsername(configMap.get("cs_tg_username") ?? "");
      setTgMiniAppUrl(configMap.get("tg_mini_app_url") ?? "");
      setAdminTgChatId(configMap.get("admin_tg_chat_id") ?? "");
      // DeepSeek AI 全局配置
      setDeepseekApiKey(configMap.get("deepseek_api_key") ?? "");
      setDeepseekApiUrl(configMap.get("deepseek_api_url") ?? "https://api.deepseek.com");
      setDeepseekModel(configMap.get("deepseek_model") ?? "deepseek-chat");
      setDeepseekMaxTokens(configMap.get("deepseek_max_tokens") ?? "4096");
      setDeepseekTemperature(configMap.get("deepseek_temperature") ?? "0.7");
      // AI客服专属配置
      setAiCsSystemPrompt(configMap.get("ai_cs_system_prompt") ?? "");
      setAiCsTemperature(configMap.get("ai_cs_temperature") ?? "0.7");
      // Share card config
      setShareDefaultText(configMap.get("share_default_text") ?? "");
      setShareBannerUrl(configMap.get("share_banner_url") ?? "");
    }
  }, [configs]);

  const saveSystemSetting = (key: string, value: string) => {
    // public keys: accessible by frontend without auth
    const publicKeys = ["tg_bot_username", "cs_tg_username", "share_default_text", "share_banner_url"];
    const isPublic = publicKeys.includes(key);
    upsertMutation.mutate({ key, value, category: "system", label: key, valueType: "string", isPublic });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("settings.title")}</h2>
      
      {/* Maintenance Mode */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("settings.maintenance")}</h3>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{at("settings.maintenanceDesc")}</p>
          <button
            onClick={() => {
              const newVal = !maintenanceMode;
              setMaintenanceMode(newVal);
              saveSystemSetting("maintenance_mode", newVal.toString());
            }}
            className={`w-12 h-6 rounded-full transition-colors relative ${maintenanceMode ? "bg-danger" : "bg-secondary"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${maintenanceMode ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Default Language */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("settings.defaultLang")}</h3>
        <select
          value={defaultLanguage}
          onChange={(e) => {
            setDefaultLanguage(e.target.value);
            saveSystemSetting("default_language", e.target.value);
          }}
          className="w-full glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none"
        >
          <option value="en">English</option>
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁體中文</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="ru">Русский</option>
          <option value="ar">العربية</option>
          <option value="vi">Tiếng Việt</option>
          <option value="th">ไทย</option>
          <option value="id">Bahasa Indonesia</option>
        </select>
      </div>

      {/* Telegram Bot Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("settings.tgBot")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("settings.botUsername")}</label>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{at("tg.botUsernameHint")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tgBotUsername}
                onChange={(e) => setTgBotUsername(e.target.value)}
                placeholder="VeraPokerBot"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_bot_username", tgBotUsername)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("settings.botToken")}</label>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{at("tg.botTokenHint")}</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tgBotToken}
                onChange={(e) => setTgBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNO"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_bot_token", tgBotToken)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
                        {tgBotToken && tgBotToken.includes(":") && (
              <p className="text-[10px] text-gold/70 mt-1">Bot ID: {tgBotToken.split(":")[0]}</p>
            )}
          </div>
          {/* Admin TG Chat ID */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("settings.adminTgChatId")}</label>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{at("settings.adminTgChatIdDesc")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={adminTgChatId}
                onChange={(e) => setAdminTgChatId(e.target.value)}
                placeholder="123456789"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("admin_tg_chat_id", adminTgChatId)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
            {adminTgChatId ? (
              <p className="text-[10px] text-emerald-400 mt-1">{at("settings.adminTgChatIdSet")}</p>
            ) : (
              <p className="text-[10px] text-amber-400 mt-1">{at("settings.adminTgChatIdUnset")}</p>
            )}
          </div>
        </div>
      </div>
      {/* Telegram OIDC Login Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("tg.oidcTitle")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.clientId")}</label>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{at("tg.clientIdHint")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tgClientId}
                onChange={(e) => setTgClientId(e.target.value)}
                placeholder="8820502908"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_client_id", tgClientId)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.clientSecret")}</label>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{at("tg.clientSecretHint")}</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tgClientSecret}
                onChange={(e) => setTgClientSecret(e.target.value)}
                placeholder="opYaGUKBo_jW_feZ..."
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_client_secret", tgClientSecret)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.redirectUri")}</label>
            <CopyableUrl value={`${window.location.origin}/api/telegram/oidc-callback`} />
            <p className="text-[10px] text-muted-foreground mt-1">{at("tg.redirectUriHint")}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.trustedOrigin")}</label>
            <CopyableUrl value={window.location.origin} />
            <p className="text-[10px] text-muted-foreground mt-1">{at("tg.trustedOriginHint")}</p>
          </div>
        </div>
      </div>

      {/* Mini App & Webhook */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("tg.miniAppTitle")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.miniAppUrl")}</label>
            <CopyableUrl value={window.location.origin} />
            <p className="text-[10px] text-muted-foreground mt-1">{at("tg.miniAppUrlHint")}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bot 跳转 URL（tg_mini_app_url）</label>
            <p className="text-[10px] text-muted-foreground mb-1">Bot /start 按钮跳转地址，通常与上方 Mini App URL 相同</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tgMiniAppUrl}
                onChange={(e) => setTgMiniAppUrl(e.target.value)}
                placeholder={window.location.origin}
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_mini_app_url", tgMiniAppUrl || window.location.origin)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.webhookUrl")}</label>
            <CopyableUrl value={`${window.location.origin}/api/telegram/webhook`} />
            <p className="text-[10px] text-muted-foreground mt-1">{at("tg.webhookUrlHint")}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("tg.setWebhookCmd")}</label>
            <CopyableUrl value={`https://api.telegram.org/bot[TOKEN]/setWebhook?url=${window.location.origin}/api/telegram/webhook`} small />
          </div>
        </div>
      </div>

      {/* Human Customer Service TG */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("settings.csTg")}</h3>
        <p className="text-xs text-muted-foreground mb-3">{at("settings.csTgDesc")}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={csTgUsername}
            onChange={(e) => setCsTgUsername(e.target.value)}
            placeholder="VeraPokerCS"
            className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
          />
          <button onClick={() => saveSystemSetting("cs_tg_username", csTgUsername)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
        {csTgUsername && (
          <p className="text-[10px] text-muted-foreground mt-2">t.me/{csTgUsername.replace(/^@/, "")}</p>
        )}
      </div>

      {/* AI Customer Service API Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-gold" />
          DeepSeek AI 配置
        </h3>
        <p className="text-xs text-muted-foreground mb-3">全局AI服务配置，用于AI客服、风控分析等所有AI功能</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
            <div className="flex gap-2">
              <input type="password" value={deepseekApiKey} onChange={(e) => setDeepseekApiKey(e.target.value)} placeholder="sk-..." className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold" />
              <button onClick={() => saveSystemSetting("deepseek_api_key", deepseekApiKey)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">从DeepSeek平台获取: platform.deepseek.com</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API URL</label>
            <div className="flex gap-2">
              <input type="text" value={deepseekApiUrl} onChange={(e) => setDeepseekApiUrl(e.target.value)} placeholder="https://api.deepseek.com" className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold" />
              <button onClick={() => saveSystemSetting("deepseek_api_url", deepseekApiUrl)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">兼容OpenAI格式的API地址，支持代理地址</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">模型</label>
            <div className="flex gap-2">
              <select value={deepseekModel} onChange={(e) => setDeepseekModel(e.target.value)} className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold bg-transparent">
                <option value="deepseek-chat">deepseek-chat (通用对话)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (深度推理)</option>
              </select>
              <button onClick={() => saveSystemSetting("deepseek_model", deepseekModel)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">推荐deepseek-chat，性价比最高</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">最大Token数</label>
            <div className="flex gap-2">
              <input type="number" min="256" max="32768" value={deepseekMaxTokens} onChange={(e) => setDeepseekMaxTokens(e.target.value)} className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold" />
              <button onClick={() => saveSystemSetting("deepseek_max_tokens", deepseekMaxTokens)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Temperature</label>
            <div className="flex gap-2 items-center">
              <input type="range" min="0" max="2" step="0.1" value={deepseekTemperature} onChange={(e) => setDeepseekTemperature(e.target.value)} className="flex-1" />
              <span className="text-xs text-gold w-8 text-center">{deepseekTemperature}</span>
              <button onClick={() => saveSystemSetting("deepseek_temperature", deepseekTemperature)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3 mt-3">
            <h4 className="text-xs font-semibold text-foreground mb-2">AI客服专属配置</h4>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Temperature (客服)</label>
              <div className="flex gap-2 items-center">
                <input type="range" min="0" max="2" step="0.1" value={aiCsTemperature} onChange={(e) => setAiCsTemperature(e.target.value)} className="flex-1" />
                <span className="text-xs text-gold w-8 text-center">{aiCsTemperature}</span>
                <button onClick={() => saveSystemSetting("ai_cs_temperature", aiCsTemperature)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Save className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1 block">自定义客服System Prompt</label>
              <textarea value={aiCsSystemPrompt} onChange={(e) => setAiCsSystemPrompt(e.target.value)} placeholder="自定义AI客服的系统提示词，留空则使用默认" rows={4} className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold resize-y" />
              <div className="flex justify-end mt-2">
                <button onClick={() => saveSystemSetting("ai_cs_system_prompt", aiCsSystemPrompt)} className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 text-xs flex items-center gap-1"><Save className="w-3 h-3" /> 保存</button>
              </div>
            </div>
          </div>
          {!deepseekApiKey && (
            <p className="text-[10px] text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">⚠️ 未配置API Key，AI功能将不可用。请在上方填入DeepSeek API Key。</p>
          )}
        </div>
      </div>

      {/* Registration Bonus Config */}
      <RegistrationBonusConfig at={at} configs={configs} saveSystemSetting={saveSystemSetting} />

      {/* Share Card Config */}
      <div className="glass rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">分享卡片配置</h3>
        <p className="text-xs text-muted-foreground">配置玩家邀请好友时分享卡片的 Banner 图和默认文案，玩家可在分享前自行编辑文案。</p>

        {/* Banner Image */}
        <div>
          <label className="text-xs text-muted-foreground">分享 Banner 图 <span className="text-muted-foreground/60">(建议 16:9，如 1280×720px)</span></label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { toast.error(at("toast.bannerSizeExceeded")); return; }
                setShareUploading(true);
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    const base64 = (reader.result as string).split(",")[1];
                    const resp = await fetch("/api/upload/banner", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ fileName: file.name, fileData: base64, contentType: file.type }),
                    });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const result = await resp.json();
                    setShareBannerUrl(result.url);
                    saveSystemSetting("share_banner_url", result.url);
                    toast.success("Banner 已上传并保存！");
                  } catch (err) {
                    toast.error(at("toast.bannerUploadFailed") + ": " + (err instanceof Error ? err.message : ""));
                  } finally {
                    setShareUploading(false);
                  }
                };
                reader.onerror = () => { setShareUploading(false); toast.error(at("toast.bannerReadFileFailed")); };
                reader.readAsDataURL(file);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-gold/20 file:text-gold"
            />
            {shareUploading && <span className="text-xs text-gold animate-pulse">上传中...</span>}
          </div>
          <input
            type="text"
            value={shareBannerUrl}
            onChange={(e) => setShareBannerUrl(e.target.value)}
            onBlur={() => { if (shareBannerUrl) saveSystemSetting("share_banner_url", shareBannerUrl); }}
            placeholder="或直接输入图片 URL（如 CDN 地址）"
            className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          {shareBannerUrl && (
            <img src={shareBannerUrl} alt="Banner 预览" className="mt-2 h-24 rounded-lg object-cover w-full" onError={(e) => (e.currentTarget.style.display='none')} />
          )}
        </div>

        {/* Default Share Text */}
        <div>
          <label className="text-xs text-muted-foreground">默认分享文案</label>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">
            留空则自动跟随用户语言显示对应翻译；填写内容则全局覆盖。玩家可在分享前自行编辑。
          </p>
          <textarea
            value={shareDefaultText}
            onChange={(e) => setShareDefaultText(e.target.value)}
            rows={3}
            placeholder="留空 = 自动跟随用户语言（推荐）"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
          />
          <button
            onClick={() => saveSystemSetting("share_default_text", shareDefaultText)}
            className="mt-2 px-4 py-1.5 rounded-lg bg-gold/20 text-gold text-xs font-medium hover:bg-gold/30 transition-colors"
          >
            保存文案
          </button>
        </div>
      </div>

      {/* Supported Languages */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("settings.supportedLangs")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { code: "en", name: "English" },
            { code: "zh-CN", name: "简体中文" },
            { code: "zh-TW", name: "繁體中文" },
            { code: "ja", name: "日本語" },
            { code: "ko", name: "한국어" },
            { code: "es", name: "Español" },
            { code: "pt", name: "Português" },
            { code: "ru", name: "Русский" },
            { code: "ar", name: "العربية" },
            { code: "vi", name: "Tiếng Việt" },
            { code: "th", name: "ไทย" },
            { code: "id", name: "Indonesia" },
          ].map(lang => (
            <div key={lang.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/30">
              <span className="text-xs">{lang.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== STAFF PANEL ====================
function StaffPanel({ at }: { at: (k: string) => string }) {
  const { data: staffList, isLoading, refetch } = trpc.admin.staffList.useQuery();
  const { data: unmigratedData } = trpc.admin.unmigratedStaffCount.useQuery();
  const migrateMutation = trpc.admin.migrateStaffUsers.useMutation({
    onSuccess: (data) => { toast.success(data.message); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const createMutation = trpc.admin.staffCreate.useMutation({
    onSuccess: () => { toast.success(at("staff.created")); refetch(); setNewUsername(""); setNewPassword(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.admin.staffDelete.useMutation({
    onSuccess: () => { toast.success(at("staff.deleted")); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const resetPwdMutation = trpc.admin.staffResetPassword.useMutation({
    onSuccess: () => { toast.success(at("staff.pwdReset")); setResetId(null); setResetPwd(""); },
    onError: (e) => toast.error(e.message),
  });

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"cs" | "finance" | "tech">("cs");
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState("");

  const roleLabels: Record<string, string> = {
    cs: at("staff.roleCsLabel"),
    finance: at("staff.roleFinanceLabel"),
    tech: at("staff.roleTechLabel"),
    admin: "Admin",
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6">
            <h2 className="text-lg font-bold">{at("staff.title")}</h2>
      {/* Migration Banner */}
      {unmigratedData && unmigratedData.count > 0 && (
        <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-400">Staff Migration Available</p>
              <p className="text-xs text-muted-foreground mt-1">{unmigratedData.count} user(s) with staff roles can be migrated to admin_users table</p>
            </div>
            <button
              className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-sm font-medium text-yellow-300 hover:bg-yellow-500/30 transition-colors"
              onClick={() => migrateMutation.mutate()}
              disabled={migrateMutation.isPending}
            >
              {migrateMutation.isPending ? "Migrating..." : "Migrate Now"}
            </button>
          </div>
        </div>
      )}
      {/* Create Staff Form */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gold mb-3">{at("staff.create")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("staff.username")}</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="staff_username"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("staff.password")}</label>
            <input
              type="password"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("staff.role")}</label>
            <select
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="cs">{at("staff.roleCsLabel")}</option>
              <option value="finance">{at("staff.roleFinanceLabel")}</option>
              <option value="tech">{at("staff.roleTechLabel")}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => createMutation.mutate({ username: newUsername, password: newPassword, name: newUsername, role: newRole })}
              disabled={!newUsername || !newPassword || createMutation.isPending}
              className="w-full px-4 py-2 bg-gold text-background rounded-lg text-sm font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : at("staff.createBtn")}
            </button>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gold mb-3">{at("staff.list")}</h3>
        {(!staffList || staffList.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">{at("staff.noStaff")}</p>
        ) : (
          <div className="space-y-2">
            {staffList.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-3 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.staffUsername || s.name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabels[s.role] || s.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resetId === s.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="password"
                        className="w-28 bg-background border border-border rounded px-2 py-1 text-xs"
                        value={resetPwd}
                        onChange={(e) => setResetPwd(e.target.value)}
                        placeholder="新密码"
                      />
                      <button
                        onClick={() => resetPwdMutation.mutate({ id: s.id, newPassword: resetPwd })}
                        disabled={!resetPwd || resetPwdMutation.isPending}
                        className="px-2 py-1 bg-gold/20 text-gold rounded text-xs hover:bg-gold/30 disabled:opacity-50"
                      >
                        确认
                      </button>
                      <button onClick={() => { setResetId(null); setResetPwd(""); }} className="px-2 py-1 text-muted-foreground rounded text-xs hover:bg-secondary">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setResetId(s.id)}
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                      >
                        {at("staff.resetPwd")}
                      </button>
                      <button
                        onClick={() => { if (confirm(at("staff.confirmDelete"))) deleteMutation.mutate({ id: s.id }); }}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== STATS PANEL ====================
function StatsPanel({ at, onNavigate }: { at: (k: string) => string; onNavigate?: (tab: string) => void }) {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.admin.trends.useQuery({ days: 14 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">{at("stats.title")}</h2>
      
      {/* Primary KPI Cards - 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => onNavigate?.("users")}>
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalUsers")}</p>
          <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">+{stats?.todayNewUsers ?? 0} {at("stats.today")}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.todayActive")}</p>
          <p className="text-2xl font-bold text-truth-blue">{stats?.todayActiveUsers ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{at("stats.dau")}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalBalance")}</p>
          <p className="text-2xl font-bold text-gold">${stats?.totalBalance ?? "0.00"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{at("stats.platformFunds")}</p>
        </div>
        <div
          className={`glass rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/30 transition-colors ${
            (stats?.pendingWithdrawals ?? 0) > 0 ? "border border-orange-400/40" : ""
          }`}
          onClick={() => onNavigate?.("finance")}
        >
          <p className="text-xs text-muted-foreground mb-1">{at("stats.pendingWithdrawals")}</p>
          <p className={`text-2xl font-bold ${ (stats?.pendingWithdrawals ?? 0) > 0 ? "text-orange-400" : "" }`}>
            {stats?.pendingWithdrawals ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">${stats?.pendingWithdrawAmount ?? "0.00"}</p>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-3 text-center cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => onNavigate?.("rooms")}>
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalRooms")}</p>
          <p className="text-xl font-bold text-truth-blue">{stats?.totalRooms ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalTx")}</p>
          <p className="text-xl font-bold">{stats?.totalTransactions ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalVolume")}</p>
          <p className="text-xl font-bold text-success">${stats?.totalVolume ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.todayNew")}</p>
          <p className="text-xl font-bold text-emerald-400">{stats?.todayNewUsers ?? 0}</p>
        </div>
      </div>

      {/* Rake Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-3 text-center border border-gold/20 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => onNavigate?.("finance")}>
          <p className="text-xs text-muted-foreground mb-1">{at("finance.rakeTotal")}</p>
          <p className="text-xl font-bold text-gold">${stats?.totalRake ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center border border-emerald-400/20">
          <p className="text-xs text-muted-foreground mb-1">{at("finance.rakeToday")}</p>
          <p className="text-xl font-bold text-emerald-400">${stats?.todayRake ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("finance.rakeTotalHands")}</p>
          <p className="text-xl font-bold text-purple-400">{stats?.totalHands ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("finance.rakeTodayHands")}</p>
          <p className="text-xl font-bold">{stats?.todayHands ?? 0}</p>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{at("stats.trend")}</h3>
          <span className="text-xs text-muted-foreground">{at("stats.last14days")}</span>
        </div>

        {trendsLoading ? (
          <div className="flex items-center justify-center h-40"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* DAU Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dau")}</p>
              <TrendChart data={trends?.dailyUsers ?? []} dataKey="count" color="#d4a017" label={at("stats.users")} noDataText={at("common.noData")} />
            </div>
            {/* Daily Volume Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyVolume")}</p>
              <TrendChart data={trends?.dailyVolume ?? []} dataKey="volume" color="#22c55e" label={at("stats.volume")} isVolume noDataText={at("common.noData")} />
            </div>
            {/* Daily Hands Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyHands")}</p>
              <TrendChart data={trends?.dailyHands ?? []} dataKey="count" color="#3b6fd4" label={at("stats.hands")} noDataText={at("common.noData")} />
            </div>
            {/* Daily Rake Chart */}
            <div className="glass rounded-xl p-4 border border-gold/10">
              <p className="text-xs font-medium text-gold mb-3">{at("finance.rakeTrend")}</p>
              <TrendChart data={(trends as any)?.dailyRake ?? []} dataKey="total" color="#d4a017" label={at("finance.rakeTotal")} isVolume noDataText={at("common.noData")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple trend chart using SVG (no external chart lib needed for this minimal display)
function TrendChart({ data, dataKey, color, label, isVolume, noDataText }: { data: any[]; dataKey: string; color: string; label: string; isVolume?: boolean; noDataText?: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
        {noDataText || "No data"}
      </div>
    );
  }

  const values = data.map(d => parseFloat(d[dataKey] ?? d.count ?? 0));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const width = 280;
  const height = 100;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((v - minVal) / range) * chartHeight;
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${padding + chartWidth},${padding + chartHeight}`, `${padding},${padding + chartHeight}`];

  const latestVal = values[values.length - 1] ?? 0;
  const prevVal = values.length > 1 ? values[values.length - 2] : latestVal;
  const changePercent = prevVal > 0 ? (((latestVal - prevVal) / prevVal) * 100).toFixed(0) : "0";
  const isPositive = latestVal >= prevVal;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-lg font-bold" style={{ color }}>
          {isVolume ? `$${formatBalance(latestVal)}` : latestVal}
        </span>
        <span className={`text-[10px] font-medium ${isPositive ? "text-success" : "text-red-400"}`}>
          {isPositive ? "↑" : "↓"}{Math.abs(parseInt(changePercent))}%
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints.join(" ")} fill={`url(#grad-${label})`} />
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r="3" fill={color} />
        )}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">{data[0]?.date?.slice(5) ?? ""}</span>
        <span className="text-[9px] text-muted-foreground">{data[data.length - 1]?.date?.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}

function CopyableUrl({ value, small }: { value: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { at } = useAdminLang();
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(at("toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2">
      <div className={`glass rounded-lg px-3 py-2 ${small ? "text-[10px] text-foreground/60" : "text-xs text-foreground/80"} font-mono break-all flex-1`}>
        {value}
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 p-2 rounded-lg glass hover:bg-gold/10 transition-colors text-muted-foreground hover:text-gold"
        title="复制"
      >
        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}


// ==================== BANNERS PANEL ====================
function BannersPanel({ at }: { at: (k: string) => string }) {
  const bannersQuery = trpc.adminBanners.list.useQuery();
  const createMutation = trpc.adminBanners.create.useMutation({ onSuccess: () => bannersQuery.refetch() });
  const updateMutation = trpc.adminBanners.update.useMutation({ onSuccess: () => bannersQuery.refetch() });
  const deleteMutation = trpc.adminBanners.delete.useMutation({ onSuccess: () => bannersQuery.refetch() });
  const toggleMutation = trpc.adminBanners.toggleActive.useMutation({ onSuccess: () => bannersQuery.refetch() });
  const uploadMutation = trpc.adminBanners.uploadImage.useMutation();
  const [uploading, setUploading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [formData, setFormData] = useState({ title: "", imageUrl: "", linkUrl: "", linkType: "none" as "url" | "page" | "none", sortOrder: 0 });

  const handleCreate = () => {
    setEditingBanner(null);
    setFormData({ title: "", imageUrl: "", linkUrl: "", linkType: "none", sortOrder: 0 });
    setShowForm(true);
  };

  const handleEdit = (banner: any) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "",
      linkType: banner.linkType || "none",
      sortOrder: banner.sortOrder || 0,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (uploading) {
      toast.error(at("toast.bannerUploading"));
      return;
    }
    if (!formData.title) {
      toast.error(at("toast.bannerTitleRequired"));
      return;
    }
    if (!formData.imageUrl) {
      toast.error(at("toast.bannerImageRequired"));
      return;
    }
    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
    setShowForm(false);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定删除该 Banner？")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{at("tab.banners")}</h3>
        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded-lg bg-gold text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + {at("banners.add")}
        </button>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <h4 className="font-semibold">{editingBanner ? (at("banners.edit")) : (at("banners.add"))}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{at("banners.title")}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="比赛广告 / 充值活动"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">图片上传 <span className="text-muted-foreground/60">(建议尺寸: 750×250px)</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(at("toast.bannerSizeExceeded"));
                      return;
                    }
                    setUploading(true);
                    const reader = new FileReader();
                    reader.onload = async () => {
                      try {
                        const base64 = (reader.result as string).split(",")[1];
                        // Use REST endpoint directly to avoid tRPC batch link issues
                        const resp = await fetch("/api/upload/banner", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ fileName: file.name, fileData: base64, contentType: file.type }),
                        });
                        if (!resp.ok) {
                          const errData = await resp.json().catch(() => ({}));
                          throw new Error(errData.error || `HTTP ${resp.status}`);
                        }
                        const result = await resp.json();
                        setFormData(p => ({ ...p, imageUrl: result.url }));
                        toast.success(at("toast.bannerUploadSuccess"));
                      } catch (err) {
                        toast.error(at("toast.bannerUploadFailed") + ": " + (err instanceof Error ? err.message : ""));
                      } finally {
                        setUploading(false);
                      }
                    };
                    reader.onerror = () => {
                      setUploading(false);
                      toast.error(at("toast.bannerReadFileFailed"));
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-gold/20 file:text-gold"
                />
                {uploading && <span className="text-xs text-gold animate-pulse">上传中...</span>}
              </div>
              <input
                type="text"
                value={formData.imageUrl}
                onChange={(e) => setFormData(p => ({ ...p, imageUrl: e.target.value }))}
                placeholder="或直接输入图片 URL（如 CDN 地址）"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              {formData.imageUrl && (
                <img src={formData.imageUrl} alt="preview" className="mt-2 h-16 rounded-lg object-cover w-full" onError={(e) => (e.currentTarget.style.display='none')} />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{at("banners.linkType")}</label>
              <select
                value={formData.linkType}
                onChange={(e) => setFormData(p => ({ ...p, linkType: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="none">无动作</option>
                <option value="url">外部链接</option>
                <option value="page">内部页面</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{at("banners.linkUrl")}</label>
              <input
                type="text"
                value={formData.linkUrl}
                onChange={(e) => setFormData(p => ({ ...p, linkUrl: e.target.value }))}
                placeholder={formData.linkType === "url" ? "https://..." : formData.linkType === "page" ? "/lobby" : "可选，留空则无跳转"}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{at("banners.sortOrder")}</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          {formData.imageUrl && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">预览:</p>
              <img src={formData.imageUrl} alt="preview" className="h-20 rounded-lg object-cover" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90"
            >
              {editingBanner ? ("保存") : ("创建")}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Banner List */}
      {bannersQuery.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {bannersQuery.data && bannersQuery.data.length === 0 && (
        <p className="text-muted-foreground">{at("banners.empty")}</p>
      )}
      {bannersQuery.data && bannersQuery.data.length > 0 && (
        <div className="space-y-3">
          {bannersQuery.data.map((banner: any) => (
            <div key={banner.id} className="border border-border rounded-lg p-3 flex items-center gap-3">
              <img src={banner.imageUrl} alt={banner.title} className="w-24 h-16 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{banner.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${banner.isActive ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {banner.isActive ? "已上架" : "已下架"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  排序: {banner.sortOrder} | 类型: {banner.linkType === "url" ? "外链" : banner.linkType === "page" ? "内页" : "无"}
                  {banner.linkUrl && ` | ${banner.linkUrl}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleMutation.mutate({ id: banner.id, isActive: !banner.isActive })}
                  className={`px-2 py-1 rounded text-xs ${banner.isActive ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}
                >
                  {banner.isActive ? "下架" : "上架"}
                </button>
                <button
                  onClick={() => handleEdit(banner)}
                  className="px-2 py-1 rounded text-xs bg-truth-blue/20 text-truth-blue"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TOURNAMENTS PANEL ====================
function TournamentsPanel({ at }: { at: (k: string) => string }) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: listData, refetch } = trpc.adminTournaments.list.useQuery({});
  const createMutation = trpc.adminTournaments.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); toast.success(at("toast.tournamentCreated")); } });
  const updateMutation = trpc.adminTournaments.update.useMutation({ onSuccess: () => { refetch(); setShowForm(false); setEditingId(null); toast.success(at("toast.tournamentUpdated")); } });
  const deleteMutation = trpc.adminTournaments.delete.useMutation({ onSuccess: () => { refetch(); toast.success(at("toast.tournamentDeleted")); } });
  const openRegMutation = trpc.adminTournaments.openRegistration.useMutation({ onSuccess: () => { refetch(); toast.success(at("toast.tournamentRegOpen")); } });
  const startMutation = trpc.adminTournaments.start.useMutation({ onSuccess: () => { refetch(); toast.success(at("toast.tournamentStarted")); } });
  const cancelMutation = trpc.adminTournaments.cancel.useMutation({ onSuccess: () => { refetch(); toast.success(at("toast.tournamentCancelled")); } });
  const distributePrizesMutation = trpc.adminTournaments.distributePrizes.useMutation({
    onSuccess: (data) => {
      refetch();
      setShowDistributeModal(false);
      setDistributeResults([]);
      toast.success(at("toast.tournamentPrizesDone").replace("{count}", String(data.distributed)));
    },
    onError: (err) => toast.error(err.message),
  });
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distributeTargetId, setDistributeTargetId] = useState<number | null>(null);
  const [distributeResults, setDistributeResults] = useState<Array<{ userId: number; rank: number; prizeAmount: string; finalChips: number; nickname: string }>>([]);
  const [showDetailId, setShowDetailId] = useState<number | null>(null);
  const detailQuery = trpc.adminTournaments.detail.useQuery(
    { id: showDetailId! },
    { enabled: !!showDetailId }
  );

  // Form state
  const [form, setForm] = useState({
    name: "",
    entryFee: "10",
    startingChips: 10000,
    totalRounds: 60,
    playersPerTable: 9,
    minPlayers: 10,
    maxPlayers: 1000,
    blindLevelDuration: 10,
    tableShuffleInterval: 15,
    finalTableThreshold: 9,
    platformRake: "10",
    scheduledStartTime: "",
    prizeDistribution: [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 },
    ],
  });

  const resetForm = () => {
    setForm({
      name: "", entryFee: "10", startingChips: 10000, totalRounds: 60,
      playersPerTable: 9, minPlayers: 10, maxPlayers: 1000,
      blindLevelDuration: 10, tableShuffleInterval: 15, finalTableThreshold: 9,
      platformRake: "10", scheduledStartTime: "",
      prizeDistribution: [{ rank: 1, percentage: 50 }, { rank: 2, percentage: 30 }, { rank: 3, percentage: 20 }],
    });
  };

  const handleSubmit = () => {
    if (!form.name || !form.scheduledStartTime) {
      toast.error(at("toast.tournamentNameTimeRequired"));
      return;
    }
    // Generate default blind structure based on starting chips
    const baseBlind = Math.floor(form.startingChips / 200);
    const blindStructure = Array.from({ length: 20 }, (_, i) => {
      const multiplier = Math.pow(1.5, i);
      const smallBlind = Math.round(baseBlind * multiplier);
      return { level: i + 1, smallBlind, bigBlind: smallBlind * 2, ante: i >= 3 ? Math.round(smallBlind * 0.2) : 0 };
    });
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: form.name,
        entryFee: form.entryFee,
        startingChips: form.startingChips,
        totalRounds: form.totalRounds,
        playersPerTable: form.playersPerTable,
        minPlayers: form.minPlayers,
        maxPlayers: form.maxPlayers,
        blindLevelDuration: form.blindLevelDuration,
        tableShuffleInterval: form.tableShuffleInterval,
        finalTableThreshold: form.finalTableThreshold,
        platformRake: form.platformRake,
        startTime: new Date(form.scheduledStartTime).toISOString(),
        blindStructure,
        prizeDistribution: form.prizeDistribution,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        entryFee: form.entryFee,
        startingChips: form.startingChips,
        totalRounds: form.totalRounds,
        playersPerTable: form.playersPerTable,
        minPlayers: form.minPlayers,
        maxPlayers: form.maxPlayers,
        blindLevelDuration: form.blindLevelDuration,
        tableShuffleInterval: form.tableShuffleInterval,
        finalTableThreshold: form.finalTableThreshold,
        platformRake: form.platformRake,
        startTime: new Date(form.scheduledStartTime).toISOString(),
        blindStructure,
        prizeDistribution: form.prizeDistribution,
      });
    }
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      entryFee: t.entryFee,
      startingChips: t.startingChips,
      totalRounds: t.totalRounds,
      playersPerTable: t.playersPerTable,
      minPlayers: t.minPlayers,
      maxPlayers: t.maxPlayers,
      blindLevelDuration: t.blindLevelDuration,
      tableShuffleInterval: t.tableShuffleInterval,
      finalTableThreshold: t.finalTableThreshold,
      platformRake: t.platformRake,
      scheduledStartTime: t.startTime ? new Date(t.startTime).toISOString().slice(0, 16) : "",
      prizeDistribution: t.prizeDistribution || [{ rank: 1, percentage: 50 }, { rank: 2, percentage: 30 }, { rank: 3, percentage: 20 }],
    });
    setShowForm(true);
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    registration: "bg-blue-500/20 text-blue-400",
    running: "bg-green-500/20 text-green-400",
    finished: "bg-gray-500/20 text-gray-400",
    cancelled: "bg-red-500/20 text-red-400",
  };
  const statusLabels: Record<string, string> = {
    draft: "草稿（未公开）",
    registration: "报名中",
    running: "进行中",
    finished: "已结束",
    cancelled: "已取消",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gold">锦标赛管理</h2>
        <button
          onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-2 bg-gold text-black rounded-lg font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> 创建比赛
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-foreground">{editingId ? "编辑比赛" : "创建新比赛"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">比赛名称</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" placeholder="红色星期五锦标赛" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">开赛时间</label>
              <input type="datetime-local" value={form.scheduledStartTime} onChange={e => setForm(f => ({ ...f, scheduledStartTime: e.target.value }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">报名费 (USDT)</label>
              <input type="number" value={form.entryFee} onChange={e => setForm(f => ({ ...f, entryFee: e.target.value }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">初始比赛分 (报名费×1000)</label>
              <input type="number" value={form.startingChips} onChange={e => setForm(f => ({ ...f, startingChips: parseInt(e.target.value) || 10000 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">总局数</label>
              <input type="number" value={form.totalRounds} onChange={e => setForm(f => ({ ...f, totalRounds: parseInt(e.target.value) || 60 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">每桌人数</label>
              <input type="number" value={form.playersPerTable} onChange={e => setForm(f => ({ ...f, playersPerTable: parseInt(e.target.value) || 9 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">最低开赛人数</label>
              <input type="number" value={form.minPlayers} onChange={e => setForm(f => ({ ...f, minPlayers: parseInt(e.target.value) || 10 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">最大报名人数</label>
              <input type="number" value={form.maxPlayers} onChange={e => setForm(f => ({ ...f, maxPlayers: parseInt(e.target.value) || 1000 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">盲注升级间隔 (分钟)</label>
              <input type="number" value={form.blindLevelDuration} onChange={e => setForm(f => ({ ...f, blindLevelDuration: parseInt(e.target.value) || 10 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">洗桌间隔 (分钟，防串通)</label>
              <input type="number" value={form.tableShuffleInterval} onChange={e => setForm(f => ({ ...f, tableShuffleInterval: parseInt(e.target.value) || 15 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">决赛桌人数阈值</label>
              <input type="number" value={form.finalTableThreshold} onChange={e => setForm(f => ({ ...f, finalTableThreshold: parseInt(e.target.value) || 9 }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">平台抽水 (%)</label>
              <input type="number" value={form.platformRake} onChange={e => setForm(f => ({ ...f, platformRake: e.target.value }))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground" />
            </div>
          </div>

          {/* Prize Distribution */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">奖金分配 (平台抽水后的奖池百分比)</label>
            <div className="space-y-2">
              {form.prizeDistribution.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-16">第{p.rank}名</span>
                  <input type="number" value={p.percentage} onChange={e => {
                    const newDist = [...form.prizeDistribution];
                    newDist[i] = { ...newDist[i], percentage: parseInt(e.target.value) || 0 };
                    setForm(f => ({ ...f, prizeDistribution: newDist }));
                  }} className="w-20 bg-background border border-border rounded px-2 py-1 text-foreground text-sm" />
                  <span className="text-sm text-muted-foreground">%</span>
                  {i === form.prizeDistribution.length - 1 && (
                    <button onClick={() => setForm(f => ({ ...f, prizeDistribution: [...f.prizeDistribution, { rank: f.prizeDistribution.length + 1, percentage: 0 }] }))}
                      className="text-xs text-blue-400 hover:text-blue-300">+ 添加名次</button>
                  )}
                  {form.prizeDistribution.length > 1 && (
                    <button onClick={() => setForm(f => ({ ...f, prizeDistribution: f.prizeDistribution.filter((_, idx) => idx !== i) }))}
                      className="text-xs text-red-400 hover:text-red-300">删除</button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">当前总计: {form.prizeDistribution.reduce((s, p) => s + p.percentage, 0)}% (应为100%)</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleSubmit} className="px-4 py-2 bg-gold text-black rounded-lg font-medium text-sm">
              {editingId ? "保存修改" : "创建比赛"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm">取消</button>
          </div>

          {/* Status action buttons when editing */}
          {editingId && (() => {
            const currentTourney = listData?.find((t: any) => t.id === editingId);
            if (!currentTourney) return null;
            return (
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">当前状态: <span className={`font-bold ${statusColors[currentTourney.status]?.split(' ')[1] || ''}`}>{statusLabels[currentTourney.status] || currentTourney.status}</span></p>
                <div className="flex flex-wrap gap-2">
                  {currentTourney.status === "draft" && (
                    <button onClick={() => { if (confirm("开放报名后，比赛将在前端大厅显示，玩家可以报名。确定开放？")) openRegMutation.mutate({ id: editingId }); }}
                      className="px-4 py-2 border border-green-500 text-green-400 rounded-lg text-sm hover:bg-green-500/10">🟢 开放报名</button>
                  )}
                  {currentTourney.status === "registration" && (
                    <button onClick={() => { if (confirm("确定手动开始比赛？系统将自动分桌并开始。")) startMutation.mutate({ id: editingId }); }}
                      className="px-4 py-2 border border-emerald-500 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/10">🚀 开始比赛</button>
                  )}
                  {(currentTourney.status === "registration" || currentTourney.status === "running") && (
                    <button onClick={() => { if (confirm("取消比赛将退还所有报名费，确定取消？")) cancelMutation.mutate({ id: editingId }); }}
                      className="px-4 py-2 border border-red-500 text-red-400 rounded-lg text-sm hover:bg-red-500/10">❌ 取消比赛</button>
                  )}
                  {currentTourney.status === "running" && (
                    <button onClick={() => {
                      setDistributeTargetId(editingId);
                      // Pre-populate with registered players
                      const regs = (currentTourney as any).registrations ?? [];
                      setDistributeResults(regs.map((r: any, i: number) => ({
                        userId: r.reg?.userId ?? r.userId,
                        rank: i + 1,
                        prizeAmount: "0",
                        finalChips: 0,
                        nickname: r.user?.nickname ?? r.nickname ?? `玩家${i + 1}`,
                      })));
                      setShowDistributeModal(true);
                    }} className="px-4 py-2 border border-yellow-500 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/10">🏆 发放奖金</button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tournament List */}
      <div className="space-y-3">
        {listData?.map((t: any) => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">{t.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[t.status] || "bg-gray-500/20 text-gray-400"}`}>
                    {statusLabels[t.status] || t.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    👥 已报名: {t.registrations?.length || t.registeredCount || 0}/{t.maxPlayers}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  <p>报名费: {t.entryFee} USDT | 初始分: {t.startingChips} | 总局数: {t.totalRounds}</p>
                  <p>人数: {t.minPlayers}-{t.maxPlayers} | 每桌: {t.playersPerTable}人 | 抽水: {t.platformRake}%</p>
                  <p>开赛时间: {t.startTime ? new Date(t.startTime).toLocaleString() : "未设置"}</p>
                  {t.prizeDistribution && (
                    <p>奖金: {(t.prizeDistribution as Array<{rank:number;percentage:number}>).map((p: any) => `第${p.rank}名 ${p.percentage}%`).join(" | ")}</p>
                  )}
                </div>
                {/* Registered Players List */}
                {t.registrations && t.registrations.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">查看报名玩家列表 ({t.registrations.length}人)</summary>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-1 px-2">#</th>
                            <th className="text-left py-1 px-2">玩家</th>
                            <th className="text-left py-1 px-2">ID</th>
                            <th className="text-left py-1 px-2">状态</th>
                            <th className="text-left py-1 px-2">报名时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.registrations.map((r: any, idx: number) => (
                            <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-1 px-2 text-muted-foreground">{idx + 1}</td>
                              <td className="py-1 px-2 text-foreground">{r.user?.nickname || r.user?.tgUsername || `玩家${r.reg?.userId}`}</td>
                              <td className="py-1 px-2 text-muted-foreground">#{r.reg?.userId}</td>
                              <td className="py-1 px-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  r.reg?.status === 'registered' ? 'bg-green-500/20 text-green-400' :
                                  r.reg?.status === 'playing' ? 'bg-amber-500/20 text-amber-400' :
                                  r.reg?.status === 'eliminated' ? 'bg-red-500/20 text-red-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>{r.reg?.status}</span>
                              </td>
                              <td className="py-1 px-2 text-muted-foreground">{r.reg?.registeredAt ? new Date(r.reg.registeredAt).toLocaleString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === "draft" && (
                  <button onClick={() => { if (confirm("开放报名后，比赛将在前端大厅显示，玩家可以报名。确定开放？")) openRegMutation.mutate({ id: t.id }); }}
                    className="text-xs px-2 py-1 border border-green-500 text-green-400 rounded hover:bg-green-500/10">开放报名</button>
                )}
                {(t.status === "draft" || t.status === "registration") && (
                  <>
                    <button onClick={() => handleEdit(t)} className="text-xs px-2 py-1 border border-blue-500 text-blue-400 rounded hover:bg-blue-500/10">编辑</button>
                    <button onClick={() => { if (confirm("确定删除此比赛？")) deleteMutation.mutate({ id: t.id }); }}
                      className="text-xs px-2 py-1 border border-red-500 text-red-400 rounded hover:bg-red-500/10">删除</button>
                  </>
                )}
                {t.status === "registration" && (
                  <button onClick={() => { if (confirm("确定手动开始比赛？")) startMutation.mutate({ id: t.id }); }}
                    className="text-xs px-2 py-1 border border-emerald-500 text-emerald-400 rounded hover:bg-emerald-500/10">🚀 开始比赛</button>
                )}
                {(t.status === "registration" || t.status === "running") && (
                  <button onClick={() => { if (confirm(`取消比赛将退还所有报名费，确定取消？`)) cancelMutation.mutate({ id: t.id }); }}
                    className="text-xs px-2 py-1 border border-orange-500 text-orange-400 rounded hover:bg-orange-500/10">取消比赛</button>
                )}
                {t.status === "running" && (
                  <button onClick={() => {
                    setDistributeTargetId(t.id);
                    setDistributeResults([]);
                    setShowDistributeModal(true);
                  }} className="text-xs px-2 py-1 border border-yellow-500 text-yellow-400 rounded hover:bg-yellow-500/10">🏆 发放奖金</button>
                )}
                {t.status === "finished" && (
                  <button onClick={() => setShowDetailId(t.id)}
                    className="text-xs px-2 py-1 border border-purple-500 text-purple-400 rounded hover:bg-purple-500/10">📊 查看详情</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!listData || listData.length === 0) && (
          <div className="text-center text-muted-foreground py-8">暂无锦标赛</div>
        )}
      </div>

      {/* Tournament Detail Modal */}
      {showDetailId && detailQuery.data && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-foreground">🏆 比赛详情 - {detailQuery.data.tournament.name}</h3>
              <button onClick={() => setShowDetailId(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Tournament Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">报名费</p>
                  <p className="font-bold text-foreground">${detailQuery.data.tournament.entryFee} USDT</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">总奖池</p>
                  <p className="font-bold text-yellow-400">${detailQuery.data.tournament.totalPrizePool || '0'} USDT</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">参赛人数</p>
                  <p className="font-bold text-foreground">{detailQuery.data.registrations?.length || 0} 人</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">总局数</p>
                  <p className="font-bold text-foreground">{detailQuery.data.tournament.totalRounds} 局</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">开赛时间</p>
                  <p className="font-bold text-foreground text-xs">{detailQuery.data.tournament.startTime ? new Date(detailQuery.data.tournament.startTime).toLocaleString() : '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">结束时间</p>
                  <p className="font-bold text-foreground text-xs">{detailQuery.data.tournament.endTime ? new Date(detailQuery.data.tournament.endTime).toLocaleString() : '-'}</p>
                </div>
              </div>

              {/* Results Table */}
              <div>
                <h4 className="font-bold text-foreground mb-2">🏅 最终排名</h4>
                {detailQuery.data.results && detailQuery.data.results.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground">排名</th>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground">用户</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">奖金</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">最终筹码</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">局数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data.results as any[]).sort((a: any, b: any) => (a.result?.rank || a.rank) - (b.result?.rank || b.rank)).map((r: any, i: number) => {
                          const rank = r.result?.rank ?? r.rank;
                          const prize = r.result?.prizeAmount ?? r.prizeAmount ?? '0';
                          const finalChips = r.result?.finalChips ?? r.finalChips ?? 0;
                          const rounds = r.result?.roundsPlayed ?? r.roundsPlayed ?? 0;
                          const name = r.user?.nickname || r.user?.name || `用户#${r.result?.userId || r.userId}`;
                          const medals = ['🥇', '🥈', '🥉'];
                          return (
                            <tr key={i} className={`border-t border-border ${rank <= 3 ? 'bg-yellow-500/5' : ''}`}>
                              <td className="px-3 py-2 font-bold">{medals[rank - 1] || `#${rank}`}</td>
                              <td className="px-3 py-2 text-foreground">{name}</td>
                              <td className="px-3 py-2 text-right font-bold text-yellow-400">{parseFloat(prize) > 0 ? `$${prize}` : '-'}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{finalChips.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{rounds}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无结果数据</p>
                )}
              </div>

              {/* Registrations */}
              <div>
                <h4 className="font-bold text-foreground mb-2">📝 报名名单 ({detailQuery.data.registrations?.length || 0}人)</h4>
                <div className="flex flex-wrap gap-2">
                  {(detailQuery.data.registrations as any[] || []).map((reg: any, i: number) => (
                    <span key={i} className="text-xs bg-muted/30 px-2 py-1 rounded text-muted-foreground">
                      {reg.user?.nickname || reg.user?.name || `ID:${reg.reg?.userId || reg.userId}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setShowDetailId(null)} className="w-full py-2 border border-border text-muted-foreground rounded-lg text-sm hover:bg-muted/30">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Distribute Prizes Modal */}
      {showDistributeModal && distributeTargetId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-foreground">🏆 发放奖金 - 比赛 #{distributeTargetId}</h3>
              <button onClick={() => { setShowDistributeModal(false); setDistributeResults([]); }} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <p className="text-xs text-muted-foreground">为每位参赛玩家填写用户ID、最终排名和奖金金额（USDT）。奖金 &gt; 0 将自动发放到玩家账户并发送 TG 通知。确认后比赛状态变为「已结束」。</p>
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2">
                  <span className="w-6">#</span>
                  <span className="w-20">用户ID</span>
                  <span className="flex-1">昵称(备注)</span>
                  <span className="w-16">排名</span>
                  <span className="w-20">奖金(USDT)</span>
                  <span className="w-4"></span>
                </div>
                {distributeResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 bg-muted/30 rounded-lg p-2">
                    <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}</span>
                    <input type="number" value={r.userId || ""} onChange={e => setDistributeResults(prev => prev.map((x, j) => j === i ? { ...x, userId: Number(e.target.value) } : x))} placeholder="用户ID" className="w-20 bg-background border border-border rounded px-2 py-1 text-xs" />
                    <input type="text" value={r.nickname} onChange={e => setDistributeResults(prev => prev.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x))} placeholder="昵称" className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs" />
                    <input type="number" value={r.rank} onChange={e => setDistributeResults(prev => prev.map((x, j) => j === i ? { ...x, rank: Number(e.target.value) } : x))} placeholder="排名" className="w-16 bg-background border border-border rounded px-2 py-1 text-xs" />
                    <input type="number" value={r.prizeAmount} onChange={e => setDistributeResults(prev => prev.map((x, j) => j === i ? { ...x, prizeAmount: e.target.value } : x))} placeholder="奖金" className="w-20 bg-background border border-border rounded px-2 py-1 text-xs text-yellow-400 font-bold" />
                    <button onClick={() => setDistributeResults(prev => prev.filter((_, j) => j !== i))} className="text-red-400 text-xs hover:text-red-300 w-4">✕</button>
                  </div>
                ))}
                <button onClick={() => setDistributeResults(prev => [...prev, { userId: 0, rank: prev.length + 1, prizeAmount: "0", finalChips: 0, nickname: "" }])} className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded hover:bg-muted/30 w-full">+ 添加玩家</button>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button onClick={() => { setShowDistributeModal(false); setDistributeResults([]); }} className="flex-1 py-2 border border-border text-muted-foreground rounded-lg text-sm hover:bg-muted/30">取消</button>
              <button
                disabled={distributePrizesMutation.isPending || distributeResults.length === 0 || distributeResults.some(r => !r.userId)}
                onClick={() => {
                  if (!confirm(`确定发放奖金给 ${distributeResults.length} 位玩家？此操作不可撤销，比赛将标记为已结束。`)) return;
                  distributePrizesMutation.mutate({ id: distributeTargetId, results: distributeResults.map(r => ({ userId: r.userId, rank: r.rank, prizeAmount: r.prizeAmount, finalChips: r.finalChips, roundsPlayed: 0, handsWon: 0 })) });
                }}
                className="flex-1 py-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 rounded-lg text-sm font-bold hover:bg-yellow-500/30 disabled:opacity-50">
                {distributePrizesMutation.isPending ? "发放中..." : "✅ 确认发放奖金"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== CS RECORDS PANEL ====================
function CsRecordsPanel({ at }: { at: (k: string) => string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const convosQuery = trpc.adminCs.conversations.useQuery({ page, limit: 20, search: search || undefined });
  const detailQuery = trpc.adminCs.conversations.useQuery(
    { page: 1, limit: 1, userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  if (selectedUserId && detailQuery.data) {
    const msgs = detailQuery.data.items;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedUserId(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-lg font-bold">{at("csRecords.detail")} (User#{selectedUserId})</h3>
          <span className="text-xs text-muted-foreground">({msgs.length} messages)</span>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {msgs.slice().reverse().map((msg: any) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-gold/20 text-foreground"
                  : msg.role === "system"
                  ? "bg-muted text-muted-foreground italic"
                  : "bg-truth-blue/10 text-foreground"
              }`}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] font-medium uppercase opacity-60">{msg.role}</span>
                  <span className="text-[10px] opacity-40">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{at("tab.csRecords")}</h3>
      </div>
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={at("csRecords.searchPlaceholder")}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {at("csRecords.search")}
        </button>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {at("csRecords.clear")}
          </button>
        )}
      </div>
      {search && (
        <p className="text-xs text-muted-foreground">
          {at("csRecords.searchResult")}: "{search}" ({convosQuery.data?.total ?? 0} {at("csRecords.users")})
        </p>
      )}
      {convosQuery.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {convosQuery.data && convosQuery.data.items.length === 0 && !convosQuery.isLoading && (
        <p className="text-muted-foreground">{at("csRecords.empty")}</p>
      )}
      {convosQuery.data && convosQuery.data.items.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left">{at("csRecords.user")}</th>
                <th className="px-4 py-2 text-left">{at("csRecords.lastMsg")}</th>
                <th className="px-4 py-2 text-center">{at("csRecords.count")}</th>
                <th className="px-4 py-2 text-right">{at("csRecords.time")}</th>
              </tr>
            </thead>
            <tbody>
              {convosQuery.data.items.map((item: any) => (
                <tr
                  key={item.userId}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedUserId(item.userId)}
                >
                  <td className="px-4 py-2 font-medium">{item.userName}</td>
                  <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{item.lastMessage}</td>
                  <td className="px-4 py-2 text-center">{item.messageCount}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                    {item.lastTime ? new Date(item.lastTime).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {convosQuery.data && convosQuery.data.total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={convosQuery.data.items.length < 20}
            className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== LOGS PANEL ====================
function LogsPanel({ at }: { at: (k: string) => string }) {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const logsQuery = trpc.adminLogs.list.useQuery({ page, limit: 50, category });
  const statsQuery = trpc.adminLogs.stats.useQuery();
  const categories = ["all", "finance", "user", "room", "config", "agent", "system", "auth"];

  const actionLabels: Record<string, string> = {
    confirm_deposit: "确认充值",
    reject_transaction: "拒绝交易",
    confirm_withdrawal: "确认提现",
    update_config: "更新配置",
    create_room: "创建房间",
    edit_room: "编辑房间",
    delete_room: "删除房间",
    update_room: "更新房间状态",
    manual_topup: "手动充值",
    user_login: "用户登录",
    user_register: "用户注册",
    agent_commission: "代理佣金",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("logs.title")}</h2>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground">{at("logs.today")}</div>
          <div className="text-xl font-bold text-cyan-400">{statsQuery.data?.today ?? 0}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground">{at("logs.total")}</div>
          <div className="text-xl font-bold text-emerald-400">{statsQuery.data?.total ?? 0}</div>
        </div>
      </div>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat === "all" ? undefined : cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              (cat === "all" && !category) || category === cat
                ? "bg-gold/20 text-gold border border-gold/40"
                : "bg-secondary/50 text-muted-foreground border border-border hover:border-gold/30"
            }`}
          >
            {at(`logs.${cat}`)}
          </button>
        ))}
      </div>
      {/* Logs table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.time")}</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.operator")}</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.action")}</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.target")}</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.status")}</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground">{at("logs.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.data?.logs?.map((log: any) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {log.operatorName || "System"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {log.targetType && `${log.targetType} #${log.targetId}`}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {log.status === "success" ? at("logs.success") : at("logs.failed")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                    {log.detail ? JSON.stringify(log.detail) : "-"}
                  </td>
                </tr>
              ))}
              {(!logsQuery.data?.logs || logsQuery.data.logs.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    {at("logs.noLogs")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {(logsQuery.data?.total ?? 0) > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs rounded bg-secondary/50 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-xs text-muted-foreground">
              {page} / {Math.ceil((logsQuery.data?.total ?? 0) / 50)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil((logsQuery.data?.total ?? 0) / 50)}
              className="px-3 py-1 text-xs rounded bg-secondary/50 disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ==================== REGISTRATION BONUS CONFIG ====================
function RegistrationBonusConfig({ at, configs, saveSystemSetting }: { at: (k: string) => string; configs: any; saveSystemSetting: (key: string, value: string) => void }) {
  const [bonusAmount, setBonusAmount] = useState("0");
  const [minHands, setMinHands] = useState("20");
  const [wagerMultiplier, setWagerMultiplier] = useState("3");

  useEffect(() => {
    if (configs) {
      const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c.value]) ?? []);
      setBonusAmount(configMap.get("registration_bonus_amount") ?? "0");
      setMinHands(configMap.get("bonus_unlock_min_hands") ?? "20");
      setWagerMultiplier(configMap.get("bonus_unlock_wager_multiplier") ?? "3");
    }
  }, [configs]);

  const saveBonusSetting = (key: string, value: string) => {
    saveSystemSetting(key, value);
  };

  const bonusNum = parseFloat(bonusAmount) || 0;
  const multiplier = parseFloat(wagerMultiplier) || 3;
  const requiredWager = (bonusNum * multiplier).toFixed(2);

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">🎁 {at("settings.registrationBonus")}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {at("settings.registrationBonusDesc")}
      </p>
      <div className="space-y-3">
        {/* Bonus Amount */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {at("settings.bonusAmount")}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="0.5"
              className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
            <button onClick={() => saveBonusSetting("registration_bonus_amount", bonusAmount)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {at("settings.bonusAmountHint")}
          </p>
        </div>

        {/* Min Hands */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {at("settings.bonusMinHands")}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={minHands}
              onChange={(e) => setMinHands(e.target.value)}
              placeholder="20"
              min="1"
              className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
            <button onClick={() => saveBonusSetting("bonus_unlock_min_hands", minHands)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {at("settings.bonusMinHandsHint")}
          </p>
        </div>

        {/* Wager Multiplier */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {at("settings.bonusWagerMultiplier")}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={wagerMultiplier}
              onChange={(e) => setWagerMultiplier(e.target.value)}
              placeholder="3"
              min="1"
              step="0.5"
              className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
            <button onClick={() => saveBonusSetting("bonus_unlock_wager_multiplier", wagerMultiplier)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {at("settings.bonusWagerHint")}
          </p>
        </div>

        {/* Summary */}
        {bonusNum > 0 && (
          <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
            <p className="text-xs font-medium text-gold mb-1">
              {at("settings.bonusSummary")}
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              <li>• {at("settings.bonusSummary1")}: <span className="text-gold font-bold">${bonusAmount} USDT</span></li>
              <li>• {at("settings.bonusSummary2")}: ≥{minHands} {at("settings.bonusSummary2b")} + ≥${requiredWager} {at("settings.bonusSummary2c")}</li>
              <li>• {at("settings.bonusSummary3")}: {at("settings.bonusSummary3b")}</li>
              <li>• {at("settings.bonusSummary4")}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


// ==================== BOT MANAGEMENT PANEL ====================
function BotManagementPanel({ at }: { at: (k: string) => string }) {
  const { data: stats, isLoading, refetch } = trpc.adminBot.stats.useQuery(undefined, { refetchInterval: 5000 });
  const utils = trpc.useUtils();
  const updateConfig = trpc.adminBot.updateConfig.useMutation({
    onSuccess: () => { toast.success("配置已更新"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const resetLoss = trpc.adminBot.resetDailyLoss.useMutation({
    onSuccess: () => { toast.success("每日亏损已重置"); refetch(); },
  });
  const importBots = trpc.adminBot.importBots.useMutation({
    onSuccess: (data: any) => { toast.success(`成功导入 ${data.count} 个机器人`); refetch(); },
    onError: (err: any) => toast.error("导入失败: " + err.message),
  });

  const [formState, setFormState] = useState<{
    enabled?: boolean;
    maxPerTable?: number;
    minPerTable?: number;
    dailyLossLimit?: number;
    foldRate?: number;
    minActionDelay?: number;
    maxActionDelay?: number;
    balanceAlertThreshold?: number;
    autoRefillAmount?: number;
    autoRefillEnabled?: boolean;
    fillWithoutRealPlayers?: boolean;
    persistentOnlineCount?: number;
    rotationHands?: number;
  }>({});

  const [botTab, setBotTab] = useState<"users" | "settings" | "schedule" | "balance">("users");

  useEffect(() => {
    if (stats?.config) {
      setFormState({
        enabled: stats.config.enabled,
        maxPerTable: stats.config.maxPerTable,
        minPerTable: (stats.config as any).minPerTable ?? 3,
        dailyLossLimit: stats.config.dailyLossLimit,
        foldRate: stats.config.foldRate,
        minActionDelay: stats.config.minActionDelay,
        maxActionDelay: stats.config.maxActionDelay,
        balanceAlertThreshold: (stats.config as any).balanceAlertThreshold ?? 500,
        autoRefillAmount: (stats.config as any).autoRefillAmount ?? 10000,
        autoRefillEnabled: (stats.config as any).autoRefillEnabled ?? true,
        fillWithoutRealPlayers: (stats.config as any).fillWithoutRealPlayers ?? true,
        persistentOnlineCount: (stats.config as any).persistentOnlineCount ?? 0,
        rotationHands: (stats.config as any).rotationHands ?? 0,
      });
    }
  }, [stats?.config]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;
  }

  const lossPercent = stats ? Math.min((stats.dailyLoss / Math.max(stats.dailyLossLimit, 1)) * 100, 100) : 0;
  const botDetails = (stats as any)?.botDetails || [];
  const totalBalance = botDetails.reduce((sum: number, b: any) => sum + b.balance, 0);
  const totalTodayHands = botDetails.reduce((sum: number, b: any) => sum + b.todayHands, 0);
  const totalTodayProfit = botDetails.reduce((sum: number, b: any) => sum + parseFloat(b.todayProfit || "0"), 0);

  const tabItems = [
    { key: "users" as const, label: "机器人用户" },
    { key: "settings" as const, label: "设置" },
    { key: "schedule" as const, label: "调度与策略" },
    { key: "balance" as const, label: "余额监控" },
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-gold" />
            AI 陪玩机器人管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">智能调度、概率决策、余额监控、数据统计</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stats?.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            <span className={`w-2 h-2 rounded-full ${stats?.enabled ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {stats?.enabled ? "运行中" : "已停止"}
          </span>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">在线Bot</p>
          <p className="text-2xl font-bold text-gold mt-1">{stats?.activeBots ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">总余额</p>
          <p className="text-2xl font-bold text-foreground mt-1">${totalBalance.toFixed(0)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">今日手数</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{totalTodayHands}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">今日盈亏</p>
          <p className={`text-2xl font-bold mt-1 ${totalTodayProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalTodayProfit >= 0 ? "+" : ""}{totalTodayProfit.toFixed(2)}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">亏损进度</p>
          <div className="mt-2">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-red-500 rounded-full transition-all" style={{ width: `${lossPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{lossPercent.toFixed(1)}% / ${stats?.dailyLossLimit?.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {tabItems.map(tab => (
          <button
            key={tab.key}
            onClick={() => setBotTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              botTab === tab.key
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {botTab === "users" && (
        <div className="space-y-6">
          {/* Bot Detail Stats Table (merged with behavior metrics) */}
          <BotDetailTableMerged botDetails={botDetails} formState={formState} />

          {/* Export / Import */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">机器人导出 / 导入</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  try {
                    const result = await utils.adminBot.exportBots.fetch();
                    if (!result) { toast.error("导出失败"); return; }
                    const blob = new Blob([JSON.stringify(result.bots, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `bots_export_${new Date().toISOString().slice(0,10)}.json`;
                    a.click(); URL.revokeObjectURL(url);
                    toast.success(`已导出 ${result.bots.length} 个机器人`);
                  } catch { toast.error("导出失败"); }
                }}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
              >
                导出Bot列表 (JSON)
              </button>
              <label className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors cursor-pointer">
                导入Bot列表
                <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const bots = Array.isArray(data) ? data : data.bots;
                    if (!Array.isArray(bots) || bots.length === 0) { toast.error("无效的Bot数据"); return; }
                    const importData = bots.map((b: any) => ({
                      name: b.name || b.nickname || `Bot_${Math.random().toString(36).slice(2,6)}`,
                      nickname: b.nickname || b.name,
                      avatar: b.avatar || undefined,
                      balance: parseFloat(b.balance) || 10000,
                    }));
                    importBots.mutate({ bots: importData });
                  } catch (err: any) { toast.error("导入失败: " + (err.message || "格式错误")); }
                  e.target.value = "";
                }} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">导出格式为JSON，可编辑后重新导入。导入时需包含 name 字段，balance 默认10000。</p>
          </div>
        </div>
      )}

      {botTab === "settings" && (
        <div className="space-y-6">
          {/* Global Config */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">全局配置</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium">启用Bot系统</p>
                  <p className="text-xs text-muted-foreground">开启后Bot将按在线人数动态调度</p>
                </div>
                <button
                  onClick={() => setFormState(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formState.enabled ? "bg-emerald-500" : "bg-secondary"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formState.enabled ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Fill Without Real Players Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium">无真人时Bot自动对玩</p>
                  <p className="text-xs text-muted-foreground">无真人时每桌安排{formState.minPerTable ?? 3}-{formState.maxPerTable ?? 5}个Bot对玩</p>
                </div>
                <button
                  onClick={() => setFormState(s => ({ ...s, fillWithoutRealPlayers: !s.fillWithoutRealPlayers }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formState.fillWithoutRealPlayers ? "bg-emerald-500" : "bg-secondary"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formState.fillWithoutRealPlayers ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Max Per Table */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">每桌最多Bot数</label>
                <input
                  type="number" min={1} max={50}
                  value={formState.maxPerTable ?? 5}
                  onChange={e => setFormState(s => ({ ...s, maxPerTable: parseInt(e.target.value) || 5 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Min Per Table (no real players) */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">每桌最少Bot数（无真人时）</label>
                <input
                  type="number" min={2} max={50}
                  value={formState.minPerTable ?? 3}
                  onChange={e => setFormState(s => ({ ...s, minPerTable: parseInt(e.target.value) || 3 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Daily Loss Limit */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">每日亏损上限 ($)</label>
                <input
                  type="number" min={0}
                  value={formState.dailyLossLimit ?? 500}
                  onChange={e => setFormState(s => ({ ...s, dailyLossLimit: parseFloat(e.target.value) || 500 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Fold Rate */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">弃牌率 (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={formState.foldRate ?? 67}
                  onChange={e => setFormState(s => ({ ...s, foldRate: parseInt(e.target.value) || 67 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">越高越保守（推荐60-75）</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => updateConfig.mutate(formState)}
                disabled={updateConfig.isPending}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {updateConfig.isPending ? "保存中..." : "保存配置"}
              </button>
              <button
                onClick={() => resetLoss.mutate()}
                disabled={resetLoss.isPending}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                重置今日亏损
              </button>
            </div>
          </div>

          {/* Room-level Bot Config */}
          <RoomBotConfigPanel />
        </div>
      )}

      {botTab === "schedule" && (
        <div className="space-y-6">
          {/* Scheduling & Strategy */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">调度参数</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Persistent Online Count */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">长期在线Bot总数</label>
                <input
                  type="number" min={0} max={200}
                  value={formState.persistentOnlineCount ?? 0}
                  onChange={e => setFormState(s => ({ ...s, persistentOnlineCount: parseInt(e.target.value) || 0 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">系统将保持此数量Bot分散在各牌桌上长期在线</p>
              </div>

              {/* Rotation Hands */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">每桌轮换手数</label>
                <input
                  type="number" min={0} max={1000}
                  value={formState.rotationHands ?? 0}
                  onChange={e => setFormState(s => ({ ...s, rotationHands: parseInt(e.target.value) || 0 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">Bot在每张桌打此数手后自动轮换（0=不轮换）</p>
              </div>

              {/* Min Action Delay */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">最小操作延迟 (ms)</label>
                <input
                  type="number" min={500} max={10000}
                  value={formState.minActionDelay ?? 2000}
                  onChange={e => setFormState(s => ({ ...s, minActionDelay: parseInt(e.target.value) || 2000 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Max Action Delay */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">最大操作延迟 (ms)</label>
                <input
                  type="number" min={1000} max={20000}
                  value={formState.maxActionDelay ?? 5000}
                  onChange={e => setFormState(s => ({ ...s, maxActionDelay: parseInt(e.target.value) || 5000 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => updateConfig.mutate(formState)}
                disabled={updateConfig.isPending}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {updateConfig.isPending ? "保存中..." : "保存配置"}
              </button>
            </div>
          </div>

          {/* Strategy Description */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Bot 策略说明</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• <span className="text-foreground font-medium">调度逻辑：</span>根据场次独立配置分配Bot，未配置的场次不分配Bot</p>
              <p>• <span className="text-foreground font-medium">决策引擎：</span>基于手牌强度+公共牌面计算equity，通过底池赔率数学比较决定跟注/弃牌</p>
              <p>• <span className="text-foreground font-medium">轮换机制：</span>Bot在每张桌打满指定手数后自动离桌，由调度器补充新Bot</p>
              <p>• <span className="text-foreground font-medium">操作延迟：</span>模拟真人思考时间（{formState.minActionDelay}ms - {formState.maxActionDelay}ms）</p>
              <p>• <span className="text-foreground font-medium">亏损控制：</span>达到每日亏损上限后自动停止入座</p>
              <p>• <span className="text-foreground font-medium">资金流转：</span>Bot使用真实余额，所有买入/结算/返还均记录完整流水</p>
            </div>
          </div>
        </div>
      )}

      {botTab === "balance" && (
        <div className="space-y-6">
          {/* Balance Monitor & Auto Refill */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">余额监控与自动补充</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auto Refill Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium">开启自动补充</p>
                  <p className="text-xs text-muted-foreground">余额不足时自动补充到指定金额</p>
                </div>
                <button
                  onClick={() => setFormState(s => ({ ...s, autoRefillEnabled: !s.autoRefillEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formState.autoRefillEnabled ? "bg-emerald-500" : "bg-secondary"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formState.autoRefillEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Balance Alert Threshold */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">余额告警阈值 ($)</label>
                <input
                  type="number" min={0}
                  value={formState.balanceAlertThreshold ?? 500}
                  onChange={e => setFormState(s => ({ ...s, balanceAlertThreshold: parseFloat(e.target.value) || 500 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">低于此值时发送告警通知</p>
              </div>

              {/* Auto Refill Amount */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <label className="text-sm font-medium">自动补充金额 ($)</label>
                <input
                  type="number" min={0}
                  value={formState.autoRefillAmount ?? 10000}
                  onChange={e => setFormState(s => ({ ...s, autoRefillAmount: parseFloat(e.target.value) || 10000 }))}
                  className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
                />
                <p className="text-xs text-muted-foreground mt-1">补充后余额将达到此金额</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => updateConfig.mutate(formState)}
                disabled={updateConfig.isPending}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {updateConfig.isPending ? "保存中..." : "保存配置"}
              </button>
            </div>
          </div>

          {/* Low Balance Bots Warning */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">低余额Bot告警</h3>
            <div className="space-y-2">
              {botDetails.filter((b: any) => b.balance < (formState.balanceAlertThreshold ?? 500)).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">名称</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">当前余额</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">告警阈值</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {botDetails.filter((b: any) => b.balance < (formState.balanceAlertThreshold ?? 500)).map((b: any) => (
                        <tr key={b.id} className="border-b border-border/50">
                          <td className="py-2 px-2 font-medium text-foreground">{b.name}</td>
                          <td className="text-right py-2 px-2 text-red-400 font-mono">${b.balance.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-muted-foreground font-mono">${formState.balanceAlertThreshold ?? 500}</td>
                          <td className="text-center py-2 px-2">
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">余额不足</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10">
                  <span className="text-emerald-400 text-lg">✓</span>
                  <p className="text-sm text-emerald-400">所有Bot余额正常，无告警</p>
                </div>
              )}
            </div>
          </div>

          {/* Balance Distribution */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">余额分布概览</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-xs text-muted-foreground">总余额</p>
                <p className="text-lg font-bold text-foreground mt-1">${totalBalance.toFixed(0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-xs text-muted-foreground">平均余额</p>
                <p className="text-lg font-bold text-foreground mt-1">${botDetails.length > 0 ? (totalBalance / botDetails.length).toFixed(0) : 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-xs text-muted-foreground">最低余额</p>
                <p className="text-lg font-bold text-red-400 mt-1">${botDetails.length > 0 ? Math.min(...botDetails.map((b: any) => b.balance)).toFixed(0) : 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-xs text-muted-foreground">最高余额</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">${botDetails.length > 0 ? Math.max(...botDetails.map((b: any) => b.balance)).toFixed(0) : 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// VPIP/PFR Behavior Metrics sub-component
function BotBehaviorMetrics() {
  const { data: metrics, isLoading } = trpc.adminBot.behaviorMetrics.useQuery(undefined, { refetchInterval: 30000 });
  
  if (isLoading) return <div className="glass rounded-xl p-5"><p className="text-sm text-muted-foreground">加载行为指标中...</p></div>;
  if (!metrics || metrics.length === 0) return null;
  
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Bot 行为指标（最近200手）</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">名称</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">样本手数</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">VPIP</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">PFR</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">激进度</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">风格判定</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: any) => {
              const vpip = parseFloat(m.vpip);
              const pfr = parseFloat(m.pfr);
              let style = "未知";
              if (vpip < 20) style = "极紧";
              else if (vpip < 30) style = "紧凑";
              else if (vpip < 45) style = "标准";
              else if (vpip < 60) style = "松散";
              else style = "极松";
              if (pfr > vpip * 0.7) style += "/激进";
              else if (pfr < vpip * 0.3) style += "/被动";
              else style += "/平衡";
              return (
                <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 font-medium text-foreground">{m.name}</td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{m.hands}</td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m.vpip}%</td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m.pfr}%</td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m.aggressionFactor}%</td>
                  <td className="text-center py-2 px-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold/20 text-gold">{style}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-muted-foreground space-y-1">
        <p>• <span className="text-foreground">VPIP</span>（主动入池率）：翻前主动投入筹码的比例，真人一般20-35%</p>
        <p>• <span className="text-foreground">PFR</span>（翻前加注率）：翻前加注的比例，真人一般15-25%</p>
        <p>• <span className="text-foreground">激进度</span>：加注/All-in占总操作的比例</p>
      </div>
    </div>
  );
}

// Room-level Bot Configuration Panel
function RoomBotConfigPanel() {
  const { data, isLoading, refetch } = (trpc.adminBot as any).roomConfigs.useQuery(undefined, { refetchInterval: 10000 });
  const upsertConfig = (trpc.adminBot as any).upsertRoomConfig.useMutation({
    onSuccess: () => { toast.success("场次配置已保存"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteConfig = (trpc.adminBot as any).deleteRoomConfig.useMutation({
    onSuccess: () => { toast.success("场次配置已删除（将使用全局配置）"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const [editingRoom, setEditingRoom] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    botCount: number;
    enabled: boolean;
    foldRate: number | null;
    minActionDelay: number | null;
    maxActionDelay: number | null;
  }>({ botCount: 3, enabled: true, foldRate: null, minActionDelay: null, maxActionDelay: null });

  if (isLoading) return <div className="glass rounded-xl p-5"><p className="text-sm text-muted-foreground">加载场次配置中...</p></div>;

  const rooms = data?.rooms || [];
  const configs = data?.configs || [];
  const configMap = new Map((configs as any[]).map((c: any) => [c.roomId, c]));

  const startEdit = (roomId: number) => {
    const existing = configMap.get(roomId);
    if (existing) {
      setEditForm({
        botCount: existing.botCount,
        enabled: existing.enabled,
        foldRate: existing.foldRate,
        minActionDelay: existing.minActionDelay,
        maxActionDelay: existing.maxActionDelay,
      });
    } else {
      setEditForm({ botCount: 3, enabled: true, foldRate: null, minActionDelay: null, maxActionDelay: null });
    }
    setEditingRoom(roomId);
  };

  const saveEdit = () => {
    if (editingRoom === null) return;
    upsertConfig.mutate({
      roomId: editingRoom,
      botCount: editForm.botCount,
      enabled: editForm.enabled,
      foldRate: editForm.foldRate,
      minActionDelay: editForm.minActionDelay,
      maxActionDelay: editForm.maxActionDelay,
    });
    setEditingRoom(null);
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">场次独立Bot配置</h3>
        <p className="text-xs text-muted-foreground">为每个场次单独设置Bot数量和参数（未配置的使用全局设置）</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">场次</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">盲注</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">Bot数量</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">启用</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">弃牌率</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">延迟(ms)</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room: any) => {
              const cfg = configMap.get(room.id);
              const isEditing = editingRoom === room.id;
              return (
                <tr key={room.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 font-medium text-foreground">{room.name}</td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{room.smallBlind}/{room.bigBlind}</td>
                  {isEditing ? (
                    <>
                      <td className="text-center py-2 px-2">
                        <input type="number" min={0} max={50} value={editForm.botCount}
                          onChange={e => setEditForm(s => ({ ...s, botCount: parseInt(e.target.value) || 0 }))}
                          className="w-14 glass rounded px-2 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-gold" />
                      </td>
                      <td className="text-center py-2 px-2">
                        <button onClick={() => setEditForm(s => ({ ...s, enabled: !s.enabled }))}
                          className={`w-8 h-4 rounded-full transition-colors ${editForm.enabled ? "bg-emerald-500" : "bg-secondary"}`}>
                          <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${editForm.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                      <td className="text-center py-2 px-2">
                        <input type="number" min={0} max={100} value={editForm.foldRate ?? ""}
                          placeholder="全局"
                          onChange={e => setEditForm(s => ({ ...s, foldRate: e.target.value ? parseInt(e.target.value) : null }))}
                          className="w-14 glass rounded px-2 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-gold" />
                      </td>
                      <td className="text-center py-2 px-2">
                        <div className="flex items-center gap-1 justify-center">
                          <input type="number" min={500} max={10000} value={editForm.minActionDelay ?? ""}
                            placeholder="全局"
                            onChange={e => setEditForm(s => ({ ...s, minActionDelay: e.target.value ? parseInt(e.target.value) : null }))}
                            className="w-14 glass rounded px-1 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-gold" />
                          <span className="text-muted-foreground">-</span>
                          <input type="number" min={1000} max={20000} value={editForm.maxActionDelay ?? ""}
                            placeholder="全局"
                            onChange={e => setEditForm(s => ({ ...s, maxActionDelay: e.target.value ? parseInt(e.target.value) : null }))}
                            className="w-14 glass rounded px-1 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-gold" />
                        </div>
                      </td>
                      <td className="text-center py-2 px-2">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={saveEdit} disabled={upsertConfig.isPending}
                            className="px-2 py-1 bg-gold text-black rounded text-[10px] font-medium hover:bg-gold/90">
                            保存
                          </button>
                          <button onClick={() => setEditingRoom(null)}
                            className="px-2 py-1 bg-secondary text-muted-foreground rounded text-[10px] hover:bg-secondary/80">
                            取消
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-center py-2 px-2">
                        {cfg ? <span className="text-gold font-bold">{cfg.botCount}</span> : <span className="text-muted-foreground">全局</span>}
                      </td>
                      <td className="text-center py-2 px-2">
                        {cfg ? (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${cfg.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {cfg.enabled ? "开" : "关"}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="text-center py-2 px-2 text-muted-foreground">
                        {cfg?.foldRate !== null && cfg?.foldRate !== undefined ? `${cfg.foldRate}%` : "全局"}
                      </td>
                      <td className="text-center py-2 px-2 text-muted-foreground">
                        {cfg?.minActionDelay ? `${cfg.minActionDelay}-${cfg.maxActionDelay}` : "全局"}
                      </td>
                      <td className="text-center py-2 px-2">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => startEdit(room.id)}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-[10px] hover:bg-blue-500/30">
                            配置
                          </button>
                          {cfg && (
                            <button onClick={() => deleteConfig.mutate({ roomId: room.id })}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] hover:bg-red-500/30">
                              重置
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无公共房间</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• 点击"配置"为该场次设置独立的Bot参数，未配置的场次使用全局设置</p>
        <p>• Bot数量：该场次固定分配的Bot数量（不受真人数量影响）</p>
        <p>• 弃牌率/延迟：留空表示使用全局配置值</p>
      </div>
    </div>
  );
}


// Merged Bot Detail Table with Behavior Metrics
function BotDetailTableMerged({ botDetails, formState }: { botDetails: any[]; formState: any }) {
  const { data: metrics } = trpc.adminBot.behaviorMetrics.useQuery(undefined, { refetchInterval: 30000 });
  
  // Build metrics map by bot id
  const metricsMap = new Map<number, any>();
  if (metrics) {
    for (const m of metrics) {
      metricsMap.set(m.id, m);
    }
  }

  // Derive style label
  function getStyleLabel(vpip: number, pfr: number): string {
    let style = "";
    if (vpip < 20) style = "极紧";
    else if (vpip < 30) style = "紧凑";
    else if (vpip < 45) style = "标准";
    else if (vpip < 60) style = "松散";
    else style = "极松";
    if (pfr > vpip * 0.7) style += "/激进";
    else if (pfr < vpip * 0.3) style += "/被动";
    else style += "/平衡";
    return style;
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">机器人数据统计（含行为指标）</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">名称</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">状态</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">余额</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">总手数</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">胜率</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">总盈亏</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">今日盈亏</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">VPIP</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">PFR</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">激进度</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">风格</th>
            </tr>
          </thead>
          <tbody>
            {botDetails.map((bot: any) => {
              const m = metricsMap.get(bot.id);
              const vpip = m ? parseFloat(m.vpip) : 0;
              const pfr = m ? parseFloat(m.pfr) : 0;
              const aggression = m ? m.aggressionFactor : "0.0";
              const style = m ? getStyleLabel(vpip, pfr) : "-";
              return (
                <tr key={bot.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                        <span className="text-[10px] text-gold font-bold">B</span>
                      </div>
                      <span className="font-medium text-foreground">{bot.name}</span>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${bot.isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${bot.isOnline ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      {bot.isOnline ? `房间${bot.currentRoom}` : "空闲"}
                    </span>
                  </td>
                  <td className={`text-right py-2 px-2 font-mono ${bot.balance < (formState.balanceAlertThreshold ?? 500) ? "text-red-400 font-bold" : "text-foreground"}`}>
                    ${bot.balance.toFixed(0)}
                  </td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{bot.totalHands}</td>
                  <td className="text-right py-2 px-2 text-foreground">{bot.winRate}%</td>
                  <td className={`text-right py-2 px-2 font-mono ${parseFloat(bot.totalProfit) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {parseFloat(bot.totalProfit) >= 0 ? "+" : ""}{bot.totalProfit}
                  </td>
                  <td className={`text-right py-2 px-2 font-mono ${parseFloat(bot.todayProfit) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {parseFloat(bot.todayProfit) >= 0 ? "+" : ""}{bot.todayProfit}
                  </td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m ? `${m.vpip}%` : "-"}</td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m ? `${m.pfr}%` : "-"}</td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{m ? `${aggression}%` : "-"}</td>
                  <td className="text-center py-2 px-2">
                    {m ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold/20 text-gold">{style}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {botDetails.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无统计数据</p>
        )}
      </div>
      <div className="mt-3 text-xs text-muted-foreground space-y-1">
        <p>• <span className="text-foreground">VPIP</span>（主动入池率）：翻前主动投入筹码的比例，真人一般20-35%</p>
        <p>• <span className="text-foreground">PFR</span>（翻前加注率）：翻前加注的比例，真人一般15-25%</p>
        <p>• <span className="text-foreground">激进度</span>：加注/All-in占总操作的比例</p>
      </div>
    </div>
  );
}
