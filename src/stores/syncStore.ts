import { create } from "zustand";
import { syncFull, fetchSyncStatus } from "@/services/api";
import { toast } from "sonner";

interface SyncState {
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  lastSyncTime: null,
  isSyncing: false,

  syncNow: async () => {
    set({ isSyncing: true });
    try {
      await syncFull({});
      const now = Date.now();
      set({ lastSyncTime: now, isSyncing: false });
      localStorage.setItem("ai_exam_last_sync", String(now));
      toast.success("数据同步完成");
    } catch {
      toast.error("同步失败，请稍后重试");
      set({ isSyncing: false });
    }
  },

  loadStatus: async () => {
    try {
      const data = await fetchSyncStatus();
      if (data.last_sync_time) {
        set({ lastSyncTime: new Date(data.last_sync_time).getTime() });
      }
    } catch {
      // silent
    }
  },
}));
