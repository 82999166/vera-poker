import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { t } from "@/lib/i18n";
import { ArrowLeft, Shield, Volume2, VolumeX, LogIn, LogOut, Trophy, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";

// Card rendering with animation support
const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: "\u2660", color: "text-gray-900" },
  h: { symbol: "\u2665", color: "text-red-600" },
  d: { symbol: "\u2666", color: "text-blue-500" },
  c: { symbol: "\u2663", color: "text-green-600" },
};

const RANK_DISPLAY: Record<string, string> = {
  "A": "A", "2": "2", "3": "3", "4": "4", "5": "5",
  "6": "6", "7": "7", "8": "8", "9": "9", "T": "10",
  "J": "J", "Q": "Q", "K": "K",
};

function CardView({ card, faceDown = false, className = "", delay = 0, animate = false }: {
  card?: string; faceDown?: boolean; className?: string; delay?: number; animate?: boolean;
}) {
  const [visible, setVisible] = useState(!animate);
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [animate, delay]);

  if (!card || faceDown) {
    return (
      <div className={`w-10 h-14 rounded-lg bg-gradient-to-br from-truth-blue to-truth-blue/60 border border-truth-blue/40 flex items-center justify-center shadow-lg transition-all duration-300 ${animate && !visible ? "scale-0 opacity-0" : "scale-100 opacity-100"} ${className}`}>
        <div className="w-6 h-8 rounded border border-truth-blue-bright/30 flex items-center justify-center bg-gradient-to-br from-truth-blue/20 to-transparent">
          <span className="text-[8px] font-bold text-truth-blue-bright">VP</span>
        </div>
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const suitInfo = SUITS[suit] || SUITS.s;
  const displayRank = RANK_DISPLAY[rank] || rank;

  return (
    <div className={`w-10 h-14 rounded-lg bg-gradient-to-b from-white to-gray-50 border border-gray-200 flex flex-col items-center justify-center shadow-lg transition-all duration-300 ${animate && !visible ? "scale-0 opacity-0 -translate-y-4" : "scale-100 opacity-100 translate-y-0"} ${className}`}>
      <span className={`text-[11px] font-black leading-none ${suitInfo.color}`}>{displayRank}</span>
      <span className={`text-base leading-none -mt-0.5 ${suitInfo.color}`}>{suitInfo.symbol}</span>
    </div>
  );
}

// Chip stack visualization
function ChipStack({ amount, size = "sm", animate = false }: { amount: number; size?: "sm" | "md"; animate?: boolean }) {
  if (amount <= 0) return null;
  const chipCount = Math.min(5, Math.ceil(amount / 10));
  const chipColors = [
    "from-gold to-gold-dim border-gold/50",
    "from-blue-400 to-blue-600 border-blue-400/50",
    "from-red-400 to-red-600 border-red-400/50",
    "from-green-400 to-green-600 border-green-400/50",
    "from-purple-400 to-purple-600 border-purple-400/50",
  ];
  return (
    <div className={`flex items-center gap-1 ${animate ? "animate-in slide-in-from-bottom-2 duration-300" : ""}`}>
      <div className="relative flex flex-col-reverse">
        {Array.from({ length: chipCount }).map((_, i) => (
          <div
            key={i}
            className={`${size === "sm" ? "w-3 h-1" : "w-4 h-1.5"} rounded-full bg-gradient-to-r ${chipColors[i % chipColors.length]} -mt-0.5 first:mt-0 ${animate ? "animate-in zoom-in duration-200" : ""}`}
            style={animate ? { animationDelay: `${i * 50}ms` } : undefined}
          />
        ))}
      </div>
      <span className={`${size === "sm" ? "text-[10px]" : "text-xs"} text-gold font-bold`}>${amount.toFixed(2)}</span>
    </div>
  );
}

// Animated pot display with grow effect
function AnimatedPot({ amount }: { amount: number }) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const prevAmount = useRef(0);

  useEffect(() => {
    if (amount === prevAmount.current) return;
    const start = prevAmount.current;
    const diff = amount - start;
    const duration = 500;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayAmount(start + diff * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prevAmount.current = amount;
  }, [amount]);

  return (
    <div className="glass rounded-full px-3 py-1 inline-flex items-center gap-1.5 border border-gold/20 transition-all duration-300">
      <div className={`w-3 h-3 rounded-full bg-gradient-to-br from-gold to-gold-dim shadow-sm ${amount > 0 ? "animate-pulse" : ""}`} />
      <span className={`text-xs font-bold text-gold transition-all duration-300 ${amount > prevAmount.current ? "scale-110" : ""}`}>
        ${displayAmount.toFixed(2)}
      </span>
    </div>
  );
}

// Player seat positions for 6-max table (oval layout)
const SEAT_POSITIONS = [
  { top: "78%", left: "50%", transform: "translate(-50%, -50%)" },  // Bottom (hero)
  { top: "58%", left: "3%", transform: "translate(0, -50%)" },     // Left bottom
  { top: "22%", left: "3%", transform: "translate(0, -50%)" },     // Left top
  { top: "5%", left: "50%", transform: "translate(-50%, 0)" },     // Top
  { top: "22%", left: "97%", transform: "translate(-100%, -50%)" },// Right top
  { top: "58%", left: "97%", transform: "translate(-100%, -50%)" },// Right bottom
];

// Phase display names (i18n keys)
function getPhaseNames(): Record<string, string> {
  return {
    waiting: t("table.waiting").split("...")[0] || "Waiting",
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
  };
}

export default function Table() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { play: playSound, toggle: toggleSound, isEnabled: isSoundEnabled } = useSoundEffects();
  const [muted, setMuted] = useState(() => localStorage.getItem("vera-sound-enabled") === "false");
  const [raiseAmount, setRaiseAmount] = useState(4.00);
  const [isSeated, setIsSeated] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [showBuyIn, setShowBuyIn] = useState(false);
  const [lastPhase, setLastPhase] = useState("");
  const [animateCards, setAnimateCards] = useState(false);
  const [showWinner, setShowWinner] = useState<{ name: string; amount: number; handDescription?: string } | null>(null);
  const [showSettlement, setShowSettlement] = useState<any>(null);
  const prevHandRef = useRef<number>(0);

  const roomId = parseInt(id || "0");
  const isValidRoom = roomId > 0;

  // Fetch room data
  const { data: room } = trpc.rooms.get.useQuery(
    { id: roomId },
    { enabled: isValidRoom }
  );

  const utils = trpc.useUtils();

  // Poll game state every 2 seconds with error recovery
  const { data: tableState, error: tableError } = trpc.game.tableState.useQuery(
    { roomId },
    {
      enabled: isValidRoom && !!user && isSeated,
      refetchInterval: 2000,
      retry: 3,
      retryDelay: 1000,
    }
  );

  // Connection state tracking
  const [connectionLost, setConnectionLost] = useState(false);
  useEffect(() => {
    if (tableError) {
      setConnectionLost(true);
    } else if (tableState) {
      setConnectionLost(false);
    }
  }, [tableError, tableState]);

  // Detect phase changes for card animations + sound effects
  useEffect(() => {
    if (tableState?.phase && tableState.phase !== lastPhase) {
      if (["flop", "turn", "river"].includes(tableState.phase) && lastPhase !== "") {
        setAnimateCards(true);
        setTimeout(() => setAnimateCards(false), 1000);
        if (!muted) playSound("cardFlip");
      }
      if (tableState.phase === "preflop" && lastPhase !== "" && lastPhase !== "preflop") {
        if (!muted) playSound("deal");
      }
      setLastPhase(tableState.phase);
    }
  }, [tableState?.phase, lastPhase, muted, playSound]);

  // Detect new hand for winner display
  useEffect(() => {
    if (tableState?.handNumber && tableState.handNumber !== prevHandRef.current) {
      if (prevHandRef.current > 0 && tableState.lastWinner) {
        setShowWinner(tableState.lastWinner);
        if (tableState.settlementDetail) {
          setShowSettlement(tableState.settlementDetail);
        }
        setTimeout(() => { setShowWinner(null); setShowSettlement(null); }, 5000);
      }
      prevHandRef.current = tableState.handNumber;
    }
  }, [tableState?.handNumber]);

  // Mutations
  const joinMutation = trpc.game.join.useMutation({
    onSuccess: (data) => {
      setIsSeated(true);
      setShowBuyIn(false);
      toast.success(`Seat #${data.seatIndex + 1}`);
      utils.game.tableState.invalidate({ roomId });
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.game.leave.useMutation({
    onSuccess: () => {
      setIsSeated(false);
      toast.success(t("table.left"));
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const actionMutation = trpc.game.action.useMutation({
    onSuccess: (_, variables) => {
      utils.game.tableState.invalidate({ roomId });
      // Play sound based on action type
      if (!muted) {
        const action = (variables as any)?.action;
        if (action === "fold") playSound("fold");
        else if (action === "check") playSound("check");
        else if (action === "call") playSound("call");
        else if (action === "raise" || action === "bet") playSound("bet");
        else if (action === "allin") playSound("allIn");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Derived state from table state
  const phase = tableState?.phase ?? "waiting";
  const pot = tableState?.pot ?? 0;
  const communityCards = tableState?.communityCards ?? [];
  const myCards = tableState?.myCards ?? [];
  const currentBet = tableState?.currentBet ?? (room ? parseFloat(room.bigBlind) : 2);
  const isMyTurn = tableState?.currentPlayerId === user?.id;
  const players = tableState?.players ?? [];
  const turnTimeout = tableState?.turnTimeout ?? 30;
  const lastActionAt = tableState?.lastActionAt ?? Date.now();

  // Countdown timer with urgency feedback
  const [countdown, setCountdown] = useState(30);
  useEffect(() => {
    if (!isMyTurn) return;
    const elapsed = Math.floor((Date.now() - lastActionAt) / 1000);
    const remaining = Math.max(0, turnTimeout - elapsed);
    setCountdown(remaining);
    const timer = setInterval(() => {
      setCountdown(prev => {
        const next = Math.max(0, prev - 1);
        // Vibrate + sound on last 5 seconds
        if (next <= 5 && next > 0) {
          if (navigator.vibrate) navigator.vibrate(50);
          if (!muted) playSound("timer");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMyTurn, lastActionAt, turnTimeout]);

  const isUrgent = isMyTurn && countdown <= 5 && countdown > 0;

  // Set raise amount based on current bet
  useEffect(() => {
    if (room) {
      setRaiseAmount(Math.max(parseFloat(room.bigBlind) * 2, currentBet * 2));
    }
  }, [room, currentBet]);

  // Check if already seated
  const { data: roomPlayers } = trpc.rooms.getPlayers.useQuery(
    { roomId },
    { enabled: isValidRoom && !!user }
  );

  useEffect(() => {
    if (roomPlayers && user) {
      const seated = roomPlayers.some((p: any) => p.userId === user.id);
      setIsSeated(seated);
    }
  }, [roomPlayers, user]);

  // Demo mode for test room
  const isDemoMode = !isValidRoom || id === "test";
  const [demoPlayers] = useState([
    { id: 1, seatIndex: 0, chips: 98.5, currentBet: 2, totalBet: 2, isFolded: false, isAllIn: false, isActive: true, holeCards: ["As", "Kh"], name: "You" },
    { id: 2, seatIndex: 1, chips: 145, currentBet: 2, totalBet: 2, isFolded: false, isAllIn: false, isActive: false, holeCards: [], name: "Player2" },
    { id: 3, seatIndex: 2, chips: 67.3, currentBet: 0, totalBet: 0, isFolded: true, isAllIn: false, isActive: false, holeCards: [], name: "Player3" },
    { id: 4, seatIndex: 3, chips: 200, currentBet: 4, totalBet: 4, isFolded: false, isAllIn: false, isActive: false, holeCards: [], name: "Player4" },
    { id: 5, seatIndex: 4, chips: 0, currentBet: 55, totalBet: 55, isFolded: false, isAllIn: true, isActive: false, holeCards: [], name: "Player5" },
  ]);
  const [demoCommunity] = useState(["Ah", "Kd", "7s"]);
  const [demoMyCards] = useState(["As", "Kh"]);

  const displayPlayers = isDemoMode ? demoPlayers : players;
  const displayCommunity = isDemoMode ? demoCommunity : communityCards;
  const displayMyCards = isDemoMode ? demoMyCards : myCards;
  const displayPot = isDemoMode ? 12.5 : pot;
  const displayPhase = isDemoMode ? "flop" : phase;
  const displayIsMyTurn = isDemoMode ? true : isMyTurn;

  const handleFold = () => {
    if (isDemoMode) return toast.info(t("table.demoMode"));
    actionMutation.mutate({ roomId, action: "fold" });
  };

  const handleCall = () => {
    if (isDemoMode) return toast.info(t("table.demoMode"));
    actionMutation.mutate({ roomId, action: "call" });
  };

  const handleCheck = () => {
    if (isDemoMode) return toast.info(t("table.demoMode"));
    actionMutation.mutate({ roomId, action: "check" });
  };

  const handleRaise = () => {
    if (isDemoMode) return toast.info(t("table.demoMode"));
    actionMutation.mutate({ roomId, action: "raise", amount: raiseAmount });
  };

  const handleAllIn = () => {
    if (isDemoMode) return toast.info(t("table.demoMode"));
    actionMutation.mutate({ roomId, action: "all_in" });
  };

  const handleJoin = () => {
    if (!buyInAmount) return toast.error(t("table.buyIn"));
    joinMutation.mutate({ roomId, buyIn: parseFloat(buyInAmount) });
  };

  const handleLeave = () => {
    leaveMutation.mutate({ roomId });
  };

  // Find my player's current bet to determine if can check
  const myPlayer = displayPlayers.find(p => p.id === user?.id);
  const canCheck = myPlayer ? myPlayer.currentBet >= currentBet : false;

  return (
    <div className="h-screen bg-deep-space flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="glass-strong px-3 py-2 flex items-center justify-between z-10 border-b border-border/30">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {room ? room.name : isDemoMode ? "Demo" : `#${id}`}
          </span>
          {displayPhase !== "waiting" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/20 text-truth-blue font-medium">
              {getPhaseNames()[displayPhase] || displayPhase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isSeated && !isDemoMode && (
            <button onClick={handleLeave} className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all active:scale-95" title={t("table.leave")}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => navigate(`/history/${id}`)} className="p-1.5 rounded-lg text-gold hover:text-gold/80 hover:bg-gold/10 transition-all active:scale-95" title={t("table.handHistory")}>
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/verify")} className="p-1.5 rounded-lg text-truth-blue hover:text-truth-blue-bright hover:bg-truth-blue/10 transition-all active:scale-95">
            <Shield className="w-4 h-4" />
          </button>
          <button onClick={() => { setMuted(!muted); toggleSound(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Phase Progress Indicator */}
      {displayPhase !== "waiting" && (
        <div className="px-3 py-1.5 glass border-b border-border/20">
          <div className="flex items-center justify-center gap-1">
            {["preflop", "flop", "turn", "river"].map((phase, i) => {
              const phases = ["preflop", "flop", "turn", "river"];
              const currentIdx = phases.indexOf(displayPhase);
              const isActive = i === currentIdx;
              const isPast = i < currentIdx;
              return (
                <div key={phase} className="flex items-center">
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    isActive ? "w-8 bg-gradient-to-r from-gold to-gold-dim" :
                    isPast ? "w-5 bg-truth-blue/60" : "w-5 bg-secondary"
                  }`} />
                  {i < 3 && <div className="w-1" />}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-center text-muted-foreground mt-0.5">
            {getPhaseNames()[displayPhase]}
          </p>
        </div>
      )}

      {/* Connection Lost Banner */}
      {connectionLost && (
        <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-300">{t("table.reconnecting")}</span>
          </div>
          <button
            onClick={() => utils.game.tableState.invalidate({ roomId })}
            className="text-xs px-2 py-1 rounded bg-red-500/30 text-red-200 hover:bg-red-500/50 transition-colors active:scale-95"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Winner Announcement Overlay */}
      {showWinner && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="glass-strong rounded-2xl px-6 py-4 text-center animate-in fade-in zoom-in duration-300 max-w-[320px]">
            <Trophy className="w-8 h-8 text-gold mx-auto mb-2 animate-bounce" />
            <p className="text-sm font-bold text-gold">{showWinner.name} {t("table.won")}</p>
            <p className="text-xl font-black text-gold">${showWinner.amount.toFixed(2)}</p>
            {showWinner.handDescription && showWinner.handDescription !== "Last Standing" && (
              <p className="text-xs text-gold/70 mt-1">{showWinner.handDescription}</p>
            )}
            {/* Side pots info */}
            {showSettlement?.sidePots?.length > 1 && (
              <div className="mt-2 border-t border-gold/20 pt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Side Pots</p>
                {showSettlement.sidePots.map((sp: any, i: number) => (
                  <p key={i} className="text-xs text-foreground/80">
                    Pot {i + 1}: ${sp.amount.toFixed(2)} → {sp.winnerName}
                  </p>
                ))}
              </div>
            )}
            {/* Showdown players */}
            {showSettlement?.showdownPlayers?.length > 1 && (
              <div className="mt-2 border-t border-gold/20 pt-2 space-y-1">
                {showSettlement.showdownPlayers.map((sp: any) => (
                  <div key={sp.playerId} className="flex items-center justify-between text-xs">
                    <span className="text-foreground/70">{sp.name}</span>
                    <span className="text-foreground/90 font-medium">{sp.handDescription}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 relative">
        {/* Poker Table */}
        <div className="absolute inset-3">
          {/* Table felt - oval shape */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-emerald-800/90 to-emerald-950/95 border-[6px] border-amber-900/70 shadow-[inset_0_0_80px_rgba(0,0,0,0.6),0_0_40px_rgba(0,0,0,0.4)]">
            {/* Table inner ring */}
            <div className="absolute inset-3 rounded-[50%] border border-amber-800/25" />
            {/* Table texture */}
            <div className="absolute inset-0 rounded-[50%] bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.2)_100%)]" />
            
            {/* Pot display */}
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <AnimatedPot amount={displayPot} />
              {displayPlayers.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{displayPlayers.filter(p => !p.isFolded).length}/{displayPlayers.length}</span>
                </div>
              )}
            </div>

            {/* Community Cards */}
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1">
              {displayCommunity.map((card, i) => (
                <CardView key={`${card}-${i}`} card={card} animate={animateCards} delay={i * 150} />
              ))}
              {/* Placeholder for remaining cards */}
              {Array.from({ length: Math.max(0, 5 - displayCommunity.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-10 h-14 rounded-lg border border-dashed border-white/8" />
              ))}
            </div>
          </div>

          {/* Player Seats */}
          {displayPlayers.map(player => {
            const pos = SEAT_POSITIONS[player.seatIndex];
            if (!pos) return null;
            const isHero = player.id === user?.id || (isDemoMode && player.seatIndex === 0);
            const isCurrentTurn = isDemoMode ? player.isActive : (tableState?.currentPlayerId === player.id);
            return (
              <div
                key={player.id}
                className="absolute transition-all duration-300"
                style={{ top: pos.top, left: pos.left, transform: pos.transform }}
              >
                <div className={`flex flex-col items-center gap-0.5 ${isCurrentTurn ? "scale-105" : ""} transition-transform duration-200`}>
                  {/* Turn indicator ring */}
                  {isCurrentTurn && (
                    <div className="absolute -inset-1 rounded-xl border-2 border-gold/60 animate-pulse" />
                  )}

                  {/* Player cards */}
                  {isHero && displayMyCards.length > 0 && (
                    <div className="flex gap-0.5 mb-0.5">
                      {displayMyCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-9 !h-[52px]" animate delay={i * 200} />
                      ))}
                    </div>
                  )}
                  {!isHero && player.holeCards && player.holeCards.length > 0 && (
                    <div className="flex gap-0.5 mb-0.5">
                      {player.holeCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-8 !h-11" />
                      ))}
                    </div>
                  )}
                  {!isHero && (!player.holeCards || player.holeCards.length === 0) && !player.isFolded && displayPhase !== "waiting" && (
                    <div className="flex gap-0.5 mb-0.5">
                      <CardView faceDown className="!w-7 !h-10" />
                      <CardView faceDown className="!w-7 !h-10" />
                    </div>
                  )}

                  {/* Player info card */}
                  <div className={`glass rounded-lg px-2.5 py-1 text-center min-w-[64px] transition-all duration-200 ${
                    player.isFolded ? "opacity-30 grayscale" : ""
                  } ${player.isAllIn ? "border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : ""
                  } ${isHero ? "border border-truth-blue/40" : ""}`}>
                    <p className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-tight">
                      {isHero ? "你" : (player as any).name || `P${player.seatIndex + 1}`}
                    </p>
                    <p className={`text-[11px] font-bold leading-tight ${
                      player.isAllIn ? "text-red-400" : player.isFolded ? "text-muted-foreground" : "text-foreground"
                    }`}>
                      {player.isAllIn ? "ALL IN" : player.isFolded ? t("table.fold") : `$${player.chips.toFixed(1)}`}
                    </p>
                  </div>

                  {/* Current bet chip stack */}
                  {player.currentBet > 0 && !player.isFolded && (
                    <ChipStack amount={player.currentBet} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Join button overlay when not seated */}
          {!isSeated && !isDemoMode && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm rounded-[50%]">
              <div className="glass-strong rounded-2xl p-5 text-center max-w-[260px] border border-border/30">
                {showBuyIn ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground">{t("table.buyIn")}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      ${room ? parseFloat(room.minBuyIn).toFixed(0) : "0"} - ${room ? parseFloat(room.maxBuyIn).toFixed(0) : "0"}
                    </p>
                    <input
                      type="number"
                      value={buyInAmount}
                      onChange={(e) => setBuyInAmount(e.target.value)}
                      placeholder={t("table.buyIn")}
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary text-foreground text-sm text-center border border-border/50 focus:border-truth-blue/50 focus:outline-none transition-colors"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowBuyIn(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors active:scale-[0.97]">
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={handleJoin}
                        disabled={joinMutation.isPending}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-truth-blue to-truth-blue-bright text-white text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-50"
                      >
                        {joinMutation.isPending ? "..." : t("table.sitDown")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-truth-blue/10 flex items-center justify-center mx-auto">
                      <LogIn className="w-6 h-6 text-truth-blue" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{t("table.sitDown")}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {room ? `${room.name} · ${room.smallBlind}/${room.bigBlind}` : "..."}
                    </p>
                    <button
                      onClick={() => setShowBuyIn(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-truth-blue to-truth-blue-bright text-white font-semibold text-sm hover:opacity-90 transition-opacity active:scale-[0.97]"
                    >
                      {t("table.sitDown")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My Cards Display (Hero cards at bottom, larger) */}
      {(isSeated || isDemoMode) && displayMyCards.length > 0 && (
        <div className="flex justify-center gap-1 -mt-2 mb-1 z-10">
          {displayMyCards.map((card, i) => (
            <CardView key={i} card={card} className="!w-12 !h-[68px] !shadow-xl" animate delay={i * 300} />
          ))}
        </div>
      )}

      {/* Action Panel */}
      {(isSeated || isDemoMode) && (
        <div className="glass-strong border-t border-border/30 px-3 py-2.5 z-10">
          {/* Countdown Timer */}
          {displayIsMyTurn && (
            <div className={`mb-2 ${isUrgent ? "animate-pulse" : ""}`}>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    countdown > 10 
                      ? "bg-gradient-to-r from-truth-blue to-gold" 
                      : countdown > 5
                        ? "bg-gradient-to-r from-orange-400 to-yellow-500"
                        : "bg-gradient-to-r from-red-600 to-red-400 animate-pulse"
                  }`}
                  style={{ width: `${(countdown / turnTimeout) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Clock className={`w-3 h-3 ${isUrgent ? "text-red-400 animate-spin" : "text-gold"}`} />
                <p className={`text-[10px] font-bold ${
                  isUrgent ? "text-red-400 text-xs" : "text-gold"
                }`}>
                  {t("table.yourTurn")} · {countdown}s
                </p>
              </div>
            </div>
          )}

          {displayPhase === "waiting" && !isDemoMode && (
            <div className="text-center py-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-truth-blue animate-pulse" />
                <span className="text-sm text-muted-foreground">{t("table.waiting")}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">Min 2 players</span>
            </div>
          )}

          {(displayPhase !== "waiting" || isDemoMode) && (
            <>
              {/* Raise slider */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] text-muted-foreground min-w-[36px]">${(currentBet * 2).toFixed(0)}</span>
                <input
                  type="range"
                  min={currentBet * 2}
                  max={myPlayer ? myPlayer.chips + myPlayer.currentBet : 100}
                  step={0.5}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-gold [&::-webkit-slider-thumb]:to-gold-dim [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold/50"
                />
                <span className="text-[10px] text-gold font-bold min-w-[40px] text-right">${raiseAmount.toFixed(0)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={handleFold}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground font-semibold text-xs hover:bg-secondary/80 transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  {t("table.fold")}
                </button>
                {canCheck ? (
                  <button
                    onClick={handleCheck}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-2.5 rounded-xl bg-truth-blue text-white font-semibold text-xs hover:bg-truth-blue/80 transition-all glow-blue active:scale-[0.97] disabled:opacity-40"
                  >
                    {t("table.check")}
                  </button>
                ) : (
                  <button
                    onClick={handleCall}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-2.5 rounded-xl bg-truth-blue text-white font-semibold text-xs hover:bg-truth-blue/80 transition-all glow-blue active:scale-[0.97] disabled:opacity-40"
                  >
                    {t("table.call")} ${currentBet.toFixed(0)}
                  </button>
                )}
                <button
                  onClick={handleRaise}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-xs hover:opacity-90 transition-all glow-gold active:scale-[0.97] disabled:opacity-40"
                >
                  {t("table.raise")} ${raiseAmount.toFixed(0)}
                </button>
              </div>

              {/* All-in button */}
              <button
                onClick={handleAllIn}
                disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                className="w-full mt-1.5 py-2 rounded-xl border border-red-500/40 text-red-400 font-bold text-[11px] hover:bg-red-500/10 transition-all active:scale-[0.97] disabled:opacity-40 uppercase tracking-wider"
              >
                {t("table.allIn")} {myPlayer ? `$${myPlayer.chips.toFixed(0)}` : ""}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
