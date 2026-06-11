/**
 * RoomInvitePoster — KKPOKER-style share card
 * Layout: Brand Banner (top) → Room info card → "开始游戏" CTA button
 */
import { useState } from "react";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import { Share2, X, Copy, Gamepad2 } from "lucide-react";

interface RoomInvitePosterProps {
  room: {
    id: number;
    name: string;
    smallBlind: string;
    bigBlind: string;
    minBuyIn: string;
    maxBuyIn: string;
    maxPlayers: number;
    totalRounds?: number | null;
    inviteCode?: string | null;
    billingMode: string;
  };
  inviteCode: string;
  onClose: () => void;
}

const BANNER_URL = "/manus-storage/vera-poker-banner_dd9e0bad.png";

function formatAmount(val: string | number) {
  const n = parseFloat(String(val));
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

export default function RoomInvitePoster({ room, inviteCode, onClose }: RoomInvitePosterProps) {
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://t.me/VeraPokerBot?start=room_${inviteCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success(t("common.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  const handleShareTG = () => {
    const shareText = encodeURIComponent(
      `🃏 刚在 VeraPoker 玩德州，牌桌气氛很给力，不用下载点击下方立即开始，快点进来一起抓鱼。`
    );
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareText}`,
      "_blank"
    );
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

        {/* ── Brand Banner ── */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={BANNER_URL}
            alt="VeraPoker"
            className="w-full h-full object-cover"
          />
          {/* Subtle bottom gradient overlay for smooth transition */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
        </div>

        {/* ── Share message text ── */}
        <div className="px-4 pt-1 pb-3">
          <p className="text-white/80 text-sm leading-relaxed">
            刚在 VeraPoker 玩德州，牌桌气氛很给力，不用下载点击下方立即开始，快点进来一起抓鱼。
          </p>
        </div>

        {/* ── Room info strip ── */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm truncate max-w-[140px]">{room.name}</span>
            <span className="text-white/50 text-xs">
              盲注 ${formatAmount(room.smallBlind)}/${formatAmount(room.bigBlind)} · {room.maxPlayers}人桌
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">邀请码</span>
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

          {/* Secondary: Share to TG */}
          <button
            onClick={handleShareTG}
            className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white/70 hover:text-white transition-colors active:scale-[0.97]"
          >
            <Share2 className="w-4 h-4" />
            {copied ? "已复制链接" : "分享给好友"}
          </button>
        </div>
      </div>
    </div>
  );
}
