import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Admin from "./pages/Admin";

function Router() {
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
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep-space flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen relative shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <MobileContainer>
            <Router />
          </MobileContainer>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
