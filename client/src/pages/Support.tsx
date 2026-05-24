import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t, getLocale } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Bot, User, Loader2, UserRound, AlertCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function Support() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("cs.welcome"),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showTransferHint, setShowTransferHint] = useState(false);
  const { data: publicConfigs } = trpc.config.getPublic.useQuery();
  const rawCsTg = (publicConfigs as Record<string, string>)?.cs_tg_username || "";
  const csTgUsername = rawCsTg.replace(/^@/, "");
  const scrollRef = useRef<HTMLDivElement>(null);

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
            // Add system message suggesting transfer
            setMessages(prev2 => [...prev2, {
              id: `transfer-hint-${Date.now()}`,
              role: "system",
              content: t("cs.suggestTransfer"),
              timestamp: new Date(),
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
          }]);
        }
        return newCount;
      });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    chatMutation.mutate({ message: userMsg.content, language: getLocale() });
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

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-strong px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/lobby")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-truth-blue/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-truth-blue" />
          </div>
          <div>
            <h1 className="text-sm font-bold">{t("cs.title")}</h1>
            <p className="text-[10px] text-success">Online 24/7</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
        {messages.map(msg => (
          msg.role === "system" ? (
            // System hint message (transfer suggestion)
            <div key={msg.id} className="flex justify-center">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/30 max-w-[85%]">
                <AlertCircle className="w-4 h-4 text-gold flex-shrink-0" />
                <p className="text-xs text-gold font-medium">{msg.content}</p>
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
        {/* Transfer to human CS button - show always if configured, highlight if suggested */}
        {csTgUsername && (
          <div className="mb-2">
            <button
              onClick={handleTransferToHuman}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
                showTransferHint
                  ? "bg-gold/20 border border-gold/50 text-gold animate-pulse"
                  : "bg-truth-blue/10 border border-truth-blue/30 text-truth-blue hover:bg-truth-blue/20"
              }`}
            >
              <UserRound className="w-3.5 h-3.5" />
              {t("cs.transferHuman")}
            </button>
          </div>
        )}
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
