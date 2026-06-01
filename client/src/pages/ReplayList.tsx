/**
 * 牌局回放列表页面
 * 展示用户参与的所有已完成牌局，支持分页和进入回放详情
 */
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { fmtAmt } from "@/lib/utils";
import { useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, Trophy, Clock, Play, ChevronLeft, ChevronRight, Film } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function ReplayList() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading } = trpc.game.myReplayList.useQuery(
    { page, limit }
  );

  const hands = data?.hands || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  /** 解析牌面 JSON */
  const parseCards = (cardsJson: string | null): string[] => {
    if (!cardsJson) return [];
    try { return JSON.parse(cardsJson); } catch { return []; }
  };

  /** 渲染单张扑克牌 */
  const renderCard = (card: string, idx: number) => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitSymbol: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };
    const isRed = suit === "h" || suit === "d";
    return (
      <span key={idx} className={`inline-flex items-center justify-center w-6 h-8 rounded text-[10px] font-bold border ${
        isRed ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-foreground border-border bg-secondary/50"
      }`}>
        {rank}{suitSymbol[suit] || suit}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* 顶部导航 */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">{t("replay.title")}</h1>
          <span className="text-xs text-muted-foreground ml-auto">{total} {t("replay.step")}</span>
        </div>
      </header>

      {/* 牌局列表 */}
      <div className="flex-1 px-4 pt-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hands.length === 0 ? (
          <div className="text-center py-12">
            <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">{t("replay.noHands")}</p>
          </div>
        ) : (
          <>
            {hands.map((hand) => {
              const communityCards = parseCards(hand.communityCards);
              const myCards = parseCards(hand.myResult?.holeCards || null);
              const isWinner = hand.myResult?.isWinner;
              return (
                <div
                  key={hand.id}
                  className="glass rounded-xl p-4 card-hover cursor-pointer"
                  onClick={() => hand.hasReplay ? navigate(`/replay/${hand.id}`) : null}
                >
                  {/* 头部信息 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{hand.roomName}</span>
                      <span className="text-xs text-muted-foreground">#{hand.handNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hand.hasReplay ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 font-medium">
                          {t("replay.hasReplay")}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {t("replay.noReplayData")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 公共牌 */}
                  {communityCards.length > 0 && (
                    <div className="flex gap-0.5 mb-2">
                      {communityCards.map((card, idx) => renderCard(card, idx))}
                    </div>
                  )}

                  {/* 我的手牌和结果 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {myCards.length > 0 && (
                        <div className="flex gap-0.5">
                          {myCards.map((card, idx) => renderCard(card, idx))}
                        </div>
                      )}
                      {isWinner && (
                        <Trophy className="w-3.5 h-3.5 text-gold" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {t("replay.pot")}: {fmtAmt(hand.potSize)}
                      </span>
                      {hand.myResult && (
                        <span className={isWinner ? "text-emerald-400 font-bold" : "text-red-400"}>
                          {isWinner ? `+${fmtAmt(hand.myResult.winAmount)}` : `-${fmtAmt(hand.myResult.betAmount)}`}
                        </span>
                      )}
                      {hand.hasReplay && (
                        <Play className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* 时间 */}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{hand.completedAt ? new Date(hand.completedAt).toLocaleString() : "-"}</span>
                  </div>
                </div>
              );
            })}

            {/* 分页控制 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
