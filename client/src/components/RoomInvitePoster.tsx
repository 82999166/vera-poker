import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import { Download, Share2, X } from "lucide-react";

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

// Poster dimensions: 750×1200 (portrait, mobile-friendly)
const W = 750;
const H = 1200;

function formatAmount(val: string | number) {
  const n = parseFloat(String(val));
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

export default function RoomInvitePoster({ room, inviteCode, onClose }: RoomInvitePosterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [generating, setGenerating] = useState(true);

  const inviteLink = `https://t.me/VeraPokerBot?start=room_${inviteCode}`;

  const drawPoster = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    // ── Background gradient (dark poker green → deep navy) ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0a1628");
    bgGrad.addColorStop(0.5, "#0d2137");
    bgGrad.addColorStop(1, "#071020");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Decorative felt texture (subtle dots) ──
    ctx.fillStyle = "rgba(255,255,255,0.015)";
    for (let x = 0; x < W; x += 24) {
      for (let y = 0; y < H; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Top gold accent bar ──
    const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
    goldGrad.addColorStop(0, "#b8860b");
    goldGrad.addColorStop(0.5, "#ffd700");
    goldGrad.addColorStop(1, "#b8860b");
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 0, W, 6);

    // ── Logo area ──
    // VP badge
    const badgeSize = 80;
    const badgeX = W / 2 - badgeSize / 2;
    const badgeY = 40;
    const badgeRadius = 18;
    const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize);
    badgeGrad.addColorStop(0, "#7c3aed");
    badgeGrad.addColorStop(1, "#4f46e5");
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeRadius);
    ctx.fill();

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 36px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VP", W / 2, badgeY + badgeSize / 2);

    // ── App title ──
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Vera Poker", W / 2, 175);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "22px Arial, sans-serif";
    ctx.fillText("Where Truth Deals", W / 2, 208);

    // ── Divider ──
    drawGoldDivider(ctx, 60, 228, W - 60);

    // ── Room name ──
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const roomNameText = room.name.length > 18 ? room.name.slice(0, 18) + "…" : room.name;
    ctx.fillText(roomNameText, W / 2, 290);

    ctx.fillStyle = "rgba(255,215,0,0.7)";
    ctx.font = "22px Arial, sans-serif";
    ctx.fillText(t("room.create") + " · Private Room", W / 2, 322);

    // ── Room info cards ──
    const cardY = 350;
    const cardH = 110;
    const cardGap = 18;
    const cardW = (W - 60 - cardGap * 2) / 3;

    const infoCards = [
      { label: t("lobby.blinds"), value: `$${formatAmount(room.smallBlind)}/$${formatAmount(room.bigBlind)}` },
      { label: t("lobby.buyIn"), value: `$${formatAmount(room.minBuyIn)}-${formatAmount(room.maxBuyIn)}` },
      { label: t("lobby.players"), value: `${room.maxPlayers} ${t("lobby.players")}` },
    ];

    infoCards.forEach((card, i) => {
      const cx = 30 + i * (cardW + cardGap);
      // Card background
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, cx, cardY, cardW, cardH, 14);
      ctx.fill();
      // Gold border
      ctx.strokeStyle = "rgba(255,215,0,0.25)";
      ctx.lineWidth = 1;
      roundRect(ctx, cx, cardY, cardW, cardH, 14);
      ctx.stroke();
      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "18px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(card.label, cx + cardW / 2, cardY + 32);
      // Value
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${card.value.length > 10 ? 18 : 22}px Arial, sans-serif`;
      ctx.fillText(card.value, cx + cardW / 2, cardY + 72);
    });

    // ── Rounds info ──
    const roundsY = cardY + cardH + 20;
    if (room.totalRounds) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "20px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${t("room.rounds")}: ${room.totalRounds}`, W / 2, roundsY + 24);
    }

    // ── Invite code box ──
    const codeBoxY = roundsY + (room.totalRounds ? 54 : 20);
    ctx.fillStyle = "rgba(255,215,0,0.08)";
    roundRect(ctx, 60, codeBoxY, W - 120, 90, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,215,0,0.5)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 60, codeBoxY, W - 120, 90, 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("room.inviteCode"), W / 2, codeBoxY + 28);

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 46px 'Courier New', monospace, Arial";
    ctx.textAlign = "center";
    ctx.letterSpacing = "8px";
    ctx.fillText(inviteCode, W / 2, codeBoxY + 72);
    ctx.letterSpacing = "0px";

    // ── QR Code ──
    const qrSize = 240;
    const qrX = W / 2 - qrSize / 2;
    const qrY = codeBoxY + 110;

    // QR white background
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
    ctx.fill();

    // Generate QR code
    try {
      const qrDataUrl = await QRCode.toDataURL(inviteLink, {
        width: qrSize,
        margin: 1,
        color: { dark: "#0a1628", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      ctx.fillStyle = "#333";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("QR Code", W / 2, qrY + qrSize / 2);
    }

    // QR label
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("agent.posterScanQR"), W / 2, qrY + qrSize + 30);

    // ── Invite link (truncated) ──
    const linkY = qrY + qrSize + 60;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 40, linkY, W - 80, 56, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "18px 'Courier New', monospace, Arial";
    ctx.textAlign = "center";
    const shortLink = inviteLink.length > 42 ? inviteLink.slice(0, 42) + "…" : inviteLink;
    ctx.fillText(shortLink, W / 2, linkY + 34);

    // ── Bottom CTA ──
    const ctaY = linkY + 76;
    const ctaGrad = ctx.createLinearGradient(60, ctaY, W - 60, ctaY);
    ctaGrad.addColorStop(0, "#b8860b");
    ctaGrad.addColorStop(0.5, "#ffd700");
    ctaGrad.addColorStop(1, "#b8860b");
    ctx.fillStyle = ctaGrad;
    roundRect(ctx, 60, ctaY, W - 120, 70, 16);
    ctx.fill();
    ctx.fillStyle = "#0a1628";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("agent.posterCTA"), W / 2, ctaY + 44);

    // ── Bottom gold bar ──
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, H - 6, W, 6);

    // ── Footer ──
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Vera Poker · Powered by TON Blockchain", W / 2, H - 22);

    // Export
    const url = canvas.toDataURL("image/png");
    setPosterUrl(url);
    setGenerating(false);
  }, [room, inviteCode, inviteLink]);

  useEffect(() => {
    drawPoster();
  }, [drawPoster]);

  const handleDownload = () => {
    if (!posterUrl) return;
    const a = document.createElement("a");
    a.href = posterUrl;
    a.download = `vera-poker-room-${inviteCode}.png`;
    a.click();
    toast.success(t("agent.posterSaved"));
  };

  const handleShareTG = () => {
    const text = encodeURIComponent(`🃏 ${t("agent.shareText")}\n\n🎯 ${room.name}\n💰 Blinds: $${formatAmount(room.smallBlind)}/$${formatAmount(room.bigBlind)}\n👥 ${room.maxPlayers} ${t("lobby.players")}\n\n🔑 ${t("room.inviteCode")}: ${inviteCode}\n\n${inviteLink}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${text}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Canvas (hidden, used for generation) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Poster preview */}
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-gold/20">
          {generating ? (
            <div className="aspect-[750/1200] bg-background flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              </div>
            </div>
          ) : (
            <img src={posterUrl} alt="Invite Poster" className="w-full" />
          )}
        </div>

        {/* Action buttons */}
        {!generating && (
          <div className="flex gap-3 mt-4 w-full">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl bg-gold text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Download className="w-4 h-4" />
              {t("agent.posterDownload")}
            </button>
            <button
              onClick={handleShareTG}
              className="flex-1 py-3 rounded-xl bg-truth-blue text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Share2 className="w-4 h-4" />
              {t("agent.posterShare")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: rounded rectangle path
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Helper: gold divider line with diamond center
function drawGoldDivider(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  const mid = (x1 + x2) / 2;
  ctx.strokeStyle = "rgba(255,215,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(mid - 12, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mid + 12, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  // Diamond
  ctx.fillStyle = "rgba(255,215,0,0.6)";
  ctx.beginPath();
  ctx.moveTo(mid, y - 5);
  ctx.lineTo(mid + 5, y);
  ctx.lineTo(mid, y + 5);
  ctx.lineTo(mid - 5, y);
  ctx.closePath();
  ctx.fill();
}
