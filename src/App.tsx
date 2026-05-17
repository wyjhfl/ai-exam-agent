import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import HomePage from "@/pages/HomePage";
import ChatPage from "@/pages/ChatPage";
import QuizPage from "@/pages/QuizPage";
import WritingPage from "@/pages/WritingPage";
import PlanPage from "@/pages/PlanPage";
import AnalysisPage from "@/pages/AnalysisPage";
import FocusPage from "@/pages/FocusPage";
import { useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { useEffect } from "react";

function App() {
  const { initUser } = useUserStore();
  const { setUserId } = useChatStore();
  const userId = useUserStore((s) => s.userId);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (userId) setUserId(userId);
  }, [userId]);

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/writing" element={<WritingPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/focus" element={<FocusPage />} />
          </Routes>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
