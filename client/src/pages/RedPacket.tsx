/**
 * Red Packet Claim Page - User-facing
 * Accessible via /red-packet/:id
 * Shows red packet info, claim button, and leaderboard
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { getLoginUrl } from "@/const";

export default function RedPacket() {
  const [, params] = useRoute("/red-packet/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const id = parseInt(params?.id || "0");

  const { data, isLoading, refetch } = trpc.marketing.redPacketForUser.useQuery(
    { id },
    { enabled: !!user && id > 0 }
  );

  const claimMut = trpc.marketing.redPacketClaim.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`🧧 恭喜领取 ${res.amount} USDT！`);
        refetch();
      } else {
        toast.error(res.error || "领取失败");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="text-6xl mb-4">🧧</div>
        <h2 className="text-xl font-bold mb-2">请先登录</h2>
        <p className="text-muted-foreground text-sm mb-6">登录后即可领取红包</p>
        <button
          onClick={() => { window.location.href = getLoginUrl(); }}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full text-base transition-colors"
        >
          立即登录
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="text-6xl mb-4">🧧</div>
        <h2 className="text-xl font-bold mb-2">红包不存在</h2>
        <p className="text-muted-foreground text-sm">该红包可能已过期或不存在</p>
        <button onClick={() => navigate("/lobby")} className="mt-4 text-primary underline text-sm">返回大厅</button>
      </div>
    );
  }

  const packet = data;
  const isExpired = packet.status === "expired" || (packet.expiresAt && new Date(packet.expiresAt) < new Date());
  const isCompleted = packet.status === "completed" || packet.claimedCount >= packet.totalCount;
  const alreadyClaimed = !!packet.userClaim;
  const canClaim = packet.status === "active" && !isExpired && !isCompleted && !alreadyClaimed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950/30 via-background to-background">
      {/* Header with image */}
      {packet.imageUrl && (
        <div className="w-full h-48 overflow-hidden">
          <img src={packet.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Red Packet Card */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">{packet.title}</h1>
            {packet.description && <p className="text-red-100 text-sm mb-3">{packet.description}</p>}
            
            <div className="flex items-center justify-center gap-1 mb-4">
              <span className="text-sm opacity-80">总金额：</span>
              <span className="text-3xl font-bold">{packet.totalAmount}</span>
              <span className="text-sm opacity-80 ml-1">USDT</span>
            </div>

            <div className="flex justify-center gap-6 text-sm opacity-90 mb-4">
              <span>总数：{packet.totalCount} 份</span>
              <span>已领：{packet.claimedCount}/{packet.totalCount}</span>
            </div>

            {/* Condition */}
            {packet.condition && (
              <div className="bg-white/10 rounded-lg px-3 py-2 text-xs mb-4">
                <span className="font-medium">🎯 领取要求：</span>
                {(packet.condition as any).recentDays && (packet.condition as any).recentHands && (
                  <span>最近{(packet.condition as any).recentDays}天手数≥{(packet.condition as any).recentHands}</span>
                )}
                {(packet.condition as any).minDeposit && <span> 充值≥{(packet.condition as any).minDeposit} USDT</span>}
                {(packet.condition as any).minGamesPlayed && <span> 总手数≥{(packet.condition as any).minGamesPlayed}</span>}
                {(packet.condition as any).newUserOnly && <span> 仅新用户</span>}
              </div>
            )}

            {/* Claim Button */}
            {alreadyClaimed ? (
              <div className="bg-white/20 rounded-xl py-3 px-4">
                <p className="text-sm opacity-80">你已领取</p>
                <p className="text-2xl font-bold">{packet.userClaim!.amount} USDT</p>
              </div>
            ) : canClaim ? (
              <button
                onClick={() => claimMut.mutate({ id })}
                disabled={claimMut.isPending}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-red-900 font-bold py-3 rounded-xl text-lg transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {claimMut.isPending ? "领取中..." : "🧧 领取红包"}
              </button>
            ) : (
              <div className="bg-white/10 rounded-xl py-3 px-4 text-sm opacity-80">
                {isExpired ? "红包已过期" : isCompleted ? "红包已被领完" : "无法领取"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {packet.buttons && (packet.buttons as Array<{ text: string; url: string; type?: string; row?: number }>).length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {(packet.buttons as Array<{ text: string; url: string; type?: string; row?: number }>).map((btn, i) => (
              <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                {btn.text}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="px-4 mt-6 pb-8">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          🏆 领取排行榜（仅显示前15名，共 {packet.claimedCount}/{packet.totalCount} 领取）
        </h3>
        {packet.topClaims && packet.topClaims.length > 0 ? (
          <div className="space-y-1.5">
            {packet.topClaims.map((claim, idx) => (
              <div key={claim.id} className="flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-card border border-border">
                <span className={`w-6 text-center font-bold ${
                  idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground"
                }`}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                </span>
                <span className="flex-1 truncate">{claim.nickname || claim.tgUsername || `User#${claim.userId}`}</span>
                <span className="font-mono font-medium text-green-500">{claim.amount} USDT</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            还没有人领取，快来抢第一个！
          </div>
        )}
      </div>
    </div>
  );
}
