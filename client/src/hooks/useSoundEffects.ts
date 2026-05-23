/**
 * Sound Effects Hook for Poker Table
 * Uses Web Audio API for low-latency sound playback
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
    // Quick snap sound
    createNoiseSound(ctx, 0.08, 0.15);
    createOscillatorSound(ctx, 2000, 0.05, "square", 0.05);
  },
  bet: (ctx) => {
    // Chip stack sound - multiple quick taps
    createOscillatorSound(ctx, 800, 0.06, "triangle", 0.2);
    setTimeout(() => createOscillatorSound(ctx, 1000, 0.04, "triangle", 0.15), 30);
    setTimeout(() => createOscillatorSound(ctx, 900, 0.05, "triangle", 0.1), 60);
  },
  check: (ctx) => {
    // Soft tap
    createOscillatorSound(ctx, 600, 0.08, "sine", 0.15);
  },
  fold: (ctx) => {
    // Descending tone
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
    // Similar to bet but softer
    createOscillatorSound(ctx, 700, 0.06, "triangle", 0.15);
    setTimeout(() => createOscillatorSound(ctx, 850, 0.04, "triangle", 0.1), 40);
  },
  allIn: (ctx) => {
    // Dramatic ascending + chip cascade
    createOscillatorSound(ctx, 400, 0.1, "sawtooth", 0.1);
    setTimeout(() => createOscillatorSound(ctx, 600, 0.1, "sawtooth", 0.12), 80);
    setTimeout(() => createOscillatorSound(ctx, 800, 0.15, "sawtooth", 0.15), 160);
    setTimeout(() => createNoiseSound(ctx, 0.2, 0.1), 240);
  },
  win: (ctx) => {
    // Happy ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.2, "sine", 0.2), i * 100);
    });
  },
  lose: (ctx) => {
    // Sad descending notes
    const notes = [523, 440, 349, 262]; // C5, A4, F4, C4
    notes.forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.25, "sine", 0.15), i * 120);
    });
  },
  timer: (ctx) => {
    // Warning beep
    createOscillatorSound(ctx, 1200, 0.1, "square", 0.15);
  },
  turnAlert: (ctx) => {
    // Double beep
    createOscillatorSound(ctx, 880, 0.1, "sine", 0.2);
    setTimeout(() => createOscillatorSound(ctx, 880, 0.1, "sine", 0.2), 150);
  },
  chipMove: (ctx) => {
    // Soft chip slide
    createNoiseSound(ctx, 0.05, 0.08);
    createOscillatorSound(ctx, 1500, 0.03, "triangle", 0.05);
  },
  cardFlip: (ctx) => {
    // Card flip sound
    createNoiseSound(ctx, 0.06, 0.12);
    createOscillatorSound(ctx, 3000, 0.03, "sine", 0.03);
  },
};

export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(
    localStorage.getItem("vera-sound-enabled") !== "false"
  );
  const volumeRef = useRef<number>(
    parseFloat(localStorage.getItem("vera-sound-volume") || "0.7")
  );

  // Initialize AudioContext on first user interaction
  const ensureContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play a sound effect
  const play = useCallback((effect: SoundEffect) => {
    if (!enabledRef.current) return;
    try {
      const ctx = ensureContext();
      soundGenerators[effect]?.(ctx);
    } catch (e) {
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

  return {
    play,
    toggle,
    setVolume,
    isEnabled: () => enabledRef.current,
    getVolume: () => volumeRef.current,
  };
}
