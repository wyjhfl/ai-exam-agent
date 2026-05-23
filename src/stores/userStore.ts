import { create } from "zustand";
import { registerUser, loginUser } from "@/services/api";

interface UserState {
  userId: number | null;
  username: string;
  token: string | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
  clearSession: () => void;
}

function clearStorage() {
  localStorage.removeItem("ai_exam_user_id");
  localStorage.removeItem("ai_exam_username");
  localStorage.removeItem("ai_exam_token");
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  username: "",
  token: null,
  isLoggedIn: false,

  login: async (username: string, password: string) => {
    const data = await loginUser(username, password);
    localStorage.setItem("ai_exam_user_id", String(data.user_id));
    localStorage.setItem("ai_exam_username", data.username);
    localStorage.setItem("ai_exam_token", data.token);
    set({ userId: data.user_id, username: data.username, token: data.token, isLoggedIn: true });
    import("@/stores/syncStore").then(({ useSyncStore }) => {
      useSyncStore.getState().syncNow();
    });
  },

  register: async (username: string, password: string) => {
    const data = await registerUser(username, password);
    localStorage.setItem("ai_exam_user_id", String(data.user_id));
    localStorage.setItem("ai_exam_username", data.username);
    localStorage.setItem("ai_exam_token", data.token);
    set({ userId: data.user_id, username: data.username, token: data.token, isLoggedIn: true });
  },

  logout: () => {
    clearStorage();
    set({ userId: null, username: "", token: null, isLoggedIn: false });
  },

  clearSession: () => {
    clearStorage();
    set({ userId: null, username: "", token: null, isLoggedIn: false });
  },

  restoreSession: () => {
    const storedToken = localStorage.getItem("ai_exam_token");
    const storedId = localStorage.getItem("ai_exam_user_id");
    const storedName = localStorage.getItem("ai_exam_username");
    if (storedToken && storedId && storedName) {
      set({ userId: Number(storedId), username: storedName, token: storedToken, isLoggedIn: true });
    }
  },
}));
