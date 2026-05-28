import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { formatAmount, formatBalance } from "@/lib/utils";
import { useLocation } from "wouter";
import React, { useState } from "react";
import { Users, Zap, Plus, DollarSign, Trophy, Lock, ChevronRight, TrendingUp, TrendingDown, Hash, ArrowRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

type FilterLevel = "all" | "low" | "mid" | "high" | "vip";

// Stake group: aggregate multiple tables with same blinds into one entry
interface StakeGroup {
  smallBlind: string;
  bigBlind: string;
  minBuyIn: string;
  maxBuyIn: string;
  name: string;
  totalPlayers: number;
  availableSeats: number;
  tableCount: number;
  isLive: boolean;
  fairnessLevel: string;
}

export default function Lobby() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"cash" | "tourneys" | "private">("cash");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [privateRoomCode, setPrivateRoomCode] = useState("");
  // Buy-in dialog state
  const [buyInDialog, setBuyInDialog] = useState<{ open: boolean; group: StakeGroup | null }>({
    open: false,
    group: null,
  });
  const [buyInAmount, setBuyInAmount] = useState("");
  const [joiningStake, setJoiningStake] = useState(false);
  const { data: rooms, isLoading } = trpc.rooms.list.useQuery(undefined, { refetchInterval: 3000 });
  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user });
  const { data: activeRoom } = trpc.rooms.myActiveRoom.useQuery(undefined, { enabled: !!user });
  const joinByStakeMutation = trpc.rooms.joinByStake.useMutation();

  const cashRooms = (rooms ?? []).filter(r => r.type !== "private" && r.status !== "closed");
  const privateRooms = (rooms ?? []).filter(r => r.type === "private" && r.status !== "closed");

  // Group cash rooms by blinds into stake groups
  const stakeGroups = React.useMemo((): StakeGroup[] => {
    const map = new Map<string, StakeGroup>();
    for (const r of cashRooms) {
      const key = `${r.smallBlind}/${r.bigBlind}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalPlayers += r.currentPlayers;
        existing.availableSeats += Math.max(0, r.maxPlayers - r.currentPlayers);
        existing.tableCount += 1;
        if (r.status === "playing") existing.isLive = true;
      } else {
        map.set(key, {
          smallBlind: r.smallBlind,
          bigBlind: r.bigBlind,
          minBuyIn: r.minBuyIn,
          maxBuyIn: r.maxBuyIn,
          name: r.name,
          totalPlayers: r.currentPlayers,
          availableSeats: Math.max(0, r.maxPlayers - r.currentPlayers),
          tableCount: 1,
          isLive: r.status === "playing",
          fairnessLevel: r.fairnessLevel ?? "basic",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => parseFloat(a.bigBlind) - parseFloat(b.bigBlind));
  }, [cashRooms]);

  // Filter stake groups by level
  const filteredGroups = stakeGroups.filter(g => {
    if (filterLevel === "all") return true;
    const bb = parseFloat(g.bigBlind);
    if (filterLevel === "low") return bb <= 0.10;
    if (filterLevel === "mid") return bb > 0.10 && bb <= 1;
    if (filterLevel === "high") return bb > 1 && bb <= 10;
    if (filterLevel === "vip") return bb > 10;
    return true;
  });

  const totalOnline = cashRooms.reduce((sum, r) => sum + r.currentPlayers, 0);

  const tableCountByLevel = {
    all: stakeGroups.length,
    low: stakeGroups.filter(g => parseFloat(g.bigBlind) <= 0.10).length,
    mid: stakeGroups.filter(g => parseFloat(g.bigBlind) > 0.10 && parseFloat(g.bigBlind) <= 1).length,
    high: stakeGroups.filter(g => parseFloat(g.bigBlind) > 1 && parseFloat(g.bigBlind) <= 10).length,
    vip: stakeGroups.filter(g => parseFloat(g.bigBlind) > 10).length,
  };

  const handleSitDown = (group: StakeGroup) => {
    if (!user) { navigate("/"); return; }
    if (group.availableSeats === 0) { toast.error(t("lobby.full")); return; }
    const defaultBuyIn = Math.min(
      parseFloat(group.maxBuyIn),
      Math.max(parseFloat(group.minBuyIn), parseFloat(group.bigBlind) * 20)
    );
    setBuyInAmount(defaultBuyIn.toFixed(2));
    setBuyInDialog({ open: true, group });
  };

  const handleConfirmBuyIn = async () => {
    if (!buyInDialog.group) return;
    const amount = parseFloat(buyInAmount);
    const min = parseFloat(buyInDialog.group.minBuyIn);
    const max = parseFloat(buyInDialog.group.maxBuyIn);
    if (isNaN(amount) || amount < min || amount > max) {
      toast.error(`${t("lobby.buyIn")}: $${min} - $${max}`);
      return;
    }
    setJoiningStake(true);
    try {
      const result = await joinByStakeMutation.mutateAsync({
        smallBlind: buyInDialog.group.smallBlind,
        bigBlind: buyInDialog.group.bigBlind,
        buyIn: amount,
      });
      setBuyInDialog({ open: false, group: null });
      navigate(`/table/${result.roomId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || t("lobby.noRooms"));
    } finally {
      setJoiningStake(false);
    }
  };

  // Quick join: auto-assign to lowest-stake available group
  const handleQuickJoin = () => {
    const available = filteredGroups.filter(g => g.availableSeats > 0);
    if (available.length > 0) {
      handleSitDown(available[0]);
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
              {formatBalance(walletData?.balance)}
            </span>
          </div>
        </div>
      </header>

      {/* Active Room Banner - show when player is still seated somewhere */}
      {activeRoom && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate(`/table/${activeRoom.roomId}`)}
            className="w-full glass rounded-xl p-3 flex items-center justify-between border border-gold/40 hover:border-gold/70 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">{t("lobby.returnToTable")}</p>
                <p className="text-[10px] text-muted-foreground">{activeRoom.roomName} · {t("lobby.blinds")}: ${activeRoom.blinds}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gold" />
          </button>
        </div>
      )}

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

      {/* Activity Banners */}
      <BannerCarousel />

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
        {activeTab === "cash" && filteredGroups.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {filteredGroups.length} {t("lobby.tables")}
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

        {/* Tournament List */}
        {activeTab === "tourneys" && <TournamentList />}

        {/* Cash Tab: Stake Groups */}
        {activeTab === "cash" && (isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t("lobby.noRooms")}</p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isFull = group.availableSeats === 0;
            return (
              <div key={`${group.smallBlind}/${group.bigBlind}`} className="glass rounded-xl p-4 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{group.name}</span>
                      {group.fairnessLevel === "high" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-truth-blue/20 text-truth-blue-bright">{t("lobby.onChain")}</span>
                      )}
                      {group.isLive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">{t("lobby.live")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{t("lobby.blinds")}: ${formatAmount(group.smallBlind)}/${formatAmount(group.bigBlind)}</span>
                      <span>{t("lobby.buyIn")}: ${formatAmount(group.minBuyIn)}-${formatAmount(group.maxBuyIn)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{group.totalPlayers}</span>
                      <span className="text-xs text-muted-foreground">{t("lobby.onlineSuffix")}</span>
                    </div>
                    <button
                      onClick={() => handleSitDown(group)}
                      className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95 ${
                        isFull ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-gold text-background hover:opacity-90"
                      }`}
                      disabled={isFull}
                    >
                      {isFull ? t("lobby.full") : t("lobby.sit")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ))}

        {/* Private Tab: individual private rooms */}
        {activeTab === "private" && !isLoading && privateRooms.length > 0 && privateRooms.map(room => {
          const isFull = room.currentPlayers >= room.maxPlayers;
          return (
            <div key={room.id} className="glass rounded-xl p-4 card-hover cursor-pointer" onClick={() => navigate(`/table/${room.id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-3 h-3 text-gold" />
                    <span className="text-sm font-semibold text-foreground">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{t("lobby.blinds")}: ${formatAmount(room.smallBlind)}/${formatAmount(room.bigBlind)}</span>
                    <span>{t("lobby.buyIn")}: ${formatAmount(room.minBuyIn)}-${formatAmount(room.maxBuyIn)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{room.currentPlayers}</span>
                    <span className="text-xs text-muted-foreground">{t("lobby.onlineSuffix")}</span>
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
        })}
      </div>

      {/* Buy-in Dialog */}
      {buyInDialog.open && buyInDialog.group && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setBuyInDialog({ open: false, group: null })}>
          <div className="w-full max-w-md glass-strong rounded-t-2xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">{buyInDialog.group.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {t("lobby.blinds")}: ${formatAmount(buyInDialog.group.smallBlind)}/${formatAmount(buyInDialog.group.bigBlind)}
              &nbsp;·&nbsp;
              {t("lobby.buyIn")}: ${formatAmount(buyInDialog.group.minBuyIn)} - ${formatAmount(buyInDialog.group.maxBuyIn)}
            </p>
            <label className="block text-xs text-muted-foreground mb-1">{t("lobby.buyIn")} (USDT)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                inputMode="decimal"
                value={buyInAmount}
                onChange={e => setBuyInAmount(e.target.value)}
                min={buyInDialog.group.minBuyIn}
                max={buyInDialog.group.maxBuyIn}
                step="0.01"
                className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
              <button
                onClick={() => setBuyInAmount(buyInDialog.group!.maxBuyIn)}
                className="px-3 py-2 rounded-lg glass text-xs text-gold hover:bg-gold/10 transition-colors"
              >
                MAX
              </button>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground mb-4">
              <span>{t("wallet.balance")}: ${formatBalance(walletData?.balance)}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBuyInDialog({ open: false, group: null })}
                className="flex-1 py-3 rounded-xl glass text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmBuyIn}
                disabled={joiningStake}
                className="flex-1 py-3 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {joiningStake ? (
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                ) : t("lobby.sit")}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="lobby" />
    </div>
  );
}

// ==================== Banner Carousel ====================
function BannerCarousel() {
  const { data: bannerList } = trpc.banners.list.useQuery();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, navigate] = useLocation();

  // Auto-scroll
  React.useEffect(() => {
    if (!bannerList || bannerList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % bannerList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [bannerList]);

  if (!bannerList || bannerList.length === 0) {
    return (
      <div className="px-4 pt-3">
        <div className="relative rounded-xl overflow-hidden glass border border-gold/20" style={{ aspectRatio: "3/1" }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <span className="text-gold text-lg font-bold">★ Vera Poker</span>
              <p className="text-xs text-muted-foreground mt-1">{t("lobby.tourneysSoon")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleClick = (banner: typeof bannerList[0]) => {
    if (banner.linkType === "url" && banner.linkUrl) {
      window.open(banner.linkUrl, "_blank");
    } else if (banner.linkType === "page" && banner.linkUrl) {
      navigate(banner.linkUrl);
    }
  };

  return (
    <div className="px-4 pt-3">
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/1" }}>
        {/* Slides */}
        <div
          className="flex transition-transform duration-500 ease-out h-full"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {bannerList.map((banner) => (
            <div
              key={banner.id}
              className="w-full flex-shrink-0 h-full cursor-pointer"
              onClick={() => handleClick(banner)}
            >
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
        {/* Indicators */}
        {bannerList.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {bannerList.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? "bg-gold w-5" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Tournament List ====================
function TournamentList() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: tournaments, isLoading } = trpc.tournaments.list.useQuery(undefined, { refetchInterval: 10000 });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <Trophy className="w-10 h-10 text-gold mx-auto mb-3 opacity-60" />
        <p className="text-sm text-muted-foreground">{t("tourney.noTournaments")}</p>
      </div>
    );
  }

  const statusOrder: Record<string, number> = { registration: 0, running: 1, finished: 2, cancelled: 3, draft: 4 };
  const sorted = [...tournaments].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  if (selectedId) {
    return <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-3">
      {sorted.map(t_item => (
        <div
          key={t_item.id}
          className="glass rounded-xl p-4 card-hover cursor-pointer"
          onClick={() => setSelectedId(t_item.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{t_item.name}</span>
                <TournamentStatusBadge status={t_item.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{t("tourney.entryFee")}: {t_item.entryFee} USDT</span>
                <span>{t_item.registeredCount || 0}/{t_item.maxPlayers} {t("tourney.players")}</span>
              </div>
              <div className="text-xs text-muted-foreground/70 mt-1">
                <TournamentCountdown startTime={new Date(t_item.startTime)} status={t_item.status} />
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    registration: { bg: "bg-success/20", text: "text-success", label: t("tourney.statusRegistration") },
    running: { bg: "bg-amber-500/20", text: "text-amber-400", label: t("tourney.statusRunning") },
    finished: { bg: "bg-gray-500/20", text: "text-gray-400", label: t("tourney.statusFinished") },
    cancelled: { bg: "bg-red-500/20", text: "text-red-400", label: t("tourney.statusCancelled") },
    draft: { bg: "bg-blue-500/20", text: "text-blue-400", label: t("tourney.statusDraft") },
  };
  const c = config[status] || config.draft;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function TournamentCountdown({ startTime, status }: { startTime: Date; status: string }) {
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    if (status !== "registration") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  if (status === "running") return <span className="text-amber-400">{t("tourney.inProgress")}</span>;
  if (status === "finished") return <span>{t("tourney.ended")}</span>;
  if (status === "cancelled") return <span className="text-red-400">{t("tourney.cancelled")}</span>;

  const diff = startTime.getTime() - now;
  if (diff <= 0) return <span className="text-amber-400">{t("tourney.starting")}</span>;

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (hours > 24) {
    return <span>{new Date(startTime).toLocaleString()}</span>;
  }
  return (
    <span className="text-gold font-mono">
      {t("tourney.startsIn")} {hours > 0 ? `${hours}h ` : ""}{minutes}m {seconds}s
    </span>
  );
}

// ==================== Tournament Detail ====================
function TournamentDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { user } = useAuth();
  const { data, isLoading, refetch } = trpc.tournaments.detail.useQuery({ id });
  const { data: myReg, refetch: refetchReg } = trpc.tournaments.myRegistration.useQuery(
    { tournamentId: id },
    { enabled: !!user }
  );
  const registerMutation = trpc.tournaments.register.useMutation({
    onSuccess: () => { refetch(); refetchReg(); toast.success(t("tourney.registerSuccess")); },
    onError: (err) => toast.error(err.message),
  });
  const cancelMutation = trpc.tournaments.cancelRegistration.useMutation({
    onSuccess: () => { refetch(); refetchReg(); toast.success(t("tourney.cancelSuccess")); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { tournament: tourney, registrations } = data;
  const prizePool = parseFloat(tourney.entryFee) * (tourney.registeredCount || 0) * (1 - parseFloat(tourney.platformRake) / 100);
  const isRegistered = myReg && myReg.status === "registered";
  const canRegister = tourney.status === "registration" && !isRegistered;
  const canCancel = tourney.status === "registration" && isRegistered;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 glass rounded-lg hover:bg-muted/50">
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">{tourney.name}</h2>
          <TournamentStatusBadge status={tourney.status} />
        </div>
      </div>

      {/* Info Card */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label={t("tourney.entryFee")} value={`${tourney.entryFee} USDT`} />
          <InfoItem label={t("tourney.startingChips")} value={`${formatAmount(tourney.startingChips)}`} />
          <InfoItem label={t("tourney.prizePool")} value={`${formatBalance(prizePool)} USDT`} highlight />
          <InfoItem label={t("tourney.players")} value={`${tourney.registeredCount || 0}/${tourney.maxPlayers}`} />
          <InfoItem label={t("tourney.totalRounds")} value={`${tourney.totalRounds}`} />
          <InfoItem label={t("tourney.blindLevel")} value={`${tourney.blindLevelDuration} min`} />
          <InfoItem label={t("tourney.perTable")} value={`${tourney.playersPerTable}`} />
          <InfoItem label={t("tourney.platformRake")} value={`${tourney.platformRake}%`} />
        </div>

        {/* Start time */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("tourney.startTime")}</span>
            <span className="text-foreground font-medium">{new Date(tourney.startTime).toLocaleString()}</span>
          </div>
          <div className="mt-1">
            <TournamentCountdown startTime={new Date(tourney.startTime)} status={tourney.status} />
          </div>
        </div>
      </div>

      {/* Prize Distribution */}
      {tourney.prizeDistribution && (tourney.prizeDistribution as Array<{rank: number; percentage: number}>).length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("tourney.prizeDistribution")}</h3>
          <div className="space-y-1">
            {(tourney.prizeDistribution as Array<{rank: number; percentage: number}>).map((p) => (
              <div key={p.rank} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`} {t("tourney.rank")} {p.rank}
                </span>
                <span className="text-gold font-medium">{p.percentage}% ({formatBalance(prizePool * p.percentage / 100)} USDT)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered Players */}
      {registrations && registrations.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("tourney.registeredPlayers")} ({registrations.length})
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {registrations.slice(0, 20).map((r: any) => (
              <div key={r.reg.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.user?.name || r.user?.tgUsername || `User #${r.reg.userId}`}</span>
                <span className="text-muted-foreground/60">{new Date(r.reg.registeredAt).toLocaleString()}</span>
              </div>
            ))}
            {registrations.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">+{registrations.length - 20} more</p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {user && (
        <div className="pt-2">
          {canRegister && (
            <button
              onClick={() => registerMutation.mutate({ tournamentId: id })}
              disabled={registerMutation.isPending}
              className="w-full py-3 rounded-xl bg-gold text-background font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {registerMutation.isPending ? "..." : t("tourney.register")} ({tourney.entryFee} USDT)
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate({ tournamentId: id })}
              disabled={cancelMutation.isPending}
              className="w-full py-3 rounded-xl border border-red-500 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? "..." : t("tourney.cancelRegistration")}
            </button>
          )}
          {isRegistered && tourney.status !== "registration" && (
            <div className="text-center text-sm text-success font-medium">
              {t("tourney.youAreRegistered")}
            </div>
          )}
        </div>
      )}

      {!user && tourney.status === "registration" && (
        <div className="text-center text-sm text-muted-foreground">
          {t("tourney.loginToRegister")}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-gold" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
