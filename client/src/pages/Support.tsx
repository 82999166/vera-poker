import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t, getLocale } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Bot, User, Loader2, UserRound, AlertCircle, Trash2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  showTransferButton?: boolean;
}

export default function Support() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showTransferHint, setShowTransferHint] = useState(false);
  const { data: publicConfigs } = trpc.config.getPublic.useQuery();
  const rawCsTg = (publicConfigs as Record<string, string>)?.cs_tg_username || "";
  const csTgUsername = rawCsTg.replace(/^@/, "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
  const { data: historyData, isLoading: historyLoading } = trpc.cs.getHistory.useQuery(undefined, {
    enabled: !!user,
  });

  // Clear history mutation
  const clearHistoryMutation = trpc.cs.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: t("cs.welcome"),
        timestamp: new Date(),
      }]);
      setFailCount(0);
      setShowTransferHint(false);
    },
  });

  // Initialize messages from history
  useEffect(() => {
    if (historyLoaded) return;
    if (historyLoading) return;

    if (historyData && historyData.length > 0) {
      const loadedMessages: Message[] = historyData.map(m => ({
        id: `db-${m.id}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt),
      }));
      setMessages(loadedMessages);
    } else {
      // No history — show welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: t("cs.welcome"),
        timestamp: new Date(),
      }]);
    }
    setHistoryLoaded(true);
  }, [historyData, historyLoading, historyLoaded]);

  // Detect if AI response indicates inability to answer
  const isUnhelpfulResponse = (response: string): boolean => {
    const unhelpfulPatterns = [
      /抱歉.*无法/i, /sorry.*can't/i, /sorry.*cannot/i,
      /不太确定/i, /not sure/i, /i don't know/i,
      /无法回答/i, /cannot answer/i, /can't help/i,
      /建议.*联系/i, /suggest.*contact/i,
      /超出.*范围/i, /beyond.*scope/i,
      /没有.*信息/i, /no information/i,
      /无法.*帮助/i, /unable to help/i,
    ];
    return unhelpfulPatterns.some(p => p.test(response));
  };

  const chatMutation = trpc.cs.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
      setIsTyping(false);

      // Check if AI couldn't help
      if (isUnhelpfulResponse(data.response)) {
        setFailCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 3 && !showTransferHint) {
            setShowTransferHint(true);
            // Add system message with transfer button
            setMessages(prev2 => [...prev2, {
              id: `transfer-hint-${Date.now()}`,
              role: "system",
              content: t("cs.suggestTransfer"),
              timestamp: new Date(),
              showTransferButton: true,
            }]);
          }
          return newCount;
        });
      } else {
        // Reset fail count on successful answer
        setFailCount(0);
      }
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: t("cs.error"),
        timestamp: new Date(),
      }]);
      setIsTyping(false);
      setFailCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3 && !showTransferHint) {
          setShowTransferHint(true);
          setMessages(prev2 => [...prev2, {
            id: `transfer-hint-${Date.now()}`,
            role: "system",
            content: t("cs.suggestTransfer"),
            timestamp: new Date(),
            showTransferButton: true,
          }]);
        }
        return newCount;
      });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Detect if user wants to transfer to human agent
  const isTransferRequest = (text: string): boolean => {
    const transferPatterns = [
      /转人工/i, /人工客服/i, /真人客服/i, /找人工/i, /要人工/i,
      /transfer.*human/i, /human.*agent/i, /real.*person/i,
      /talk.*human/i, /speak.*agent/i, /live.*agent/i,
      /人間/i, /オペレーター/i, /상담원/i,
    ];
    return transferPatterns.some(p => p.test(text));
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    const msgText = input.trim();
    setInput("");

    // If user explicitly asks for human agent, show transfer button immediately
    if (isTransferRequest(msgText)) {
      setMessages(prev => [...prev, {
        id: `transfer-card-${Date.now()}`,
        role: "system",
        content: t("cs.transferPrompt"),
        timestamp: new Date(),
        showTransferButton: true,
      }]);
      return;
    }

    setIsTyping(true);
    chatMutation.mutate({ message: msgText, language: getLocale() });
  };

  const handleTransferToHuman = () => {
    const url = `https://t.me/${csTgUsername}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleClearHistory = () => {
    clearHistoryMutation.mutate();
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-strong px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-truth-blue/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-truth-blue" />
          </div>
          <div>
            <h1 className="text-sm font-bold">{t("cs.title")}</h1>
            <p className="text-[10px] text-success">Online 24/7</p>
          </div>
        </div>
        {/* Transfer to human CS button in header */}
        {csTgUsername && (
          <button
            onClick={handleTransferToHuman}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
              showTransferHint
                ? "bg-gold/20 border border-gold/50 text-gold animate-pulse"
                : "bg-truth-blue/10 border border-truth-blue/30 text-truth-blue hover:bg-truth-blue/20"
            }`}
          >
            <UserRound className="w-3.5 h-3.5" />
            {t("cs.transferHuman")}
          </button>
        )}
        {/* Clear history button */}
        {messages.length > 1 && (
          <button
            onClick={handleClearHistory}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            title={t("cs.clearHistory")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
        {historyLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {messages.map(msg => (
          msg.role === "system" ? (
            // System hint message (transfer suggestion or transfer card with button)
            <div key={msg.id} className="flex justify-center">
              <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-gold/10 border border-gold/30 max-w-[85%]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gold flex-shrink-0" />
                  <p className="text-xs text-gold font-medium">{msg.content}</p>
                </div>
                {msg.showTransferButton && csTgUsername && (
                  <button
                    onClick={handleTransferToHuman}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 rounded-lg bg-truth-blue text-white text-sm font-medium transition-all active:scale-[0.97] hover:opacity-90"
                  >
                    <UserRound className="w-4 h-4" />
                    {t("cs.goToHumanAgent")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant" ? "bg-truth-blue/20" : "bg-gold/20"
              }`}>
                {msg.role === "assistant" ? (
                  <Bot className="w-3.5 h-3.5 text-truth-blue" />
                ) : (
                  <User className="w-3.5 h-3.5 text-gold" />
                )}
              </div>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                msg.role === "assistant"
                  ? "glass text-foreground"
                  : "bg-gold text-background"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${msg.role === "assistant" ? "text-muted-foreground" : "text-background/60"}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-truth-blue/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-truth-blue" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="glass-strong border-t border-border px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={t("cs.placeholder")}
            className="flex-1 glass rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-truth-blue"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-full bg-truth-blue text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity active:scale-[0.95]"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
