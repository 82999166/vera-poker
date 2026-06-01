import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n, detectLocale, applyLocale } from "@/lib/i18n";
import { useEffect } from "react";
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
  // This handles the case where the user is already authenticated (session cookie valid)
  // and Home.tsx Step 2 is skipped. Also handles late TG SDK initialization.
  useEffect(() => {
    const syncTgLanguage = () => {
      // Don't override if user has manually set a language preference
      const manualLocale = localStorage.getItem("vera-locale");
      if (manualLocale) return;
      // Only run in TG Mini App environment
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.initDataUnsafe?.user?.language_code) return;
      // Re-detect locale (will pick up TG language_code)
      const detected = detectLocale();
      if (detected !== locale) {
        applyLocale(detected);
      }
    };
    // Run immediately
    syncTgLanguage();
    // Also retry after a short delay in case TG SDK initializes late
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
    // Full-screen layout for game table - no max-width, no overflow-hidden wrapper
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
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
