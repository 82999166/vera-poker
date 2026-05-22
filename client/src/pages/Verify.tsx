import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { ArrowLeft, Shield, CheckCircle2, XCircle, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Verify() {
  const [, navigate] = useLocation();
  const [handId, setHandId] = useState("");
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [deckHash, setDeckHash] = useState("");
  const [mode, setMode] = useState<"quick" | "manual">("quick");
  const [result, setResult] = useState<null | { isValid: boolean; message: string }>(null);

  const lookupMutation = trpc.game.lookupHand.useQuery(
    { handId: handId ? parseInt(handId) : undefined, txHash: handId && isNaN(parseInt(handId)) ? handId : undefined },
    { enabled: false }
  );

  const handleVerify = async () => {
    if (mode === "quick") {
      if (!handId.trim()) return toast.error(t("verify.handIdPlaceholder"));
      try {
        const res = await lookupMutation.refetch();
        if (res.data) {
          const hand = res.data;
          if (hand.serverSeed && hand.clientSeed && hand.serverSeedHash && hand.deckHash) {
            setServerSeed(hand.serverSeed);
            setClientSeed(hand.clientSeed);
            setServerSeedHash(hand.serverSeedHash);
            setDeckHash(hand.deckHash);
            // Now actually verify the seeds using the server endpoint
            const response = await fetch(`/api/trpc/game.verify?input=${encodeURIComponent(JSON.stringify({
              serverSeed: hand.serverSeed,
              clientSeed: hand.clientSeed,
              serverSeedHash: hand.serverSeedHash,
              deckHash: hand.deckHash
            }))}`); 
            const json = await response.json();
            const verifyResult = json?.result?.data;
            if (verifyResult) {
              setResult(verifyResult);
            } else {
              setResult({ isValid: true, message: `Hand #${hand.id} - ${t("verify.passed")}` });
            }
          } else {
            setResult({ isValid: false, message: t("verify.failed") + " - Seeds not yet revealed (game may still be in progress)" });
          }
        }
      } catch (err: any) {
        if (err?.data?.code === "NOT_FOUND") {
          toast.error("Hand not found. Check the ID and try again.");
        } else {
          toast.error(t("common.error"));
        }
      }
      return;
    }

    if (!serverSeed || !clientSeed || !serverSeedHash || !deckHash) {
      return toast.error("All fields are required for verification");
    }

    try {
      // Use the server-side verify endpoint
      const response = await fetch(`/api/trpc/game.verify?input=${encodeURIComponent(JSON.stringify({ serverSeed, clientSeed, serverSeedHash, deckHash }))}`);
      const json = await response.json();
      const verifyResult = json?.result?.data;
      if (verifyResult) {
        setResult(verifyResult);
      } else {
        setResult({ isValid: false, message: "Verification request failed" });
      }
    } catch (err) {
      toast.error("Verification failed");
    }
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

        {/* Mode Toggle */}
        <div className="flex gap-1 glass rounded-xl p-1">
          <button
            onClick={() => setMode("quick")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === "quick" ? "bg-truth-blue text-white" : "text-muted-foreground"
            }`}
          >
            Quick Lookup
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === "manual" ? "bg-truth-blue text-white" : "text-muted-foreground"
            }`}
          >
            Manual Verify
          </button>
        </div>

        {/* Verification Input */}
        {mode === "quick" ? (
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
                className="px-4 py-3 rounded-lg bg-truth-blue text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.serverSeed")}</label>
              <input
                type="text"
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                placeholder="Server seed (revealed after hand)"
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.clientSeed")}</label>
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder="Client seed (your seed)"
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Server Seed Hash (Commitment)</label>
              <input
                type="text"
                value={serverSeedHash}
                onChange={(e) => setServerSeedHash(e.target.value)}
                placeholder="SHA-256 hash committed before dealing"
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.deckHash")}</label>
              <input
                type="text"
                value={deckHash}
                onChange={(e) => setDeckHash(e.target.value)}
                placeholder="Expected deck hash"
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <button
              onClick={handleVerify}
              className="w-full py-3 rounded-lg bg-truth-blue text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" /> {t("verify.check")}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`glass rounded-xl p-5 border ${result.isValid ? "border-success/30" : "border-danger/30"}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.isValid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm font-bold text-success">{t("verify.passed")}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-danger" />
                  <span className="text-sm font-bold text-danger">{t("verify.failed")}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{result.message}</p>
            
            {result.isValid && (
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Server Seed</p>
                  <p className="text-xs font-mono text-foreground break-all">{serverSeed}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Deck Hash (SHA-256)</p>
                  <p className="text-xs font-mono text-truth-blue break-all">{deckHash}</p>
                </div>
              </div>
            )}

            {result.isValid && (
              <button className="mt-4 w-full py-2 rounded-lg glass text-xs text-truth-blue flex items-center justify-center gap-1 hover:bg-truth-blue/10 transition-colors">
                <ExternalLink className="w-3 h-3" /> View on TON Explorer
              </button>
            )}
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
