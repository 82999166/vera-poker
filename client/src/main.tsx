import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// === Telegram Mini App early initialization ===
// Call ready() + expand() before React renders to maximize viewport immediately
(function initTelegramApp() {
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    // Try to request fullscreen (Bot API 8.0+) for maximum viewport
    // Only available in version 8.0+, skip for older versions to avoid console errors
    const version = parseFloat(tg.version || '0');
    if (version >= 8.0 && typeof tg.requestFullscreen === 'function') {
      try { tg.requestFullscreen(); } catch (_) {}
    }
    // Disable vertical swipe to close (keeps app open)
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }
    // Set background color to match app theme, reducing visual gap
    if (typeof tg.setHeaderColor === 'function') {
      tg.setHeaderColor('#1a1a2e');
    }
    if (typeof tg.setBackgroundColor === 'function') {
      tg.setBackgroundColor('#1a1a2e');
    }
  }
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnReconnect: "always",
      refetchOnWindowFocus: "always",
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  // Device exclusivity: show modal instead of redirect
  if (error.message === "SESSION_EXPIRED_OTHER_DEVICE") {
    window.dispatchEvent(new CustomEvent("session-expired-other-device"));
    return;
  }

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Admin pages have their own staff login system, skip OAuth redirect
  if (window.location.pathname.startsWith("/admin") || window.location.pathname === "/staff-login") {
    return;
  }

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
