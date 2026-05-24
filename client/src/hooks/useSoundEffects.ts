/**
 * Sound Effects Hook for Poker Table
 * Uses Web Audio API for low-latency sound playback
 * Uses Audio element + server-side TTS proxy for voice announcements (Android WebView compatible)
 * Voice announcements follow the system language setting
 * 
 * Voice Mode:
 * - "off": No voice announcements at all
 * - "winner_only": Only announce winner/settlement results
 * - "all": Announce all actions (bet, call, raise, fold, check, all-in, winner)
 */
import { useCallback, useRef, useEffect, useState } from "react";
import { getLocale } from "@/lib/i18n";

// Voice announcement modes
export type VoiceMode = "off" | "winner_only" | "all";

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
 * Multi-language action text templates
 * Each language has templates for poker actions
 */
const ACTION_TEXTS: Record<string, Record<string, (name: string, amount: string) => string>> = {
  "zh-CN": {
    bet: (name, amount) => name ? `${name} 下注 ${amount}` : `下注 ${amount}`,
    call: (name, amount) => name ? `${name} 跟注 ${amount}` : `跟注 ${amount}`,
    raise: (name, amount) => name ? `${name} 加注到 ${amount}` : `加注到 ${amount}`,
    all_in: (name, amount) => name ? `${name} All In ${amount}` : `All In ${amount}`,
    fold: (name) => name ? `${name} 弃牌` : "弃牌",
    check: (name) => name ? `${name} 过牌` : "过牌",
  },
  "zh-TW": {
    bet: (name, amount) => name ? `${name} 下注 ${amount}` : `下注 ${amount}`,
    call: (name, amount) => name ? `${name} 跟注 ${amount}` : `跟注 ${amount}`,
    raise: (name, amount) => name ? `${name} 加注到 ${amount}` : `加注到 ${amount}`,
    all_in: (name, amount) => name ? `${name} All In ${amount}` : `All In ${amount}`,
    fold: (name) => name ? `${name} 棄牌` : "棄牌",
    check: (name) => name ? `${name} 過牌` : "過牌",
  },
  "en": {
    bet: (name, amount) => name ? `${name} bets ${amount}` : `Bet ${amount}`,
    call: (name, amount) => name ? `${name} calls ${amount}` : `Call ${amount}`,
    raise: (name, amount) => name ? `${name} raises to ${amount}` : `Raise to ${amount}`,
    all_in: (name, amount) => name ? `${name} all in ${amount}` : `All in ${amount}`,
    fold: (name) => name ? `${name} folds` : "Fold",
    check: (name) => name ? `${name} checks` : "Check",
  },
  "ja": {
    bet: (name, amount) => name ? `${name} ベット ${amount}` : `ベット ${amount}`,
    call: (name, amount) => name ? `${name} コール ${amount}` : `コール ${amount}`,
    raise: (name, amount) => name ? `${name} レイズ ${amount}` : `レイズ ${amount}`,
    all_in: (name, amount) => name ? `${name} オールイン ${amount}` : `オールイン ${amount}`,
    fold: (name) => name ? `${name} フォールド` : "フォールド",
    check: (name) => name ? `${name} チェック` : "チェック",
  },
  "ko": {
    bet: (name, amount) => name ? `${name} 베팅 ${amount}` : `베팅 ${amount}`,
    call: (name, amount) => name ? `${name} 콜 ${amount}` : `콜 ${amount}`,
    raise: (name, amount) => name ? `${name} 레이즈 ${amount}` : `레이즈 ${amount}`,
    all_in: (name, amount) => name ? `${name} 올인 ${amount}` : `올인 ${amount}`,
    fold: (name) => name ? `${name} 폴드` : "폴드",
    check: (name) => name ? `${name} 체크` : "체크",
  },
  "es": {
    bet: (name, amount) => name ? `${name} apuesta ${amount}` : `Apuesta ${amount}`,
    call: (name, amount) => name ? `${name} iguala ${amount}` : `Iguala ${amount}`,
    raise: (name, amount) => name ? `${name} sube a ${amount}` : `Sube a ${amount}`,
    all_in: (name, amount) => name ? `${name} all in ${amount}` : `All in ${amount}`,
    fold: (name) => name ? `${name} se retira` : "Se retira",
    check: (name) => name ? `${name} pasa` : "Pasa",
  },
  "pt": {
    bet: (name, amount) => name ? `${name} aposta ${amount}` : `Aposta ${amount}`,
    call: (name, amount) => name ? `${name} paga ${amount}` : `Paga ${amount}`,
    raise: (name, amount) => name ? `${name} aumenta para ${amount}` : `Aumenta para ${amount}`,
    all_in: (name, amount) => name ? `${name} all in ${amount}` : `All in ${amount}`,
    fold: (name) => name ? `${name} desiste` : "Desiste",
    check: (name) => name ? `${name} passa` : "Passa",
  },
  "ru": {
    bet: (name, amount) => name ? `${name} ставка ${amount}` : `Ставка ${amount}`,
    call: (name, amount) => name ? `${name} колл ${amount}` : `Колл ${amount}`,
    raise: (name, amount) => name ? `${name} рейз до ${amount}` : `Рейз до ${amount}`,
    all_in: (name, amount) => name ? `${name} олл-ин ${amount}` : `Олл-ин ${amount}`,
    fold: (name) => name ? `${name} фолд` : "Фолд",
    check: (name) => name ? `${name} чек` : "Чек",
  },
  "vi": {
    bet: (name, amount) => name ? `${name} đặt cược ${amount}` : `Đặt cược ${amount}`,
    call: (name, amount) => name ? `${name} theo ${amount}` : `Theo ${amount}`,
    raise: (name, amount) => name ? `${name} tăng lên ${amount}` : `Tăng lên ${amount}`,
    all_in: (name, amount) => name ? `${name} all in ${amount}` : `All in ${amount}`,
    fold: (name) => name ? `${name} bỏ bài` : "Bỏ bài",
    check: (name) => name ? `${name} xem bài` : "Xem bài",
  },
  "th": {
    bet: (name, amount) => name ? `${name} เดิมพัน ${amount}` : `เดิมพัน ${amount}`,
    call: (name, amount) => name ? `${name} คอล ${amount}` : `คอล ${amount}`,
    raise: (name, amount) => name ? `${name} เรส ${amount}` : `เรส ${amount}`,
    all_in: (name, amount) => name ? `${name} ออลอิน ${amount}` : `ออลอิน ${amount}`,
    fold: (name) => name ? `${name} หมอบ` : "หมอบ",
    check: (name) => name ? `${name} เช็ค` : "เช็ค",
  },
  "id": {
    bet: (name, amount) => name ? `${name} taruhan ${amount}` : `Taruhan ${amount}`,
    call: (name, amount) => name ? `${name} ikut ${amount}` : `Ikut ${amount}`,
    raise: (name, amount) => name ? `${name} naikkan ke ${amount}` : `Naikkan ke ${amount}`,
    all_in: (name, amount) => name ? `${name} all in ${amount}` : `All in ${amount}`,
    fold: (name) => name ? `${name} lipat` : "Lipat",
    check: (name) => name ? `${name} cek` : "Cek",
  },
  "ar": {
    bet: (name, amount) => name ? `${name} رهان ${amount}` : `رهان ${amount}`,
    call: (name, amount) => name ? `${name} مجاراة ${amount}` : `مجاراة ${amount}`,
    raise: (name, amount) => name ? `${name} رفع إلى ${amount}` : `رفع إلى ${amount}`,
    all_in: (name, amount) => name ? `${name} أول إن ${amount}` : `أول إن ${amount}`,
    fold: (name) => name ? `${name} انسحاب` : "انسحاب",
    check: (name) => name ? `${name} تمرير` : "تمرير",
  },
};

/**
 * Get action text in the current locale
 */
function getActionText(action: string, locale: string, name: string, amount: string): string {
  const texts = ACTION_TEXTS[locale] || ACTION_TEXTS["en"];
  const generator = texts[action];
  if (!generator) return "";
  return generator(name, amount);
}

/**
 * TTS via server-side proxy using Audio element
 * This works on ALL platforms including Android WebView / Telegram Mini App
 * because it uses standard HTML5 Audio which is universally supported.
 * Now passes the current language to the TTS endpoint for correct pronunciation.
 */
function playTTS(text: string, lang: string, volume: number = 0.7): void {
  try {
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(url);
    audio.volume = volume;
    // Play with error handling
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // If autoplay blocked, try speechSynthesis as fallback (works on iOS/desktop)
        fallbackSpeechSynthesis(text, lang, volume);
      });
    }
  } catch {
    fallbackSpeechSynthesis(text, lang, volume);
  }
}

/**
 * Fallback: use Web Speech API for platforms that support it (iOS, desktop browsers)
 */
function fallbackSpeechSynthesis(text: string, lang: string, volume: number = 0.7): void {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.volume = volume;
    utterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    const matchVoice = voices.find(v => v.lang.startsWith(lang))
      || voices.find(v => v.lang.startsWith(lang.split("-")[0]));
    if (matchVoice) {
      utterance.voice = matchVoice;
      utterance.lang = matchVoice.lang;
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

/**
 * Get the saved voice mode from localStorage
 */
function getSavedVoiceMode(): VoiceMode {
  const saved = localStorage.getItem("vera-voice-mode");
  if (saved === "off" || saved === "winner_only" || saved === "all") return saved;
  return "all"; // Default: announce all actions
}

export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(
    localStorage.getItem("vera-sound-enabled") !== "false"
  );
  const volumeRef = useRef<number>(
    parseFloat(localStorage.getItem("vera-sound-volume") || "0.7")
  );
  const voiceModeRef = useRef<VoiceMode>(getSavedVoiceMode());
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(voiceModeRef.current);

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

  // Set voice mode
  const setVoiceMode = useCallback((mode: VoiceMode) => {
    voiceModeRef.current = mode;
    localStorage.setItem("vera-voice-mode", mode);
    setVoiceModeState(mode);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Voice announcement for settlement/winner - only blocked by "off" mode
  const speak = useCallback((text: string) => {
    if (!enabledRef.current) return;
    if (voiceModeRef.current === "off") return;
    const currentLang = getLocale();
    playTTS(text, currentLang, volumeRef.current);
  }, []);

  // Announce a poker action with amount - blocked by "off" and "winner_only" modes
  const announceAction = useCallback((action: string, amount?: number, playerName?: string) => {
    if (!enabledRef.current) return;
    if (voiceModeRef.current !== "all") return; // Only announce actions in "all" mode
    const currentLang = getLocale();
    const amountStr = amount ? `$${amount}` : "";
    const name = playerName || "";
    const text = getActionText(action, currentLang, name, amountStr);
    if (text) {
      playTTS(text, currentLang, volumeRef.current);
    }
  }, []);

  return {
    play,
    speak,
    announceAction,
    toggle,
    setVolume,
    setVoiceMode,
    voiceMode,
    isEnabled: () => enabledRef.current,
    getVolume: () => volumeRef.current,
    getVoiceMode: () => voiceModeRef.current,
  };
}
