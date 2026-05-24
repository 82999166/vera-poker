import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { useState } from "react";
import { Users, Zap, Plus, DollarSign, Trophy, Lock, ChevronRight, TrendingUp, TrendingDown, Hash, ArrowRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

type FilterLevel = "all" | "low" | "mid" | "high" | "vip";

export default function Lobby() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"cash" | "tourneys" | "private">("cash");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [privateRoomCode, setPrivateRoomCode] = useState("");
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

  // Count tables by level for cash tab
  const cashRooms = (rooms ?? []).filter(r => r.type !== "private");
  const tableCountByLevel = {
    all: cashRooms.length,
    low: cashRooms.filter(r => parseFloat(r.bigBlind) <= 0.10).length,
    mid: cashRooms.filter(r => parseFloat(r.bigBlind) > 0.10 && parseFloat(r.bigBlind) <= 1).length,
    high: cashRooms.filter(r => parseFloat(r.bigBlind) > 1 && parseFloat(r.bigBlind) <= 10).length,
    vip: cashRooms.filter(r => parseFloat(r.bigBlind) > 10).length,
  };

  // Quick join: find a low-stakes room with available seats
  const handleQuickJoin = () => {
    const lowRooms = cashRooms
      .filter(r => parseFloat(r.bigBlind) <= 0.10 && r.currentPlayers < r.maxPlayers && r.status !== "closed")
      .sort((a, b) => b.currentPlayers - a.currentPlayers); // prefer rooms with more players
    if (lowRooms.length > 0) {
      navigate(`/table/${lowRooms[0].id}`);
    } else {
      // Fallback: any available room
      const anyRoom = cashRooms.find(r => r.currentPlayers < r.maxPlayers && r.status !== "closed");
      if (anyRoom) {
        navigate(`/table/${anyRoom.id}`);
      } else {
        toast.info(t("lobby.noRooms"));
      }
    }
  };

  // Join private room by invite code (6-digit number)
  const trpcUtils = trpc.useUtils();
  const handleJoinPrivateRoom = async () => {
    const code = privateRoomCode.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      toast.error(t("lobby.invalidRoomCode"));
      return;
    }
    try {
      const room = await trpcUtils.rooms.resolveInviteCode.fetch({ inviteCode: code });
      if (!room) {
        toast.error(t("lobby.roomNotFound"));
        return;
      }
      if (room.status === "closed") {
        toast.error(t("lobby.roomClosed"));
        return;
      }
      navigate(`/table/${room.id}`);
    } catch {
      toast.error(t("lobby.roomNotFound"));
    }
  };

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

      {/* Deposit / Withdraw Buttons */}
      <div className="px-4 pt-4">
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/wallet?tab=deposit")}
            className="flex-1 bg-gold text-background font-bold py-3.5 rounded-xl text-base hover:opacity-90 transition-all active:scale-[0.97] flex items-center justify-center gap-2 shadow-lg"
          >
            <ArrowDownToLine className="w-5 h-5" />
            {t("wallet.deposit")}
          </button>
          <button
            onClick={() => navigate("/wallet?tab=withdraw")}
            className="flex-1 bg-background border-2 border-gold text-gold font-bold py-3.5 rounded-xl text-base hover:bg-gold/10 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <ArrowUpFromLine className="w-5 h-5" />
            {t("wallet.withdraw")}
          </button>
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

      {/* Quick Actions: Leaderboard + Quick Join */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          {t("lobby.leaderboard")}
        </button>
        <button
          onClick={handleQuickJoin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          {t("lobby.quickJoin")}
        </button>
      </div>

      {/* Filter Pills - show table count */}
      {activeTab === "cash" && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1">
          {(["all", "low", "mid", "high", "vip"] as FilterLevel[]).map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                filterLevel === level
                  ? "bg-truth-blue text-white glow-blue"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`lobby.filter.${level}`)}
              <span className="opacity-70">({tableCountByLevel[level]})</span>
            </button>
          ))}
        </div>
      )}

      {/* Private Room Join Input */}
      {activeTab === "private" && (
        <div className="px-4 pt-3">
          <div className="glass rounded-xl p-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-gold shrink-0" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("lobby.enterRoomCode")}
              value={privateRoomCode}
              onChange={(e) => setPrivateRoomCode(e.target.value.replace(/\D/g, ""))}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => { if (e.key === "Enter") handleJoinPrivateRoom(); }}
            />
            <button
              onClick={handleJoinPrivateRoom}
              disabled={!privateRoomCode.trim()}
              className="bg-gold text-background font-semibold px-4 py-1.5 rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {t("lobby.joinRoom")}
            </button>
          </div>
        </div>
      )}

      {/* Online counter */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">{t("lobby.online", { count: totalOnline })}</span>
        </div>
        {activeTab === "cash" && filteredRooms.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {filteredRooms.length} {t("lobby.tables")}
          </span>
        )}
      </div>

      {/* Room List */}
      <div className="flex-1 px-4 pt-2 pb-24 space-y-3">
        {activeTab === "private" && (
          <button
            onClick={() => navigate("/create-room")}
            className="w-full glass rounded-xl p-4 flex items-center justify-center gap-2 text-gold hover:glow-gold transition-all card-hover"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">{t("lobby.createRoom")}</span>
          </button>
        )}

        {/* Tournament placeholder */}
        {activeTab === "tourneys" && (
          <div className="glass rounded-xl p-6 text-center">
            <Trophy className="w-10 h-10 text-gold mx-auto mb-3 opacity-60" />
            <p className="text-sm text-muted-foreground">{t("lobby.tourneysSoon")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("lobby.tourneysDesc")}</p>
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-truth-blue/20 text-truth-blue-bright">{t("lobby.onChain")}</span>
                      )}
                      {isPlaying && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">{t("lobby.live")}</span>
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
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{room.currentPlayers}</span>
                      <span className="text-xs text-muted-foreground">/{room.maxPlayers}</span>
                    </div>
                    <button className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-opacity ${
                      isFull ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-gold text-background hover:opacity-90"
                    }`} disabled={isFull}>
                      {isFull ? t("lobby.full") : t("lobby.sit")}
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
