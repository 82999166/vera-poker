import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, GitBranch, Coins } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Hand ranking data: cards shown as mini card symbols
const HAND_RANKS = [
  {
    key: "rank1",
    cards: [
      { r: "A", s: "♥", red: true },
      { r: "K", s: "♥", red: true },
      { r: "Q", s: "♥", red: true },
      { r: "J", s: "♥", red: true },
      { r: "10", s: "♥", red: true },
    ],
    color: "from-yellow-500/30 to-amber-600/20",
    badge: "bg-yellow-500 text-black",
    num: "1",
  },
  {
    key: "rank2",
    cards: [
      { r: "Q", s: "♠", red: false },
      { r: "J", s: "♠", red: false },
      { r: "10", s: "♠", red: false },
      { r: "9", s: "♠", red: false },
      { r: "8", s: "♠", red: false },
    ],
    color: "from-purple-500/20 to-purple-800/10",
    badge: "bg-purple-500 text-white",
    num: "2",
  },
  {
    key: "rank3",
    cards: [
      { r: "5", s: "♣", red: false },
      { r: "5", s: "♠", red: false },
      { r: "5", s: "♥", red: true },
      { r: "5", s: "♦", red: true },
      { r: "2", s: "♠", red: false },
    ],
    color: "from-blue-500/20 to-blue-800/10",
    badge: "bg-blue-500 text-white",
    num: "3",
  },
  {
    key: "rank4",
    cards: [
      { r: "K", s: "♥", red: true },
      { r: "K", s: "♠", red: false },
      { r: "K", s: "♣", red: false },
      { r: "5", s: "♥", red: true },
      { r: "5", s: "♠", red: false },
    ],
    color: "from-cyan-500/20 to-cyan-800/10",
    badge: "bg-cyan-500 text-white",
    num: "4",
  },
  {
    key: "rank5",
    cards: [
      { r: "A", s: "♠", red: false },
      { r: "J", s: "♠", red: false },
      { r: "8", s: "♠", red: false },
      { r: "3", s: "♠", red: false },
      { r: "2", s: "♠", red: false },
    ],
    color: "from-green-500/20 to-green-800/10",
    badge: "bg-green-500 text-white",
    num: "5",
  },
  {
    key: "rank6",
    cards: [
      { r: "Q", s: "♠", red: false },
      { r: "J", s: "♣", red: false },
      { r: "10", s: "♦", red: true },
      { r: "9", s: "♥", red: true },
      { r: "8", s: "♠", red: false },
    ],
    color: "from-teal-500/20 to-teal-800/10",
    badge: "bg-teal-500 text-white",
    num: "6",
  },
  {
    key: "rank7",
    cards: [
      { r: "Q", s: "♥", red: true },
      { r: "Q", s: "♠", red: false },
      { r: "Q", s: "♦", red: true },
      { r: "9", s: "♠", red: false },
      { r: "5", s: "♣", red: false },
    ],
    color: "from-orange-500/20 to-orange-800/10",
    badge: "bg-orange-500 text-white",
    num: "7",
  },
  {
    key: "rank8",
    cards: [
      { r: "K", s: "♥", red: true },
      { r: "K", s: "♠", red: false },
      { r: "J", s: "♦", red: true },
      { r: "J", s: "♣", red: false },
      { r: "9", s: "♠", red: false },
    ],
    color: "from-rose-500/20 to-rose-800/10",
    badge: "bg-rose-500 text-white",
    num: "8",
  },
  {
    key: "rank9",
    cards: [
      { r: "A", s: "♥", red: true },
      { r: "A", s: "♠", red: false },
      { r: "10", s: "♦", red: true },
      { r: "7", s: "♣", red: false },
      { r: "2", s: "♠", red: false },
    ],
    color: "from-pink-500/20 to-pink-800/10",
    badge: "bg-pink-500 text-white",
    num: "9",
  },
  {
    key: "rank10",
    cards: [
      { r: "A", s: "♠", red: false },
      { r: "7", s: "♦", red: true },
      { r: "5", s: "♣", red: false },
      { r: "3", s: "♥", red: true },
      { r: "2", s: "♠", red: false },
    ],
    color: "from-slate-500/20 to-slate-800/10",
    badge: "bg-slate-500 text-white",
    num: "10",
  },
];

const GAME_FLOW = [
  { key: "flow1", icon: "🃏", color: "bg-blue-500/20 border-blue-500/40" },
  { key: "flow2", icon: "🎴", color: "bg-green-500/20 border-green-500/40" },
  { key: "flow3", icon: "🔄", color: "bg-yellow-500/20 border-yellow-500/40" },
  { key: "flow4", icon: "🌊", color: "bg-cyan-500/20 border-cyan-500/40" },
  { key: "flow5", icon: "🏆", color: "bg-purple-500/20 border-purple-500/40" },
];

const ACTIONS = [
  { key: "actionFold", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "✕" },
  { key: "actionCheck", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "✓" },
  { key: "actionCall", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "=" },
  { key: "actionRaise", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: "↑" },
  { key: "actionAllin", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "★" },
];

const SETTLEMENT = [
  { key: "settlementPot", icon: "🏆" },
  { key: "settlementSplit", icon: "⚖️" },
  { key: "settlementSidePot", icon: "➕" },
  { key: "settlementRake", icon: "💰" },
  { key: "settlementShowOrder", icon: "👁️" },
];

// Mini card component for hand ranking display
function MiniCard({ r, s, red }: { r: string; s: string; red: boolean }) {
  return (
    <div className="flex flex-col items-center justify-between bg-white rounded-[3px] px-0.5 py-0.5 w-[26px] h-[36px] shadow-sm border border-gray-200/50 flex-shrink-0">
      <span className={`text-[10px] font-bold leading-none ${red ? "text-red-600" : "text-gray-900"}`}>{r}</span>
      <span className={`text-[14px] leading-none ${red ? "text-red-600" : "text-gray-900"}`}>{s}</span>
    </div>
  );
}

type Tab = "rankings" | "flow" | "settlement";

export default function Tutorial() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("rankings");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-strong px-4 py-3 flex items-center gap-3 z-10 sticky top-0 safe-top">
        <button onClick={() => navigate(-1 as never)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1 text-center">{t("tutorial.title")}</h1>
        <div className="w-5" />
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border/50 sticky top-[52px] bg-background z-10">
        {([
          { id: "rankings" as Tab, label: t("tutorial.handRankings"), icon: <Trophy className="w-3.5 h-3.5" /> },
          { id: "flow" as Tab, label: t("tutorial.gameFlow"), icon: <GitBranch className="w-3.5 h-3.5" /> },
          { id: "settlement" as Tab, label: t("tutorial.settlement"), icon: <Coins className="w-3.5 h-3.5" /> },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
              tab === id
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {/* Hand Rankings Tab */}
        {tab === "rankings" && (
          <div className="px-4 py-4 space-y-2">
            <p className="text-xs text-muted-foreground text-center mb-4">
              {t("tutorial.handRankings")} — 由强到弱
            </p>
            {HAND_RANKS.map((rank) => (
              <div
                key={rank.key}
                className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${rank.color} border border-white/10`}
              >
                {/* Rank number badge */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rank.badge}`}>
                  {rank.num}
                </div>

                {/* Mini cards */}
                <div className="flex gap-0.5 flex-shrink-0">
                  {rank.cards.map((c, i) => (
                    <MiniCard key={i} r={c.r} s={c.s} red={c.red} />
                  ))}
                </div>

                {/* Name + desc */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight">{t(`tutorial.${rank.key}`)}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{t(`tutorial.${rank.key}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Game Flow Tab */}
        {tab === "flow" && (
          <div className="px-4 py-4 space-y-4">
            {/* Flow steps */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500 via-green-500 to-purple-500 opacity-40" />

              <div className="space-y-3">
                {GAME_FLOW.map((step, i) => (
                  <div key={step.key} className={`flex gap-3 p-3 rounded-xl border ${step.color}`}>
                    <div className="w-10 h-10 rounded-full bg-background/50 flex items-center justify-center text-xl flex-shrink-0 z-10">
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">第 {i + 1} 阶段</span>
                        <span className="text-sm font-bold text-foreground">{t(`tutorial.${step.key}Title`)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`tutorial.${step.key}Desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Betting Actions */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                {t("tutorial.actions")}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {ACTIONS.map((action) => (
                  <div key={action.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${action.color}`}>
                    <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {action.icon}
                    </span>
                    <span className="text-sm">{t(`tutorial.${action.key}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settlement Tab */}
        {tab === "settlement" && (
          <div className="px-4 py-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-gold rounded-full" />
              {t("tutorial.settlementTitle")}
            </h3>
            {SETTLEMENT.map((item) => (
              <div key={item.key} className="flex gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <p className="text-sm text-foreground leading-relaxed">{t(`tutorial.${item.key}`)}</p>
              </div>
            ))}

            {/* Showdown order illustration */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-gold/10 to-amber-600/5 border border-gold/20">
              <h4 className="text-sm font-bold text-gold mb-3">亮牌顺序示意</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>河牌圈最后下注/加注者</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>跟注者（按顺时针顺序）</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>若所有人过牌，庄家左边先亮</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-[10px]">★</span>
                  <span>手牌不如已亮牌者可选择不亮牌（Muck）</span>
                </div>
              </div>
            </div>

            {/* Rake note */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
              💡 <strong>抽水说明：</strong>平台从每个底池中按比例收取少量手续费（Rake），具体比例在游戏设置中可查看。抽水上限（Rake Cap）保护大底池玩家不被过度收费。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
