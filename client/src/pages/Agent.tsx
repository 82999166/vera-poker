import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Users, TrendingUp, Unlock, Lock, Share2, Image, Download, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useState, useRef, useCallback, useEffect } from "react";

export default function Agent() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { data: dashboard, isLoading } = trpc.agent.dashboard.useQuery(undefined, { enabled: !!user });
  const { data: downlines } = trpc.agent.downlines.useQuery(undefined, { enabled: !!user });
  const [showPoster, setShowPoster] = useState(false);

  const copyLink = () => {
    if (dashboard?.inviteLink) {
      navigator.clipboard.writeText(dashboard.inviteLink);
      toast.success(t("agent.inviteLinkCopied"));
    }
  };

  const shareToTG = () => {
    if (dashboard?.inviteLink) {
      // Use Telegram's share URL scheme to directly open TG share dialog
      const text = encodeURIComponent(t("agent.shareText") || "Join Vera Poker!");
      const url = encodeURIComponent(dashboard.inviteLink);
      // Try Telegram deep link first (works in TG WebView and mobile)
      const tgShareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
      window.open(tgShareUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col pb-20">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t("agent.title")}</h1>
      </header>

      {/* Stats Cards */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-truth-blue mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{dashboard?.totalDownlines ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">{t("agent.downlines")}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <TrendingUp className="w-5 h-5 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold text-gold">${dashboard?.totalEarnings ?? "0.00"}</p>
          <p className="text-[10px] text-muted-foreground">{t("agent.earnings")}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <Unlock className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{dashboard?.unlockedDownlines ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">{t("agent.unlocked")}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <Lock className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-warning">
            {(dashboard?.totalDownlines ?? 0) - (dashboard?.unlockedDownlines ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("agent.pending")}</p>
        </div>
      </div>

      {/* Invite Link */}
      <div className="px-4 pt-4">
        <div className="gradient-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">{t("agent.inviteLink")}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 glass rounded-lg px-3 py-2 overflow-hidden">
              <p className="text-xs text-foreground font-mono truncate">{dashboard?.inviteLink ?? ""}</p>
            </div>
            <button onClick={copyLink} className="bg-gold text-background p-2 rounded-lg hover:opacity-90 transition-opacity">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={shareToTG} className="bg-truth-blue text-white p-2 rounded-lg hover:opacity-90 transition-opacity">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Commission Rates */}
      <div className="px-4 pt-4">
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{t("agent.commissionRates")}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("agent.level1")}</span>
              <span className="text-sm font-bold text-gold">{dashboard?.level1Rate ?? 10}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("agent.level2")}</span>
              <span className="text-sm font-bold text-truth-blue">{dashboard?.level2Rate ?? 5}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unlock Requirements */}
      <div className="px-4 pt-4">
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{t("agent.unlockRequirements")}</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span>{t("agent.unlockReq1")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span>{t("agent.unlockReq2")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span>{t("agent.unlockReq3")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span>{t("agent.unlockReq4")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Poster Button */}
      <div className="px-4 pt-4">
        <button
          onClick={() => setShowPoster(true)}
          className="w-full glass rounded-xl p-4 flex items-center justify-center gap-2 border border-gold/30 hover:border-gold/60 transition-all active:scale-[0.97]"
        >
          <Image className="w-5 h-5 text-gold" />
          <span className="text-sm font-semibold text-gold">{t("agent.generatePoster") || "生成推广海报"}</span>
        </button>
      </div>

      {/* Poster Modal */}
      {showPoster && (
        <PosterModal
          inviteLink={dashboard?.inviteLink ?? ""}
          inviteCode={dashboard?.inviteCode ?? ""}
          userName={user?.name ?? "Agent"}
          onClose={() => setShowPoster(false)}
          t={t}
        />
      )}

      {/* Downlines List */}
      <div className="px-4 pt-4">
        <h3 className="text-sm font-semibold mb-3">{t("agent.downlines")}</h3>
        <div className="space-y-2">
          {(!downlines || downlines.length === 0) ? (
            <div className="glass rounded-xl p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">{t("agent.noDownlines")}</p>
            </div>
          ) : (
            (downlines as any[]).map((dl: any, i: number) => {
              const progress = typeof dl.unlockProgress === "string" ? JSON.parse(dl.unlockProgress) : (dl.unlockProgress ?? {});
              const gamesPlayed = progress.gamesPlayed ?? 0;
              return (
                <div key={i} className="glass rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${dl.isUnlocked ? "bg-success/20" : "bg-warning/20"}`}>
                      {dl.isUnlocked ? <Unlock className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-warning" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("agent.levelDownline").replace("{level}", String(dl.level))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {dl.isUnlocked ? t("agent.unlocked") : `${gamesPlayed}/20 ${t("agent.hands")}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gold">${dl.totalCommissionEarned ?? "0.00"}</p>
                    <p className="text-[10px] text-muted-foreground">{t("agent.earned")}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomNav active="agent" />
    </div>
  );
}

// ==================== POSTER MODAL ====================
function PosterModal({ inviteLink, inviteCode, userName, onClose, t }: {
  inviteLink: string;
  inviteCode: string;
  userName: string;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generatePoster = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setGenerating(true);

    const ctx = canvas.getContext("2d")!;
    const W = 750;
    const H = 1334;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a1628");
    grad.addColorStop(0.5, "#0d2847");
    grad.addColorStop(1, "#0a1628");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#d4a853";
    ctx.beginPath();
    ctx.arc(100, 200, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(650, 900, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Border frame
    ctx.strokeStyle = "#d4a853";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    // Logo area
    ctx.fillStyle = "#d4a853";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("♠ Vera Poker", W / 2, 150);

    // Slogan
    ctx.fillStyle = "#ffffff";
    ctx.font = "28px sans-serif";
    ctx.fillText(t("agent.posterSlogan") || "全球顶级德州扑克平台", W / 2, 220);

    // Features
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#b0c4de";
    const features = [
      t("agent.posterFeature1") || "🎯 公平公正，区块链验证",
      t("agent.posterFeature2") || "💰 秒速充提，安全可靠",
      t("agent.posterFeature3") || "🏆 丰富赛事，高额奖池",
      t("agent.posterFeature4") || "🤝 推荐好友，共享佣金",
    ];
    features.forEach((f, i) => {
      ctx.fillText(f, W / 2, 340 + i * 50);
    });

    // Divider
    ctx.strokeStyle = "#d4a85366";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 580);
    ctx.lineTo(W - 100, 580);
    ctx.stroke();

    // Invite section
    ctx.fillStyle = "#d4a853";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(t("agent.posterInviteTitle") || "专属邀请码", W / 2, 650);

    // Invite code box
    ctx.fillStyle = "#ffffff10";
    ctx.fillRect(W / 2 - 150, 680, 300, 80);
    ctx.strokeStyle = "#d4a853";
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 150, 680, 300, 80);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px monospace";
    ctx.fillText(inviteCode || "------", W / 2, 735);

    // Agent name
    ctx.fillStyle = "#b0c4de";
    ctx.font = "22px sans-serif";
    ctx.fillText(`${t("agent.posterBy") || "推荐人"}: ${userName}`, W / 2, 810);

    // QR Code area placeholder (text-based link)
    ctx.fillStyle = "#ffffff10";
    ctx.fillRect(W / 2 - 125, 860, 250, 250);
    ctx.strokeStyle = "#d4a85366";
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 125, 860, 250, 250);

    // QR placeholder text
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText(t("agent.posterScanQR") || "扫码加入", W / 2, 1000);
    ctx.fillStyle = "#b0c4de";
    ctx.font = "14px sans-serif";
    // Wrap long link
    const linkLines = wrapText(inviteLink, 36);
    linkLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 1040 + i * 22);
    });

    // Bottom CTA
    ctx.fillStyle = "#d4a853";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(t("agent.posterCTA") || "立即注册，领取新人奖励！", W / 2, 1200);

    // Footer
    ctx.fillStyle = "#ffffff50";
    ctx.font = "16px sans-serif";
    ctx.fillText("Vera Poker © 2026", W / 2, 1280);

    setGenerated(true);
    setGenerating(false);
  }, [inviteLink, inviteCode, userName, t]);

  // Auto-generate on mount
  useEffect(() => { generatePoster(); }, [generatePoster]);

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `vera-poker-invite-${inviteCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success(t("agent.posterSaved") || "海报已保存");
  };

  const sharePoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Share via TG with the invite link
    const text = encodeURIComponent(`${t("agent.posterSlogan") || "全球顶级德州扑克平台"}\n${t("agent.posterCTA") || "立即注册，领取新人奖励！"}\n\n${t("agent.posterInviteTitle") || "邀请码"}: ${inviteCode}`);
    const url = encodeURIComponent(inviteLink);
    const tgShareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    window.open(tgShareUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">{t("agent.generatePoster") || "推广海报"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="rounded-xl overflow-hidden border border-border">
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ aspectRatio: "750/1334" }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={downloadPoster}
            disabled={!generated}
            className="flex-1 bg-gold text-background font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t("agent.posterDownload") || "保存图片"}
          </button>
          <button
            onClick={sharePoster}
            disabled={!generated}
            className="flex-1 bg-truth-blue text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {t("agent.posterShare") || "分享到TG"}
          </button>
        </div>
      </div>
    </div>
  );
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  return lines;
}
