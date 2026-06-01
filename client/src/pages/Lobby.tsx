/** 大厅页面 - 展示所有房间列表，支持筛选和快速加入 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { formatAmount, formatBalance } from "@/lib/utils";
import { useLocation } from "wouter";
import React, { useState, useCallback } from "react";
import { Users, Zap, Plus, DollarSign, Trophy, Lock, ChevronRight, Hash, ArrowRight, ArrowDownToLine, ArrowUpFromLine, BookOpen, Crown } from "lucide-react";
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
  const [joiningStake, setJoiningStake] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { data: rooms, isLoading } = trpc.rooms.list.useQuery(undefined, { refetchInterval: 3000 });
  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user });
  const { data: activeRoom } = trpc.rooms.myActiveRoom.useQuery(undefined, { enabled: !!user });
  const { data: myTournamentTable } = trpc.tournaments.myTable.useQuery(undefined, { enabled: !!user });
  const joinByStakeMutation = trpc.rooms.joinByStake.useMutation();

  // New user welcome popup - show once when bonusBalance > 0 and not yet dismissed
  React.useEffect(() => {
    if (user && walletData) {
      const dismissed = localStorage.getItem(`welcome_dismissed_${user.id}`);
      if (!dismissed && parseFloat(walletData.bonusBalance || "0") > 0 && !walletData.bonusUnlocked) {
        setShowWelcome(true);
      }
    }
  }, [user, walletData]);

  // Auto-navigate to active tournament table on reconnect
  React.useEffect(() => {
    if (myTournamentTable && myTournamentTable.roomId) {
      navigate(`/table/${myTournamentTable.roomId}`);
    }
  }, [myTournamentTable, navigate]);

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

  // 点「入座」：先找到可用桌，直接跳转到游戏桌，在游戏桌内弹出买入弹窗
  const handleSitDown = useCallback(async (group: StakeGroup) => {
    if (!user) { navigate("/"); return; }
    if (group.availableSeats === 0) { toast.error(t("lobby.full")); return; }
    setJoiningStake(true);
    try {
      // 只找桌子，不传 buyIn（buyIn=0 表示仅分配桌子，不入座）
      const result = await joinByStakeMutation.mutateAsync({
        smallBlind: group.smallBlind,
        bigBlind: group.bigBlind,
        buyIn: 0, // 0 = 仅分配桌子，不扣余额，游戏桌内再买入
      });
      navigate(`/table/${result.roomId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || t("lobby.noRooms"));
    } finally {
      setJoiningStake(false);
    }
  }, [user, joinByStakeMutation, navigate, t]);

  // 一键开玩：优先选在线人数最多的场次
  const handleQuickJoin = () => {
    const available = filteredGroups.filter(g => g.availableSeats > 0);
    if (available.length > 0) {
      // 选在线人数最多的场次
      const best = available.reduce((a, b) => a.totalPlayers >= b.totalPlayers ? a : b);
      handleSitDown(best);
    } else {
      toast.info(t("lobby.noRooms"));
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

  const dismissWelcome = () => {
    if (user) localStorage.setItem(`welcome_dismissed_${user.id}`, "1");
    setShowWelcome(false);
  };

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* New User Welcome Popup */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-strong rounded-2xl p-6 mx-4 max-w-sm w-full text-center space-y-4 animate-in zoom-in-95">
            <div className="text-4xl">\ud83c\udf89</div>
            <h2 className="text-xl font-bold text-gold">{t("lobby.welcomeTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("lobby.welcomeBonus").replace("{amount}", walletData?.bonusBalance || "0")}
            </p>
            <div className="glass rounded-lg p-3 text-left space-y-1">
              <p className="text-xs text-muted-foreground">\u2022 {t("lobby.welcomeRule1")}</p>
              <p className="text-xs text-muted-foreground">\u2022 {t("lobby.welcomeRule2")}</p>
              <p className="text-xs text-muted-foreground">\u2022 {t("lobby.welcomeRule3")}</p>
            </div>
            <button
              onClick={dismissWelcome}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {t("lobby.welcomeStart")}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-gold/50" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center">
                <span className="text-sm font-bold text-background">{(user?.nickname || user?.name || "V").charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{user?.nickname || user?.name || "Vera Poker"}</h1>
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

      {/* Quick Actions: Leaderboard + Tutorial + Quick Join */}
      <div className="px-4 pt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          {t("lobby.leaderboard")}
        </button>
        <button
          onClick={() => navigate("/tutorial")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium text-truth-blue hover:bg-truth-blue/10 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {t("tutorial.title")}
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
        {activeTab === "cash" && totalOnline > 0 && (
          <span className="text-xs text-muted-foreground">
            {filteredGroups.reduce((sum, g) => sum + g.totalPlayers, 0)} {t("lobby.playersOnline")}
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
        {activeTab === "tourneys" && (
          <>
            <TournamentList />
            <TournamentLeaderboardPreview />
          </>
        )}

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

      {/* 加载中遮罩（找桌子时） */}
      {joiningStake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-foreground font-medium">{t("lobby.findingTable")}</p>
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
                <span className="text-muted-foreground">{r.user?.nickname || r.user?.name || `User #${r.reg.userId}`}</span>
                <span className="text-muted-foreground/60">{new Date(r.reg.registeredAt).toLocaleString()}</span>
              </div>
            ))}
            {registrations.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">+{registrations.length - 20} more</p>
            )}
          </div>
        </div>
      )}

      {/* Live Tournament State - shown when tournament is running */}
      {tourney.status === "running" && user && <TournamentLivePanel tournamentId={id} />}

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
          {isRegistered && tourney.status !== "registration" && tourney.status !== "running" && (
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

// ==================== Tournament Live Panel ====================
function TournamentLivePanel({ tournamentId }: { tournamentId: number }) {
  const [, navigate] = useLocation();
  const { data: liveState, isLoading } = trpc.tournaments.liveState.useQuery(
    { tournamentId },
    { refetchInterval: 3000 }
  );

  if (isLoading || !liveState) {
    return (
      <div className="glass rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    );
  }

  const blindTimeLeft = liveState.timeUntilNextLevel ? Math.ceil(liveState.timeUntilNextLevel / 1000) : 0;
  const blindMinutes = Math.floor(blindTimeLeft / 60);
  const blindSeconds = blindTimeLeft % 60;

  return (
    <div className="glass rounded-xl p-4 space-y-3 border border-gold/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gold flex items-center gap-1">
          <Zap className="w-4 h-4" /> LIVE
        </h3>
        <span className="text-xs text-muted-foreground">
          {liveState.activePlayers}/{liveState.totalPlayers} players
        </span>
      </div>

      {/* Blind Level Info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Blind Level {liveState.currentBlindLevel}/{liveState.totalBlindLevels}</p>
          <p className="text-sm font-bold text-foreground">
            {liveState.currentBlinds?.smallBlind}/{liveState.currentBlinds?.bigBlind}
            {liveState.currentBlinds?.ante ? ` (ante ${liveState.currentBlinds.ante})` : ""}
          </p>
        </div>
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Next Level In</p>
          <p className="text-sm font-bold text-foreground">
            {blindMinutes}:{String(blindSeconds).padStart(2, "0")}
          </p>
          {liveState.nextBlinds && (
            <p className="text-[10px] text-muted-foreground">→ {liveState.nextBlinds.smallBlind}/{liveState.nextBlinds.bigBlind}</p>
          )}
        </div>
      </div>

      {/* My Status */}
      {liveState.myEliminated ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
          <p className="text-sm text-red-400 font-medium">已淘汰 - 第 {liveState.myRank} 名</p>
        </div>
      ) : liveState.myRoomId ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-background/50 rounded-lg p-2">
            <div>
              <p className="text-[10px] text-muted-foreground">My Chips</p>
              <p className="text-sm font-bold text-gold">{formatAmount(liveState.myChips || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Avg Stack</p>
              <p className="text-sm font-medium text-foreground">{formatAmount(liveState.averageStack || 0)}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/table/${liveState.myRoomId}`)}
            className="w-full py-2.5 rounded-xl bg-gold text-background font-bold text-sm hover:opacity-90 transition-opacity"
          >
            进入我的牌桌
          </button>
        </div>
      ) : null}

      {/* Tables Info */}
      {liveState.tables && liveState.tables.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Tables ({liveState.tables.length})</p>
          <div className="flex flex-wrap gap-1">
            {liveState.tables.map((tbl: any, i: number) => (
              <span key={tbl.roomId} className={`text-[10px] px-2 py-0.5 rounded-full ${tbl.roomId === liveState.myRoomId ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-muted text-muted-foreground'}`}>
                T{i + 1}: {tbl.playerCount}p
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chip Leaders */}
      {liveState.chipLeaders && liveState.chipLeaders.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Chip Leaders</p>
          <div className="space-y-0.5">
            {liveState.chipLeaders.slice(0, 5).map((leader: any) => (
              <div key={leader.userId} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {leader.rank}. {leader.name}
                </span>
                <span className="text-gold font-medium">{formatAmount(leader.chips)}</span>
              </div>
            ))}
          </div>
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


function TournamentLeaderboardPreview() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.tournaments.leaderboard.useQuery();

  if (isLoading || !data) return null;

  const topChampions = (data.champions || []).slice(0, 3);
  if (topChampions.length === 0) return null;

  return (
    <div className="mt-4 glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold">{t("leaderboard.champions")}</span>
        </div>
        <button
          onClick={() => navigate("/leaderboard")}
          className="text-xs text-gold hover:underline"
        >
          {t("lobby.leaderboard")} →
        </button>
      </div>
      <div className="space-y-2">
        {topChampions.map((entry: any, index: number) => (
          <div key={entry.userId} className="flex items-center gap-2">
            <span className={`w-5 text-center text-xs font-bold ${
              index === 0 ? "text-gold" : index === 1 ? "text-gray-300" : "text-amber-600"
            }`}>
              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
            </span>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center overflow-hidden shrink-0">
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-gold">
                  {(entry.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-xs flex-1 truncate">{entry.name || `Player ${entry.userId}`}</span>
            <span className="text-xs font-bold text-gold">{entry.wins}{t("leaderboard.winsUnit")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
