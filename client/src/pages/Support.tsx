import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { t, getLocale } from "@/lib/i18n";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Bot, User, Loader2, UserRound } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Message {
  id: string;
  role: "user" | "assistant";
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
  const { data: publicConfigs } = trpc.config.getPublic.useQuery();
  const csTgUsername = (publicConfigs as Record<string, string>)?.cs_tg_username || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.cs.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
      setIsTyping(false);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: t("cs.error"),
        timestamp: new Date(),
      }]);
      setIsTyping(false);
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
        {/* Transfer to human CS button */}
        {csTgUsername && (
          <div className="mb-2">
            <button
              onClick={() => window.open(`https://t.me/${csTgUsername}`, "_blank")}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-truth-blue/10 border border-truth-blue/30 text-truth-blue text-xs font-medium hover:bg-truth-blue/20 transition-all active:scale-[0.98]"
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
