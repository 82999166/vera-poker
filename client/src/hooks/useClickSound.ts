/**
 * 全局按钮点击音效
 * 在 document 级别监听事件，当用户点击按钮/链接/交互元素时播放微妙点击声
 * 使用 Web Audio API 实现零延迟播放
 */
import { useEffect, useRef } from "react";

// Singleton AudioContext shared across the app
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === "suspended") {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function playClickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Check if sound is globally disabled
  if (localStorage.getItem("vera-sound-enabled") === "false") return;

  const volume = parseFloat(localStorage.getItem("vera-sound-volume") || "0.7") * 0.4;

  // Short, subtle click: high-frequency burst + tiny noise
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.03);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

/**
 * Determines if an element or its ancestors (up to 3 levels) is an interactive element
 */
function isInteractiveElement(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && depth < 4) {
    const tag = current.tagName?.toLowerCase();
    if (
      tag === "button" ||
      tag === "a" ||
      current.getAttribute("role") === "button" ||
      current.getAttribute("role") === "tab" ||
      current.getAttribute("role") === "menuitem" ||
      current.classList?.contains("cursor-pointer") ||
      current.hasAttribute("data-click-sound")
    ) {
      return true;
    }
    // Skip if explicitly marked as no-sound
    if (current.hasAttribute("data-no-click-sound")) return false;
    current = current.parentElement;
    depth++;
  }
  return false;
}

/**
 * Hook to enable global click sound.
 * Call once in App.tsx or a top-level provider.
 */
export function useClickSound(): void {
  const lastClickTime = useRef(0);

  useEffect(() => {
    const handler = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !isInteractiveElement(target)) return;

      // Debounce: prevent double-fire from rapid clicks
      const now = Date.now();
      if (now - lastClickTime.current < 80) return;
      lastClickTime.current = now;

      playClickSound();
    };

    // Use pointerdown for immediate feedback (before click event)
    document.addEventListener("pointerdown", handler, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handler);
    };
  }, []);
}
