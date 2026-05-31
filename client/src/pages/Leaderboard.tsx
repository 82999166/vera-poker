import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatBalance } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Trophy, TrendingUp, Gamepad2, Crown, Medal, Award } from "lucide-react";

type TabKey = "profit" | "winRate" | "hands" | "tournament";

export default function Leaderboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("profit");
  const [tourneySubTab, setTourneySubTab] = useState<"champions" | "prize">("champions");

  const { data: profitData, isLoading: profitLoading } = trpc.leaderboard.profit.useQuery({ limit: 20 });
  const { data: winRateData, isLoading: winRateLoading } = trpc.leaderboard.winRate.useQuery({ limit: 20, minHands: 10 });
  const { data: handsData, isLoading: handsLoading } = trpc.leaderboard.handsPlayed.useQuery({ limit: 20 });
  const { data: tourneyData, isLoading: tourneyLoading } = trpc.tournaments.leaderboard.useQuery();

  const tabs = [
    { key: "profit" as const, label: t("leaderboard.profit"), icon: TrendingUp },
    { key: "winRate" as const, label: t("leaderboard.winRate"), icon: Trophy },
    { key: "hands" as const, label: t("leaderboard.hands"), icon: Gamepad2 },
    { key: "tournament" as const, label: t("leaderboard.tournament"), icon: Award },
  ];

  const isLoading = activeTab === "profit" ? profitLoading : activeTab === "winRate" ? winRateLoading : activeTab === "hands" ? handsLoading : tourneyLoading;
  const data = activeTab === "profit" ? profitData : activeTab === "winRate" ? winRateData : activeTab === "hands" ? handsData : null;

  return (
    <div className="min-h-screen bg-deep-space pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">{t("leaderboard.title")}</h1>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="glass rounded-xl p-1 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-gold/10 text-gold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Sub-tabs */}
      {activeTab === "tournament" && (
        <div className="px-4 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTourneySubTab("champions")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                tourneySubTab === "champions"
                  ? "bg-gold text-background"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown className="w-3 h-3 inline mr-1" />
              {t("leaderboard.champions")}
            </button>
            <button
              onClick={() => setTourneySubTab("prize")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                tourneySubTab === "prize"
                  ? "bg-gold text-background"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-3 h-3 inline mr-1" />
              {t("leaderboard.totalPrize")}
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "tournament" ? (
          <TournamentLeaderboard
            data={tourneyData}
            subTab={tourneySubTab}
            userId={user?.id}
          />
        ) : !data || data.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("common.error")}</p>
            {activeTab === "winRate" && (
              <p className="text-xs text-muted-foreground mt-1">{t("leaderboard.minHandsHint")}</p>
            )}
          </div>
        ) : (
          data.map((entry: any, index: number) => (
            <LeaderboardRow
              key={entry.userId}
              rank={index + 1}
              name={entry.nickname || entry.name || `Player ${entry.userId}`}
              avatar={entry.avatar}
              value={getDisplayValue(activeTab as "profit" | "winRate" | "hands", entry)}
              subValue={getSubValue(activeTab as "profit" | "winRate" | "hands", entry, t("leaderboard.handsUnit"))}
              isMe={entry.userId === user?.id}
              youLabel={t("leaderboard.you")}
            />
          ))
        )}
      </div>

      <BottomNav active="lobby" />
    </div>
  );
}

function TournamentLeaderboard({ data, subTab, userId }: {
  data: any;
  subTab: "champions" | "prize";
  userId?: number;
}) {
  const { t } = useI18n();

  if (!data) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t("leaderboard.noData")}</p>
      </div>
    );
  }

  const list = subTab === "champions" ? data.champions : data.prizeLeaders;

  if (!list || list.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t("leaderboard.noData")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((entry: any, index: number) => (
        <div
          key={entry.userId}
          className={`glass rounded-xl p-3 flex items-center gap-3 ${
            entry.userId === userId ? "ring-1 ring-gold/30" : ""
          }`}
        >
          <div className="w-8 flex items-center justify-center shrink-0">
            {index === 0 ? <Crown className="w-5 h-5 text-gold" /> :
             index === 1 ? <Medal className="w-5 h-5 text-gray-300" /> :
             index === 2 ? <Medal className="w-5 h-5 text-amber-600" /> :
             <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>}
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center overflow-hidden shrink-0">
            {entry.avatar ? (
              <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-gold">
                {(entry.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {entry.name || `Player ${entry.userId}`}
              {entry.userId === userId && <span className="text-[10px] text-gold ml-1">{t("leaderboard.you")}</span>}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {subTab === "champions"
                ? `${t("leaderboard.totalPrize")}: ${formatBalance(entry.totalPrize || "0")} USDT`
                : `${t("leaderboard.tournamentsPlayed")}: ${entry.tournaments} | ${t("leaderboard.bestRank")}: #${entry.bestRank}`
              }
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gold">
              {subTab === "champions"
                ? `${entry.wins}${t("leaderboard.winsUnit")}`
                : `${formatBalance(entry.totalPrize || "0")}`
              }
            </p>
            {subTab === "champions" && (
              <p className="text-[10px] text-muted-foreground">{t("leaderboard.championships")}</p>
            )}
            {subTab === "prize" && (
              <p className="text-[10px] text-muted-foreground">USDT</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getDisplayValue(tab: "profit" | "winRate" | "hands", entry: any): string {
  switch (tab) {
    case "profit": return `${parseFloat(entry.totalProfit) >= 0 ? "+" : ""}${formatBalance(entry.totalProfit)}`;
    case "winRate": return `${entry.winRate}%`;
    case "hands": return String(entry.totalHands);
  }
}

function getSubValue(tab: "profit" | "winRate" | "hands", entry: any, handsUnit: string): string {
  switch (tab) {
    case "profit": return `${entry.totalHands} ${handsUnit}`;
    case "winRate": return `${entry.totalHands} ${handsUnit}`;
    case "hands": return "";
  }
}

function LeaderboardRow({ rank, name, avatar, value, subValue, isMe, youLabel }: {
  rank: number;
  name: string;
  avatar: string | null;
  value: string;
  subValue: string;
  isMe: boolean;
  youLabel: string;
}) {
  const getRankIcon = () => {
    if (rank === 1) return <Crown className="w-5 h-5 text-gold" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{rank}</span>;
  };

  return (
    <div className={`glass rounded-xl p-3 flex items-center gap-3 ${isMe ? "ring-1 ring-gold/30" : ""}`}>
      <div className="w-8 flex items-center justify-center shrink-0">
        {getRankIcon()}
      </div>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center overflow-hidden shrink-0">
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-gold">{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {name}
          {isMe && <span className="text-[10px] text-gold ml-1">{youLabel}</span>}
        </p>
        {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${value.startsWith("+") ? "text-success" : value.startsWith("-") ? "text-red-400" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
