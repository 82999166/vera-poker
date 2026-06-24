import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n, detectLocale, applyLocale } from "@/lib/i18n";
import { useEffect, useState } from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Table from "./pages/Table";
import Wallet from "./pages/Wallet";
import Agent from "./pages/Agent";
import Support from "./pages/Support";
import CreateRoom from "./pages/CreateRoom";
import Verify from "./pages/Verify";
import VerifyLogin from "./pages/VerifyLogin";
import HandHistory from "./pages/HandHistory";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import StaffLogin from "./pages/StaffLogin";
import Tutorial from "./pages/Tutorial";
import ReplayList from "./pages/ReplayList";
import ReplayPlayer from "./pages/ReplayPlayer";
import RedPacket from "./pages/RedPacket";
import { useClickSound } from "./hooks/useClickSound";
import { trpc } from "./lib/trpc";

/** Old device receives new device login confirmation request */
function NewDeviceAlert() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [deviceInfo, setDeviceInfo] = useState("");

  // Poll for pending new device login requests
  const pendingQuery = trpc.auth.pendingLogin.useQuery(undefined, {
    refetchInterval: 3000,
    retry: false,
  });

  const approveMutation = trpc.auth.approveLogin.useMutation({
    onSuccess: () => {
      setShow(false);
      window.location.href = "/";
    },
  });

  const rejectMutation = trpc.auth.rejectLogin.useMutation({
    onSuccess: () => {
      setShow(false);
    },
  });

  useEffect(() => {
    if (pendingQuery.data?.hasPending && pendingQuery.data.requestId) {
      setShow(true);
      setRequestId(pendingQuery.data.requestId);
      setDeviceInfo(pendingQuery.data.deviceInfo || "Unknown Device");
    } else {
      setShow(false);
    }
  }, [pendingQuery.data]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 mx-4 max-w-xs w-full shadow-2xl">
        <h3 className="text-white font-bold text-center text-base mb-3">{t("device.newLoginTitle")}</h3>
        <p className="text-white/80 text-sm text-center leading-relaxed mb-2">
          {t("device.newLoginDesc")}
        </p>
        <p className="text-yellow-400 text-sm text-center font-medium mb-4">
          {deviceInfo}
        </p>
        <p className="text-white/60 text-xs text-center mb-5">
          {t("device.newLoginWarning")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => rejectMutation.mutate({ requestId })}
            disabled={rejectMutation.isPending}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {t("device.reject")}
          </button>
          <button
            onClick={() => approveMutation.mutate({ requestId })}
            disabled={approveMutation.isPending}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
          >
            {t("device.approve")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown on old device when session is invalidated by new device login */
function SessionExpiredAlert() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("session-expired-other-device", handler);
    return () => window.removeEventListener("session-expired-other-device", handler);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 mx-4 max-w-xs w-full shadow-2xl">
        <div className="text-5xl text-center mb-4">📱</div>
        <h3 className="text-white font-bold text-center text-base mb-3">{t("device.sessionExpiredTitle")}</h3>
        <p className="text-white/80 text-sm text-center leading-relaxed mb-5">
          {t("device.sessionExpiredDesc")}
        </p>
        <button
          onClick={() => {
            setShow(false);
            window.location.href = "/";
          }}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
        >
          {t("device.sessionExpiredBtn")}
        </button>
      </div>
    </div>
  );
}

function MobileRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/table/:id" component={Table} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/agent" component={Agent} />
      <Route path="/support" component={Support} />
      <Route path="/create-room" component={CreateRoom} />
      <Route path="/verify" component={Verify} />
      <Route path="/verify-login" component={VerifyLogin} />
      <Route path="/history/:id" component={HandHistory} />
      <Route path="/profile" component={Profile} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/tutorial" component={Tutorial} />
      <Route path="/replay" component={ReplayList} />
      <Route path="/replay/:id" component={ReplayPlayer} />
      <Route path="/red-packet/:id" component={RedPacket} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-screen bg-[#080810] flex justify-center items-start overflow-x-hidden relative">
      {/* Decorative desktop background - only visible on wider screens */}
      <div className="hidden md:block fixed inset-0 pointer-events-none overflow-hidden">
        {/* Subtle radial glow behind phone frame */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[800px] rounded-full bg-gold/[0.02] blur-[100px]" />
        {/* Decorative poker suits floating on sides */}
        <div className="absolute top-[15%] left-[8%] text-white/[0.03] text-7xl select-none">♠</div>
        <div className="absolute top-[35%] right-[10%] text-white/[0.03] text-6xl select-none">♥</div>
        <div className="absolute bottom-[25%] left-[12%] text-white/[0.03] text-5xl select-none">♦</div>
        <div className="absolute bottom-[15%] right-[8%] text-white/[0.03] text-7xl select-none">♣</div>
        <div className="absolute top-[60%] left-[5%] text-white/[0.02] text-4xl select-none rotate-12">♠</div>
        <div className="absolute top-[10%] right-[15%] text-white/[0.02] text-5xl select-none -rotate-12">♦</div>
      </div>
      {/* Phone frame with TG-style header */}
      <div className="w-full max-w-[430px] relative flex flex-col md:my-4 md:rounded-xl md:overflow-hidden md:shadow-[0_0_60px_rgba(212,160,23,0.08)] md:border md:border-white/[0.06]" style={{ minHeight: 'calc(100vh - 2rem)' }}>
        {/* TG Mini App style header bar - only on desktop */}
        <div className="hidden md:flex items-center justify-between px-4 py-2.5 bg-[#1c1c2e] border-b border-white/[0.06] shrink-0">
          <span className="text-sm text-white/90 font-medium">Vera Poker</span>
          <div className="flex items-center gap-3">
            {/* Three dots menu */}
            <button className="text-white/50 hover:text-white/80 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {/* Close button */}
            <button className="text-white/50 hover:text-white/80 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        {/* Content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { locale } = useI18n();

  // Global TG language sync: ensure TG Mini App users always see their language.
  // In TG Mini App context, TG language_code always takes priority over localStorage.
  useEffect(() => {
    const syncTgLanguage = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.initDataUnsafe?.user?.language_code) return;
      const detected = detectLocale();
      if (detected !== locale) {
        applyLocale(detected);
      }
    };
    syncTgLanguage();
    // Retry after a short delay in case TG SDK initializes late
    const timer = setTimeout(syncTgLanguage, 300);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Staff login and Admin use full-screen layout
  const isStaffLogin = window.location.pathname === "/staff-login";
  const isAdmin = window.location.pathname.startsWith("/admin");
  // Table page uses full-screen layout (no max-width container)
  const isTable = window.location.pathname.startsWith("/table/");
  // Verify login page uses full-screen layout
  const isVerifyLogin = window.location.pathname === "/verify-login";

  if (isStaffLogin) {
    return <StaffLogin key={locale} />;
  }

  if (isAdmin) {
    return <Admin key={locale} />;
  }

  if (isVerifyLogin) {
    return <MobileRouter key={locale} />;
  }

  if (isTable) {
    return (
      <div className="w-full h-full" style={{ height: '100dvh', overflow: 'hidden' }}>
        <MobileRouter key={locale} />
      </div>
    );
  }

  return (
    <MobileContainer>
      <MobileRouter key={locale} />
    </MobileContainer>
  );
}

function App() {
  useClickSound();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-center" duration={1000} />
          <NewDeviceAlert />
          <SessionExpiredAlert />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
