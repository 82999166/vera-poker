import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, getLocale } from "@/lib/i18n";
import { ArrowLeft, Shield, Volume2, VolumeX, LogIn, LogOut, Trophy, Clock, Users, Plus, AlertTriangle, Settings } from "lucide-react";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";

// Card rendering with animation support
const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: "\u2660", color: "text-gray-900" },
  h: { symbol: "\u2665", color: "text-red-500" },
  d: { symbol: "\u2666", color: "text-red-500" },
  c: { symbol: "\u2663", color: "text-gray-900" },
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
    // Card back: clean red design with subtle pattern
    return (
      <div className={`w-11 h-[60px] rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.6),0_2px_4px_rgba(0,0,0,0.4)] transition-all duration-300 ${animate && !visible ? "scale-0 opacity-0" : "scale-100 opacity-100"} ${className}`}>
        <div className="w-full h-full bg-gradient-to-br from-[#d63031] to-[#b71c1c] border-[2px] border-white/90 rounded-md relative">
          {/* Inner border */}
          <div className="absolute inset-[3px] border-[1.5px] border-white/50 rounded-sm" />
          {/* Simple diagonal lines - sparse */}
          <div className="absolute inset-[6px] rounded-sm overflow-hidden" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)`,
          }} />
          {/* Center logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/30 border-[1.5px] border-white/50 flex items-center justify-center">
              <span className="text-[9px] font-black text-white">VP</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const suitInfo = SUITS[suit] || SUITS.s;
  const displayRank = RANK_DISPLAY[rank] || rank;
  const isRed = suit === 'h' || suit === 'd';

  return (
    <div className={`w-14 h-[76px] rounded-lg overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.6),0_3px_6px_rgba(0,0,0,0.4)] transition-all duration-300 ${animate && !visible ? "scale-0 opacity-0 -translate-y-4" : "scale-100 opacity-100 translate-y-0"} ${className}`}>
      <div className="w-full h-full bg-white border-[1.5px] border-gray-300 rounded-lg relative">
        {/* Top-left rank + suit */}
        <div className="absolute top-1 left-1 flex flex-col items-center leading-none">
          <span className={`text-[18px] font-black leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{displayRank}</span>
          <span className={`text-[13px] leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{suitInfo.symbol}</span>
        </div>
        {/* Bottom-right rank + suit (inverted) */}
        <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180">
          <span className={`text-[18px] font-black leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{displayRank}</span>
          <span className={`text-[13px] leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{suitInfo.symbol}</span>
        </div>
      </div>
    </div>
  );
}

// Chip stack visualization with flying animation
function ChipStack({ amount, size = "sm", animate = false }: { amount: number; size?: "sm" | "md"; animate?: boolean }) {
  if (amount <= 0) return null;
  const prevAmountRef = useRef(amount);
  const [showFlyChips, setShowFlyChips] = useState(false);
  const chipCount = Math.min(5, Math.max(1, Math.ceil(amount / 10))); // 1-5 chips based on amount

  useEffect(() => {
    if (amount > prevAmountRef.current) {
      setShowFlyChips(true);
      const timer = setTimeout(() => setShowFlyChips(false), 700);
      return () => clearTimeout(timer);
    }
    prevAmountRef.current = amount;
  }, [amount]);

  return (
    <div className="relative">
      {/* Flying chip particles when bet increases */}
      {showFlyChips && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: chipCount }).map((_, i) => (
            <div
              key={`fly-${i}-${amount}`}
              className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-600/80 shadow-[0_0_6px_rgba(234,179,8,0.6)] animate-chip-scatter"
              style={{
                left: '50%',
                top: '50%',
                '--scatter-x': `${(Math.random() - 0.5) * 30}px`,
                '--scatter-y': `${-30 - Math.random() * 30}px`,
                '--scatter-r': `${Math.random() * 360}deg`,
                animationDelay: `${i * 60}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      <div className={`flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5 border border-gold/30 ${showFlyChips ? "animate-chip" : ""}`}>
        {/* Gold coin icon */}
        <div className={`${size === "sm" ? "w-4 h-4" : "w-5 h-5"} rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-600/80 flex items-center justify-center shadow-[0_0_4px_rgba(234,179,8,0.5)]`}>
          <span className={`${size === "sm" ? "text-[7px]" : "text-[8px]"} font-black text-yellow-900`}>$</span>
        </div>
        <span className={`${size === "sm" ? "text-[11px]" : "text-sm"} text-yellow-300 font-bold drop-shadow-[0_0_3px_rgba(234,179,8,0.4)]`}>{amount.toFixed(2)}</span>
      </div>
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
    <div className="bg-black/70 rounded-full px-4 py-1.5 inline-flex items-center gap-2 border border-gold/40 shadow-[0_0_12px_rgba(234,179,8,0.3)] transition-all duration-300">
      {/* Large gold coin icon */}
      <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-2 border-yellow-600/80 flex items-center justify-center shadow-[0_0_8px_rgba(234,179,8,0.6)] ${amount > 0 ? "animate-pulse" : ""}`}>
        <span className="text-[10px] font-black text-yellow-900">$</span>
      </div>
      <span className={`text-base font-black text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)] transition-all duration-300 ${amount > prevAmount.current ? "scale-110" : ""}`}>
        ${displayAmount.toFixed(2)}
      </span>
    </div>
  );
}

// Default avatar for players without a Telegram profile photo
const DEFAULT_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/default-avatar-aXRqAewdDSMxKYhaCU9DtA.webp";

// Player seat positions for 6-max table (oval layout)
// Seats positioned outside the table oval, but within screen bounds
const SEAT_POSITIONS = [
  { top: "96%", left: "50%", transform: "translate(-50%, -50%)" },   // Bottom (hero)
  { top: "72%", left: "4%", transform: "translate(0, -50%)" },      // Left bottom
  { top: "26%", left: "4%", transform: "translate(0, -50%)" },      // Left top
  { top: "2%", left: "50%", transform: "translate(-50%, 0)" },       // Top
  { top: "26%", left: "96%", transform: "translate(-100%, -50%)" }, // Right top
  { top: "72%", left: "96%", transform: "translate(-100%, -50%)" }, // Right bottom
];

// Hand rank translation helper - maps English server descriptions to i18n keys
const HAND_RANK_MAP: Record<string, string> = {
  "Royal Flush": "hand.royalFlush",
  "Straight Flush": "hand.straightFlush",
  "Four of a Kind": "hand.fourOfAKind",
  "Full House": "hand.fullHouse",
  "Flush": "hand.flush",
  "Straight": "hand.straight",
  "Three of a Kind": "hand.threeOfAKind",
  "Two Pair": "hand.twoPair",
  "One Pair": "hand.onePair",
  "High Card": "hand.highCard",
  "Last Standing": "hand.lastStanding",
};

export default function Table() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const { play: playSound, toggle: toggleSound, isEnabled: isSoundEnabled, announceAction, speak, voiceMode, setVoiceMode } = useSoundEffects();
  const [muted, setMuted] = useState(() => localStorage.getItem("vera-sound-enabled") === "false");
  const [raiseAmount, setRaiseAmount] = useState(4.00);
  const [isSeated, setIsSeated] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [showBuyIn, setShowBuyIn] = useState(false);
  const [lastPhase, setLastPhase] = useState("");
  const [animateCards, setAnimateCards] = useState(false);
  const [showWinner, setShowWinner] = useState<{ name: string; amount: number; handDescription?: string } | null>(null);
  const [showSettlement, setShowSettlement] = useState<any>(null);
  const [winnerPlayerIds, setWinnerPlayerIds] = useState<number[]>([]);
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

  // Detect winner - trigger when lastWinner appears OR phase becomes completed
  const prevWinnerRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<string>("");
  useEffect(() => {
    const currentPhase = tableState?.phase || "";
    const winnerKey = tableState?.lastWinner ? `${tableState.lastWinner.name}-${tableState.lastWinner.amount}` : null;
    
    // Trigger when:
    // 1. Phase transitions to completed and we have winner data
    // 2. OR lastWinner appears (even if we missed the phase transition due to polling)
    const phaseJustCompleted = currentPhase === "completed" && prevPhaseRef.current !== "completed";
    const winnerJustAppeared = winnerKey && winnerKey !== prevWinnerRef.current;
    
    if ((phaseJustCompleted || winnerJustAppeared) && tableState?.lastWinner && !showWinner) {
      setShowWinner(tableState.lastWinner);
      if (tableState.settlementDetail) {
        setShowSettlement(tableState.settlementDetail);
        const wIds = tableState.settlementDetail.winners?.map((w: any) => w.playerId) || [];
        setWinnerPlayerIds(wIds);
      }
      // Play win/lose sound and announce winning hand type
      if (!muted) {
        const wIds = tableState.settlementDetail?.winners?.map((w: any) => w.playerId) || [];
        if (user && wIds.includes(user.id)) {
          playSound("win");
        } else if (user && wIds.length > 0) {
          playSound("lose");
        } else {
          playSound("win");
        }
        // Announce winning hand type like a real casino dealer (follows system language)
        const primaryWinner = tableState.settlementDetail?.winners?.sort((a: any, b: any) => b.amount - a.amount)?.[0];
        if (primaryWinner && primaryWinner.handDescription && primaryWinner.handDescription !== "Last Standing") {
          const handKey = HAND_RANK_MAP[primaryWinner.handDescription];
          const handName = handKey ? t(handKey) : primaryWinner.handDescription;
          const currentLang = getLocale();
          const winText = currentLang.startsWith("zh") ? `${primaryWinner.name}, ${handName}赢`
            : currentLang === "ja" ? `${primaryWinner.name}, ${handName}で勝ち`
            : currentLang === "ko" ? `${primaryWinner.name}, ${handName} 승리`
            : currentLang === "es" ? `${primaryWinner.name} gana con ${handName}`
            : currentLang === "pt" ? `${primaryWinner.name} ganha com ${handName}`
            : currentLang === "ru" ? `${primaryWinner.name} выиграл, ${handName}`
            : currentLang === "vi" ? `${primaryWinner.name} thắng với ${handName}`
            : currentLang === "th" ? `${primaryWinner.name} ชนะด้วย ${handName}`
            : `${primaryWinner.name} wins with ${handName}`;
          setTimeout(() => {
            speak(winText);
          }, 800);
        } else if (primaryWinner && primaryWinner.handDescription === "Last Standing") {
          const currentLang = getLocale();
          const foldWinText = currentLang.startsWith("zh") ? `${primaryWinner.name}赢，其他玩家弃牌`
            : currentLang === "ja" ? `${primaryWinner.name}の勝ち、他のプレイヤーがフォールド`
            : currentLang === "ko" ? `${primaryWinner.name} 승리, 다른 플레이어 폴드`
            : `${primaryWinner.name} wins, others folded`;
          setTimeout(() => {
            speak(foldWinText);
          }, 800);
        }
      }
      setTimeout(() => { setShowWinner(null); setShowSettlement(null); setWinnerPlayerIds([]); }, 3500);
    }
    
    prevPhaseRef.current = currentPhase;
    prevWinnerRef.current = winnerKey;
    // Also track handNumber for reference
    if (tableState?.handNumber && tableState.handNumber !== prevHandRef.current) {
      prevHandRef.current = tableState.handNumber;
    }
  }, [tableState?.phase, tableState?.handNumber, tableState?.lastWinner, tableState?.settlementDetail, muted, playSound, user]);

  // Detect other players' actions for voice announcement
  const lastActionInfoRef = useRef<any>(null);
  useEffect(() => {
    const info = (tableState as any)?.lastActionInfo;
    if (!info || muted) return;
    // Only announce if it's a new action from another player
    const infoKey = `${info.playerId}-${info.timestamp}`;
    if (infoKey !== lastActionInfoRef.current && info.playerId !== user?.id) {
      lastActionInfoRef.current = infoKey;
      announceAction(info.action, info.amount, info.playerName);
    }
  }, [(tableState as any)?.lastActionInfo, muted, user?.id, announceAction]);

  // Mutations
  const joinMutation = trpc.game.join.useMutation({
    onSuccess: (data) => {
      setIsSeated(true);
      setShowBuyIn(false);
      toast.success(t("table.seatJoined", { seat: data.seatIndex + 1 }));
      // Immediately refetch table state to show avatar
      utils.game.tableState.invalidate({ roomId });
      utils.rooms.getPlayers.invalidate({ roomId });
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.game.leave.useMutation({
    onSuccess: () => {
      setIsSeated(false);
      toast.success(t("table.left"));
      utils.wallet.balance.invalidate();
      // Navigate back to lobby after leaving
      navigate("/lobby");
    },
    onError: (err) => toast.error(err.message),
  });

  // allRooms query removed - auto-switch after fold disabled

  const actionMutation = trpc.game.action.useMutation({
    onSuccess: (_, variables) => {
      utils.game.tableState.invalidate({ roomId });
      // Play sound based on action type + voice announcement
      if (!muted) {
        const action = (variables as any)?.action;
        const amount = (variables as any)?.amount;
        if (action === "fold") { playSound("fold"); announceAction("fold"); }
        else if (action === "check") { playSound("check"); announceAction("check"); }
        else if (action === "call") { playSound("call"); announceAction("call", amount); }
        else if (action === "raise" || action === "bet") { playSound("bet"); announceAction("raise", amount); }
        else if (action === "all_in" || action === "allin") { playSound("allIn"); announceAction("all_in", amount); }
      }
      // Note: Auto-switch after fold removed to prevent players being split across tables
      // Players stay at their current table and can manually switch if desired
    },
    onError: (err) => toast.error(err.message),
  });

  const readyMutation = trpc.game.ready.useMutation({
    onSuccess: () => {
      utils.game.tableState.invalidate({ roomId });
      if (!muted) playSound("check");
    },
    onError: (err) => toast.error(err.message),
  });

  // === Rebuy ===
  const [showRebuyDialog, setShowRebuyDialog] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState("");
  const [showAutoRebuySettings, setShowAutoRebuySettings] = useState(false);

  // Wallet balance for rebuy
  const myChipsForWallet = (tableState?.players ?? []).find((p: any) => p.id === user?.id)?.chips;
  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user && (showRebuyDialog || myChipsForWallet === 0) });

  // Auto-rebuy settings from localStorage
  const getAutoRebuySettings = () => {
    try {
      const saved = localStorage.getItem(`vera-auto-rebuy-${roomId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, threshold: 0, targetAmount: 0 };
  };
  const [autoRebuySettings, setAutoRebuySettings] = useState(getAutoRebuySettings);

  const saveAutoRebuySettings = (settings: { enabled: boolean; threshold: number; targetAmount: number }) => {
    setAutoRebuySettings(settings);
    localStorage.setItem(`vera-auto-rebuy-${roomId}`, JSON.stringify(settings));
  };

  const rebuyMutation = trpc.game.rebuy.useMutation({
    onSuccess: (data) => {
      setShowRebuyDialog(false);
      setRebuyAmount("");
      toast.success(t("rebuy.success"));
      utils.game.tableState.invalidate({ roomId });
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const autoRebuyTriggeredRef = useRef<number>(0);

  const handleRebuy = () => {
    const amount = parseFloat(rebuyAmount);
    if (!amount || amount <= 0) return toast.error(t("rebuy.invalidAmount"));
    rebuyMutation.mutate({ roomId, amount });
  };

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
  const waitingForReady = tableState?.waitingForReady ?? false;
  const readyPlayers = tableState?.readyPlayers ?? [];
  const readyCountdown = tableState?.readyCountdown ?? null;
  const amIReady = user ? readyPlayers.includes(user.id) : false;

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

  // Check URL for autoJoin flag (direct entry from lobby quick-join)
  const autoJoinRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoJoin") === "true") {
      autoJoinRef.current = true;
      // Clean up URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (roomPlayers && user) {
      const seated = roomPlayers.some((p: any) => p.userId === user.id);
      setIsSeated(seated);
      // If autoJoin (same-stakes switch), auto-join with min buy-in
      if (!seated && isValidRoom && autoJoinRef.current && room) {
        autoJoinRef.current = false;
        const minBuyIn = parseFloat(room.minBuyIn);
        joinMutation.mutate({ roomId, buyIn: minBuyIn });
      } else if (!seated && isValidRoom && !autoJoinRef.current) {
        // Normal entry - show buy-in dialog
        setShowBuyIn(true);
      }
    }
  }, [roomPlayers, user, isValidRoom, room]);

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
  // When waitingForReady (between hands), clear community cards and hand cards to avoid showing last hand's cards
  const displayCommunity = isDemoMode ? demoCommunity : (waitingForReady ? [] : communityCards);
  const displayMyCards = isDemoMode ? demoMyCards : (waitingForReady ? [] : myCards);
  const displayPot = isDemoMode ? 12.5 : (waitingForReady ? 0 : pot);
  const displayPhase = isDemoMode ? "flop" : phase;
  const displayIsMyTurn = isDemoMode ? true : isMyTurn;

  const phaseNames: Record<string, string> = {
    waiting: t("table.waiting"),
    preflop: t("table.phasePreflop"),
    flop: t("table.phaseFlop"),
    turn: t("table.phaseTurn"),
    river: t("table.phaseRiver"),
    showdown: t("table.phaseShowdown"),
    completed: t("table.phaseShowdown"),
  };

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
  const bigBlindValue = room ? parseFloat(room.bigBlind) : 2;
  const canRebuy = isSeated && (waitingForReady || phase === "waiting") && !isDemoMode;
  const isLowChips = myPlayer && myPlayer.chips > 0 && myPlayer.chips < bigBlindValue * 5;

  // Auto-rebuy trigger: when waitingForReady becomes true and auto-rebuy is enabled
  useEffect(() => {
    if (waitingForReady && autoRebuySettings.enabled && myPlayer && room) {
      const handNum = tableState?.handNumber ?? 0;
      if (handNum > autoRebuyTriggeredRef.current && myPlayer.chips < autoRebuySettings.threshold) {
        autoRebuyTriggeredRef.current = handNum;
        const maxBuyIn = parseFloat(room.maxBuyIn);
        const target = Math.min(autoRebuySettings.targetAmount, maxBuyIn);
        const needed = Math.max(0, target - myPlayer.chips);
        if (needed > 0) {
          rebuyMutation.mutate({ roomId, amount: needed });
        }
      }
    }
  }, [waitingForReady, autoRebuySettings, myPlayer?.chips, tableState?.handNumber]);

  return (
    <div className="h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#060e1a] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="glass-strong px-3 py-2 flex items-center justify-between z-10 border-b border-border/30">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {room ? room.name : isDemoMode ? t("table.demo") : `#${id}`}
          </span>
          {displayPhase !== "waiting" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/20 text-truth-blue font-medium">
              {phaseNames[displayPhase] || displayPhase}
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
          {/* Voice mode toggle: off → winner_only → all → off */}
          <button
            onClick={() => {
              const modes: Array<"off" | "winner_only" | "all"> = ["off", "winner_only", "all"];
              const currentIdx = modes.indexOf(voiceMode);
              const nextMode = modes[(currentIdx + 1) % 3];
              setVoiceMode(nextMode);
              const labels: Record<string, string> = {
                off: t("voice.off"),
                winner_only: t("voice.winnerOnly"),
                all: t("voice.all"),
              };
              toast(labels[nextMode], { duration: 1500 });
            }}
            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
              voiceMode === "off" ? "text-muted-foreground/50" :
              voiceMode === "winner_only" ? "text-gold" :
              "text-green-400"
            } hover:bg-secondary`}
            title={voiceMode === "off" ? t("voice.off") : voiceMode === "winner_only" ? t("voice.winnerOnly") : t("voice.all")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              {voiceMode === "off" ? (
                <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><line x1="4" x2="20" y1="4" y2="20"/></>
              ) : voiceMode === "winner_only" ? (
                <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>
              ) : (
                <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></>
              )}
            </svg>
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
            {phaseNames[displayPhase]}
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
          {/* Confetti particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${20 + Math.random() * 30}%`,
                  width: `${4 + Math.random() * 6}px`,
                  height: `${4 + Math.random() * 6}px`,
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][i % 6],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  animationDelay: `${Math.random() * 0.8}s`,
                  animationDuration: `${1.5 + Math.random() * 1}s`,
                }}
              />
            ))}
          </div>
          {/* Winner banner */}
          <div className="animate-banner bg-black/80 backdrop-blur-md rounded-2xl px-6 py-5 text-center max-w-[320px] border-2 border-gold/50 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <div className="relative">
              <Trophy className="w-10 h-10 text-gold mx-auto mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" />
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gold/10 animate-ping" />
            </div>
            <p className="text-base font-bold text-gold drop-shadow-[0_0_4px_rgba(234,179,8,0.4)]">{showWinner.name} {t("table.won")}</p>
            <p className="text-2xl font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] mt-1">${showWinner.amount.toFixed(2)}</p>
            {showWinner.handDescription && showWinner.handDescription !== "Last Standing" && (
              <p className="text-sm text-gold/80 mt-1 font-medium">{HAND_RANK_MAP[showWinner.handDescription] ? t(HAND_RANK_MAP[showWinner.handDescription]) : showWinner.handDescription}</p>
            )}
            {/* Side pots info */}
            {showSettlement?.sidePots?.length > 1 && (
              <div className="mt-3 border-t border-gold/20 pt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("table.sidePots")}</p>
                {showSettlement.sidePots.map((sp: any, i: number) => (
                  <p key={i} className="text-xs text-foreground/80">
                    {t("table.potNumber", { n: i + 1 })}: ${sp.amount.toFixed(2)} → {sp.winnerName}
                  </p>
                ))}
              </div>
            )}
            {/* Showdown players */}
            {showSettlement?.showdownPlayers?.length > 1 && (
              <div className="mt-3 border-t border-gold/20 pt-2 space-y-1.5">
                {showSettlement.showdownPlayers.map((sp: any) => (
                  <div key={sp.playerId} className="flex items-center justify-between text-xs">
                    <span className="text-foreground/70">{sp.name}</span>
                    <span className={`font-medium ${winnerPlayerIds.includes(sp.playerId) ? "text-gold" : "text-foreground/90"}`}>{HAND_RANK_MAP[sp.handDescription] ? t(HAND_RANK_MAP[sp.handDescription]) : sp.handDescription}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/table-bg-clean-6gTEKxokqcP8zS3GCvWNKd.webp)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0a1a2e' }}>
        {/* Game content overlay */}
        <div className="absolute inset-0">
            
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

            {/* Community Cards - no placeholders, background has card slots */}
            <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
              {displayCommunity.map((card, i) => (
                <CardView key={`${card}-${i}`} card={card} className="!w-[52px] !h-[72px]" animate={animateCards} delay={i * 150} />
              ))}
            </div>

            {/* Start Next Hand button in center of table - only show after settlement overlay dismissed */}
            {waitingForReady && !isDemoMode && !showWinner && (
              <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
                {myPlayer && myPlayer.chips <= 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="px-4 py-2 rounded-full bg-black/60 border border-red-500/50 text-red-400 text-xs font-semibold">
                      {t("table.noChips")}
                    </div>
                    <button
                      onClick={() => setShowRebuyDialog(true)}
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold shadow-lg active:scale-[0.97]"
                    >
                      {t("rebuy.addChips")}
                    </button>
                    <button
                      onClick={() => leaveMutation.mutate({ roomId })}
                      className="px-3 py-1 rounded-full bg-black/40 border border-border/30 text-muted-foreground text-[10px] hover:text-foreground transition-colors active:scale-[0.97]"
                    >
                      {t("table.backToLobby")}
                    </button>
                  </div>
                ) : !amIReady ? (
                  <button
                    onClick={() => readyMutation.mutate({ roomId })}
                    disabled={readyMutation.isPending}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-green-500/40 hover:shadow-green-500/60 transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ animation: 'pulse 2s infinite' }}
                  >
                    ▶ {t("table.startNextHand")}
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-full bg-black/60 border border-green-500/50 text-green-400 text-xs font-semibold">
                    ✓ {t("table.readyWaiting")}
                  </div>
                )}
                {readyCountdown !== null && (
                  <span className="mt-1 text-[10px] text-white/60">{readyCountdown}s</span>
                )}
                {/* Rebuy button between hands */}
                {canRebuy && myPlayer && myPlayer.chips > 0 && (
                  <button
                    onClick={() => setShowRebuyDialog(true)}
                    className="mt-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/80 to-yellow-600/80 text-white text-[11px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {t("rebuy.addChips")}
                  </button>
                )}
              </div>
            )}
          {/* Player Seats - positioned outside the table */}
          {(() => {
            const maxSeats = room?.maxPlayers ?? 6;
            const heroSeatIndex = displayPlayers.find(p => p.id === user?.id)?.seatIndex ?? displayPlayers[0]?.seatIndex ?? 0;
            return displayPlayers.map(player => {
            const rotatedIndex = ((player.seatIndex - heroSeatIndex + maxSeats) % maxSeats) % SEAT_POSITIONS.length;
            const pos = SEAT_POSITIONS[rotatedIndex];
            if (!pos) return null;
            const isHero = player.id === user?.id || (isDemoMode && player.seatIndex === 0);
            const isCurrentTurn = isDemoMode ? player.isActive : (tableState?.currentPlayerId === player.id);
            const isWinner = winnerPlayerIds.includes(player.id);
            const isLoser = winnerPlayerIds.length > 0 && !winnerPlayerIds.includes(player.id) && !player.isFolded;
            return (
              <div
                key={player.id}
                className={`absolute transition-all duration-300 z-10 ${isLoser ? "animate-loser" : ""}`}
                style={{ top: pos.top, left: pos.left, transform: pos.transform }}
              >
                <div className={`flex flex-col items-center gap-0.5 ${isCurrentTurn ? "scale-110" : ""} ${isWinner ? "animate-winner-glow" : ""} transition-transform duration-200`}>
                  {/* Player cards next to seat */}
                  {isHero && displayMyCards.length > 0 && (
                    <div className="flex gap-1 mb-0.5">
                      {displayMyCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-14 !h-[76px]" animate delay={i * 200} />
                      ))}
                    </div>
                  )}
                  {!isHero && player.holeCards && player.holeCards.length > 0 && !waitingForReady && (
                    <div className="flex gap-0.5 mb-0.5">
                      {player.holeCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-10 !h-[54px]" />
                      ))}
                    </div>
                  )}
                  {!isHero && (!player.holeCards || player.holeCards.length === 0) && !player.isFolded && displayPhase !== "waiting" && !waitingForReady && (
                    <div className="flex gap-0.5 mb-0.5">
                      <CardView faceDown className="!w-9 !h-[50px]" />
                      <CardView faceDown className="!w-9 !h-[50px]" />
                    </div>
                  )}

                  {/* Avatar circle */}
                  <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                    isWinner ? "border-gold shadow-[0_0_20px_rgba(234,179,8,0.8)] scale-110" :
                    isCurrentTurn ? "border-gold shadow-[0_0_12px_rgba(212,175,55,0.6)]" :
                    isHero ? "border-truth-blue/60" :
                    player.isFolded ? "border-white/10 opacity-40" : "border-white/30"
                  }`}>
                    <img
                      src={(player as any).avatar || DEFAULT_AVATAR}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                    />
                    {isCurrentTurn && (
                      <div className="absolute inset-0 rounded-full border-2 border-gold animate-pulse" />
                    )}
                  </div>

                  {/* Player info below avatar */}
                  <div className={`glass rounded-lg px-2 py-0.5 text-center min-w-[60px] transition-all duration-200 ${
                    player.isFolded ? "opacity-30 grayscale" : ""
                  } ${player.isAllIn ? "border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : ""}`}>
                    <p className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-tight">
                      {isHero ? t("table.you") : (player as any).name || `P${player.seatIndex + 1}`}
                    </p>
                    <p className={`text-[11px] font-bold leading-tight ${
                      player.isAllIn ? "text-red-400" : player.isFolded ? "text-muted-foreground" : "text-foreground"
                    }`}>
                      {player.isAllIn ? t("table.allIn") : player.isFolded ? t("table.fold") : `$${player.chips.toFixed(1)}`}
                    </p>
                  </div>

                  {/* Current bet chip stack */}
                  {player.currentBet > 0 && !player.isFolded && (
                    <ChipStack amount={player.currentBet} />
                  )}

                  {/* Winner gold coins flying in + amount pop-up */}
                  {isWinner && showWinner && (
                    <div className="relative mt-1">
                      {/* Flying gold coins */}
                      <div className="flex justify-center gap-0.5 mb-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="animate-chips-fly w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-600 shadow-[0_0_6px_rgba(234,179,8,0.5)] flex items-center justify-center"
                            style={{ animationDelay: `${i * 150}ms` }}
                          >
                            <span className="text-[6px] font-black text-yellow-900">$</span>
                          </div>
                        ))}
                      </div>
                      {/* Win amount */}
                      <div className="animate-amount-pop flex items-center justify-center gap-1 bg-black/70 rounded-full px-3 py-1 border border-gold/50 shadow-[0_0_12px_rgba(234,179,8,0.4)]">
                        <span className="text-base font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]">+${showWinner.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          });
          })()}

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



          {displayPhase === "waiting" && !waitingForReady && !isDemoMode && (
            <div className="text-center py-3">
              {players.length >= 2 ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => readyMutation.mutate({ roomId })}
                    disabled={readyMutation.isPending}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-green-500/40 hover:shadow-green-500/60 transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    ▶ {t("table.startNextHand")}
                  </button>
                  <span className="text-[10px] text-muted-foreground/60">{players.length} {t("table.minPlayers")}</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-truth-blue animate-pulse" />
                    <span className="text-sm text-muted-foreground">{t("table.waiting")}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">{t("table.minPlayers")}</span>
                </div>
              )}
            </div>
          )}

          {(displayPhase !== "waiting" || isDemoMode) && !waitingForReady && (
            <>
              {/* Raise slider */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] text-muted-foreground min-w-[36px]">${(currentBet * 2) < 1 ? (currentBet * 2).toFixed(2) : (currentBet * 2).toFixed(0)}</span>
                <input
                  type="range"
                  min={currentBet * 2}
                  max={myPlayer ? myPlayer.chips + myPlayer.currentBet : 100}
                  step={0.5}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-gold [&::-webkit-slider-thumb]:to-gold-dim [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold/50"
                />
                <span className="text-[10px] text-gold font-bold min-w-[40px] text-right">${raiseAmount < 1 ? raiseAmount.toFixed(2) : raiseAmount.toFixed(0)}</span>
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
                    {t("table.call")} ${currentBet < 1 ? currentBet.toFixed(2) : currentBet.toFixed(0)}
                  </button>
                )}
                <button
                  onClick={handleRaise}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-xs hover:opacity-90 transition-all glow-gold active:scale-[0.97] disabled:opacity-40"
                >
                  {t("table.raise")} ${raiseAmount < 1 ? raiseAmount.toFixed(2) : raiseAmount.toFixed(0)}
                </button>
              </div>

              {/* All-in button */}
              <button
                onClick={handleAllIn}
                disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                className="w-full mt-1.5 py-2 rounded-xl border border-red-500/40 text-red-400 font-bold text-[11px] hover:bg-red-500/10 transition-all active:scale-[0.97] disabled:opacity-40 uppercase tracking-wider"
              >
                {t("table.allIn")} {myPlayer ? `$${myPlayer.chips < 1 ? myPlayer.chips.toFixed(2) : myPlayer.chips.toFixed(0)}` : ""}
              </button>
            </>
          )}
        </div>
      )}

      {/* Low Chips Warning Badge - shown near bottom when chips are low */}
      {isLowChips && canRebuy && !showRebuyDialog && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-bounce">
          <button
            onClick={() => setShowRebuyDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/90 text-white text-[11px] font-semibold shadow-lg shadow-orange-500/30 active:scale-[0.97] transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {t("rebuy.lowChips")}
          </button>
        </div>
      )}

      {/* Rebuy Dialog Overlay */}
      {showRebuyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowRebuyDialog(false)}>
          <div className="bg-[#1a2744] rounded-2xl p-5 w-[300px] max-w-[90vw] border border-border/30 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground text-center mb-3">{t("rebuy.title")}</h3>
            
            {/* Current chips & balance info */}
            <div className="flex justify-between text-[11px] text-muted-foreground mb-3">
              <span>{t("rebuy.currentChips")}: <span className="text-yellow-300 font-semibold">${myPlayer?.chips.toFixed(2) ?? "0"}</span></span>
              <span>{t("wallet.balance")}: <span className="text-green-400 font-semibold">${walletData?.balance ?? "0.00"}</span></span>
            </div>

            {/* Amount input */}
            <input
              type="number"
              value={rebuyAmount}
              onChange={e => setRebuyAmount(e.target.value)}
              placeholder={`${t("rebuy.amount")} (1 - ${room ? (parseFloat(room.maxBuyIn) - (myPlayer?.chips ?? 0)).toFixed(0) : "---"})`}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary text-foreground text-sm text-center border border-border/50 focus:border-gold/50 focus:outline-none transition-colors mb-2"
            />

            {/* Quick amount buttons */}
            <div className="flex gap-1.5 mb-3">
              {[50, 100, 200].map(amt => (
                <button
                  key={amt}
                  onClick={() => setRebuyAmount(String(amt))}
                  className="flex-1 py-1.5 rounded-lg bg-secondary text-[11px] text-muted-foreground font-medium hover:bg-secondary/80 hover:text-foreground transition-colors active:scale-[0.97]"
                >
                  +{amt}
                </button>
              ))}
              <button
                onClick={() => {
                  if (room && myPlayer) {
                    const max = parseFloat(room.maxBuyIn) - myPlayer.chips;
                    const balance = parseFloat(walletData?.balance ?? "0");
                    setRebuyAmount(String(Math.min(max, balance).toFixed(0)));
                  }
                }}
                className="flex-1 py-1.5 rounded-lg bg-gold/20 text-[11px] text-gold font-medium hover:bg-gold/30 transition-colors active:scale-[0.97]"
              >
                MAX
              </button>
            </div>

            {/* Max buy-in info */}
            <p className="text-[10px] text-muted-foreground/60 text-center mb-3">
              {t("rebuy.maxBuyIn")}: ${room ? parseFloat(room.maxBuyIn).toFixed(0) : "---"}
            </p>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowRebuyDialog(false)}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors active:scale-[0.97]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRebuy}
                disabled={rebuyMutation.isPending || !rebuyAmount}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {rebuyMutation.isPending ? "..." : t("rebuy.confirm")}
              </button>
            </div>

            {/* Auto-rebuy toggle */}
            <div className="mt-3 pt-3 border-t border-border/20">
              <button
                onClick={() => setShowAutoRebuySettings(!showAutoRebuySettings)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <Settings className="w-3.5 h-3.5" />
                {t("rebuy.autoRebuy")}
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${autoRebuySettings.enabled ? "bg-green-500/20 text-green-400" : "bg-secondary text-muted-foreground/60"}`}>
                  {autoRebuySettings.enabled ? "ON" : "OFF"}
                </span>
              </button>

              {showAutoRebuySettings && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground whitespace-nowrap">{t("rebuy.threshold")}:</label>
                    <input
                      type="number"
                      value={autoRebuySettings.threshold || ""}
                      onChange={e => saveAutoRebuySettings({ ...autoRebuySettings, threshold: parseFloat(e.target.value) || 0 })}
                      placeholder={`< ${bigBlindValue * 5}`}
                      className="flex-1 px-2 py-1 rounded-lg bg-secondary text-[11px] text-foreground border border-border/50 focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground whitespace-nowrap">{t("rebuy.targetAmount")}:</label>
                    <input
                      type="number"
                      value={autoRebuySettings.targetAmount || ""}
                      onChange={e => saveAutoRebuySettings({ ...autoRebuySettings, targetAmount: parseFloat(e.target.value) || 0 })}
                      placeholder={room ? parseFloat(room.minBuyIn).toFixed(0) : "100"}
                      className="flex-1 px-2 py-1 rounded-lg bg-secondary text-[11px] text-foreground border border-border/50 focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => saveAutoRebuySettings({ ...autoRebuySettings, enabled: !autoRebuySettings.enabled })}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97] ${
                      autoRebuySettings.enabled
                        ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    }`}
                  >
                    {autoRebuySettings.enabled ? t("rebuy.disableAuto") : t("rebuy.enableAuto")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
