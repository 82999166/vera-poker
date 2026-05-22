import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { t } from "@/lib/i18n";
import { ArrowLeft, Shield, Volume2, VolumeX, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

// Card rendering
const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: "\u2660", color: "text-foreground" },
  h: { symbol: "\u2665", color: "text-red-500" },
  d: { symbol: "\u2666", color: "text-blue-400" },
  c: { symbol: "\u2663", color: "text-green-400" },
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

export default function Table() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [muted, setMuted] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(4.00);
  const [isSeated, setIsSeated] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [showBuyIn, setShowBuyIn] = useState(false);

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

  // Mutations
  const joinMutation = trpc.game.join.useMutation({
    onSuccess: (data) => {
      setIsSeated(true);
      setShowBuyIn(false);
      toast.success(`Seated at position ${data.seatIndex + 1}`);
      utils.game.tableState.invalidate({ roomId });
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.game.leave.useMutation({
    onSuccess: () => {
      setIsSeated(false);
      toast.success("Left the table");
      utils.wallet.balance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const actionMutation = trpc.game.action.useMutation({
    onSuccess: () => {
      // Immediately refetch table state after action
      utils.game.tableState.invalidate({ roomId });
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

  // Countdown timer
  const [countdown, setCountdown] = useState(30);
  useEffect(() => {
    if (!isMyTurn) return;
    const elapsed = Math.floor((Date.now() - lastActionAt) / 1000);
    const remaining = Math.max(0, turnTimeout - elapsed);
    setCountdown(remaining);
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isMyTurn, lastActionAt, turnTimeout]);

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
    { id: 1, seatIndex: 0, chips: 98.5, currentBet: 2, totalBet: 2, isFolded: false, isAllIn: false, isActive: true, holeCards: ["As", "Kh"] },
    { id: 2, seatIndex: 1, chips: 145, currentBet: 2, totalBet: 2, isFolded: false, isAllIn: false, isActive: false, holeCards: [] },
    { id: 3, seatIndex: 2, chips: 67.3, currentBet: 0, totalBet: 0, isFolded: true, isAllIn: false, isActive: false, holeCards: [] },
    { id: 4, seatIndex: 3, chips: 200, currentBet: 4, totalBet: 4, isFolded: false, isAllIn: false, isActive: false, holeCards: [] },
    { id: 5, seatIndex: 4, chips: 0, currentBet: 55, totalBet: 55, isFolded: false, isAllIn: true, isActive: false, holeCards: [] },
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
    if (isDemoMode) return toast.info("Demo mode - actions disabled");
    actionMutation.mutate({ roomId, action: "fold" });
  };

  const handleCall = () => {
    if (isDemoMode) return toast.info("Demo mode - actions disabled");
    actionMutation.mutate({ roomId, action: "call" });
  };

  const handleCheck = () => {
    if (isDemoMode) return toast.info("Demo mode - actions disabled");
    actionMutation.mutate({ roomId, action: "check" });
  };

  const handleRaise = () => {
    if (isDemoMode) return toast.info("Demo mode - actions disabled");
    actionMutation.mutate({ roomId, action: "raise", amount: raiseAmount });
  };

  const handleAllIn = () => {
    if (isDemoMode) return toast.info("Demo mode - actions disabled");
    actionMutation.mutate({ roomId, action: "all_in" });
  };

  const handleJoin = () => {
    if (!buyInAmount) return toast.error("Enter buy-in amount");
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
      <div className="glass-strong px-4 py-2 flex items-center justify-between z-10">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {room ? room.name : isDemoMode ? "Demo Table" : `Room #${id}`}
          </span>
          <span className="text-xs text-gold font-semibold">${displayPot.toFixed(2)}</span>
          {displayPhase !== "waiting" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/20 text-truth-blue uppercase">{displayPhase}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSeated && !isDemoMode && (
            <button onClick={handleLeave} className="text-red-400 hover:text-red-300 transition-colors" title="Leave table">
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => navigate("/verify")} className="text-truth-blue hover:text-truth-blue-bright transition-colors">
            <Shield className="w-4 h-4" />
          </button>
          <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Connection Lost Banner */}
      {connectionLost && (
        <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-300">Connection lost - Reconnecting...</span>
          </div>
          <button
            onClick={() => utils.game.tableState.invalidate({ roomId })}
            className="text-xs px-2 py-1 rounded bg-red-500/30 text-red-200 hover:bg-red-500/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

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
                <span className="text-sm font-bold text-gold">${displayPot.toFixed(2)}</span>
              </div>
            </div>

            {/* Community Cards */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5">
              {displayCommunity.map((card, i) => (
                <CardView key={i} card={card} />
              ))}
              {/* Placeholder for remaining cards */}
              {Array.from({ length: 5 - displayCommunity.length }).map((_, i) => (
                <div key={`empty-${i}`} className="w-10 h-14 rounded-lg border border-dashed border-white/10" />
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
                className="absolute"
                style={{ top: pos.top, left: pos.left, transform: pos.transform }}
              >
                <div className={`flex flex-col items-center gap-1 ${isCurrentTurn ? "animate-pulse-glow rounded-xl p-1" : ""}`}>
                  {/* Player cards */}
                  {isHero && displayMyCards.length > 0 && (
                    <div className="flex gap-0.5 mb-1">
                      {displayMyCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-8 !h-12" />
                      ))}
                    </div>
                  )}
                  {!isHero && player.holeCards && player.holeCards.length > 0 && (
                    <div className="flex gap-0.5 mb-1">
                      {player.holeCards.map((card, i) => (
                        <CardView key={i} card={card} className="!w-8 !h-12" />
                      ))}
                    </div>
                  )}
                  {!isHero && (!player.holeCards || player.holeCards.length === 0) && !player.isFolded && displayPhase !== "waiting" && (
                    <div className="flex gap-0.5 mb-1">
                      <CardView faceDown className="!w-7 !h-10" />
                      <CardView faceDown className="!w-7 !h-10" />
                    </div>
                  )}

                  {/* Player info */}
                  <div className={`glass rounded-lg px-3 py-1.5 text-center min-w-[70px] ${
                    player.isFolded ? "opacity-40" : ""
                  } ${player.isAllIn ? "border border-red-500/50" : ""}`}>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                      {isHero ? "You" : `P${player.seatIndex + 1}`}
                    </p>
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
                </div>
              </div>
            );
          })}

          {/* Join button overlay when not seated */}
          {!isSeated && !isDemoMode && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="glass-strong rounded-2xl p-6 text-center max-w-[280px]">
                {showBuyIn ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground">Buy In</h3>
                    <p className="text-xs text-muted-foreground">
                      Min: ${room ? parseFloat(room.minBuyIn).toFixed(2) : "0"} - Max: ${room ? parseFloat(room.maxBuyIn).toFixed(2) : "0"}
                    </p>
                    <input
                      type="number"
                      value={buyInAmount}
                      onChange={(e) => setBuyInAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm text-center"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowBuyIn(false)} className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm">
                        Cancel
                      </button>
                      <button
                        onClick={handleJoin}
                        disabled={joinMutation.isPending}
                        className="flex-1 py-2 rounded-lg bg-truth-blue text-white text-sm font-semibold"
                      >
                        {joinMutation.isPending ? "..." : "Sit Down"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <LogIn className="w-8 h-8 mx-auto text-truth-blue" />
                    <h3 className="text-sm font-bold text-foreground">Join Table</h3>
                    <p className="text-xs text-muted-foreground">
                      {room ? `${room.name} - ${room.smallBlind}/${room.bigBlind}` : "Loading..."}
                    </p>
                    <button
                      onClick={() => setShowBuyIn(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-truth-blue to-truth-blue-bright text-white font-semibold text-sm"
                    >
                      Take a Seat
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
        <div className="glass-strong border-t border-border px-4 py-3 z-10">
          {/* Countdown */}
          {displayIsMyTurn && (
            <div className="mb-2">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-truth-blue rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / turnTimeout) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-0.5">
                {t("table.yourTurn")} - {countdown}s
              </p>
            </div>
          )}

          {displayPhase === "waiting" && !isDemoMode && (
            <p className="text-center text-sm text-muted-foreground py-2">
              Waiting for more players to join...
            </p>
          )}

          {(displayPhase !== "waiting" || isDemoMode) && (
            <>
              {/* Raise slider */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground">${(currentBet * 2).toFixed(2)}</span>
                <input
                  type="range"
                  min={currentBet * 2}
                  max={myPlayer ? myPlayer.chips + myPlayer.currentBet : 100}
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
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors active:scale-[0.97] disabled:opacity-50"
                  title={connectionLost ? "Connection lost - waiting to reconnect" : ""}
                >
                  {t("table.fold")}
                </button>
                {canCheck ? (
                  <button
                    onClick={handleCheck}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-3 rounded-xl bg-truth-blue text-white font-semibold text-sm hover:bg-truth-blue/80 transition-colors glow-blue active:scale-[0.97] disabled:opacity-50"
                    title={connectionLost ? "Connection lost - waiting to reconnect" : ""}
                  >
                    Check
                  </button>
                ) : (
                  <button
                    onClick={handleCall}
                    disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                    className="flex-1 py-3 rounded-xl bg-truth-blue text-white font-semibold text-sm hover:bg-truth-blue/80 transition-colors glow-blue active:scale-[0.97] disabled:opacity-50"
                    title={connectionLost ? "Connection lost - waiting to reconnect" : ""}
                  >
                    {t("table.call")} ${currentBet.toFixed(2)}
                  </button>
                )}
                <button
                  onClick={handleRaise}
                  disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm hover:opacity-90 transition-opacity glow-gold active:scale-[0.97] disabled:opacity-50"
                  title={connectionLost ? "Connection lost - waiting to reconnect" : ""}
                >
                  {t("table.raise")} ${raiseAmount.toFixed(2)}
                </button>
              </div>

              {/* All-in button */}
              <button
                onClick={handleAllIn}
                disabled={!displayIsMyTurn || actionMutation.isPending || connectionLost}
                className="w-full mt-2 py-2 rounded-xl border border-red-500/50 text-red-400 font-bold text-xs hover:bg-red-500/10 transition-colors active:scale-[0.97] disabled:opacity-50"
                title={connectionLost ? "Connection lost - waiting to reconnect" : ""}
              >
                ALL IN
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
