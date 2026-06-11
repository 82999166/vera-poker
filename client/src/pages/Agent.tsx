/** 代理中心页面 - 下级管理、佣金统计、推广链接 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Users, TrendingUp, Unlock, Lock, Share2, Image, Download, X, Gamepad2, Pencil, Check } from "lucide-react";
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
  const [editingShareText, setEditingShareText] = useState(false);
  const [customShareText, setCustomShareText] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Load share config from backend
  const { data: publicConfigs } = trpc.config.getPublic.useQuery(undefined, { staleTime: 60_000 });
  // Banner 图通过 Telegram CDN URL 显示（避免 /manus-storage/ 307 重定向在 TG WebView 失败）
  const { data: bannerData } = trpc.agent.getBannerUrl.useQuery(undefined, { staleTime: 300_000, enabled: !!user });
  const bannerUrl = bannerData?.url ?? "";
  // 分享文案逻辑：管理员配置了自定义文案则优先使用，否则自动跟随用户语言翻译
  const _adminShareText = (publicConfigs as any)?.share_default_text;
  const defaultShareText = (_adminShareText != null && _adminShareText !== "")
    ? _adminShareText
    : t("agent.shareText");
  const displayShareText = customShareText !== null ? customShareText : defaultShareText;

  const prepareShareMutation = trpc.agent.prepareShareMessage.useMutation();

  const copyLink = () => {
    if (dashboard?.inviteLink) {
      navigator.clipboard.writeText(dashboard.inviteLink);
      toast.success(t("agent.inviteLinkCopied"));
    }
  };

  // 通过 Telegram WebApp.shareMessage 弹出联系人选择器，直接分享给好友
  const shareToTG = async () => {
    if (!dashboard?.inviteLink) return;
    setIsSending(true);
    try {
      // Step 1: 后端调用 savePreparedInlineMessage 获取 prepared_message_id
      const { preparedMessageId } = await prepareShareMutation.mutateAsync({
        shareText: displayShareText,
        inviteLink: dashboard.inviteLink,
        startButtonText: t("agent.startGameBtn") || "开始游戏 🎮",
      });

      // Step 2: 调用 Telegram WebApp SDK 弹出联系人选择器
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.shareMessage) {
        tg.shareMessage(preparedMessageId, (sent: boolean) => {
          if (sent) {
            toast.success(t("agent.shareSuccess") || "✅ 分享成功！");
          }
          // 用户取消不显示错误
        });
      } else {
        // Fallback: 旧版 TG 不支持 shareMessage，使用 t.me/share/url
        const text = encodeURIComponent(displayShareText);
        const url = encodeURIComponent(dashboard.inviteLink);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
      }
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || "";
      if (msg.includes("Telegram")) {
        toast.error("请先用 Telegram 账号登录后再分享");
      } else {
        toast.error("发送失败：" + (msg || "请稍后重试"));
      }
    } finally {
      setIsSending(false);
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
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 safe-top flex items-center gap-3">
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
          <p className="text-2xl font-bold text-warning">${dashboard?.pendingEarnings ?? "0.00"}</p>
          <p className="text-[10px] text-muted-foreground">{t("agent.pendingEarnings")}</p>
        </div>
      </div>

      {/* Share Card Preview (KKPOKER style) */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-[#1a1a2e]">
          {/* Banner */}
          {bannerUrl ? (
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              <img src={bannerUrl} alt="VeraPoker" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
            </div>
          ) : (
            <div className="w-full h-24 bg-gradient-to-r from-[#0f3460] to-[#16213e] flex items-center justify-center">
              <span className="text-2xl font-black text-gold tracking-wider">VeraPoker</span>
            </div>
          )}
          {/* Share text (editable) */}
          <div className="px-4 pt-2 pb-1">
            {editingShareText ? (
              <div className="relative">
                <textarea
                  value={displayShareText}
                  onChange={(e) => setCustomShareText(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl bg-white/8 border border-white/20 text-white/90 text-sm resize-none focus:outline-none focus:border-green-500/60"
                />
                <button
                  onClick={() => setEditingShareText(false)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative group">
                <p className="text-white/80 text-sm leading-relaxed pr-7 line-clamp-3">{displayShareText}</p>
                <button
                  onClick={() => { if (customShareText === null) setCustomShareText(defaultShareText); setEditingShareText(true); }}
                  className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
                  title="编辑分享文案"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          {/* Invite code strip */}
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-white/40 text-xs">{t("agent.inviteLink")}</span>
              <span className="text-white/60 text-[10px] font-mono truncate max-w-[160px]">{dashboard?.inviteLink ?? ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 text-xs">{t("agent.inviteCode")}</span>
              <span className="text-yellow-400 font-bold text-sm tracking-widest">{dashboard?.inviteCode ?? ""}</span>
              <button onClick={copyLink} className="ml-1 w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-95">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          {/* CTA: Share button */}
          <div className="px-4 pb-4">
            <button
              onClick={shareToTG}
              disabled={isSending}
              className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", color: "#fff", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Gamepad2 className="w-5 h-5" />
              )}
              {isSending ? (t("agent.shareSending") || "发送中...") : t("agent.shareButton")}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("agent.unlockRequirements")}</h3>
            <span className="text-[10px] text-muted-foreground">{t("agent.unlockReqNote")}</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex gap-2.5">
              <div className="w-5 h-5 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] font-bold text-gold">1</span>
              </div>
              <div>
                <p className="text-xs font-medium">{t("agent.unlockReq1")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("agent.unlockReq1Detail")}</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="w-5 h-5 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] font-bold text-gold">2</span>
              </div>
              <div>
                <p className="text-xs font-medium">{t("agent.unlockReq3")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("agent.unlockReq3Detail")}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">{t("agent.unlockReqHint")}</p>
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
          <span className="text-sm font-semibold text-gold">{t("agent.generatePoster")}</span>
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
    ctx.fillText(t("agent.posterSlogan"), W / 2, 220);

    // Features
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#b0c4de";
    const features = [
      t("agent.posterFeature1"),
      t("agent.posterFeature2"),
      t("agent.posterFeature3"),
      t("agent.posterFeature4"),
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
    ctx.fillText(t("agent.posterInviteTitle"), W / 2, 650);

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
    ctx.fillText(`${t("agent.posterBy")}: ${userName}`, W / 2, 810);

    // QR Code area placeholder (text-based link)
    ctx.fillStyle = "#ffffff10";
    ctx.fillRect(W / 2 - 125, 860, 250, 250);
    ctx.strokeStyle = "#d4a85366";
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 125, 860, 250, 250);

    // QR placeholder text
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText(t("agent.posterScanQR"), W / 2, 1000);
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
    ctx.fillText(t("agent.posterCTA"), W / 2, 1200);

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
    toast.success(t("agent.posterSaved"));
  };

  const sharePoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Share via TG with the invite link
    const text = encodeURIComponent(`${t("agent.posterSlogan")}\n${t("agent.posterCTA")}\n\n${t("agent.posterInviteTitle")}: ${inviteCode}`);
    const url = encodeURIComponent(inviteLink);
    const tgShareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    window.open(tgShareUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">{t("agent.generatePoster")}</h3>
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
            {t("agent.posterDownload")}
          </button>
          <button
            onClick={sharePoster}
            disabled={!generated}
            className="flex-1 bg-truth-blue text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {t("agent.posterShare")}
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
