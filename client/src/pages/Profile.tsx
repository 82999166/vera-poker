import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from "@/lib/i18n";
import { formatBalance } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import {
  User, Trophy, TrendingUp, Gamepad2, Edit2, Check, X,
  Link2, Unlink, ArrowLeft, Shield, Coins, Award, Globe, ChevronRight,
  Volume2, Users, ChevronRight as ArrowRight
} from "lucide-react";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t, locale, changeLocale } = useI18n();
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Sound settings
  const { toggle: toggleSound, voiceMode, setVoiceMode } = useSoundEffects();
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("vera-sound-enabled") !== "false");

  const { data: profile, isLoading: profileLoading, refetch } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: stats } = trpc.profile.gameStats.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: achievementsData } = trpc.profile.achievements.useQuery(undefined, {
    enabled: !!user,
  });
  const utils = trpc.useUtils();
  const checkAchievements = trpc.profile.checkAndUnlock.useMutation({
    onSuccess: (data) => {
      if (data.newlyUnlocked.length > 0) {
        toast.success(t("profile.newAchievements").replace("{count}", String(data.newlyUnlocked.length)));
        utils.profile.achievements.invalidate();
      }
    },
  });

  useEffect(() => {
    if (user) {
      checkAchievements.mutate();
    }
  }, [user]);  // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success(t("profile.nicknameUpdated")); refetch(); setEditingNickname(false); },
    onError: (err) => toast.error(err.message),
  });

  const unbindMutation = trpc.profile.unbindTelegram.useMutation({
    onSuccess: () => { toast.success(t("profile.tgUnbindSuccess")); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-deep-space flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    navigate("/");
    return null;
  }

  const displayName = profile.nickname || profile.name || "Player";

  // Locale-aware date formatting
  const formatDate = (ts: Date | number | null | undefined) => {
    if (!ts) return "-";
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : locale === "zh-TW" ? "zh-TW" : locale);
  };

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("vera-sound-enabled", next ? "true" : "false");
    toggleSound();
  };

  const handleVoiceCycle = () => {
    const modes: Array<"off" | "winner_only" | "all"> = ["off", "winner_only", "all"];
    const currentIdx = modes.indexOf(voiceMode);
    const nextMode = modes[(currentIdx + 1) % 3];
    setVoiceMode(nextMode);
  };

  const voiceLabel = voiceMode === "off" ? t("sound.voiceOff") : voiceMode === "winner_only" ? t("sound.voiceWinnerOnly") : t("sound.voiceAll");

  return (
    <div className="min-h-screen bg-deep-space pb-20">
      {/* Header with language switcher */}
      <div className="sticky top-0 z-40 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1">{t("profile.title")}</h1>
        {/* Language quick-switch in header */}
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass border border-border/60 hover:border-gold/40 transition-all text-xs"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-muted-foreground">{LOCALE_FLAGS[locale as Locale]}</span>
          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${showLangPicker ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Language picker dropdown */}
      {showLangPicker && (
        <div className="mx-4 mt-2 glass rounded-2xl p-3 border border-gold/20 z-30">
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(LOCALE_NAMES) as Locale[]).map((loc) => (
              <button
                key={loc}
                onClick={() => { changeLocale(loc); setShowLangPicker(false); }}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-xs transition-colors ${
                  locale === loc
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                <span className="text-base">{LOCALE_FLAGS[loc]}</span>
                <span className="text-[9px] truncate w-full text-center">{LOCALE_NAMES[loc].split("/")[0].trim()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Avatar & Name Section */}
      <div className="px-4 pt-4 pb-3">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 mx-auto flex items-center justify-center border-2 border-gold/30 overflow-hidden">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-gold" />
            )}
          </div>
          
          <div className="mt-3 flex items-center justify-center gap-2">
            {editingNickname ? (
              <div className="flex items-center gap-2">
                <input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="glass rounded-lg px-3 py-1 text-sm text-center outline-none focus:ring-1 focus:ring-gold w-36"
                  placeholder={t("profile.nicknamePlaceholder")}
                  autoFocus
                />
                <button
                  onClick={() => updateMutation.mutate({ nickname: newNickname })}
                  className="p-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingNickname(false)}
                  className="p-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">{displayName}</h2>
                <button
                  onClick={() => { setNewNickname(profile.nickname || profile.name || ""); setEditingNickname(true); }}
                  className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          
          {profile.tgUsername && (
            <p className="text-xs text-muted-foreground mt-1">@{profile.tgUsername}</p>
          )}
          
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gold">{formatBalance(profile.balance)}</p>
              <p className="text-[10px] text-muted-foreground">{t("profile.balance")}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-truth-blue">{profile.totalGamesPlayed}</p>
              <p className="text-[10px] text-muted-foreground">{t("profile.totalGames")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links: Agent Center */}
      <div className="px-4 pb-3">
        <button
          onClick={() => navigate("/agent")}
          className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:border-gold/30 border border-transparent transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">{t("profile.agentEntry")}</p>
            <p className="text-xs text-muted-foreground">{t("profile.agentEntryDesc")}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Account Info */}
      <div className="px-4 pb-3">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            {t("profile.accountInfo")}
          </h3>
          <div className="space-y-2.5">
            <InfoRow label={t("profile.userId")} value={`#${profile.id}`} />
            <InfoRow label={t("profile.inviteCode")} value={profile.inviteCode || t("profile.inviteCodeNone")} />
            <InfoRow label={t("profile.agentLevel")} value={profile.agentLevel === "agent" ? t("profile.agentLevelAgent") : t("profile.agentLevelUser")} />
            <InfoRow label={t("profile.registeredAt")} value={formatDate(profile.createdAt)} />
            <InfoRow label={t("profile.lastLogin")} value={formatDate(profile.lastSignedIn)} />
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="px-4 pb-3">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            {t("profile.gameStats")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Gamepad2} label={t("profile.totalHands")} value={String(stats?.totalHands ?? 0)} color="text-truth-blue" />
            <StatCard icon={Trophy} label={t("profile.wins")} value={String(stats?.wins ?? 0)} color="text-gold" />
            <StatCard icon={TrendingUp} label={t("profile.winRate")} value={`${stats?.winRate ?? 0}%`} color="text-success" />
            <StatCard icon={Coins} label={t("profile.totalProfit")} value={formatBalance(stats?.totalProfit)} color={parseFloat(stats?.totalProfit ?? "0") >= 0 ? "text-success" : "text-red-400"} />
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="px-4 pb-3">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            {t("profile.achievements")}
            {achievementsData && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {achievementsData.unlocked.length}/{achievementsData.all.length}
              </span>
            )}
          </h3>
          {achievementsData && achievementsData.all.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {achievementsData.all.map((a: any) => {
                const achName = locale === "zh-CN" ? a.nameZh : locale === "zh-TW" ? (a.nameZhTW || a.nameZh) : (a.nameEn || a.nameZh);
                return (
                  <div
                    key={a.id}
                    className={`relative rounded-xl p-2 text-center transition-all ${
                      a.isUnlocked
                        ? "glass border border-gold/30 shadow-[0_0_8px_rgba(212,175,55,0.15)]"
                        : "glass opacity-50 grayscale"
                    }`}
                    title={achName + (a.isUnlocked ? " ✓" : ` (${a.progress}%)`)}
                  >
                    <span className="text-xl">{a.icon}</span>
                    <p className="text-[9px] mt-0.5 truncate font-medium">{achName}</p>
                    {!a.isUnlocked && (
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${a.progress}%` }} />
                      </div>
                    )}
                    {a.isUnlocked && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gold flex items-center justify-center">
                        <Check className="w-2 h-2 text-black" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">{t("profile.noAchievements")}</p>
          )}
        </div>
      </div>

      {/* Sound & Voice Settings (#12) */}
      <div className="px-4 pb-3">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            {t("sound.title")}
          </h3>
          {/* Sound Effects toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("sound.effects")}</p>
              <p className="text-xs text-muted-foreground">{t("sound.effectsDesc")}</p>
            </div>
            <button
              onClick={handleSoundToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${soundOn ? "bg-gold" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${soundOn ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="h-px bg-border/50 my-1" />
          {/* Voice mode cycle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{t("sound.voice")}</p>
              <p className="text-xs text-muted-foreground">{t("sound.voiceDesc")}</p>
            </div>
            <button
              onClick={handleVoiceCycle}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                voiceMode === "off"
                  ? "border-border text-muted-foreground hover:border-gold/40"
                  : voiceMode === "winner_only"
                  ? "border-gold/40 text-gold bg-gold/10"
                  : "border-green-500/40 text-green-400 bg-green-500/10"
              }`}
            >
              {voiceLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Telegram Binding */}
      <div className="px-4 pb-3">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TelegramIcon className="w-4 h-4 text-[#54a9eb]" />
            {t("profile.tgBinding")}
          </h3>
          {profile.tgId ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#54a9eb]/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-[#54a9eb]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("profile.tgBound")}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.tgUsername ? `@${profile.tgUsername}` : `ID: ${profile.tgId}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(t("profile.tgUnbindConfirm"))) {
                    unbindMutation.mutate();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1"
              >
                <Unlink className="w-3 h-3" />
                {t("profile.tgUnbind")}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
                  <Unlink className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("profile.tgUnbound")}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.tgUnboundHint")}</p>
                </div>
              </div>
              <button
                onClick={() => toast.info(t("profile.tgBindHint"))}
                className="px-3 py-1.5 rounded-lg bg-[#54a9eb]/10 text-[#54a9eb] text-xs font-medium hover:bg-[#54a9eb]/20 transition-colors flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                {t("profile.tgBind")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom padding for BottomNav */}
      <div className="h-6" />

      <BottomNav active="profile" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
