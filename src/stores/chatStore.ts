import { create } from "zustand";
import { fetchStreamMessage, sendMessage, fetchHistory, fetchConversations, createConversation, deleteConversation as apiDeleteConversation, renameConversation as apiRenameConversation } from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  sources?: Record<string, any>[];
  streaming?: boolean;
}

export interface Conversation {
  id: number;
  title: string;
  chat_mode: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  userId: number;
  conversations: Conversation[];
  activeConversationId: number | null;
  setUserId: (id: number) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastAssistant: (content: string) => void;
  appendToLastAssistant: (chunk: string) => void;
  setLastAssistantSources: (sources: Record<string, any>[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  sendMessage: (message: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadConversations: () => Promise<void>;
  createConversation: (title?: string, mode?: string) => Promise<Conversation | null>;
  switchConversation: (id: number) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
  renameConversation: (id: number, title: string) => Promise<void>;
  setActiveConversationId: (id: number | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  userId: Number(localStorage.getItem("ai_exam_user_id") || "0"),
  conversations: [],
  activeConversationId: null,

  setUserId: (id: number) => {
    localStorage.setItem("ai_exam_user_id", String(id));
    set({ userId: id });
  },

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  updateLastAssistant: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
        msgs[lastIdx] = { ...msgs[lastIdx], content, streaming: false };
      }
      return { messages: msgs };
    }),

  appendToLastAssistant: (chunk) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
        msgs[lastIdx] = {
          ...msgs[lastIdx],
          content: msgs[lastIdx].content + chunk,
          streaming: true,
        };
      }
      return { messages: msgs };
    }),

  setLastAssistantSources: (sources) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
        msgs[lastIdx] = { ...msgs[lastIdx], sources };
      }
      return { messages: msgs };
    }),

  clearMessages: () => set({ messages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  sendMessage: async (message) => {
    const { addMessage, setLoading, appendToLastAssistant, setLastAssistantSources, userId, activeConversationId } = get();
    if (!userId) return;

    addMessage({ role: "user", content: message });
    addMessage({ role: "assistant", content: "", streaming: true });
    setLoading(true);

    try {
      await fetchStreamMessage(
        message,
        (chunk) => appendToLastAssistant(chunk),
        () => {
          set((state) => {
            const msgs = [...state.messages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
              msgs[lastIdx] = { ...msgs[lastIdx], streaming: false };
            }
            return { messages: msgs, isLoading: false };
          });
        },
        (sources) => setLastAssistantSources(sources),
        activeConversationId,
        (convId) => {
          if (convId && !get().activeConversationId) {
            set({ activeConversationId: convId });
            get().loadConversations();
          }
        }
      );
    } catch {
      try {
        const result = await sendMessage(message, activeConversationId);
        get().updateLastAssistant(result.response);
        if (result.sources) {
          get().setLastAssistantSources(result.sources);
        }
        if (result.conversation_id && !get().activeConversationId) {
          set({ activeConversationId: result.conversation_id });
          get().loadConversations();
        }
      } catch {
        get().updateLastAssistant("抱歉，请求出错了，请稍后重试。");
      }
      set({ isLoading: false });
    }
  },

  loadHistory: async () => {
    const { userId, activeConversationId } = get();
    if (!userId) return;
    try {
      const history = await fetchHistory(50, activeConversationId || undefined);
      const msgs: ChatMessage[] = history.map(
        (m: { id: number; role: string; content: string; sources?: any[]; created_at: string }) => ({
          id: String(m.id),
          role: m.role as ChatMessage["role"],
          content: m.content,
          sources: m.sources || [],
          timestamp: new Date(m.created_at).getTime(),
        })
      );
      set({ messages: msgs });
    } catch {
      set({ messages: [] });
    }
  },

  loadConversations: async () => {
    const { userId } = get();
    if (!userId) return;
    try {
      const convs = await fetchConversations();
      set({ conversations: convs });
    } catch {
      // ignore
    }
  },

  createConversation: async (title?: string, mode?: string) => {
    const { userId } = get();
    if (!userId) return null;
    try {
      const conv = await createConversation(title, mode);
      await get().loadConversations();
      set({ activeConversationId: conv.id, messages: [] });
      return conv;
    } catch {
      return null;
    }
  },

  switchConversation: async (id: number) => {
    set({ activeConversationId: id });
    await get().loadHistory();
  },

  deleteConversation: async (id: number) => {
    try {
      await apiDeleteConversation(id);
      const { activeConversationId } = get();
      if (activeConversationId === id) {
        set({ activeConversationId: null, messages: [] });
      }
      await get().loadConversations();
    } catch {
      // ignore
    }
  },

  renameConversation: async (id: number, title: string) => {
    try {
      await apiRenameConversation(id, title);
      await get().loadConversations();
    } catch {
      // ignore
    }
  },
}));
