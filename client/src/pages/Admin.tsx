import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import { getLoginUrl } from "@/const";
import {
  Settings, Users, DollarSign, Shield, BarChart3, Save, RefreshCw,
  Plus, Trash2, ArrowLeft, UserCheck, Pause, Play, X, MessageSquare,
  Globe, LogOut, PanelLeft, Layers, Copy, Check
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

// ==================== ADMIN TABS ====================
type AdminTab = "config" | "users" | "rooms" | "finance" | "risk" | "agents" | "faq" | "settings" | "stats" | "staff";

// ==================== MAIN ADMIN COMPONENT ====================
export default function Admin() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("config");
  const isMobile = useIsMobile();
  const { lang, changeLang, at } = useAdminLang();

  // Unauthenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm p-8">
          <Shield className="w-12 h-12 text-gold mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{at("admin.signIn")}</h2>
          <p className="text-muted-foreground mb-6">{at("admin.signInDesc")}</p>
          <div className="space-y-3">
            <button
              onClick={() => { navigate("/staff-login"); }}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold"
            >
              员工登录
            </button>
            <button
              onClick={() => { window.location.href = getLoginUrl(); }}
              className="w-full px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-gold/50 transition-all"
            >
              {at("admin.signInBtn")} (OAuth)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const staffRoles = ["admin", "cs", "finance", "tech"];
  if (!staffRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{at("admin.accessDenied")}</h2>
          <p className="text-muted-foreground">{at("admin.accessDeniedDesc")}</p>
        </div>
      </div>
    );
  }

  // Role-based tab permissions
  const roleTabMap: Record<string, AdminTab[]> = {
    admin: ["config", "users", "rooms", "finance", "agents", "risk", "faq", "settings", "stats", "staff"],
    cs: ["users", "rooms", "faq", "stats"],
    finance: ["finance", "agents", "stats"],
    tech: ["config", "rooms", "risk", "settings", "stats"],
  };
  const allowedTabs = roleTabMap[user.role] || [];

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
                  <span className="text-xs font-bold text-gold">{user.name?.charAt(0) || "A"}</span>
                </div>
                <span className="text-xs font-medium truncate max-w-[100px]">{user.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => navigate("/lobby")} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title={at("admin.back")}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={logout} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-danger" title="Logout">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">
            <PanelContent tab={activeTab} at={at} />
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
            <button onClick={() => navigate("/lobby")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary">
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
        <PanelContent tab={activeTab} at={at} />
      </main>
    </div>
  );
}

// ==================== PANEL CONTENT ROUTER ====================
function PanelContent({ tab, at }: { tab: AdminTab; at: (key: string) => string }) {
  switch (tab) {
    case "config": return <ConfigPanel at={at} />;
    case "users": return <UsersPanel at={at} />;
    case "rooms": return <RoomsPanel at={at} />;
    case "finance": return <FinancePanel at={at} />;
    case "agents": return <AgentsPanel at={at} />;
    case "risk": return <RiskPanel at={at} />;
    case "faq": return <FaqPanel at={at} />;
    case "settings": return <SystemSettingsPanel at={at} />;
    case "stats": return <StatsPanel at={at} />;
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
    [at("config.finance")]: ["min_deposit", "min_withdrawal", "withdrawal_fee_rate", "daily_withdrawal_limit"],
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
  const { data, isLoading } = trpc.admin.users.useQuery({ page: 1, limit: 50 });
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => toast.success(at("users.updated")),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const users = (data as any)?.users ?? data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("users.title")}</h2>
      <div className="space-y-2">
        {(users as any[])?.map((u: any) => (
          <div key={u.id} className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{u.name || "Anonymous"}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  u.role === "admin" ? "bg-gold/20 text-gold" : "bg-secondary text-muted-foreground"
                }`}>{u.role}</span>
              </div>
              <span className="text-sm font-mono text-gold">${u.balance ?? "0.00"}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  u.riskLevel === "normal" ? "bg-success/20 text-success" :
                  u.riskLevel === "watch" ? "bg-warning/20 text-warning" :
                  "bg-danger/20 text-danger"
                }`}>{u.riskLevel ?? "normal"}</span>
                <span className="text-[10px] text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</span>
              </div>
              <select
                defaultValue={u.riskLevel ?? "normal"}
                onChange={(e) => updateMutation.mutate({ id: u.id, riskLevel: e.target.value as any })}
                className="glass rounded px-2 py-1 text-[10px] bg-transparent outline-none"
              >
                <option value="normal">{at("users.normal")}</option>
                <option value="watch">{at("users.watch")}</option>
                <option value="frozen">{at("users.frozen")}</option>
                <option value="banned">{at("users.banned")}</option>
              </select>
            </div>
          </div>
        ))}
        {((users as any[])?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{at("users.noUsers")}</p>
        )}
      </div>
    </div>
  );
}

// ==================== ROOMS PANEL ====================
function RoomsPanel({ at }: { at: (k: string) => string }) {
  const { data, isLoading, refetch } = trpc.rooms.adminList.useQuery({ page: 1, limit: 50 });
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
      <h2 className="text-lg font-bold">{at("rooms.title")}</h2>
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
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.type === "public" ? "bg-truth-blue/20 text-truth-blue" : "bg-purple-500/20 text-purple-400"
              }`}>{r.type}</span>
              <span className="font-mono">${r.smallBlind}/${r.bigBlind}</span>
              <span>{r.currentPlayers}/{r.maxPlayers} {at("rooms.players")}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
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
    </div>
  );
}

// ==================== FINANCE PANEL ====================
function FinancePanel({ at }: { at: (k: string) => string }) {
  const { data: txData, isLoading } = trpc.wallet.allTransactions.useQuery({ page: 1, limit: 20 });
  const { data: stats } = trpc.admin.stats.useQuery();

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const transactions = (txData as any)?.transactions ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{at("finance.title")}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("finance.totalVolume")}</p>
          <p className="text-xl font-bold text-gold">${stats?.totalVolume ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("finance.totalTx")}</p>
          <p className="text-xl font-bold text-truth-blue">{stats?.totalTransactions ?? 0}</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">{at("finance.recentTx")}</h3>
        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className={`text-xs font-medium ${tx.type === "deposit" ? "text-success" : "text-danger"}`}>{tx.type}</span>
                  <span className="text-xs text-muted-foreground ml-2">{at("common.user")} #{tx.userId}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono">${tx.amount}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                    tx.status === "completed" ? "bg-success/20 text-success" :
                    tx.status === "pending" ? "bg-warning/20 text-warning" :
                    "bg-danger/20 text-danger"
                  }`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{at("finance.noTx")}</p>
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

  useEffect(() => {
    if (configs) {
      const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c.value]) ?? []);
      setMaintenanceMode(configMap.get("maintenance_mode") === "true");
      setDefaultLanguage(configMap.get("default_language") ?? "en");
      setTgBotToken(configMap.get("tg_bot_token") ?? "");
      setTgBotUsername(configMap.get("tg_bot_username") ?? "");
    }
  }, [configs]);

  const saveSystemSetting = (key: string, value: string) => {
    upsertMutation.mutate({ key, value, category: "system", label: key, valueType: "string", isPublic: false });
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
            <div className="flex gap-2">
              <input
                type="text"
                value={tgBotUsername}
                onChange={(e) => setTgBotUsername(e.target.value)}
                placeholder="@VeraPokerBot"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_bot_username", tgBotUsername)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{at("settings.botToken")}</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={tgBotToken}
                onChange={(e) => setTgBotToken(e.target.value)}
                placeholder="Enter bot token"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button onClick={() => saveSystemSetting("tg_bot_token", tgBotToken)} className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mini App & Webhook */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Mini App 配置</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mini App URL</label>
            <CopyableUrl value={window.location.origin} />
            <p className="text-[10px] text-muted-foreground mt-1">在 BotFather 中设置 Web App URL 为此地址</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Webhook URL</label>
            <CopyableUrl value={`${window.location.origin}/api/telegram/webhook`} />
            <p className="text-[10px] text-muted-foreground mt-1">在 BotFather 或 API 中设置 Webhook 为此地址</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">设置 Webhook 命令</label>
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
function StatsPanel({ at }: { at: (k: string) => string }) {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.admin.trends.useQuery({ days: 14 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">{at("stats.title")}</h2>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalUsers")}</p>
          <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalRooms")}</p>
          <p className="text-2xl font-bold text-truth-blue">{stats?.totalRooms ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalTx")}</p>
          <p className="text-2xl font-bold text-gold">{stats?.totalTransactions ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{at("stats.totalVolume")}</p>
          <p className="text-2xl font-bold text-success">${stats?.totalVolume ?? "0.00"}</p>
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
              <TrendChart data={trends?.dailyUsers ?? []} dataKey="count" color="oklch(0.82 0.15 85)" label={at("stats.users")} />
            </div>
            {/* Daily Volume Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyVolume")}</p>
              <TrendChart data={trends?.dailyVolume ?? []} dataKey="volume" color="oklch(0.72 0.15 155)" label={at("stats.volume")} isVolume />
            </div>
            {/* Daily Hands Chart */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{at("stats.dailyHands")}</p>
              <TrendChart data={trends?.dailyHands ?? []} dataKey="count" color="oklch(0.7 0.15 250)" label={at("stats.hands")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple trend chart using SVG (no external chart lib needed for this minimal display)
function TrendChart({ data, dataKey, color, label, isVolume }: { data: any[]; dataKey: string; color: string; label: string; isVolume?: boolean }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
        暂无数据
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
