import { useState } from "react";
import { useLocation } from "wouter";
import { t } from "@/lib/i18n";
import { ArrowLeft, Shield, CheckCircle2, XCircle, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Verify() {
  const [, navigate] = useLocation();
  const [handId, setHandId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<null | { valid: boolean; details: any }>(null);

  const handleVerify = async () => {
    if (!handId.trim()) return toast.error("Please enter a hand ID");
    setVerifying(true);
    // Simulate verification
    await new Promise(r => setTimeout(r, 1500));
    setResult({
      valid: true,
      details: {
        handId: handId,
        serverSeed: "a3f2b1c4d5e6f7890123456789abcdef",
        clientSeed: "user_seed_123",
        combinedHash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        deck: ["As", "Kh", "Qd", "Jc", "Ts", "9h", "8d", "7c", "6s", "5h"],
        communityCards: ["As", "Kh", "7c", "Ts", "5h"],
        timestamp: Date.now(),
      }
    });
    setVerifying(false);
  };

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1 as any)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-truth-blue" />
        <h1 className="text-lg font-bold">{t("verify.title")}</h1>
      </header>

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Intro */}
        <div className="gradient-border rounded-xl p-5 text-center">
          <Shield className="w-10 h-10 text-truth-blue mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Provably Fair</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every hand is cryptographically verifiable. The server seed is committed before dealing, 
            and revealed after the hand completes. You can independently verify that no manipulation occurred.
          </p>
        </div>

        {/* Verification Input */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Hand ID / Transaction Hash</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={handId}
              onChange={(e) => setHandId(e.target.value)}
              placeholder="Enter hand ID or TX hash"
              className="flex-1 glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-4 py-3 rounded-lg bg-truth-blue text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {verifying ? <Search className="w-4 h-4 animate-pulse" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`glass rounded-xl p-5 border ${result.valid ? "border-success/30" : "border-danger/30"}`}>
            <div className="flex items-center gap-2 mb-4">
              {result.valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm font-bold text-success">Verified - Fair</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-danger" />
                  <span className="text-sm font-bold text-danger">Verification Failed</span>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Server Seed</p>
                <p className="text-xs font-mono text-foreground break-all">{result.details.serverSeed}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Combined Hash (SHA-256)</p>
                <p className="text-xs font-mono text-truth-blue break-all">{result.details.combinedHash}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Dealt Cards</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {result.details.deck.slice(0, 10).map((card: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 glass rounded text-xs font-mono">{card}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Community Cards</p>
                <div className="flex gap-1 mt-1">
                  {result.details.communityCards.map((card: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-gold/20 text-gold rounded text-xs font-mono">{card}</span>
                  ))}
                </div>
              </div>
            </div>

            <button className="mt-4 w-full py-2 rounded-lg glass text-xs text-truth-blue flex items-center justify-center gap-1 hover:bg-truth-blue/10 transition-colors">
              <ExternalLink className="w-3 h-3" /> View on TON Explorer
            </button>
          </div>
        )}

        {/* How it works */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">How Provably Fair Works</h3>
          <div className="space-y-3">
            {[
              { step: "1", title: "Commit", desc: "Server generates a random seed and publishes its hash before dealing" },
              { step: "2", title: "Deal", desc: "Cards are dealt using the combined server + client seeds" },
              { step: "3", title: "Reveal", desc: "After the hand, server seed is revealed for verification" },
              { step: "4", title: "Verify", desc: "Anyone can hash the revealed seed and confirm it matches the commitment" },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-truth-blue/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-truth-blue">{item.step}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier info */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Verification Tiers</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-xs text-muted-foreground">Micro/Low Stakes</span>
              <span className="text-xs font-medium text-foreground">Hash Verification (Off-chain)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-xs text-muted-foreground">Mid Stakes</span>
              <span className="text-xs font-medium text-truth-blue">Server Hash On-chain</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">High Stakes (VIP)</span>
              <span className="text-xs font-medium text-gold">Every Card On-chain</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
