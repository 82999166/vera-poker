import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { useState } from "react";
import { Users, Zap, Plus, DollarSign, Trophy, Lock, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type FilterLevel = "all" | "low" | "mid" | "high" | "vip";

export default function Lobby() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"cash" | "tourneys" | "private">("cash");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const { data: rooms, isLoading } = trpc.rooms.list.useQuery();
  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user });

  const filteredRooms = (rooms ?? []).filter(room => {
    // Filter by tab
    if (activeTab === "private" && room.type !== "private") return false;
    if (activeTab === "cash" && room.type === "private") return false;
    // Filter by level
    if (filterLevel === "all") return true;
    const bb = parseFloat(room.bigBlind);
    if (filterLevel === "low") return bb <= 0.10;
    if (filterLevel === "mid") return bb > 0.10 && bb <= 1;
    if (filterLevel === "high") return bb > 1 && bb <= 10;
    if (filterLevel === "vip") return bb > 10;
    return true;
  });

  const totalOnline = (rooms ?? []).reduce((sum, r) => sum + r.currentPlayers, 0);

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center">
              <span className="text-sm font-bold text-background">V</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Vera Poker</h1>
              <p className="text-xs text-muted-foreground">{t("app.slogan")}</p>
            </div>
          </div>
          <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold text-foreground">
              {walletData?.balance ?? "0.00"}
            </span>
          </div>
        </div>
      </header>

      {/* Balance Card */}
      <div className="px-4 pt-4">
        <div className="glass rounded-xl p-4 glow-gold">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("wallet.balance")}</p>
              <p className="text-2xl font-bold text-gold glow-text-gold">
                ${walletData?.balance ?? "0.00"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate("/wallet")} className="bg-gold text-background font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity">
                {t("wallet.deposit")}
              </button>
              <button onClick={() => navigate("/wallet")} className="glass text-foreground font-semibold px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">
                {t("wallet.withdraw")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 glass rounded-xl p-1">
          {(["cash", "tourneys", "private"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-gold text-background shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "cash" && <DollarSign className="w-4 h-4 inline mr-1" />}
              {tab === "tourneys" && <Trophy className="w-4 h-4 inline mr-1" />}
              {tab === "private" && <Lock className="w-4 h-4 inline mr-1" />}
              {t(`lobby.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          排行榜
        </button>
      </div>

      {/* Filter Pills */}
      <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1">
        {(["all", "low", "mid", "high", "vip"] as FilterLevel[]).map(level => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filterLevel === level
                ? "bg-truth-blue text-white glow-blue"
                : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`lobby.filter.${level}`)}
          </button>
        ))}
      </div>

      {/* My Recent Hands */}
      {user && <RecentHandsPreview />}

      {/* Room List */}
      <div className="flex-1 px-4 pt-3 pb-24 space-y-3">
        {activeTab === "private" && (
          <button
            onClick={() => navigate("/create-room")}
            className="w-full glass rounded-xl p-4 flex items-center justify-center gap-2 text-gold hover:glow-gold transition-all card-hover"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">{t("lobby.createRoom")}</span>
          </button>
        )}

        {/* Online counter */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground">{t("lobby.online", { count: totalOnline })}</span>
          </div>
          {activeTab === "cash" && filteredRooms.length > 0 && (
            <button
              onClick={() => {
                const available = filteredRooms.filter(r => r.currentPlayers < r.maxPlayers && r.status === "waiting");
                if (available.length > 0) navigate(`/table/${available[0].id}`);
                else if (filteredRooms.length > 0) navigate(`/table/${filteredRooms[0].id}`);
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-gold/20 text-gold text-xs font-medium hover:bg-gold/30 transition-all"
            >
              <Zap className="w-3 h-3" />
              {t("lobby.fast")}
            </button>
          )}
        </div>

        {/* Tournament placeholder */}
        {activeTab === "tourneys" && (
          <div className="glass rounded-xl p-6 text-center">
            <Trophy className="w-10 h-10 text-gold mx-auto mb-3 opacity-60" />
            <p className="text-sm text-muted-foreground">Coming Soon</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sit & Go / MTT tournaments</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t("lobby.noRooms")}</p>
          </div>
        ) : (
          filteredRooms.map(room => {
            const isFull = room.currentPlayers >= room.maxPlayers;
            const isPlaying = room.status === "playing";
            return (
              <div key={room.id} className="glass rounded-xl p-4 card-hover cursor-pointer" onClick={() => navigate(`/table/${room.id}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{room.name}</span>
                      {room.fairnessLevel === "high" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-truth-blue/20 text-truth-blue-bright">ON-CHAIN</span>
                      )}
                      {isPlaying && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">LIVE</span>
                      )}
                      {room.type === "private" && (
                        <Lock className="w-3 h-3 text-gold" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{t("lobby.blinds")}: ${room.smallBlind}/${room.bigBlind}</span>
                      <span>{t("lobby.buyIn")}: ${room.minBuyIn}-${room.maxBuyIn}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
                      <span className="text-sm font-semibold text-foreground">{room.currentPlayers}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">/{room.maxPlayers}</span>
                    <button className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-opacity ${
                      isFull ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-gold text-background hover:opacity-90"
                    }`} disabled={isFull}>
                      {isFull ? "Full" : t("lobby.sit")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav active="lobby" />
    </div>
  );
}

// Recent hands preview component
function RecentHandsPreview() {
  const [, navigate] = useLocation();
  const { data: recentHands } = trpc.game.myRecentHands.useQuery({ limit: 3 });

  if (!recentHands || recentHands.length === 0) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.handHistory")}</span>
        <button onClick={() => navigate("/history/all")} className="text-[10px] text-gold hover:text-gold/80 transition-colors">
          {t("table.viewAll")} →
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {recentHands.map(hand => (
          <div key={hand.id} className="glass rounded-lg p-2.5 min-w-[120px] flex-shrink-0 cursor-pointer card-hover" onClick={() => navigate(`/history/${hand.roomId}`)}>
            <div className="flex items-center gap-1 mb-1">
              {hand.myResult?.isWinner ? (
                <TrendingUp className="w-3 h-3 text-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <span className={`text-xs font-bold ${hand.myResult?.isWinner ? "text-success" : "text-red-400"}`}>
                {hand.myResult?.isWinner ? `+$${hand.myResult.winAmount || "0"}` : "-"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">#{hand.id}</p>
            {hand.myResult?.holeCards && (
              <p className="text-[10px] text-foreground/70 font-mono mt-0.5">{hand.myResult.holeCards}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
