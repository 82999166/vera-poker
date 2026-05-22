import { useState } from "react";
import { useI18n, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const { locale, changeLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{LOCALE_FLAGS[locale]}</span>
        <span className="hidden sm:inline">{LOCALE_NAMES[locale]}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full mb-2 right-0 z-50 glass-strong rounded-xl p-2 min-w-[180px] max-h-[300px] overflow-y-auto shadow-xl border border-border/50">
            {(Object.keys(LOCALE_NAMES) as Locale[]).map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  changeLocale(loc);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                  locale === loc
                    ? "bg-gold/10 text-gold font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span className="text-sm">{LOCALE_FLAGS[loc]}</span>
                <span>{LOCALE_NAMES[loc]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
