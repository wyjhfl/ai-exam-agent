import { create } from "zustand";
import { fetchStreamMessage, sendMessage, fetchHistory } from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  sources?: Record<string, any>[];
  streaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  userId: number;
  setUserId: (id: number) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastAssistant: (content: string) => void;
  appendToLastAssistant: (chunk: string) => void;
  setLastAssistantSources: (sources: Record<string, any>[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  sendMessage: (message: string) => Promise<void>;
  loadHistory: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  userId: Number(localStorage.getItem("ai_exam_user_id") || "0"),

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

  sendMessage: async (message) => {
    const { addMessage, setLoading, appendToLastAssistant, setLastAssistantSources, userId } = get();
    if (!userId) return;

    addMessage({ role: "user", content: message });
    addMessage({ role: "assistant", content: "", streaming: true });
    setLoading(true);

    try {
      await fetchStreamMessage(
        message,
        userId,
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
        (sources) => setLastAssistantSources(sources)
      );
    } catch {
      try {
        const result = await sendMessage(message, userId);
        get().updateLastAssistant(result.response);
        if (result.sources) {
          get().setLastAssistantSources(result.sources);
        }
      } catch {
        get().updateLastAssistant("抱歉，请求出错了，请稍后重试。");
      }
      set({ isLoading: false });
    }
  },

  loadHistory: async () => {
    const { userId } = get();
    if (!userId) return;
    try {
      const history = await fetchHistory(userId);
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
      // history load failed, start fresh
    }
  },
}));
