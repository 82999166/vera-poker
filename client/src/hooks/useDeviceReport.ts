import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * 每次登录后上报设备详细信息（屏幕、语言、时区、指纹等）
 * 只在用户已登录时上报一次
 */
export function useDeviceReport() {
  const { user } = useAuth();
  const reported = useRef(false);
  const reportMutation = trpc.auth.reportDeviceInfo.useMutation();

  useEffect(() => {
    if (!user || reported.current) return;
    reported.current = true;

    // 收集设备信息
    const info = {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language || "unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      platform: detectPlatform(),
      fingerprint: generateSimpleFingerprint(),
    };

    reportMutation.mutate(info);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * 检测平台类型
 */
function detectPlatform(): string {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData) return "telegram";
  return "web";
}

/**
 * 生成简单的设备指纹（基于浏览器特征）
 * 不依赖第三方库，使用可用的浏览器API
 */
function generateSimpleFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    (navigator as any).deviceMemory || 0,
    navigator.platform || "",
  ];
  
  // Simple hash
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36) + "_" + str.length.toString(36);
}
