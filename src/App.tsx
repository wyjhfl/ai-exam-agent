import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import SearchModal from "@/components/SearchModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import LoginForm from "@/components/LoginForm";
import { checkForUpdate } from "@/services/api";

const HomePage = lazy(() => import("@/pages/HomePage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const WritingPage = lazy(() => import("@/pages/WritingPage"));
const PlanPage = lazy(() => import("@/pages/PlanPage"));
const AnalysisPage = lazy(() => import("@/pages/AnalysisPage"));
const FocusPage = lazy(() => import("@/pages/FocusPage"));
const MaterialsPage = lazy(() => import("@/pages/MaterialsPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));
const WeeklyReportPage = lazy(() => import("@/pages/WeeklyReportPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ExamPapersPage = lazy(() => import("@/pages/ExamPapersPage"));

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function BackendLoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">正在启动后端服务...</p>
        <p className="text-xs text-muted-foreground/60">首次启动可能需要较长时间，请耐心等待</p>
      </div>
    </div>
  );
}

function BackendErrorScreen({ onRetry, errorInfo, retrying }: { onRetry: () => void; errorInfo?: string; retrying: boolean }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
        <div className="text-4xl">&#9888;&#65039;</div>
        <p className="text-lg font-medium">后端服务启动失败</p>
        {errorInfo && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md w-full break-all text-left font-mono">
            {errorInfo}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          请尝试点击下方按钮重新启动，或关闭应用后重新打开
        </p>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {retrying ? "正在重启..." : "重新启动后端"}
        </button>
      </div>
    </div>
  );
}

interface BackendInfo {
  started: boolean;
  error: string | null;
  exe_path: string;
}

async function waitForBackend(maxRetries = 60, intervalMs = 1000): Promise<boolean> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function getBackendInfoFromTauri(): Promise<BackendInfo | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<BackendInfo>("get_backend_info");
  } catch {
    return null;
  }
}

function App() {
  const { restoreSession, isLoggedIn } = useUserStore();
  const userId = useUserStore((s) => s.userId);
  const { setUserId } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [backendFailed, setBackendFailed] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [retrying, setRetrying] = useState(false);

  const checkBackend = useCallback(async () => {
    const ok = await waitForBackend(60, 1000);
    if (ok) {
      setBackendReady(true);
    } else {
      setBackendFailed(true);
      const info = await getBackendInfoFromTauri();
      if (info?.error) {
        setBackendError(info.error);
      } else {
        setBackendError("后端服务启动超时，请检查是否有其他程序占用 8000 端口");
      }
    }
  }, []);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setBackendFailed(false);
    setBackendError("");

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("restart_backend");
    } catch (e) {
      console.warn("restart_backend command failed:", e);
    }

    const ok = await waitForBackend(60, 1000);
    if (ok) {
      setBackendReady(true);
    } else {
      setBackendFailed(true);
      const info = await getBackendInfoFromTauri();
      if (info?.error) {
        setBackendError(info.error);
      } else {
        setBackendError("后端服务启动超时，请检查是否有其他程序占用 8000 端口");
      }
    }
    setRetrying(false);
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (userId) setUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (isLoggedIn) {
      checkForUpdate().then((result) => {
        if (result.hasUpdate) {
          toast.info(
            <div>
              <p className="font-medium">发现新版本 v{result.latestVersion}</p>
              {result.releaseNotes && (
                <p className="text-xs text-muted-foreground mt-1">{result.releaseNotes}</p>
              )}
              {result.downloadUrl && (
                <a
                  href={result.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline mt-1 inline-block"
                >
                  前往下载 →
                </a>
              )}
            </div>,
            { duration: 10000 }
          );
        }
      }).catch(() => {});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (backendFailed) {
    return <BackendErrorScreen onRetry={handleRetry} errorInfo={backendError} retrying={retrying} />;
  }

  if (!backendReady) {
    return <BackendLoadingScreen />;
  }

  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {isLoggedIn ? (
          <>
            <Sidebar onOpenSearch={() => setSearchOpen(true)} />
            <main className="flex-1 overflow-hidden">
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/materials" element={<MaterialsPage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="/exam-papers" element={<ExamPapersPage />} />
                  <Route path="/writing" element={<WritingPage />} />
                  <Route path="/plan" element={<PlanPage />} />
                  <Route path="/analysis" element={<AnalysisPage />} />
                  <Route path="/focus" element={<FocusPage />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/weekly-report" element={<WeeklyReportPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </main>
          </>
        ) : (
          <LoginForm />
        )}
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Toaster richColors position="top-right" />
    </HashRouter>
  );
}

export default App;
