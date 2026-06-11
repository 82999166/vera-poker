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
import HandHistory from "./pages/HandHistory";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import StaffLogin from "./pages/StaffLogin";
import Tutorial from "./pages/Tutorial";
import ReplayList from "./pages/ReplayList";
import ReplayPlayer from "./pages/ReplayPlayer";
import { useClickSound } from "./hooks/useClickSound";
import { trpc } from "./lib/trpc";

/** 换设备登录提示弹窗 */
function NewDeviceAlert() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const clearCookieMutation = trpc.auth.clearNewDeviceCookie.useMutation();

  useEffect(() => {
    if (checked) return;
    const user = meQuery.data as any;
    if (user && user.newDeviceLogin) {
      setShow(true);
      setChecked(true);
      clearCookieMutation.mutate();
    } else if (user && !user.newDeviceLogin) {
      setChecked(true);
    }
  }, [meQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 mx-4 max-w-xs w-full shadow-2xl">
        <h3 className="text-white font-bold text-center text-base mb-3">提示</h3>
        <p className="text-white/80 text-sm text-center leading-relaxed mb-5">
          您的账号在另一台设备上登录。<br />如非本人操作请联系客服处理！
        </p>
        <button
          onClick={() => setShow(false)}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
        >
          确定
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
      <Route path="/history/:id" component={HandHistory} />
      <Route path="/profile" component={Profile} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/tutorial" component={Tutorial} />
      <Route path="/replay" component={ReplayList} />
      <Route path="/replay/:id" component={ReplayPlayer} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-screen bg-deep-space flex justify-center overflow-x-hidden">
      <div className="w-full max-w-[430px] h-full min-h-screen relative shadow-2xl overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}

function AppContent() {
  const { locale } = useI18n();

  // Global TG language sync: ensure TG Mini App users always see their language.
  useEffect(() => {
    const syncTgLanguage = () => {
      const manualLocale = localStorage.getItem("vera-locale");
      if (manualLocale) return;
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.initDataUnsafe?.user?.language_code) return;
      const detected = detectLocale();
      if (detected !== locale) {
        applyLocale(detected);
      }
    };
    syncTgLanguage();
    const timer = setTimeout(syncTgLanguage, 300);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Staff login and Admin use full-screen layout
  const isStaffLogin = window.location.pathname === "/staff-login";
  const isAdmin = window.location.pathname.startsWith("/admin");
  // Table page uses full-screen layout (no max-width container)
  const isTable = window.location.pathname.startsWith("/table/");

  if (isStaffLogin) {
    return <StaffLogin key={locale} />;
  }

  if (isAdmin) {
    return <Admin key={locale} />;
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
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
