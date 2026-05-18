import { NavLink } from "react-router-dom";
import { Home, MessageSquare, BookMarked, BookOpen, BarChart3, PenLine, Timer, Sun, Moon, Monitor, PanelLeftClose, PanelLeft, User, LogOut, RefreshCw, FolderOpen } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useUserStore } from "@/stores/userStore";
import { APP_VERSION, checkForUpdate } from "@/services/api";
import { toast } from "sonner";
import { useState } from "react";

const navItems = [
  { to: "/", icon: Home, label: "首页" },
  { to: "/chat", icon: MessageSquare, label: "对话" },
  { to: "/materials", icon: FolderOpen, label: "资料" },
  { to: "/quiz", icon: BookMarked, label: "刷题" },
  { to: "/writing", icon: PenLine, label: "作文" },
  { to: "/plan", icon: BookOpen, label: "规划" },
  { to: "/analysis", icon: BarChart3, label: "分析" },
  { to: "/focus", icon: Timer, label: "专注" },
];

function Sidebar() {
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { username, logout } = useUserStore();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdate();
      if (result.hasUpdate) {
        toast.info(`发现新版本！${result.message}`);
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
  );
}

export default Sidebar;
