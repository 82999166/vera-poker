/**
 * 解析 User-Agent 获取设备信息
 * 返回可读的设备描述字符串，如 "iPhone Safari" / "Windows Chrome" / "Android Telegram"
 */
import { UAParser } from "ua-parser-js";

export function parseDeviceInfo(ua: string): string {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  const os = result.os.name || "Unknown OS";
  const browser = result.browser.name || "Unknown Browser";
  const device = result.device.model || result.device.vendor || "";
  const deviceType = result.device.type || "desktop"; // mobile, tablet, desktop

  // Build a human-readable device string
  const parts: string[] = [];

  // Device model if available (e.g., "iPhone", "Samsung Galaxy")
  if (device) {
    parts.push(device);
  } else {
    // Use OS as device identifier (e.g., "Windows", "macOS", "Android")
    parts.push(os);
  }

  // Browser name
  parts.push(browser);

  // Add device type tag
  const typeTag = deviceType === "mobile" ? "📱" : deviceType === "tablet" ? "📱" : "💻";

  return `${typeTag} ${parts.join(" ")}`;
}

/**
 * 获取完整的设备信息对象（用于管理后台展示）
 */
export function parseDeviceInfoFull(ua: string) {
  const parser = new UAParser(ua);
  const result = parser.getResult();

  return {
    os: result.os.name || "Unknown",
    osVersion: result.os.version || "",
    browser: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "",
    device: result.device.model || result.device.vendor || "",
    deviceType: result.device.type || "desktop",
    raw: ua,
  };
}
