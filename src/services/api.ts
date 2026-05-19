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
    const status = error.response?.status;
    const url = error.config?.url;
    const detail = error.response?.data?.detail || error.response?.data?.error;

    if (!error.response) {
      toast.error("网络连接失败，请检查后端服务");
      console.error(`[Network Error] ${url}`);
    } else if (status >= 500) {
      toast.error(detail || "服务器错误");
      console.error(`[Server Error ${status}] ${url}: ${detail}`);
    } else if (status >= 400) {
      toast.error(detail || "请求失败");
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

export async function generateQuizQuestions(subject: string, topic: string, difficulty: string, count: number, questionType: string = "single_choice") {
  const { data } = await api.post("/api/quiz/generate", { subject, topic, difficulty, count, question_type: questionType });
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

export function getExportUrl(userId: number, type: "wrong-questions" | "study-summary", format: "json" | "excel" | "pdf" = "excel") {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  if (format === "pdf") {
    return `${baseURL}/api/export/${userId}/${type}/pdf`;
  }
  if (format === "excel") {
    return `${baseURL}/api/export/${userId}/${type}/excel`;
  }
  return `${baseURL}/api/export/${userId}/${type}`;
}

export const APP_VERSION = "0.5.0";

export async function uploadFile(userId: number, subject: string, fileType: string, file: File, onProgress?: (pct: number) => void) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const formData = new FormData();
  formData.append("user_id", String(userId));
  formData.append("subject", subject);
  formData.append("file_type", fileType);
  formData.append("file", file);

  return new Promise<{ file_id: string; filename: string; subject: string; file_type: string; pages: number; chunks: number; size: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseURL}/api/uploads/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new Error("上传失败"));
    xhr.send(formData);
  });
}

export async function fetchUploads(userId: number) {
  const { data } = await api.get(`/api/uploads/${userId}`);
  return data;
}

export async function deleteUpload(userId: number, fileId: string) {
  const { data } = await api.delete(`/api/uploads/${userId}/${fileId}`);
  return data;
}

export async function reindexUpload(userId: number, fileId: string) {
  const { data } = await api.post(`/api/uploads/${userId}/${fileId}/reindex`);
  return data;
}

export async function generateStudyPlanFromMaterials(userId: number, subject: string) {
  const { data } = await api.post("/api/guidance/study-plan", { user_id: userId, subject });
  return data;
}

export async function explainTopic(userId: number, topic: string) {
  const { data } = await api.post("/api/guidance/explain", { user_id: userId, topic });
  return data;
}

export async function solveQuestion(userId: number, questionText: string) {
  const { data } = await api.post("/api/guidance/solve", { user_id: userId, question_text: questionText });
  return data;
}

export async function checkForUpdate(): Promise<{ hasUpdate: boolean; currentVersion: string; message: string }> {
  return { hasUpdate: false, currentVersion: APP_VERSION, message: `当前已是最新版本 v${APP_VERSION}` };
}

export async function syncUpload(userId: number, dataType: string, data: Record<string, any>[]) {
  const { data: result } = await api.post("/api/sync/upload", { user_id: userId, data_type: dataType, data });
  return result;
}

export async function syncDownload(userId: number, dataType: string = "all") {
  const { data } = await api.post("/api/sync/download", { user_id: userId, data_type: dataType });
  return data;
}

export async function syncFull(userId: number, localData: Record<string, any[]>) {
  const { data } = await api.post("/api/sync/full", { user_id: userId, local_data: localData });
  return data;
}

export async function fetchSyncStatus(userId: number) {
  const { data } = await api.get(`/api/sync/status/${userId}`);
  return data;
}

export async function communityShare(userId: number, title: string, content: string, itemType: string, subject: string) {
  const { data } = await api.post("/api/community/share", { user_id: userId, title, content, item_type: itemType, subject });
  return data;
}

export async function fetchCommunityPosts(subject?: string, type?: string, page: number = 1, limit: number = 20) {
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (subject) params.subject = subject;
  if (type) params.type = type;
  const { data } = await api.get("/api/community/posts", { params });
  return data;
}

export async function fetchCommunityPost(postId: number) {
  const { data } = await api.get(`/api/community/posts/${postId}`);
  return data;
}

export async function likeCommunityPost(postId: number) {
  const { data } = await api.post(`/api/community/posts/${postId}/like`);
  return data;
}

export async function commentCommunityPost(postId: number, userId: number, content: string) {
  const { data } = await api.post(`/api/community/posts/${postId}/comment`, { user_id: userId, content });
  return data;
}

export async function shareWrongToCommunity(wrongId: number) {
  const { data } = await api.post(`/api/community/share-wrong/${wrongId}`);
  return data;
}

export async function startMockExam(userId: number, subject: string, count: number, duration: number) {
  const { data } = await api.post("/api/quiz/mock-exam", { user_id: userId, subject, question_count: count, duration_minutes: duration });
  return data;
}

export async function submitMockExam(examId: number, answers: {question_id: number; selected_answer: string}[], durationSeconds: number) {
  const { data } = await api.post(`/api/quiz/mock-exam/${examId}/submit`, { answers, duration_seconds: durationSeconds });
  return data;
}

export async function getKnowledgeTree(subject?: string) {
  if (subject) {
    const { data } = await api.get(`/api/knowledge-points/tree/${subject}`);
    return data;
  }
  const { data } = await api.get("/api/knowledge-points/tree");
  return data;
}

export async function getUserMastery(userId: number) {
  const { data } = await api.get(`/api/knowledge-points/${userId}/mastery`);
  return data;
}

export async function searchResources(query: string, subject?: string) {
  const params: Record<string, string> = { query };
  if (subject) params.subject = subject;
  const { data } = await api.get("/api/resources/search", { params });
  return data;
}

export async function downloadResource(url: string, userId: number, subject: string, fileType: string) {
  const { data } = await api.post("/api/resources/download", { url, user_id: userId, subject, file_type: fileType });
  return data;
}

export async function generateFromUrl(url: string, subject: string, questionType: string, count: number) {
  const { data } = await api.post("/api/resources/generate-from-url", { url, subject, question_type: questionType, count });
  return data;
}

export async function fetchAdaptiveQuestions(userId: number, count: number = 5, subject?: string) {
  const { data } = await api.post("/api/quiz/adaptive", { user_id: userId, count, subject });
  return data;
}

export async function fetchWeakPoints(userId: number) {
  const { data } = await api.get(`/api/analysis/${userId}/weak-points`);
  return data;
}

export async function fetchMockExamHistory(userId: number, limit: number = 10) {
  const { data } = await api.get(`/api/quiz/mock-exam/history/${userId}`, { params: { limit } });
  return data;
}

export async function fetchWeeklyReport(userId: number) {
  const { data } = await api.get(`/api/analysis/${userId}/weekly-report`);
  return data;
}

export async function globalSearch(userId: number, query: string, type: string = "all", page: number = 1) {
  const { data } = await api.get(`/api/search/${userId}`, { params: { q: query, type, page } });
  return data;
}

export async function checkIn(userId: number) {
  const { data } = await api.post(`/api/streak/${userId}/checkin`);
  return data;
}

export async function fetchStreak(userId: number) {
  const { data } = await api.get(`/api/streak/${userId}`);
  return data;
}

export async function fetchLLMConfig(userId: number) {
  const { data } = await api.get(`/api/settings/${userId}/llm`);
  return data;
}

export async function updateLLMConfig(userId: number, config: { api_key?: string; base_url?: string; model?: string }) {
  const { data } = await api.put(`/api/settings/${userId}/llm`, config);
  return data;
}

export async function testLLMConfig(userId: number) {
  const { data } = await api.post(`/api/settings/${userId}/llm/test`);
  return data;
}

export async function resetLLMConfig(userId: number) {
  const { data } = await api.delete(`/api/settings/${userId}/llm`);
  return data;
}

export async function guidedTeaching(userId: number, message: string, topic: string, hintLevel: number = 0) {
  const { data } = await api.post("/api/chat/guided", { user_id: userId, message, topic, hint_level: hintLevel });
  return data;
}

export async function fetchReminders(userId: number) {
  const { data } = await api.get(`/api/reminders/${userId}`);
  return data;
}

export default api;
