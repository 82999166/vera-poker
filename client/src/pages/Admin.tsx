import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";

import {
  Settings, Users, DollarSign, Shield, BarChart3, Save, RefreshCw,
  Plus, Trash2, ArrowLeft, UserCheck, Pause, Play, X, MessageSquare,
  Globe, LogOut, PanelLeft, Layers, Copy, Check, Eye, EyeOff, LogIn, Pencil
} from "lucide-react";
import { toast } from "sonner";

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
    "rooms.status": "状态",
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
    "settings.supportedLangs": "支持语言列表",
    "settings.saved": "设置已保存！",
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
    "config.catGame": "游戏设置",
    "config.catAgent": "代理系统",
    "config.catFinance": "财务设置",
    "config.catRisk": "风控设置",
    "config.catRoom": "私人房设置",
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold/20">
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.97]"
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
type AdminTab = "config" | "users" | "rooms" | "finance" | "risk" | "agents" | "faq" | "settings" | "stats" | "staff";

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
    super_admin: ["config", "users", "rooms", "finance", "agents", "risk", "faq", "settings", "stats", "staff"],
    admin: ["config", "users", "rooms", "finance", "agents", "risk", "faq", "settings", "stats", "staff"],
    cs: ["users", "rooms", "faq", "stats"],
    finance: ["finance", "agents", "stats"],
    tech: ["config", "rooms", "risk", "settings", "stats"],
  };
  const allowedTabs = roleTabMap[effectiveRole] || ["stats"];

  const allTabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: "config", icon: Settings, label: at("tab.config") },
    { key: "users", icon: Users, label: at("tab.users") },
    { key: "rooms", icon: Layers, label: at("tab.rooms") },
    { key: "finance", icon: DollarSign, label: at("tab.finance") },
    { key: "agents", icon: UserCheck, label: at("tab.agents") },
    { key: "risk", icon: Shield, label: at("tab.risk") },
    { key: "faq", icon: MessageSquare, label: at("tab.faq") },
    { key: "settings", icon: Settings, label: at("tab.settings") },
    { key: "stats", icon: BarChart3, label: at("tab.stats") },
    { key: "staff", icon: Shield, label: at("tab.staff") },
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
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center">
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center">
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
    withdrawal_fee_rate: "提现手续费率 (%)",
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
  };

  const configGroups: Record<string, string[]> = {
    [at("config.gameSettings")]: ["rake_percentage", "rake_cap", "min_players_to_start", "turn_timeout_seconds", "max_players_per_table"],
    [at("config.agentSystem")]: ["agent_level1_rate", "agent_level2_rate", "unlock_min_hands", "unlock_min_deposit", "unlock_min_rake", "max_daily_commission"],
    [at("config.finance")]: ["min_deposit", "min_withdrawal", "auto_approve_limit", "withdrawal_fee_rate", "daily_withdrawal_limit"],
    [at("config.riskControl")]: ["min_account_age_days", "observation_period_days", "max_same_table_ratio"],
    [at("config.privateRoom")]: ["room_fee_micro", "room_fee_low", "room_fee_mid", "room_fee_high", "room_fee_premium", "discount_5_rounds", "discount_10_rounds", "discount_20_rounds", "discount_50_rounds"],
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
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <label className="text-xs text-muted-foreground sm:w-48 shrink-0">{configLabels[key] || config?.label || key}</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 glass rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-gold"
                    />
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
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 text-[10px] text-muted-foreground font-medium">
        <span>{at("users.colUser")}</span>
        <span className="text-right w-28">{at("users.colLastLogin")}</span>
        <span className="text-right w-16">{at("users.colBalance")}</span>
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
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
              {/* User info */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center">
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">#{u.id}{u.tgUsername ? ` @${u.tgUsername}` : ""}</span>
                    {u.lastIp && <span className="text-[9px] text-muted-foreground/60 font-mono">{u.lastIp}</span>}
                  </div>
                </div>
              </div>
              {/* Last login - full date + time */}
              <span className="text-[10px] text-muted-foreground text-right w-28 shrink-0">
                {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
              </span>
              {/* Balance */}
              <span className="text-sm font-mono text-gold text-right w-16 shrink-0">${u.balance ?? "0.00"}</span>
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
  const [activeTab, setActiveTab] = useState<"info" | "deposits" | "withdrawals" | "games">("info");
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
  const { data: gameData } = trpc.admin.userGameHistory.useQuery(
    { userId: stableUserId, page: 1, limit: 50 },
    { enabled: activeTab === "games", staleTime: 30_000 }
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
    { key: "games" as const, label: at("users.gamesTab") },
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
              <p className="text-xs text-muted-foreground">{at("users.balance")}: <span className="text-gold font-mono">${(user as any).balance}</span></p>
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
              <InfoCard label={at("users.balance")} value={`$${(user as any).balance}`} color="text-gold" />
              <InfoCard label={at("users.colBalance")} value={`$${(user as any).frozenBalance}`} color="text-orange-400" />
              <InfoCard label={at("users.totalDeposited")} value={`$${(user as any).financialSummary?.totalDeposited}`} color="text-emerald-400" />
              <InfoCard label={at("users.totalWithdrawn")} value={`$${(user as any).financialSummary?.totalWithdrawn}`} color="text-red-400" />
              <InfoCard label={at("users.totalHands")} value={`$${(user as any).financialSummary?.totalBets}`} color="text-blue-400" />
              <InfoCard label={at("users.winRate")} value={`$${(user as any).financialSummary?.netProfit}`} color={parseFloat((user as any).financialSummary?.netProfit ?? "0") >= 0 ? "text-emerald-400" : "text-red-400"} />
              <InfoCard label={at("finance.rake")} value={`$${(user as any).financialSummary?.totalRake}`} color="text-purple-400" />
              <InfoCard label={at("finance.commission")} value={`$${(user as any).agentInfo?.totalCommission}`} color="text-amber-400" />
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
                    <span className="text-xs font-medium text-emerald-400">+${tx.amount}</span>
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
                  <span className="text-xs font-medium text-red-400">-${tx.amount}</span>
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

      {/* Games Tab */}
      {activeTab === "games" && (
        <div className="space-y-2">
          {(gameData as any)?.games?.length > 0 ? (
            (gameData as any).games.map((g: any) => (
              <div key={g.handId} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{g.roomName}</span>
                  <span className={`text-xs font-mono ${parseFloat(g.pnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {parseFloat(g.pnl) >= 0 ? "+" : ""}${g.pnl}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span>{at("finance.amount")}: ${g.betAmount} | {at("users.totalWins")}: ${g.winAmount}</span>
                  <div>{g.completedAt ? new Date(g.completedAt).toLocaleString() : "-"}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{at("users.noGames")}</p>
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
  const { data, isLoading, refetch } = trpc.rooms.adminList.useQuery({ page: 1, limit: 50 });
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const updateMutation = trpc.rooms.adminUpdate.useMutation({
    onSuccess: () => { toast.success(at("rooms.updated")); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.rooms.adminDelete.useMutation({
    onSuccess: () => { toast.success(at("rooms.deleted")); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const rooms = (data as any)?.rooms ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{at("rooms.title")}</h2>
        <button onClick={() => { setEditRoom(null); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold text-black text-sm font-bold hover:bg-gold/90">
          <Plus className="w-4 h-4" /> {at("rooms.create")}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rooms.map((r: any) => (
          <div key={r.id} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{r.name}</span>
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
              {r.inviteCode && <span>{at("rooms.inviteCode")}: <code className="font-mono text-gold">{r.inviteCode}</code></span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setEditRoom(r); setShowModal(true); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-truth-blue/10 text-truth-blue text-xs font-medium hover:bg-truth-blue/20">
                <Pencil className="w-3 h-3" /> {at("rooms.edit")}
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
      {rooms.length === 0 && (
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
                <span className="text-sm font-mono font-medium">${tx.amount}</span>
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
                <div className="text-lg font-bold text-gold">${approveDialog.amount}</div>
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
                  <span className="text-[8px] text-muted-foreground">${parseFloat(d.total || "0").toFixed(0)}</span>
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
          <span className="text-xs text-muted-foreground">{at("finance.rakeAvg")}: ${summary.avgRake}</span>
        </div>
        <div className="space-y-2">
          {records.length > 0 ? records.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div>
                <span className="text-xs font-medium">#{r.handNumber}</span>
                <span className="text-[10px] text-muted-foreground ml-2">Room #{r.roomId}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gold">${parseFloat(r.rakeAmount || "0").toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground ml-2">/ ${parseFloat(r.potSize || "0").toFixed(2)}</span>
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
  const { data: agentData, isLoading } = trpc.admin.agents.useQuery({ page: 1, limit: 50 });
  const { data: commissionData } = trpc.admin.commissions.useQuery({ page: 1, limit: 20 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const relationships = (agentData as any)?.relationships ?? [];
  const commissions = (commissionData as any)?.records ?? [];

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
          <div className="space-y-2">
            {relationships.map((rel: any) => (
              <div key={rel.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium">{at("common.agent")} #{rel.agentId}</span>
                  <span className="text-xs text-muted-foreground ml-2">→ #{rel.downlineId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    rel.level === 1 ? "bg-gold/20 text-gold" : "bg-truth-blue/20 text-truth-blue"
                  }`}>L{rel.level}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    rel.isUnlocked ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                  }`}>{rel.isUnlocked ? at("agents.unlocked") : at("agents.pending")}</span>
                </div>
              </div>
            ))}
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
                  <span className="text-sm font-mono text-gold">${c.amount}</span>
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
  const { data: events, isLoading } = trpc.admin.riskEvents.useQuery({ page: 1, limit: 20 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const riskEvents = (events as any)?.events ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("risk.title")}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-danger mb-2" />
          <p className="text-xs font-semibold">{at("risk.flagged")}</p>
          <p className="text-xl font-bold text-danger mt-1">{riskEvents.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-warning mb-2" />
          <p className="text-xs font-semibold">{at("risk.antiAbuse")}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{at("risk.layers")}</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("risk.rules")}</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>{at("risk.regGate")}</span>
            <span className="text-success font-medium">{at("risk.active")}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>{at("risk.deviceFp")}</span>
            <span className="text-success font-medium">{at("risk.active")}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>{at("risk.behavior")}</span>
            <span className="text-success font-medium">{at("risk.active")}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span>{at("risk.sameTable")}</span>
            <span className="text-success font-medium">{at("risk.active")}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">{at("risk.configHint")}</p>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("risk.log")}</h3>
        {riskEvents.length > 0 ? (
          <div className="space-y-2">
            {riskEvents.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium text-danger">{e.eventType}</span>
                  <span className="text-xs text-muted-foreground ml-2">{at("common.user")} #{e.userId}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{at("risk.noEvents")}</p>
        )}
      </div>
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

  useEffect(() => {
    if (configs) {
      const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c.value]) ?? []);
      setMaintenanceMode(configMap.get("maintenance_mode") === "true");
      setDefaultLanguage(configMap.get("default_language") ?? "en");
      setTgBotToken(configMap.get("tg_bot_token") ?? "");
      setTgBotUsername(configMap.get("tg_bot_username") ?? "");
      setTgClientId(configMap.get("tg_client_id") ?? "");
      setTgClientSecret(configMap.get("tg_client_secret") ?? "");
    }
  }, [configs]);

  const saveSystemSetting = (key: string, value: string) => {
    // tg_bot_username needs to be public for frontend Login Widget
    const isPublic = key === "tg_bot_username";
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
              <TrendChart data={trends?.dailyUsers ?? []} dataKey="count" color="oklch(0.82 0.15 85)" label={at("stats.users")} noDataText={at("common.noData")} />
            </div>
            {/* Daily Volume Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyVolume")}</p>
              <TrendChart data={trends?.dailyVolume ?? []} dataKey="volume" color="oklch(0.72 0.15 155)" label={at("stats.volume")} isVolume noDataText={at("common.noData")} />
            </div>
            {/* Daily Hands Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyHands")}</p>
              <TrendChart data={trends?.dailyHands ?? []} dataKey="count" color="oklch(0.7 0.15 250)" label={at("stats.hands")} noDataText={at("common.noData")} />
            </div>
            {/* Daily Rake Chart */}
            <div className="glass rounded-xl p-4 border border-gold/10">
              <p className="text-xs font-medium text-gold mb-3">{at("finance.rakeTrend")}</p>
              <TrendChart data={(trends as any)?.dailyRake ?? []} dataKey="total" color="oklch(0.82 0.15 85)" label={at("finance.rakeTotal")} isVolume noDataText={at("common.noData")} />
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
          {isVolume ? `$${latestVal.toFixed(2)}` : latestVal}
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
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("已复制");
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
