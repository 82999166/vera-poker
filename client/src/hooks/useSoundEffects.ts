/**
 * Sound Effects Hook for Poker Table
 * Uses Web Audio API for low-latency sound playback
 * Uses Audio element + server-side TTS proxy for voice announcements (Android WebView compatible)
 */
import { useCallback, useRef, useEffect } from "react";

// Sound effect types
export type SoundEffect =
  | "deal"        // 发牌
  | "bet"         // 下注/加注
  | "check"       // 过牌
  | "fold"        // 弃牌
  | "call"        // 跟注
  | "allIn"       // 全下
  | "win"         // 赢牌
  | "lose"        // 输牌
  | "timer"       // 倒计时警告
  | "turnAlert"   // 轮到操作
  | "chipMove"    // 筹码移动
  | "cardFlip";   // 翻牌

// Synthesize sounds using Web Audio API (no external files needed)
function createOscillatorSound(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.3
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function createNoiseSound(ctx: AudioContext, duration: number, volume: number = 0.1): void {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  source.start();
}

// Sound synthesis functions
const soundGenerators: Record<SoundEffect, (ctx: AudioContext) => void> = {
  deal: (ctx) => {
    createNoiseSound(ctx, 0.08, 0.15);
    createOscillatorSound(ctx, 2000, 0.05, "square", 0.05);
  },
  bet: (ctx) => {
    createOscillatorSound(ctx, 800, 0.06, "triangle", 0.2);
    setTimeout(() => createOscillatorSound(ctx, 1000, 0.04, "triangle", 0.15), 30);
    setTimeout(() => createOscillatorSound(ctx, 900, 0.05, "triangle", 0.1), 60);
  },
  check: (ctx) => {
    createOscillatorSound(ctx, 600, 0.08, "sine", 0.15);
  },
  fold: (ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  },
  call: (ctx) => {
    createOscillatorSound(ctx, 700, 0.06, "triangle", 0.15);
    setTimeout(() => createOscillatorSound(ctx, 850, 0.04, "triangle", 0.1), 40);
  },
  allIn: (ctx) => {
    createOscillatorSound(ctx, 400, 0.1, "sawtooth", 0.1);
    setTimeout(() => createOscillatorSound(ctx, 600, 0.1, "sawtooth", 0.12), 80);
    setTimeout(() => createOscillatorSound(ctx, 800, 0.15, "sawtooth", 0.15), 160);
    setTimeout(() => createNoiseSound(ctx, 0.2, 0.1), 240);
  },
  win: (ctx) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.2, "sine", 0.2), i * 100);
    });
  },
  lose: (ctx) => {
    const notes = [523, 440, 349, 262];
    notes.forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.25, "sine", 0.15), i * 120);
    });
  },
  timer: (ctx) => {
    createOscillatorSound(ctx, 1200, 0.1, "square", 0.15);
  },
  turnAlert: (ctx) => {
    createOscillatorSound(ctx, 880, 0.1, "sine", 0.2);
    setTimeout(() => createOscillatorSound(ctx, 880, 0.1, "sine", 0.2), 150);
  },
  chipMove: (ctx) => {
    createNoiseSound(ctx, 0.05, 0.08);
    createOscillatorSound(ctx, 1500, 0.03, "triangle", 0.05);
  },
  cardFlip: (ctx) => {
    createNoiseSound(ctx, 0.06, 0.12);
    createOscillatorSound(ctx, 3000, 0.03, "sine", 0.03);
  },
};

/**
 * TTS via server-side proxy using Audio element
 * This works on ALL platforms including Android WebView / Telegram Mini App
 * because it uses standard HTML5 Audio which is universally supported.
 */
function playTTS(text: string, volume: number = 0.7): void {
  try {
    const url = `/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(url);
    audio.volume = volume;
    // Play with error handling
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // If autoplay blocked, try speechSynthesis as fallback (works on iOS/desktop)
        fallbackSpeechSynthesis(text, volume);
      });
    }
  } catch {
    fallbackSpeechSynthesis(text, volume);
  }
}

/**
 * Fallback: use Web Speech API for platforms that support it (iOS, desktop browsers)
 */
function fallbackSpeechSynthesis(text: string, volume: number = 0.7): void {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.volume = volume;
    utterance.lang = "zh-CN";
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith("zh-CN"))
      || voices.find(v => v.lang.startsWith("zh"));
    if (zhVoice) {
      utterance.voice = zhVoice;
      utterance.lang = zhVoice.lang;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Silently fail
  }
}

// Audio element pool for pre-warming (Android requires user gesture to unlock audio)
let audioUnlocked = false;

function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Create a silent audio context to unlock audio playback on mobile
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (ctx.state === "suspended") ctx.resume();
    // Also unlock HTML5 Audio
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.volume = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore
  }
}

export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(
    localStorage.getItem("vera-sound-enabled") !== "false"
  );
  const volumeRef = useRef<number>(
    parseFloat(localStorage.getItem("vera-sound-volume") || "0.7")
  );

  // Initialize AudioContext
  const ensureContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Unlock audio on first user interaction (required for mobile)
  useEffect(() => {
    const activate = () => {
      ensureContext();
      unlockAudio();
      document.removeEventListener("touchstart", activate);
      document.removeEventListener("click", activate);
      document.removeEventListener("pointerdown", activate);
    };
    document.addEventListener("touchstart", activate, { once: true });
    document.addEventListener("click", activate, { once: true });
    document.addEventListener("pointerdown", activate, { once: true });
    return () => {
      document.removeEventListener("touchstart", activate);
      document.removeEventListener("click", activate);
      document.removeEventListener("pointerdown", activate);
    };
  }, [ensureContext]);

  // Play a sound effect
  const play = useCallback((effect: SoundEffect) => {
    if (!enabledRef.current) return;
    try {
      const ctx = ensureContext();
      soundGenerators[effect]?.(ctx);
    } catch {
      // Silently fail if audio context is not available
    }
  }, [ensureContext]);

  // Toggle sound on/off
  const toggle = useCallback(() => {
    enabledRef.current = !enabledRef.current;
    localStorage.setItem("vera-sound-enabled", String(enabledRef.current));
    return enabledRef.current;
  }, []);

  // Set volume (0-1)
  const setVolume = useCallback((vol: number) => {
    volumeRef.current = Math.max(0, Math.min(1, vol));
    localStorage.setItem("vera-sound-volume", String(volumeRef.current));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Voice announcement using server-side TTS proxy (works on Android WebView)
  const speak = useCallback((text: string) => {
    if (!enabledRef.current) return;
    playTTS(text, volumeRef.current);
  }, []);

  // Announce a poker action with amount
  const announceAction = useCallback((action: string, amount?: number, playerName?: string) => {
    if (!enabledRef.current) return;
    let text = "";
    const amountStr = amount ? `$${amount}` : "";
    const name = playerName || "";
    
    switch (action) {
      case "bet":
        text = name ? `${name} 下注 ${amountStr}` : `下注 ${amountStr}`;
        break;
      case "call":
        text = name ? `${name} 跟注 ${amountStr}` : `跟注 ${amountStr}`;
        break;
      case "raise":
        text = name ? `${name} 加注到 ${amountStr}` : `加注到 ${amountStr}`;
        break;
      case "all_in":
        text = name ? `${name} All In ${amountStr}` : `All In ${amountStr}`;
        break;
      case "fold":
        text = name ? `${name} 弃牌` : "弃牌";
        break;
      case "check":
        text = name ? `${name} 过牌` : "过牌";
        break;
      default:
        return;
    }
    speak(text);
  }, [speak]);

  return {
    play,
    speak,
    announceAction,
    toggle,
    setVolume,
    isEnabled: () => enabledRef.current,
    getVolume: () => volumeRef.current,
  };
}
