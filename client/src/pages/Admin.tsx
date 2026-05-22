import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Settings, Users, DollarSign, Shield, BarChart3, Save, RefreshCw, Plus, Trash2, ArrowLeft, UserCheck, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";

type AdminTab = "config" | "users" | "rooms" | "finance" | "risk" | "agents" | "faq" | "settings" | "stats";

export default function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("config");

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Admin privileges required</p>
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: "config", icon: Settings, label: "Config" },
    { key: "users", icon: Users, label: "Users" },
    { key: "rooms", icon: Settings, label: "Rooms" },
    { key: "finance", icon: DollarSign, label: "Finance" },
    { key: "agents", icon: UserCheck, label: "Agents" },
    { key: "risk", icon: Shield, label: "Risk" },
    { key: "faq", icon: Settings, label: "FAQ" },
    { key: "settings", icon: Settings, label: "System" },
    { key: "stats", icon: BarChart3, label: "Stats" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-gold">Vera Admin</h1>
            <p className="text-[10px] text-muted-foreground">Management Console</p>
          </div>
          <button onClick={() => navigate("/lobby")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
        {/* Scrollable Tab Bar */}
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === "config" && <ConfigPanel />}
        {activeTab === "users" && <UsersPanel />}
        {activeTab === "rooms" && <RoomsPanel />}
        {activeTab === "finance" && <FinancePanel />}
        {activeTab === "agents" && <AgentsPanel />}
        {activeTab === "risk" && <RiskPanel />}
        {activeTab === "faq" && <FaqPanel />}
        {activeTab === "settings" && <SystemSettingsPanel />}
        {activeTab === "stats" && <StatsPanel />}
      </main>
    </div>
  );
}

// ==================== CONFIG PANEL ====================
function ConfigPanel() {
  const { data: configs, isLoading, refetch } = trpc.config.getAll.useQuery();
  const upsertMutation = trpc.config.upsert.useMutation({
    onSuccess: () => { toast.success("Configuration saved!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newConfig, setNewConfig] = useState({ key: "", value: "", category: "game", label: "", valueType: "string" as const, isPublic: false });

  const configGroups: Record<string, string[]> = {
    "Game Settings": ["rake_percentage", "rake_cap", "min_players_to_start", "turn_timeout_seconds", "max_players_per_table"],
    "Agent System": ["agent_level1_rate", "agent_level2_rate", "unlock_min_hands", "unlock_min_deposit", "unlock_min_rake", "max_daily_commission"],
    "Finance": ["min_deposit", "min_withdrawal", "withdrawal_fee_rate", "daily_withdrawal_limit"],
    "Risk Control": ["min_account_age_days", "observation_period_days", "max_same_table_ratio"],
    "Private Room": ["room_fee_micro", "room_fee_low", "room_fee_mid", "room_fee_high", "room_fee_premium", "discount_5_rounds", "discount_10_rounds", "discount_20_rounds", "discount_50_rounds"],
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c]) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">System Configuration</h2>
      </div>

      {Object.entries(configGroups).map(([group, keys]) => (
        <div key={group} className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gold mb-3">{group}</h3>
          <div className="space-y-3">
            {keys.map(key => {
              const config = configMap.get(key) as any;
              const currentValue = editValues[key] ?? config?.value ?? "";
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">{config?.label || key}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 glass rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-gold"
                    />
                    <button
                      onClick={() => upsertMutation.mutate({ key, value: editValues[key] ?? currentValue, category: config?.category ?? "game", label: config?.label ?? key, valueType: config?.valueType ?? "string", isPublic: config?.isPublic ?? false })}
                      className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add New Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-truth-blue mb-3">Add New Configuration</h3>
        <div className="grid grid-cols-1 gap-3">
          <input placeholder="Key" value={newConfig.key} onChange={e => setNewConfig(p => ({ ...p, key: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <input placeholder="Value" value={newConfig.value} onChange={e => setNewConfig(p => ({ ...p, value: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <input placeholder="Label" value={newConfig.label} onChange={e => setNewConfig(p => ({ ...p, label: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <select value={newConfig.category} onChange={e => setNewConfig(p => ({ ...p, category: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue bg-transparent">
            <option value="game">Game</option>
            <option value="agent">Agent</option>
            <option value="finance">Finance</option>
            <option value="risk">Risk</option>
            <option value="room">Room</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (!newConfig.key || !newConfig.value) return toast.error("Key and value required");
            upsertMutation.mutate({ ...newConfig, description: "" });
            setNewConfig({ key: "", value: "", category: "game", label: "", valueType: "string", isPublic: false });
          }}
          className="mt-3 px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Config
        </button>
      </div>
    </div>
  );
}

// ==================== USERS PANEL ====================
function UsersPanel() {
  const { data, isLoading } = trpc.admin.users.useQuery({ page: 1, limit: 50 });
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => toast.success("User updated"),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const users = (data as any)?.users ?? data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">User Management</h2>
      <div className="space-y-2">
        {(users as any[])?.map((u: any) => (
          <div key={u.id} className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{u.name || "Anonymous"}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  u.role === "admin" ? "bg-gold/20 text-gold" : "bg-secondary text-muted-foreground"
                }`}>{u.role}</span>
              </div>
              <span className="text-sm font-mono text-gold">${u.balance ?? "0.00"}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  u.riskLevel === "normal" ? "bg-success/20 text-success" :
                  u.riskLevel === "watch" ? "bg-warning/20 text-warning" :
                  "bg-danger/20 text-danger"
                }`}>{u.riskLevel ?? "normal"}</span>
                <span className="text-[10px] text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</span>
              </div>
              <select
                defaultValue={u.riskLevel ?? "normal"}
                onChange={(e) => updateMutation.mutate({ id: u.id, riskLevel: e.target.value as any })}
                className="glass rounded px-2 py-1 text-[10px] bg-transparent outline-none"
              >
                <option value="normal">Normal</option>
                <option value="watch">Watch</option>
                <option value="frozen">Frozen</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
        ))}
        {((users as any[])?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>
        )}
      </div>
    </div>
  );
}

// ==================== ROOMS PANEL (with admin actions) ====================
function RoomsPanel() {
  const { data, isLoading, refetch } = trpc.rooms.adminList.useQuery({ page: 1, limit: 50 });
  const updateMutation = trpc.rooms.adminUpdate.useMutation({
    onSuccess: () => { toast.success("Room updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.rooms.adminDelete.useMutation({
    onSuccess: () => { toast.success("Room deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const rooms = (data as any)?.rooms ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Room Management</h2>
      <div className="space-y-2">
        {rooms.map((r: any) => (
          <div key={r.id} className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{r.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.status === "playing" ? "bg-success/20 text-success" :
                r.status === "waiting" ? "bg-warning/20 text-warning" :
                r.status === "paused" ? "bg-truth-blue/20 text-truth-blue" :
                "bg-secondary text-muted-foreground"
              }`}>{r.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.type === "public" ? "bg-truth-blue/20 text-truth-blue" : "bg-purple-500/20 text-purple-400"
              }`}>{r.type}</span>
              <span className="font-mono">${r.smallBlind}/${r.bigBlind}</span>
              <span>{r.currentPlayers}/{r.maxPlayers} players</span>
            </div>
            {/* Admin Actions */}
            <div className="flex gap-2">
              {r.status !== "paused" && r.status !== "closed" && (
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: "paused" })}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/10 text-warning text-[10px] font-medium hover:bg-warning/20"
                >
                  <Pause className="w-3 h-3" /> Pause
                </button>
              )}
              {r.status === "paused" && (
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: "waiting" })}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-success/10 text-success text-[10px] font-medium hover:bg-success/20"
                >
                  <Play className="w-3 h-3" /> Resume
                </button>
              )}
              {r.status !== "closed" && (
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: "closed" })}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-danger/10 text-danger text-[10px] font-medium hover:bg-danger/20"
                >
                  <X className="w-3 h-3" /> Close
                </button>
              )}
              <button
                onClick={() => { if (confirm("Delete this room permanently?")) deleteMutation.mutate({ id: r.id }); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-danger/10 text-danger text-[10px] font-medium hover:bg-danger/20"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No rooms created yet</p>
        )}
      </div>
    </div>
  );
}

// ==================== FINANCE PANEL ====================
function FinancePanel() {
  const { data: txData, isLoading } = trpc.wallet.allTransactions.useQuery({ page: 1, limit: 20 });
  const { data: stats } = trpc.admin.stats.useQuery();

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const transactions = (txData as any)?.transactions ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Financial Overview</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Volume</p>
          <p className="text-xl font-bold text-gold">${stats?.totalVolume ?? "0.00"}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
          <p className="text-xl font-bold text-truth-blue">{stats?.totalTransactions ?? 0}</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className={`text-xs font-medium ${tx.type === "deposit" ? "text-success" : "text-danger"}`}>{tx.type}</span>
                  <span className="text-xs text-muted-foreground ml-2">User #{tx.userId}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono">${tx.amount}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                    tx.status === "completed" ? "bg-success/20 text-success" :
                    tx.status === "pending" ? "bg-warning/20 text-warning" :
                    "bg-danger/20 text-danger"
                  }`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No transactions yet</p>
        )}
      </div>
    </div>
  );
}

// ==================== AGENTS PANEL ====================
function AgentsPanel() {
  const { data: agentData, isLoading } = trpc.admin.agents.useQuery({ page: 1, limit: 50 });
  const { data: commissionData } = trpc.admin.commissions.useQuery({ page: 1, limit: 20 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const relationships = (agentData as any)?.relationships ?? [];
  const commissions = (commissionData as any)?.records ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Agent Management</h2>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Relationships</p>
          <p className="text-xl font-bold text-gold">{(agentData as any)?.total ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Commissions</p>
          <p className="text-xl font-bold text-truth-blue">{(commissionData as any)?.total ?? 0}</p>
        </div>
      </div>

      {/* Agent Relationships */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Agent Relationships</h3>
        {relationships.length > 0 ? (
          <div className="space-y-2">
            {relationships.map((rel: any) => (
              <div key={rel.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium">Agent #{rel.agentId}</span>
                  <span className="text-xs text-muted-foreground ml-2">→ Downline #{rel.downlineId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    rel.level === 1 ? "bg-gold/20 text-gold" : "bg-truth-blue/20 text-truth-blue"
                  }`}>L{rel.level}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    rel.isUnlocked ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                  }`}>{rel.isUnlocked ? "Unlocked" : "Pending"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No agent relationships yet</p>
        )}
      </div>

      {/* Recent Commissions */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Recent Commissions</h3>
        {commissions.length > 0 ? (
          <div className="space-y-2">
            {commissions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium">Agent #{c.agentId}</span>
                  <span className="text-xs text-muted-foreground ml-2">from #{c.sourceUserId}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-gold">${c.amount}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">L{c.level}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No commission records yet</p>
        )}
      </div>
    </div>
  );
}

// ==================== RISK PANEL ====================
function RiskPanel() {
  const { data: events, isLoading } = trpc.admin.riskEvents.useQuery({ page: 1, limit: 20 });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  const riskEvents = (events as any)?.events ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Risk Control</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-danger mb-2" />
          <p className="text-xs font-semibold">Flagged Events</p>
          <p className="text-xl font-bold text-danger mt-1">{riskEvents.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Shield className="w-5 h-5 text-warning mb-2" />
          <p className="text-xs font-semibold">Anti-Abuse</p>
          <p className="text-[10px] text-muted-foreground mt-1">4-Layer Defense</p>
        </div>
      </div>

      {/* Anti-abuse rules info */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Anti-Abuse Rules</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>Registration Gate</span>
            <span className="text-success font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>Device Fingerprint</span>
            <span className="text-success font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span>Behavior Analysis</span>
            <span className="text-success font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span>Same-table Ratio Check</span>
            <span className="text-success font-medium">Active</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">Configure thresholds in Config → Risk Control section</p>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Detection Log</h3>
        {riskEvents.length > 0 ? (
          <div className="space-y-2">
            {riskEvents.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <span className="text-xs font-medium text-danger">{e.eventType}</span>
                  <span className="text-xs text-muted-foreground ml-2">User #{e.userId}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No suspicious activity detected</p>
        )}
      </div>
    </div>
  );
}

// ==================== FAQ PANEL ====================
function FaqPanel() {
  const { data: faqs, isLoading, refetch } = trpc.admin.faqList.useQuery();
  const upsertMutation = trpc.admin.faqUpsert.useMutation({
    onSuccess: () => { toast.success("FAQ saved!"); refetch(); },
  });
  const deleteMutation = trpc.admin.faqDelete.useMutation({
    onSuccess: () => { toast.success("FAQ deleted"); refetch(); },
  });

  const [newFaq, setNewFaq] = useState({ category: "general", question: "", answer: "", language: "en" });

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">FAQ Management (AI Knowledge Base)</h2>
      
      {/* Add FAQ */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-truth-blue mb-3">Add FAQ Entry</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <select value={newFaq.category} onChange={e => setNewFaq(p => ({ ...p, category: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none flex-1">
              <option value="general">General</option>
              <option value="deposit">Deposit</option>
              <option value="withdraw">Withdraw</option>
              <option value="game">Game Rules</option>
              <option value="agent">Agent</option>
              <option value="security">Security</option>
            </select>
            <select value={newFaq.language} onChange={e => setNewFaq(p => ({ ...p, language: e.target.value }))} className="glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none flex-1">
              <option value="en">English</option>
              <option value="zh-CN">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <input placeholder="Question" value={newFaq.question} onChange={e => setNewFaq(p => ({ ...p, question: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue" />
          <textarea placeholder="Answer" value={newFaq.answer} onChange={e => setNewFaq(p => ({ ...p, answer: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-truth-blue h-20 resize-none" />
          <button
            onClick={() => {
              if (!newFaq.question || !newFaq.answer) return toast.error("Question and answer required");
              upsertMutation.mutate(newFaq);
              setNewFaq({ category: "general", question: "", answer: "", language: "en" });
            }}
            className="px-4 py-2 rounded-lg bg-truth-blue text-white text-sm font-medium hover:opacity-90 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add FAQ
          </button>
        </div>
      </div>

      {/* FAQ List */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Existing FAQs ({(faqs as any[])?.length ?? 0})</h3>
        <div className="space-y-2">
          {(faqs as any[])?.map((faq: any) => (
            <div key={faq.id} className="flex items-start justify-between py-2 border-b border-border/30">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{faq.category}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-truth-blue/20 text-truth-blue">{faq.language}</span>
                </div>
                <p className="text-xs font-medium">{faq.question}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{faq.answer}</p>
              </div>
              <button onClick={() => deleteMutation.mutate({ id: faq.id })} className="p-1 text-danger/60 hover:text-danger">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {((faqs as any[])?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No FAQ entries. Add some to power the AI customer service.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== SYSTEM SETTINGS PANEL ====================
function SystemSettingsPanel() {
  const { data: configs, refetch } = trpc.config.getAll.useQuery();
  const upsertMutation = trpc.config.upsert.useMutation({
    onSuccess: () => { toast.success("Setting saved!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgBotUsername, setTgBotUsername] = useState("");

  // Load existing values when configs are fetched
  useEffect(() => {
    if (configs) {
      const configMap = new Map((configs as any[])?.map((c: any) => [c.key, c.value]) ?? []);
      setMaintenanceMode(configMap.get("maintenance_mode") === "true");
      setDefaultLanguage(configMap.get("default_language") ?? "en");
      setTgBotToken(configMap.get("tg_bot_token") ?? "");
      setTgBotUsername(configMap.get("tg_bot_username") ?? "");
    }
  }, [configs]);

  const saveSystemSetting = (key: string, value: string) => {
    upsertMutation.mutate({ key, value, category: "system", label: key, valueType: "string", isPublic: false });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">System Settings</h2>
      
      {/* Maintenance Mode */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Maintenance Mode</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">When enabled, players cannot access the game</p>
          </div>
          <button
            onClick={() => {
              const newVal = !maintenanceMode;
              setMaintenanceMode(newVal);
              saveSystemSetting("maintenance_mode", newVal.toString());
            }}
            className={`w-12 h-6 rounded-full transition-colors relative ${maintenanceMode ? "bg-danger" : "bg-secondary"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${maintenanceMode ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Default Language */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Default Language</h3>
        <select
          value={defaultLanguage}
          onChange={(e) => {
            setDefaultLanguage(e.target.value);
            saveSystemSetting("default_language", e.target.value);
          }}
          className="w-full glass rounded-lg px-3 py-2 text-sm bg-transparent outline-none"
        >
          <option value="en">English</option>
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁體中文</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="ru">Русский</option>
          <option value="ar">العربية</option>
          <option value="vi">Tiếng Việt</option>
          <option value="th">ไทย</option>
          <option value="id">Bahasa Indonesia</option>
        </select>
      </div>

      {/* Telegram Bot Config */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Telegram Bot Configuration</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bot Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tgBotUsername}
                onChange={(e) => setTgBotUsername(e.target.value)}
                placeholder="@VeraPokerBot"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button
                onClick={() => saveSystemSetting("tg_bot_username", tgBotUsername)}
                className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bot Token (hidden)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={tgBotToken}
                onChange={(e) => setTgBotToken(e.target.value)}
                placeholder="Enter bot token"
                className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
              <button
                onClick={() => saveSystemSetting("tg_bot_token", tgBotToken)}
                className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Languages */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Supported Languages</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { code: "en", name: "English", flag: "🇺🇸" },
            { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
            { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
            { code: "ja", name: "日本語", flag: "🇯🇵" },
            { code: "ko", name: "한국어", flag: "🇰🇷" },
            { code: "es", name: "Español", flag: "🇪🇸" },
            { code: "pt", name: "Português", flag: "🇧🇷" },
            { code: "ru", name: "Русский", flag: "🇷🇺" },
            { code: "ar", name: "العربية", flag: "🇸🇦" },
            { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
            { code: "th", name: "ไทย", flag: "🇹🇭" },
            { code: "id", name: "Indonesia", flag: "🇮🇩" },
          ].map(lang => (
            <div key={lang.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/30">
              <span className="text-sm">{lang.flag}</span>
              <span className="text-xs">{lang.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== STATS PANEL ====================
function StatsPanel() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Platform Statistics</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Users</p>
          <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Rooms</p>
          <p className="text-2xl font-bold text-truth-blue">{stats?.totalRooms ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-gold">{stats?.totalTransactions ?? 0}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-success">${stats?.totalVolume ?? "0.00"}</p>
        </div>
      </div>
    </div>
  );
}
