import { useLocation } from "wouter";
import { t } from "@/lib/i18n";
import { Gamepad2, Wallet, User } from "lucide-react";

interface BottomNavProps {
  active: "lobby" | "wallet" | "agent" | "support" | "profile";
}

export default function BottomNav({ active }: BottomNavProps) {
  const [, navigate] = useLocation();

  const items = [
    { key: "lobby" as const, icon: Gamepad2, label: t("nav.lobby"), path: "/lobby" },
    { key: "wallet" as const, icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { key: "profile" as const, icon: User, label: t("nav.profile") || "我的", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] glass-strong border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-2">
        {items.map(item => {
          // Map agent/support active states to lobby for backward compat
          const isActive = active === item.key || 
            (item.key === "lobby" && (active === "agent" || active === "support"));
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded-lg transition-all ${
                isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_oklch(0.82_0.15_85)]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
