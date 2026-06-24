/** Home Page - App entry, Telegram auth, quick start */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { getLoginUrl } from "@/const";
import { useTelegramAuth, isTelegramMiniApp, getTelegramStartParam } from "@/hooks/useTelegramAuth";
import { trpc } from "@/lib/trpc";
import { useI18n, detectLocale, applyLocale } from "@/lib/i18n";
import { Shield, Zap, Trophy, Users, ArrowRight, Loader2, Lock, Eye, EyeOff } from "lucide-react";

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

  // Splash screen: show for ALL users on first load (minimum 5.5s)
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const splashTimerRef = useRef(false);
  useEffect(() => {
    if (splashTimerRef.current) return;
    splashTimerRef.current = true;
    // Start fade-out at 5s
    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
    }, 5000);
    // Fully hide at 5.5s (after 500ms fade)
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 5500);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  // Password login state
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [pwdIdentifier, setPwdIdentifier] = useState("");
  const [pwdPassword, setPwdPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const passwordLoginMutation = trpc.auth.passwordLogin.useMutation({
    onSuccess: () => {
      // Login always succeeds directly now (old device gets kicked via sessionVersion)
      refresh();
      navigate("/lobby");
    },
    onError: (err) => {
      const msg = err.message;
      if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
        alert("User not found, please check your nickname");
      } else if (msg.includes("not set up") || msg.includes("BAD_REQUEST")) {
        alert("This account has no backup password set");
      } else if (msg.includes("Incorrect") || msg.includes("UNAUTHORIZED")) {
        alert("Incorrect password");
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
  useEffect(() => {
    const captureRefCode = () => {
      const sdkParam = (window.Telegram?.WebApp as any)?.initDataUnsafe?.start_param;
      const hash = window.location.hash;
      const hashParams = hash ? new URLSearchParams(hash.replace(/^#/, "")) : null;
      const hashParam = hashParams?.get("tgWebAppStartParam") || hashParams?.get("startapp");
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

    captureRefCode();
    const timer = setTimeout(captureRefCode, 500);
    return () => clearTimeout(timer);
  }, []);

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
        const backendLang = (result as any).user?.language;
        if (backendLang) {
          const langMap: Record<string, string> = {
            "en": "en", "zh": "zh-CN", "zh-cn": "zh-CN", "zh-tw": "zh-TW",
            "zh-hans": "zh-CN", "zh-hant": "zh-TW",
            "ja": "ja", "ko": "ko", "es": "es", "pt": "pt", "ru": "ru",
            "ar": "ar", "vi": "vi", "th": "th", "id": "id",
          };
          const normalized = backendLang.toLowerCase();
          const mapped = langMap[normalized] || langMap[normalized.split("-")[0]] || "en";
          applyLocale(mapped as any);
        } else {
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

    const handleDeepLink = () => {
      const startParam = getTelegramStartParam();

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

      // Red packet deep link: hongbao_123
      if (startParam && startParam.startsWith("hongbao_")) {
        const rpId = startParam.replace("hongbao_", "");
        navigate(`/red-packet/${rpId}`);
        return;
      }

      const pendingRefCode = localStorage.getItem(PENDING_REF_KEY);
      if (pendingRefCode) {
        console.log("[DeepLink] Processing pending ref code:", pendingRefCode);
        registerMutation.mutate({ inviteCode: pendingRefCode });
      }

      navigate("/lobby");
    };

    const timer = setTimeout(handleDeepLink, 2000);
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

  // Show animated splash screen for ALL users on first load (minimum 2.5s)
  // Also show during TG auth if splash timer already expired
  const shouldShowSplash = showSplash || (isTgApp && (isAuthenticating || (tgLoginSuccess && loading)));
  if (shouldShowSplash) {
    return (
      <div className={`absolute inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${splashFading ? 'opacity-0' : 'opacity-100'}`} style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 50%, #050510 100%)' }}>
        {/* Card dealing sound effect */}
        <audio autoPlay src="/manus-storage/card-deal-sound_bfa59586.mp3" style={{ display: 'none' }} />
        {/* Poker table felt glow in background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[180px] rounded-[50%] animate-splash-table" style={{ background: 'radial-gradient(ellipse, rgba(34,139,34,0.12) 0%, transparent 70%)', border: '1px solid rgba(34,139,34,0.08)' }} />

        {/* Flying poker cards - left side */}
        <div className="absolute top-[18%] left-[8%] animate-splash-card-left" style={{ '--card-delay': '0.3s', '--card-end-rotate': '-12deg' } as React.CSSProperties}>
          <div className="w-10 h-14 rounded-md bg-white shadow-lg flex items-center justify-center text-lg font-bold text-red-600 border border-gray-200">
            <span>A<span className="text-xs">♥</span></span>
          </div>
        </div>
        <div className="absolute top-[30%] left-[5%] animate-splash-card-left" style={{ '--card-delay': '0.5s', '--card-end-rotate': '-18deg' } as React.CSSProperties}>
          <div className="w-10 h-14 rounded-md bg-white shadow-lg flex items-center justify-center text-lg font-bold text-gray-900 border border-gray-200">
            <span>K<span className="text-xs">♠</span></span>
          </div>
        </div>

        {/* Flying poker cards - right side */}
        <div className="absolute top-[18%] right-[8%] animate-splash-card-right" style={{ '--card-delay': '0.4s', '--card-end-rotate': '10deg' } as React.CSSProperties}>
          <div className="w-10 h-14 rounded-md bg-white shadow-lg flex items-center justify-center text-lg font-bold text-red-600 border border-gray-200">
            <span>A<span className="text-xs">♦</span></span>
          </div>
        </div>
        <div className="absolute top-[32%] right-[6%] animate-splash-card-right" style={{ '--card-delay': '0.6s', '--card-end-rotate': '15deg' } as React.CSSProperties}>
          <div className="w-10 h-14 rounded-md bg-white shadow-lg flex items-center justify-center text-lg font-bold text-gray-900 border border-gray-200">
            <span>Q<span className="text-xs">♣</span></span>
          </div>
        </div>

        {/* Community cards - Royal Flush A K Q J 10 all spades ♠ */}
        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 flex gap-2">
          {[{ v: 'A', dx: '-52px', r: '-3deg', d: '0.8s' },
            { v: 'K', dx: '-26px', r: '-1deg', d: '1.0s' },
            { v: 'Q', dx: '0px', r: '0deg', d: '1.2s' },
            { v: 'J', dx: '26px', r: '2deg', d: '1.4s' },
            { v: '10', dx: '52px', r: '3deg', d: '1.6s' },
          ].map((card, i) => (
            <div key={i} className="animate-splash-deal" style={{ '--deal-x': card.dx, '--deal-y': '0px', '--deal-rotate': card.r, '--deal-delay': card.d } as React.CSSProperties}>
              <div className="w-10 h-14 rounded-md bg-white shadow-lg flex flex-col items-center justify-center border border-gray-200">
                <span className="text-sm font-black text-gray-900 leading-none">{card.v}</span>
                <span className="text-[10px] text-gray-900 leading-none">♠</span>
              </div>
            </div>
          ))}
        </div>

        {/* Poker chips bouncing in */}
        <div className="absolute bottom-[22%] left-[15%] animate-splash-chip" style={{ '--chip-delay': '0.7s' } as React.CSSProperties}>
          <div className="w-8 h-8 rounded-full border-[3px] border-dashed border-red-500 bg-red-600 flex items-center justify-center shadow-lg">
            <span className="text-[8px] font-black text-white">50</span>
          </div>
        </div>
        <div className="absolute bottom-[20%] right-[18%] animate-splash-chip" style={{ '--chip-delay': '0.9s' } as React.CSSProperties}>
          <div className="w-8 h-8 rounded-full border-[3px] border-dashed border-blue-400 bg-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-[8px] font-black text-white">100</span>
          </div>
        </div>
        <div className="absolute bottom-[26%] left-[40%] animate-splash-chip" style={{ '--chip-delay': '1.1s' } as React.CSSProperties}>
          <div className="w-7 h-7 rounded-full border-[3px] border-dashed border-gold bg-yellow-600 flex items-center justify-center shadow-lg">
            <span className="text-[7px] font-black text-white">500</span>
          </div>
        </div>

        {/* Sparkle effects on cards */}
        <div className="absolute top-[16%] left-[12%] w-1.5 h-1.5 rounded-full bg-gold animate-splash-sparkle" style={{ '--sparkle-delay': '1s' } as React.CSSProperties} />
        <div className="absolute top-[20%] right-[11%] w-1 h-1 rounded-full bg-white animate-splash-sparkle" style={{ '--sparkle-delay': '1.5s' } as React.CSSProperties} />
        <div className="absolute bottom-[28%] right-[20%] w-1.5 h-1.5 rounded-full bg-truth-blue animate-splash-sparkle" style={{ '--sparkle-delay': '2s' } as React.CSSProperties} />

        {/* Main content - Logo + Brand */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo with glow animation */}
          <div className="animate-splash-logo rounded-2xl">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eab308 0%, #a78b00 50%, #2563eb 100%)' }}>
              <span className="text-4xl font-black text-background tracking-tight">VP</span>
            </div>
          </div>

          {/* Brand name */}
          <h1 className="mt-5 text-3xl font-black animate-splash-title">
            <span className="text-gold">Vera</span>{" "}
            <span className="text-foreground">Poker</span>
          </h1>

          {/* Tagline */}
          <p className="mt-1.5 text-sm text-muted-foreground italic animate-splash-tagline">
            "Where Truth Deals."
          </p>
        </div>

        {/* Bottom section - progress + connection */}
        <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 flex flex-col items-center w-full px-12">
          {/* Progress bar */}
          <div className="w-full max-w-[200px] h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold via-gold/80 to-truth-blue animate-splash-progress" />
          </div>

          {/* Encrypted connection status */}
          <div className="mt-4 flex items-center gap-2 animate-splash-connect">
            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[11px] text-green-400/80">正在建立加密连接...</span>
          </div>

          {/* Version */}
          <div className="mt-2">
            <span className="text-[10px] text-muted-foreground/40">Vera Poker v2.0</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 safe-top text-center">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl glow-gold" style={{ background: 'linear-gradient(to bottom right, #eab308, #a78b00, #2563eb)' }}>
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
          Play Texas Hold'em on the world's first provably fair poker platform.
          Every hand is verifiable on-chain. No hidden decks, no rigged deals.
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
              className="px-8 py-3.5 rounded-xl text-background font-bold text-sm glow-gold hover:opacity-90 transition-opacity active:scale-[0.97] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to right, #eab308, #a78b00)' }}
            >
              Enter Game <ArrowRight className="w-4 h-4" />
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
              Login with backup password
            </button>
          </div>
        )}

        {/* Password Login Form */}
        {showPasswordLogin && (
          <div className="w-full max-w-xs mt-3 glass rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Enter your nickname and backup password
            </p>
            <input
              type="text"
              value={pwdIdentifier}
              onChange={(e) => setPwdIdentifier(e.target.value)}
              placeholder="Nickname / TG username"
              className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={pwdPassword}
                onChange={(e) => setPwdPassword(e.target.value)}
                placeholder="Backup password"
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
              Login
            </button>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-sm">
          {[
            { icon: Shield, title: "Provably Fair", desc: "On-chain verified deals", color: "text-truth-blue" },
            { icon: Zap, title: "Instant Play", desc: "No download required", color: "text-gold" },
            { icon: Trophy, title: "Tournaments", desc: "Compete for prizes", color: "text-success" },
            { icon: Users, title: "Private Tables", desc: "Invite friends to play", color: "text-purple-400" },
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
          Powered by TON Blockchain &bull; Vera Poker &copy; 2025
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
      {isLoading ? "Loading..." : "Login with Telegram"}
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
