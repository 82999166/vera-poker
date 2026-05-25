import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 统一金额格式化函数
 * - 金额 < 0.01：显示 4 位小数（如 $0.0050）
 * - 金额 < 1：显示 2 位小数（如 $0.20）
 * - 金额 >= 1：显示整数（如 $10）
 * - 金额 >= 1000：显示 K 缩写（如 $1.5K）
 */
export function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1) return n.toFixed(0);
  if (n >= 0.01) return n.toFixed(2);
  return n.toFixed(4);
}

/** 带 $ 前缀的金额显示 */
export function fmtAmt(n: number): string {
  return `$${formatAmount(n)}`;
}
