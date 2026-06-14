/**
 * RoomInvitePoster — KKPOKER-style share card
 * Layout: Brand Banner (top, dynamic from admin config) → Editable share text → Room info → "开始游戏" CTA
 * 分享方式：通过 Bot API 发送带 InlineKeyboard "开始游戏" 按钮的消息给自己，再转发给好友
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Share2, X, Copy, Gamepad2, Pencil, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RoomInvitePosterProps {
  room: {
    id?: number;
    name: string;
    smallBlind: string;
    bigBlind: string;
    minBuyIn?: string;
    maxBuyIn: string;
    maxPlayers: number;
    totalRounds?: number | null;
    inviteCode?: string | null;
    billingMode: string;
  };
  inviteCode: string;
  onClose: () => void;
}

const DEFAULT_BANNER_URL = "/manus-storage/vera-poker-banner_59247184.png";
// Telegram CDN banner URL (avoid /manus-storage/ 307 redirect issues in TG WebView)

function formatAmount(val: string | number) {
  const n = parseFloat(String(val));
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

export default function RoomInvitePoster({ room, inviteCode, onClose }: RoomInvitePosterProps) {
  const { t } = useI18n();
  const [editingText, setEditingText] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Load public configs (share_banner_url, share_default_text)
  const { data: publicConfigs } = trpc.config.getPublic.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const bannerUrl = (publicConfigs as any)?.share_banner_url || DEFAULT_BANNER_URL;
  // 分享文案逻辑：管理员配置了自定义文案则优先使用，否则自动跟随用户语言翻译
  const _adminShareText = (publicConfigs as any)?.share_default_text;
  const defaultShareText = (_adminShareText != null && _adminShareText !== "")
    ? _adminShareText
    : t("agent.shareText");
  // Use local edits if any, otherwise fall back to config
  const displayText = shareText !== null ? shareText : defaultShareText;

  // 房间邀请链接（通过 Bot 进入房间）
  const inviteLink = `https://t.me/VeraPokerBot?start=room_${inviteCode}`;

  const prepareShareMutation = trpc.agent.prepareShareMessage.useMutation();
  // Banner 图通过 Telegram CDN URL 显示
  const { data: bannerData } = trpc.agent.getBannerUrl.useQuery(undefined, { staleTime: 300_000 });
  const tgBannerUrl = bannerData?.url;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  // 通过 Telegram WebApp.shareMessage 弹出联系人选择器，直接分享给好友
  const handleShareTG = async () => {
    setIsSending(true);
    try {
      // Step 1: 后端调用 savePreparedInlineMessage 获取 prepared_message_id
      const { preparedMessageId } = await prepareShareMutation.mutateAsync({
        shareText: displayText,
        inviteLink,
        startButtonText: t("agent.startGameBtn") || "开始游戏 🎮",
      });

      // Step 2: 调用 Telegram WebApp SDK 弹出联系人选择器
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.shareMessage) {
        tg.shareMessage(preparedMessageId, (sent: boolean) => {
          if (sent) {
            toast.success(t("agent.shareSuccess") || "✅ 分享成功！");
          }
        });
      } else {
        // Fallback: 旧版 TG 不支持 shareMessage
        const text = encodeURIComponent(displayText);
        const url = encodeURIComponent(inviteLink);
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

  const handleStartGame = () => {
    window.open(inviteLink, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div className="relative w-full max-w-sm bg-[#1a1a2e] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Brand Banner (from Telegram CDN or fallback) ── */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={tgBannerUrl || bannerUrl}
            alt="VeraPoker"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_BANNER_URL; }}
          />
          {/* Subtle bottom gradient overlay for smooth transition */}
          <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: "linear-gradient(to top, #1a1a2e, transparent)" }} />
        </div>

        {/* ── Share message text (editable by player) ── */}
        <div className="px-4 pt-2 pb-2">
          {editingText ? (
            <div className="relative">
              <textarea
                value={displayText}
                onChange={(e) => setShareText(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-white/8 border border-white/20 text-white/90 text-sm resize-none focus:outline-none focus:border-green-500/60"
              />
              <button
                onClick={() => setEditingText(false)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/30 transition-colors"
                title="完成"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative group">
              <p className="text-white/80 text-sm leading-relaxed pr-7">
                {displayText}
              </p>
              <button
                onClick={() => {
                  if (shareText === null) setShareText(defaultShareText);
                  setEditingText(true);
                }}
                className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all opacity-60 hover:opacity-100"
                title="编辑分享文案"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Room info strip ── */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm truncate max-w-[140px]">{room.name}</span>
            <span className="text-white/50 text-xs">
              ${formatAmount(room.smallBlind)}/${formatAmount(room.bigBlind)} · {room.maxPlayers}人
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">{t("agent.inviteCode")}</span>
            <span className="text-yellow-400 font-bold text-sm tracking-widest">{inviteCode}</span>
            <button
              onClick={handleCopyLink}
              className="ml-1 w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-95"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── CTA: 开始游戏 button (KKPOKER style) ── */}
        <div className="px-4 pb-5">
          <button
            onClick={handleStartGame}
            className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
            }}
          >
            <Gamepad2 className="w-5 h-5" />
            开始游戏
          </button>

          {/* Secondary: Share via Bot (带 InlineKeyboard 按钮) */}
          <button
            onClick={handleShareTG}
            disabled={isSending}
            className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white/70 hover:text-white transition-colors active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {isSending ? (t("agent.shareSending") || "发送中...") : t("agent.shareButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
