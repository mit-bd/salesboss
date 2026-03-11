import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Lightbulb, X, BrainCircuit, RotateCcw, Mic, MicOff, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Lang = "en" | "bn";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const SUGGESTIONS: Record<Lang, { label: string; items: string[] }[]> = {
  en: [
    {
      label: "📋 Followups",
      items: ["Show today's followups", "Show overdue followups", "Which followup step converts best?"],
    },
    {
      label: "💡 Sales Coach",
      items: ["Write a Step 3 followup script", "How to convince a repeat order?", "Best upsell techniques"],
    },
    {
      label: "📊 Insights",
      items: ["Show sales performance summary", "Who is the top performing executive?", "Which product sells the most?"],
    },
    {
      label: "🔁 Predictions",
      items: ["Which customers are likely to reorder soon?", "Show repeat order predictions", "Best time for upsell?"],
    },
  ],
  bn: [
    {
      label: "📋 ফলোআপ",
      items: ["আজকের ফলোআপ দেখাও", "ওভারডিউ ফলোআপ দেখাও", "কোন ফলোআপ স্টেপ সবচেয়ে ভালো কাজ করে?"],
    },
    {
      label: "💡 সেলস কোচ",
      items: ["স্টেপ ৩ ফলোআপ স্ক্রিপ্ট লিখে দাও", "রিপিট অর্ডার কিভাবে কনভিন্স করবো?", "আপসেল করার টেকনিক দাও"],
    },
    {
      label: "📊 ইনসাইটস",
      items: ["সেলস পারফরম্যান্স সামারি দেখাও", "সেরা সেলস এক্সিকিউটিভ কে?", "কোন প্রোডাক্ট বেশি বিক্রি হয়?"],
    },
    {
      label: "🔁 প্রেডিকশন",
      items: ["কোন কাস্টমার শীঘ্রই রিঅর্ডার করতে পারে?", "রিপিট অর্ডার প্রেডিকশন দেখাও", "আপসেলের সেরা সময় কখন?"],
    },
  ],
};

const WELCOME: Record<Lang, { title: string; subtitle: string }> = {
  en: { title: "Hi! I'm your Sales AI Copilot", subtitle: "I learn from your data to predict & improve sales" },
  bn: { title: "হাই! আমি আপনার সেলস AI কোপাইলট", subtitle: "আপনার ডেটা থেকে শিখে সেলস উন্নত করি" },
};

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const { user } = useAuth();

  // Check voice permission
  useEffect(() => {
    if (!user) return;
    const checkVoice = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ai_voice_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      setVoiceEnabled(data?.ai_voice_enabled ?? false);
    };
    checkVoice();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setShowSuggestions(false);

    let assistantContent = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: newMessages, language: lang }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { done = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠ ${err.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, lang]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠ Speech recognition is not supported in this browser." }]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === "bn" ? "bn-BD" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // Auto-send after voice input
      setTimeout(() => {
        sendMessage(transcript);
      }, 200);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, lang, sendMessage]);

  const handleNewChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const currentSuggestions = SUGGESTIONS[lang];
  const welcome = WELCOME[lang];

  return (
    <>
      {/* Floating AI Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!open && (
          <div className="absolute inset-0 rounded-full bg-primary/20 ai-fab-ring pointer-events-none" />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(!open)}
              className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300",
                "bg-gradient-to-br from-primary to-[hsl(250,70%,55%)] text-primary-foreground",
                !open && "ai-fab hover:scale-110",
                open && "scale-95 shadow-lg hover:scale-100"
              )}
            >
              {open ? <X className="h-5 w-5" /> : <BrainCircuit className="h-6 w-6" />}
            </button>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="left" className="text-xs">SalesBoss AI Assistant</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-h-[640px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[hsl(250,70%,55%)]/15">
                <BrainCircuit className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">SalesBoss AI Copilot</h3>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "bn" ? "সেলস মেন্টর • বিশ্লেষক • প্রেডিক্টর" : "Sales mentor • Analyst • Predictor"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Language Toggle */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px] font-medium">
                <button
                  onClick={() => setLang("en")}
                  className={cn(
                    "px-2 py-1 transition-colors",
                    lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang("bn")}
                  className={cn(
                    "px-2 py-1 transition-colors",
                    lang === "bn" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  BN
                </button>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1 hover:bg-muted"
                  title="New Chat"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[320px] max-h-[420px]">
            {messages.length === 0 && showSuggestions && (
              <div className="space-y-4">
                <div className="text-center py-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-[hsl(250,70%,55%)]/10 mx-auto mb-3">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{welcome.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{welcome.subtitle}</p>
                </div>

                {currentSuggestions.map((cat) => (
                  <div key={cat.label}>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{cat.label}</p>
                    <div className="space-y-1">
                      {cat.items.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="w-full text-left text-xs rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-foreground">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {lang === "bn" ? "ডেটা বিশ্লেষণ করছি..." : "Analyzing your data..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2"
            >
              {voiceEnabled && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "shrink-0 flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    isListening
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === "bn" ? "সেলস, প্রেডিকশন, কাস্টমার নিয়ে জিজ্ঞেস করুন..." : "Ask about sales, predictions, customers..."}
                className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {isListening && (
              <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
                {lang === "bn" ? "শুনছি... কথা বলুন" : "Listening... speak now"}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
