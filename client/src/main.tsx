import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// === iOS Telegram Mini App viewport fix ===
// Telegram's iOS WebView has a known issue where env(safe-area-inset-*) doesn't work
// and the page can have a gap at the top. This fix:
// 1. Locks body height to visualViewport to prevent iOS WebView quirks
// 2. Prevents overscroll that causes the gap
// 3. Calls Telegram WebApp.expand() early to maximize the viewport
(function initTelegramViewportFix() {
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    // Expand immediately before React renders
    tg.ready();
    tg.expand();
  }

  // Fix iOS visual viewport height
  if (window.visualViewport) {
    const updateHeight = () => {
      const vh = window.visualViewport!.height;
      document.documentElement.style.height = vh + 'px';
      document.body.style.height = vh + 'px';
    };
    window.visualViewport.addEventListener('resize', updateHeight);
    window.visualViewport.addEventListener('scroll', updateHeight);
    updateHeight();
  }

  // Prevent overscroll that causes the top gap on iOS
  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  }, { passive: false });

  // Prevent touchmove on body to avoid rubber-banding
  document.addEventListener('touchmove', (e) => {
    // Allow scrolling inside scrollable containers
    let target = e.target as HTMLElement | null;
    while (target && target !== document.body) {
      const style = window.getComputedStyle(target);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        // Check if actually scrollable
        if (target.scrollHeight > target.clientHeight) {
          return; // Allow scroll inside this element
        }
      }
      target = target.parentElement;
    }
    // Prevent body scroll (rubber-banding)
    if (e.touches.length === 1) {
      e.preventDefault();
    }
  }, { passive: false });
})();

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // In Telegram Mini App, don't redirect to Manus OAuth
  // The TG auth flow is handled by useTelegramAuth hook
  const isTgMiniApp = !!(window as any).Telegram?.WebApp?.initData;
  if (isTgMiniApp) {
    console.log("[Auth] In Telegram Mini App, skipping OAuth redirect");
    return;
  }

  // If user previously logged in via Telegram (stored flag), redirect to home
  // so the TG login button is shown instead of Manus OAuth
  const wasTgUser = localStorage.getItem("vera_auth_method") === "telegram";
  if (wasTgUser) {
    // Clear the flag to avoid infinite redirect loops
    // Navigate to home page where TG login button is available
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
    return;
  }

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
