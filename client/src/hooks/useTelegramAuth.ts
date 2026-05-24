import { useCallback, useEffect, useRef, useState } from "react";

// Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        platform: string;
        version: string;
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export interface TelegramAuthResult {
  success: boolean;
  user?: {
    id: number;
    name: string;
    tgUsername: string | null;
    avatar: string | null;
  };
  error?: string;
}

/**
 * Check if we're running inside Telegram Mini App
 */
export function isTelegramMiniApp(): boolean {
  return !!(
    window.Telegram?.WebApp?.initData &&
    window.Telegram.WebApp.initData.length > 0
  );
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

/**
 * Get start_param from Telegram Mini App deep link or URL query
 * e.g. /start room_XXXXX -> startapp=room_XXXXX
 */
export function getTelegramStartParam(): string | null {
  // Try Telegram WebApp start_param first
  const webapp = getTelegramWebApp();
  if (webapp && (webapp as any).initDataUnsafe?.start_param) {
    return (webapp as any).initDataUnsafe.start_param;
  }
  // Fallback: check URL query params (for web_app_data links)
  const params = new URLSearchParams(window.location.search);
  return params.get("startapp") || params.get("tgWebAppStartParam") || null;
}

/**
 * Hook for Telegram authentication
 * Handles Mini App auto-login and Login Widget authentication
 */
export function useTelegramAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  /**
   * Authenticate using Mini App initData
   */
  const authenticateWithInitData = useCallback(async (): Promise<TelegramAuthResult> => {
    const webapp = getTelegramWebApp();
    if (!webapp || !webapp.initData) {
      return { success: false, error: "Not in Telegram Mini App" };
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/telegram/auth/webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ initData: webapp.initData }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticating(false);
        return { success: true, user: data.user };
      } else {
        const errorMsg = data.error || "Authentication failed";
        setAuthError(errorMsg);
        setIsAuthenticating(false);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      setAuthError(errorMsg);
      setIsAuthenticating(false);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Authenticate using Login Widget data
   */
  const authenticateWithWidget = useCallback(async (widgetData: Record<string, unknown>): Promise<TelegramAuthResult> => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/telegram/auth/widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(widgetData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticating(false);
        return { success: true, user: data.user };
      } else {
        const errorMsg = data.error || "Authentication failed";
        setAuthError(errorMsg);
        setIsAuthenticating(false);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      setAuthError(errorMsg);
      setIsAuthenticating(false);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Auto-authenticate if in Telegram Mini App (runs once)
   */
  const autoAuthenticate = useCallback(async () => {
    if (attemptedRef.current) return null;
    if (!isTelegramMiniApp()) return null;

    attemptedRef.current = true;
    const webapp = getTelegramWebApp();
    if (webapp) {
      webapp.ready();
      webapp.expand();
      // Disable vertical swipes to prevent accidental close
      if (typeof (webapp as any).disableVerticalSwipes === 'function') {
        (webapp as any).disableVerticalSwipes();
      }
      // Set header color to match app background
      if (typeof (webapp as any).setHeaderColor === 'function') {
        (webapp as any).setHeaderColor('#1a1a2e');
      }
      if (typeof (webapp as any).setBackgroundColor === 'function') {
        (webapp as any).setBackgroundColor('#1a1a2e');
      }
      // Note: Do NOT call requestFullscreen() - it causes content to be hidden behind TG header on older devices
    }

    return authenticateWithInitData();
  }, [authenticateWithInitData]);

  return {
    isTelegramMiniApp: isTelegramMiniApp(),
    isAuthenticating,
    authError,
    authenticateWithInitData,
    authenticateWithWidget,
    autoAuthenticate,
  };
}
