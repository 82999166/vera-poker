import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Users, TrendingUp, Unlock, Lock, Share2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

export default function Agent() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { data: dashboard, isLoading } = trpc.agent.dashboard.useQuery(undefined, { enabled: !!user });
  const { data: downlines } = trpc.agent.downlines.useQuery(undefined, { enabled: !!user });

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
