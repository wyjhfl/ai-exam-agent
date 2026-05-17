import { create } from "zustand";
import { createUser, getUser } from "@/services/api";

interface UserState {
  userId: number;
  username: string;
  isLoaded: boolean;
  initUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  userId: Number(localStorage.getItem("ai_exam_user_id") || "0"),
  username: "",
  isLoaded: false,

  initUser: async () => {
    const storedId = Number(localStorage.getItem("ai_exam_user_id") || "0");
    if (storedId > 0) {
      try {
        const user = await getUser(storedId);
        set({ userId: user.id, username: user.username, isLoaded: true });
        return;
      } catch {
        // user not found, create new
      }
    }
    try {
      const user = await createUser("user_" + Date.now());
      localStorage.setItem("ai_exam_user_id", String(user.id));
      set({ userId: user.id, username: user.username, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },
}));
