import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("网络连接失败，请检查后端服务");
    } else if (error.response.status >= 500) {
      toast.error(error.response.data?.error || "服务器错误");
    } else if (error.response.status >= 400) {
      toast.error(error.response.data?.detail || error.response.data?.error || "请求失败");
    }
    return Promise.reject(error);
  }
);

export async function registerUser(username: string, password: string) {
  const { data } = await api.post("/api/user/register", { username, password });
  return data;
}

export async function loginUser(username: string, password: string) {
  const { data } = await api.post("/api/user/login", { username, password });
  return data;
}

export async function createUser(username: string = "default") {
  const { data } = await api.post("/api/user/create", { username });
  return data;
}

export async function getUser(userId: number) {
  const { data } = await api.get(`/api/user/${userId}`);
  return data;
}

export async function sendMessage(message: string, userId: number) {
  const { data } = await api.post("/api/chat/message", { message, user_id: userId });
  return data;
}

export async function fetchHistory(userId: number, limit: number = 50) {
  const { data } = await api.get(`/api/chat/history/${userId}`, { params: { limit } });
  return data;
}

export async function fetchStreamMessage(
  message: string,
  userId: number,
  onChunk: (text: string) => void,
  onDone: () => void,
  onSources?: (sources: Record<string, any>[]) => void
) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const response = await fetch(`${baseURL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, user_id: userId }),
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "sources" && onSources) {
            onSources(parsed.sources);
          } else if (parsed.content) {
            onChunk(parsed.content);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }
  onDone();
}

export async function fetchKnowledgeStatus() {
  const { data } = await api.get("/api/knowledge/status");
  return data;
}

export async function indexKnowledgeBase() {
  const { data } = await api.post("/api/knowledge/index");
  return data;
}

export async function reindexKnowledgeBase() {
  const { data } = await api.post("/api/knowledge/reindex");
  return data;
}

export async function fetchQuestions(subject?: string, difficulty?: string) {
  const params: Record<string, string> = {};
  if (subject && subject !== "全部") params.subject = subject;
  if (difficulty) params.difficulty = difficulty;
  const { data } = await api.get("/api/quiz/questions", { params });
  return data;
}

export async function fetchMoreQuestions(subject: string, count: number = 5) {
  const params: Record<string, string> = { generate: "true", count: String(count) };
  if (subject && subject !== "全部") params.subject = subject;
  const { data } = await api.get("/api/quiz/questions", { params });
  return data;
}

export async function generateQuizQuestions(subject: string, topic: string, difficulty: string, count: number) {
  const { data } = await api.post("/api/quiz/generate", { subject, topic, difficulty, count });
  return data;
}

export async function submitAnswer(userId: number, questionId: number, selectedAnswer: string) {
  const { data } = await api.post("/api/quiz/answer", {
    user_id: userId,
    question_id: questionId,
    selected_answer: selectedAnswer,
  });
  return data;
}

export async function fetchWrongQuestions(userId: number) {
  const { data } = await api.get(`/api/quiz/wrong/${userId}`);
  return data;
}

export async function markWrongMastered(id: number) {
  const { data } = await api.post(`/api/quiz/wrong/${id}/master`);
  return data;
}

export async function fetchReviewQuestions(userId: number) {
  const { data } = await api.get(`/api/quiz/review/${userId}`);
  return data;
}

export async function submitReviewAnswer(wrongId: number, isCorrect: boolean) {
  const { data } = await api.post(`/api/quiz/review/${wrongId}/answer`, { is_correct: isCorrect });
  return data;
}

export async function generatePlan(userId: number, targetSchool: string, targetMajor: string, examDate: string, subjects: Record<string, number>) {
  const { data } = await api.post("/api/plan/generate", {
    user_id: userId,
    target_school: targetSchool,
    target_major: targetMajor,
    exam_date: examDate,
    subjects,
  });
  return data;
}

export async function fetchPlan(userId: number) {
  const { data } = await api.get(`/api/plan/${userId}`);
  return data;
}

export async function updatePlan(planId: number, planData: Record<string, any>) {
  const { data } = await api.put(`/api/plan/${planId}`, { plan_data: planData });
  return data;
}

export async function fetchAnalysisOverview(userId: number) {
  const { data } = await api.get(`/api/analysis/${userId}/overview`);
  return data;
}

export async function fetchSubjectStats(userId: number) {
  const { data } = await api.get(`/api/analysis/${userId}/subject-stats`);
  return data;
}

export async function fetchTrend(userId: number) {
  const { data } = await api.get(`/api/analysis/${userId}/trend`);
  return data;
}

export async function evaluateWriting(text: string, essayType: string, userId: number) {
  const { data } = await api.post("/api/writing/evaluate", { text, essay_type: essayType, user_id: userId });
  return data;
}

export async function fetchWritingHistory(userId: number) {
  const { data } = await api.get(`/api/writing/history/${userId}`);
  return data;
}

export async function startFocus(userId: number, subject: string, duration: number) {
  const { data } = await api.post("/api/focus/start", { user_id: userId, subject, duration });
  return data;
}

export async function completeFocus(sessionId: number, actualDuration: number) {
  const { data } = await api.post("/api/focus/complete", { session_id: sessionId, actual_duration: actualDuration });
  return data;
}

export async function fetchTodayFocus(userId: number) {
  const { data } = await api.get(`/api/focus/today/${userId}`);
  return data;
}

export function getExportUrl(userId: number, type: "wrong-questions" | "study-summary", format: "json" | "excel" = "excel") {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  if (format === "excel") {
    return `${baseURL}/api/export/${userId}/${type}/excel`;
  }
  return `${baseURL}/api/export/${userId}/${type}`;
}

export const APP_VERSION = "0.2.0";

export async function checkForUpdate(): Promise<{ hasUpdate: boolean; currentVersion: string; message: string }> {
  return { hasUpdate: false, currentVersion: APP_VERSION, message: `当前已是最新版本 v${APP_VERSION}` };
}

export default api;
