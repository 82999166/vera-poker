/** 首页 - 应用入口，Telegram 认证、引导注册、快速开始 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { getLoginUrl } from "@/const";
import { useTelegramAuth, isTelegramMiniApp, getTelegramStartParam } from "@/hooks/useTelegramAuth";
import { trpc } from "@/lib/trpc";
import { useI18n, detectLocale, setLocale, applyLocale } from "@/lib/i18n";
import { Shield, Zap, Globe, Users, ArrowRight, Loader2, Lock, Eye, EyeOff } from "lucide-react";

// Storage key for pending referral code
const PENDING_REF_KEY = "vera_pending_ref_code";

export default function Home() {
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const { t, locale } = useI18n();
  const {
    isTelegramMiniApp: isTgApp,
    isAuthenticating,
    authError,
    autoAuthenticate,
    authenticateWithWidget,
  } = useTelegramAuth();
  const [tgLoginAttempted, setTgLoginAttempted] = useState(false);
  const [tgLoginSuccess, setTgLoginSuccess] = useState(false);

  // Password login state
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [pwdIdentifier, setPwdIdentifier] = useState("");
  const [pwdPassword, setPwdPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const passwordLoginMutation = trpc.auth.passwordLogin.useMutation({
    onSuccess: () => {
      refresh();
      navigate("/lobby");
    },
    onError: (err) => {
      // Show user-friendly error messages
      const msg = err.message;
      if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
        alert(locale.startsWith("zh") ? "用户不存在，请检查昵称" : "User not found, please check your nickname");
      } else if (msg.includes("not set up") || msg.includes("BAD_REQUEST")) {
        alert(locale.startsWith("zh") ? "该账号未设置备用密码" : "This account has no backup password set");
      } else if (msg.includes("Incorrect") || msg.includes("UNAUTHORIZED")) {
        alert(locale.startsWith("zh") ? "密码错误" : "Incorrect password");
      } else {
        alert(msg);
      }
    },
  });

  // Use ref to ensure deep link is only processed once per session
  const deepLinkHandled = useRef(false);

  // tRPC mutation for referral registration
  const registerMutation = trpc.agent.register.useMutation({
    onSuccess: () => {
      console.log("[DeepLink] Referral registration successful");
      localStorage.removeItem(PENDING_REF_KEY);
    },
    onError: (error: any) => {
      console.error("[DeepLink] Referral registration failed:", error);
      localStorage.removeItem(PENDING_REF_KEY);
    },
  });

  // Step 1: On first load, capture the start_param into localStorage BEFORE auth
  // This ensures we don't lose the param during the auth redirect flow
  useEffect(() => {
    // Read from multiple sources in priority order
    const captureRefCode = () => {
      // 1. TG SDK start_param (most reliable when SDK is ready)
      const sdkParam = (window.Telegram?.WebApp as any)?.initDataUnsafe?.start_param;
      // 2. URL hash fragment (web_app button injects #tgWebAppStartParam=xxx)
      const hash = window.location.hash;
      const hashParams = hash ? new URLSearchParams(hash.replace(/^#/, "")) : null;
      const hashParam = hashParams?.get("tgWebAppStartParam") || hashParams?.get("startapp");
      // 3. URL query params
      const queryParams = new URLSearchParams(window.location.search);
      const queryParam = queryParams.get("startapp") || queryParams.get("tgWebAppStartParam");

      const startParam = sdkParam || hashParam || queryParam;
      if (startParam && startParam.startsWith("ref_")) {
        const refCode = startParam.replace("ref_", "");
        if (refCode) {
          console.log("[DeepLink] Saving pending ref code:", refCode, "(source:", sdkParam ? "sdk" : hashParam ? "hash" : "query", ")");
          localStorage.setItem(PENDING_REF_KEY, refCode);
        }
      }
    };

    // Run immediately
    captureRefCode();
    // Also run after a short delay to catch late TG SDK initialization
    const timer = setTimeout(captureRefCode, 500);
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // Step 2: Auto-authenticate in Telegram Mini App
  useEffect(() => {
    if (!isTgApp) return;
    if (tgLoginAttempted) return;
    if (isAuthenticated) return;

    setTgLoginAttempted(true);
    autoAuthenticate().then((result) => {
      if (result?.success) {
        setTgLoginSuccess(true);
        localStorage.setItem("vera_auth_method", "telegram");
        // Apply TG language on every login unless user has manually set a preference.
        // We use applyLocale (not setLocale) so we don't overwrite a manual choice,
        // but we DO re-detect every time so new users always get their TG language.
        const manualLocale = localStorage.getItem("vera-locale");
        if (!manualLocale) {
          // No manual preference: always re-detect (picks up TG language_code)
          const detectedLocale = detectLocale();
          applyLocale(detectedLocale);
        }
        refresh();
      }
    });
  }, [isTgApp, tgLoginAttempted, isAuthenticated, autoAuthenticate, refresh]);

  // Step 3: After authenticated, handle deep link navigation
  useEffect(() => {
    if (!isAuthenticated || loading) return;
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;

    // Wait 600ms to ensure Step 1's delayed capture (500ms) has completed
    const handleDeepLink = () => {
      const startParam = getTelegramStartParam();

      // Handle room deep link
      if (startParam && startParam.startsWith("room_")) {
        const inviteCode = startParam.replace("room_", "");
        fetch(`/api/trpc/rooms.resolveInviteCode?input=${encodeURIComponent(JSON.stringify({ inviteCode }))}`)
          .then(r => r.json())
          .then(data => {
            const room = data?.result?.data;
            navigate(room?.id ? `/table/${room.id}` : "/lobby");
          })
          .catch(() => navigate("/lobby"));
        return;
      }

      // Handle pending referral code (saved before auth)
      const pendingRefCode = localStorage.getItem(PENDING_REF_KEY);
      if (pendingRefCode) {
        console.log("[DeepLink] Processing pending ref code:", pendingRefCode);
        registerMutation.mutate({ inviteCode: pendingRefCode });
      }

      // Always navigate to lobby
      navigate("/lobby");
    };

    const timer = setTimeout(handleDeepLink, 600);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Telegram Login Widget callback
  const handleTelegramLogin = useCallback(async (widgetData: Record<string, unknown>) => {
    if (widgetData.success === true) {
      setTgLoginSuccess(true);
      localStorage.setItem("vera_auth_method", "telegram");
      refresh();
      return;
    }
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
          <TelegramLoginButton onLogin={handleTelegramLogin} />
          {!isTgApp && (
            <button
              onClick={() => (window.location.href = getLoginUrl())}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm glow-gold hover:opacity-90 transition-opacity active:scale-[0.97] flex items-center justify-center gap-2"
            >
              {t("common.login")} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Password Login Link */}
        {!isTgApp && (
          <div className="mt-2 text-center">
            <button
              onClick={() => setShowPasswordLogin(!showPasswordLogin)}
              className="text-xs text-muted-foreground hover:text-gold/70 transition-colors flex items-center gap-1 mx-auto"
            >
              <Lock className="w-3 h-3" />
              {locale.startsWith("zh") ? "备用密码登录" : "Login with backup password"}
            </button>
          </div>
        )}

        {/* Password Login Form */}
        {showPasswordLogin && (
          <div className="w-full max-w-xs mt-3 glass rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              {locale.startsWith("zh") ? "输入昵称和备用密码登录" : "Enter your nickname and backup password"}
            </p>
            <input
              type="text"
              value={pwdIdentifier}
              onChange={(e) => setPwdIdentifier(e.target.value)}
              placeholder={locale.startsWith("zh") ? "昵称 / TG用户名" : "Nickname / TG username"}
              className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={pwdPassword}
                onChange={(e) => setPwdPassword(e.target.value)}
                placeholder={locale.startsWith("zh") ? "备用密码" : "Backup password"}
                className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold pr-10"
              />
              <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={() => {
                if (!pwdIdentifier || !pwdPassword) return;
                passwordLoginMutation.mutate({ identifier: pwdIdentifier, password: pwdPassword });
              }}
              disabled={passwordLoginMutation.isPending || !pwdIdentifier || !pwdPassword}
              className="w-full py-2.5 rounded-lg bg-gold/20 text-gold text-sm font-medium hover:bg-gold/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {passwordLoginMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Lock className="w-4 h-4" />}
              {locale.startsWith("zh") ? "登录" : "Login"}
            </button>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-sm">
          {[
            { icon: Shield, title: t("home.feature1Title"), desc: t("home.feature1Desc"), color: "text-truth-blue" },
            { icon: Zap, title: t("home.feature2Title"), desc: t("home.feature2Desc"), color: "text-gold" },
            { icon: Globe, title: t("home.feature3Title"), desc: t("home.feature3Desc"), color: "text-success" },
            { icon: Users, title: t("home.feature4Title"), desc: t("home.feature4Desc"), color: "text-purple-400" },
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

  if (isTelegramMiniApp()) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    try {
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

async function openTelegramLogin(_botIdOrUsername: string, onLogin: (data: Record<string, unknown>) => void) {
  try {
    const res = await fetch(`/api/telegram/oidc-start?origin=${encodeURIComponent(window.location.origin)}`, {
      credentials: "include",
    });
    const json = await res.json();

    if (!res.ok || !json.authUrl) {
      console.error("[TG Login] OIDC start failed:", json.error);
      window.location.href = getLoginUrl();
      return;
    }

    const authUrl = json.authUrl;
    const width = 550;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "telegram_login",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      console.error("[TG Login] Popup blocked");
      window.location.href = getLoginUrl();
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "telegram_login_success") {
        window.removeEventListener("message", handleMessage);
        popup?.close();
        onLogin(event.data.data || { success: true });
      }
    };

    window.addEventListener("message", handleMessage);
    setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      popup?.close();
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("[TG Login] Error:", error);
    window.location.href = getLoginUrl();
  }
}
