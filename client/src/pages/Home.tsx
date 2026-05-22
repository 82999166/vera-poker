import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { getLoginUrl } from "@/const";
import { Shield, Zap, Globe, Users, ArrowRight } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Auto-redirect authenticated users to lobby
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/lobby");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gold via-gold-dim to-truth-blue flex items-center justify-center shadow-2xl glow-gold">
            <span className="text-4xl font-black text-background">VP</span>
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-gold/5 blur-xl -z-10" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black mb-3">
          <span className="text-gold glow-text-gold">Vera</span>{" "}
          <span className="text-foreground">Poker</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-2 italic">
          "Where Truth Deals."
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-8">
          The world's first provably fair poker platform with every card verifiable on-chain. 
          Play Texas Hold'em with confidence.
        </p>

        {/* CTA */}
        <button
          onClick={() => window.location.href = getLoginUrl()}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm glow-gold hover:opacity-90 transition-opacity active:scale-[0.97] flex items-center gap-2"
        >
          Enter Game <ArrowRight className="w-4 h-4" />
        </button>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-sm">
          {[
            { icon: Shield, title: "Provably Fair", desc: "Every card on-chain", color: "text-truth-blue" },
            { icon: Zap, title: "Zero Gas Fee", desc: "In-game transactions", color: "text-gold" },
            { icon: Globe, title: "Multi-Language", desc: "10+ languages", color: "text-success" },
            { icon: Users, title: "Private Rooms", desc: "Play with friends", color: "text-purple-400" },
          ].map((feat, i) => (
            <div key={i} className="glass rounded-xl p-3 text-center">
              <feat.icon className={`w-5 h-5 ${feat.color} mx-auto mb-1`} />
              <p className="text-xs font-semibold">{feat.title}</p>
              <p className="text-[10px] text-muted-foreground">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Powered by TON Blockchain • Vera Poker © 2024
        </p>
      </footer>
    </div>
  );
}
