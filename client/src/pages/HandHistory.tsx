import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Trophy, Clock, Hash, Shield, ChevronDown, ChevronUp, User, DollarSign } from "lucide-react";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";

export default function HandHistory() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const roomId = parseInt(id || "0");
  const [expandedHand, setExpandedHand] = useState<number | null>(null);

  const { data: hands, isLoading } = trpc.game.handHistory.useQuery(
    { roomId, limit: 50 },
    { enabled: roomId > 0 }
  );

  const { data: handDetail } = trpc.game.handDetail.useQuery(
    { handId: expandedHand! },
    { enabled: !!expandedHand }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-emerald-400";
      case "preflop": case "flop": case "turn": case "river": return "text-amber-400";
      default: return "text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    if (status === "completed") return t("table.completed");
    return t("table.inProgress");
  };

  const parseCards = (cardsJson: string | null): string[] => {
    if (!cardsJson) return [];
    try { return JSON.parse(cardsJson); } catch { return []; }
  };

  const renderCard = (card: string, idx: number) => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitSymbol: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };
    const isRed = suit === "h" || suit === "d";
    return (
      <span key={idx} className={`inline-flex items-center justify-center w-7 h-9 rounded text-xs font-bold border ${
        isRed ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-foreground border-border bg-secondary/50"
      }`}>
        {rank}{suitSymbol[suit] || suit}
      </span>
    );
  };

  const renderPlayerCards = (cardsJson: string | null) => {
    const cards = parseCards(cardsJson);
    if (cards.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
    return (
      <div className="flex gap-0.5">
        {cards.map((card, idx) => renderCard(card, idx))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/table/${roomId}`)} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">{t("table.handHistory")}</h1>
        </div>
      </header>

      {/* Hand List */}
      <div className="flex-1 px-4 pt-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hands || hands.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">{t("table.noHands")}</p>
          </div>
        ) : (
          hands.map((hand) => {
            const communityCards = parseCards(hand.communityCards);
            const isExpanded = expandedHand === hand.id;
            return (
              <div key={hand.id} className="glass rounded-xl overflow-hidden">
                {/* Hand Summary */}
                <div
                  className="p-4 cursor-pointer card-hover"
                  onClick={() => setExpandedHand(isExpanded ? null : hand.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gold" />
                      <span className="text-sm font-bold text-foreground">
                        {t("table.handId")}{hand.handNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${getStatusColor(hand.status)}`}>
                        {getStatusText(hand.status)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Community Cards */}
                  {communityCards.length > 0 && (
                    <div className="flex gap-1 mb-2">
                      {communityCards.map((card, idx) => renderCard(card, idx))}
                    </div>
                  )}

                  {/* Hand Info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-gold" />
                        {hand.winningHand || "-"}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {hand.potSize}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hand.serverSeedHash && (
                        <Shield className="w-3 h-3 text-truth-blue" />
                      )}
                      <span>{new Date(hand.startedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-4 py-3 bg-secondary/20 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {handDetail && handDetail.id === hand.id ? (
                      <>
                        {/* Players */}
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {t("lobby.players")}
                        </p>
                        {handDetail.players.map((player: any) => (
                          <div key={player.id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                            player.isWinner ? "bg-gold/10 border border-gold/20" : "bg-secondary/30"
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                player.isWinner ? "bg-gold text-background" : "bg-secondary text-muted-foreground"
                              }`}>
                                {player.seatIndex + 1}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-foreground">{player.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {player.action === "fold" ? t("table.fold") : 
                                   player.action === "all_in" ? t("table.allIn") : 
                                   player.isWinner ? `🏆 ${t("table.winner")}` : "-"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {renderPlayerCards(player.holeCards)}
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground">
                                  {t("table.bet")}: ${player.betAmount || "0"}
                                </p>
                                {player.isWinner && (
                                  <p className="text-xs font-bold text-gold">
                                    +${player.winAmount || "0"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Fairness Info */}
                        {handDetail.serverSeedHash && (
                          <div className="mt-3 pt-3 border-t border-border/20">
                            <button
                              onClick={() => navigate("/verify")}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-truth-blue/10 text-truth-blue text-xs font-medium hover:bg-truth-blue/20 transition-colors"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {t("verify.title")}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav active="lobby" />
    </div>
  );
}
