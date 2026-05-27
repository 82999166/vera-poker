/**
 * TG Marketing System Admin Panel
 * Tabs: Broadcast | Auto Reply | Fission Campaigns
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatBalance } from "@/lib/utils";
import {
  Plus, Trash2, Send, X, Play, Pause, Copy, Check,
  Megaphone, MessageSquare, Share2, RefreshCw, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type MarketingTab = "broadcast" | "autoReply" | "fission";

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
    title: "", content: "", imageUrl: "", buttonText: "", buttonUrl: "",
    targetType: "all" as "all" | "active" | "deposited" | "custom",
  });
  const resetForm = () => setForm({ title: "", content: "", imageUrl: "", buttonText: "", buttonUrl: "", targetType: "all" });

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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新建群发任务</DialogTitle></DialogHeader>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>按钮文字（可选）</Label>
                <Input value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))} placeholder="立即参与" />
              </div>
              <div>
                <Label>按钮链接</Label>
                <Input value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate({ ...form, imageUrl: form.imageUrl || undefined, buttonText: form.buttonText || undefined, buttonUrl: form.buttonUrl || undefined })}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>每人最大奖励上限</Label>
                    <Input type="number" value={form.maxRewardPerUser} onChange={e => setForm(f => ({ ...f, maxRewardPerUser: e.target.value }))} />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch checked={form.requireDeposit} onCheckedChange={v => setForm(f => ({ ...f, requireDeposit: v }))} />
                    <Label className="cursor-pointer" onClick={() => setForm(f => ({ ...f, requireDeposit: !f.requireDeposit }))}>需要充值才发奖励</Label>
                  </div>
                </div>
                {form.requireDeposit && (
                  <div>
                    <Label>最低充值金额</Label>
                    <Input type="number" value={form.minDepositAmount} onChange={e => setForm(f => ({ ...f, minDepositAmount: e.target.value }))} />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate(form)}
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
  const { data: clicks, isLoading } = trpc.marketing.getFissionClicks.useQuery({ id: campaignId, limit: 100 });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>裂变点击记录</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : !clicks?.length ? (
          <div className="text-center py-8 text-muted-foreground">暂无点击记录</div>
        ) : (
          <div className="space-y-2">
            {clicks.map((item) => (
              <div key={item.click.id} className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <div>
                  <span className="font-medium">{item.user?.nickname || item.user?.tgUsername || `用户 #${item.click.userId || "?"}`}</span>
                  <span className="text-muted-foreground ml-2">{new Date(item.click.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  {item.click.registered && <Badge variant="default" className="text-xs">已注册</Badge>}
                  {item.click.deposited && <Badge variant="default" className="text-xs">已充值</Badge>}
                  {item.click.rewardPaid && <Badge variant="outline" className="text-xs">已发奖</Badge>}
                  {!item.click.registered && <Badge variant="secondary" className="text-xs">仅点击</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN MARKETING PANEL ====================
export function MarketingPanel({ at }: { at: (k: string) => string }) {
  const [activeTab, setActiveTab] = useState<MarketingTab>("broadcast");

  const tabs: { key: MarketingTab; icon: any; label: string }[] = [
    { key: "broadcast", icon: Megaphone, label: "Bot 群发" },
    { key: "autoReply", icon: MessageSquare, label: "自动回复" },
    { key: "fission", icon: Share2, label: "裂变活动" },
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
      </div>
    </div>
  );
}
