import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, getLocale } from "@/lib/i18n";
import { fmtAmt, formatAmount, formatBalance } from "@/lib/utils";
import { ArrowLeft, Shield, Volume2, VolumeX, LogOut, Trophy, Clock, Users, Plus, AlertTriangle, Settings, ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import RoomInvitePoster from "@/components/RoomInvitePoster";

// ==================== Frontend Hand Evaluator (for real-time hand strength hints) ====================
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function combine(start: number, current: T[]) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) { current.push(arr[i]); combine(i + 1, current); current.pop(); }
  }
  combine(0, []);
  return result;
}

function evalFive(cards: string[]): number {
  const ranks = cards.map(c => RANK_VALUES[c[0]] ?? 0).sort((a, b) => b - a);
  const suits = cards.map(c => c[1]);
  const isFlush = suits.every(s => s === suits[0]);
  const uniq = Array.from(new Set(ranks)).sort((a, b) => b - a);
  const isStraight = (uniq.length === 5 && uniq[0] - uniq[4] === 4) ||
    (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2);
  const cnt = new Map<number, number>();
  for (const r of ranks) cnt.set(r, (cnt.get(r) || 0) + 1);
  const counts = Array.from(cnt.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13) return 10;
  if (isFlush && isStraight) return 9;
  if (counts[0][1] === 4) return 8;
  if (counts[0][1] === 3 && counts[1][1] === 2) return 7;
  if (isFlush) return 6;
  if (isStraight) return 5;
  if (counts[0][1] === 3) return 4;
  if (counts[0][1] === 2 && counts[1][1] === 2) return 3;
  if (counts[0][1] === 2) return 2;
  return 1;
}

// Maps evalFive rank value (1-10) to HAND_RANK_MAP keys (same as server-side descriptions)
const HAND_RANK_VALUE_TO_KEY: Record<number, string> = {
  10: 'Royal Flush', 9: 'Straight Flush', 8: 'Four of a Kind', 7: 'Full House',
  6: 'Flush', 5: 'Straight', 4: 'Three of a Kind', 3: 'Two Pair', 2: 'One Pair', 1: 'High Card',
};

// Returns i18n key for draw type, or empty string
function detectDrawKey(hole: string[], community: string[]): string {
  const all = [...hole, ...community];
  const suits = all.map(c => c[1]);
  const ranks = all.map(c => RANK_VALUES[c[0]] ?? 0);
  const suitCnt = new Map<string, number>();
  for (const s of suits) suitCnt.set(s, (suitCnt.get(s) || 0) + 1);
  const hasFlushDraw = Array.from(suitCnt.values()).some(v => v === 4);
  const uniqRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);
  let oesd = false, gutshot = false;
  for (let i = 0; i <= uniqRanks.length - 4; i++) {
    const span = uniqRanks[i + 3] - uniqRanks[i];
    if (span === 3) { oesd = true; break; }
    if (span === 4) { gutshot = true; }
  }
  if (hasFlushDraw && oesd) return 'hand.draw.sfDraw';
  if (hasFlushDraw) return 'hand.draw.flushDraw';
  if (oesd) return 'hand.draw.oesd';
  if (gutshot) return 'hand.draw.gutshot';
  return '';
}

// Returns an i18n key (string) for the best hand strength, or '' if not applicable
function calcHandStrengthKey(holeCards: string[], communityCards: string[]): string {
  if (holeCards.length < 2 || communityCards.length < 3) return '';
  const all = [...holeCards, ...communityCards];
  const combos = getCombinations(all, 5);
  let best = 0;
  for (const c of combos) best = Math.max(best, evalFive(c));
  // Only show draws if made hand is weak (pair or less)
  if (best <= 2) {
    const drawKey = detectDrawKey(holeCards, communityCards);
    if (drawKey) return drawKey;
  }
  const desc = HAND_RANK_VALUE_TO_KEY[best];
  return desc ? (HAND_RANK_MAP[desc] || '') : '';
}

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

function CardView({ card, faceDown = false, className = "", delay = 0, animate = false, flip = false }: {
  card?: string; faceDown?: boolean; className?: string; delay?: number; animate?: boolean; flip?: boolean;
}) {
  const [visible, setVisible] = useState(!animate);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [animate, delay]);
  useEffect(() => {
    if (flip) {
      const timer = setTimeout(() => setFlipped(true), delay);
      return () => clearTimeout(timer);
    } else {
      setFlipped(false);
    }
  }, [flip, delay]);

  // Flip animation: show card back first, then flip to reveal face
  if (flip && !flipped) {
    // Show card back while waiting to flip
    return (
      <div className={`w-11 h-[60px] rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.6),0_2px_4px_rgba(0,0,0,0.4)] ${className}`}>
        <div className="w-full h-full bg-gradient-to-br from-[#d63031] to-[#b71c1c] border-[2px] border-white/90 rounded-md relative">
          <div className="absolute inset-[3px] border-[1.5px] border-white/50 rounded-sm" />
          <div className="absolute inset-[6px] rounded-sm overflow-hidden" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)` }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/30 border-[1.5px] border-white/50 flex items-center justify-center">
              <span className="text-[9px] font-black text-white">VP</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
  const rankColor = isRed ? 'text-[#e8000a]' : 'text-[#111111]';

  // Size buckets: extract numeric width from className (e.g. !w-9 → 36px, !w-10 → 40px, !w-12 → 48px, default w-14 → 56px)
  // We use the actual card width to derive font sizes so they NEVER overflow regardless of screen size.
  // Formula: cornerRank ≈ cardWidth * 0.26, centerSuit ≈ cardWidth * 0.38 (leaves ~30% margin each side for corners)
  let cardPx = 56; // default w-14
  if (className.includes('!w-[44px]')) cardPx = 44;
  else if (className.includes('!w-9')) cardPx = 36;
  else if (className.includes('!w-10')) cardPx = 40;
  else if (className.includes('!w-11')) cardPx = 44;
  else if (className.includes('!w-12')) cardPx = 48;
  const cornerRankPx = Math.floor(cardPx * 0.42); // rank digit in corner — larger for readability
  const cornerSuitPx = Math.floor(cardPx * 0.26); // suit symbol in corner
  const centerSuitPx = Math.floor(cardPx * 0.36); // center suit — back to original size

  return (
    <div className={`w-14 h-[76px] rounded-lg overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.6),0_3px_6px_rgba(0,0,0,0.4)] transition-all duration-300 ${animate && !visible ? "scale-0 opacity-0 -translate-y-4" : "scale-100 opacity-100 translate-y-0"} ${flip && flipped ? "animate-flip" : ""} ${className}`}>
      <div className="w-full h-full bg-white border-[1.5px] border-gray-200 rounded-lg relative">
        {/* Top-left corner: rank above suit, tightly packed */}
        <div className="absolute top-[2px] left-[2px] flex flex-col items-center leading-[1]">
          <span style={{ fontSize: cornerRankPx }} className={`font-black leading-none ${rankColor}`}>{displayRank}</span>
          <span style={{ fontSize: cornerSuitPx }} className={`leading-none ${rankColor}`}>{suitInfo.symbol}</span>
        </div>
        {/* Center suit symbol — width-proportional, guaranteed not to reach corners */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span style={{ fontSize: centerSuitPx }} className={`leading-none select-none ${rankColor}`}>{suitInfo.symbol}</span>
        </div>
        {/* Bottom-right corner: mirrored */}
        <div className="absolute bottom-[2px] right-[2px] flex flex-col items-center leading-[1] rotate-180">
          <span style={{ fontSize: cornerRankPx }} className={`font-black leading-none ${rankColor}`}>{displayRank}</span>
          <span style={{ fontSize: cornerSuitPx }} className={`leading-none ${rankColor}`}>{suitInfo.symbol}</span>
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
        <span className={`${size === "sm" ? "text-[11px]" : "text-sm"} text-yellow-300 font-bold drop-shadow-[0_0_3px_rgba(234,179,8,0.4)]`}>{fmtAmt(amount)}</span>
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
        {fmtAmt(displayAmount)}
      </span>
    </div>
  );
}

// Default avatar for players without a Telegram profile photo
const DEFAULT_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/default-avatar-aXRqAewdDSMxKYhaCU9DtA.webp";

// Player seat positions for 6-max table (oval layout)
// Hero at bottom-center; side seats use % inset to stay within screen on all phones
const SEAT_POSITIONS = [
  { top: "80%", left: "50%", transform: "translate(-50%, -50%)" },   // Bottom (hero)
  { top: "67%", left: "3%",  transform: "translate(0, -50%)" },      // Left bottom
  { top: "27%", left: "3%",  transform: "translate(0, -50%)" },      // Left top
  { top: "5%",  left: "50%", transform: "translate(-50%, 0)" },       // Top
  { top: "27%", left: "97%", transform: "translate(-100%, -50%)" }, // Right top
  { top: "67%", left: "97%", transform: "translate(-100%, -50%)" }, // Right bottom
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
  // Default true so the buy-in dialog shows immediately on entry (before roomPlayers loads)
  // This prevents the old "sit-down" overlay from flashing briefly
  const [showBuyIn, setShowBuyIn] = useState(true);
  const [lastPhase, setLastPhase] = useState("");
  const [animateCards, setAnimateCards] = useState(false);
  const [dealingMyCards, setDealingMyCards] = useState(false); // preflop deal animation for hero hole cards
  const prevMyCardsLenRef = useRef(0);
  const [showWinner, setShowWinner] = useState<{ name: string; amount: number; handDescription?: string } | null>(null);
  const [showSettlement, setShowSettlement] = useState<any>(null);
  const [winnerPlayerIds, setWinnerPlayerIds] = useState<number[]>([]);
  // Settlement dedup is handled purely by lastSettledHandRef (in-memory).
  // localStorage was removed because handNumber resets on server restart,
  // causing false "already seen" matches that block settlement animation.
  // Prevent roomPlayers re-query from triggering showBuyIn after leave/navigate
  const isLeavingRef = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false); // mirrors isLeavingRef for JSX re-render

  const tableAreaRef = useRef<HTMLDivElement>(null);

  // Full-screen layout: use 100% of available viewport, accounting for TG WebApp chrome
  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: 0, left: 0,
    width: '100vw', height: '100dvh',
    maxWidth: '100vw', overflow: 'hidden',
  });
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      // Expand to full height in Telegram WebApp (do NOT use requestFullscreen -
      // it hides content behind TG header on older devices and breaks lobby on return)
      tg.expand?.();
      const update = () => {
        // viewportStableHeight excludes TG chrome (header/keyboard) for stable layout
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        if (h > 100) {
          setContainerStyle({
            position: 'fixed', top: 0, left: 0,
            width: '100vw',
            height: `${h}px`,
            maxWidth: '100vw',
            overflow: 'hidden',
          });
        }
      };
      update();
      tg.onEvent?.('viewportChanged', update);
      return () => {
        tg.offEvent?.('viewportChanged', update);
      };
    } else {
      // Standard browser: window.innerHeight is most reliable (doesn't change on keyboard open)
      const update = () => {
        setContainerStyle({
          position: 'fixed', top: 0, left: 0,
          width: '100vw',
          height: `${window.innerHeight}px`,
          maxWidth: '100vw',
          overflow: 'hidden',
        });
      };
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
  }, []);

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
      // Poll when seated OR when we just became unseated (to detect roomClosed)
      enabled: isValidRoom && !!user && (isSeated || (!isSeated && !isLeavingRef.current)),
      refetchInterval: (data) => {
        // Stop polling if room is closed and we've already started navigating
        if ((data as any)?.roomClosed && isLeavingRef.current) return false;
        return 2000;
      },
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
      // Showdown: animate opponent card reveal
      if (tableState.phase === "showdown" && lastPhase === "river") {
        setAnimateCards(true);
        setTimeout(() => setAnimateCards(false), 2000);
        if (!muted) playSound("cardFlip");
      }
      if (tableState.phase === "preflop" && lastPhase !== "" && lastPhase !== "preflop") {
        if (!muted) playSound("deal");
        // Trigger dealing animation for hero hole cards
        setDealingMyCards(true);
        setTimeout(() => setDealingMyCards(false), 1200);
      }
      setLastPhase(tableState.phase);
    }
  }, [tableState?.phase, lastPhase, muted, playSound]);

  // Also trigger dealing animation when myCards first arrive (e.g. on reconnect mid-hand)
  const myCardsLen = tableState?.myCards?.length ?? 0;
  useEffect(() => {
    if (myCardsLen > 0 && prevMyCardsLenRef.current === 0) {
      setDealingMyCards(true);
      setTimeout(() => setDealingMyCards(false), 1200);
    }
    prevMyCardsLenRef.current = myCardsLen;
  }, [myCardsLen]);

  // Detect winner - use handNumber + phase as primary detection to avoid polling race conditions
  // Problem solved: when same player wins consecutive hands with same amount, winnerKey doesn't change
  // between polls if the client misses the brief "lastWinner=null" window during new hand start.
  // Solution: track the last settled handNumber and trigger on any new completed hand.
  const lastSettledHandRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("");
  useEffect(() => {
    const currentPhase = tableState?.phase || "";
    const currentHandNum = tableState?.handNumber ?? 0;
    
    // Primary trigger: phase is "completed" AND this hand hasn't been settled yet
    const isCompleted = currentPhase === "completed";
    const isNewSettlement = isCompleted && currentHandNum > 0 && currentHandNum !== lastSettledHandRef.current;
    

    if (isNewSettlement && tableState?.lastWinner && !showWinner) {
      lastSettledHandRef.current = currentHandNum;
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
      setTimeout(() => { setShowWinner(null); setShowSettlement(null); setWinnerPlayerIds([]); }, 5000);
    }
    
    prevPhaseRef.current = currentPhase;
  }, [tableState?.phase, tableState?.handNumber, tableState?.lastWinner, tableState?.settlementDetail, muted, playSound, user]);

  // === Auto-return to lobby logic ===
  // 1. If player is kicked (not in tableState.players while isSeated), auto-navigate to lobby
  // 2. If table stays in 'waiting' phase for > 3 minutes with only 1 or 0 players, auto-navigate to lobby
  const kickDetectedRef = useRef(false);
  // Guard: after joinMutation succeeds, wait for at least one tableState refresh that includes the player
  // before enabling kicked detection. This prevents a race condition where tableState is fetched
  // before the server has added the player to gameState.players, causing a false "kicked" detection.
  const joinSettledRef = useRef(false); // true once tableState confirms player is in the game
  const waitingStartRef = useRef<number | null>(null);
  const WAITING_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

  // When isSeated transitions to true (new join), reset all detection guards
  const prevIsSeatedRef = useRef(false);
  useEffect(() => {
    if (isSeated && !prevIsSeatedRef.current) {
      // Just became seated - reset all guards to prevent stale state from previous session
      kickDetectedRef.current = false;
      joinSettledRef.current = false;
      isLeavingRef.current = false;
    }
    prevIsSeatedRef.current = isSeated;
  }, [isSeated]);

  useEffect(() => {
    if (!isSeated || !user || !tableState) return;

    // If room is closed (e.g. totalRounds reached), navigate to lobby directly without calling leave
    if ((tableState as any).roomClosed) {
      if (!kickDetectedRef.current) {
        kickDetectedRef.current = true;
        isLeavingRef.current = true;
        setIsLeaving(true);
        toast.info(t("table.roomClosed"), { duration: 2000 });
        setIsSeated(false);
        utils.wallet.balance.invalidate();
        setTimeout(() => navigate("/lobby"), 2000);
      }
      return;
    }

    // Check if player was kicked (seated but not in player list)
    const myPlayerInState = tableState.players?.find((p: any) => p.id === user.id);
    // Once we see the player in tableState at least once, mark join as settled
    if (myPlayerInState) joinSettledRef.current = true;
    // Only trigger kicked detection after join is settled (player appeared in tableState at least once)
    // This prevents false positives during the brief window between joinMutation success and
    // the first tableState refresh that includes the new player.
    if (!myPlayerInState && !kickDetectedRef.current && joinSettledRef.current) {
      kickDetectedRef.current = true;
      // Return chips are handled server-side; just navigate back
      toast.info(t("table.kickedToLobby"), { duration: 2000 });
      setIsSeated(false);
      isLeavingRef.current = true;
      setIsLeaving(true);
      utils.wallet.balance.invalidate();
      setTimeout(() => navigate("/lobby"), 1500);
      return;
    }
    if (myPlayerInState) { kickDetectedRef.current = false; }

    // Check waiting timeout (no match found)
    const phase = tableState.phase;
    const playerCount = tableState.players?.length ?? 0;
    if (phase === "waiting" && playerCount < 2) {
      if (!waitingStartRef.current) waitingStartRef.current = Date.now();
      const elapsed = Date.now() - waitingStartRef.current;
      if (elapsed > WAITING_TIMEOUT_MS) {
        toast.info(t("table.noMatchTimeout"), { duration: 2000 });
        leaveMutation.mutate({ roomId });
      }
    } else {
      waitingStartRef.current = null;
    }
  }, [tableState, isSeated, user?.id]);

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
      joinSettledRef.current = false; // reset: wait for tableState to confirm player presence
      kickDetectedRef.current = false;
      toast.success(t("table.seatJoined", { seat: data.seatIndex + 1 }), { duration: 1000 });
      // Immediately refetch table state to show avatar
      utils.game.tableState.invalidate({ roomId });
      utils.rooms.getPlayers.invalidate({ roomId });
      utils.wallet.balance.invalidate();
    },
    onError: (err) => {
      // If already in another game, show localized message and redirect to lobby
      if (err.message?.includes("Already in another game")) {
        toast.error(t("table.alreadyInGame"));
        setTimeout(() => navigate("/lobby"), 1500);
      } else if (err.message?.includes("ALREADY_SEATED_THIS_TABLE")) {
        // Same account is already seated at this table from another device
        toast.error(t("table.alreadySeatedOtherDevice") || "该账号已在其他设备上游戏，请勿重复入座");
        setTimeout(() => navigate("/lobby"), 2000);
      } else {
        toast.error(err.message);
      }
    },
  });

  const leaveMutation = trpc.game.leave.useMutation({
    onSuccess: () => {
      isLeavingRef.current = true;
      setIsLeaving(true);
      setIsSeated(false);
      // Reset all join/kick guards so re-entry works cleanly
      kickDetectedRef.current = false;
      joinSettledRef.current = false;
      toast.success(t("table.left"), { duration: 1000 });
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
    onError: (err) => {
      // Silently refresh state for phase/turn mismatch errors (stale client state)
      // These happen when the 2s polling lag causes the client to submit an action
      // after the server has already advanced the phase.
      const silentErrors = [
        "Game is not in an active betting phase",
        "Not your turn",
        "You have already folded",
        "You are already all-in",
      ];
      if (silentErrors.some(e => err.message?.includes(e))) {
        // Just refresh the state silently - no toast needed
        utils.game.tableState.invalidate({ roomId });
      } else {
        toast.error(err.message);
      }
    },
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
  const [showRoomPoster, setShowRoomPoster] = useState(false);

  // === All-in Confirm ===
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);

  // === Switch Table ===
  const [isSwitchingTable, setIsSwitchingTable] = useState(false);
  const switchTableMutation = trpc.rooms.switchTable.useMutation();

  // Wallet balance for rebuy
  const myChipsForWallet = (tableState?.players ?? []).find((p: any) => p.id === user?.id)?.chips;
  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user && (showRebuyDialog || showBuyIn || myChipsForWallet === 0) });

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
  const showdownRevealOrder: number[] = (tableState as any)?.showdownRevealOrder ?? [];

  // === Showdown sequential reveal ===
  // Track which opponent IDs have been "flipped" face-up during showdown
  const [revealedOpponentIds, setRevealedOpponentIds] = useState<Set<number>>(new Set());
  const prevShowdownPhaseRef = useRef(false);
  useEffect(() => {
    const isShowdown = phase === "showdown" || phase === "completed";
    if (isShowdown && !prevShowdownPhaseRef.current) {
      // Just entered showdown: reveal opponents one by one
      prevShowdownPhaseRef.current = true;
      setRevealedOpponentIds(new Set()); // reset
      const order = showdownRevealOrder.length > 0 ? showdownRevealOrder
        : players.filter(p => p.id !== user?.id && !p.isFolded && p.holeCards?.length > 0).map(p => p.id);
      order.forEach((pid, idx) => {
        setTimeout(() => {
          setRevealedOpponentIds(prev => new Set([...prev, pid]));
          if (!muted) playSound("cardFlip");
        }, idx * 600 + 300);
      });
    } else if (!isShowdown) {
      prevShowdownPhaseRef.current = false;
      setRevealedOpponentIds(new Set());
    }
  }, [phase, showdownRevealOrder, players, user?.id, muted, playSound]);

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

  // Set default buy-in amount when room data loads
  useEffect(() => {
    if (room && !buyInAmount) {
      const min = parseFloat(room.minBuyIn);
      const max = parseFloat(room.maxBuyIn);
      const bb = parseFloat(room.bigBlind);
      // Default: 20x big blind, clamped to [min, max]
      const defaultBuyIn = Math.min(max, Math.max(min, bb * 20));
      setBuyInAmount(defaultBuyIn.toFixed(2));
    }
  }, [room]);

  useEffect(() => {
    if (roomPlayers && user) {
      const seated = roomPlayers.some((p: any) => p.userId === user.id);
      setIsSeated(seated);
      // If already seated (e.g. page refresh), mark join as settled so kicked detection works immediately
      if (seated) {
        joinSettledRef.current = true;
        setShowBuyIn(false); // Already seated - hide buy-in dialog
        return;
      }
      // Not seated: reset kick/join guards so they don't fire on the next join
      // (This handles the case where player just left and roomPlayers refreshed)
      if (!isLeavingRef.current) {
        kickDetectedRef.current = false;
        joinSettledRef.current = false;
      }
      // If leaving or navigating away, skip buy-in dialog
      if (isLeavingRef.current) {
        setShowBuyIn(false);
        return;
      }
      // If autoJoin (same-stakes switch), auto-join with min buy-in
      if (!seated && isValidRoom && autoJoinRef.current && room) {
        autoJoinRef.current = false;
        setShowBuyIn(false); // autoJoin bypasses dialog
        const minBuyIn = parseFloat(room.minBuyIn);
        joinMutation.mutate({ roomId, buyIn: minBuyIn });
      } else if (!seated && isValidRoom && !autoJoinRef.current) {
        // Normal entry - show buy-in dialog (only if room is valid and not closed)
        if (room && room.status !== "closed") {
          setShowBuyIn(true);
        } else {
          setShowBuyIn(false);
        }
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
  // When waitingForReady AND winner banner is gone, clear cards/pot to reset the table
  // Keep showing last hand's cards while the winner banner is still visible
  const shouldClearTable = waitingForReady && !showWinner;
  const displayCommunity = isDemoMode ? demoCommunity : (shouldClearTable ? [] : communityCards);
  const displayMyCards = isDemoMode ? demoMyCards : (shouldClearTable ? [] : myCards);
  const displayPot = isDemoMode ? 12.5 : (shouldClearTable ? 0 : pot);
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
  // Can switch table: seated, between hands, not demo
  const canSwitchTable = isSeated && (waitingForReady || phase === "waiting") && !isDemoMode && !!room;

  const handleSwitchTable = async () => {
    if (!room || !canSwitchTable) return;
    setIsSwitchingTable(true);
    try {
      const result = await switchTableMutation.mutateAsync({ currentRoomId: roomId });
      // Check if chips are below min buy-in threshold (50% of minBuyIn)
      const minBuyIn = parseFloat(room.minBuyIn);
      const currentChips = myPlayer?.chips ?? 0;
      if (currentChips < minBuyIn * 0.5) {
        toast.warning(t("table.lowChipsWarning") || `筹码不足 (${currentChips.toFixed(2)} USDT)，建议补充至 ${minBuyIn.toFixed(2)} USDT 以上`);
      }
      navigate(`/table/${result.newRoomId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || t("table.switchTableFailed") || "换桌失败，请稍后重试");
    } finally {
      setIsSwitchingTable(false);
    }
  };

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
    <div
      className="bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#060e1a] flex flex-col"
      style={containerStyle}
    >
      {/* Room Invite Poster Overlay */}
      {showRoomPoster && room && room.inviteCode && (
        <RoomInvitePoster
          room={room}
          inviteCode={room.inviteCode}
          onClose={() => setShowRoomPoster(false)}
        />
      )}
      {/* Top Bar - compact for small screens */}
      <div className="glass-strong px-2 py-1.5 flex items-center justify-between z-10 border-b border-border/30">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {room?.type === "private" && room?.inviteCode && (
            <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">{room.inviteCode}</span>
          )}
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
          {/* Share poster button - only for private rooms with invite code */}
          {room?.type === "private" && room?.inviteCode && (
            <button onClick={() => setShowRoomPoster(true)} className="p-1.5 rounded-lg text-gold/70 hover:text-gold hover:bg-gold/10 transition-all active:scale-95" title={t("room.generatePoster")}>
              <ImageIcon className="w-4 h-4" />
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

      {/* Phase Progress Indicator - minimal height */}
      {displayPhase !== "waiting" && (
        <div className="px-3 py-0.5 glass border-b border-border/20">
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
            <span className="text-[9px] text-muted-foreground ml-2">
              {phaseNames[displayPhase]}
            </span>
          </div>
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
            <p className="text-2xl font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] mt-1">{fmtAmt(showWinner.amount)}</p>
            {showWinner.handDescription && showWinner.handDescription !== "Last Standing" && (
              <p className="text-sm text-gold/80 mt-1 font-medium">{HAND_RANK_MAP[showWinner.handDescription] ? t(HAND_RANK_MAP[showWinner.handDescription]) : showWinner.handDescription}</p>
            )}
            {/* Side pots info */}
            {showSettlement?.sidePots?.length > 1 && (
              <div className="mt-3 border-t border-gold/20 pt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("table.sidePots")}</p>
                {showSettlement.sidePots.map((sp: any, i: number) => (
                  <p key={i} className="text-xs text-foreground/80">
                    {t("table.potNumber", { n: i + 1 })}: {fmtAmt(sp.amount)} → {sp.winnerName}
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

      {/* Table Area - flex-1 min-h-0 ensures it fills all remaining vertical space */}
      {/* max-h limits table to ~55% of screen so it doesn't look oversized on tall phones */}
      <div ref={tableAreaRef} className="flex-1 min-h-0 relative overflow-hidden" style={{ backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/table-bg-clean-6gTEKxokqcP8zS3GCvWNKd.webp)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0a1a2e' }}>
        {/* Vertical Countdown Timer - pinned to far left edge, slim bar so it never overlaps cards */}
        {displayIsMyTurn && (
          <div className="absolute -left-0.5 top-[10%] bottom-[10%] z-20 flex flex-col items-center gap-0.5">
            <div className={`relative w-1.5 flex-1 bg-secondary/40 rounded-full overflow-hidden ${isUrgent ? 'animate-pulse' : ''}`}>
              <div
                className={`absolute bottom-0 w-full rounded-full transition-all duration-1000 ease-linear ${
                  countdown > 10
                    ? 'bg-gradient-to-t from-truth-blue to-gold'
                    : countdown > 5
                      ? 'bg-gradient-to-t from-orange-400 to-yellow-500'
                      : 'bg-gradient-to-t from-red-600 to-red-400'
                }`}
                style={{ height: `${(countdown / turnTimeout) * 100}%` }}
              />
            </div>
            <div className={`text-[9px] font-bold ${isUrgent ? 'text-red-400' : 'text-gold'}`}>
              {countdown}s
            </div>
          </div>
        )}
        {/* Game content overlay */}
        <div className="absolute inset-0">
            
            {/* Pot display */}
            <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <AnimatedPot amount={displayPot} />
              {displayPlayers.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{displayPlayers.filter(p => !p.isFolded).length}/{displayPlayers.length}</span>
                </div>
              )}
            </div>

            {/* Community Cards - responsive size for small screens */}
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5">
              {displayCommunity.map((card, i) => (
                <CardView key={`${card}-${i}`} card={card} className="!w-[44px] !h-[62px]" animate={animateCards} delay={i * 150} />
              ))}
            </div>

            {/* Start Next Hand button in center of table - only show after settlement overlay dismissed */}
            {waitingForReady && !isDemoMode && !showWinner && (
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
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
                  <div className="mt-2 flex gap-2 flex-wrap justify-center">
                    <button
                      onClick={() => setShowRebuyDialog(true)}
                      className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/80 to-yellow-600/80 text-white text-[11px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {t("rebuy.addChips")}
                    </button>
                    {canSwitchTable && (
                      <button
                        onClick={handleSwitchTable}
                        disabled={isSwitchingTable}
                        className="px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/80 to-cyan-600/80 text-white text-[11px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-1 disabled:opacity-50"
                      >
                        {isSwitchingTable ? (
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {t("table.switchTable") || "换桌"}
                      </button>
                    )}
                  </div>
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
                    <div className="flex flex-col items-center gap-0.5 mb-0.5">
                      <div className="flex gap-1">
                        {displayMyCards.map((card, i) => (
                          <CardView key={i} card={card} className={`!w-12 !h-[64px]${dealingMyCards ? (i === 0 ? ' animate-deal' : ' animate-deal-2') : ''}`} animate delay={i * 200} />
                        ))}
                      </div>
                      {/* Real-time hand strength hint: only show during flop/turn/river */}
                      {(displayPhase === "flop" || displayPhase === "turn" || displayPhase === "river") && displayMyCards.length >= 2 && displayCommunity.length >= 3 && (() => {
                        const strengthKey = calcHandStrengthKey(displayMyCards, displayCommunity);
                        return strengthKey ? (
                          <div className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-black/60 border border-gold/40 text-gold shadow-[0_0_6px_rgba(212,175,55,0.3)] whitespace-nowrap">
                            {t(strengthKey)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                  {/* Opponent cards: only show face-up in showdown/completed phase with sequential flip animation */}
                  {!isHero && (displayPhase === "showdown" || displayPhase === "completed") && player.holeCards && player.holeCards.length > 0 && !waitingForReady && (
                    <div className="flex gap-0.5 mb-0.5">
                      {player.holeCards.map((card, i) => (
                        <CardView
                          key={i}
                          card={card}
                          className="!w-10 !h-[54px]"
                          flip={revealedOpponentIds.has(player.id)}
                          delay={i * 200}
                        />
                      ))}
                    </div>
                  )}
                  {/* Show face-down cards for opponents during active hand (preflop/flop/turn/river) */}
                  {!isHero && displayPhase !== "showdown" && displayPhase !== "completed" && !player.isFolded && displayPhase !== "waiting" && !waitingForReady && (
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
                      {player.isAllIn ? t("table.allIn") : player.isFolded ? t("table.fold") : fmtAmt(player.chips)}
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
                        <span className="text-base font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]">+{fmtAmt(showWinner.amount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          });
          })()}

        </div>
      </div>


      {/* ===== Buy-in Dialog (3/4 size bottom sheet) ===== */}
      {showBuyIn && !isSeated && !isDemoMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" style={{ height: '100dvh' }}>
          {/* Tap outside to cancel */}
          <div className="absolute inset-0" onClick={() => { setShowBuyIn(false); navigate("/lobby"); }} />
          <div className="relative w-full max-w-md bg-[#0d1f3c] border border-gold/30 rounded-t-2xl shadow-2xl"
            style={{ maxHeight: '75vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-3" />
            <div className="px-4 pb-8">
              {/* Room info */}
              <div className="mb-3">
                <h3 className="text-base font-bold text-foreground mb-0.5">
                  {room ? room.name : t("table.buyIn")}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {t("lobby.blinds")}: ${room ? formatAmount(room.smallBlind) : "0"}/${room ? formatAmount(room.bigBlind) : "0"}
                  &nbsp;·&nbsp;
                  {t("lobby.buyIn")}: ${room ? formatAmount(room.minBuyIn) : "0"} - ${room ? formatAmount(room.maxBuyIn) : "0"}
                </p>
              </div>
              {/* Balance */}
              <div className="flex justify-between items-center mb-2.5 px-0.5">
                <span className="text-[11px] text-muted-foreground">{t("wallet.balance")}</span>
                <span className="text-sm font-bold text-green-400">${formatBalance(walletData?.balance)}</span>
              </div>
              {/* Insufficient balance warning */}
              {walletData && room && parseFloat(walletData.balance) < parseFloat(room.minBuyIn) && (
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 mb-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                  <p className="flex-1 text-[11px] text-orange-300 font-medium">{t("table.insufficientBalance")}</p>
                  <button onClick={() => navigate("/wallet")} className="text-[11px] text-truth-blue underline whitespace-nowrap font-medium">
                    {t("table.goDeposit")}
                  </button>
                </div>
              )}
              {/* Amount input */}
              <label className="block text-[11px] text-muted-foreground mb-1.5">{t("lobby.buyIn")} (USDT)</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  inputMode="decimal"
                  value={buyInAmount}
                  onChange={(e) => setBuyInAmount(e.target.value)}
                  min={room?.minBuyIn}
                  max={room?.maxBuyIn}
                  step="0.01"
                  placeholder={room ? `${formatAmount(room.minBuyIn)} - ${formatAmount(room.maxBuyIn)}` : ""}
                  className="flex-1 bg-background/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors"
                  autoFocus
                />
                <button
                  onClick={() => room && setBuyInAmount(room.maxBuyIn)}
                  className="px-3 py-2.5 rounded-xl bg-gold/20 text-gold text-sm font-bold hover:bg-gold/30 transition-colors active:scale-95"
                >
                  MAX
                </button>
              </div>
              {/* Quick amount buttons */}
              {room && (
                <div className="flex gap-1.5 mb-4">
                  {[
                    parseFloat(room.minBuyIn),
                    parseFloat(room.minBuyIn) * 2,
                    parseFloat(room.minBuyIn) * 5,
                    parseFloat(room.maxBuyIn),
                  ].filter((v, i, arr) => arr.indexOf(v) === i && v <= parseFloat(room.maxBuyIn)).map(v => (
                    <button
                      key={v}
                      onClick={() => setBuyInAmount(v.toFixed(2))}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                        parseFloat(buyInAmount) === v
                          ? "bg-gold text-background"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ${formatAmount(v.toFixed(2))}
                    </button>
                  ))}
                </div>
              )}
              {/* Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setShowBuyIn(false); navigate("/lobby"); }}
                  className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors active:scale-[0.97]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleJoin}
                  disabled={joinMutation.isPending || !buyInAmount || (!!walletData && !!room && parseFloat(walletData.balance) < parseFloat(room.minBuyIn))}
                  className="flex-1 py-3 rounded-xl text-base font-black tracking-wide transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                    color: '#1a0a00',
                    boxShadow: '0 4px 16px rgba(255,165,0,0.5), 0 0 0 2px rgba(255,215,0,0.3)',
                    textShadow: '0 1px 2px rgba(255,255,255,0.3)',
                  }}
                >
                  {joinMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-[#1a0a00]/40 border-t-[#1a0a00] rounded-full animate-spin" /><span>{t("table.joining") || "..."}</span></>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>🪑</span>
                      <span>{t("table.sitDown")}</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Panel - fixed min-height to prevent layout jumps */}
      {(isSeated || isDemoMode) && (
        <div className="glass-strong border-t border-border/30 px-3 py-2 z-10" style={{ minHeight: '88px' }}>

          {displayPhase === "waiting" && !waitingForReady && !isDemoMode && (
            <div className="flex items-center justify-center" style={{ minHeight: '72px' }}>
              {players.length >= 2 ? (
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => readyMutation.mutate({ roomId })}
                    disabled={readyMutation.isPending}
                    className="px-6 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-green-500/40 hover:shadow-green-500/60 transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    ▶ {t("table.startNextHand")}
                  </button>
                  <span className="text-[10px] text-muted-foreground/60">{players.length} {t("table.minPlayers")}</span>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-truth-blue animate-pulse" />
                    <span className="text-sm text-muted-foreground">{t("table.waiting")}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">{t("table.minPlayers")}</span>
                </div>
              )}
            </div>
          )}

          {/* When waitingForReady, show placeholder to maintain height */}
          {waitingForReady && !isDemoMode && displayPhase !== "waiting" && (
            <div className="flex items-center justify-center" style={{ minHeight: '72px' }}>
              <span className="text-[11px] text-muted-foreground/60">{t("table.waiting")}</span>
            </div>
          )}

          {(displayPhase !== "waiting" || isDemoMode) && !waitingForReady && (
            <>
              {/* Raise slider */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-muted-foreground min-w-[32px]">{fmtAmt(currentBet * 2)}</span>
                <input
                  type="range"
                  min={currentBet * 2}
                  max={myPlayer ? myPlayer.chips + myPlayer.currentBet : 100}
                  step={room ? (parseFloat(room.bigBlind) < 1 ? 0.01 : parseFloat(room.bigBlind) < 10 ? 0.1 : 0.5) : 0.5}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-gold [&::-webkit-slider-thumb]:to-gold-dim [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold/50"
                />
                <span className="text-[10px] text-gold font-bold min-w-[36px] text-right">{fmtAmt(raiseAmount)}</span>
              </div>

              {/* Action buttons - single row, always visible (disabled when not your turn) */}
              <div className="flex gap-1.5 mb-1">
                {/* Fold */}
                <button
                  onClick={handleFold}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-2 rounded-xl bg-red-900/60 text-red-300 border border-red-500/50 font-bold text-xs hover:bg-red-800/70 transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  {t("table.fold")}
                </button>
                {/* Check or Call */}
                {canCheck ? (
                  <button
                    onClick={handleCheck}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-2 rounded-xl font-bold text-xs transition-all active:scale-[0.97] disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#1a6bb5,#1e90ff)', color: '#fff', boxShadow: '0 2px 12px rgba(30,144,255,0.4)' }}
                  >
                    {t("table.check")}
                  </button>
                ) : (
                  <button
                    onClick={handleCall}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-2 rounded-xl font-bold text-xs transition-all active:scale-[0.97] disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#1a6bb5,#1e90ff)', color: '#fff', boxShadow: '0 2px 12px rgba(30,144,255,0.4)' }}
                  >
                    {t("table.call")} {fmtAmt(currentBet)}
                  </button>
                )}
                {/* Raise */}
                <button
                  onClick={handleRaise}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-2 rounded-xl font-bold text-xs transition-all active:scale-[0.97] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#b8860b,#FFD700)', color: '#1a0a00', boxShadow: '0 2px 12px rgba(255,215,0,0.4)' }}
                >
                  {t("table.raise")} {fmtAmt(raiseAmount)}
                </button>
                {/* All-in */}
                <button
                  onClick={() => setShowAllInConfirm(true)}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="py-2 px-2.5 rounded-xl font-black text-xs tracking-wide transition-all active:scale-[0.97] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#c0392b,#e74c3c,#ff6b6b)', color: '#fff', boxShadow: '0 2px 14px rgba(231,76,60,0.5)' }}
                >
                  🔥{t("table.allIn")}
                </button>
              </div>
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
              <span>{t("rebuy.currentChips")}: <span className="text-yellow-300 font-semibold">{myPlayer ? fmtAmt(myPlayer.chips) : "$0"}</span></span>
              <span>{t("wallet.balance")}: <span className="text-green-400 font-semibold">${formatBalance(walletData?.balance)}</span></span>
            </div>

            {/* Amount input */}
            <input
              type="number"
              value={rebuyAmount}
              onChange={e => setRebuyAmount(e.target.value)}
              placeholder={`${t("rebuy.amount")} (1 - ${room ? formatAmount(parseFloat(room.maxBuyIn) - (myPlayer?.chips ?? 0)) : "---"})`}
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
                    setRebuyAmount(String(Math.round(Math.min(max, balance))));
                  }
                }}
                className="flex-1 py-1.5 rounded-lg bg-gold/20 text-[11px] text-gold font-medium hover:bg-gold/30 transition-colors active:scale-[0.97]"
              >
                MAX
              </button>
            </div>

            {/* Max buy-in info */}
            <p className="text-[10px] text-muted-foreground/60 text-center mb-3">
              {t("rebuy.maxBuyIn")}: ${room ? formatAmount(room.maxBuyIn) : "---"}
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
                      placeholder={room ? formatAmount(room.minBuyIn) : "100"}
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

      {/* ===== All-in Confirm Dialog ===== */}
      {showAllInConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowAllInConfirm(false)}
        >
          <div
            className="bg-[#1a2744] rounded-2xl p-5 w-[280px] max-w-[88vw] border border-red-500/40 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Warning icon */}
            <div className="flex flex-col items-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: 'linear-gradient(135deg,#c0392b,#e74c3c)', boxShadow: '0 0 20px rgba(231,76,60,0.5)' }}>
                <span className="text-3xl">🔥</span>
              </div>
              <h3 className="text-base font-black text-white">{t("table.allIn")}</h3>
              <p className="text-[12px] text-red-300 mt-1 text-center">
                {t("table.allInConfirmMsg") || `确认押上全部筹码？`}
              </p>
              <p className="text-xl font-black text-yellow-300 mt-2">
                {myPlayer ? fmtAmt(myPlayer.chips) : ""}
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowAllInConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors active:scale-[0.97]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  setShowAllInConfirm(false);
                  if (isDemoMode) return toast.info(t("table.demoMode"));
                  actionMutation.mutate({ roomId, action: "all_in" });
                }}
                disabled={actionMutation.isPending}
                className="flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#c0392b,#e74c3c,#ff6b6b)', color: '#fff', boxShadow: '0 2px 14px rgba(231,76,60,0.5)' }}
              >
                {actionMutation.isPending ? "..." : (t("table.allInConfirm") || "确认全押")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
