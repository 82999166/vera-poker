/** 工具函数 - 金额格式化、className 合并等通用工具 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 精度修正：消除浮点运算误差（四舍五入到 6 位小数）
 * 例：100.00000001 → 100,  99.99999999 → 100
 */
export function fixPrecision(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * 统一筹码/金额格式化函数（内置精度修正）
 * - 金额 < 0.01：显示 4 位小数（如 $0.0050）
 * - 金额始终显示 2 位小数（如 $10.00, $0.20）
 * - 金额 >= 1000：显示 K 缩写（如 $1.5K）
 */
export function formatAmount(n: number | string | null | undefined): string {
  const num = fixPrecision(parseFloat(String(n ?? 0)) || 0);
  if (num >= 1000) return `${(num / 1000).toFixed(2).replace(/\.?0+$/, "")}K`;
  return num.toFixed(2);
}

/**
 * 钱包余额格式化：始终显示 2 位小数（如 $100.00）
 */
export function formatBalance(n: number | string | null | undefined): string {
  const num = fixPrecision(parseFloat(String(n ?? 0)) || 0);
  return num.toFixed(2);
}

/** 带 $ 前缀的筹码显示 */
export function fmtAmt(n: number | string | null | undefined): string {
  return `$${formatAmount(n)}`;
}

/** 带 $ 前缀的余额显示（始终 2 位小数） */
export function fmtBalance(n: number | string | null | undefined): string {
  return `$${formatBalance(n)}`;
}
