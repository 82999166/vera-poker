/**
 * TG Marketing System Admin Panel
 * Tabs: Broadcast | Auto Reply | Fission | Bot Users
 */
import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatBalance } from "@/lib/utils";
import {
  Plus, Trash2, Send, X, Play, Pause, Copy, Check, Gift,
  Megaphone, MessageSquare, Share2, RefreshCw, Eye, Users, Search,
  Upload, FileText, Globe, Filter, Image as ImageIcon, Edit, Edit2,
  Link2, BarChart3, DollarSign, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type MarketingTab = "broadcast" | "autoReply" | "fission" | "botUsers" | "templates" | "welcome" | "coupons" | "checkin" | "invite" | "events" | "notifications" | "redPacket" | "tgGroups";

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
function ButtonEditor({ buttons, onChange }: { buttons: Array<{ text: string; url: string; type?: string; row?: number }>; onChange: (v: Array<{ text: string; url: string; type?: string; row?: number }>) => void }) {
  const addButton = () => {
    const maxRow = buttons.length > 0 ? Math.max(...buttons.map(b => b.row ?? 0)) : 0;
    onChange([...buttons, { text: "", url: "", type: "url", row: maxRow }]);
  };
  const removeButton = (idx: number) => onChange(buttons.filter((_, i) => i !== idx));
  const updateButton = (idx: number, field: string, value: string | number) => {
    const updated = [...buttons];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>按钮列表（可选，支持多行多列）</Label>
        <Button type="button" size="sm" variant="outline" onClick={addButton}>
          <Plus className="w-3 h-3 mr-1" />添加按钮
        </Button>
      </div>
      {buttons.map((btn, idx) => (
        <div key={idx} className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">按钮 {idx + 1}</span>
            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeButton(idx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">按钮文字</Label>
              <Input placeholder="如：领取红包" value={btn.text}
                onChange={e => updateButton(idx, "text", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">按钮类型</Label>
              <Select value={btn.type || "url"} onValueChange={v => updateButton(idx, "type", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url">🔗 URL链接</SelectItem>
                  <SelectItem value="web_app">📱 小程序(WebApp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs text-muted-foreground">
                {btn.type === "web_app" ? "Mini App URL（如：https://t.me/xxx?startapp=yyy）" : "跳转链接（如：https://t.me/channel）"}
              </Label>
              <Input placeholder={btn.type === "web_app" ? "https://t.me/BotName?startapp=..." : "https://..."} value={btn.url}
                onChange={e => updateButton(idx, "url", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">行号</Label>
              <Input type="number" placeholder="0" value={btn.row ?? 0}
                onChange={e => updateButton(idx, "row", parseInt(e.target.value) || 0)}
                title="同行号的按钮排在同一行" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">💡 行号相同的按钮显示在同一行，行号不同则换行</p>
        </div>
      ))}
      {buttons.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">暂无按钮</p>
          <p className="text-xs text-muted-foreground mt-1">点击"添加按钮"可为消息添加 Telegram inline 按钮</p>
        </div>
      )}
    </div>
  );
}

// ==================== ACTIVITY LINK BAR ====================
function ActivityLinkBar({ label, link, onCopy, onSendToTG }: { label: string; link: string; onCopy?: () => void; onSendToTG?: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`${label}已复制`);
    onCopy?.();
  };
  return (
    <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 text-xs">
      <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <code className="flex-1 truncate text-foreground font-mono">{link}</code>
      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleCopy}>
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </Button>
      {onSendToTG && (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-blue-400 hover:text-blue-300" onClick={onSendToTG} title="发送给TG用户">
          <Send className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

// ==================== UNIFIED TG PUSH DIALOG ====================
/** Unified TG push dialog: send to multiple groups OR broadcast to bot users */
function TgPushDialog({ open, onOpenChange, title, content: defaultContent, imageUrl, buttons: defaultButtons }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  content: string;
  imageUrl?: string;
  buttons?: Array<{ text: string; url: string; type?: string; row?: number }>;
}) {
  const [mode, setMode] = useState<"groups" | "broadcast">("groups");
  const [content, setContent] = useState(defaultContent);

  // ---- Group mode state ----
  const [selectedGroupChatIds, setSelectedGroupChatIds] = useState<string[]>([]);
  const [groupResult, setGroupResult] = useState<{ sent: number; failed: number; results: Array<{ name: string; chatId: string; success: boolean; error?: string }> } | null>(null);
  const { data: botGroupsData, isLoading: groupsLoading, refetch: refetchGroups } = trpc.marketing.getBotAdminGroups.useQuery(undefined, { enabled: open && mode === "groups" });

  // ---- Broadcast (bot user) mode state ----
  const [userFilter, setUserFilter] = useState<"all" | "active" | "deposited">("all");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSelectMode, setUserSelectMode] = useState<"filter" | "pick">("filter"); // filter=use category, pick=manual select
  const { data: botUsersData, isLoading: usersLoading } = trpc.marketing.getBotFollowers.useQuery(
    { filter: userFilter, search: userSearch || undefined, limit: 100 },
    { enabled: open && mode === "broadcast" && userSelectMode === "pick" }
  );

  const groupsMut = trpc.marketing.sendToGroups.useMutation({
    onSuccess: (res) => {
      setGroupResult(res);
      toast.success(`已发送到 ${res.sent} 个群组${res.failed > 0 ? `，${res.failed} 个失败` : ''}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const directGroupsMut = trpc.marketing.sendToGroupsByChatId.useMutation({
    onSuccess: (res) => {
      setGroupResult({ sent: res.sent, failed: res.failed, results: res.results.map(r => ({ name: r.chatId, chatId: r.chatId, success: r.success, error: r.error })) });
      toast.success(`已发送到 ${res.sent} 个群组${res.failed > 0 ? `，${res.failed} 个失败` : ''}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const broadcastMut = trpc.marketing.createBroadcast.useMutation({
    onSuccess: () => { toast.success("群发任务已创建，正在后台发送..."); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });
  const broadcastToUsersMut = trpc.marketing.broadcastToUsers.useMutation({
    onSuccess: (res) => { toast.success(`已创建定向推送任务 #${res.taskId}，正在发送...`); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  // Merge TG-discovered groups with manual groups, deduplicate by chatId
  const allGroups = useMemo(() => {
    const map = new Map<string, { id?: number; chatId: string; name: string; type: string; source: "tg" | "manual"; enabled?: boolean }>();
    (botGroupsData?.tgGroups || []).forEach(g => map.set(g.chatId, { chatId: g.chatId, name: g.name, type: g.type, source: "tg" }));
    (botGroupsData?.manualGroups || []).forEach(g => {
      if (!map.has(g.chatId)) map.set(g.chatId, { id: g.id, chatId: g.chatId, name: g.name, type: g.type, source: "manual", enabled: g.enabled });
      else { const existing = map.get(g.chatId)!; map.set(g.chatId, { ...existing, id: g.id, name: g.name, source: "manual", enabled: g.enabled }); }
    });
    return Array.from(map.values()).filter(g => g.enabled !== false);
  }, [botGroupsData]);

  const toggleGroupChatId = (chatId: string) => {
    setSelectedGroupChatIds(prev => prev.includes(chatId) ? prev.filter(x => x !== chatId) : [...prev, chatId]);
  };
  const toggleAllGroups = () => {
    if (selectedGroupChatIds.length === allGroups.length) setSelectedGroupChatIds([]);
    else setSelectedGroupChatIds(allGroups.map(g => g.chatId));
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAllUsers = () => {
    const ids = botUsersData?.users.map(u => u.id) || [];
    if (selectedUserIds.length === ids.length) setSelectedUserIds([]);
    else setSelectedUserIds(ids);
  };

  const handleSend = () => {
    if (!content.trim()) { toast.error("请输入消息内容"); return; }
    if (mode === "groups") {
      if (selectedGroupChatIds.length === 0) { toast.error("请至少选择一个群组"); return; }
      // Map chatIds to manual group IDs where available
      const manualGroupIds = selectedGroupChatIds
        .map(chatId => allGroups.find(g => g.chatId === chatId)?.id)
        .filter(Boolean) as number[];
      // Groups without DB IDs (TG-auto-discovered) — send by chatId directly
      const directChatIds = selectedGroupChatIds.filter(chatId => !allGroups.find(g => g.chatId === chatId)?.id);
      if (manualGroupIds.length > 0 && directChatIds.length === 0) {
        groupsMut.mutate({ groupIds: manualGroupIds, content, imageUrl, buttons: defaultButtons });
      } else if (directChatIds.length > 0 && manualGroupIds.length === 0) {
        directGroupsMut.mutate({ chatIds: directChatIds, content, imageUrl, buttons: defaultButtons });
      } else if (manualGroupIds.length > 0 && directChatIds.length > 0) {
        // Mixed: send both
        groupsMut.mutate({ groupIds: manualGroupIds, content, imageUrl, buttons: defaultButtons });
        directGroupsMut.mutate({ chatIds: directChatIds, content, imageUrl, buttons: defaultButtons });
      }
    } else {
      if (userSelectMode === "pick") {
        if (selectedUserIds.length === 0) { toast.error("请至少选择一个用户"); return; }
        broadcastToUsersMut.mutate({ userIds: selectedUserIds, content, imageUrl, buttons: defaultButtons });
      } else {
        broadcastMut.mutate({
          title: `${title || '快速推送'}-${new Date().toLocaleString()}`,
          content, targetType: userFilter, buttons: defaultButtons || [], imageUrl,
        });
      }
    }
  };

  const isPending = groupsMut.isPending || directGroupsMut.isPending || broadcastMut.isPending || broadcastToUsersMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setGroupResult(null); setSelectedGroupChatIds([]); setSelectedUserIds([]); } onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📤 {title || 'TG 推送'}</DialogTitle></DialogHeader>
        {groupResult ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-center">
              <div className="flex-1 bg-green-500/10 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-500">{groupResult.sent}</div>
                <div className="text-xs text-muted-foreground">发送成功</div>
              </div>
              {groupResult.failed > 0 && (
                <div className="flex-1 bg-destructive/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-destructive">{groupResult.failed}</div>
                  <div className="text-xs text-muted-foreground">发送失败</div>
                </div>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groupResult.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded ${r.success ? 'bg-green-500/5' : 'bg-destructive/5'}`}>
                  <span className={r.success ? 'text-green-500' : 'text-destructive'}>{r.success ? '✓' : '✗'}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{r.chatId}</span>
                  {r.error && <span className="text-destructive ml-auto truncate max-w-32">{r.error}</span>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupResult(null)}>继续发送</Button>
              <Button onClick={() => { setGroupResult(null); onOpenChange(false); }}>关闭</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "groups" ? "default" : "outline"} onClick={() => setMode("groups")} className="flex-1">
                <Send className="w-3 h-3 mr-1" />发送到群组/频道
              </Button>
              <Button size="sm" variant={mode === "broadcast" ? "default" : "outline"} onClick={() => setMode("broadcast")} className="flex-1">
                <Users className="w-3 h-3 mr-1" />群发给Bot用户
              </Button>
            </div>

            {/* ===== GROUP MODE ===== */}
            {mode === "groups" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>选择群组/频道</Label>
                  <div className="flex gap-1.5">
                    {allGroups.length > 0 && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={toggleAllGroups}>
                        {selectedGroupChatIds.length === allGroups.length ? '取消全选' : '全选'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => refetchGroups()}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {groupsLoading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">正在拉取Bot群组...</div>
                ) : allGroups.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground bg-secondary/30 rounded-lg">
                    <p>未发现群组。请将 Bot 加入群组并发一条消息，或在「群组管理」中手动添加</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                    {allGroups.map((g, idx) => (
                      <div key={g.chatId}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedGroupChatIds.includes(g.chatId) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50'}`}
                        onClick={() => toggleGroupChatId(g.chatId)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedGroupChatIds.includes(g.chatId) ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selectedGroupChatIds.includes(g.chatId) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{g.name}</span>
                            <Badge variant="outline" className="text-xs shrink-0">{g.type}</Badge>
                            {g.source === "tg" && <Badge variant="secondary" className="text-xs shrink-0">TG自动</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">{g.chatId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedGroupChatIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">已选 {selectedGroupChatIds.length} / {allGroups.length} 个群组</p>
                )}
              </div>
            )}

            {/* ===== BROADCAST (BOT USER) MODE ===== */}
            {mode === "broadcast" && (
              <div className="space-y-3">
                {/* Sub-mode: filter vs manual pick */}
                <div className="flex gap-2">
                  <Button size="sm" variant={userSelectMode === "filter" ? "default" : "outline"} onClick={() => setUserSelectMode("filter")} className="flex-1 text-xs">
                    快速分类发送
                  </Button>
                  <Button size="sm" variant={userSelectMode === "pick" ? "default" : "outline"} onClick={() => setUserSelectMode("pick")} className="flex-1 text-xs">
                    手动选择用户
                  </Button>
                </div>

                {userSelectMode === "filter" && (
                  <div>
                    <Label className="text-xs">目标用户分类</Label>
                    <Select value={userFilter} onValueChange={v => setUserFilter(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部关注Bot的用户</SelectItem>
                        <SelectItem value="active">活跃用户（30天内登录）</SelectItem>
                        <SelectItem value="deposited">已充値用户</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {userSelectMode === "pick" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          className="pl-7 h-8 text-sm"
                          placeholder="搜索昵称/TG用户名..."
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                        />
                      </div>
                      <Select value={userFilter} onValueChange={v => setUserFilter(v as any)}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="active">活跃</SelectItem>
                          <SelectItem value="deposited">已充値</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>共 {botUsersData?.total ?? 0} 个用户</span>
                      {(botUsersData?.users.length ?? 0) > 0 && (
                        <button className="text-primary hover:underline" onClick={toggleAllUsers}>
                          {selectedUserIds.length === (botUsersData?.users.length ?? 0) ? '取消全选' : '全选当前页'}
                        </button>
                      )}
                    </div>
                    {usersLoading ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">加载中...</div>
                    ) : (
                      <div className="space-y-0.5 max-h-48 overflow-y-auto border border-border rounded-lg p-1.5">
                        {(botUsersData?.users || []).map(u => (
                          <div key={u.id}
                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedUserIds.includes(u.id) ? 'bg-primary/10' : 'hover:bg-secondary/50'}`}
                            onClick={() => toggleUser(u.id)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedUserIds.includes(u.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                              {selectedUserIds.includes(u.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{u.nickname || u.name || `User#${u.id}`}</span>
                              {u.tgUsername && <span className="text-xs text-muted-foreground ml-1">@{u.tgUsername}</span>}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono shrink-0">{u.tgId}</span>
                          </div>
                        ))}
                        {(botUsersData?.users.length ?? 0) === 0 && (
                          <div className="text-center py-4 text-sm text-muted-foreground">暂无用户</div>
                        )}
                      </div>
                    )}
                    {selectedUserIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">已选 {selectedUserIds.length} 个用户</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message content */}
            <div>
              <Label>消息内容（支持 HTML）</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} />
            </div>
            {defaultButtons && defaultButtons.length > 0 && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2">
                <span className="font-medium">按鈕：</span>
                {defaultButtons.map((b, i) => <Badge key={i} variant="outline" className="ml-1">{b.text}</Badge>)}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleSend} disabled={isPending}>
                <Send className="w-4 h-4 mr-1" />{isPending ? "发送中..." : "确认发送"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Alias for backward compat
const QuickBroadcastDialog = TgPushDialog;

// ==================== MARKETING STATS BAR ====================
function MarketingStatsBar({ items }: { items: Array<{ label: string; value: string | number; highlight?: boolean }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item, i) => (
        <div key={i} className="bg-secondary/40 rounded-lg p-2.5 text-center">
          <div className={`text-lg font-bold ${item.highlight ? 'text-green-500' : ''}`}>{item.value}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
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
    targetFilter: undefined as any,
  });
  const resetForm = () => setForm({ title: "", content: "", imageUrl: "", buttons: [], targetType: "all", targetFilter: undefined });

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
              <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
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
              <TargetFilterEditor filter={form.targetFilter} onChange={f => setForm(prev => ({ ...prev, targetFilter: f }))} targetType={form.targetType} />
            </div>
            {/* Right: Preview */}
            <div>
              <MessagePreview content={form.content} imageUrl={form.imageUrl || undefined} buttons={form.buttons} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMutation.mutate({
              title: form.title,
              content: form.content,
              targetType: form.targetType,
              imageUrl: form.imageUrl || undefined,
              buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : undefined,
              targetFilter: form.targetFilter || undefined,
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
  const { data: overallStats } = trpc.marketing.fissionOverallStats.useQuery();
  const { data: publicConfig } = trpc.config.getPublic.useQuery();
  const botUsername = publicConfig?.tg_bot_username || '';
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
  const [fissionPushDialog, setFissionPushDialog] = useState<{ open: boolean; campaignId: number; campaignName: string } | null>(null);
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
  const copyTgLink = (code: string) => {
    if (!botUsername) { toast.error("请先配置 Bot Username"); return; }
    const url = `https://t.me/${botUsername}/app?startapp=fission_${code}`;
    navigator.clipboard.writeText(url);
    toast.success("TG 活动链接已复制");
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
      {/* Overall Stats */}
      {overallStats && (
        <MarketingStatsBar items={[
          { label: "总活动数", value: overallStats.totalCampaigns },
          { label: "总点击", value: overallStats.totalClicks },
          { label: "总注册", value: overallStats.totalRegisters },
          { label: "总发放奖励", value: `${formatBalance(parseFloat(overallStats.totalRewardPaid))}`, highlight: true },
        ]} />
      )}
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
              <div key={c.id} className="border border-border rounded-lg p-4 bg-card space-y-2">
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
                {/* Activity Links */}
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <ActivityLinkBar label="网页链接" link={`${window.location.origin}/api/ref/${c.linkCode}`} />
                  {botUsername && <ActivityLinkBar label="TG 链接" link={`https://t.me/${botUsername}/app?startapp=fission_${c.linkCode}`}
                    onSendToTG={() => setFissionPushDialog({ open: true, campaignId: c.id, campaignName: c.name })}
                  />}
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
      {/* Fission Push Dialog */}
      {fissionPushDialog && (
        <CallbackPushDialog
          open={fissionPushDialog.open}
          onOpenChange={(v: boolean) => { if (!v) setFissionPushDialog(null); }}
          title={`裂变推送: ${fissionPushDialog.campaignName}`}
          pushType="fission"
          pushId={fissionPushDialog.campaignId}
        />
      )}
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

// ==================== IMAGE UPLOADER COMPONENT ====================
function ImageUploader({ value, onChange, label }: { value: string; onChange: (url: string) => void; label?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileData: base64, contentType: file.type }),
      });
      if (!res.ok) throw new Error("上传失败");
      const { url } = await res.json();
      onChange(url);
      toast.success("图片上传成功");
    } catch (e: any) {
      toast.error(e.message || "上传失败");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  return (
    <div className="space-y-1.5">
      <Label>{label || "图片（可选）"}</Label>
      <div className="flex gap-2">
        <Input className="flex-1" value={value} onChange={e => onChange(e.target.value)} placeholder="图片 URL 或点击上传" />
        <Button type="button" size="sm" variant="outline" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}>
          {uploading ? "上传中..." : <><Upload className="w-3 h-3 mr-1" />上传</>}
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
      {value && (
        <div className="rounded overflow-hidden border border-border bg-secondary/30 max-w-[200px]">
          <img src={value} alt="" className="w-full h-20 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">支持 JPG/PNG/GIF，最大 5MB。建议尺寸：800×400px</p>
    </div>
  );
}

// ==================== TARGET FILTER EDITOR ====================
function TargetFilterEditor({ filter, onChange, targetType }: {
  filter: any;
  onChange: (f: any) => void;
  targetType: string;
}) {
  const [showFilter, setShowFilter] = useState(!!filter && Object.keys(filter).length > 0);
  const estimateQuery = trpc.marketing.estimateTargetCount.useQuery(
    { targetType: targetType as any, targetFilter: filter || undefined },
    { enabled: showFilter, refetchOnWindowFocus: false }
  );

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "zh", label: "简体中文" },
    { value: "zh-hant", label: "繁體中文" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
    { value: "ar", label: "العربية" },
    { value: "es", label: "Español" },
    { value: "pt", label: "Português" },
    { value: "ru", label: "Русский" },
    { value: "vi", label: "Tiếng Việt" },
    { value: "th", label: "ไทย" },
    { value: "id", label: "Bahasa" },
  ];

  if (!showFilter) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setShowFilter(true)}>
        <Filter className="w-3 h-3 mr-1" />高级筛选
      </Button>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">高级筛选条件</Label>
        <div className="flex items-center gap-2">
          {estimateQuery.data !== undefined && (
            <Badge variant="secondary" className="text-xs">预估 {estimateQuery.data.count} 人</Badge>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowFilter(false); onChange(undefined); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {/* Language filter */}
      <div>
        <Label className="text-xs">语言</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {languageOptions.map(lang => (
            <button key={lang.value} type="button"
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                filter?.languages?.includes(lang.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 border-border hover:border-primary/50"
              }`}
              onClick={() => {
                const current = filter?.languages || [];
                const updated = current.includes(lang.value)
                  ? current.filter((l: string) => l !== lang.value)
                  : [...current, lang.value];
                onChange({ ...filter, languages: updated.length > 0 ? updated : undefined });
              }}>
              {lang.label}
            </button>
          ))}
        </div>
      </div>
      {/* Deposit range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">最低充值</Label>
          <Input type="number" className="h-7 text-xs" placeholder="0" value={filter?.minDeposit || ""}
            onChange={e => onChange({ ...filter, minDeposit: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <Label className="text-xs">最高充值</Label>
          <Input type="number" className="h-7 text-xs" placeholder="不限" value={filter?.maxDeposit || ""}
            onChange={e => onChange({ ...filter, maxDeposit: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      {/* Games played */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">最少游戏局数</Label>
          <Input type="number" className="h-7 text-xs" placeholder="0" value={filter?.minGamesPlayed || ""}
            onChange={e => onChange({ ...filter, minGamesPlayed: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <Label className="text-xs">最多游戏局数</Label>
          <Input type="number" className="h-7 text-xs" placeholder="不限" value={filter?.maxGamesPlayed || ""}
            onChange={e => onChange({ ...filter, maxGamesPlayed: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      {/* Registration date */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">注册时间（起）</Label>
          <Input type="date" className="h-7 text-xs" value={filter?.registeredAfter || ""}
            onChange={e => onChange({ ...filter, registeredAfter: e.target.value || undefined })} />
        </div>
        <div>
          <Label className="text-xs">注册时间（止）</Label>
          <Input type="date" className="h-7 text-xs" value={filter?.registeredBefore || ""}
            onChange={e => onChange({ ...filter, registeredBefore: e.target.value || undefined })} />
        </div>
      </div>
      {/* Last active */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">最后活跃（起）</Label>
          <Input type="date" className="h-7 text-xs" value={filter?.lastActiveAfter || ""}
            onChange={e => onChange({ ...filter, lastActiveAfter: e.target.value || undefined })} />
        </div>
        <div>
          <Label className="text-xs">最后活跃（止）</Label>
          <Input type="date" className="h-7 text-xs" value={filter?.lastActiveBefore || ""}
            onChange={e => onChange({ ...filter, lastActiveBefore: e.target.value || undefined })} />
        </div>
      </div>
      {/* Bonus status */}
      <div>
        <Label className="text-xs">奖金状态</Label>
        <Select value={filter?.bonusStatus || "any"} onValueChange={v => onChange({ ...filter, bonusStatus: v === "any" ? undefined : v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">不限</SelectItem>
            <SelectItem value="locked">有锁定奖金</SelectItem>
            <SelectItem value="unlocked">奖金已解锁</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ==================== MESSAGE TEMPLATES PANEL ====================
function TemplatesPanel() {
  const { data: templates, isLoading, refetch } = trpc.marketing.listTemplates.useQuery();
  const createMutation = trpc.marketing.createTemplate.useMutation({
    onSuccess: () => { toast.success("模板已创建"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketing.deleteTemplate.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.marketing.updateTemplate.useMutation({
    onSuccess: () => { toast.success("模板已更新"); setEditingId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", content: "", imageUrl: "",
    buttons: [] as Array<{ text: string; url: string; row?: number }>,
    category: "general",
  });
  const resetForm = () => setForm({ name: "", content: "", imageUrl: "", buttons: [], category: "general" });

  const startEdit = (tpl: any) => {
    setForm({
      name: tpl.name,
      content: tpl.content,
      imageUrl: tpl.imageUrl || "",
      buttons: tpl.buttons || [],
      category: tpl.category || "general",
    });
    setEditingId(tpl.id);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">消息模板</h3>
          <p className="text-sm text-muted-foreground">可复用的消息模板，群发时可直接选用</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => { resetForm(); setEditingId(null); setShowCreate(true); }}><Plus className="w-4 h-4 mr-1" />新建模板</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !templates?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无消息模板</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-medium text-sm">{tpl.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{tpl.category}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(tpl)}><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: tpl.id }); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <MessagePreview content={tpl.content} imageUrl={tpl.imageUrl || undefined} buttons={tpl.buttons || []} />
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "编辑模板" : "新建消息模板"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>模板名称</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：活动推广模板" />
              </div>
              <div>
                <Label>消息内容（支持 HTML）</Label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="消息正文，支持 <b>加粗</b>、<i>斜体</i>、<a href='...'>链接</a>" rows={4} />
              </div>
              <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
              <ButtonEditor buttons={form.buttons} onChange={buttons => setForm(f => ({ ...f, buttons }))} />
              <div>
                <Label>分类</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="general" />
              </div>
            </div>
            <div>
              <MessagePreview content={form.content} imageUrl={form.imageUrl || undefined} buttons={form.buttons} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>取消</Button>
            <Button onClick={() => {
              if (editingId) {
                updateMutation.mutate({
                  id: editingId,
                  name: form.name,
                  content: form.content,
                  imageUrl: form.imageUrl || null,
                  buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : null,
                  category: form.category,
                });
              } else {
                createMutation.mutate({
                  ...form,
                  imageUrl: form.imageUrl || undefined,
                  buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : undefined,
                });
              }
            }} disabled={!form.name || !form.content || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "保存中..." : editingId ? "更新模板" : "创建模板"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== WELCOME TEMPLATES PANEL ====================
function WelcomePanel() {
  const { data: templates, isLoading, refetch } = trpc.marketing.listWelcomeTemplates.useQuery();
  const createMutation = trpc.marketing.createWelcomeTemplate.useMutation({
    onSuccess: () => { toast.success("欢迎消息已创建"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.marketing.updateWelcomeTemplate.useMutation({
    onSuccess: () => { toast.success("已更新"); setEditingId(null); setShowCreate(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketing.deleteWelcomeTemplate.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    language: "en", content: "", imageUrl: "",
    buttons: [] as Array<{ text: string; url: string; row?: number }>,
    isActive: true,
  });
  const resetForm = () => setForm({ language: "en", content: "", imageUrl: "", buttons: [], isActive: true });

  const languageLabels: Record<string, string> = {
    en: "English", zh: "简体中文", "zh-hant": "繁體中文", "zh-tw": "繁體中文",
    ja: "日本語", ko: "한국어", ar: "العربية", es: "Español",
    pt: "Português", ru: "Русский", vi: "Tiếng Việt", th: "ไทย", id: "Bahasa Indonesia",
  };

  const startEdit = (tpl: any) => {
    setForm({
      language: tpl.language,
      content: tpl.content,
      imageUrl: tpl.imageUrl || "",
      buttons: tpl.buttons || [],
      isActive: tpl.isActive,
    });
    setEditingId(tpl.id);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">多语言欢迎消息</h3>
          <p className="text-sm text-muted-foreground">用户首次关注 Bot 时，根据 TG 语言自动发送对应欢迎消息（带图片+按钮）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => { resetForm(); setEditingId(null); setShowCreate(true); }}><Plus className="w-4 h-4 mr-1" />添加语言</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !templates?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无欢迎消息配置</p>
          <p className="text-xs mt-1">添加后，新用户首次 /start 将收到对应语言的图文欢迎消息</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className={`border rounded-lg p-3 bg-card ${tpl.isActive ? "border-border" : "border-border/50 opacity-60"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={tpl.isActive ? "default" : "secondary"}>{languageLabels[tpl.language] || tpl.language}</Badge>
                  {!tpl.isActive && <span className="text-xs text-muted-foreground">已禁用</span>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(tpl)}><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: tpl.id }); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <MessagePreview content={tpl.content} imageUrl={tpl.imageUrl || undefined} buttons={tpl.buttons || []} />
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "编辑欢迎消息" : "添加欢迎消息"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>语言</Label>
                <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(languageLabels).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label} ({code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>欢迎文案（支持 HTML）</Label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="欢迎消息内容，支持 HTML 格式" rows={4} />
              </div>
              <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} label="欢迎图片" />
              <ButtonEditor buttons={form.buttons} onChange={buttons => setForm(f => ({ ...f, buttons }))} />
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
                <Label>启用</Label>
              </div>
            </div>
            <div>
              <MessagePreview content={form.content} imageUrl={form.imageUrl || undefined} buttons={form.buttons} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>取消</Button>
            <Button onClick={() => {
              if (editingId) {
                updateMutation.mutate({
                  id: editingId,
                  language: form.language,
                  content: form.content,
                  imageUrl: form.imageUrl || null,
                  buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : null,
                  isActive: form.isActive,
                });
              } else {
                createMutation.mutate({
                  ...form,
                  imageUrl: form.imageUrl || undefined,
                  buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : undefined,
                });
              }
            }} disabled={!form.content || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "保存中..." : editingId ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== CALLBACK PUSH DIALOG (generic for coupon/checkin/event/fission) ====================
/** Generic push dialog for coupon/checkin/event/fission - uses dedicated push routes with callback_data */
function CallbackPushDialog({ open, onOpenChange, title, pushType, pushId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  pushType: "coupon" | "checkin" | "event" | "fission";
  pushId?: number; // required for coupon/event/fission
}) {
  const [mode, setMode] = useState<"groups" | "broadcast">("groups");
  const [selectedGroupChatIds, setSelectedGroupChatIds] = useState<string[]>([]);
  const [groupResult, setGroupResult] = useState<{ sent: number; failed: number; results: Array<{ chatId: string; success: boolean; error?: string }> } | null>(null);
  const [msgText, setMsgText] = useState("");
  const { data: botGroupsData } = trpc.marketing.getBotAdminGroups.useQuery(undefined, { enabled: open && mode === "groups" });

  const allGroups = useMemo(() => {
    const map = new Map<string, { id?: number; chatId: string; name: string; type: string; enabled?: boolean }>();
    (botGroupsData?.tgGroups || []).forEach(g => map.set(g.chatId, { chatId: g.chatId, name: g.name, type: g.type }));
    (botGroupsData?.manualGroups || []).forEach(g => {
      if (!map.has(g.chatId)) map.set(g.chatId, { id: g.id, chatId: g.chatId, name: g.name, type: g.type, enabled: g.enabled });
      else { const existing = map.get(g.chatId)!; map.set(g.chatId, { ...existing, id: g.id, name: g.name, enabled: g.enabled }); }
    });
    return Array.from(map.values()).filter(g => g.enabled !== false);
  }, [botGroupsData]);

  const toggleGroupChatId = (chatId: string) => {
    setSelectedGroupChatIds(prev => prev.includes(chatId) ? prev.filter(x => x !== chatId) : [...prev, chatId]);
  };
  const toggleAll = () => {
    if (selectedGroupChatIds.length === allGroups.length) setSelectedGroupChatIds([]);
    else setSelectedGroupChatIds(allGroups.map(g => g.chatId));
  };

  const couponPushMut = trpc.marketing.couponPush.useMutation({
    onSuccess: (res: any) => handlePushSuccess(res),
    onError: (e: any) => toast.error(e.message),
  });
  const checkinPushMut = trpc.marketing.checkinPush.useMutation({
    onSuccess: (res: any) => handlePushSuccess(res),
    onError: (e: any) => toast.error(e.message),
  });
  const eventPushMut = trpc.marketing.eventPush.useMutation({
    onSuccess: (res: any) => handlePushSuccess(res),
    onError: (e: any) => toast.error(e.message),
  });
  const fissionPushMut = trpc.marketing.fissionPush.useMutation({
    onSuccess: (res: any) => handlePushSuccess(res),
    onError: (e: any) => toast.error(e.message),
  });

  const handlePushSuccess = (res: any) => {
    if (mode === "groups" && res.results) {
      setGroupResult({ sent: res.sent || 0, failed: res.failed || 0, results: res.results });
      toast.success(`已发送到 ${res.sent} 个群组${res.failed ? `，${res.failed} 个失败` : ''}`);
    } else {
      toast.success("推送任务已创建，正在后台发送...");
      onOpenChange(false);
    }
  };

  const isPending = couponPushMut.isPending || checkinPushMut.isPending || eventPushMut.isPending || fissionPushMut.isPending;

  const handleSend = () => {
    if (mode === "groups" && selectedGroupChatIds.length === 0) { toast.error("请至少选择一个群组"); return; }
    const commonPayload = {
      mode: (mode === "groups" ? "group" : "broadcast") as "group" | "broadcast",
      groupChatIds: mode === "groups" ? selectedGroupChatIds : undefined,
      message: msgText || undefined,
    };
    if (pushType === "coupon") {
      couponPushMut.mutate({ couponId: pushId!, ...commonPayload });
    } else if (pushType === "checkin") {
      checkinPushMut.mutate(commonPayload);
    } else if (pushType === "event") {
      eventPushMut.mutate({ eventId: pushId!, ...commonPayload });
    } else if (pushType === "fission") {
      fissionPushMut.mutate({ campaignId: pushId!, ...commonPayload });
    }
  };

  const pushTypeLabels: Record<string, string> = { coupon: "优惠券", checkin: "签到", event: "活动", fission: "裂变" };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) { setGroupResult(null); setSelectedGroupChatIds([]); } onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📤 {title}</DialogTitle></DialogHeader>
        {groupResult ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-center">
              <div className="flex-1 bg-green-500/10 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-500">{groupResult.sent}</div>
                <div className="text-xs text-muted-foreground">发送成功</div>
              </div>
              {groupResult.failed > 0 && (
                <div className="flex-1 bg-destructive/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-destructive">{groupResult.failed}</div>
                  <div className="text-xs text-muted-foreground">发送失败</div>
                </div>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groupResult.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded ${r.success ? 'bg-green-500/5' : 'bg-destructive/5'}`}>
                  <span className={r.success ? 'text-green-500' : 'text-destructive'}>{r.success ? '✓' : '✗'}</span>
                  <span className="font-medium">{r.chatId}</span>
                  {r.error && <span className="text-destructive ml-auto truncate max-w-32">{r.error}</span>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupResult(null)}>继续发送</Button>
              <Button onClick={() => { setGroupResult(null); onOpenChange(false); }}>关闭</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "groups" ? "default" : "outline"} onClick={() => setMode("groups")} className="flex-1">
                <Send className="w-3 h-3 mr-1" />发送到群组/频道
              </Button>
              <Button size="sm" variant={mode === "broadcast" ? "default" : "outline"} onClick={() => setMode("broadcast")} className="flex-1">
                <Users className="w-3 h-3 mr-1" />群发给Bot用户
              </Button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
              ℹ️ 群组推送使用 callback_data 按钮，用户可在群内直接点击“{pushTypeLabels[pushType]}”按钮完成操作，无需跳转网页。
            </div>

            <div>
              <Label>自定义推送文案（可选，留空用默认）</Label>
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3} placeholder="留空将使用默认文案" />
            </div>

            {mode === "groups" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>选择群组/频道</Label>
                  {allGroups.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={toggleAll}>
                      {selectedGroupChatIds.length === allGroups.length ? '取消全选' : '全选'}
                    </Button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {allGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">暂无可用群组，请先在“TG群组管理”中添加</p>
                  ) : allGroups.map(g => (
                    <label key={g.chatId} className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                      <input type="checkbox" checked={selectedGroupChatIds.includes(g.chatId)} onChange={() => toggleGroupChatId(g.chatId)} className="rounded" />
                      <span className="text-sm flex-1 truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.type}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">已选 {selectedGroupChatIds.length} / {allGroups.length} 个群组</p>
              </div>
            )}

            {mode === "broadcast" && (
              <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
                将向所有 Bot 用户发送{pushTypeLabels[pushType]}消息（私聊用 url 按钮，点击跳转 Mini App）
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleSend} disabled={isPending}>
                <Send className="w-4 h-4 mr-1" />{isPending ? "发送中..." : "确认发送"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== COUPONS PANEL ====================
function CouponsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [couponPushDialog, setCouponPushDialog] = useState<{ open: boolean; couponId: number; couponName: string } | null>(null);
  const [form, setForm] = useState({ code: "", type: "fixed" as "fixed" | "percent", amount: "", minDeposit: "0", maxUses: "100", perUserLimit: "1", expiresAt: "" });
  const { data: coupons, refetch } = trpc.marketing.couponList.useQuery();
  const { data: couponStats } = trpc.marketing.couponStats.useQuery();
  const createMut = trpc.marketing.couponCreate.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); toast.success("创建成功"); } });
  const deleteMut = trpc.marketing.couponDelete.useMutation({ onSuccess: () => { refetch(); toast.success("已删除"); } });
  const toggleStatusMut = trpc.marketing.couponUpdate.useMutation({ onSuccess: () => { refetch(); toast.success("状态已更新"); } });
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">优惠券/红包管理</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />创建优惠券</Button>
      </div>
      {couponStats && (
        <MarketingStatsBar items={[
          { label: "总使用次数", value: couponStats.totalClaims },
          { label: "总发放金额", value: `${formatBalance(parseFloat(couponStats.totalAmount))}`, highlight: true },
          { label: "近期领取", value: couponStats.recentClaims?.length || 0 },
          { label: "优惠券总数", value: coupons?.length || 0 },
        ]} />
      )}

      <div className="grid gap-3">
        {coupons?.map((c: any) => (
          <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{c.code}</code>
                <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "活跃" : "停用"}</Badge>
                <Badge variant="outline">{c.type === "fixed" ? `固定 ${c.amount}` : `${c.amount}% 加赠`}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                已使用 {c.usedCount}/{c.maxUses} | 单人限{c.perUserLimit}次 | {c.expiresAt ? `过期: ${new Date(c.expiresAt).toLocaleDateString()}` : "永不过期"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => setCouponPushDialog({ open: true, couponId: c.id, couponName: c.name || c.code })} title="推送到TG">
                <Send className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleStatusMut.mutate({ id: c.id, status: c.status === "active" ? "paused" : "active" })} title={c.status === "active" ? "暂停" : "启用"}>
                {c.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("确认删除该优惠券？")) deleteMut.mutate({ id: c.id }); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {(!coupons || coupons.length === 0) && <div className="text-center text-muted-foreground py-8">暂无优惠券</div>}
      </div>

      {/* Coupon Push Dialog */}
      {couponPushDialog && (
        <CallbackPushDialog
          open={couponPushDialog.open}
          onOpenChange={(v: boolean) => { if (!v) setCouponPushDialog(null); }}
          title={`优惠券推送: ${couponPushDialog.couponName}`}
          pushType="coupon"
          pushId={couponPushDialog.couponId}
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建优惠券</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>兑换码</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="留空自动生成" /></div>
            <div><Label>类型</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="fixed">固定金额</SelectItem><SelectItem value="percent">充值加赠%</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>{form.type === "fixed" ? "奖励金额" : "加赠比例(%)"}</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>最低充值金额</Label><Input type="number" value={form.minDeposit} onChange={e => setForm(f => ({ ...f, minDeposit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>总次数</Label><Input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} /></div>
              <div><Label>单人限领</Label><Input type="number" value={form.perUserLimit} onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))} /></div>
            </div>
            <div><Label>过期时间(可选)</Label><Input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMut.mutate({ code: form.code || "AUTO", name: form.code || "Coupon", type: form.type as "fixed" | "percent" | "chips", amount: String(form.amount), minDeposit: form.minDeposit ? String(form.minDeposit) : undefined, maxUses: Number(form.maxUses), maxPerUser: Number(form.perUserLimit), expiresAt: form.expiresAt ? new Date(form.expiresAt) : undefined })} disabled={!form.amount || createMut.isPending}>
              {createMut.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== CHECKIN PANEL ====================
function CheckinPanel() {
  const { data: configList, refetch } = trpc.marketing.checkinConfig.useQuery();
  const { data: checkinStats } = trpc.marketing.checkinStats.useQuery();
  const updateMut = trpc.marketing.checkinConfigUpdate.useMutation({ onSuccess: () => { refetch(); toast.success("保存成功"); } });
  const [rewards, setRewards] = useState<string>("");
  const [checkinPushOpen, setCheckinPushOpen] = useState(false);
  // configList is array of { dayNumber, reward }
  const configDisplay = configList ? JSON.stringify(configList.map((c: any) => Number(c.reward))) : "[1,1.5,2,2.5,3,4,5]";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">签到奖励配置</h3>
        <Button size="sm" variant="outline" className="text-blue-500" onClick={() => setCheckinPushOpen(true)}>
          <Send className="w-3 h-3 mr-1" />推送签到提醒
        </Button>
      </div>
      {checkinStats && (
        <MarketingStatsBar items={[
          { label: "总签到次数", value: checkinStats.totalCheckins },
          { label: "总发放金额", value: `${formatBalance(parseFloat(checkinStats.totalReward))}`, highlight: true },
          { label: "今日签到", value: checkinStats.todayCheckins },
          { label: "近期记录", value: checkinStats.recentCheckins?.length || 0 },
        ]} />
      )}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div>
          <Label>每日奖励金额 (JSON数组，第1-7天)</Label>
          <Input value={rewards || configDisplay} onChange={e => setRewards(e.target.value)} placeholder='[1,1.5,2,2.5,3,4,5]' />
          <p className="text-xs text-muted-foreground mt-1">例: [1,1.5,2,2.5,3,4,5] 表示第1天得1，第7天得5</p>
        </div>
        <Button onClick={() => {
          try {
            const parsed = JSON.parse(rewards || configDisplay) as number[];
            const input = parsed.map((r, i) => ({ dayNumber: i + 1, reward: String(r) }));
            updateMut.mutate(input);
          } catch { toast.error("奖励数组格式错误"); }
        }} disabled={updateMut.isPending}>
          {updateMut.isPending ? "保存中..." : "保存配置"}
        </Button>
      </div>
      <div className="bg-muted/30 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">当前配置：每{configList?.length || 7}天一个周期</p>
        <p className="text-sm text-muted-foreground">每日奖励: {configDisplay}</p>
      </div>

      <CallbackPushDialog
        open={checkinPushOpen}
        onOpenChange={setCheckinPushOpen}
        title="签到提醒推送"
        pushType="checkin"
      />
    </div>
  );
}

// ==================== INVITE REWARD PANEL ====================
function InviteRewardPanel() {
  const { data: config, refetch } = trpc.marketing.inviteRewardConfig.useQuery();
  const { data: stats } = trpc.marketing.inviteRewardStats.useQuery();
  const updateMut = trpc.marketing.inviteRewardConfigUpdate.useMutation({ onSuccess: () => { refetch(); toast.success("保存成功"); } });
  const [inviterReward, setInviterReward] = useState("");
  const [inviteeReward, setInviteeReward] = useState("");
  const [maxRewards, setMaxRewards] = useState("");

  const { data: fdConfig, refetch: fdRefetch } = trpc.marketing.firstDepositConfig.useQuery();
  const { data: fdStats } = trpc.marketing.firstDepositStats.useQuery();
  const fdUpdateMut = trpc.marketing.firstDepositConfigUpdate.useMutation({ onSuccess: () => { fdRefetch(); toast.success("首充配置已保存"); } });
  const [bonusPercent, setBonusPercent] = useState("");
  const [maxBonus, setMaxBonus] = useState("");

  return (
    <div className="space-y-6">
      {/* Invite Reward Config */}
      <div>
        <h3 className="text-lg font-semibold mb-3">邀请奖励配置</h3>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>邀请人奖励</Label><Input type="number" value={inviterReward || String(config?.inviterReward || "5.00")} onChange={e => setInviterReward(e.target.value)} /></div>
            <div><Label>被邀请人奖励</Label><Input type="number" value={inviteeReward || String(config?.inviteeReward || "3.00")} onChange={e => setInviteeReward(e.target.value)} /></div>
            <div><Label>每人最多邀请次数</Label><Input type="number" value={maxRewards || String(config?.maxRewardsPerUser || 0)} onChange={e => setMaxRewards(e.target.value)} /></div>
          </div>
          <Button onClick={() => updateMut.mutate({
            inviterReward: inviterReward || String(config?.inviterReward || "5.00"),
            inviteeReward: inviteeReward || String(config?.inviteeReward || "3.00"),
            maxRewardsPerUser: Number(maxRewards || config?.maxRewardsPerUser || 0),
            requireDeposit: config?.requireDeposit ?? false,
            minDepositAmount: config?.minDepositAmount || "0.00",
            enabled: config?.enabled ?? true,
          })} disabled={updateMut.isPending}>
            {updateMut.isPending ? "保存中..." : "保存配置"}
          </Button>
        </div>
        {stats && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="text-2xl font-bold">{stats.totalRewards}</div><div className="text-xs text-muted-foreground">总邀请数</div></div>
            <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="text-2xl font-bold">{stats.totalAmount}</div><div className="text-xs text-muted-foreground">总发放奖励</div></div>
            <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="text-2xl font-bold">{stats.recentRewards.length}</div><div className="text-xs text-muted-foreground">近期记录</div></div>
          </div>
        )}
      </div>

      {/* First Deposit Config */}
      <div>
        <h3 className="text-lg font-semibold mb-3">首充优惠配置</h3>
        {fdStats && (
          <MarketingStatsBar items={[
            { label: "总领取次数", value: fdStats.totalClaims },
            { label: "总发放奖励", value: `${formatBalance(parseFloat(fdStats.totalBonus))}`, highlight: true },
            { label: "总充值金额", value: `${formatBalance(parseFloat(fdStats.totalDeposits))}` },
            { label: "近期领取", value: fdStats.recentClaims?.length || 0 },
          ]} />
        )}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>加赠比例 (%)</Label><Input type="number" value={bonusPercent || String(fdConfig?.bonusPercent || 50)} onChange={e => setBonusPercent(e.target.value)} /></div>
            <div><Label>最高加赠金额</Label><Input value={maxBonus || String(fdConfig?.maxBonus || "100.00")} onChange={e => setMaxBonus(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">用户首次充值时，额外赠送充值金额的 {bonusPercent || fdConfig?.bonusPercent || 50}%，最高 {maxBonus || fdConfig?.maxBonus || "100.00"}</p>
          <Button onClick={() => fdUpdateMut.mutate({
            bonusPercent: Number(bonusPercent || fdConfig?.bonusPercent || 50),
            maxBonus: maxBonus || String(fdConfig?.maxBonus || "100.00"),
            enabled: fdConfig?.enabled ?? true,
          })} disabled={fdUpdateMut.isPending}>
            {fdUpdateMut.isPending ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== TIME-LIMITED EVENTS PANEL ====================
function TimeLimitedEventsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [eventPushDialog, setEventPushDialog] = useState<{ open: boolean; eventId: number; eventName: string } | null>(null);
  const [form, setForm] = useState({ name: "", type: "double_points" as string, description: "", startAt: "", endAt: "", config: "{}" });
  const { data: events, refetch } = trpc.marketing.eventList.useQuery();
  const { data: eventStats } = trpc.marketing.eventStats.useQuery();
  const createMut = trpc.marketing.eventCreate.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); toast.success("创建成功"); } });
  const deleteMut = trpc.marketing.eventDelete.useMutation({ onSuccess: () => { refetch(); toast.success("已删除"); } });
  const toggleStatusMut = trpc.marketing.eventUpdate.useMutation({ onSuccess: () => { refetch(); toast.success("状态已更新"); } });
  const eventTypeLabels: Record<string, string> = {
    double_points: "双倍积分",
    free_commission: "免佣金",
    deposit_bonus: "充值加赠",
    cashback: "返现活动",
    custom: "自定义",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">限时活动管理</h3>
                <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />创建活动</Button>
      </div>
      {eventStats && (
        <MarketingStatsBar items={[
          { label: "总活动数", value: eventStats.totalEvents },
          { label: "进行中", value: eventStats.activeEvents },
          { label: "已结束", value: eventStats.endedEvents },
          { label: "未开始", value: eventStats.upcomingEvents },
        ]} />
      )}
      <div className="grid gap-3">
        {events?.map((ev: any) => {
          const now = Date.now();
          const started = new Date(ev.startAt).getTime() <= now;
          const ended = new Date(ev.endAt).getTime() <= now;
          const status = ended ? "已结束" : started ? "进行中" : "未开始";
          const statusColor = ended ? "text-muted-foreground" : started ? "text-green-400" : "text-yellow-400";
          return (
            <div key={ev.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ev.name}</span>
                  <Badge variant="outline">{eventTypeLabels[ev.type] || ev.type}</Badge>
                  <span className={`text-xs ${statusColor}`}>{status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(ev.startAt).toLocaleString()} ~ {new Date(ev.endAt).toLocaleString()}
                </div>
                {ev.description && <div className="text-xs text-muted-foreground mt-0.5">{ev.description}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => setEventPushDialog({ open: true, eventId: ev.id, eventName: ev.name })} title="推送到TG">
                  <Send className="w-4 h-4" />
                </Button>
                {ev.status !== "cancelled" && ev.status !== "ended" && (
                  <Button variant="ghost" size="sm" onClick={() => toggleStatusMut.mutate({ id: ev.id, status: ev.status === "active" ? "cancelled" : "active" })} title={ev.status === "active" ? "取消活动" : "启用活动"}>
                    {ev.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("确认删除该活动？")) deleteMut.mutate({ id: ev.id }); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
        {(!events || events.length === 0) && <div className="text-center text-muted-foreground py-8">暂无限时活动</div>}
      </div>

      {/* Event Push Dialog */}
      {eventPushDialog && (
        <CallbackPushDialog
          open={eventPushDialog.open}
          onOpenChange={(v: boolean) => { if (!v) setEventPushDialog(null); }}
          title={`活动推送: ${eventPushDialog.eventName}`}
          pushType="event"
          pushId={eventPushDialog.eventId}
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建限时活动</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>活动名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>活动类型</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="double_points">双倍积分</SelectItem>
                  <SelectItem value="free_commission">免佣金</SelectItem>
                  <SelectItem value="deposit_bonus">充值加赠</SelectItem>
                  <SelectItem value="cashback">返现活动</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>活动描述</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>开始时间</Label><Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} /></div>
              <div><Label>结束时间</Label><Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} /></div>
            </div>
            <div><Label>配置(JSON)</Label><Input value={form.config} onChange={e => setForm(f => ({ ...f, config: e.target.value }))} placeholder='{"multiplier": 2}' /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              if (!form.name || !form.startAt || !form.endAt) { toast.error("请填写必填字段"); return; }
              createMut.mutate({ name: form.name, type: form.type as "double_points" | "no_rake" | "deposit_bonus" | "free_chips" | "custom", description: form.description, startTime: new Date(form.startAt), endTime: new Date(form.endAt), config: form.config ? JSON.parse(form.config) : undefined });
            }} disabled={createMut.isPending}>
              {createMut.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== NOTIFICATIONS PANEL ====================
function NotificationsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", imageUrl: "", buttons: [] as Array<{ text: string; url: string; type?: string; row?: number }>, targetType: "all" as string, scheduledAt: "" });
  const { data: notifications, refetch } = trpc.marketing.notificationList.useQuery();
  const createMut = trpc.marketing.notificationCreate.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); toast.success("创建成功"); } });
  const cancelMut = trpc.marketing.notificationCancel.useMutation({ onSuccess: () => { refetch(); toast.success("已取消"); } });
  const executeMut = trpc.marketing.notificationExecute.useMutation({ onSuccess: () => { refetch(); toast.success("已发送"); } });

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "待发送", color: "text-yellow-400" },
    sent: { label: "已发送", color: "text-green-400" },
    cancelled: { label: "已取消", color: "text-muted-foreground" },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">推送通知管理</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />创建通知</Button>
      </div>

      <div className="grid gap-3">
        {notifications?.map((n: any) => {
          const st = statusLabels[n.status] || { label: n.status, color: "" };
          return (
            <div key={n.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    <span className={`text-xs ${st.color}`}>{st.label}</span>
                    <Badge variant="outline">{n.targetType === "all" ? "全部用户" : n.targetType === "active" ? "活跃用户" : "指定用户"}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.content}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {n.scheduledAt ? `计划: ${new Date(n.scheduledAt).toLocaleString()}` : "立即发送"}
                    {n.sentAt && ` | 已发送: ${new Date(n.sentAt).toLocaleString()}`}
                    {n.sentCount != null && ` | 发送: ${n.sentCount}人`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {n.status === "pending" && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => executeMut.mutate({ id: n.id })}><Send className="w-4 h-4 text-green-400" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate({ id: n.id })}><X className="w-4 h-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {(!notifications || notifications.length === 0) && <div className="text-center text-muted-foreground py-8">暂无推送通知</div>}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>创建推送通知</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div><Label>标题</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>内容（支持 HTML）</Label><Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} /></div>
              <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
              <ButtonEditor buttons={form.buttons} onChange={buttons => setForm(f => ({ ...f, buttons }))} />
              <div><Label>目标用户</Label>
                <Select value={form.targetType} onValueChange={v => setForm(f => ({ ...f, targetType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部用户</SelectItem>
                    <SelectItem value="active">活跃用户 (7天内)</SelectItem>
                    <SelectItem value="deposited">有充值记录</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>定时发送(可选，留空则立即发送)</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
            </div>
            <div>
              <MessagePreview content={form.content} imageUrl={form.imageUrl || undefined} buttons={form.buttons} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => {
              if (!form.title || !form.content) { toast.error("请填写标题和内容"); return; }
              createMut.mutate({
                title: form.title,
                content: form.content,
                imageUrl: form.imageUrl || undefined,
                buttons: form.buttons.length > 0 ? form.buttons.filter(b => b.text && b.url) : undefined,
                targetType: form.targetType as "all" | "active" | "deposited" | "custom",
                scheduledAt: form.scheduledAt ? new Date(form.scheduledAt) : new Date(),
              });
            }} disabled={createMut.isPending}>
              {createMut.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== RED PACKET PANEL ====================
function RedPacketPanel() {
  const { data: packets, isLoading, refetch } = trpc.marketing.redPacketList.useQuery();
  const { data: rpStats } = trpc.marketing.redPacketOverallStats.useQuery();
  const { data: publicConfig2 } = trpc.config.getPublic.useQuery();
  const rpBotUsername = publicConfig2?.tg_bot_username || '';
  const [pushDialog, setPushDialog] = useState<{ open: boolean; packetId: number; packetTitle: string; content: string; imageUrl?: string; buttons: Array<{ text: string; url: string; type?: string; row?: number }> } | null>(null);
  const createMut = trpc.marketing.redPacketCreate.useMutation({
    onSuccess: () => { toast.success("红包创建成功"); setShowCreate(false); refetch(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatusMut = trpc.marketing.redPacketUpdateStatus.useMutation({
    onSuccess: () => { toast.success("状态已更新"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.marketing.redPacketDelete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", totalAmount: "", totalCount: 10,
    type: "random" as "random" | "fixed",
    imageUrl: "", expiresAt: "",
    condEnabled: false,
    condMinDeposit: "", condMinGames: "", condRecentDays: "", condRecentHands: "",
    condNewUserOnly: false,
    buttons: [] as Array<{ text: string; url: string; type?: string; row?: number }>,
  });
  const resetForm = () => setForm({
    title: "", description: "", totalAmount: "", totalCount: 10,
    type: "random", imageUrl: "", expiresAt: "",
    condEnabled: false, condMinDeposit: "", condMinGames: "",
    condRecentDays: "", condRecentHands: "", condNewUserOnly: false,
    buttons: [],
  });

  const handleCreate = () => {
    if (!form.title || !form.totalAmount || !form.totalCount) {
      toast.error("请填写红包标题、总金额和份数"); return;
    }
    const condition = form.condEnabled ? {
      minDeposit: form.condMinDeposit ? parseFloat(form.condMinDeposit) : undefined,
      minGamesPlayed: form.condMinGames ? parseInt(form.condMinGames) : undefined,
      recentDays: form.condRecentDays ? parseInt(form.condRecentDays) : undefined,
      recentHands: form.condRecentHands ? parseInt(form.condRecentHands) : undefined,
      newUserOnly: form.condNewUserOnly || undefined,
    } : undefined;
    createMut.mutate({
      title: form.title,
      description: form.description || undefined,
      totalAmount: form.totalAmount,
      totalCount: form.totalCount,
      type: form.type,
      imageUrl: form.imageUrl || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : undefined,
      condition,
      buttons: form.buttons.length > 0 ? form.buttons : undefined,
    });
  };

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "进行中", variant: "default" },
    paused: { label: "已暂停", variant: "secondary" },
    completed: { label: "已领完", variant: "outline" },
    expired: { label: "已过期", variant: "destructive" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">抢红包</h3>
          <p className="text-sm text-muted-foreground">创建拼手气红包，玩家可在 TG 或 Mini App 中领取，金额直接到账户余额</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />创建红包</Button>
        </div>
      </div>
      {/* Overall Stats */}
      {rpStats && (
        <MarketingStatsBar items={[
          { label: "总红包数", value: rpStats.totalPackets },
          { label: "总发放金额", value: `${formatBalance(parseFloat(rpStats.totalClaimed))}`, highlight: true },
          { label: "总领取人次", value: rpStats.totalClaims },
          { label: "总额度", value: `${formatBalance(parseFloat(rpStats.totalAmount))}` },
        ]} />
      )}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !packets?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无红包活动</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packets.map((pkt) => {
            const s = statusLabels[pkt.status] || { label: pkt.status, variant: "secondary" as const };
            const progress = pkt.totalCount > 0 ? Math.round((pkt.claimedCount / pkt.totalCount) * 100) : 0;
            return (
              <div key={pkt.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <span className="font-medium truncate">{pkt.title}</span>
                      <Badge variant="outline" className="text-xs">{pkt.type === "random" ? "拼手气" : "固定额"}</Badge>
                    </div>
                    {pkt.description && <p className="text-sm text-muted-foreground line-clamp-1 mb-1">{pkt.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>总额：<b className="text-foreground">{pkt.totalAmount} USDT</b></span>
                      <span>份数：{pkt.claimedCount}/{pkt.totalCount}</span>
                      <span>已领：{pkt.claimedAmount} USDT</span>
                      {pkt.expiresAt && <span>过期：{new Date(pkt.expiresAt).toLocaleString()}</span>}
                      <span>创建：{new Date(pkt.createdAt).toLocaleString()}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{progress}% 已领取</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setShowDetail(pkt.id)}>
                      <Eye className="w-3 h-3 mr-1" />详情
                    </Button>
                    <Button size="sm" variant="outline" className="text-blue-500" onClick={() => { setPushDialog({ open: true, packetId: pkt.id, packetTitle: pkt.title, content: `🧧 ${pkt.title}\n总额 ${pkt.totalAmount} USDT，共 ${pkt.totalCount} 份\n点击下方按钮抢红包！`, imageUrl: pkt.imageUrl || undefined, buttons: (pkt.buttons as any[] || []) }); }}>
                      <Send className="w-3 h-3 mr-1" />推送
                    </Button>
                    {pkt.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: pkt.id, status: "paused" })}>
                        <Pause className="w-3 h-3" />
                      </Button>
                    )}
                    {pkt.status === "paused" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: pkt.id, status: "active" })}>
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    {["paused", "completed", "expired"].includes(pkt.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                        if (confirm("确定删除该红包？")) deleteMut.mutate({ id: pkt.id });
                      }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Activity Links */}
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <ActivityLinkBar label="Mini App 链接" link={`${window.location.origin}/red-packet/${pkt.id}`} />
                  {rpBotUsername && <ActivityLinkBar label="TG 链接" link={`https://t.me/${rpBotUsername}/app?startapp=hongbao_${pkt.id}`}
                    onSendToTG={() => setPushDialog({ open: true, packetId: pkt.id, packetTitle: pkt.title, content: `🧧 ${pkt.title}\n总额 ${pkt.totalAmount} USDT，共 ${pkt.totalCount} 份\n点击下方按钮抢红包！`, imageUrl: pkt.imageUrl || undefined, buttons: (pkt.buttons as any[] || []) })}
                  />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Red Packet Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>创建抢红包</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>红包标题 *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="如：500级别专属红包" />
            </div>
            <div>
              <Label>红包说明</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="领取要求、活动说明等" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>总金额 (USDT) *</Label>
                <Input type="number" step="0.01" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} placeholder="2000" />
              </div>
              <div>
                <Label>总份数 *</Label>
                <Input type="number" value={form.totalCount} onChange={e => setForm(f => ({ ...f, totalCount: parseInt(e.target.value) || 1 }))} placeholder="30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>红包类型</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">拼手气（随机金额）</SelectItem>
                    <SelectItem value="fixed">固定额（平分）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>过期时间（可选）</Label>
                <Input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>
            <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
            <p className="text-xs text-muted-foreground">封面图建议尺寸：800×400px，将显示在红包页面顶部</p>

            {/* Buttons/Links */}
            <div className="border-t border-border pt-3">
              <Label className="text-sm font-medium">按钮列表（可选，显示在红包页面底部）</Label>
              <p className="text-xs text-muted-foreground mb-2">添加按钮可引导用户跳转到频道、游戏等页面</p>
              <ButtonEditor buttons={form.buttons} onChange={buttons => setForm(f => ({ ...f, buttons }))} />
            </div>

            {/* Conditions */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Switch checked={form.condEnabled} onCheckedChange={v => setForm(f => ({ ...f, condEnabled: v }))} />
                <Label>设置领取条件</Label>
              </div>
              {form.condEnabled && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">最低充值金额 (USDT)</Label>
                      <Input type="number" value={form.condMinDeposit} onChange={e => setForm(f => ({ ...f, condMinDeposit: e.target.value }))} placeholder="如 100" />
                    </div>
                    <div>
                      <Label className="text-xs">最低游戏手数</Label>
                      <Input type="number" value={form.condMinGames} onChange={e => setForm(f => ({ ...f, condMinGames: e.target.value }))} placeholder="如 200" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">最近N天内</Label>
                      <Input type="number" value={form.condRecentDays} onChange={e => setForm(f => ({ ...f, condRecentDays: e.target.value }))} placeholder="如 2" />
                    </div>
                    <div>
                      <Label className="text-xs">该时段内手数要求</Label>
                      <Input type="number" value={form.condRecentHands} onChange={e => setForm(f => ({ ...f, condRecentHands: e.target.value }))} placeholder="如 200" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.condNewUserOnly} onCheckedChange={v => setForm(f => ({ ...f, condNewUserOnly: v }))} />
                    <Label className="text-xs">仅新用户可领（注册7天内）</Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "创建中..." : "创建红包"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {showDetail && <RedPacketDetailDialog id={showDetail} onClose={() => setShowDetail(null)} />}
      {/* Push Dialog - dedicated red packet push (callback_data) */}
      {pushDialog && (
        <RedPacketPushDialog
          open={pushDialog.open}
          onOpenChange={(v) => { if (!v) setPushDialog(null); }}
          packetId={pushDialog.packetId}
          packetTitle={pushDialog.packetTitle}
          content={pushDialog.content}
          imageUrl={pushDialog.imageUrl}
        />
      )}
    </div>
  );
}

/** Red Packet Detail Dialog - shows claims leaderboard */
function RedPacketDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = trpc.marketing.redPacketDetail.useQuery({ id });
  if (!data) return null;
  const { packet, claims } = data;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>红包详情: {packet?.title}</DialogTitle>
        </DialogHeader>
        {isLoading ? <div className="py-8 text-center text-muted-foreground">加载中...</div> : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">总金额</p>
                <p className="text-lg font-bold text-red-500">{packet?.totalAmount} USDT</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">已领/总份</p>
                <p className="text-lg font-bold">{packet?.claimedCount}/{packet?.totalCount}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">已领金额</p>
                <p className="text-lg font-bold">{packet?.claimedAmount} USDT</p>
              </div>
            </div>

            {/* Condition info */}
            {packet?.condition && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2">
                <span className="font-medium">领取条件：</span>
                {(packet.condition as any).minDeposit && <span>充值≥{(packet.condition as any).minDeposit} </span>}
                {(packet.condition as any).minGamesPlayed && <span>手数≥{(packet.condition as any).minGamesPlayed} </span>}
                {(packet.condition as any).recentDays && (packet.condition as any).recentHands && (
                  <span>最近{(packet.condition as any).recentDays}天{(packet.condition as any).recentHands}手 </span>
                )}
                {(packet.condition as any).newUserOnly && <span>仅新用户 </span>}
              </div>
            )}

            {/* Claims leaderboard */}
            <div>
              <h4 className="text-sm font-medium mb-2">领取排行榜（按金额降序）</h4>
              {!claims?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无人领取</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {claims.map((claim, idx) => (
                    <div key={claim.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-secondary/30">
                      <span className={`w-5 text-center font-bold ${
                        idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-orange-600" : "text-muted-foreground"
                      }`}>{idx + 1}</span>
                      <span className="flex-1 truncate">{claim.nickname || claim.tgUsername || `User#${claim.userId}`}</span>
                      <span className="font-mono font-medium text-red-500">{claim.amount} USDT</span>
                      <span className="text-xs text-muted-foreground">{new Date(claim.claimedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== RED PACKET PUSH DIALOG (callback_data) ====================
/** Dedicated red packet push dialog that uses redPacketPush route with callback_data buttons */
function RedPacketPushDialog({ open, onOpenChange, packetId, packetTitle, content, imageUrl }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  packetId: number;
  packetTitle: string;
  content: string;
  imageUrl?: string;
}) {
  const [mode, setMode] = useState<"groups" | "broadcast">("groups");
  const [selectedGroupChatIds, setSelectedGroupChatIds] = useState<string[]>([]);
  const [groupResult, setGroupResult] = useState<{ sent: number; failed: number; results: Array<{ chatId: string; success: boolean; error?: string }> } | null>(null);
  const [msgText, setMsgText] = useState(content);
  // Broadcast mode state
  const [broadcastFilter, setBroadcastFilter] = useState<"all" | "active" | "deposited">("all");
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [broadcastMode, setBroadcastMode] = useState<"filter" | "custom">("filter"); // filter=send to all matching; custom=pick users
  const { data: botGroupsData } = trpc.marketing.getBotAdminGroups.useQuery(undefined, { enabled: open && mode === "groups" });
  const { data: followersData, isLoading: followersLoading } = trpc.marketing.getBotFollowers.useQuery(
    { filter: broadcastFilter, search: broadcastSearch, limit: 200 },
    { enabled: open && mode === "broadcast" && broadcastMode === "custom" }
  );

  const allGroups = useMemo(() => {
    const map = new Map<string, { id?: number; chatId: string; name: string; type: string; enabled?: boolean }>();
    (botGroupsData?.tgGroups || []).forEach(g => map.set(g.chatId, { chatId: g.chatId, name: g.name, type: g.type }));
    (botGroupsData?.manualGroups || []).forEach(g => {
      if (!map.has(g.chatId)) map.set(g.chatId, { id: g.id, chatId: g.chatId, name: g.name, type: g.type, enabled: g.enabled });
      else { const existing = map.get(g.chatId)!; map.set(g.chatId, { ...existing, id: g.id, name: g.name, enabled: g.enabled }); }
    });
    return Array.from(map.values()).filter(g => g.enabled !== false);
  }, [botGroupsData]);

  const toggleGroupChatId = (chatId: string) => {
    setSelectedGroupChatIds(prev => prev.includes(chatId) ? prev.filter(x => x !== chatId) : [...prev, chatId]);
  };
  const toggleAll = () => {
    if (selectedGroupChatIds.length === allGroups.length) setSelectedGroupChatIds([]);
    else setSelectedGroupChatIds(allGroups.map(g => g.chatId));
  };

  const pushMut = trpc.marketing.redPacketPush.useMutation({
    onSuccess: (res) => {
      if (mode === "groups" && res.results) {
        setGroupResult({ sent: res.sent || 0, failed: res.failed || 0, results: res.results });
        toast.success(`已发送到 ${res.sent} 个群组${res.failed ? `，${res.failed} 个失败` : ''}`);
      } else {
        toast.success("红包推送任务已创建，正在后台发送...");
        onOpenChange(false);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const broadcastToUsersMut = trpc.marketing.broadcastToUsers.useMutation({
    onSuccess: () => { toast.success("已创建推送任务，正在后台发送..."); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = () => {
    if (mode === "groups") {
      if (selectedGroupChatIds.length === 0) { toast.error("请至少选择一个群组"); return; }
      pushMut.mutate({ id: packetId, mode: "group", groupChatIds: selectedGroupChatIds, message: msgText || undefined });
    } else if (broadcastMode === "custom") {
      if (selectedUserIds.length === 0) { toast.error("请至少选择一个用户"); return; }
      broadcastToUsersMut.mutate({
        userIds: selectedUserIds,
        content: msgText,
        imageUrl: imageUrl || undefined,
        buttons: [{ text: "🧧 抢红包", callback_data: `claim_rp_${packetId}`, type: "callback", row: 0 }],
      });
    } else {
      // filter mode: all/active/deposited via redPacketPush broadcast
      pushMut.mutate({ id: packetId, mode: "broadcast", message: msgText || undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) { setGroupResult(null); setSelectedGroupChatIds([]); } onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🧧 红包推送: {packetTitle}</DialogTitle></DialogHeader>
        {groupResult ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-center">
              <div className="flex-1 bg-green-500/10 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-500">{groupResult.sent}</div>
                <div className="text-xs text-muted-foreground">发送成功</div>
              </div>
              {groupResult.failed > 0 && (
                <div className="flex-1 bg-destructive/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-destructive">{groupResult.failed}</div>
                  <div className="text-xs text-muted-foreground">发送失败</div>
                </div>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groupResult.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded ${r.success ? 'bg-green-500/5' : 'bg-destructive/5'}`}>
                  <span className={r.success ? 'text-green-500' : 'text-destructive'}>{r.success ? '✓' : '✗'}</span>
                  <span className="font-medium">{r.chatId}</span>
                  {r.error && <span className="text-destructive ml-auto truncate max-w-32">{r.error}</span>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupResult(null)}>继续发送</Button>
              <Button onClick={() => { setGroupResult(null); onOpenChange(false); }}>关闭</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "groups" ? "default" : "outline"} onClick={() => setMode("groups")} className="flex-1">
                <Send className="w-3 h-3 mr-1" />发送到群组/频道
              </Button>
              <Button size="sm" variant={mode === "broadcast" ? "default" : "outline"} onClick={() => setMode("broadcast")} className="flex-1">
                <Users className="w-3 h-3 mr-1" />群发给Bot用户
              </Button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
              ℹ️ 群组推送使用 callback_data 按钮，用户可在群内直接点击“抢红包”领取，无需跳转网页。
            </div>

            {/* Message preview */}
            <div>
              <Label>推送文案（可编辑）</Label>
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3} />
            </div>

            {imageUrl && (
              <div className="text-xs text-muted-foreground">🖼️ 将附带封面图发送</div>
            )}

            {/* Group selection */}
            {mode === "groups" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>选择群组/频道</Label>
                  {allGroups.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={toggleAll}>
                      {selectedGroupChatIds.length === allGroups.length ? '取消全选' : '全选'}
                    </Button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {allGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">暂无可用群组，请先在“TG群组管理”中添加</p>
                  ) : allGroups.map(g => (
                    <label key={g.chatId} className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                      <input type="checkbox" checked={selectedGroupChatIds.includes(g.chatId)} onChange={() => toggleGroupChatId(g.chatId)} className="rounded" />
                      <span className="text-sm flex-1 truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.type}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">已选 {selectedGroupChatIds.length} / {allGroups.length} 个群组</p>
              </div>
            )}

            {mode === "broadcast" && (
              <div className="space-y-3">
                {/* Broadcast sub-mode */}
                <div className="flex gap-2">
                  <Button size="sm" variant={broadcastMode === "filter" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => setBroadcastMode("filter")}>
                    按条件筛选发送
                  </Button>
                  <Button size="sm" variant={broadcastMode === "custom" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => setBroadcastMode("custom")}>
                    手动选择用户
                  </Button>
                </div>

                {broadcastMode === "filter" && (
                  <div className="space-y-2">
                    <Label className="text-xs">目标用户</Label>
                    <Select value={broadcastFilter} onValueChange={(v: any) => setBroadcastFilter(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部Bot用户</SelectItem>
                        <SelectItem value="active">近30天活跃用户</SelectItem>
                        <SelectItem value="deposited">有充值记录用户</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">私聊发送，按钮点击跳转 Mini App 领取</p>
                  </div>
                )}

                {broadcastMode === "custom" && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <Select value={broadcastFilter} onValueChange={(v: any) => setBroadcastFilter(v)}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部用户</SelectItem>
                          <SelectItem value="active">近30天活跃</SelectItem>
                          <SelectItem value="deposited">有充值记录</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="搜索用户名/TG..."
                        value={broadcastSearch}
                        onChange={e => setBroadcastSearch(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                    <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                      {followersLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-3">加载中...</p>
                      ) : !followersData?.users?.length ? (
                        <p className="text-xs text-muted-foreground text-center py-3">暂无用户</p>
                      ) : (
                        <>
                          <div className="sticky top-0 bg-background border-b border-border px-2 py-1 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">共 {followersData.total} 个用户</span>
                            <Button size="sm" variant="ghost" className="h-5 text-xs px-1" onClick={() => {
                              if (selectedUserIds.length === followersData.users.length) setSelectedUserIds([]);
                              else setSelectedUserIds(followersData.users.map((u: any) => u.id));
                            }}>
                              {selectedUserIds.length === followersData.users.length ? '取消全选' : '全选当前页'}
                            </Button>
                          </div>
                          {followersData.users.map((u: any) => (
                            <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/50 cursor-pointer">
                              <input type="checkbox" checked={selectedUserIds.includes(u.id)}
                                onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                              />
                              <span className="text-xs flex-1 truncate">{u.nickname || u.name || `用户${u.id}`}</span>
                              {u.tgUsername && <span className="text-xs text-muted-foreground">@{u.tgUsername}</span>}
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">已选 {selectedUserIds.length} 个用户</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleSend} disabled={pushMut.isPending || broadcastToUsersMut.isPending}>
                <Send className="w-4 h-4 mr-1" />{(pushMut.isPending || broadcastToUsersMut.isPending) ? "发送中..." : "确认发送"}
                {mode === "broadcast" && broadcastMode === "filter" && ` (全部${broadcastFilter === "all" ? "Bot用户" : broadcastFilter === "active" ? "活跃用户" : "充值用户"})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== TG GROUPS PANEL ====================
function TgGroupsPanel() {
  const { data: groups, isLoading, refetch } = trpc.marketing.tgGroupList.useQuery();
  const createMut = trpc.marketing.tgGroupCreate.useMutation({
    onSuccess: () => { toast.success("群组已添加"); setShowCreate(false); resetForm(); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.marketing.tgGroupUpdate.useMutation({
    onSuccess: () => { toast.success("已更新"); setEditId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.marketing.tgGroupDelete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", chatId: "", type: "group" as "group" | "channel" | "supergroup", description: "", enabled: true });
  const resetForm = () => setForm({ name: "", chatId: "", type: "group", description: "", enabled: true });

  const typeLabels: Record<string, string> = { group: "群组", channel: "频道", supergroup: "超级群组" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">TG 群组/频道管理</h3>
          <p className="text-sm text-muted-foreground">管理推送目标群组，所有推送功能均可选择这里的群组</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="w-4 h-4 mr-1" />添加群组</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : !groups?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无群组，点击「添加群组」开始</p>
          <p className="text-xs mt-1">添加后，所有推送功能都可选择这里的群组作为发送目标</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.id} className="border border-border rounded-lg p-4 bg-card">
              {editId === g.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label className="text-xs">Chat ID</Label><Input value={form.chatId} onChange={e => setForm(f => ({ ...f, chatId: e.target.value }))} placeholder="-1001234567890" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">类型</Label>
                      <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">群组</SelectItem>
                          <SelectItem value="channel">频道</SelectItem>
                          <SelectItem value="supergroup">超级群组</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
                        <span className="text-sm">启用</span>
                      </label>
                    </div>
                  </div>
                  <div><Label className="text-xs">备注</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateMut.mutate({ id: g.id, ...form })} disabled={updateMut.isPending}>保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      <Badge variant="outline" className="text-xs">{typeLabels[g.type]}</Badge>
                      {!g.enabled && <Badge variant="secondary" className="text-xs">已禁用</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-muted-foreground">{g.chatId}</code>
                      {g.description && <span className="text-xs text-muted-foreground">· {g.description}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { setForm({ name: g.name, chatId: g.chatId, type: g.type, description: g.description || "", enabled: g.enabled }); setEditId(g.id); }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`确定删除「${g.name}」？`)) deleteMut.mutate({ id: g.id }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>添加 TG 群组/频道</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>名称 *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：官方公告频道" /></div>
            <div>
              <Label>Chat ID *</Label>
              <Input value={form.chatId} onChange={e => setForm(f => ({ ...f, chatId: e.target.value }))} placeholder="如 -1001234567890 或 @channelname" />
              <p className="text-xs text-muted-foreground mt-1">将 Bot 加入群组/频道并设为管理员，在群组中发任意消息，在管理后台「系统配置」的 Webhook 日志中可找到 chat_id</p>
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">群组</SelectItem>
                  <SelectItem value="channel">频道</SelectItem>
                  <SelectItem value="supergroup">超级群组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>备注</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="可选，如：中文用户群" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => { if (!form.name || !form.chatId) { toast.error("请填写名称和 Chat ID"); return; } createMut.mutate(form); }} disabled={createMut.isPending}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== MAIN MARKETING PANEL ====================
export function MarketingPanel({ at }: { at: (k: string) => string }) {
  const [activeTab, setActiveTab] = useState<MarketingTab>("broadcast");

  const tabs: { key: MarketingTab; icon: any; label: string }[] = [
    { key: "broadcast", icon: Megaphone, label: "Bot 群发" },
    { key: "redPacket", icon: Gift, label: "抢红包" },
    { key: "coupons", icon: Copy, label: "优惠券" },
    { key: "invite", icon: Share2, label: "邀请奖励" },
    { key: "checkin", icon: Check, label: "签到奖励" },
    { key: "events", icon: Play, label: "限时活动" },
    { key: "notifications", icon: Send, label: "推送通知" },
    { key: "templates", icon: FileText, label: "消息模板" },
    { key: "welcome", icon: Globe, label: "欢迎消息" },
    { key: "autoReply", icon: MessageSquare, label: "自动回复" },
    { key: "fission", icon: Share2, label: "裂变活动" },
    { key: "botUsers", icon: Users, label: "Bot 用户" },
    { key: "tgGroups", icon: Send, label: "群组管理" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
        {activeTab === "redPacket" && <RedPacketPanel />}
        {activeTab === "coupons" && <CouponsPanel />}
        {activeTab === "invite" && <InviteRewardPanel />}
        {activeTab === "checkin" && <CheckinPanel />}
        {activeTab === "events" && <TimeLimitedEventsPanel />}
        {activeTab === "notifications" && <NotificationsPanel />}
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "welcome" && <WelcomePanel />}
        {activeTab === "autoReply" && <AutoReplyPanel />}
        {activeTab === "fission" && <FissionPanel />}
        {activeTab === "botUsers" && <BotUsersPanel />}
        {activeTab === "tgGroups" && <TgGroupsPanel />}
      </div>
    </div>
  );
}
