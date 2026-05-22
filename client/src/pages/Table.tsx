import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { t } from "@/lib/i18n";
import { ArrowLeft, Shield, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

// Card rendering
const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: "♠", color: "text-foreground" },
  h: { symbol: "♥", color: "text-red-500" },
  d: { symbol: "♦", color: "text-blue-400" },
  c: { symbol: "♣", color: "text-green-400" },
};

function CardView({ card, faceDown = false, className = "" }: { card?: string; faceDown?: boolean; className?: string }) {
  if (!card || faceDown) {
    return (
      <div className={`w-10 h-14 rounded-lg bg-gradient-to-br from-truth-blue to-truth-blue/60 border border-truth-blue/40 flex items-center justify-center shadow-lg ${className}`}>
        <div className="w-6 h-8 rounded border border-truth-blue-bright/30 flex items-center justify-center">
          <span className="text-[8px] font-bold text-truth-blue-bright">VP</span>
        </div>
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const suitInfo = SUITS[suit] || SUITS.s;

  return (
    <div className={`w-10 h-14 rounded-lg bg-gradient-to-b from-white to-gray-100 border border-gray-300 flex flex-col items-center justify-center shadow-lg ${className}`}>
      <span className={`text-xs font-bold ${suitInfo.color}`}>{rank}</span>
      <span className={`text-sm ${suitInfo.color}`}>{suitInfo.symbol}</span>
    </div>
  );
}

// Player seat positions for 6-max table (oval layout)
const SEAT_POSITIONS = [
  { top: "75%", left: "50%", transform: "translate(-50%, -50%)" },  // Bottom (hero)
  { top: "55%", left: "5%", transform: "translate(0, -50%)" },     // Left bottom
  { top: "20%", left: "5%", transform: "translate(0, -50%)" },     // Left top
  { top: "5%", left: "50%", transform: "translate(-50%, 0)" },     // Top
  { top: "20%", left: "95%", transform: "translate(-100%, -50%)" },// Right top
  { top: "55%", left: "95%", transform: "translate(-100%, -50%)" },// Right bottom
];

interface TablePlayer {
  id: number;
  name: string;
  chips: number;
  seatIndex: number;
  isFolded: boolean;
  isActive: boolean;
  isAllIn: boolean;
  currentBet: number;
  cards?: string[];
}

export default function Table() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [currentBet, setCurrentBet] = useState(2.00);
  const [raiseAmount, setRaiseAmount] = useState(4.00);
  const [gamePhase, setGamePhase] = useState<string>("waiting");
  const [pot, setPot] = useState(0);
  const [communityCards, setCommunityCards] = useState<string[]>([]);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [players, setPlayers] = useState<TablePlayer[]>([]);

  // Fetch room data
  const { data: room } = trpc.rooms.get.useQuery(
    { id: parseInt(id || "0") },
    { enabled: !!id && id !== "test" }
  );
  const { data: roomPlayers } = trpc.rooms.getPlayers.useQuery(
    { roomId: parseInt(id || "0") },
    { enabled: !!id && id !== "test" }
  );

  // Initialize game state from room data
  useEffect(() => {
    if (room) {
      setCurrentBet(parseFloat(room.bigBlind));
      setRaiseAmount(parseFloat(room.bigBlind) * 2);
    }
  }, [room]);

  // Build player list from room players or use demo data
  useEffect(() => {
    if (roomPlayers && roomPlayers.length > 0) {
      const mapped: TablePlayer[] = roomPlayers.map((rp: any) => ({
        id: rp.userId,
        name: rp.userId === user?.id ? "You" : `Player ${rp.seatIndex + 1}`,
        chips: parseFloat(rp.chipCount),
        seatIndex: rp.seatIndex,
        isFolded: false,
        isActive: rp.seatIndex === 0,
        isAllIn: false,
        currentBet: 0,
      }));
      setPlayers(mapped);
    } else {
      // Demo mode
      setPlayers([
        { id: 1, name: "You", chips: 98.50, seatIndex: 0, isFolded: false, isActive: true, isAllIn: false, currentBet: 2.00, cards: ["As", "Kh"] },
        { id: 2, name: "Player 2", chips: 145.00, seatIndex: 1, isFolded: false, isActive: false, isAllIn: false, currentBet: 2.00 },
        { id: 3, name: "Player 3", chips: 67.30, seatIndex: 2, isFolded: true, isActive: false, isAllIn: false, currentBet: 0 },
        { id: 4, name: "Player 4", chips: 200.00, seatIndex: 3, isFolded: false, isActive: false, isAllIn: false, currentBet: 4.00 },
        { id: 5, name: "Player 5", chips: 0, seatIndex: 4, isFolded: false, isActive: false, isAllIn: true, currentBet: 55.00 },
      ]);
      setCommunityCards(["Ah", "Kd", "7s"]);
      setMyCards(["As", "Kh"]);
      setPot(12.50);
      setGamePhase("flop");
    }
  }, [roomPlayers, user?.id]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFold = () => {
    toast.info("Fold action - game engine integration pending");
  };

  const handleCall = () => {
    toast.info("Call action - game engine integration pending");
  };

  const handleRaise = () => {
    toast.info(`Raise to $${raiseAmount.toFixed(2)} - game engine integration pending`);
  };

  const heroCards = players.find(p => p.seatIndex === 0)?.cards || myCards;

  return (
    <div className="h-screen bg-deep-space flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="glass-strong px-4 py-2 flex items-center justify-between z-10">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {room ? room.name : `Room #${id}`}
          </span>
          <span className="text-xs text-gold font-semibold">${pot.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/verify")} className="text-truth-blue hover:text-truth-blue-bright transition-colors">
            <Shield className="w-4 h-4" />
          </button>
          <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 relative">
        {/* Poker Table */}
        <div className="absolute inset-4 md:inset-8">
          {/* Table felt */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-emerald-900/80 to-emerald-950/90 border-4 border-amber-900/60 shadow-[inset_0_0_60px_rgba(0,0,0,0.5),0_0_30px_rgba(0,0,0,0.3)]">
            {/* Table inner ring */}
            <div className="absolute inset-3 rounded-[50%] border border-amber-800/30" />
            
            {/* Pot display */}
            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="glass rounded-full px-4 py-1.5 inline-flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gold to-gold-dim" />
                <span className="text-sm font-bold text-gold">${pot.toFixed(2)}</span>
              </div>
            </div>

            {/* Community Cards */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5">
              {communityCards.map((card, i) => (
                <CardView key={i} card={card} />
              ))}
              {/* Placeholder for remaining cards */}
              {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                <div key={`empty-${i}`} className="w-10 h-14 rounded-lg border border-dashed border-white/10" />
              ))}
            </div>
          </div>

          {/* Player Seats */}
          {players.map(player => {
            const pos = SEAT_POSITIONS[player.seatIndex];
            if (!pos) return null;
            return (
              <div
                key={player.id}
                className="absolute"
                style={{ top: pos.top, left: pos.left, transform: pos.transform }}
              >
                <div className={`flex flex-col items-center gap-1 ${player.isActive ? "animate-pulse-glow rounded-xl p-1" : ""}`}>
                  {/* Player cards (only show for hero) */}
                  {player.seatIndex === 0 && heroCards.length > 0 && (
                    <div className="flex gap-0.5 mb-1">
                      {heroCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-8 !h-12" />
                      ))}
                    </div>
                  )}
                  {player.seatIndex !== 0 && !player.isFolded && (
                    <div className="flex gap-0.5 mb-1">
                      <CardView faceDown className="!w-7 !h-10" />
                      <CardView faceDown className="!w-7 !h-10" />
                    </div>
                  )}

                  {/* Player info */}
                  <div className={`glass rounded-lg px-3 py-1.5 text-center min-w-[70px] ${
                    player.isFolded ? "opacity-40" : ""
                  } ${player.isAllIn ? "border border-red-500/50" : ""}`}>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[60px]">{player.name}</p>
                    <p className={`text-xs font-bold ${player.isAllIn ? "text-red-400" : "text-foreground"}`}>
                      {player.isAllIn ? "ALL IN" : `$${player.chips.toFixed(2)}`}
                    </p>
                  </div>

                  {/* Current bet */}
                  {player.currentBet > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gold to-gold-dim" />
                      <span className="text-[10px] text-gold font-semibold">${player.currentBet.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Dealer button */}
                  {player.seatIndex === 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center shadow-md">
                      D
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Panel */}
      <div className="glass-strong border-t border-border px-4 py-3 z-10">
        {/* Countdown */}
        <div className="mb-2">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold to-truth-blue rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / 15) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-0.5">
            {t("table.yourTurn")} - {countdown}s
          </p>
        </div>

        {/* Raise slider */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-muted-foreground">${currentBet.toFixed(2)}</span>
          <input
            type="range"
            min={currentBet * 2}
            max={100}
            step={0.5}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-secondary rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:shadow-lg"
          />
          <span className="text-xs text-gold font-semibold">${raiseAmount.toFixed(2)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleFold}
            className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors active:scale-[0.97]"
          >
            {t("table.fold")}
          </button>
          <button
            onClick={handleCall}
            className="flex-1 py-3 rounded-xl bg-truth-blue text-white font-semibold text-sm hover:bg-truth-blue/80 transition-colors glow-blue active:scale-[0.97]"
          >
            {t("table.call")} ${currentBet.toFixed(2)}
          </button>
          <button
            onClick={handleRaise}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm hover:opacity-90 transition-opacity glow-gold active:scale-[0.97]"
          >
            {t("table.raise")} ${raiseAmount.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
