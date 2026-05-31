/**
 * TG Marketing System Admin Panel
 * Tabs: Broadcast | Auto Reply | Fission | Bot Users
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatBalance } from "@/lib/utils";
import {
  Plus, Trash2, Send, X, Play, Pause, Copy, Check,
  Megaphone, MessageSquare, Share2, RefreshCw, Eye, Users, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type MarketingTab = "broadcast" | "autoReply" | "fission" | "botUsers";

// ==================== BROADCAST STATUS BADGE ====================
function BroadcastStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "草稿", variant: "secondary" },
    pending: { label: "待发送", variant: "outline" },
    sending: { label: "发送中", variant: "default" },
    completed: { label: "已完成", variant: "default" },
    cancelled: { label: "已取消", variant: "secondary" },
    failed: { label: "失败", variant: "destructive" },
  };
  const s = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ==================== MESSAGE PREVIEW ====================
function MessagePreview({ content, imageUrl, buttons }: { content: string; imageUrl?: string; buttons: Array<{ text: string; url: string; row?: number }> }) {
  // Group buttons by row
  const rows = useMemo(() => {
    if (!buttons.length) return [];
    const rowMap = new Map<number, Array<{ text: string; url: string }>>();
    for (const btn of buttons) {
      const row = btn.row ?? 0;
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push({ text: btn.text, url: btn.url });
    }
    return [...rowMap.entries()].sort((a, b) => a[0] - b[0]).map(([, btns]) => btns);
  }, [buttons]);

  return (
    <div className="border border-border rounded-lg p-3 bg-[#1a2236] text-white max-w-sm">
      <p className="text-xs text-muted-foreground mb-1">预览效果</p>
      {imageUrl && (
        <div className="rounded overflow-hidden mb-2 bg-secondary/30">
          <img src={imageUrl} alt="" className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      <div className="text-sm whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: content || '<span class="text-muted-foreground italic">消息内容...</span>' }} />
      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map((btn, j) => (
                <div key={j} className="flex-1 text-center text-xs py-1.5 px-2 rounded bg-blue-600/80 text-white truncate">
                  {btn.text || "按钮"}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== MULTI-BUTTON EDITOR ====================
function ButtonEditor({ buttons, onChange }: { buttons: Array<{ text: string; url: string; row?: number }>; onChange: (v: Array<{ text: string; url: string; row?: number }>) => void }) {
  const addButton = () => {
    const maxRow = buttons.length > 0 ? Math.max(...buttons.map(b => b.row ?? 0)) : 0;
    onChange([...buttons, { text: "", url: "", row: maxRow }]);
  };
  const removeButton = (idx: number) => onChange(buttons.filter((_, i) => i !== idx));
  const updateButton = (idx: number, field: string, value: string | number) => {
    const updated = [...buttons];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>按钮列表（可选，支持多行多列）</Label>
        <Button type="button" size="sm" variant="outline" onClick={addButton}>
          <Plus className="w-3 h-3 mr-1" />添加按钮
        </Button>
      </div>
      {buttons.map((btn, idx) => (
        <div key={idx} className="flex gap-1.5 items-center">
          <Input className="flex-1" placeholder="按钮文字" value={btn.text}
            onChange={e => updateButton(idx, "text", e.target.value)} />
          <Input className="flex-1" placeholder="按钮链接 https://..." value={btn.url}
            onChange={e => updateButton(idx, "url", e.target.value)} />
          <Input className="w-16" type="number" placeholder="行" value={btn.row ?? 0}
            onChange={e => updateButton(idx, "row", parseInt(e.target.value) || 0)} title="行号（同行号的按钮在同一行）" />
          <Button type="button" size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => removeButton(idx)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      {buttons.length === 0 && (
        <p className="text-xs text-muted-foreground">未添加按钮。点击"添加按钮"可添加 inline keyboard 按钮。</p>
      )}
    </div>
  );
}

// ==================== BROADCAST PANEL ====================
function BroadcastPanel() {
  const { data: tasks, isLoading, refetch } = trpc.marketing.listBroadcasts.useQuery(undefined, { refetchInterval: 5000 });
  const createMutation = trpc.marketing.createBroadcast.useMutation({
    onSuccess: () => { toast.success("群发任务已创建"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const sendMutation = trpc.marketing.sendBroadcast.useMutation({
    onSuccess: () => { toast.success("群发已启动，正在后台发送..."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cancelMutation = trpc.marketing.cancelBroadcast.useMutation({
    onSuccess: () => { toast.success("已取消"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", content: "", imageUrl: "",
    buttons: [] as Array<{ text: string; url: string; row?: number }>,
    targetType: "all" as "all" | "active" | "deposited" | "custom",
  });
  const resetForm = () => setForm({ title: "", content: "", imageUrl: "", buttons: [], targetType: "all" });

  const targetTypeLabels: Record<string, string> = {
    all: "全部用户",
    active: "近30天活跃",
    deposited: "有充值记录",
    custom: "自定义",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bot 群发</h3>
          <p className="text-sm text-muted-foreground">向 TG 用户批量发送消息（每秒 ≤30 条，自动限速）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />新建群发</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !tasks?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无群发任务</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <BroadcastStatusBadge status={task.status} />
                    <span className="font-medium truncate">{task.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.content}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>目标：{targetTypeLabels[task.targetType] || task.targetType}</span>
                    {task.totalCount > 0 && (
                      <span>进度：{task.sentCount}/{task.totalCount}（失败 {task.failCount}）</span>
                    )}
                    <span>创建：{new Date(task.createdAt).toLocaleString()}</span>
                    {task.completedAt && <span>完成：{new Date(task.completedAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {["draft", "pending"].includes(task.status) && (
                    <>
                      <Button size="sm" variant="default" onClick={() => sendMutation.mutate({ id: task.id })}
                        disabled={sendMutation.isPending}>
                        <Send className="w-3 h-3 mr-1" />发送
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate({ id: task.id })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {task.status === "sending" && task.totalCount > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.round((task.sentCount / task.totalCount) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((task.sentCount / task.totalCount) * 100)}% 完成
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新建群发任务</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Form */}
            <div className="space-y-3">
              <div>
                <Label>任务标题（内部备注）</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="如：5月活动推广" />
              </div>
              <div>
                <Label>消息内容（支持 HTML 格式）</Label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="消息正文，支持 <b>加粗</b>、<i>斜体</i>、<a href='...'>链接</a>" rows={4} />
              </div>
              <div>
                <Label>图片 URL（可选，发送图片+说明）</Label>
                <Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <ButtonEditor buttons={form.buttons} onChange={buttons => setForm(f => ({ ...f, buttons }))} />
              <div>
                <Label>目标用户</Label>
                <Select value={form.targetType} onValueChange={v => setForm(f => ({ ...f, targetType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部用户</SelectItem>
                    <SelectItem value="active">近30天活跃用户</SelectItem>
                    <SelectItem value="deposited">有充值记录用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Right: Preview */}
            <div>
              <MessagePreview content={form.content} imageUrl={form.imageUrl || undefined} buttons={form.buttons} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate({
              ...form,
              imageUrl: form.imageUrl || undefined,
              buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : undefined,
            })}
              disabled={!form.title || !form.content || createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建任务"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== AUTO REPLY PANEL ====================
function AutoReplyPanel() {
  const { data: rules, isLoading, refetch } = trpc.marketing.listAutoReplies.useQuery();
  const createMutation = trpc.marketing.createAutoReply.useMutation({
    onSuccess: () => { toast.success("规则已创建"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketing.deleteAutoReply.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = trpc.marketing.toggleAutoReply.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    keyword: "", matchType: "contains" as "exact" | "contains" | "regex",
    replyContent: "", replyType: "text" as "text" | "text_button",
    buttonText: "", buttonUrl: "", priority: 0, isActive: true,
  });
  const resetForm = () => setForm({ keyword: "", matchType: "contains", replyContent: "", replyType: "text", buttonText: "", buttonUrl: "", priority: 0, isActive: true });

  const matchTypeLabels: Record<string, string> = { exact: "精确匹配", contains: "包含匹配", regex: "正则匹配" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">关键词自动回复</h3>
          <p className="text-sm text-muted-foreground">用户在 Bot 中发送消息时，自动匹配关键词并回复</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />新建规则</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !rules?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无自动回复规则</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="border border-border rounded-lg p-3 bg-card flex items-start gap-3">
              <Switch checked={rule.isActive} onCheckedChange={v => toggleMutation.mutate({ id: rule.id, isActive: v })} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{matchTypeLabels[rule.matchType]}</Badge>
                  <span className="font-mono text-sm font-medium">"{rule.keyword}"</span>
                  {rule.priority > 0 && <Badge variant="secondary" className="text-xs">优先级 {rule.priority}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{rule.replyContent}</p>
                {rule.replyType === "text_button" && rule.buttonText && (
                  <p className="text-xs text-primary mt-1">按钮：{rule.buttonText}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">触发 {rule.triggerCount} 次</p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive shrink-0"
                onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: rule.id }); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新建自动回复规则</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>关键词</Label>
                <Input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} placeholder="如：充值、帮助" />
              </div>
              <div>
                <Label>匹配方式</Label>
                <Select value={form.matchType} onValueChange={v => setForm(f => ({ ...f, matchType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">包含匹配</SelectItem>
                    <SelectItem value="exact">精确匹配</SelectItem>
                    <SelectItem value="regex">正则匹配</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>回复内容（支持 HTML）</Label>
              <Textarea value={form.replyContent} onChange={e => setForm(f => ({ ...f, replyContent: e.target.value }))}
                placeholder="回复的消息内容" rows={3} />
            </div>
            <div>
              <Label>回复类型</Label>
              <Select value={form.replyType} onValueChange={v => setForm(f => ({ ...f, replyType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">纯文字</SelectItem>
                  <SelectItem value="text_button">文字+按钮</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.replyType === "text_button" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>按钮文字</Label>
                  <Input value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))} placeholder="立即充值" />
                </div>
                <div>
                  <Label>按钮链接</Label>
                  <Input value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
            )}
            <div>
              <Label>优先级（数字越大越优先）</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate({ ...form, buttonText: form.buttonText || undefined, buttonUrl: form.buttonUrl || undefined })}
              disabled={!form.keyword || !form.replyContent || createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建规则"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== FISSION PANEL ====================
function FissionPanel() {
  const { data: campaigns, isLoading, refetch } = trpc.marketing.listFissions.useQuery();
  const createMutation = trpc.marketing.createFission.useMutation({
    onSuccess: () => { toast.success("裂变活动已创建"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketing.deleteFission.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = trpc.marketing.updateFission.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", rewardType: "balance" as "balance" | "none",
    inviterReward: "0.00", inviteeReward: "0.00",
    requireDeposit: false, minDepositAmount: "0.00", maxRewardPerUser: "0.00",
    isActive: true,
  });
  const resetForm = () => setForm({ name: "", description: "", rewardType: "balance", inviterReward: "0.00", inviteeReward: "0.00", requireDeposit: false, minDepositAmount: "0.00", maxRewardPerUser: "0.00", isActive: true });

  const copyLink = (code: string, id: number) => {
    const url = `${window.location.origin}/api/ref/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("裂变链接已复制");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">裂变活动</h3>
          <p className="text-sm text-muted-foreground">创建邀请链接，追踪点击、注册和奖励发放</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />新建活动</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !campaigns?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无裂变活动</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const convRate = c.clickCount > 0 ? Math.round((c.registerCount / c.clickCount) * 100) : 0;
            return (
              <div key={c.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Switch checked={c.isActive} onCheckedChange={v => toggleMutation.mutate({ id: c.id, isActive: v })} />
                      <span className="font-medium">{c.name}</span>
                      {!c.isActive && <Badge variant="secondary">已停用</Badge>}
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mb-2">{c.description}</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-2">
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="text-lg font-bold">{c.clickCount}</div>
                        <div className="text-xs text-muted-foreground">点击</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="text-lg font-bold">{c.registerCount}</div>
                        <div className="text-xs text-muted-foreground">注册</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="text-lg font-bold">{convRate}%</div>
                        <div className="text-xs text-muted-foreground">转化率</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="text-lg font-bold">{formatBalance(parseFloat(c.totalRewardPaid))}</div>
                        <div className="text-xs text-muted-foreground">已发奖励</div>
                      </div>
                    </div>
                    {c.rewardType === "balance" && (
                      <p className="text-xs text-muted-foreground">
                        邀请人奖励 {formatBalance(parseFloat(c.inviterReward))} | 被邀请人奖励 {formatBalance(parseFloat(c.inviteeReward))}
                        {c.requireDeposit && ` | 需充值 ≥ ${formatBalance(parseFloat(c.minDepositAmount))}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => copyLink(c.linkCode, c.id)}>
                      {copiedId === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDetail(c.id)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: c.id }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {showDetail !== null && (
        <FissionDetailDialog campaignId={showDetail} onClose={() => setShowDetail(null)} />
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新建裂变活动</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>活动名称</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：5月邀请好友活动" />
            </div>
            <div>
              <Label>活动描述（可选）</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="活动说明" />
            </div>
            <div>
              <Label>奖励类型</Label>
              <Select value={form.rewardType} onValueChange={v => setForm(f => ({ ...f, rewardType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">余额奖励</SelectItem>
                  <SelectItem value="none">无奖励（仅追踪）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.rewardType === "balance" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>邀请人奖励</Label>
                    <Input type="number" value={form.inviterReward} onChange={e => setForm(f => ({ ...f, inviterReward: e.target.value }))} />
                  </div>
                  <div>
                    <Label>被邀请人奖励</Label>
                    <Input type="number" value={form.inviteeReward} onChange={e => setForm(f => ({ ...f, inviteeReward: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.requireDeposit} onCheckedChange={v => setForm(f => ({ ...f, requireDeposit: v }))} />
                  <Label>需要首次充值才发放奖励</Label>
                </div>
                {form.requireDeposit && (
                  <div>
                    <Label>最低充值金额</Label>
                    <Input type="number" value={form.minDepositAmount} onChange={e => setForm(f => ({ ...f, minDepositAmount: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label>每人最高奖励（0=无限）</Label>
                  <Input type="number" value={form.maxRewardPerUser} onChange={e => setForm(f => ({ ...f, maxRewardPerUser: e.target.value }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate({ ...form })}
              disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建活动"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== FISSION DETAIL DIALOG ====================
function FissionDetailDialog({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const { data } = trpc.marketing.getFission.useQuery({ id: campaignId });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>裂变活动详情</DialogTitle></DialogHeader>
        {data ? (
          <div className="space-y-3 text-sm">
            <p><strong>名称：</strong>{data.name}</p>
            <p><strong>链接码：</strong>{data.linkCode}</p>
            <p><strong>点击/注册/发奖：</strong>{data.clickCount}/{data.registerCount}/{data.rewardPaidCount}</p>
            <p><strong>已发奖励总额：</strong>{formatBalance(parseFloat(data.totalRewardPaid))}</p>
            <p><strong>创建时间：</strong>{new Date(data.createdAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">加载中...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== BOT USERS PANEL ====================
function BotUsersPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading, refetch } = trpc.marketing.botUsers.useQuery({ page, limit: 50, search: search || undefined });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bot 用户列表</h3>
          <p className="text-sm text-muted-foreground">所有关注 Bot 的 TG 用户详细信息（共 {data?.total ?? 0} 人）</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索昵称、用户名..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
        </div>
        <Button size="sm" onClick={handleSearch}>搜索</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !data?.users?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无 Bot 用户</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 px-2">用户</th>
                  <th className="py-2 px-2">TG ID</th>
                  <th className="py-2 px-2">余额</th>
                  <th className="py-2 px-2">充值</th>
                  <th className="py-2 px-2">奖金</th>
                  <th className="py-2 px-2">最后活跃</th>
                  <th className="py-2 px-2">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {u.avatar ? (
                          <img src={u.avatar} className="w-6 h-6 rounded-full" alt="" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">
                            {(u.nickname || u.name || "?")[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-xs">{u.nickname || u.name || "未知"}</div>
                          {u.tgUsername && <div className="text-xs text-muted-foreground">@{u.tgUsername}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs font-mono">{u.tgId}</td>
                    <td className="py-2 px-2">{formatBalance(parseFloat(u.balance))}</td>
                    <td className="py-2 px-2">{formatBalance(parseFloat(u.totalDeposited))}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <span>{formatBalance(parseFloat(u.bonusBalance))}</span>
                        {u.bonusUnlocked ? (
                          <Badge variant="default" className="text-[10px] px-1">已解锁</Badge>
                        ) : parseFloat(u.bonusBalance) > 0 ? (
                          <Badge variant="secondary" className="text-[10px] px-1">锁定</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs">{new Date(u.lastSignedIn).toLocaleDateString()}</td>
                    <td className="py-2 px-2 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total > 50 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">第 {page} 页 / 共 {Math.ceil(data.total / 50)} 页</span>
              <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(p => p + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==================== MAIN MARKETING PANEL ====================
export function MarketingPanel({ at }: { at: (k: string) => string }) {
  const [activeTab, setActiveTab] = useState<MarketingTab>("broadcast");

  const tabs: { key: MarketingTab; icon: any; label: string }[] = [
    { key: "broadcast", icon: Megaphone, label: "Bot 群发" },
    { key: "autoReply", icon: MessageSquare, label: "自动回复" },
    { key: "fission", icon: Share2, label: "裂变活动" },
    { key: "botUsers", icon: Users, label: "Bot 用户" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === "broadcast" && <BroadcastPanel />}
        {activeTab === "autoReply" && <AutoReplyPanel />}
        {activeTab === "fission" && <FissionPanel />}
        {activeTab === "botUsers" && <BotUsersPanel />}
      </div>
    </div>
  );
}
