import { useEffect, useRef, useState } from "react";
import { Send, BookOpen, Lightbulb, HelpCircle } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { explainTopic, solveQuestion } from "@/services/api";
import { toast } from "sonner";

type ChatMode = "normal" | "explain" | "solve";

function ChatPage() {
  const { messages, isLoading, sendMessage } = useChatStore();
  const { userId } = useUserStore();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValue = useRef("");
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const msg = inputValue.current.trim();
    if (!msg || isLoading || guidanceLoading) return;
    inputValue.current = "";
    if (inputRef.current) inputRef.current.value = "";

    if (chatMode === "explain" && userId) {
      setGuidanceLoading(true);
      try {
        const result = await explainTopic(userId, msg);
        useChatStore.getState().addMessage({ role: "user", content: `📖 讲解知识点：${msg}` });
        useChatStore.getState().addMessage({ role: "assistant", content: result.explanation });
      } catch {
        toast.error("讲解请求失败");
      }
      setGuidanceLoading(false);
      setChatMode("normal");
    } else if (chatMode === "solve" && userId) {
      setGuidanceLoading(true);
      try {
        const result = await solveQuestion(userId, msg);
        useChatStore.getState().addMessage({ role: "user", content: `✏️ 解答题目：${msg}` });
        useChatStore.getState().addMessage({ role: "assistant", content: result.solution });
      } catch {
        toast.error("解题请求失败");
      }
      setGuidanceLoading(false);
      setChatMode("normal");
    } else {
      try {
        await sendMessage(msg);
      } catch {
        toast.error("发送失败，请重试");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modeConfig: Record<ChatMode, { label: string; placeholder: string; icon: typeof BookOpen }> = {
    normal: { label: "", placeholder: "输入你的问题...", icon: BookOpen },
    explain: { label: "讲解知识点模式", placeholder: "输入知识点名称，如：中值定理", icon: Lightbulb },
    solve: { label: "解答题目模式", placeholder: "粘贴题目内容，如：求极限...", icon: HelpCircle },
  };

  const currentMode = modeConfig[chatMode];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">向 AI 助手提问考研相关问题</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] md:max-w-[60%] rounded-lg px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
              {msg.streaming && <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5" />}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">参考来源：</p>
                  {msg.sources.map((s, i) => {
                    const isUserMaterial = s.metadata?.user_id;
                    return (
                      <p key={i} className={`text-xs truncate ${isUserMaterial ? "text-blue-500" : "text-muted-foreground"}`}>
                        {i + 1}. {isUserMaterial ? "来自你的资料：" : ""}{s.metadata?.filename || s.text || `来源 ${i + 1}`}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-4">
        {chatMode !== "normal" && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <currentMode.icon className="h-3 w-3" />
              {currentMode.label}
            </span>
            <button onClick={() => setChatMode("normal")} className="text-xs text-muted-foreground hover:text-foreground">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setChatMode(chatMode === "explain" ? "normal" : "explain")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              chatMode === "explain" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"
            }`}
          >
            <Lightbulb className="h-3 w-3" />
            讲解知识点
          </button>
          <button
            onClick={() => setChatMode(chatMode === "solve" ? "normal" : "solve")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              chatMode === "solve" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"
            }`}
          >
            <HelpCircle className="h-3 w-3" />
            解答题目
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            onChange={(e) => (inputValue.current = e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentMode.placeholder}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || guidanceLoading}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {(isLoading || guidanceLoading) ? <span className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

export default ChatPage;
