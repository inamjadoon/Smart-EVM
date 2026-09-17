import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  Bot,
  User,
  Send,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Layers,
  ChevronDown
} from "lucide-react";
import { sendGenAiChat } from "@/api/genai";
import { getProjects } from "@/api/projects";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  source?: string;
  timestamp: string;
}

const DEFAULT_PROMPTS = [
  "How is project 1 performing overall?",
  "Explain what current CPI & SPI mean in plain terms",
  "What is the predicted delay and EAC for project 1?",
  "Which risks should the team tackle next sprint?",
  "Give me an executive portfolio summary",
];

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Hello! I am SmartEVM's AI Assistant. Ask me anything about project performance, CPI/SPI trends, cost forecasts (EAC), or schedule risks.",
      source: "llm",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getProjects()
      .then((p) => {
        setProjects(p);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const pid = searchParams.get("project_id");
    if (pid) {
      setSelectedProjectId(pid);
    }
  }, [isOpen, window.location.search]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage("");
    setLoading(true);

    try {
      const projId = selectedProjectId === "all" ? null : Number(selectedProjectId);
      const res = await sendGenAiChat(textToSend, projId);
      
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: res.reply || "No response received.",
        source: res.source,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || "Failed to reach AI assistant";
      toast.error(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "assistant",
          text: `⚠️ Error: ${errMsg}. Please make sure the backend server is running.`,
          source: "system",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "assistant",
        text: "Chat cleared. What else would you like to analyze?",
        source: "llm",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Chat Drawer / Card */}
      {isOpen && (
        <Card
          className={cn(
            "w-[92vw] sm:w-[420px] bg-card border-2 border-primary/25 shadow-2xl rounded-2xl flex flex-col transition-all duration-200 overflow-hidden mb-3",
            isMinimized ? "h-14" : "h-[560px] max-h-[85vh]"
          )}
        >
          {/* Card Header */}
          <CardHeader className="p-3.5 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border-b flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-sm font-bold tracking-tight">SmartEVM AI Assistant</CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20 font-mono">
                    AI Copilot
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">EVM & Predictive Analytics Expert</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* If Not Minimized, render Scope Selector, Messages, Prompts, & Input */}
          {!isMinimized && (
            <>
              {/* Scope Selector Bar */}
              <div className="px-3.5 py-2 bg-muted/30 border-b flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Context:
                </span>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-7 text-xs bg-background border-border flex-1 max-w-[220px]">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 Whole Portfolio (All Projects)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        📁 #{p.id} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={clearChat}
                  title="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Chat Message Scroll Area */}
              <CardContent className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex items-start gap-2.5",
                      msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm",
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white"
                      )}
                    >
                      {msg.sender === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>

                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed",
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted/80 text-foreground border border-border/60 rounded-tl-none"
                      )}
                    >
                      <div className="whitespace-pre-line break-words">{msg.text}</div>
                      <div
                        className={cn(
                          "mt-1 text-[10px] flex items-center justify-end gap-1.5 opacity-70",
                          msg.sender === "user" ? "text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {msg.source && (
                          <span className="font-mono uppercase text-[9px]">
                            {msg.source === "llm" ? "⚡ SmartEVM AI" : msg.source}
                          </span>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Bot className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="bg-muted/80 border border-border/60 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                      <span className="text-[11px] text-muted-foreground ml-2 font-medium">AI is thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              {/* Suggested Prompt Chips (when few messages) */}
              {messages.length <= 3 && (
                <div className="px-3 pb-2 pt-1 border-t bg-muted/10">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">
                    Suggested Questions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_PROMPTS.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(prompt)}
                        className="text-[11px] text-left px-2.5 py-1 rounded-full bg-card hover:bg-primary/10 hover:text-primary border border-border transition-colors text-muted-foreground"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Footer */}
              <CardFooter className="p-3 border-t bg-card shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2 w-full"
                >
                  <Input
                    placeholder="Ask about CPI, SPI, EAC, or project status..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs bg-background flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!inputMessage.trim() || loading}
                    className="h-9 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20"
        >
          <div className="relative">
            <Bot className="h-5 w-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
          </div>
          <span className="font-semibold text-xs tracking-wide">AI Assistant</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono font-bold">AI</span>
        </button>
      )}
    </div>
  );
}
