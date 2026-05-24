import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Clock, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

type TabType = "deposit" | "withdraw" | "history";
type ChainType = "TRC20" | "ERC20" | "BEP20" | "TON" | "Polygon";

const CHAINS: { key: ChainType; label: string; network: string }[] = [
  { key: "TRC20", label: "TRC-20", network: "Tron" },
  { key: "ERC20", label: "ERC-20", network: "Ethereum" },
  { key: "BEP20", label: "BEP-20", network: "BSC" },
  { key: "TON", label: "TON", network: "TON" },
  { key: "Polygon", label: "Polygon", network: "Polygon" },
];

function getInitialTab(): TabType {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (tab === "deposit" || tab === "withdraw" || tab === "history") return tab;
  return "deposit";
}

export default function Wallet() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [chain, setChain] = useState<ChainType>("TRC20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");

  const { data: walletData } = trpc.wallet.balance.useQuery(undefined, { enabled: !!user });
  const { data: txData } = trpc.wallet.transactions.useQuery({ page: 1, limit: 20 }, { enabled: !!user });
  const transactions = (txData as any)?.transactions ?? [];

  const depositMutation = trpc.wallet.deposit.useMutation({
    onSuccess: () => {
      toast.success(t("wallet.depositSuccess"));
      setAmount("");
      setTxHash("");
    },
    onError: (err) => toast.error(err.message),
  });

  const withdrawMutation = trpc.wallet.withdraw.useMutation({
    onSuccess: () => {
      toast.success(t("wallet.withdrawSuccess"));
      setAmount("");
      setAddress("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDeposit = () => {
    if (!amount) return toast.error(t("wallet.fillAll"));
    // txHash is now optional - if not provided, system will auto-detect
    depositMutation.mutate({ amount, chain, ...(txHash ? { txHash } : {}) });
  };

  const handleWithdraw = () => {
    if (!amount || !address) return toast.error(t("wallet.fillAll"));
    withdrawMutation.mutate({ amount, chain, walletAddress: address });
  };

  // Dynamic deposit address from backend
  const { data: addrData, isLoading: addrLoading } = trpc.wallet.depositAddress.useQuery(
    { chain },
    { enabled: !!user }
  );
  const depositAddress = addrData?.address ?? "";

  const statusLabels: Record<string, string> = {
    pending: t("wallet.statusPending"),
    confirmed: t("wallet.statusConfirmed"),
    failed: t("wallet.statusFailed"),
    cancelled: t("wallet.statusCancelled"),
  };

  const typeLabels: Record<string, string> = {
    deposit: t("wallet.deposit"),
    withdraw: t("wallet.withdraw"),
    game_win: t("wallet.gameWin"),
    game_loss: t("wallet.gameLoss"),
    rake: t("wallet.rake"),
    commission: t("wallet.commission"),
    room_fee: t("wallet.roomFee"),
    refund: t("wallet.refund"),
    adjustment: t("wallet.adjustment"),
  };

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
          <p className="text-xs text-muted-foreground mt-1">{t("wallet.frozen")}: ${walletData?.frozenBalance ?? "0.00"}</p>
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
            {/* Chain selector - scrollable */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.chain")}</label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {CHAINS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setChain(c.key)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      chain === c.key ? "bg-gold text-background" : "glass text-muted-foreground"
                    }`}
                  >
                    <div className="whitespace-nowrap">USDT</div>
                    <div className="whitespace-nowrap text-[10px] opacity-80">{c.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit address */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.depositAddress")}</label>
              {addrLoading ? (
                <div className="glass rounded-lg p-3 text-center text-xs text-muted-foreground">
                  {t("common.loading")}...
                </div>
              ) : depositAddress ? (
                <div className="glass rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-foreground font-mono truncate flex-1">{depositAddress}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(depositAddress); toast.success(t("agent.copied")); }}
                    className="text-gold ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="glass rounded-lg p-3 flex items-center gap-2 text-xs text-yellow-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{t("wallet.chainNotConfigured")}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("wallet.networkTip")}: {CHAINS.find(c => c.key === chain)?.network ?? chain}
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.amount")} (USDT)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold"
              />
            </div>

            {/* TX Hash - Optional */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                {t("wallet.txHash")} <span className="text-gold/60">({t("common.optional")})</span>
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={t("wallet.txHashPlaceholder")}
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold font-mono text-xs"
              />
              <p className="text-[10px] text-gold/60 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t("wallet.autoDetectTip")}
              </p>
            </div>

            <button
              onClick={handleDeposit}
              disabled={depositMutation.isPending || !depositAddress}
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
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {CHAINS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setChain(c.key)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      chain === c.key ? "bg-gold text-background" : "glass text-muted-foreground"
                    }`}
                  >
                    <div className="whitespace-nowrap">USDT</div>
                    <div className="whitespace-nowrap text-[10px] opacity-80">{c.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wallet.amount")} (USDT)</label>
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
                placeholder={t("wallet.addressPlaceholder")}
                className="w-full glass rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-gold font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("wallet.networkTip")}: {CHAINS.find(c => c.key === chain)?.network ?? chain}
              </p>
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
                <p className="text-sm">{t("wallet.noHistory")}</p>
              </div>
            ) : (
              transactions.map((tx: any, i: number) => (
                <div key={i} className="glass rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === "deposit" || tx.type === "game_win" || tx.type === "commission" || tx.type === "refund"
                        ? "bg-success/20" : "bg-danger/20"
                    }`}>
                      {tx.type === "deposit" || tx.type === "game_win" || tx.type === "commission" || tx.type === "refund" ? (
                        <ArrowDownToLine className="w-4 h-4 text-success" />
                      ) : (
                        <ArrowUpFromLine className="w-4 h-4 text-danger" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{typeLabels[tx.type] ?? tx.type}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {tx.chain ? `${tx.chain} • ` : ""}{statusLabels[tx.status] ?? tx.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      tx.type === "deposit" || tx.type === "game_win" || tx.type === "commission" || tx.type === "refund"
                        ? "text-success" : "text-danger"
                    }`}>
                      {tx.type === "deposit" || tx.type === "game_win" || tx.type === "commission" || tx.type === "refund" ? "+" : "-"}${tx.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
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
