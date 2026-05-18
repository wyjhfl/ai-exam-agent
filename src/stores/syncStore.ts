import { create } from "zustand";
import { syncFull, fetchSyncStatus } from "@/services/api";
import { toast } from "sonner";

interface SyncState {
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncNow: (userId: number) => Promise<void>;
  loadStatus: (userId: number) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  lastSyncTime: null,
  isSyncing: false,

  syncNow: async (userId: number) => {
    set({ isSyncing: true });
    try {
      await syncFull(userId, {});
      const now = Date.now();
      set({ lastSyncTime: now, isSyncing: false });
      localStorage.setItem("ai_exam_last_sync", String(now));
      toast.success("数据同步完成");
    } catch {
      toast.error("同步失败，请稍后重试");
      set({ isSyncing: false });
    }
  },

  loadStatus: async (userId: number) => {
    try {
      const data = await fetchSyncStatus(userId);
      if (data.last_sync_time) {
        set({ lastSyncTime: new Date(data.last_sync_time).getTime() });
      }
    } catch {
      // silent
    }
  },
}));
