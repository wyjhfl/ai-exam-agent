import { NavLink } from "react-router-dom";
import { Home, MessageSquare, BookMarked, FileText, BookOpen, BarChart3, PenLine, Timer, Sun, Moon, Monitor, PanelLeftClose, PanelLeft, User, LogOut, RefreshCw, FolderOpen, Users, Network, ClipboardList, Search, Settings } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useUserStore } from "@/stores/userStore";
import { useSyncStore } from "@/stores/syncStore";
import { APP_VERSION, checkForUpdate, fetchReminders } from "@/services/api";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import UpdateDialog from "@/components/UpdateDialog";

const navItems = [
  { to: "/", icon: Home, label: "首页" },
  { to: "/chat", icon: MessageSquare, label: "对话" },
  { to: "/materials", icon: FolderOpen, label: "资料" },
  { to: "/quiz", icon: BookMarked, label: "刷题" },
  { to: "/exam-papers", icon: FileText, label: "真题库" },
  { to: "/writing", icon: PenLine, label: "作文" },
  { to: "/plan", icon: BookOpen, label: "规划" },
  { to: "/analysis", icon: BarChart3, label: "分析" },
  { to: "/weekly-report", icon: ClipboardList, label: "周报" },
  { to: "/knowledge", icon: Network, label: "知识点" },
  { to: "/community", icon: Users, label: "社区" },
  { to: "/focus", icon: Timer, label: "专注" },
  { to: "/settings", icon: Settings, label: "设置" },
];

function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { username, logout, userId } = useUserStore();
  const { lastSyncTime, isSyncing, syncNow } = useSyncStore();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [updateDialog, setUpdateDialog] = useState<{ open: boolean; latestVersion: string; currentVersion: string; releaseNotes: string; downloadUrl: string }>({
    open: false, latestVersion: "", currentVersion: "", releaseNotes: "", downloadUrl: "",
  });

  useEffect(() => {
    if (userId) {
      fetchReminders().then((data) => {
        const review = (data.reminders || []).find((r: any) => r.type === "review");
        setDueCount(review?.count || 0);
      }).catch(() => {});
    }
  }, [userId]);

  const handleSync = () => {
    if (userId) syncNow();
  };

  const formatSyncTime = (ts: number | null) => {
    if (!ts) return "未同步";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "刚刚同步";
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前同步`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前同步`;
    return `${Math.floor(diff / 86400)}天前同步`;
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdate();
      if (result.hasUpdate) {
        setUpdateDialog({
          open: true,
          latestVersion: result.latestVersion,
          currentVersion: result.currentVersion,
          releaseNotes: result.releaseNotes,
          downloadUrl: result.downloadUrl,
        });
      } else {
        toast.success(result.message);
      }
    } catch {
      toast.error("检查更新失败");
    }
    setCheckingUpdate(false);
  };

  const themeOptions: { value: "light" | "dark" | "system"; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "亮色" },
    { value: "dark", icon: Moon, label: "暗色" },
    { value: "system", icon: Monitor, label: "跟随系统" },
  ];

  return (
    <>
    <aside
      className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${
        sidebarCollapsed ? "w-14" : "w-48"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        {!sidebarCollapsed && <span className="text-sm font-bold">AI 考研助手</span>}
        <button onClick={toggleSidebar} className="p-1 rounded hover:bg-accent">
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="px-2 py-2">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">搜索...</span>
              <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 py-2 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              } ${sidebarCollapsed ? "justify-center" : ""}`
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
            {!sidebarCollapsed && item.to === "/quiz" && dueCount > 0 && (
              <span className="rounded-full bg-destructive text-destructive-foreground px-1.5 text-xs ml-auto">
                {dueCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2 space-y-2">
        <div className={`flex ${sidebarCollapsed ? "flex-col items-center" : "items-center justify-between"} gap-1`}>
          {sidebarCollapsed ? (
            <button onClick={logout} className="p-1.5 rounded hover:bg-accent" title={`${username} - 退出登录`}>
              <User className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">{username}</span>
              </div>
              <button onClick={logout} className="p-1.5 rounded hover:bg-accent" title="退出登录">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className={`flex ${sidebarCollapsed ? "flex-col items-center" : "items-center justify-center"} gap-1`}>
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`p-1.5 rounded transition-colors ${
                theme === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              title={opt.label}
            >
              <opt.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className={`flex ${sidebarCollapsed ? "flex-col items-center" : "items-center justify-between"} text-xs text-muted-foreground`}>
          {sidebarCollapsed ? (
            <button onClick={handleSync} disabled={isSyncing} className="p-1 rounded hover:bg-accent" title={formatSyncTime(lastSyncTime)}>
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          ) : (
            <>
              <span className="text-xs">{formatSyncTime(lastSyncTime)}</span>
              <button onClick={handleSync} disabled={isSyncing} className="flex items-center gap-1 p-1 rounded hover:bg-accent">
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                <span>同步</span>
              </button>
            </>
          )}
        </div>

        <div className={`flex ${sidebarCollapsed ? "flex-col items-center" : "items-center justify-between"} text-xs text-muted-foreground`}>
          {sidebarCollapsed ? (
            <button onClick={handleCheckUpdate} disabled={checkingUpdate} className="p-1 rounded hover:bg-accent" title={`v${APP_VERSION} - 检查更新`}>
              <RefreshCw className={`h-3 w-3 ${checkingUpdate ? "animate-spin" : ""}`} />
            </button>
          ) : (
            <>
              <span>v{APP_VERSION}</span>
              <button onClick={handleCheckUpdate} disabled={checkingUpdate} className="flex items-center gap-1 p-1 rounded hover:bg-accent">
                <RefreshCw className={`h-3 w-3 ${checkingUpdate ? "animate-spin" : ""}`} />
                <span>检查更新</span>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
    <UpdateDialog
      open={updateDialog.open}
      onClose={() => setUpdateDialog((p) => ({ ...p, open: false }))}
      currentVersion={updateDialog.currentVersion}
      latestVersion={updateDialog.latestVersion}
      releaseNotes={updateDialog.releaseNotes}
      downloadUrl={updateDialog.downloadUrl}
    />
    </>
  );
}

export default Sidebar;
