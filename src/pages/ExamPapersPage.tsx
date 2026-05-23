import { useEffect, useState, useRef, useCallback } from "react";
import {
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  ListChecks,
  Trophy,
} from "lucide-react";
import { fetchExamPapers, startExamPaper, submitExamPaper } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";
import ExamQuestionView from "@/components/exam/ExamQuestionView";
import ExamAnswerCard from "@/components/exam/ExamAnswerCard";
import ExamResultView from "@/components/exam/ExamResultView";
import EmptyState from "@/components/EmptyState";
import type { ExamQuestion } from "@/components/exam/ExamQuestionView";
import type { ExamResult } from "@/components/exam/ExamResultView";

interface ExamPaperSummary {
  id: number;
  title: string;
  subject: string;
  year: number;
  exam_type: string;
  question_count: number;
  total_score: number;
  duration_minutes: number;
}

interface ExamSession {
  paper: ExamPaperSummary;
  questions: ExamQuestion[];
  duration_minutes: number;
}

const SUBJECTS = ["全部", "数学", "英语", "政治"];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const SUBJECT_COLORS: Record<string, string> = {
  数学: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  英语: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  政治: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
};

const SUBJECT_BTN_COLORS: Record<string, string> = {
  数学: "bg-blue-600 hover:bg-blue-700 text-white",
  英语: "bg-green-600 hover:bg-green-700 text-white",
  政治: "bg-orange-600 hover:bg-orange-700 text-white",
};

type PageState = "idle" | "preview" | "exam" | "result";

function ExamPapersPage() {
  const { userId } = useUserStore();

  const [papers, setPapers] = useState<ExamPaperSummary[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [loadingPapers, setLoadingPapers] = useState(false);

  const [pageState, setPageState] = useState<PageState>("idle");
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    if (userId) loadPapers();
  }, [selectedSubject, selectedYear, userId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadPapers = async () => {
    setLoadingPapers(true);
    try {
      const data = await fetchExamPapers(
        selectedSubject !== "全部" ? selectedSubject : undefined,
        selectedYear
      );
      setPapers(Array.isArray(data) ? data : data.items || []);
    } catch {
      toast.error("加载试卷列表失败");
    }
    setLoadingPapers(false);
  };

  const handleSelectPaper = async (paper: ExamPaperSummary) => {
    if (pageState === "exam") {
      if (!window.confirm("当前正在做题，确定要切换试卷吗？")) return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPageState("preview");
    setSession({ paper, questions: [], duration_minutes: paper.duration_minutes });
    setAnswers({});
    setCurrentIdx(0);
    setResult(null);
    setTimeLeft(paper.duration_minutes * 60);
  };

  const handleStartExam = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await startExamPaper(session.paper.id);
      const qs: ExamQuestion[] = (data.questions || []).map((q: any) => ({
        ...q,
        options: q.options || [],
      }));
      setSession({ ...session, questions: qs });
      setAnswers({});
      setCurrentIdx(0);
      setResult(null);
      setPageState("exam");
      setTimeLeft(session.paper.duration_minutes * 60);
      startTimeRef.current = Date.now();
      autoSubmitRef.current = false;
    } catch {
      toast.error("开始考试失败");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (pageState !== "exam") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pageState]);

  useEffect(() => {
    if (pageState === "exam" && timeLeft === 0 && !autoSubmitRef.current && session) {
      autoSubmitRef.current = true;
      toast.error("时间到，已自动提交！");
      doSubmit();
    }
  }, [timeLeft, pageState, session]);

  const doSubmit = useCallback(async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const answerList = Object.entries(answers).map(([qid, ans]) => ({
        question_id: Number(qid),
        selected_answer: ans,
      }));
      const data = await submitExamPaper(session.paper.id, answerList, elapsed);
      setResult({ ...data, duration_seconds: elapsed });
      setPageState("result");
      if (timerRef.current) clearInterval(timerRef.current);
    } catch {
      toast.error("提交考试失败");
    }
    setSubmitting(false);
  }, [session, answers, submitting]);

  const handleSubmit = () => {
    if (!session) return;
    const unanswered = session.questions.length - Object.keys(answers).length;
    if (unanswered > 0) {
      if (!window.confirm(`还有 ${unanswered} 道题未作答，确认提交吗？`)) return;
    }
    doSubmit();
  };

  const handleAnswer = (questionId: number, value: string) => {
    if (pageState !== "exam") return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleToggleMulti = (questionId: number, letter: string) => {
    if (pageState !== "exam") return;
    setAnswers((prev) => {
      const current = prev[questionId] || "";
      const isSelected = current.includes(letter);
      const newAns = isSelected ? current.replace(letter, "") : current + letter;
      return { ...prev, [questionId]: newAns.split("").sort().join("") };
    });
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPageState("idle");
    setSession(null);
    setAnswers({});
    setCurrentIdx(0);
    setResult(null);
    setTimeLeft(0);
  };

  const handleRetry = () => {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setAnswers({});
    setCurrentIdx(0);
    setResult(null);
    setPageState("preview");
    setTimeLeft(session.paper.duration_minutes * 60);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const questions = session?.questions || [];
  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-3 space-y-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">历年真题</h2>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">科目</p>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSubject(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedSubject === s
                      ? s === "全部"
                        ? "bg-primary text-primary-foreground"
                        : SUBJECT_BTN_COLORS[s] || "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">年份</p>
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">全部年份</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingPapers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : papers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">暂无真题数据</p>
          ) : (
            papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => handleSelectPaper(paper)}
                className={`w-full text-left rounded-lg border p-3 space-y-2 transition-colors ${
                  session?.paper.id === paper.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <p className="text-sm font-medium leading-tight line-clamp-2">{paper.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${SUBJECT_COLORS[paper.subject] || "bg-accent text-muted-foreground"}`}>
                    {paper.subject}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{paper.year}年</span>
                  {paper.exam_type && <span className="text-[10px] text-muted-foreground">{paper.exam_type}</span>}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{paper.question_count}题</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{paper.total_score}分</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{paper.duration_minutes}分钟</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectPaper(paper); }}
                  className="w-full rounded-md bg-primary/10 text-primary text-xs font-medium py-1.5 hover:bg-primary/20 transition-colors"
                >
                  开始练习
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {pageState === "idle" && (
          <EmptyState
            icon={FileText}
            title="请选择一套真题开始练习"
            description="真题练习会记录你的答题结果并生成成绩报告"
          />
        )}

        {pageState === "preview" && session && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full space-y-6 p-6">
              <div className="rounded-lg border border-border p-5 space-y-4">
                <h3 className="text-lg font-semibold">{session.paper.title}</h3>
                <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${SUBJECT_COLORS[session.paper.subject] || ""}`}>
                    {session.paper.subject}
                  </span>
                  <span>{session.paper.year}年</span>
                  {session.paper.exam_type && <span>{session.paper.exam_type}</span>}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-accent p-3">
                    <p className="text-lg font-semibold">{session.paper.question_count}</p>
                    <p className="text-xs text-muted-foreground">题目数</p>
                  </div>
                  <div className="rounded-md bg-accent p-3">
                    <p className="text-lg font-semibold">{session.paper.total_score}</p>
                    <p className="text-xs text-muted-foreground">总分</p>
                  </div>
                  <div className="rounded-md bg-accent p-3">
                    <p className="text-lg font-semibold">{session.paper.duration_minutes}</p>
                    <p className="text-xs text-muted-foreground">分钟</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleStartExam}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? "加载中..." : "开始做题"}
              </button>
              <button onClick={handleReset} className="w-full rounded-lg border border-border px-6 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
                返回列表
              </button>
            </div>
          </div>
        )}

        {pageState === "exam" && session && (
          <>
            <div className="border-b border-border px-4 md:px-6 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold truncate">{session.paper.title}</h2>
                <span className={`flex items-center gap-1.5 text-sm font-mono font-medium flex-shrink-0 ${timeLeft < 300 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  <Clock className="h-4 w-4" />
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">已答 {answeredCount}/{totalQuestions}</span>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {currentQ ? (
                  <ExamQuestionView
                    question={currentQ}
                    index={currentIdx}
                    answer={answers[currentQ.id] || ""}
                    onAnswer={handleAnswer}
                    onToggleMulti={handleToggleMulti}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">暂无题目</p>
                  </div>
                )}
              </div>

              {questions.length > 0 && (
                <ExamAnswerCard
                  questions={questions}
                  currentIdx={currentIdx}
                  answers={answers}
                  onJump={setCurrentIdx}
                />
              )}
            </div>

            {questions.length > 0 && (
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-border">
                <button
                  onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />上一题
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "提交中..." : "交卷"}
                </button>
                <button
                  onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                  disabled={currentIdx >= questions.length - 1}
                  className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  下一题<ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}

        {pageState === "result" && result && (
          <ExamResultView result={result} onRetry={handleRetry} onBack={handleReset} />
        )}
      </div>
    </div>
  );
}

export default ExamPapersPage;
