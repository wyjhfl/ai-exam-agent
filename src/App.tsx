import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { useEffect, lazy, Suspense, useState } from "react";
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

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const { restoreSession, isLoggedIn } = useUserStore();
  const userId = useUserStore((s) => s.userId);
  const { setUserId } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(false);

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
          toast.info(`发现新版本！${result.message}`);
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

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
