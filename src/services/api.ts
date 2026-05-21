import axios from "axios";
import { toast } from "sonner";

function getStoredToken(): string | null {
  return localStorage.getItem("ai_exam_token");
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const detail = error.response?.data?.detail || error.response?.data?.error;

    if (status === 401) {
      localStorage.removeItem("ai_exam_token");
      localStorage.removeItem("ai_exam_user_id");
      localStorage.removeItem("ai_exam_username");
      if (!url?.includes("/api/user/login") && !url?.includes("/api/user/register")) {
        toast.error("登录已过期，请重新登录");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

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

export async function sendMessage(message: string, conversationId?: number | null) {
  const payload: Record<string, any> = { message };
  if (conversationId) payload.conversation_id = conversationId;
  const { data } = await api.post("/api/chat/message", payload);
  return data;
}

export async function fetchHistory(limit: number = 50, conversationId?: number) {
  const params: Record<string, any> = { limit };
  if (conversationId) params.conversation_id = conversationId;
  const { data } = await api.get("/api/chat/history", { params });
  return data;
}

export async function fetchStreamMessage(
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onSources?: (sources: Record<string, any>[]) => void,
  conversationId?: number | null,
  onConversationId?: (id: number) => void
) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const token = getStoredToken();
  const payload: Record<string, any> = { message };
  if (conversationId) payload.conversation_id = conversationId;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${baseURL}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
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
          } else if (parsed.type === "conversation_id" && onConversationId) {
            onConversationId(parsed.conversation_id);
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

export async function submitAnswer(questionId: number, selectedAnswer: string) {
  const { data } = await api.post("/api/quiz/answer", {
    question_id: questionId,
    selected_answer: selectedAnswer,
  });
  return data;
}

export async function fetchWrongQuestions() {
  const { data } = await api.get("/api/quiz/wrong");
  return data;
}

export async function markWrongMastered(id: number) {
  const { data } = await api.post(`/api/quiz/wrong/${id}/master`);
  return data;
}

export async function fetchReviewQuestions() {
  const { data } = await api.get("/api/quiz/review");
  return data;
}

export async function submitReviewAnswer(wrongId: number, isCorrect: boolean) {
  const { data } = await api.post(`/api/quiz/review/${wrongId}/answer`, { is_correct: isCorrect });
  return data;
}

export async function generatePlan(targetSchool: string, targetMajor: string, examDate: string, subjects: Record<string, number>) {
  const { data } = await api.post("/api/plan/generate", {
    target_school: targetSchool,
    target_major: targetMajor,
    exam_date: examDate,
    subjects,
  });
  return data;
}

export async function fetchPlan() {
  const { data } = await api.get("/api/plan");
  return data;
}

export async function updatePlan(planId: number, planData: Record<string, any>) {
  const { data } = await api.put(`/api/plan/${planId}`, { plan_data: planData });
  return data;
}

export async function fetchAnalysisOverview() {
  const { data } = await api.get("/api/analysis/overview");
  return data;
}

export async function fetchSubjectStats() {
  const { data } = await api.get("/api/analysis/subject-stats");
  return data;
}

export async function fetchTrend(days: number = 7) {
  const { data } = await api.get("/api/analysis/trend", { params: { days } });
  return data;
}

export async function evaluateWriting(text: string, essayType: string) {
  const { data } = await api.post("/api/writing/evaluate", { text, essay_type: essayType });
  return data;
}

export async function fetchWritingHistory() {
  const { data } = await api.get("/api/writing/history");
  return data;
}

export async function startFocus(subject: string, duration: number) {
  const { data } = await api.post("/api/focus/start", { subject, duration });
  return data;
}

export async function completeFocus(sessionId: number, actualDuration: number) {
  const { data } = await api.post("/api/focus/complete", { session_id: sessionId, actual_duration: actualDuration });
  return data;
}

export async function fetchTodayFocus() {
  const { data } = await api.get("/api/focus/today");
  return data;
}

export function getExportUrl(type: "wrong-questions" | "study-summary", format: "json" | "excel" | "pdf" = "excel") {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const token = getStoredToken();
  const separator = type.includes("?") ? "&" : "?";
  const authParam = token ? `${separator}token=${token}` : "";
  if (format === "pdf") {
    return `${baseURL}/api/export/${type}/pdf${authParam}`;
  }
  if (format === "excel") {
    return `${baseURL}/api/export/${type}/excel${authParam}`;
  }
  return `${baseURL}/api/export/${type}${authParam}`;
}

export const APP_VERSION = "0.7.0";

export async function uploadFile(subject: string, fileType: string, file: File, onProgress?: (pct: number) => void) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("subject", subject);
  formData.append("file_type", fileType);
  formData.append("file", file);

  return new Promise<{ file_id: string; filename: string; subject: string; file_type: string; pages: number; chunks: number; size: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseURL}/api/uploads/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
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

export async function fetchUploads() {
  const { data } = await api.get("/api/uploads");
  return data;
}

export async function deleteUpload(fileId: string) {
  const { data } = await api.delete(`/api/uploads/${fileId}`);
  return data;
}

export async function reindexUpload(fileId: string) {
  const { data } = await api.post(`/api/uploads/${fileId}/reindex`);
  return data;
}

export async function generateStudyPlanFromMaterials(subject: string) {
  const { data } = await api.post("/api/guidance/study-plan", { subject });
  return data;
}

export async function explainTopic(topic: string) {
  const { data } = await api.post("/api/guidance/explain", { topic });
  return data;
}

export async function solveQuestion(questionText: string) {
  const { data } = await api.post("/api/guidance/solve", { question_text: questionText });
  return data;
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<{ hasUpdate: boolean; currentVersion: string; latestVersion: string; message: string; downloadUrl: string; releaseNotes: string }> {
  try {
    const res = await fetch("https://api.github.com/repos/wyjhfl/ai-exam-agent/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION, message: `当前版本 v${APP_VERSION}`, downloadUrl: "", releaseNotes: "" };
    const release = await res.json();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;
    const downloadUrl = release.html_url || "";
    const releaseNotes = (release.body || "").slice(0, 200);
    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion,
      message: hasUpdate
        ? `发现新版本 v${latestVersion}，当前版本 v${APP_VERSION}`
        : `当前已是最新版本 v${APP_VERSION}`,
      downloadUrl: hasUpdate ? downloadUrl : "",
      releaseNotes: hasUpdate ? releaseNotes : "",
    };
  } catch {
    return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION, message: `当前版本 v${APP_VERSION}（检查更新失败）`, downloadUrl: "", releaseNotes: "" };
  }
}

export async function syncUpload(dataType: string, data: Record<string, any>[]) {
  const { data: result } = await api.post("/api/sync/upload", { data_type: dataType, data });
  return result;
}

export async function syncDownload(dataType: string = "all") {
  const { data } = await api.post("/api/sync/download", { data_type: dataType });
  return data;
}

export async function syncFull(localData: Record<string, any[]>) {
  const { data } = await api.post("/api/sync/full", { local_data: localData });
  return data;
}

export async function fetchSyncStatus() {
  const { data } = await api.get("/api/sync/status");
  return data;
}

export async function communityShare(title: string, content: string, itemType: string, subject: string) {
  const { data } = await api.post("/api/community/share", { title, content, item_type: itemType, subject });
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

export async function commentCommunityPost(postId: number, content: string) {
  const { data } = await api.post(`/api/community/posts/${postId}/comment`, { content });
  return data;
}

export async function shareWrongToCommunity(wrongId: number) {
  const { data } = await api.post(`/api/community/share-wrong/${wrongId}`);
  return data;
}

export async function startMockExam(subject: string, count: number, duration: number) {
  const { data } = await api.post("/api/quiz/mock-exam", { subject, question_count: count, duration_minutes: duration });
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

export async function getUserMastery() {
  const { data } = await api.get("/api/knowledge-points/mastery");
  return data;
}

export async function searchResources(query: string, subject?: string) {
  const params: Record<string, string> = { query };
  if (subject) params.subject = subject;
  const { data } = await api.get("/api/resources/search", { params });
  return data;
}

export async function downloadResource(url: string, subject: string, fileType: string) {
  const { data } = await api.post("/api/resources/download", { url, subject, file_type: fileType });
  return data;
}

export async function generateFromUrl(url: string, subject: string, questionType: string, count: number) {
  const { data } = await api.post("/api/resources/generate-from-url", { url, subject, question_type: questionType, count });
  return data;
}

export async function fetchAdaptiveQuestions(count: number = 5, subject?: string) {
  const { data } = await api.post("/api/quiz/adaptive", { count, subject });
  return data;
}

export async function fetchWeakPoints() {
  const { data } = await api.get("/api/analysis/weak-points");
  return data;
}

export async function fetchMockExamHistory(limit: number = 10) {
  const { data } = await api.get("/api/quiz/mock-exam/history", { params: { limit } });
  return data;
}

export async function fetchWeeklyReport() {
  const { data } = await api.get("/api/analysis/weekly-report");
  return data;
}

export async function globalSearch(query: string, type: string = "all", page: number = 1) {
  const { data } = await api.get("/api/search", { params: { q: query, type, page } });
  return data;
}

export async function checkIn() {
  const { data } = await api.post("/api/streak/checkin");
  return data;
}

export async function fetchStreak() {
  const { data } = await api.get("/api/streak");
  return data;
}

export async function fetchLLMConfig() {
  const { data } = await api.get("/api/settings/llm");
  return data;
}

export async function updateLLMConfig(config: { api_key?: string; base_url?: string; model?: string }) {
  const { data } = await api.put("/api/settings/llm", config);
  return data;
}

export async function testLLMConfig() {
  const { data } = await api.post("/api/settings/llm/test");
  return data;
}

export async function resetLLMConfig() {
  const { data } = await api.delete("/api/settings/llm");
  return data;
}

export async function guidedTeaching(message: string, topic: string, hintLevel: number = 0, conversationId?: number | null) {
  const payload: Record<string, any> = { message, topic, hint_level: hintLevel };
  if (conversationId) payload.conversation_id = conversationId;
  const { data } = await api.post("/api/chat/guided", payload);
  return data;
}

export async function fetchConversations() {
  const { data } = await api.get("/api/conversations");
  return data;
}

export async function createConversation(title?: string, mode?: string) {
  const payload: Record<string, any> = {};
  if (title) payload.title = title;
  if (mode) payload.chat_mode = mode;
  const { data } = await api.post("/api/conversations", payload);
  return data;
}

export async function fetchConversationDetail(conversationId: number) {
  const { data } = await api.get(`/api/conversations/detail/${conversationId}`);
  return data;
}

export async function renameConversation(conversationId: number, title: string) {
  const { data } = await api.put(`/api/conversations/${conversationId}`, { title });
  return data;
}

export async function deleteConversation(conversationId: number) {
  const { data } = await api.delete(`/api/conversations/${conversationId}`);
  return data;
}

export async function fetchReminders() {
  const { data } = await api.get("/api/reminders");
  return data;
}

export async function fetchExamPapers(subject?: string, year?: number) {
  const params: Record<string, string> = {};
  if (subject && subject !== "全部") params.subject = subject;
  if (year) params.year = String(year);
  const { data } = await api.get("/api/exam-papers", { params });
  return data;
}

export async function fetchExamPaperDetail(paperId: number) {
  const { data } = await api.get(`/api/exam-papers/${paperId}`);
  return data;
}

export async function startExam(paperId: number) {
  const { data } = await api.post(`/api/exam-papers/${paperId}/start`);
  return data;
}

export async function submitExam(paperId: number, answers: { question_id: number; selected_answer: string }[], durationSeconds: number) {
  const { data } = await api.post(`/api/exam-papers/${paperId}/submit`, { answers, duration_seconds: durationSeconds });
  return data;
}

export default api;
