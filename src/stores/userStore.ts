import { create } from "zustand";
import { registerUser, loginUser } from "@/services/api";

interface UserState {
  userId: number | null;
  username: string;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  username: "",
  isLoggedIn: false,

  login: async (username: string, password: string) => {
    const data = await loginUser(username, password);
    localStorage.setItem("ai_exam_user_id", String(data.user_id));
    localStorage.setItem("ai_exam_username", data.username);
    set({ userId: data.user_id, username: data.username, isLoggedIn: true });
  },

  register: async (username: string, password: string) => {
    const data = await registerUser(username, password);
    localStorage.setItem("ai_exam_user_id", String(data.user_id));
    localStorage.setItem("ai_exam_username", data.username);
    set({ userId: data.user_id, username: data.username, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem("ai_exam_user_id");
    localStorage.removeItem("ai_exam_username");
    set({ userId: null, username: "", isLoggedIn: false });
  },

  restoreSession: () => {
    const storedId = localStorage.getItem("ai_exam_user_id");
    const storedName = localStorage.getItem("ai_exam_username");
    if (storedId && storedName) {
      set({ userId: Number(storedId), username: storedName, isLoggedIn: true });
    }
  },
}));
