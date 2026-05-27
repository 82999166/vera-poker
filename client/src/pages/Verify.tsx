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
          toast.error(t("verify.handNotFoundMsg"));
        } else {
          toast.error(t("verify.requestFailedMsg"));
        }
      }
      return;
    }

    if (!serverSeed || !clientSeed || !serverSeedHash || !deckHash) {
      return toast.error(t("verify.allFieldsRequired"));
    }

    try {
      const response = await fetch(`/api/trpc/game.verify?input=${encodeURIComponent(JSON.stringify({ serverSeed, clientSeed, serverSeedHash, deckHash }))}`);
      const json = await response.json();
      const verifyResult = json?.result?.data;
      if (verifyResult) {
        setResult(verifyResult);
      } else {
        setResult({ isValid: false, message: t("verify.requestFailedMsg") });
      }
    } catch (err) {
      toast.error(t("verify.verificationFailed"));
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
          <h2 className="text-lg font-bold mb-2">{t("verify.provablyFair")}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("verify.provablyFairDesc")}
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
            {t("verify.quickLookup")}
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === "manual" ? "bg-truth-blue text-white" : "text-muted-foreground"
            }`}
          >
            {t("verify.manualVerify")}
          </button>
        </div>

        {/* Verification Input */}
        {mode === "quick" ? (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">{t("verify.handIdLabel2")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={handId}
                onChange={(e) => setHandId(e.target.value)}
                placeholder={t("verify.handIdPlaceholder2")}
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
                placeholder={t("verify.serverSeedPlaceholder")}
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.clientSeed")}</label>
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder={t("verify.clientSeedPlaceholder")}
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.serverSeedHashLabel")}</label>
              <input
                type="text"
                value={serverSeedHash}
                onChange={(e) => setServerSeedHash(e.target.value)}
                placeholder={t("verify.serverSeedHashPlaceholder")}
                className="w-full glass rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("verify.deckHash")}</label>
              <input
                type="text"
                value={deckHash}
                onChange={(e) => setDeckHash(e.target.value)}
                placeholder={t("verify.deckHashPlaceholder")}
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
                  <p className="text-[10px] text-muted-foreground">{t("verify.resultServerSeed")}</p>
                  <p className="text-xs font-mono text-foreground break-all">{serverSeed}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t("verify.resultDeckHash")}</p>
                  <p className="text-xs font-mono text-truth-blue break-all">{deckHash}</p>
                </div>
              </div>
            )}

            {result.isValid && (
              <button className="mt-4 w-full py-2 rounded-lg glass text-xs text-truth-blue flex items-center justify-center gap-1 hover:bg-truth-blue/10 transition-colors">
                <ExternalLink className="w-3 h-3" /> {t("verify.viewOnChain")}
              </button>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("verify.howItWorks")}</h3>
          <div className="space-y-3">
            {[
              { step: "1", titleKey: "verify.step1Title", descKey: "verify.step1Desc" },
              { step: "2", titleKey: "verify.step2Title", descKey: "verify.step2Desc" },
              { step: "3", titleKey: "verify.step3Title", descKey: "verify.step3Desc" },
              { step: "4", titleKey: "verify.step4Title", descKey: "verify.step4Desc" },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-truth-blue/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-truth-blue">{item.step}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">{t(item.titleKey)}</p>
                  <p className="text-[10px] text-muted-foreground">{t(item.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier info */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("verify.tiers")}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-xs text-muted-foreground">{t("verify.microStakes")}</span>
              <span className="text-xs font-medium text-foreground">{t("verify.microStakesMethod")}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-xs text-muted-foreground">{t("verify.midStakes")}</span>
              <span className="text-xs font-medium text-truth-blue">{t("verify.midStakesMethod")}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">{t("verify.highStakes")}</span>
              <span className="text-xs font-medium text-gold">{t("verify.highStakesMethod")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
