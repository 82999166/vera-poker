import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function CreateRoom() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [smallBlind, setSmallBlind] = useState("0.05");
  const [bigBlind, setBigBlind] = useState("0.10");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [totalRounds, setTotalRounds] = useState(20);
  const [billingMode, setBillingMode] = useState<"standard_rake" | "per_round_fee">("standard_rake");
  const [createdRoom, setCreatedRoom] = useState<{ roomId: number | null; inviteCode: string } | null>(null);

  const createMutation = trpc.rooms.create.useMutation({
    onSuccess: (data) => {
      setCreatedRoom(data);
      toast.success("Room created successfully!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!name.trim()) return toast.error("Please enter a room name");
    createMutation.mutate({
      name: name.trim(),
      type: "private",
      gameType: "texas_holdem",
      smallBlind,
      bigBlind,
      minBuyIn: (parseFloat(bigBlind) * 20).toFixed(2),
      maxBuyIn: (parseFloat(bigBlind) * 100).toFixed(2),
      maxPlayers,
      totalRounds,
      billingMode,
    });
  };

  const blindPresets = [
    { sb: "0.01", bb: "0.02" },
    { sb: "0.05", bb: "0.10" },
    { sb: "0.10", bb: "0.25" },
    { sb: "0.50", bb: "1.00" },
    { sb: "1.00", bb: "2.00" },
    { sb: "5.00", bb: "10.00" },
  ];

  const roundPresets = [1, 5, 10, 20, 50, 100];

  if (createdRoom) {
    const inviteLink = `https://t.me/VeraPokerBot?start=room_${createdRoom.inviteCode}`;
    return (
      <div className="min-h-screen bg-background particle-bg flex flex-col items-center justify-center px-4">
        <div className="gradient-border rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Room Created!</h2>
          <p className="text-sm text-muted-foreground mb-4">Share the invite link with your friends</p>
          
          <div className="glass rounded-lg p-3 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
            <p className="text-lg font-bold text-gold font-mono">{createdRoom.inviteCode}</p>
          </div>

          <div className="glass rounded-lg p-3 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Invite Link</p>
            <p className="text-[10px] text-foreground font-mono break-all">{inviteLink}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied!"); }}
              className="flex-1 py-2.5 rounded-lg bg-gold text-background font-semibold text-sm flex items-center justify-center gap-1"
            >
              <Copy className="w-4 h-4" /> {t("agent.copy")}
            </button>
            <button
              onClick={() => navigate(`/table/${createdRoom.roomId}`)}
              className="flex-1 py-2.5 rounded-lg bg-truth-blue text-white font-semibold text-sm"
            >
              Enter Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t("room.create")}</h1>
      </header>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Room Name */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Room Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Poker Room"
            className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold"
          />
        </div>

        {/* Blinds */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{t("room.blinds")}</label>
          <div className="grid grid-cols-3 gap-2">
            {blindPresets.map(preset => (
              <button
                key={preset.bb}
                onClick={() => { setSmallBlind(preset.sb); setBigBlind(preset.bb); }}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  bigBlind === preset.bb
                    ? "bg-gold text-background"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                ${preset.sb}/${preset.bb}
              </button>
            ))}
          </div>
        </div>

        {/* Max Players */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{t("room.players")}</label>
          <div className="flex gap-2">
            {[2, 4, 6, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  maxPlayers === n
                    ? "bg-truth-blue text-white"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Total Rounds */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{t("room.rounds")}</label>
          <div className="grid grid-cols-3 gap-2">
            {roundPresets.map(n => (
              <button
                key={n}
                onClick={() => setTotalRounds(n)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  totalRounds === n
                    ? "bg-gold text-background"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {n} {n === 1 ? "round" : "rounds"}
              </button>
            ))}
          </div>
        </div>

        {/* Billing Mode */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{t("room.billing")}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBillingMode("standard_rake")}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                billingMode === "standard_rake"
                  ? "bg-gold text-background"
                  : "glass text-muted-foreground"
              }`}
            >
              <p className="font-semibold">{t("room.standardRake")}</p>
              <p className="text-[10px] opacity-70">5% per pot (cap $3)</p>
            </button>
            <button
              onClick={() => setBillingMode("per_round_fee")}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                billingMode === "per_round_fee"
                  ? "bg-truth-blue text-white"
                  : "glass text-muted-foreground"
              }`}
            >
              <p className="font-semibold">{t("room.perRound")}</p>
              <p className="text-[10px] opacity-70">Fixed fee, 0% rake</p>
            </button>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm glow-gold disabled:opacity-50 active:scale-[0.97] transition-transform"
        >
          {createMutation.isPending ? t("common.loading") : t("room.create")}
        </button>
      </div>
    </div>
  );
}
