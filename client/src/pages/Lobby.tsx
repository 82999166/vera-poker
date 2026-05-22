import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { useState } from "react";
import { Users, Zap, Plus, DollarSign, Trophy, Lock, ChevronRight } from "lucide-react";
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
    if (filterLevel === "all") return true;
    const bb = parseFloat(room.bigBlind);
    if (filterLevel === "low") return bb <= 0.10;
    if (filterLevel === "mid") return bb > 0.10 && bb <= 1;
    if (filterLevel === "high") return bb > 1 && bb <= 10;
    if (filterLevel === "vip") return bb > 10;
    return true;
  });

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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No rooms available</p>
          </div>
        ) : (
          filteredRooms.map(room => (
            <div key={room.id} className="glass rounded-xl p-4 card-hover cursor-pointer" onClick={() => navigate(`/table/${room.id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{room.name}</span>
                    {room.fairnessLevel === "high" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-truth-blue/20 text-truth-blue-bright">ON-CHAIN</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{t("lobby.blinds")}: ${room.smallBlind}/${room.bigBlind}</span>
                    <span>{t("lobby.buyIn")}: ${room.minBuyIn}-${room.maxBuyIn}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">{room.currentPlayers}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">/{room.maxPlayers}</span>
                  <button className="bg-gold text-background font-semibold px-3 py-1.5 rounded-lg text-xs hover:opacity-90 transition-opacity">
                    {t("lobby.sit")}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav active="lobby" />
    </div>
  );
}
