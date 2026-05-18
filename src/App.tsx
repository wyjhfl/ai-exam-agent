import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import HomePage from "@/pages/HomePage";
import ChatPage from "@/pages/ChatPage";
import QuizPage from "@/pages/QuizPage";
import WritingPage from "@/pages/WritingPage";
import PlanPage from "@/pages/PlanPage";
import AnalysisPage from "@/pages/AnalysisPage";
import FocusPage from "@/pages/FocusPage";
import MaterialsPage from "@/pages/MaterialsPage";
import CommunityPage from "@/pages/CommunityPage";
import KnowledgePage from "@/pages/KnowledgePage";
import { useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import LoginForm from "@/components/LoginForm";
import { checkForUpdate } from "@/services/api";

function App() {
  const { restoreSession, isLoggedIn } = useUserStore();
  const userId = useUserStore((s) => s.userId);
  const { setUserId } = useChatStore();

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

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {isLoggedIn ? (
          <>
            <Sidebar />
            <main className="flex-1 overflow-hidden">
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
              </Routes>
            </main>
          </>
        ) : (
          <LoginForm />
        )}
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
