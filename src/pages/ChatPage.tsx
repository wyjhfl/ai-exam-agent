import { useEffect, useRef, useState, useMemo } from "react";
import { Send, BookOpen, Lightbulb, HelpCircle, Compass, MessageCircle, Plus, Trash2, Pencil, PanelLeftClose, PanelLeft, Menu } from "lucide-react";
import { useChatStore, type Conversation } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { explainTopic, solveQuestion, guidedTeaching } from "@/services/api";
import { formatMarkdown } from "@/lib/format";
import { toast } from "sonner";

function MessageContent({ content }: { content: string }) {
  const html = useMemo(() => formatMarkdown(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

type ChatMode = "normal" | "explain" | "solve" | "guided";

function ChatPage() {
  const {
    messages, isLoading, sendMessage, conversations, activeConversationId,
    loadConversations, createConversation, switchConversation, deleteConversation, renameConversation,
    setActiveConversationId,
  } = useChatStore();
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (userId) loadConversations();
  }, [userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewConversation = async () => {
    await createConversation();
    setChatMode("normal");
    setGuidedStarted(false);
    setGuidedTopic("");
    setMobileSidebarOpen(false);
  };

  const handleSwitchConversation = async (id: number) => {
    await switchConversation(id);
    setChatMode("normal");
    setGuidedStarted(false);
    setMobileSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: number) => {
    await deleteConversation(id);
  };

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleFinishRename = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleSend = async () => {
    const msg = inputValue.current.trim();
    if (!msg || isLoading || guidanceLoading) return;
    if (chatMode === "guided" && !guidedStarted) {
      toast.info("请先输入知识点并点击开始引导");
      return;
    }
    inputValue.current = "";
    if (inputRef.current) inputRef.current.value = "";

    if (chatMode === "explain" && userId) {
      setGuidanceLoading(true);
      try {
        const result = await explainTopic(msg);
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
        const result = await solveQuestion(msg);
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
        const result = await guidedTeaching(msg, guidedTopic, hintLevel, activeConversationId);
        useChatStore.getState().addMessage({ role: "user", content: msg });
        useChatStore.getState().addMessage({
          role: "assistant",
          content: result.response,
          sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: result.hint_available }],
        });
        setIsGuidedQuestion(result.is_question);
        if (result.conversation_id && !activeConversationId) {
          setActiveConversationId(result.conversation_id);
          loadConversations();
        }
      } catch {
        toast.error("引导学习请求失败");
      }
      setGuidanceLoading(false);
    } else {
      try {
        await sendMessage(msg);
        loadConversations();
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
      const result = await guidedTeaching("", guidedTopic, 0, activeConversationId);
      useChatStore.getState().addMessage({ role: "user", content: `🧭 引导学习：${guidedTopic}` });
      useChatStore.getState().addMessage({
        role: "assistant",
        content: result.response,
        sources: [{ chat_type: "guided", topic: guidedTopic, hint_available: result.hint_available }],
      });
      setIsGuidedQuestion(result.is_question);
      if (result.conversation_id && !activeConversationId) {
        setActiveConversationId(result.conversation_id);
        loadConversations();
      }
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
      const result = await guidedTeaching("", guidedTopic, nextLevel, activeConversationId);
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
      const result = await guidedTeaching("请直接告诉我答案", guidedTopic, 0, activeConversationId);
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

  const visibleMessages = useMemo(() => {
    if (messages.length <= 100) return messages;
    return messages.slice(-100);
  }, [messages]);

  const modeLabel: Record<string, string> = { normal: "", explain: "讲解", solve: "解题", guided: "引导" };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建对话
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-accent/50 ${
              activeConversationId === conv.id ? "bg-accent" : ""
            }`}
            onClick={() => handleSwitchConversation(conv.id)}
          >
            <div className="flex-1 min-w-0">
              {editingId === conv.id ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => e.key === "Enter" && handleFinishRename()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              ) : (
                <>
                  <p className="text-sm truncate">{conv.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {conv.chat_mode && conv.chat_mode !== "normal" && (
                      <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0 rounded">
                        {modeLabel[conv.chat_mode] || conv.chat_mode}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : new Date(conv.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(conv); }}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">暂无对话</p>
        )}
      </div>
      <div className="p-2 border-t border-border hidden md:block">
        <button
          onClick={() => setSidebarOpen(false)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
          收起侧栏
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      {sidebarOpen && (
        <div className="hidden md:flex w-60 shrink-0 border-r border-border flex-col bg-card">
          {sidebarContent}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-card border-r border-border flex flex-col shadow-lg">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground truncate">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title || "对话"
              : "新对话"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">向 AI 助手提问考研相关问题</p>
            </div>
          )}
          {visibleMessages.map((msg) => (
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
                    <MessageContent content={msg.content} />
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
    </div>
  );
}

export default ChatPage;
