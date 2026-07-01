/**
 * 牌局回放播放器页面
 * 逐步重现一手牌的完整操作流程，包含公共牌逐步翻开、玩家动作高亮、底池变化
 */
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { fmtAmt } from "@/lib/utils";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Play, Pause, SkipForward, RotateCcw, FastForward } from "lucide-react";

/** 操作动作的中文/英文映射 */
const ACTION_LABELS: Record<string, string> = {
  post_blind: "盲注",
  fold: "弃牌",
  check: "过牌",
  call: "跟注",
  raise: "加注",
  all_in: "全押",
};

/** 阶段对应的公共牌数量 */
const PHASE_CARD_COUNT: Record<string, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

export default function ReplayPlayer() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const handId = parseInt(id || "0");

  // 回放数据
  const { data: replay, isLoading } = trpc.game.replayDetail.useQuery(
    { handId },
    { enabled: handId > 0 }
  );

  // 播放状态
  const [currentStep, setCurrentStep] = useState(-1); // -1 = 初始状态（未开始）
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 3x
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRestartingRef = useRef(false); // 防止restart后timer回调残留

  const timeline = replay?.actionTimeline || [];
  const players = replay?.playerSnapshot || [];
  const communityCards = replay?.communityCards ? JSON.parse(replay.communityCards) : [];
  const totalSteps = timeline.length;

  /** 当前步骤的阶段 */
  const currentPhase = currentStep >= 0 && currentStep < totalSteps
    ? timeline[currentStep].phase
    : "preflop";

  /** 当前应显示的公共牌数量 - 严格按照阶段显示，确保restart后不会闪现公牌 */
  const visibleCardCount = currentStep < 0 ? 0 : (PHASE_CARD_COUNT[currentPhase] || 0);

  /** 当前底池 */
  const currentPot = currentStep >= 0 && currentStep < totalSteps
    ? timeline[currentStep].potAfter
    : 0;

  /** 自动播放逻辑 */
  useEffect(() => {
    if (isRestartingRef.current) {
      isRestartingRef.current = false;
      return;
    }
    if (isPlaying && currentStep < totalSteps - 1) {
      const delay = Math.max(400, 1200 / speed);
      timerRef.current = setTimeout(() => {
        setCurrentStep(s => s + 1);
      }, delay);
    } else if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, currentStep, speed, totalSteps]);

  /** 开始/暂停 */
  const togglePlay = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      // 已到末尾，重新开始
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(p => !p);
      if (currentStep < 0) setCurrentStep(0);
    }
  }, [currentStep, totalSteps]);

  /** 下一步 */
  const nextStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(s => Math.min(totalSteps - 1, s + 1));
  }, [totalSteps]);

  /** 重新开始 */
  const restart = useCallback(() => {
    // 先清除任何pending的timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isRestartingRef.current = true;
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  /** 切换速度 */
  const cycleSpeed = useCallback(() => {
    setSpeed(s => s >= 3 ? 1 : s + 1);
  }, []);

  /** 渲染扑克牌 */
  const renderCard = (card: string, idx: number, size: "sm" | "md" = "md") => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitSymbol: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };
    const isRed = suit === "h" || suit === "d";
    const sizeClass = size === "sm"
      ? "w-[24px] h-[34px] text-[9px]"
      : "w-[32px] h-[44px] text-[11px]";
    const suitSize = size === "sm" ? "text-[13px]" : "text-[17px]";
    return (
      <div key={idx} className={`flex flex-col items-center justify-between bg-white rounded-[3px] px-0.5 py-0.5 shadow-sm border border-gray-200/50 flex-shrink-0 ${sizeClass}`}>
        <span className={`font-bold leading-none ${size === "sm" ? "text-[9px]" : "text-[11px]"} ${isRed ? "text-red-600" : "text-gray-900"}`}>{rank}</span>
        <span className={`leading-none ${suitSize} ${isRed ? "text-red-600" : "text-gray-900"}`}>{suitSymbol[suit] || suit}</span>
      </div>
    );
  };

  /** 渲染牌背 */
  const renderCardBack = (idx: number, size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "w-[24px] h-[34px]" : "w-[32px] h-[44px]";
    return (
      <div key={`back-${idx}`} className={`flex items-center justify-center rounded-[3px] border border-blue-300/30 shadow-sm flex-shrink-0 ${sizeClass}`} style={{ background: 'linear-gradient(to bottom right, #1e40af, #312e81)' }}>
        <span className="text-[10px] text-blue-200/60">♦</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background particle-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!replay || totalSteps === 0) {
    return (
      <div className="min-h-screen bg-background particle-bg flex flex-col">
        <header className="glass-strong sticky top-0 z-50 px-4 py-3 safe-top">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/replay")} className="w-8 h-8 rounded-full glass flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold">{t("replay.title")}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t("replay.noReplayData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* 顶部导航 */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/replay")} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold">{replay.roomName} #{replay.handNumber}</h1>
            <p className="text-[10px] text-muted-foreground">
              {replay.startedAt ? new Date(replay.startedAt).toLocaleString() : ""}
            </p>
          </div>
          {/* 赢家标识 */}
          {replay.winningHand && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gold/15 text-gold font-medium">
              {replay.winningHand}
            </span>
          )}
        </div>
      </header>

      {/* 牌桌区域 */}
      <div className="flex-1 px-4 pt-4 space-y-4">
        {/* 公共牌区域 */}
        <div className="glass rounded-xl p-4">
          <div className="text-center mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {t(`replay.${currentPhase}` as any) || currentPhase}
            </span>
            <span className="ml-3 text-sm font-bold text-gold">
              {t("replay.pot")}: {fmtAmt(currentPot)}
            </span>
          </div>
          <div className="flex justify-center gap-1.5">
            {communityCards.slice(0, 5).map((card: string, idx: number) => (
              idx < visibleCardCount
                ? renderCard(card, idx)
                : renderCardBack(idx)
            ))}
            {/* 如果公共牌不足5张，补充牌背 */}
            {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, idx) =>
              renderCardBack(communityCards.length + idx)
            )}
          </div>
        </div>

        {/* 玩家座位 */}
        <div className="grid grid-cols-2 gap-2">
          {players.map((player) => {
            // 判断当前步骤是否是该玩家的操作
            const isActive = currentStep >= 0 && currentStep < totalSteps && timeline[currentStep].playerId === player.id;
            // 判断该玩家是否已弃牌（在当前步骤之前有 fold 操作）
            const hasFolded = timeline.slice(0, currentStep + 1).some(
              a => a.playerId === player.id && a.action === "fold"
            );
            const isWinner = replay.winnerId === player.id;
            return (
              <div
                key={player.id}
                className={`glass rounded-lg p-3 transition-all duration-200 ${
                  isActive ? "ring-2 ring-emerald-400/60 bg-emerald-400/5" :
                  hasFolded ? "opacity-40" :
                  isWinner && currentStep >= totalSteps - 1 ? "ring-2 ring-gold/60 bg-gold/5" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    S{player.seatIndex + 1}
                  </span>
                </div>
                {/* 手牌（回放结束后显示，或者是自己的牌） */}
                <div className="flex gap-0.5 mb-1">
                  {currentStep >= totalSteps - 1 || !hasFolded
                    ? player.holeCards.map((card, idx) => renderCard(card, idx, "sm"))
                    : player.holeCards.map((_, idx) => renderCardBack(idx, "sm"))
                  }
                </div>
                {/* 筹码 */}
                <div className="text-[10px] text-muted-foreground">
                  {fmtAmt(player.startChips)}
                </div>
                {/* 当前动作标签 */}
                {isActive && currentStep >= 0 && (
                  <div className="mt-1 text-[10px] font-bold text-emerald-400 animate-in fade-in duration-300">
                    {ACTION_LABELS[timeline[currentStep].action] || timeline[currentStep].action}
                    {timeline[currentStep].amount > 0 && ` $${fmtAmt(timeline[currentStep].amount)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 操作时间线 */}
        <div className="glass rounded-xl p-3 max-h-40 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            {t("replay.step")} {Math.max(0, currentStep + 1)} / {totalSteps}
          </p>
          <div className="space-y-1">
            {timeline.slice(0, currentStep + 1).map((action, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-[11px] py-0.5 ${
                  idx === currentStep ? "text-emerald-400 font-bold" : "text-muted-foreground"
                }`}
              >
                <span className="w-4 text-center text-[9px]">{idx + 1}</span>
                <span className="font-medium truncate max-w-[60px]">{action.playerName}</span>
                <span className={`px-1 py-0.5 rounded text-[9px] ${
                  action.action === "fold" ? "bg-red-400/10 text-red-400" :
                  action.action === "raise" || action.action === "all_in" ? "bg-gold/10 text-gold" :
                  "bg-secondary text-foreground"
                }`}>
                  {ACTION_LABELS[action.action] || action.action}
                </span>
                {action.amount > 0 && (
                  <span className="text-gold">${fmtAmt(action.amount)}</span>
                )}
                <span className="ml-auto text-[9px] text-muted-foreground/60">
                  {t("replay.pot")}:{fmtAmt(action.potAfter)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部播放控制栏 */}
      <div className="glass-strong sticky bottom-0 px-4 py-3 safe-bottom">
        {/* 进度条 */}
        <div className="mb-3">
          <input
            type="range"
            min={-1}
            max={totalSteps - 1}
            value={currentStep}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentStep(parseInt(e.target.value));
            }}
            className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-400/30"
          />
        </div>
        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-6">
          {/* 重新开始 */}
          <button onClick={restart} className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition-transform">
            <RotateCcw className="w-4 h-4" />
          </button>
          {/* 播放/暂停 */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-emerald-400 text-background flex items-center justify-center shadow-lg shadow-emerald-400/30 active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          {/* 下一步 */}
          <button onClick={nextStep} className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition-transform">
            <SkipForward className="w-4 h-4" />
          </button>
          {/* 速度 */}
          <button onClick={cycleSpeed} className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition-transform">
            <FastForward className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold ml-0.5">{speed}x</span>
          </button>
        </div>
      </div>
    </div>
  );
}
