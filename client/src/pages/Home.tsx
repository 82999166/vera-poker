import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { getLoginUrl } from "@/const";
import { useTelegramAuth, isTelegramMiniApp, getTelegramStartParam } from "@/hooks/useTelegramAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Shield, Zap, Globe, Users, ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const {
    isTelegramMiniApp: isTgApp,
    isAuthenticating,
    authError,
    autoAuthenticate,
    authenticateWithWidget,
  } = useTelegramAuth();
  const [tgLoginAttempted, setTgLoginAttempted] = useState(false);
  const [tgLoginSuccess, setTgLoginSuccess] = useState(false);

  // Auto-authenticate in Telegram Mini App
  useEffect(() => {
    if (!isTgApp) return;
    if (tgLoginAttempted) return;
    if (isAuthenticated) return;

    setTgLoginAttempted(true);
    autoAuthenticate().then((result) => {
      if (result?.success) {
        setTgLoginSuccess(true);
        localStorage.setItem("vera_auth_method", "telegram");
        // Refresh auth state to pick up the new session
        refresh();
      }
    });
  }, [isTgApp, tgLoginAttempted, isAuthenticated, autoAuthenticate, refresh]);

  // Auto-redirect authenticated users - handle deep link params
  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const startParam = getTelegramStartParam();
    if (startParam && startParam.startsWith("room_")) {
      const inviteCode = startParam.replace("room_", "");
      // Resolve invite code to room ID then navigate
      fetch(`/api/trpc/rooms.resolveInviteCode?input=${encodeURIComponent(JSON.stringify({ inviteCode }))}`)
        .then(r => r.json())
        .then(data => {
          const room = data?.result?.data;
          if (room && room.id) {
            navigate(`/table/${room.id}`);
          } else {
            navigate("/lobby");
          }
        })
        .catch(() => navigate("/lobby"));
    } else if (startParam && startParam.startsWith("ref_")) {
      const refCode = startParam.replace("ref_", "");
      // Auto-register as downline of the referrer via tRPC batch endpoint
      fetch(`/api/trpc/agent.register?batch=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { inviteCode: refCode } } }),
      }).catch(() => {});
      navigate("/lobby");
    } else {
      navigate("/lobby");
    }
  }, [isAuthenticated, loading, navigate]);

  // Handle Telegram Login Widget callback
  const handleTelegramLogin = useCallback(async (widgetData: Record<string, unknown>) => {
    // If we got a success signal from widget-callback (server already set the cookie)
    if (widgetData.success === true) {
      setTgLoginSuccess(true);
      localStorage.setItem("vera_auth_method", "telegram");
      refresh();
      return;
    }
    // Otherwise, try to authenticate with full widget data (has hash, auth_date, etc.)
    if (widgetData.hash && widgetData.auth_date) {
      const result = await authenticateWithWidget(widgetData);
      if (result.success) {
        setTgLoginSuccess(true);
        localStorage.setItem("vera_auth_method", "telegram");
        refresh();
      }
    }
  }, [authenticateWithWidget, refresh]);

  // Show loading state during TG auto-login
  if (isTgApp && (isAuthenticating || (tgLoginSuccess && loading))) {
    return (
      <div className="min-h-screen bg-background particle-bg flex flex-col items-center justify-center">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gold via-gold-dim to-truth-blue flex items-center justify-center shadow-2xl glow-gold mb-6">
          <span className="text-4xl font-black text-background">VP</span>
        </div>
        <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">
          {t("common.loading")}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gold via-gold-dim to-truth-blue flex items-center justify-center shadow-2xl glow-gold">
            <span className="text-4xl font-black text-background">VP</span>
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-gold/5 blur-xl -z-10" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black mb-3">
          <span className="text-gold glow-text-gold">Vera</span>{" "}
          <span className="text-foreground">Poker</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-2 italic">
          "Where Truth Deals."
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-8">
          The world's first provably fair poker platform with every card verifiable on-chain.
          Play Texas Hold'em with confidence.
        </p>

        {/* Auth Error */}
        {authError && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {authError}
          </div>
        )}

        {/* Login Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Telegram Login Button */}
          <TelegramLoginButton onLogin={handleTelegramLogin} />

          {/* Manus OAuth Login (fallback for non-TG environments) */}
          {!isTgApp && (
            <button
              onClick={() => (window.location.href = getLoginUrl())}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm glow-gold hover:opacity-90 transition-opacity active:scale-[0.97] flex items-center justify-center gap-2"
            >
              {t("common.login")} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-sm">
          {[
            { icon: Shield, title: "Provably Fair", desc: "Every card on-chain", color: "text-truth-blue" },
            { icon: Zap, title: "Zero Gas Fee", desc: "In-game transactions", color: "text-gold" },
            { icon: Globe, title: "Multi-Language", desc: "10+ languages", color: "text-success" },
            { icon: Users, title: "Private Rooms", desc: "Play with friends", color: "text-purple-400" },
          ].map((feat, i) => (
            <div key={i} className="glass rounded-xl p-3 text-center">
              <feat.icon className={`w-5 h-5 ${feat.color} mx-auto mb-1`} />
              <p className="text-xs font-semibold">{feat.title}</p>
              <p className="text-[10px] text-muted-foreground">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Powered by TON Blockchain • Vera Poker © 2024
        </p>
      </footer>
    </div>
  );
}

// ==================== Telegram Login Button Component ====================

function TelegramLoginButton({ onLogin }: { onLogin: (data: Record<string, unknown>) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useI18n();

  // In TG Mini App, we don't need the widget button (auto-login handles it)
  if (isTelegramMiniApp()) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Use OIDC flow directly
      await openTelegramLogin("", onLogin);
    } catch {
      window.location.href = getLoginUrl();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="px-8 py-3.5 rounded-xl bg-[#54a9eb] hover:bg-[#4a96d4] text-white font-bold text-sm transition-colors active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-60"
    >
      <TelegramIcon className="w-5 h-5" />
      {isLoading ? t("common.loading") : t("common.loginWithTelegram")}
    </button>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

/**
 * Open Telegram Login using the new OIDC flow.
 * 1. Fetch auth URL from /api/telegram/oidc-start
 * 2. Open popup to Telegram's OIDC authorization page
 * 3. After user authorizes, Telegram redirects to our oidc-callback
 * 4. Callback sets session cookie and posts success message back
 */
async function openTelegramLogin(_botIdOrUsername: string, onLogin: (data: Record<string, unknown>) => void) {
  try {
    // Get the OIDC authorization URL from our server
    const res = await fetch(`/api/telegram/oidc-start?origin=${encodeURIComponent(window.location.origin)}`, {
      credentials: "include",
    });
    const json = await res.json();

    if (!res.ok || !json.authUrl) {
      // Fallback: try legacy widget approach
      console.error("[TG Login] OIDC start failed:", json.error);
      window.location.href = getLoginUrl();
      return;
    }

    const authUrl = json.authUrl;

    const width = 550;
    const height = 600;
    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;

    const popup = window.open(
      authUrl,
      "telegram_login",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=no`
    );

    // Listen for postMessage from our oidc-callback page
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data && typeof event.data === "object" && event.data.success) {
        window.removeEventListener("message", handleMessage);
        if (popup) popup.close();
        onLogin(event.data);
      }
    };

    window.addEventListener("message", handleMessage);

    // Poll for popup closure
    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        // After popup closes, try refreshing auth in case cookie was set
        setTimeout(() => {
          onLogin({ success: true, fromPopupClose: true });
        }, 500);
      }
    }, 500);
  } catch (error) {
    console.error("[TG Login] Error:", error);
    window.location.href = getLoginUrl();
  }
}
