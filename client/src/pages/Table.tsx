/** 牌桌页面 - 核心游戏界面，包含座位、公共牌、下注操作、比牌动画 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, getLocale } from "@/lib/i18n";
import { fmtAmt, formatAmount, formatBalance } from "@/lib/utils";
import { ArrowLeft, Shield, Volume2, VolumeX, LogOut, Trophy, Clock, Users, Plus, AlertTriangle, Settings, ImageIcon, RefreshCw, Menu, X } from "lucide-react";
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

function CardView({ card, faceDown = false, className = "", delay = 0, animate = false, flip = false, highlight = false }: {
  card?: string; faceDown?: boolean; className?: string; delay?: number; animate?: boolean; flip?: boolean; highlight?: boolean;
}) {
  // Parse explicit size from className (e.g. !w-7 → 28px, !h-[36px] → 36px)
  let explicitW: string | undefined;
  let explicitH: string | undefined;
  const wMatch = className.match(/!w-(\d+)/);
  const wPxMatch = className.match(/!w-\[(\d+)px\]/);
  const hMatch = className.match(/!h-(\d+)/);
  const hPxMatch = className.match(/!h-\[(\d+)px\]/);
  if (wPxMatch) explicitW = wPxMatch[1] + 'px';
  else if (wMatch) explicitW = (parseInt(wMatch[1]) * 4) + 'px';
  if (hPxMatch) explicitH = hPxMatch[1] + 'px';
  else if (hMatch) explicitH = (parseInt(hMatch[1]) * 4) + 'px';
  const sizeStyle: React.CSSProperties = {};
  if (explicitW) sizeStyle.width = explicitW;
  if (explicitH) sizeStyle.height = explicitH;
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
    // Show card back while waiting to flip - use inline styles for iOS compatibility
    return (
      <div className={`w-11 h-[60px] rounded-md overflow-hidden ${className}`} style={{ ...sizeStyle, boxShadow: '0 4px 12px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)' }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom right, #d63031, #8b1a1a)', border: '2px solid #f0f0f0', borderRadius: '6px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '3px', left: '3px', right: '3px', bottom: '3px', border: '1.5px solid #e0c0c0', borderRadius: '3px' }} />
          <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px', borderRadius: '3px', overflow: 'hidden', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#a03030', border: '1.5px solid #e0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: 'white' }}>VP</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!card || faceDown) {
    // Card back: ALL inline styles for maximum iOS compatibility (no Tailwind classes for visual rendering)
    return (
      <div className={`w-11 h-[60px] rounded-md overflow-hidden ${animate && !visible ? "scale-0 opacity-0 transition-transform duration-200" : "scale-100 opacity-100"} ${className}`} style={{ ...sizeStyle, boxShadow: '0 4px 12px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)' }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom right, #d63031, #8b1a1a)', border: '2px solid #f0f0f0', borderRadius: '6px', position: 'relative' }}>
          {/* Inner border */}
          <div style={{ position: 'absolute', top: '3px', left: '3px', right: '3px', bottom: '3px', border: '1.5px solid #e0c0c0', borderRadius: '3px' }} />
          {/* Simple diagonal lines - sparse */}
          <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px', borderRadius: '3px', overflow: 'hidden', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)' }} />
          {/* Center logo */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#a03030', border: '1.5px solid #e0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: 'white' }}>VP</span>
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
  if (className.includes('!w-[36px]')) cardPx = 36;
  else if (className.includes('!w-[44px]')) cardPx = 44;
  else if (className.includes('!w-[52px]')) cardPx = 52;
  else if (className.includes('!w-7')) cardPx = 28;
  else if (className.includes('!w-8')) cardPx = 32;
  else if (className.includes('!w-9')) cardPx = 36;
  else if (className.includes('!w-10')) cardPx = 40;
  else if (className.includes('!w-11')) cardPx = 44;
  else if (className.includes('!w-12')) cardPx = 48;
  // Corner rank: ~38% of card width gives a clear readable number without dominating the card
  // Center suit: ~52% fills the middle zone nicely; corners only occupy ~28px top/bottom so no overlap
  const cornerRankPx = Math.floor(cardPx * 0.36); // rank digit
  const cornerSuitPx = Math.floor(cardPx * 0.24); // suit symbol in corner
  const centerSuitPx = Math.floor(cardPx * 0.40); // center suit

  return (
    <div className={`w-14 h-[76px] rounded-lg overflow-hidden ${highlight ? 'shadow-[0_0_3px_2px_rgba(255,200,0,1),0_0_8px_3px_rgba(255,200,0,0.85)] animate-winner-card-glow' : 'shadow-[0_6px_16px_rgba(0,0,0,0.6),0_3px_6px_rgba(0,0,0,0.4)]'} ${animate && !visible ? "scale-0 opacity-0" : "scale-100 opacity-100"} ${flip && flipped ? "animate-flip" : ""} ${className}`} style={sizeStyle}>
      <div className={`w-full h-full bg-white rounded-lg relative ${highlight ? 'border-[3px] border-[#FFD700]' : 'border-[1.5px] border-gray-200'}`}>
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
              className="absolute w-3 h-3 rounded-full animate-chip-scatter"
              style={{
                background: 'linear-gradient(to bottom right, #fde047, #eab308, #a16207)',
                border: '1px solid rgba(202,138,4,0.8)',
                boxShadow: '0 0 6px rgba(234,179,8,0.6)',
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
        <div className={`${size === "sm" ? "w-4 h-4" : "w-5 h-5"} rounded-full flex items-center justify-center`} style={{ background: 'linear-gradient(to bottom right, #fde047, #eab308, #a16207)', border: '1px solid rgba(202,138,4,0.8)', boxShadow: '0 0 4px rgba(234,179,8,0.5)' }}>
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
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${amount > 0 ? "animate-pulse" : ""}`} style={{ background: 'linear-gradient(to bottom right, #fde047, #eab308, #a16207)', border: '2px solid rgba(202,138,4,0.8)', boxShadow: '0 0 8px rgba(234,179,8,0.6)' }}>
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
// Each seatIndex maps to a FIXED physical position - no rotation
// Shifted down slightly for better visual balance on mobile
const SEAT_POSITIONS = [
  { top: "86%", left: "50%", transform: "translate(-50%, -50%)" },   // Seat 0: Bottom center
  { top: "67%", left: "6%",  transform: "translate(0, -50%)" },      // Seat 1: Left bottom
  { top: "36%", left: "6%",  transform: "translate(0, -50%)" },      // Seat 2: Left top
  { top: "10%", left: "50%", transform: "translate(-50%, 0)" },      // Seat 3: Top center
  { top: "36%", left: "94%", transform: "translate(-100%, -50%)" }, // Seat 4: Right top
  { top: "67%", left: "94%", transform: "translate(-100%, -50%)" }, // Seat 5: Right bottom
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

  // Map backend English error messages to i18n keys for localized display
  const translateError = useCallback((msg: string): string => {
    const errorMap: Record<string, string> = {
      "Insufficient balance": "error.insufficientBalance",
      "Room not found": "error.roomNotFound",
      "Table is full": "error.tableFull",
      "Not your turn": "error.notYourTurn",
      "Cannot check, must call or raise": "error.cannotCheck",
      "Nothing to call, use check instead": "error.nothingToCall",
      "Raise amount must be positive": "error.raisePositive",
      "You have already folded": "error.alreadyFolded",
      "You are already all-in": "error.alreadyAllIn",
      "No active game": "error.noActiveGame",
      "Game is not in an active betting phase": "error.notInBettingPhase",
      "Cannot join table": "error.cannotJoinTable",
      "No available tables for this stake level": "error.noAvailableTables",
      "Already in another game": "error.alreadySeated",
      "Not seated at this table": "error.notSeated",
      "This transaction hash has already been submitted": "error.txHashDuplicate",
      "Insufficient balance (concurrent request detected)": "error.concurrentRequest",
      "Private room requires deposit": "error.privateRoomDeposit",
      "Cannot raise more than your stack": "error.raiseExceedsStack",
      "Minimum raise is": "error.minimumRaise",
      "Room is not available": "error.roomNotAvailable",
      "No available seats": "error.noAvailableSeats",
      "Cannot leave during a tournament": "error.cannotLeaveTournament",
    };
    for (const [eng, key] of Object.entries(errorMap)) {
      if (msg?.includes(eng)) return t(key);
    }
    return msg || t("error.generic");
  }, [t]);
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
  const [animateFromIndex, setAnimateFromIndex] = useState(0); // only animate cards from this index onwards
  const prevCommunityLenRef = useRef(0);
  const [dealingMyCards, setDealingMyCards] = useState(false); // preflop deal animation for hero hole cards
  const prevMyCardsLenRef = useRef(0);
  const [showWinner, setShowWinner] = useState<{ name: string; amount: number; handDescription?: string } | null>(null);
  const [showSettlement, setShowSettlement] = useState<any>(null);
  const [winnerPlayerIds, setWinnerPlayerIds] = useState<number[]>([]);
  // Compute the set of cards that form the winner's best hand (for highlight)
  const winnerBestCards = useMemo(() => {
    if (!showSettlement?.showdownPlayers || winnerPlayerIds.length === 0) return new Set<string>();
    const cards = new Set<string>();
    for (const sp of showSettlement.showdownPlayers) {
      if (winnerPlayerIds.includes(sp.playerId) && sp.bestCards) {
        for (const c of sp.bestCards) cards.add(c);
      }
    }
    return cards;
  }, [showSettlement, winnerPlayerIds]);
  // Refs for cancellable timers (prevent previous-hand callbacks firing into new hand)
  const winnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevHandNumberRef = useRef<number>(0);
  // Settlement dedup is handled purely by lastSettledHandRef (in-memory).
  // localStorage was removed because handNumber resets on server restart,
  // causing false "already seen" matches that block settlement animation.
  // Remember if this was ever a tournament table (survives tournamentInfo becoming null)
  const wasTournamentRef = useRef(false);
  // Tournament end overlay state
  const [tournamentEndInfo, setTournamentEndInfo] = useState<{
    rank: number;
    prize: number;
    totalPlayers: number;
    tournamentName?: string;
  } | null>(null);
  // Prevent roomPlayers re-query from triggering showBuyIn after leave/navigate
  const isLeavingRef = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false); // mirrors isLeavingRef for JSX re-render

  const tableAreaRef = useRef<HTMLDivElement>(null);

  // Full-screen layout: use 100% of available viewport, accounting for TG WebApp chrome
  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({
    position: 'relative',
    width: '100%', height: '100dvh',
    maxWidth: '430px', overflow: 'hidden',
    margin: '0 auto',
  });
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const calcStyle = (h: number): React.CSSProperties => {
      return {
        position: 'relative',
        width: '100%',
        height: `${h}px`,
        maxWidth: '430px',
        overflow: 'hidden',
        margin: '0 auto',
      };
    };
    if (tg) {
      // Expand to full height in Telegram WebApp
      tg.expand?.();
      // Try fullscreen for maximum viewport (Bot API 8.0+)
      const tgVersion = parseFloat(tg.version || '0');
      if (tgVersion >= 8.0 && typeof tg.requestFullscreen === 'function') {
        try { tg.requestFullscreen(); } catch (_) {}
      }
      const update = () => {
        // viewportStableHeight excludes TG chrome (header/keyboard) for stable layout
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        if (h > 100) {
          setContainerStyle(calcStyle(h));
        }
      };
      update();
      tg.onEvent?.('viewportChanged', update);
      window.addEventListener('resize', update);
      return () => {
        tg.offEvent?.('viewportChanged', update);
        window.removeEventListener('resize', update);
      };
    } else {
      // Standard browser
      const update = () => {
        setContainerStyle(calcStyle(window.innerHeight));
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

  // Poll game state with adaptive interval for responsiveness
  const { data: tableState, error: tableError } = trpc.game.tableState.useQuery(
    { roomId },
    {
      // Poll when seated OR when we just became unseated (to detect roomClosed)
      enabled: isValidRoom && !!user && (isSeated || (!isSeated && !isLeavingRef.current)),
      refetchInterval: (data) => {
        // Stop polling if room is closed and we've already started navigating
        if ((data as any)?.roomClosed && isLeavingRef.current) return false;
        // Adaptive polling: faster during active play, slower when waiting
        const phase = (data as any)?.phase;
        if (phase === "waiting" || phase === "completed") return 1200;
        // During active betting, poll aggressively for responsiveness
        return 500;
      },
      retry: 3,
      retryDelay: 300,
    }
  );

  // Connection state tracking + auto-recovery on reconnect/visibility
  const [connectionLost, setConnectionLost] = useState(false);
  useEffect(() => {
    if (tableError) {
      setConnectionLost(true);
    } else if (tableState) {
      setConnectionLost(false);
    }
  }, [tableError, tableState]);

  // Auto-recover on network reconnect or app resume (critical for mobile/TG)
  useEffect(() => {
    const handleOnline = () => {
      // Network restored: immediately refetch game state
      utils.game.tableState.invalidate({ roomId });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // App resumed from background: refetch to sync state
        utils.game.tableState.invalidate({ roomId });
      }
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [roomId, utils]);

  // Beacon-based leave: when user closes browser/tab or navigates away while seated
  // This ensures chips are returned to wallet even if the user doesn't click "Leave"
  useEffect(() => {
    if (!isSeated || !isValidRoom) return;
    const handleBeaconLeave = () => {
      // Don't fire beacon if already leaving via normal flow
      if (isLeavingRef.current) return;
      const payload = JSON.stringify({ roomId });
      navigator.sendBeacon("/api/beacon-leave", new Blob([payload], { type: "application/json" }));
    };
    // pagehide is more reliable than beforeunload on mobile/TG WebApp
    window.addEventListener("pagehide", handleBeaconLeave);
    window.addEventListener("beforeunload", handleBeaconLeave);
    return () => {
      window.removeEventListener("pagehide", handleBeaconLeave);
      window.removeEventListener("beforeunload", handleBeaconLeave);
    };
  }, [isSeated, isValidRoom, roomId]);

  // Detect phase changes for card animations + sound effects + settlement notifications
  useEffect(() => {
    if (tableState?.phase && tableState.phase !== lastPhase) {
      if (["flop", "turn", "river"].includes(tableState.phase) && lastPhase !== "") {
        // Only animate newly dealt cards (flop: 0-2, turn: 3, river: 4)
        const prevLen = prevCommunityLenRef.current;
        setAnimateFromIndex(prevLen);
        setAnimateCards(true);
        setTimeout(() => setAnimateCards(false), 2000);
        // Play individual card sound for each new card (matching animation delay of 450ms)
        if (!muted) {
          const newCardCount = tableState.phase === "flop" ? 3 : 1;
          for (let ci = 0; ci < newCardCount; ci++) {
            setTimeout(() => playSound("dealSingle"), ci * 300);
          }
        }
        // Detect all-in runout: if all non-folded players are all-in, show notification
        const activePlayers = (tableState.players || []).filter((p: any) => !p.isFolded && p.isActive !== false);
        const allInCount = activePlayers.filter((p: any) => p.isAllIn).length;
        if (allInCount >= activePlayers.length - 1 && activePlayers.length >= 2 && lastPhase !== "") {
          toast.info(t("table.allInRunout"), { description: t("table.allInRunoutDesc"), duration: 2500 });
        }
      }
      // Showdown: animate opponent card reveal + show entering showdown notification
      if (tableState.phase === "showdown" && lastPhase !== "showdown") {
        // Set animateFromIndex to 5 so no community card (max index 4) gets re-animated
        setAnimateFromIndex(5);
        setAnimateCards(true);
        setTimeout(() => setAnimateCards(false), 2000);
        if (!muted) playSound("cardFlip");
        toast.info(t("table.enteringShowdown"), { description: t("table.showdownDesc"), duration: 2500 });
      }
      if (tableState.phase === "preflop" && lastPhase !== "" && lastPhase !== "preflop") {
        if (!muted) playSound("deal");
        // Trigger dealing animation for hero hole cards
        setDealingMyCards(true);
        setTimeout(() => setDealingMyCards(false), 1600);
      }
      setLastPhase(tableState.phase);
    }
  }, [tableState?.phase, tableState?.players, lastPhase, muted, playSound, t]);

  // Also trigger dealing animation when myCards first arrive (e.g. on reconnect mid-hand)
  const myCardsLen = tableState?.myCards?.length ?? 0;
  useEffect(() => {
    if (myCardsLen > 0 && prevMyCardsLenRef.current === 0) {
      setDealingMyCards(true);
      setTimeout(() => setDealingMyCards(false), 1600);
      if (!muted) playSound("deal");
    }
    prevMyCardsLenRef.current = myCardsLen;
  }, [myCardsLen, muted, playSound]);

  // Detect winner - use handNumber + phase as primary detection to avoid polling race conditions
  // Problem solved: when same player wins consecutive hands with same amount, winnerKey doesn't change
  // between polls if the client misses the brief "lastWinner=null" window during new hand start.
  // Solution: track the last settled handNumber and trigger on any new completed hand.
  const lastSettledHandRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("");
  // Track if this is the first data load after mount - skip animation for stale completed state
  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    const currentPhase = tableState?.phase || "";
    const currentHandNum = tableState?.handNumber ?? 0;
    
    // On first data load: if already in completed state, mark as already settled
    // This prevents replaying settlement animation when returning to the page
    if (isFirstLoadRef.current && tableState) {
      isFirstLoadRef.current = false;
      if (currentPhase === "completed" && currentHandNum > 0) {
        lastSettledHandRef.current = currentHandNum;
        prevPhaseRef.current = currentPhase;
        return; // Skip animation on re-entry
      }
    }
    
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
        // Sort by hand rank (best hand wins), not by amount
        const HAND_RANK_ORDER: Record<string, number> = {
          "royal_flush": 10, "straight_flush": 9, "four_of_a_kind": 8,
          "full_house": 7, "flush": 6, "straight": 5, "three_of_a_kind": 4,
          "two_pair": 3, "one_pair": 2, "high_card": 1, "last_standing": 0, "Last Standing": 0,
        };
        const primaryWinner = [...(tableState.settlementDetail?.winners || [])].sort((a: any, b: any) => {
          const rankA = HAND_RANK_ORDER[a.handRank] || HAND_RANK_ORDER[a.handDescription] || 0;
          const rankB = HAND_RANK_ORDER[b.handRank] || HAND_RANK_ORDER[b.handDescription] || 0;
          if (rankB !== rankA) return rankB - rankA;
          return b.amount - a.amount;
        })?.[0];
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
      if (winnerTimeoutRef.current) clearTimeout(winnerTimeoutRef.current);
      winnerTimeoutRef.current = setTimeout(() => { setShowWinner(null); setShowSettlement(null); setWinnerPlayerIds([]); winnerTimeoutRef.current = null; }, 3000);
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
  const kickGraceCountRef = useRef(0); // Grace period counter: must see player missing N times before triggering kicked
  const KICK_GRACE_THRESHOLD = 6; // Require 6 consecutive polls confirming player is missing (~3-7s)
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
      // Grace period: require multiple consecutive polls confirming player is missing
      // This prevents false kicks during async transitions (e.g. startNewHand deleting activeTables briefly)
      kickGraceCountRef.current++;
      if (kickGraceCountRef.current < KICK_GRACE_THRESHOLD) return;
      // TOURNAMENT: If eliminated or finished, show full-screen overlay
      const tInfo = (tableState as any)?.tournamentInfo;
      if (tInfo?.isTournament && (tInfo?.myEliminated || tInfo?.isFinished)) {
        kickDetectedRef.current = true;
        setTournamentEndInfo({
          rank: tInfo.myRank || 0,
          prize: tInfo.myPrize || 0,
          totalPlayers: tInfo.playersRemaining || 0,
          tournamentName: tInfo.tournamentName,
        });
        setIsSeated(false);
        isLeavingRef.current = true;
        setIsLeaving(true);
        return;
      }
      // TOURNAMENT: If we were in a tournament but tournamentInfo is gone (table closed),
      // treat as tournament ended gracefully - show overlay
      if (wasTournamentRef.current) {
        kickDetectedRef.current = true;
        setTournamentEndInfo({
          rank: 0,
          prize: 0,
          totalPlayers: 0,
        });
        setIsSeated(false);
        isLeavingRef.current = true;
        setIsLeaving(true);
        return;
      }
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
    if (myPlayerInState) { kickDetectedRef.current = false; kickGraceCountRef.current = 0; }

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
      // Play coin sound for opponent bet/call/raise actions
      if (["bet", "call", "raise"].includes(info.action)) {
        playSound("coinDrop");
      } else if (info.action === "fold") {
        playSound("fold");
      } else if (info.action === "check") {
        playSound("check");
      } else if (info.action === "all_in" || info.action === "allin") {
        playSound("allIn");
      }
      announceAction(info.action, info.amount, info.playerName);
    }
  }, [(tableState as any)?.lastActionInfo, muted, user?.id, announceAction]);

  // Mutations
  const reportLocationMutation = trpc.game.reportLocation.useMutation();
  const joinMutation = trpc.game.join.useMutation({
    onSuccess: (data) => {
      // AUTO-REDIRECT: If server redirected to a different table, navigate there
      if (data.redirectedRoomId && data.redirectedRoomId !== roomId) {
        toast.success(t("table.redirectedToTable") || `Table full, redirected to ${data.redirectedRoomName || "another table"}`, { duration: 2000 });
        utils.wallet.balance.invalidate();
        navigate(`/table/${data.redirectedRoomId}`);
        return;
      }
      setIsSeated(true);
      setShowBuyIn(false);
      joinSettledRef.current = false; // reset: wait for tableState to confirm player presence
      kickDetectedRef.current = false;
      if (data.message === "WAITING_FOR_NEXT_HAND") {
        // Player joined mid-game as sitting_out (Wait for Big Blind)
        toast.success(t("table.waitingForNextHand"), { duration: 3000 });
      } else {
        toast.success(t("table.seatJoined", { seat: data.seatIndex + 1 }), { duration: 1000 });
      }
      // Immediately refetch table state to show avatar
      utils.game.tableState.invalidate({ roomId });
      utils.rooms.getPlayers.invalidate({ roomId });
      utils.wallet.balance.invalidate();
      // Report geolocation for anti-collusion detection
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            reportLocationMutation.mutate({
              roomId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          () => { /* GPS denied or unavailable, skip */ }
        );
      }
    },
    onError: (err) => {
      // If already in another game, show localized message and redirect to lobby
      if (err.message?.includes("Already in another game")) {
        toast.error(t("table.alreadyInGame"));
        setTimeout(() => navigate("/lobby"), 1500);
      } else if (err.message?.includes("ALREADY_SEATED_THIS_TABLE")) {
        // Same account is already seated at this table from another device
        toast.error(t("table.alreadySeatedOtherDevice"));
        setTimeout(() => navigate("/lobby"), 2000);
      } else if (err.message?.includes("PRIVATE_ROOM_DEPOSIT_REQUIRED")) {
        toast.error(t("table.privateRoomDepositRequired"));
        setTimeout(() => navigate("/lobby"), 2000);
      } else {
        toast.error(translateError(err.message));
      }
    },
  });

  const leaveMutation = trpc.game.leave.useMutation({
    onSuccess: (data) => {
      isLeavingRef.current = true;
      setIsLeaving(true);
      setIsSeated(false);
      // Reset all join/kick guards so re-entry works cleanly
      kickDetectedRef.current = false;
      joinSettledRef.current = false;
      // Show chips returned info
      if (data.remainingChips > 0) {
        toast.success(`${t("table.left")} (+$${data.remainingChips.toFixed(2)})`, { duration: 2000 });
      } else {
        toast.success(t("table.left"), { duration: 1000 });
      }
      utils.wallet.balance.invalidate();
      // Navigate back to lobby after leaving
      navigate("/lobby");
    },
    onError: (err) => toast.error(translateError(err.message)),
  });

  // allRooms query removed - auto-switch after fold disabled

  const actionMutation = trpc.game.action.useMutation({
    onMutate: () => {
      // Optimistic: immediately refetch to get new state faster
      utils.game.tableState.invalidate({ roomId });
    },
    onSuccess: (_, variables) => {
      utils.game.tableState.invalidate({ roomId });
      // Play sound based on action type + voice announcement
      if (!muted) {
        const action = (variables as any)?.action;
        const amount = (variables as any)?.amount;
        if (action === "fold") { playSound("fold"); announceAction("fold"); }
        else if (action === "check") { playSound("check"); announceAction("check"); }
        else if (action === "call") { playSound("coinDrop"); announceAction("call", amount); }
        else if (action === "raise" || action === "bet") { playSound("coinDrop"); announceAction("raise", amount); }
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
        toast.error(translateError(err.message));
      }
    },
  });

  const readyMutation = trpc.game.ready.useMutation({
    onSuccess: () => {
      utils.game.tableState.invalidate({ roomId });
      if (!muted) playSound("check");
    },
    onError: (err) => toast.error(translateError(err.message)),
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
  const [showTableMenu, setShowTableMenu] = useState(false);
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
    onError: (err) => toast.error(translateError(err.message)),
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
  const handNumber = tableState?.handNumber ?? 0;
  const showdownRevealOrder: number[] = (tableState as any)?.showdownRevealOrder ?? [];
  const amISittingOut = (tableState as any)?.amISittingOut ?? false;

  // === Hand number change: reset all visual state from previous hand ===
  useEffect(() => {
    if (handNumber > 0 && handNumber !== prevHandNumberRef.current && prevHandNumberRef.current > 0) {
      // Clear winner banner & settlement
      if (winnerTimeoutRef.current) { clearTimeout(winnerTimeoutRef.current); winnerTimeoutRef.current = null; }
      setShowWinner(null);
      setShowSettlement(null);
      setWinnerPlayerIds([]);
      // Clear showdown reveal timers
      revealTimersRef.current.forEach(t => clearTimeout(t));
      revealTimersRef.current = [];
      setRevealedOpponentIds(new Set());
      // Reset animation states
      setAnimateCards(false);
      setDealingMyCards(false);
    }
    prevHandNumberRef.current = handNumber;
  }, [handNumber]);

  // === Phase transition: clear stale showdown state when new hand starts (preflop) ===
  // This handles the edge case where handNumber hasn't changed yet but phase already moved to preflop
  const prevPhaseForCleanupRef = useRef<string>("");
  useEffect(() => {
    const prev = prevPhaseForCleanupRef.current;
    const curr = phase;
    // If phase transitions from showdown/completed to preflop/waiting, clear all showdown visuals
    if ((prev === "showdown" || prev === "completed") && (curr === "preflop" || curr === "waiting")) {
      if (winnerTimeoutRef.current) { clearTimeout(winnerTimeoutRef.current); winnerTimeoutRef.current = null; }
      setShowWinner(null);
      setShowSettlement(null);
      setWinnerPlayerIds([]);
      revealTimersRef.current.forEach(t => clearTimeout(t));
      revealTimersRef.current = [];
      setRevealedOpponentIds(new Set());
      setAnimateCards(false);
      setDealingMyCards(false);
    }
    prevPhaseForCleanupRef.current = curr;
  }, [phase]);

  // === Tournament context ===
  const tournamentInfo = (tableState as any)?.tournamentInfo ?? null;
  const isTournamentTable = !!tournamentInfo?.isTournament;
  // Once we detect tournament, remember it permanently for this session
  if (isTournamentTable) wasTournamentRef.current = true;
  const tournamentEliminated = tournamentInfo?.myEliminated ?? false;
  const tournamentFinished = tournamentInfo?.isFinished ?? false;

  // === Showdown sequential reveal ===
  // Track which opponent IDs have been "flipped" face-up during showdown
  const [revealedOpponentIds, setRevealedOpponentIds] = useState<Set<number>>(new Set());
  const prevShowdownPhaseRef = useRef(false);
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => {
    const isShowdown = phase === "showdown" || phase === "completed";
    if (isShowdown && !prevShowdownPhaseRef.current) {
      // Just entered showdown: reveal opponents one by one
      prevShowdownPhaseRef.current = true;
      setRevealedOpponentIds(new Set()); // reset
      const currentPlayers = playersRef.current;
      const order = showdownRevealOrder.length > 0 ? showdownRevealOrder
        : currentPlayers.filter(p => p.id !== user?.id && !p.isFolded && p.holeCards?.length > 0).map(p => p.id);
      revealTimersRef.current.forEach(t => clearTimeout(t));
      revealTimersRef.current = [];
      order.forEach((pid, idx) => {
        const timer = setTimeout(() => {
          setRevealedOpponentIds(prev => new Set([...prev, pid]));
          if (!muted) playSound("cardFlip");
        }, idx * 400 + 200);
        revealTimersRef.current.push(timer);
      });
    } else if (!isShowdown && prevShowdownPhaseRef.current) {
      prevShowdownPhaseRef.current = false;
      setRevealedOpponentIds(new Set());
    }
  }, [phase, showdownRevealOrder, user?.id, muted, playSound]);

  // Countdown timer with urgency feedback - runs for ALL players' turns (not just hero)
  const [countdown, setCountdown] = useState(30);
  const currentPlayerId = tableState?.currentPlayerId;
  const hasActivePlayer = !!currentPlayerId && phase !== "waiting" && phase !== "showdown" && phase !== "completed";
  useEffect(() => {
    if (!hasActivePlayer) return;
    const elapsed = Math.floor((Date.now() - lastActionAt) / 1000);
    const remaining = Math.max(0, turnTimeout - elapsed);
    setCountdown(remaining);
    const timer = setInterval(() => {
      setCountdown(prev => {
        const next = Math.max(0, prev - 1);
        // Vibrate + sound on last 5 seconds (only for hero's turn)
        if (isMyTurn && next <= 5 && next > 0) {
          if (navigator.vibrate) navigator.vibrate(50);
          if (!muted) playSound("timer");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasActivePlayer, isMyTurn, lastActionAt, turnTimeout, muted, playSound]);

  const isUrgent = hasActivePlayer && countdown <= 5 && countdown > 0;
  const countdownProgress = hasActivePlayer ? countdown / turnTimeout : 1;

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
        // Tournament tables: NEVER show buy-in dialog (players join via tournament system)
        if (room && room.inviteCode?.startsWith("T")) {
          setShowBuyIn(false);
          return;
        }
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

  // Deduplicate players by seatIndex to prevent visual overlap (race condition safety net)
  const deduplicatedPlayers = useMemo(() => {
    const seen = new Map<number, typeof players[0]>();
    for (const p of players) {
      // If same seatIndex already exists, prefer the active (non-sitting-out) player
      const existing = seen.get(p.seatIndex);
      if (!existing || (existing as any).isSittingOut) {
        seen.set(p.seatIndex, p);
      }
    }
    // Also deduplicate by userId (same player shouldn't appear twice)
    const byId = new Map<number, typeof players[0]>();
    for (const p of seen.values()) {
      const existing = byId.get(p.id as number);
      if (!existing || (existing as any).isSittingOut) {
        byId.set(p.id as number, p);
      }
    }
    return Array.from(byId.values());
  }, [players]);
  const displayPlayers = isDemoMode ? demoPlayers : deduplicatedPlayers;
  // When waitingForReady AND winner banner is gone, clear cards/pot to reset the table
  // Keep showing last hand's cards while the winner banner is still visible
  const shouldClearTable = waitingForReady && !showWinner;
  const displayCommunity = isDemoMode ? demoCommunity : (shouldClearTable ? [] : communityCards);
  const displayMyCards = isDemoMode ? demoMyCards : (shouldClearTable ? [] : myCards);
  const displayPot = isDemoMode ? 12.5 : (shouldClearTable ? 0 : pot);

  // Track community card count for incremental animation
  useEffect(() => {
    prevCommunityLenRef.current = displayCommunity.length;
  }, [displayCommunity.length]);
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
  const canRebuy = isSeated && (waitingForReady || phase === "waiting") && !isDemoMode && !isTournamentTable;
  const isLowChips = myPlayer && myPlayer.chips > 0 && myPlayer.chips < bigBlindValue * 5;
  // Can switch table: seated, between hands, not demo, not tournament
  const canSwitchTable = isSeated && (waitingForReady || phase === "waiting") && !isDemoMode && !!room && !isTournamentTable;

  const handleSwitchTable = async () => {
    if (!room || !canSwitchTable) return;
    setIsSwitchingTable(true);
    try {
      const result = await switchTableMutation.mutateAsync({ currentRoomId: roomId });
      // Check if chips are below min buy-in threshold (50% of minBuyIn)
      const minBuyIn = parseFloat(room.minBuyIn);
      const currentChips = myPlayer?.chips ?? 0;
      if (currentChips < minBuyIn * 0.5) {
        toast.warning(t("table.lowChipsWarning"));
      }
      navigate(`/table/${result.newRoomId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || t("table.switchTableFailed"));
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
      className="flex flex-col"
      style={{ ...containerStyle, background: 'linear-gradient(to bottom, #0a1628, #0d1f3c, #060e1a)' }}
    >
      {/* Tournament End Overlay */}
      {tournamentEndInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="w-[90%] max-w-sm rounded-2xl p-6 text-center shadow-2xl" style={{ background: 'linear-gradient(to bottom, #1a2744, #0d1a2e)', border: '1px solid rgba(234,179,8,0.3)' }}>
            {/* Trophy icon */}
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(to bottom right, rgba(234,179,8,0.3), rgba(234,179,8,0.1))' }}>
              <span className="text-3xl">{tournamentEndInfo.rank === 1 ? "🏆" : tournamentEndInfo.rank === 2 ? "🥈" : tournamentEndInfo.rank === 3 ? "🥉" : "🎮"}</span>
            </div>
            {/* Title */}
            <h2 className="text-xl font-bold text-gold mb-1">{t("tourney.statusFinished")}</h2>
            {tournamentEndInfo.tournamentName && (
              <p className="text-sm text-muted-foreground mb-4">{tournamentEndInfo.tournamentName}</p>
            )}
            {/* Rank */}
            {tournamentEndInfo.rank > 0 && (
              <div className="bg-black/30 rounded-xl p-4 mb-4">
                <p className="text-sm text-muted-foreground mb-1">{t("tourney.yourRank")}</p>
                <p className="text-4xl font-black text-foreground">#{tournamentEndInfo.rank}</p>
                {tournamentEndInfo.totalPlayers > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">/ {tournamentEndInfo.totalPlayers} {t("tourney.players")}</p>
                )}
              </div>
            )}
            {/* Prize */}
            {tournamentEndInfo.prize > 0 && (
              <div className="bg-gold/10 border border-gold/20 rounded-xl p-3 mb-4">
                <p className="text-sm text-muted-foreground mb-1">{t("tourney.prize")}</p>
                <p className="text-2xl font-bold text-gold">+${tournamentEndInfo.prize.toLocaleString()}</p>
              </div>
            )}
            {/* Back to lobby button */}
            <button
              onClick={() => navigate("/lobby")}
              className="w-full py-3 rounded-xl text-black font-bold text-base hover:brightness-110 active:scale-[0.97] transition-all duration-150"
              style={{ background: 'linear-gradient(to right, #eab308, #f59e0b)' }}
            >
              {t("tourney.backToLobby")}
            </button>
          </div>
        </div>
      )}

      {/* Room Invite Poster Overlay */}
      {showRoomPoster && room && room.inviteCode && (
        <RoomInvitePoster
          room={room}
          inviteCode={room.inviteCode}
          onClose={() => setShowRoomPoster(false)}
        />
      )}
      {/* Floating Menu Button (top-left) - replaces fixed top bar for more table space */}
      <button
        onClick={() => setShowTableMenu(true)}
        className="absolute z-30 w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform left-2"
        style={{ top: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 4px)' }}
      >
        <Menu className="w-4.5 h-4.5 text-white/80" />
      </button>

      {/* Floating room name + phase (top-center) */}
      <div
        className="absolute z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm"
        style={{ top: '48%', left: '50%', transform: 'translateX(-50%)' }}
      >
        {isTournamentTable && <Trophy className="w-3 h-3 text-gold" />}
        <span className="text-[11px] text-white/70 font-medium truncate max-w-[100px]">
          {room ? room.name : isDemoMode ? t("table.demo") : `#${id}`}
        </span>
        {displayPhase !== "waiting" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/30 text-truth-blue font-medium">
            {phaseNames[displayPhase] || displayPhase}
          </span>
        )}
      </div>

      {/* Floating sound toggle (top-right) */}
      <button
        onClick={() => { setMuted(!muted); toggleSound(); }}
        className="absolute z-30 w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform right-2"
        style={{ top: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 4px)' }}
      >
        {muted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-white/80" />}
      </button>

      {/* Slide-out Menu Panel */}
      {showTableMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowTableMenu(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="absolute top-0 left-0 h-full w-[220px] border-r border-white/10 shadow-2xl p-4 flex flex-col gap-1" style={{ background: 'linear-gradient(to bottom, #1a2744, #0d1a2e)', paddingTop: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 16px)' }} onClick={e => e.stopPropagation()}>
            {/* Close */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white">{room?.name || t("table.demo")}</span>
              <button onClick={() => setShowTableMenu(false)} className="p-1 rounded-lg text-white/60 hover:text-white active:scale-90">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Menu items */}
            <button onClick={() => { setShowTableMenu(false); isLeavingRef.current = true; navigate("/lobby"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 active:scale-95 transition-all">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">{t("common.back")}</span>
            </button>
            {isSeated && !isDemoMode && !isTournamentTable && (
              <button onClick={() => { setShowTableMenu(false); handleLeave(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 active:scale-95 transition-all">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">{t("table.leave")}</span>
              </button>
            )}
            <button onClick={() => { setShowTableMenu(false); navigate(`/history/${id}`); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 active:scale-95 transition-all">
              <Clock className="w-4 h-4 text-gold" />
              <span className="text-sm">{t("table.handHistory")}</span>
            </button>
            <button onClick={() => { setShowTableMenu(false); navigate("/verify"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 active:scale-95 transition-all">
              <Shield className="w-4 h-4 text-truth-blue" />
              <span className="text-sm">{t("table.verify")}</span>
            </button>
            {room?.type === "private" && room?.inviteCode && (
              <button onClick={() => { setShowTableMenu(false); setShowRoomPoster(true); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 active:scale-95 transition-all">
                <ImageIcon className="w-4 h-4 text-gold/70" />
                <span className="text-sm">{t("room.generatePoster")}</span>
              </button>
            )}
            {/* Voice mode */}
            <button
              onClick={() => {
                const modes: Array<"off" | "winner_only" | "all"> = ["off", "winner_only", "all"];
                const currentIdx = modes.indexOf(voiceMode);
                const nextMode = modes[(currentIdx + 1) % 3];
                setVoiceMode(nextMode);
                const labels: Record<string, string> = { off: t("voice.off"), winner_only: t("voice.winnerOnly"), all: t("voice.all") };
                toast(labels[nextMode], { duration: 1500 });
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${voiceMode === "off" ? "text-white/40" : voiceMode === "winner_only" ? "text-gold" : "text-green-400"}`}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
              <span className="text-sm">{voiceMode === "off" ? t("voice.off") : voiceMode === "winner_only" ? t("voice.winnerOnly") : t("voice.all")}</span>
            </button>
            {room?.type === "private" && room?.inviteCode && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <span className="text-[10px] font-mono text-white/40">{t("room.code")}: {room.inviteCode}</span>
              </div>
            )}
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

      {/* Winner Announcement - minimal banner below community cards, only shows winner name + amount + hand type */}
      {/* Removed: confetti, trophy icon, showdown players comparison list, side pots display */}

      {/* Table Area - flex-1 min-h-0 ensures it fills all remaining vertical space */}
      {/* max-h limits table to ~55% of screen so it doesn't look oversized on tall phones */}
      <div ref={tableAreaRef} className="flex-1 min-h-0 relative overflow-hidden" style={{ backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/table-bg-clean-6gTEKxokqcP8zS3GCvWNKd.webp)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0a1a2e' }}>
        {/* Vertical Countdown Timer - pinned to far left edge, only for hero's turn */}
        {displayIsMyTurn && (
          <div className="absolute -left-0.5 top-[25%] bottom-[25%] z-20 flex flex-col items-center gap-0.5">
            <div className={`relative w-1.5 flex-1 rounded-full overflow-hidden ${isUrgent ? 'animate-pulse' : ''}`} style={{ background: 'rgba(100,100,120,0.4)' }}>
              <div
                className="absolute bottom-0 w-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  height: `${(countdown / turnTimeout) * 100}%`,
                  background: countdown > 10
                    ? 'linear-gradient(to top, #2563eb, #eab308)'
                    : countdown > 5
                      ? 'linear-gradient(to top, #f97316, #eab308)'
                      : 'linear-gradient(to top, #dc2626, #f87171)'
                }}
              />
            </div>
            <div className={`text-[9px] font-bold ${isUrgent ? 'text-red-400' : 'text-gold'}`}>
              {countdown}s
            </div>
          </div>
        )}
        {/* Game content overlay */}
        <div className="absolute inset-0">



            {/* Pot display - above community cards */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20">
              <AnimatedPot amount={displayPot} />
              {displayPlayers.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{displayPlayers.filter(p => !p.isFolded).length}/{displayPlayers.length}</span>
                </div>
              )}
            </div>

            {/* Community Cards - fixed 5 positions from left to right */}
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-15" style={{ '--deal-comm-x': '130px', '--deal-comm-y': '-130px' } as React.CSSProperties}>
              {[0, 1, 2, 3, 4].map((i) => {
                const card = displayCommunity[i];
                if (!card) {
                  // Empty placeholder - invisible but reserves space
                  return <div key={`h${handNumber}-empty${i}`} className="w-[44px] h-[62px]" />;
                }
                const isNewCard = animateCards && i >= animateFromIndex;
                const cardDelay = isNewCard ? (i - animateFromIndex) * 300 : 0;
                const isWinnerCard = (displayPhase === "showdown" || displayPhase === "completed") && winnerBestCards.has(card);
                return (
                  <div key={`h${handNumber}-c${i}`} style={isNewCard ? { animationDelay: `${cardDelay}ms`, opacity: 0 } : undefined} className={isNewCard ? 'animate-deal-community' : ''}>
                    <CardView card={card} className="!w-[44px] !h-[62px]" highlight={isWinnerCard} />
                  </div>
                );
              })}
            </div>

            {/* Showdown / Comparing Hands Banner */}
            {(displayPhase === "showdown") && !showWinner && (
              <div className="absolute top-[62%] left-1/2 -translate-x-1/2 z-20 animate-banner">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 border border-gold/50 backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-xs font-bold text-gold">{t("table.comparingHands")}</span>
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                </div>
              </div>
            )}

            {/* Winner Result Banner - positioned below community cards, only shows winner info */}
            {showWinner && (
              <div className="absolute top-[58%] left-1/2 -translate-x-1/2 z-20 animate-banner pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-2.5 text-center border border-gold/50 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  {(() => {
                    const primaryWinner = showSettlement?.winners?.length > 0
                      ? [...showSettlement.winners].sort((a: any, b: any) => b.amount - a.amount)[0]
                      : { name: showWinner.name, amount: showWinner.amount, handDescription: showWinner.handDescription };
                    const handKey = primaryWinner.handDescription && HAND_RANK_MAP[primaryWinner.handDescription];
                    const handName = handKey ? t(handKey) : primaryWinner.handDescription;
                    return (
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-sm font-bold text-gold">{primaryWinner.name} {t("table.won")}</p>
                        <p className="text-lg font-black text-yellow-300">{fmtAmt(primaryWinner.amount)}</p>
                        {handName && handName !== "Last Standing" && (
                          <p className="text-xs font-medium text-gold/80">{handName}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Tournament HUD - show blind level, players remaining, next blind timer */}
            {isTournamentTable && tournamentInfo && !showWinner && (
              <div className="absolute top-[3%] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-gold/40 backdrop-blur-sm">
                <span className="text-[10px] text-gold font-bold">{t("tourney.blindLevel")} {tournamentInfo.blindLevel}</span>
                <span className="text-[10px] text-muted-foreground">|</span>
                <span className="text-[10px] text-foreground font-medium">{tournamentInfo.currentBlinds?.smallBlind}/{tournamentInfo.currentBlinds?.bigBlind}</span>
                <span className="text-[10px] text-muted-foreground">|</span>
                <span className="text-[10px] text-foreground">
                  <Users className="w-3 h-3 inline mr-0.5" />{tournamentInfo.playersRemaining}/{tournamentInfo.totalPlayers}
                </span>
                {tournamentInfo.timeUntilNextLevel > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">|</span>
                    <span className="text-[10px] text-amber-400">
                      {Math.floor(tournamentInfo.timeUntilNextLevel / 60000)}:{String(Math.floor((tournamentInfo.timeUntilNextLevel % 60000) / 1000)).padStart(2, '0')}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Tournament: auto-start indicator (replaces ready button) */}
            {isTournamentTable && waitingForReady && !isDemoMode && !showWinner && (
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-gold/40">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-xs text-gold font-medium">{t("tourney.inProgress")}</span>
                </div>
              </div>
            )}

            {/* Start Next Hand button in center of table - only show after settlement overlay dismissed (regular tables only) */}
            {waitingForReady && !isDemoMode && !showWinner && !isTournamentTable && (
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
                {myPlayer && myPlayer.chips <= 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="px-4 py-2 rounded-full bg-black/60 border border-red-500/50 text-red-400 text-xs font-semibold">
                      {t("table.noChips")}
                    </div>
                    <button
                      onClick={() => setShowRebuyDialog(true)}
                      className="px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg active:scale-[0.97]"
                      style={{ background: 'linear-gradient(to right, #22c55e, #059669)' }}
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
                    className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-lg transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #22c55e, #059669)', boxShadow: '0 10px 15px -3px rgba(34,197,94,0.4)', animation: 'pulse 2s infinite' }}
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
                      className="px-3 py-1.5 rounded-full text-white text-[11px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-1"
                      style={{ background: 'linear-gradient(to right, rgba(245,158,11,0.8), rgba(202,138,4,0.8))' }}
                    >
                      <Plus className="w-3 h-3" />
                      {t("rebuy.addChips")}
                    </button>
                    {canSwitchTable && (
                      <button
                        onClick={handleSwitchTable}
                        disabled={isSwitchingTable}
                        className="px-3 py-1.5 rounded-full text-white text-[11px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-1 disabled:opacity-50"
                        style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.8), rgba(8,145,178,0.8))' }}
                      >
                        {isSwitchingTable ? (
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {t("table.switchTable")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          {/* Player Seats - positioned outside the table */}
          {(() => {
            // Rotation logic: rotate seats so hero is always at bottom (seat 0 position)
            // Use hero's seatIndex as rotation anchor - stable across polling
            const heroSeatIndex = (() => {
              if (isDemoMode) return 0;
              // Find my seatIndex from the players list
              const me = displayPlayers.find(p => p.id === user?.id);
              if (me) return me.seatIndex;
              // Not seated: no rotation (fixed view)
              return 0;
            })();
            const totalSeats = SEAT_POSITIONS.length; // 6

            return displayPlayers.map(player => {
            // Rotate: shift player's visual position so hero appears at seat 0 (bottom)
            const visualSeatIndex = (player.seatIndex - heroSeatIndex + totalSeats) % totalSeats;
            const pos = SEAT_POSITIONS[visualSeatIndex];
            if (!pos) return null;
            const isHero = player.id === user?.id || (isDemoMode && player.seatIndex === 0);
            const isCurrentTurn = isDemoMode ? player.isActive : (tableState?.currentPlayerId === player.id);
            const isWinner = winnerPlayerIds.includes(player.id);
            const isLoser = winnerPlayerIds.length > 0 && !winnerPlayerIds.includes(player.id) && !player.isFolded;
            const isTopPlayer = visualSeatIndex === 3; // Top-center visual position
            return (
              <div
                key={player.id}
                className={`absolute transition-all duration-300 ${(displayPhase === "showdown" || displayPhase === "completed") ? "z-[35]" : "z-10"} ${isLoser ? "animate-loser" : ""}`}
                style={{ top: pos.top, left: pos.left, transform: pos.transform }}
              >
                <div className={`flex flex-col items-center gap-0.5 ${isCurrentTurn ? "scale-110" : ""} transition-transform duration-200`}>
                  {/* Player cards next to seat */}
                  {isHero && displayMyCards.length > 0 && (
                    <div className="flex flex-col items-center gap-0.5 mb-0.5" style={isTopPlayer ? { order: 10 } : undefined}>
                      <div className="flex gap-1" style={{ '--deal-from-x': '100px', '--deal-from-y': '-250px' } as React.CSSProperties}>
                        {displayMyCards.map((card, i) => {
                          const isHighlighted = (displayPhase === "showdown" || displayPhase === "completed") && winnerPlayerIds.includes(user?.id || 0) && winnerBestCards.has(card);
                          return <CardView key={`h${handNumber}-m${i}`} card={card} className={`!w-12 !h-[64px]${dealingMyCards ? (i === 0 ? ' animate-deal' : ' animate-deal-2') : ''}`} animate delay={i * 200} highlight={isHighlighted} />;
                        })}
                      </div>
                      {/* Real-time hand strength hint: only show during flop/turn/river */}
                      {(displayPhase === "flop" || displayPhase === "turn" || displayPhase === "river") && displayMyCards.length >= 2 && displayCommunity.length >= 3 && (() => {
                        const strengthKey = calcHandStrengthKey(displayMyCards, displayCommunity);
                        return strengthKey ? (
                          <div className="px-2.5 py-1 rounded-full text-[13px] font-bold leading-none bg-black/60 border border-gold/40 text-gold shadow-[0_0_6px_rgba(212,175,55,0.3)] whitespace-nowrap">
                            {t(strengthKey)}
                          </div>
                        ) : null;
                      })()}
                      {/* Final hand label in showdown/completed */}
                      {(displayPhase === "showdown" || displayPhase === "completed") && showSettlement?.showdownPlayers && user && (() => {
                        const sp = showSettlement.showdownPlayers.find((s: any) => s.playerId === user.id);
                        if (!sp || !sp.handDescription) return null;
                        const isWinner = winnerPlayerIds.includes(user.id);
                        const handKey = HAND_RANK_MAP[sp.handDescription];
                        const handName = handKey ? t(handKey) : sp.handDescription;
                        return (
                          <div className={`px-2.5 py-1 rounded-full text-[13px] font-bold border backdrop-blur-sm transition-all duration-300 ${
                            isWinner
                              ? 'bg-gold/20 border-gold/50 text-gold shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                              : 'bg-black/40 border-white/20 text-white/80'
                          }`}>
                            {handName}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Opponent cards: only show face-up in showdown/completed phase with sequential flip animation */}
                  {!isHero && (displayPhase === "showdown" || displayPhase === "completed") && player.holeCards && player.holeCards.length > 0 && !waitingForReady && (
                    <div className="flex flex-col items-center gap-0.5 mb-0.5" style={isTopPlayer ? { order: 10 } : undefined}>
                      <div className="flex gap-0.5">
                        {player.holeCards.map((card, i) => {
                          const isHighlighted = winnerPlayerIds.includes(player.id) && winnerBestCards.has(card) && revealedOpponentIds.has(player.id);
                          return (
                            <CardView
                              key={`h${handNumber}-o${player.id}-${i}`}
                              card={card}
                              className="!w-[36px] !h-[48px]"
                              flip={revealedOpponentIds.has(player.id)}
                              delay={i * 200}
                              highlight={isHighlighted}
                            />
                          );
                        })}
                      </div>
                      {/* Hand strength label - shows after cards are revealed */}
                      {revealedOpponentIds.has(player.id) && showSettlement?.showdownPlayers && (() => {
                        const sp = showSettlement.showdownPlayers.find((s: any) => s.playerId === player.id);
                        if (!sp || !sp.handDescription) return null;
                        const isWinner = winnerPlayerIds.includes(player.id);
                        const handKey = HAND_RANK_MAP[sp.handDescription];
                        const handName = handKey ? t(handKey) : sp.handDescription;
                        return (
                          <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[12px] font-bold border backdrop-blur-sm transition-all duration-300 ${
                            isWinner
                              ? 'bg-gold/20 border-gold/50 text-gold shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                              : 'bg-black/40 border-white/20 text-white/80'
                          }`}>
                            {handName}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Show face-down cards for opponents during active hand (preflop/flop/turn/river) */}
                  {!isHero && displayPhase !== "showdown" && displayPhase !== "completed" && !player.isFolded && displayPhase !== "waiting" && !waitingForReady && !(player as any).isSittingOut && (
                    <div className="flex gap-0.5 mb-0.5" style={{ '--deal-from-x': `${visualSeatIndex === 1 || visualSeatIndex === 2 ? '140px' : visualSeatIndex === 3 ? '60px' : visualSeatIndex === 4 ? '-40px' : '-80px'}`, '--deal-from-y': `${visualSeatIndex === 1 || visualSeatIndex === 5 ? '-60px' : visualSeatIndex === 2 || visualSeatIndex === 4 ? '-140px' : '-180px'}`, ...(isTopPlayer ? { order: 10 } : {}) } as React.CSSProperties}>
                      <CardView faceDown className={`!w-7 !h-[36px]${dealingMyCards ? ' animate-deal' : ''}`} />
                      <CardView faceDown className={`!w-7 !h-[36px]${dealingMyCards ? ' animate-deal-2' : ''}`} />
                    </div>
                  )}

                  {/* Sitting out badge (waiting for next hand) */}
                  {(player as any).isSittingOut && (
                    <div className="mb-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 text-center" style={isTopPlayer ? { order: 5 } : undefined}>
                      {t("table.waitingBigBlind")}
                    </div>
                  )}

                  {/* ===== Action Label above avatar (KKPOKER style) ===== */}
                  {(() => {
                    const la = (player as any).lastAction;
                    // Folded players always show fold label regardless of phase
                    if (player.isFolded) {
                      return (
                        <div className={`mb-1 px-2.5 py-1 rounded text-[12px] font-extrabold leading-tight whitespace-nowrap shadow-xl border border-white/40 bg-gray-600/90 text-white`} style={{textShadow:'0 1px 3px rgba(0,0,0,0.6)', letterSpacing:'0.02em', ...(isTopPlayer ? { order: 5 } : {})}}>
                          {t('table.fold')}
                        </div>
                      );
                    }
                    if (!la || displayPhase === 'waiting' || displayPhase === 'showdown' || displayPhase === 'completed') return null;
                    const actionStyleMap: Record<string, { bg: string; text: string; label: string }> = {
                      fold:   { bg: 'bg-gray-600/90',    text: 'text-white',   label: t('table.fold') },
                      check:  { bg: 'bg-blue-500/90',    text: 'text-white',   label: t('table.check') },
                      call:   { bg: 'bg-emerald-500/90', text: 'text-white',   label: t('table.call') },
                      raise:  { bg: 'bg-amber-500/90',   text: 'text-black',   label: la.amount > 0 ? `${t('table.raise')} ${fmtAmt(la.amount)}` : t('table.raise') },
                      all_in: { bg: 'bg-red-500/90',     text: 'text-white',   label: t('table.allIn') },
                    };
                    const style = actionStyleMap[la.action];
                    if (!style) return null;
                    return (
                      <div className={`mb-1 px-2.5 py-1 rounded text-[12px] font-extrabold leading-tight whitespace-nowrap shadow-xl border border-white/40 ${style.bg} ${style.text}`} style={{textShadow:'0 1px 3px rgba(0,0,0,0.6)', letterSpacing:'0.02em', ...(isTopPlayer ? { order: 5 } : {})}}>
                        {style.label}
                      </div>
                    );
                  })()}

                  {/* Avatar circle with countdown ring */}
                  <div className={`relative w-10 h-10 rounded-full overflow-visible transition-all duration-200`} style={isTopPlayer ? { order: 2 } : undefined}>
                    {/* SVG countdown ring - shown for active player */}
                    {isCurrentTurn && (
                      <div className={`turn-timer-ring ${isUrgent ? 'turn-timer-ring--urgent' : ''}`}>
                        <svg viewBox="0 0 50 50">
                          {/* Background track */}
                          <circle
                            cx="25" cy="25" r="23"
                            stroke="rgba(212,175,55,0.2)"
                            strokeWidth="3"
                          />
                          {/* Countdown progress */}
                          <circle
                            cx="25" cy="25" r="23"
                            stroke={countdown > 10 ? '#d4af37' : countdown > 5 ? '#f59e0b' : '#ef4444'}
                            strokeWidth="3.5"
                            strokeDasharray={`${2 * Math.PI * 23}`}
                            strokeDashoffset={`${2 * Math.PI * 23 * (1 - countdownProgress)}`}
                            style={{ filter: `drop-shadow(0 0 ${isUrgent ? '6px' : '3px'} ${countdown > 10 ? '#d4af37' : countdown > 5 ? '#f59e0b' : '#ef4444'})` }}
                          />
                        </svg>
                      </div>
                    )}
                    {/* Avatar image */}
                    <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${
                      isWinner ? "border-gold shadow-[0_0_20px_rgba(234,179,8,0.8)] scale-110" :
                      isCurrentTurn ? "border-gold shadow-[0_0_12px_rgba(212,175,55,0.6)]" :
                      isHero ? "border-truth-blue/60" :
                      (player as any).isSittingOut ? "border-amber-500/40 opacity-70" :
                      player.isFolded ? "border-white/10 opacity-60" : "border-white/30"
                    }`}>
                      <img
                        src={(player as any).avatar || DEFAULT_AVATAR}
                        alt=""
                        className={`w-full h-full object-cover ${player.isFolded ? "grayscale opacity-60" : ""}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                      />
                    </div>
                    {/* Countdown number badge */}
                    {isCurrentTurn && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-20 ${
                        countdown > 10 ? 'bg-gold/90 text-black' : countdown > 5 ? 'bg-amber-500/90 text-black' : 'bg-red-500/90 text-white animate-pulse'
                      }`}>
                        {countdown}
                      </div>
                    )}
                  </div>

                  {/* Player info below avatar */}
                  <div className={`glass rounded-lg px-2 py-0.5 text-center min-w-[60px] transition-all duration-200 ${
                    player.isFolded ? "opacity-30 grayscale" : ""
                  } ${player.isAllIn ? "border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : ""}`} style={isTopPlayer ? { order: 3 } : undefined}>
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
                    <div style={isTopPlayer ? { order: 11 } : undefined}>
                      <ChipStack amount={player.currentBet} />
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
      {showBuyIn && !isSeated && !isDemoMode && !isTournamentTable && !wasTournamentRef.current && (
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
              {isTournamentTable ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/30">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-sm text-gold font-medium">{t("tourney.inProgress")}</span>
                </div>
              ) : players.length >= 2 ? (
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => readyMutation.mutate({ roomId })}
                    disabled={readyMutation.isPending}
                    className="px-6 py-2 rounded-full text-white font-bold text-sm shadow-lg transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #22c55e, #059669)', boxShadow: '0 10px 15px -3px rgba(34,197,94,0.4)' }}
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
              {isTournamentTable ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-[11px] text-gold">{t("tourney.inProgress")}</span>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground/60">{t("table.waiting")}</span>
              )}
            </div>
          )}

          {/* Sitting out: spectating mode with prominent banner */}
          {amISittingOut && !isDemoMode && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-lg shadow-amber-500/5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-sm text-amber-300 font-bold">
                    {t("table.spectatingMode")}
                  </span>
                  <span className="text-[11px] text-amber-300/70">
                    {t("table.waitingForNextHand")}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLeave}
                className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors"
              >
                {t("table.leaveTable")}
              </button>
            </div>
          )}

          {(displayPhase !== "waiting" || isDemoMode) && !waitingForReady && !amISittingOut && displayPhase !== "showdown" && displayPhase !== "completed" && !showWinner && (
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
                  className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2"
                  style={{ WebkitAppearance: 'none' }}
                />
                <span className="text-[10px] text-gold font-bold min-w-[36px] text-right">{fmtAmt(raiseAmount)}</span>
              </div>
              {/* Stack limit hint */}
              {myPlayer && raiseAmount >= myPlayer.chips + myPlayer.currentBet - 0.01 && (
                <div className="text-center mb-1">
                  <span className="text-[9px] text-muted-foreground/70 bg-muted/30 px-2 py-0.5 rounded-full">
                    {t("table.raiseAtMax")}
                  </span>
                </div>
              )}

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
                className="flex-1 py-2.5 rounded-xl text-background font-bold text-sm hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #eab308, #a78b00)' }}
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
                {t("table.allInConfirmMsg")}
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
                disabled={actionMutation.isPending || phase === "showdown" || phase === "completed" || !!showWinner}
                className="flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#c0392b,#e74c3c,#ff6b6b)', color: '#fff', boxShadow: '0 2px 14px rgba(231,76,60,0.5)' }}
              >
                {actionMutation.isPending ? "..." : t("table.allInConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
