import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Clock, Copy, CheckCircle2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

type TabType = "deposit" | "withdraw" | "history";

export default function Wallet() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("deposit");
  const [chain, setChain] = useState<"TRC20" | "TON">("TRC20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");

  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user });
  const { data: txData } = trpc.wallet.transactions.useQuery({ page: 1, limit: 20 }, { enabled: !!user });
  const transactions = (txData as any)?.transactions ?? [];

  const depositMutation = trpc.wallet.deposit.useMutation({
    onSuccess: () => {
      toast.success("Deposit submitted successfully");
      setAmount("");
      setTxHash("");
    },
    onError: (err) => toast.error(err.message),
  });

  const withdrawMutation = trpc.wallet.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal submitted for review");
      setAmount("");
      setAddress("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDeposit = () => {
    if (!amount || !txHash) return toast.error("Please fill all fields");
    depositMutation.mutate({ amount, chain, txHash });
  };

  const handleWithdraw = () => {
    if (!amount || !address) return toast.error("Please fill all fields");
    withdrawMutation.mutate({ amount, chain, walletAddress: address });
  };

  // Mock deposit address
  const depositAddress = chain === "TRC20" ? "TXyz...abc123" : "EQDxyz...abc123";

  return (
    <div className="min-h-screen bg-background particle-bg flex flex-col pb-20">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t("nav.wallet")}</h1>
      </header>

      {/* Balance Card */}
      <div className="px-4 pt-4">
        <div className="gradient-border rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">{t("wallet.balance")}</p>
          <p className="text-3xl font-bold text-gold glow-text-gold">${walletData?.balance ?? "0.00"}</p>
          <p className="text-xs text-muted-foreground mt-1">Frozen: ${walletData?.frozenBalance ?? "0.00"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 glass rounded-xl p-1">
          {([
            { key: "deposit" as TabType, icon: ArrowDownToLine, label: t("wallet.deposit") },
            { key: "withdraw" as TabType, icon: ArrowUpFromLine, label: t("wallet.withdraw") },
            { key: "history" as TabType, icon: Clock, label: t("wallet.history") },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.key
                  ? "bg-gold text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 flex-1">
        {activeTab === "deposit" && (
          <div className="space-y-4">
            {/* Chain selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.chain")}</label>
              <div className="flex gap-2">
                {(["TRC20", "TON"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setChain(c)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      chain === c ? "bg-gold text-background" : "glass text-muted-foreground"
                    }`}
                  >
                    {c === "TRC20" ? "USDT (TRC-20)" : "USDT (TON)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit address */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Deposit Address</label>
              <div className="glass rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-foreground font-mono truncate flex-1">{depositAddress}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(depositAddress); toast.success("Copied!"); }}
                  className="text-gold ml-2"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.amount")}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold"
              />
            </div>

            {/* TX Hash */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Transaction Hash</label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Enter your transaction hash"
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold font-mono text-xs"
              />
            </div>

            <button
              onClick={handleDeposit}
              disabled={depositMutation.isPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-background font-bold text-sm glow-gold disabled:opacity-50 active:scale-[0.97] transition-transform"
            >
              {depositMutation.isPending ? t("common.loading") : t("wallet.confirm")}
            </button>
          </div>
        )}

        {activeTab === "withdraw" && (
          <div className="space-y-4">
            {/* Chain selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.chain")}</label>
              <div className="flex gap-2">
                {(["TRC20", "TON"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setChain(c)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      chain === c ? "bg-gold text-background" : "glass text-muted-foreground"
                    }`}
                  >
                    {c === "TRC20" ? "USDT (TRC-20)" : "USDT (TON)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.amount")}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold"
              />
            </div>

            {/* Wallet address */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.address")}</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your wallet address"
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold font-mono text-xs"
              />
            </div>

            <button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-truth-blue to-truth-blue-bright text-white font-bold text-sm glow-blue disabled:opacity-50 active:scale-[0.97] transition-transform"
            >
              {withdrawMutation.isPending ? t("common.loading") : t("wallet.confirm")}
            </button>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-2">
            {(transactions.length === 0) ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              transactions.map((tx: any, i: number) => (
                <div key={i} className="glass rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === "deposit" ? "bg-success/20" : "bg-danger/20"
                    }`}>
                      {tx.type === "deposit" ? (
                        <ArrowDownToLine className="w-4 h-4 text-success" />
                      ) : (
                        <ArrowUpFromLine className="w-4 h-4 text-danger" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.chain} • {tx.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === "deposit" ? "text-success" : "text-danger"}`}>
                      {tx.type === "deposit" ? "+" : "-"}${tx.amount}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav active="wallet" />
    </div>
  );
}
