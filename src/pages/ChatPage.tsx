import { useEffect, useRef, useState } from "react";
import { Send, BookOpen, Lightbulb, HelpCircle, Compass, MessageCircle } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { explainTopic, solveQuestion, guidedTeaching } from "@/services/api";
import { formatMarkdown } from "@/lib/format";
import { toast } from "sonner";

type ChatMode = "normal" | "explain" | "solve" | "guided";

function ChatPage() {
  const { messages, isLoading, sendMessage } = useChatStore();
  const { userId } = useUserStore();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValue = useRef("");
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidedTopic, setGuidedTopic] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [isGuidedQuestion, setIsGuidedQuestion] = useState(false);
  const [guidedStarted, setGuidedStarted] = useState(false);

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
    } else if (chatMode === "guided" && userId) {
      setGuidanceLoading(true);
      try {
        const result = await guidedTeaching(userId, msg, guidedTopic, hintLevel);
        useChatStore.getState().addMessage({ role: "user", content: msg });
        useChatStore.getState().addMessage({
          role: "assistant",
          content: result.response,
          sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: result.hint_available }],
        });
        setIsGuidedQuestion(result.is_question);
      } catch {
        toast.error("引导学习请求失败");
      }
      setGuidanceLoading(false);
    } else {
      try {
        await sendMessage(msg);
      } catch {
        toast.error("发送失败，请重试");
      }
    }
  };

  const handleStartGuided = async () => {
    if (!guidedTopic.trim() || !userId) return;
    setGuidanceLoading(true);
    setGuidedStarted(true);
    setHintLevel(0);
    try {
      const result = await guidedTeaching(userId, "", guidedTopic, 0);
      useChatStore.getState().addMessage({ role: "user", content: `🧭 引导学习：${guidedTopic}` });
      useChatStore.getState().addMessage({
        role: "assistant",
        content: result.response,
        sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: result.hint_available }],
      });
      setIsGuidedQuestion(result.is_question);
    } catch {
      toast.error("启动引导学习失败");
    }
    setGuidanceLoading(false);
  };

  const handleHint = async () => {
    if (!userId) return;
    const nextLevel = hintLevel + 1;
    setHintLevel(nextLevel);
    setGuidanceLoading(true);
    try {
      const result = await guidedTeaching(userId, "", guidedTopic, nextLevel);
      useChatStore.getState().addMessage({ role: "user", content: `💡 请求第 ${nextLevel} 级提示` });
      useChatStore.getState().addMessage({
        role: "assistant",
        content: result.response,
        sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: result.hint_available }],
      });
      setIsGuidedQuestion(result.is_question);
    } catch {
      toast.error("获取提示失败");
    }
    setGuidanceLoading(false);
  };

  const handleRevealAnswer = async () => {
    if (!userId) return;
    setGuidanceLoading(true);
    try {
      const result = await guidedTeaching(userId, "请直接告诉我答案", guidedTopic, 0);
      useChatStore.getState().addMessage({ role: "user", content: "🙋 请直接告诉我答案" });
      useChatStore.getState().addMessage({
        role: "assistant",
        content: result.response,
        sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: false }],
      });
      setIsGuidedQuestion(false);
    } catch {
      toast.error("请求失败");
    }
    setGuidanceLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const exitGuided = () => {
    setChatMode("normal");
    setGuidedStarted(false);
    setGuidedTopic("");
    setHintLevel(0);
    setIsGuidedQuestion(false);
  };

  const modeConfig: Record<ChatMode, { label: string; placeholder: string; icon: typeof BookOpen }> = {
    normal: { label: "", placeholder: "输入你的问题...", icon: BookOpen },
    explain: { label: "讲解知识点模式", placeholder: "输入知识点名称，如：中值定理", icon: Lightbulb },
    solve: { label: "解答题目模式", placeholder: "粘贴题目内容，如：求极限...", icon: HelpCircle },
    guided: { label: "引导学习模式", placeholder: "输入你的回答...", icon: Compass },
  };

  const currentMode = modeConfig[chatMode];
  const lastMsg = messages[messages.length - 1];
  const showHintButtons = chatMode === "guided" && guidedStarted && isGuidedQuestion && lastMsg?.role === "assistant";

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
                  {msg.sources.map((s, i) => {
                    const isUserMaterial = s.metadata?.user_id;
                    const isGuided = s.chat_type === "guided";
                    return (
                      <p key={i} className={`text-xs truncate ${isGuided ? "text-purple-500" : isUserMaterial ? "text-blue-500" : "text-muted-foreground"}`}>
                        {isGuided ? `🧭 引导学习 · ${s.topic || ""}` : isUserMaterial ? "来自你的资料：" : ""}
                        {!isGuided && (s.metadata?.filename || s.text || `来源 ${i + 1}`)}
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

      {showHintButtons && (
        <div className="px-4 pb-2 flex gap-2">
          {hintLevel < 3 && (
            <button
              onClick={handleHint}
              disabled={guidanceLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
            >
              <Lightbulb className="h-3 w-3" />
              给我提示（第 {hintLevel + 1} 级）
            </button>
          )}
          <button
            onClick={handleRevealAnswer}
            disabled={guidanceLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-accent hover:bg-accent/80 disabled:opacity-50"
          >
            <MessageCircle className="h-3 w-3" />
            直接告诉我答案
          </button>
        </div>
      )}

      <div className="border-t border-border p-4">
        {chatMode !== "normal" && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <currentMode.icon className="h-3 w-3" />
              {currentMode.label}
            </span>
            <button onClick={chatMode === "guided" ? exitGuided : () => setChatMode("normal")} className="text-xs text-muted-foreground hover:text-foreground">
              退出
            </button>
          </div>
        )}

        {chatMode === "guided" && !guidedStarted && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={guidedTopic}
              onChange={(e) => setGuidedTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStartGuided()}
              placeholder="输入你想学习的知识点，如：中值定理"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleStartGuided}
              disabled={guidanceLoading || !guidedTopic.trim()}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
            >
              {guidanceLoading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Compass className="h-4 w-4" />}
              开始引导
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
          <button
            onClick={() => {
              if (chatMode === "guided") { exitGuided(); } else { setChatMode("guided"); setGuidedStarted(false); }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              chatMode === "guided" ? "bg-purple-600 text-white" : "bg-accent hover:bg-accent/80"
            }`}
          >
            <Compass className="h-3 w-3" />
            引导学习
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            onChange={(e) => (inputValue.current = e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatMode === "guided" && !guidedStarted ? "先输入知识点并点击开始引导" : currentMode.placeholder}
            disabled={chatMode === "guided" && !guidedStarted}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || guidanceLoading || (chatMode === "guided" && !guidedStarted)}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {(isLoading || guidanceLoading) ? <span className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
