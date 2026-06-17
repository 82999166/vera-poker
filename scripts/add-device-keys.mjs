#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nPath = resolve(__dirname, '../client/src/lib/i18n.ts');
let content = readFileSync(i18nPath, 'utf-8');

const deviceKeys = {
  ja: {
    "device.newLoginTitle": "新しいデバイスからのログイン",
    "device.newLoginDesc": "お使いのアカウントが以下のデバイスでログインを試みています：",
    "device.newLoginWarning": "承認すると、このデバイスはログアウトされます。本人でない場合は拒否してください！",
    "device.approve": "承認",
    "device.reject": "拒否",
    "device.sessionExpiredTitle": "ログアウトされました",
    "device.sessionExpiredDesc": "お使いのアカウントが別のデバイスでログインしたため、このデバイスからログアウトされました。",
    "device.sessionExpiredBtn": "OK",
  },
  ko: {
    "device.newLoginTitle": "새 기기 로그인 요청",
    "device.newLoginDesc": "계정이 다음 기기에서 로그인을 시도하고 있습니다:",
    "device.newLoginWarning": "승인하면 현재 기기에서 로그아웃됩니다. 본인이 아니면 거부하세요!",
    "device.approve": "승인",
    "device.reject": "거부",
    "device.sessionExpiredTitle": "로그아웃됨",
    "device.sessionExpiredDesc": "계정이 다른 기기에서 로그인되어 현재 기기에서 로그아웃되었습니다.",
    "device.sessionExpiredBtn": "확인",
  },
  es: {
    "device.newLoginTitle": "Inicio de sesión en nuevo dispositivo",
    "device.newLoginDesc": "Tu cuenta está intentando iniciar sesión en:",
    "device.newLoginWarning": "Si apruebas, este dispositivo será desconectado. ¡Rechaza si no eres tú!",
    "device.approve": "Aprobar",
    "device.reject": "Rechazar",
    "device.sessionExpiredTitle": "Sesión cerrada",
    "device.sessionExpiredDesc": "Tu cuenta ha iniciado sesión en otro dispositivo. Has sido desconectado.",
    "device.sessionExpiredBtn": "Aceptar",
  },
  pt: {
    "device.newLoginTitle": "Login em novo dispositivo",
    "device.newLoginDesc": "Sua conta está tentando fazer login em:",
    "device.newLoginWarning": "Ao aprovar, este dispositivo será desconectado. Rejeite se não for você!",
    "device.approve": "Aprovar",
    "device.reject": "Rejeitar",
    "device.sessionExpiredTitle": "Desconectado",
    "device.sessionExpiredDesc": "Sua conta foi conectada em outro dispositivo. Você foi desconectado deste.",
    "device.sessionExpiredBtn": "OK",
  },
  ru: {
    "device.newLoginTitle": "Вход с нового устройства",
    "device.newLoginDesc": "Ваш аккаунт пытается войти на:",
    "device.newLoginWarning": "При одобрении это устройство будет отключено. Отклоните, если это не вы!",
    "device.approve": "Одобрить",
    "device.reject": "Отклонить",
    "device.sessionExpiredTitle": "Отключено",
    "device.sessionExpiredDesc": "Ваш аккаунт вошёл на другом устройстве. Вы были отключены.",
    "device.sessionExpiredBtn": "ОК",
  },
  ar: {
    "device.newLoginTitle": "تسجيل دخول من جهاز جديد",
    "device.newLoginDesc": "حسابك يحاول تسجيل الدخول من:",
    "device.newLoginWarning": "عند الموافقة، سيتم تسجيل خروجك من هذا الجهاز. ارفض إذا لم تكن أنت!",
    "device.approve": "موافقة",
    "device.reject": "رفض",
    "device.sessionExpiredTitle": "تم تسجيل الخروج",
    "device.sessionExpiredDesc": "تم تسجيل الدخول لحسابك من جهاز آخر. تم تسجيل خروجك.",
    "device.sessionExpiredBtn": "حسناً",
  },
  vi: {
    "device.newLoginTitle": "Đăng nhập từ thiết bị mới",
    "device.newLoginDesc": "Tài khoản của bạn đang cố đăng nhập từ:",
    "device.newLoginWarning": "Nếu chấp nhận, thiết bị này sẽ bị đăng xuất. Từ chối nếu không phải bạn!",
    "device.approve": "Chấp nhận",
    "device.reject": "Từ chối",
    "device.sessionExpiredTitle": "Đã đăng xuất",
    "device.sessionExpiredDesc": "Tài khoản đã đăng nhập trên thiết bị khác. Bạn đã bị đăng xuất.",
    "device.sessionExpiredBtn": "OK",
  },
  th: {
    "device.newLoginTitle": "เข้าสู่ระบบจากอุปกรณ์ใหม่",
    "device.newLoginDesc": "บัญชีของคุณกำลังพยายามเข้าสู่ระบบจาก:",
    "device.newLoginWarning": "หากอนุมัติ อุปกรณ์นี้จะถูกออกจากระบบ ปฏิเสธหากไม่ใช่คุณ!",
    "device.approve": "อนุมัติ",
    "device.reject": "ปฏิเสธ",
    "device.sessionExpiredTitle": "ออกจากระบบแล้ว",
    "device.sessionExpiredDesc": "บัญชีของคุณเข้าสู่ระบบบนอุปกรณ์อื่น คุณถูกออกจากระบบ",
    "device.sessionExpiredBtn": "ตกลง",
  },
  id: {
    "device.newLoginTitle": "Login dari perangkat baru",
    "device.newLoginDesc": "Akun Anda mencoba login dari:",
    "device.newLoginWarning": "Jika disetujui, perangkat ini akan logout. Tolak jika bukan Anda!",
    "device.approve": "Setuju",
    "device.reject": "Tolak",
    "device.sessionExpiredTitle": "Terputus",
    "device.sessionExpiredDesc": "Akun Anda telah login di perangkat lain. Anda telah dikeluarkan.",
    "device.sessionExpiredBtn": "OK",
  },
};

for (const [locale, keys] of Object.entries(deviceKeys)) {
  const startMatch = content.match(new RegExp(`const ${locale}: Record<string, string> = \\{`));
  if (!startMatch) {
    console.log(`Skipping ${locale} - not found`);
    continue;
  }
  // Check if already has device keys
  const checkRegion = content.substring(startMatch.index, startMatch.index + 50000);
  if (checkRegion.includes('"device.newLoginTitle"')) {
    console.log(`${locale} already has device keys, skipping`);
    continue;
  }
  const startIndex = startMatch.index + startMatch[0].length;
  let braceCount = 1;
  let i = startIndex;
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    i++;
  }
  const insertPoint = i - 1;
  const entries = Object.entries(keys).map(([k, v]) => {
    const escaped = v.replace(/"/g, '\\"');
    return `  "${k}": "${escaped}",`;
  }).join('\n');
  const insertion = '\n  // Device auth\n' + entries + '\n';
  content = content.substring(0, insertPoint) + insertion + content.substring(insertPoint);
  console.log(`Added device keys to ${locale}`);
}

writeFileSync(i18nPath, content, 'utf-8');
console.log('Done!');
