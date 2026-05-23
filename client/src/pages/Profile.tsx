import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import {
  User, Trophy, TrendingUp, Gamepad2, Edit2, Check, X,
  Link2, Unlink, ArrowLeft, Shield, Clock, Coins, Award
} from "lucide-react";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");

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
        toast.success(`解锁了 ${data.newlyUnlocked.length} 个新成就！`);
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
    onSuccess: () => { toast.success("已更新"); refetch(); setEditingNickname(false); },
    onError: (err) => toast.error(err.message),
  });

  const unbindMutation = trpc.profile.unbindTelegram.useMutation({
    onSuccess: () => { toast.success("已解绑 Telegram"); refetch(); },
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

  return (
    <div className="min-h-screen bg-deep-space pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">个人资料</h1>
      </div>

      {/* Avatar & Name Section */}
      <div className="px-4 pt-6 pb-4">
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
                  placeholder="输入昵称"
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
              <p className="text-lg font-bold text-gold">{profile.balance}</p>
              <p className="text-[10px] text-muted-foreground">余额</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-truth-blue">{profile.totalGamesPlayed}</p>
              <p className="text-[10px] text-muted-foreground">总局数</p>
            </div>
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="px-4 pb-4">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            游戏统计
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Gamepad2} label="总手数" value={String(stats?.totalHands ?? 0)} color="text-truth-blue" />
            <StatCard icon={Trophy} label="胜场" value={String(stats?.wins ?? 0)} color="text-gold" />
            <StatCard icon={TrendingUp} label="胜率" value={`${stats?.winRate ?? 0}%`} color="text-success" />
            <StatCard icon={Coins} label="总盈亏" value={stats?.totalProfit ?? "0.00"} color={parseFloat(stats?.totalProfit ?? "0") >= 0 ? "text-success" : "text-red-400"} />
          </div>
        </div>
      </div>

      {/* Telegram Binding */}
      <div className="px-4 pb-4">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TelegramIcon className="w-4 h-4 text-[#54a9eb]" />
            Telegram 绑定
          </h3>
          {profile.tgId ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#54a9eb]/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-[#54a9eb]" />
                </div>
                <div>
                  <p className="text-sm font-medium">已绑定</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.tgUsername ? `@${profile.tgUsername}` : `ID: ${profile.tgId}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm("确定要解绑 Telegram 吗？解绑后将无法通过 Telegram 登录。")) {
                    unbindMutation.mutate();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1"
              >
                <Unlink className="w-3 h-3" />
                解绑
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
                  <Unlink className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">未绑定</p>
                  <p className="text-xs text-muted-foreground">绑定后可通过 Telegram 快速登录</p>
                </div>
              </div>
              <button
                onClick={() => toast.info("请在 Telegram 中打开 Mini App 自动绑定")}
                className="px-3 py-1.5 rounded-lg bg-[#54a9eb]/10 text-[#54a9eb] text-xs font-medium hover:bg-[#54a9eb]/20 transition-colors flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                绑定
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div className="px-4 pb-4">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            成就徽章
            {achievementsData && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {achievementsData.unlocked.length}/{achievementsData.all.length}
              </span>
            )}
          </h3>
          {achievementsData && achievementsData.all.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {achievementsData.all.map((a: any) => (
                <div
                  key={a.id}
                  className={`relative rounded-xl p-2 text-center transition-all ${
                    a.isUnlocked
                      ? "glass border border-gold/30 shadow-[0_0_8px_rgba(212,175,55,0.15)]"
                      : "glass opacity-50 grayscale"
                  }`}
                  title={a.nameZh + (a.isUnlocked ? " ✓" : ` (${a.progress}%)`)}
                >
                  <span className="text-xl">{a.icon}</span>
                  <p className="text-[9px] mt-0.5 truncate font-medium">{a.nameZh}</p>
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
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">暂无成就数据</p>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="px-4 pb-4">
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            账户信息
          </h3>
          <div className="space-y-2.5">
            <InfoRow label="用户ID" value={`#${profile.id}`} />
            <InfoRow label="邀请码" value={profile.inviteCode || "未生成"} />
            <InfoRow label="代理等级" value={profile.agentLevel === "agent" ? "代理" : "普通用户"} />
            <InfoRow label="注册时间" value={profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("zh-CN") : "-"} />
            <InfoRow label="最后登录" value={profile.lastSignedIn ? new Date(profile.lastSignedIn).toLocaleDateString("zh-CN") : "-"} />
          </div>
        </div>
      </div>

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
