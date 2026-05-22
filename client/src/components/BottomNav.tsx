import { useLocation } from "wouter";
import { t } from "@/lib/i18n";
import { Gamepad2, Wallet, Users, MessageCircle, Globe } from "lucide-react";
import { useState } from "react";
import { useI18n, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from "@/lib/i18n";

interface BottomNavProps {
  active: "lobby" | "wallet" | "agent" | "support" | "profile";
}

export default function BottomNav({ active }: BottomNavProps) {
  const [, navigate] = useLocation();
  const { locale, changeLocale } = useI18n();
  const [showLangPicker, setShowLangPicker] = useState(false);

  const items = [
    { key: "lobby" as const, icon: Gamepad2, label: t("nav.lobby"), path: "/lobby" },
    { key: "wallet" as const, icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { key: "agent" as const, icon: Users, label: t("nav.agent"), path: "/agent" },
    { key: "support" as const, icon: MessageCircle, label: t("nav.support"), path: "/support" },
  ];

  return (
    <>
      {/* Language Picker Overlay */}
      {showLangPicker && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowLangPicker(false)} />
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-[398px] glass-strong rounded-xl p-3 shadow-xl border border-border/50">
            <p className="text-xs font-semibold text-foreground mb-2">{t("common.language")}</p>
            <div className="grid grid-cols-3 gap-1.5 max-h-[240px] overflow-y-auto">
              {(Object.keys(LOCALE_NAMES) as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    changeLocale(loc);
                    setShowLangPicker(false);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] transition-colors ${
                    locale === loc
                      ? "bg-gold/10 text-gold font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <span>{LOCALE_FLAGS[loc]}</span>
                  <span className="truncate">{LOCALE_NAMES[loc]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] glass-strong border-t border-border z-50">
        <div className="flex items-center justify-around py-2 px-2">
          {items.map(item => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${
                  isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_oklch(0.82_0.15_85)]" : ""}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
          {/* Language switcher as last nav item */}
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all text-muted-foreground hover:text-foreground"
          >
            <Globe className="w-5 h-5" />
            <span className="text-[10px] font-medium">{LOCALE_FLAGS[locale]}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
