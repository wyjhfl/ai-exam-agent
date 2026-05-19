import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, BookOpen, Brain, Sparkles, Loader2, Download, Share2, Timer, Zap, FileText, History } from "lucide-react";
import { fetchQuestions, submitAnswer, fetchWrongQuestions, markWrongMastered, fetchReviewQuestions, submitReviewAnswer, generateQuizQuestions, fetchMoreQuestions, getExportUrl, shareWrongToCommunity, startMockExam, submitMockExam, fetchAdaptiveQuestions, fetchWeakPoints, fetchMockExamHistory } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { renderLatex } from "@/lib/format";
import { toast } from "sonner";
import QuestionCard from "@/components/quiz/QuestionCard";
import type { Question, WrongQuestion } from "@/components/quiz/QuestionCard";
import MockExamTimer from "@/components/quiz/MockExamTimer";
import GeneratePanel from "@/components/quiz/GeneratePanel";

type Mode = "practice" | "wrong" | "review" | "mock" | "adaptive";
type MockState = "setup" | "taking" | "result" | null;

interface WeakPoint {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface ReviewResult {
  is_correct: boolean;
  next_interval: number;
  next_review_at: string;
}

function QuizPage() {
  const { userId } = useUserStore();
  const [mode, setMode] = useState<Mode>("practice");
  const [subject, setSubject] = useState("全部");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<WrongQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastReviewResult, setLastReviewResult] = useState<ReviewResult | null>(null);
  const [reviewStats, setReviewStats] = useState({ total: 0, correct: 0 });
  const [showGenerate, setShowGenerate] = useState(false);
  const [genSubject, setGenSubject] = useState("数学");
  const [genDifficulty, setGenDifficulty] = useState("medium");
  const [genCount, setGenCount] = useState(5);
  const [genType, setGenType] = useState("single_choice");
  const [generating, setGenerating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [mockExamState, setMockExamState] = useState<MockState>(null);
  const [mockExamId, setMockExamId] = useState<number | null>(null);
  const [mockQuestions, setMockQuestions] = useState<Question[]>([]);
  const [mockAnswers, setMockAnswers] = useState<Record<number, string>>({});
  const [mockCount, setMockCount] = useState(20);
  const [mockDuration, setMockDuration] = useState(60);
  const [mockTimer, setMockTimer] = useState(0);
  const [mockResult, setMockResult] = useState<any>(null);
  const [mockSubject, setMockSubject] = useState("数学");
  const [mockSubmitting, setMockSubmitting] = useState(false);

  const [fillBlankInput, setFillBlankInput] = useState("");
  const [shortAnswerInput, setShortAnswerInput] = useState("");
  const [multiSelectAnswers, setMultiSelectAnswers] = useState<string[]>([]);

  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [adaptiveResult, setAdaptiveResult] = useState<{ correct: number; total: number } | null>(null);
  const [mockExamHistory, setMockExamHistory] = useState<any[]>([]);

  const subjects = ["全部", "政治", "英语", "数学"];

  useEffect(() => {
    if (mode !== "mock") loadData();
    if (mode === "adaptive" && userId) loadWeakPoints();
  }, [mode, subject, userId]);

  const loadWeakPoints = async () => {
    if (!userId) return;
    try {
      const data = await fetchWeakPoints(userId);
      setWeakPoints(data);
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setCurrentIndex(0);
    setLastReviewResult(null);
    setReviewStats({ total: 0, correct: 0 });
    setAdaptiveResult(null);
    if (!userId) return;

    try {
      if (mode === "practice") {
        const data = await fetchQuestions(subject === "全部" ? undefined : subject);
        setQuestions(data);
      } else if (mode === "wrong") {
        const data = await fetchWrongQuestions(userId);
        setWrongQuestions(data);
      } else if (mode === "review") {
        const data = await fetchReviewQuestions(userId);
        setReviewQuestions(data);
      } else if (mode === "adaptive") {
        return;
      }
    } catch {
      toast.error("加载题目失败");
    }
  };

  const currentList = mode === "practice" || mode === "adaptive" ? questions : mode === "wrong" ? wrongQuestions : mode === "review" ? reviewQuestions : mockQuestions;
  const current = currentList[currentIndex];

  const resetAnswerState = useCallback(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setLastReviewResult(null);
    setFillBlankInput("");
    setShortAnswerInput("");
    setMultiSelectAnswers([]);
  }, []);

  const handleAnswer = useCallback(async (option: string) => {
    if (showResult || !current) return;
    setSelectedAnswer(option);
    setShowResult(true);

    try {
      if (mode === "review") {
        const wq = current as WrongQuestion;
        const isCorrect = option.trim().toUpperCase() === wq.answer.trim().toUpperCase();
        const result = await submitReviewAnswer(wq.wrong_id, isCorrect);
        setLastReviewResult(result);
        setReviewStats((prev) => ({
          total: prev.total + 1,
          correct: prev.correct + (isCorrect ? 1 : 0),
        }));
      } else if (mode === "practice" || mode === "adaptive") {
        await submitAnswer(userId!, (current as Question).id, option);
        if (mode === "adaptive") {
          const isCorrect = option.trim().toUpperCase() === current.answer.trim().toUpperCase();
          setAdaptiveResult((prev) => ({
            correct: (prev?.correct || 0) + (isCorrect ? 1 : 0),
            total: (prev?.total || 0) + 1,
          }));
        }
      }
    } catch {
      toast.error("提交失败");
    }
  }, [showResult, current, mode, userId]);

  const handleNonChoiceAnswer = useCallback(async (answer: string) => {
    if (showResult || !current) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    try {
      if (mode === "practice" || mode === "adaptive") {
        await submitAnswer(userId!, (current as Question).id, answer);
        if (mode === "adaptive") {
          const isCorrect = answer.trim().toUpperCase() === current.answer.trim().toUpperCase();
          setAdaptiveResult((prev) => ({
            correct: (prev?.correct || 0) + (isCorrect ? 1 : 0),
            total: (prev?.total || 0) + 1,
          }));
        }
      } else if (mode === "review") {
        const wq = current as WrongQuestion;
        const isCorrect = answer.trim().toUpperCase() === wq.answer.trim().toUpperCase();
        const result = await submitReviewAnswer(wq.wrong_id, isCorrect);
        setLastReviewResult(result);
        setReviewStats((prev) => ({
          total: prev.total + 1,
          correct: prev.correct + (isCorrect ? 1 : 0),
        }));
      }
    } catch {
      toast.error("提交失败");
    }
  }, [showResult, current, mode, userId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateQuizQuestions(genSubject, "", genDifficulty, genCount, genType);
      setQuestions((prev) => [...prev, ...data]);
      setCurrentIndex(questions.length);
      setShowGenerate(false);
      setMode("practice");
      toast.success(`成功生成 ${data.length} 道题目`);
    } catch {
      toast.error("AI 出题失败");
    }
    setGenerating(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchMoreQuestions(subject, 5);
      setQuestions((prev) => [...prev, ...data]);
      toast.success(`加载了 ${data.length} 道题目`);
    } catch {
      toast.error("加载更多失败");
    }
    setLoadingMore(false);
  };

  const handleNext = () => {
    resetAnswerState();
    if (currentIndex < currentList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetAnswerState();
    }
  };

  const handleMastered = async (wrongId: number) => {
    try {
      await markWrongMastered(wrongId);
      toast.success("已标记为掌握");
      loadData();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleExportWrong = () => {
    if (!userId) return;
    const url = getExportUrl(userId, "wrong-questions", "excel");
    window.open(url, "_blank");
  };

  const handleShareWrong = async (wrongId: number) => {
    try {
      await shareWrongToCommunity(wrongId);
      toast.success("已分享到社区");
    } catch {
      toast.error("分享失败");
    }
  };

  const isCorrectAnswer = useCallback((option: string) => {
    if (!current) return false;
    return option.trim().toUpperCase() === current.answer.trim().toUpperCase();
  }, [current]);

  const handleStartMock = async () => {
    if (!userId) return;
    setMockSubmitting(true);
    try {
      const data = await startMockExam(userId, mockSubject, mockCount, mockDuration);
      setMockExamId(data.exam_id);
      setMockQuestions(data.questions);
      setMockAnswers({});
      setMockTimer(data.duration_minutes * 60);
      setMockExamState("taking");
      setMockResult(null);
      setCurrentIndex(0);
      resetAnswerState();
    } catch {
      toast.error("启动模拟考试失败");
    }
    setMockSubmitting(false);
  };

  useEffect(() => {
    if (mockExamState !== "taking") return;
    const interval = setInterval(() => {
      setMockTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mockExamState]);

  const handleSubmitMock = async () => {
    if (!mockExamId) return;
    setMockSubmitting(true);
    try {
      const answers = Object.entries(mockAnswers).map(([qid, ans]) => ({
        question_id: Number(qid),
        selected_answer: ans,
      }));
      const elapsed = mockDuration * 60 - mockTimer;
      const data = await submitMockExam(mockExamId, answers, elapsed);
      setMockResult(data);
      setMockExamState("result");
    } catch {
      toast.error("提交考试失败");
    }
    setMockSubmitting(false);
  };

  const handleSubmitMockRef = useRef(handleSubmitMock);
  handleSubmitMockRef.current = handleSubmitMock;

  useEffect(() => {
    if (mockExamState === "taking" && mockTimer === 0 && mockExamId) {
      handleSubmitMockRef.current();
    }
  }, [mockTimer, mockExamState, mockExamId]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const modeButtons: { key: Mode; label: string; icon: typeof BookOpen }[] = [
    { key: "practice", label: "练习模式", icon: BookOpen },
    { key: "wrong", label: "错题本", icon: XCircle },
    { key: "review", label: "今日复习", icon: Brain },
    { key: "adaptive", label: "智能练习", icon: Zap },
    { key: "mock", label: "模拟考试", icon: Timer },
  ];

  const handleStartAdaptive = async () => {
    if (!userId) return;
    setAdaptiveLoading(true);
    setAdaptiveResult(null);
    try {
      const data = await fetchAdaptiveQuestions(userId, 5, subject === "全部" ? undefined : subject);
      setQuestions(data);
      setCurrentIndex(0);
      resetAnswerState();
      toast.success(`智能出题成功，共 ${data.length} 道题`);
    } catch {
      toast.error("智能出题失败");
    }
    setAdaptiveLoading(false);
  };

  const loadMockExamHistory = async () => {
    if (!userId) return;
    try {
      const data = await fetchMockExamHistory(userId);
      setMockExamHistory(data);
    } catch {
      // ignore
    }
  };

  if (mode === "mock" && mockExamState === "setup") {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">模拟考试</h2>
        </div>
        <div className="rounded-lg border border-border p-6 space-y-4 max-w-md">
          <div>
            <label className="text-sm text-muted-foreground">科目</label>
            <select value={mockSubject} onChange={(e) => setMockSubject(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="数学">数学</option>
              <option value="英语">英语</option>
              <option value="政治">政治</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">题量</label>
            <div className="flex gap-2 mt-1">
              {[10, 20, 30].map((n) => (
                <button key={n} onClick={() => setMockCount(n)} className={`rounded-md border px-4 py-2 text-sm ${mockCount === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {n}题
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">时长</label>
            <div className="flex gap-2 mt-1">
              {[30, 60, 90].map((m) => (
                <button key={m} onClick={() => setMockDuration(m)} className={`rounded-md border px-4 py-2 text-sm ${mockDuration === m ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {m}分钟
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleStartMock} disabled={mockSubmitting} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {mockSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
            {mockSubmitting ? "生成题目中..." : "开始考试"}
          </button>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">历史成绩</h3>
          </div>
          {mockExamHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无考试记录</p>
          ) : (
            <div className="space-y-2">
              {mockExamHistory.map((exam) => (
                <div key={exam.exam_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{exam.created_at ? new Date(exam.created_at).toLocaleDateString() : "-"}</span>
                    <span className="font-medium">{exam.subject}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{exam.correct_count}/{exam.question_count}</span>
                    <span className={`font-medium ${exam.accuracy >= 70 ? "text-green-600 dark:text-green-400" : exam.accuracy >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {exam.accuracy}%
                    </span>
                    <span className="text-muted-foreground">{Math.floor(exam.duration / 60)}分{exam.duration % 60}秒</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "mock" && mockExamState === "taking" && mockQuestions.length > 0) {
    const mockQ = mockQuestions[currentIndex];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MockExamTimer
          mockTimer={mockTimer}
          mockQuestions={mockQuestions}
          mockAnswers={mockAnswers}
          currentIndex={currentIndex}
          mockSubmitting={mockSubmitting}
          formatTimer={formatTimer}
          onSubmit={handleSubmitMock}
          onNavigate={(i) => { setCurrentIndex(i); resetAnswerState(); }}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <QuestionCard
            question={mockQ}
            isMockTaking
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            fillBlankInput={fillBlankInput}
            shortAnswerInput={shortAnswerInput}
            multiSelectAnswers={multiSelectAnswers}
            mockAnswers={mockAnswers}
            onAnswer={handleAnswer}
            onNonChoiceAnswer={handleNonChoiceAnswer}
            onSetMockAnswers={setMockAnswers}
            onSetFillBlankInput={setFillBlankInput}
            onSetShortAnswerInput={setShortAnswerInput}
            onSetMultiSelectAnswers={setMultiSelectAnswers}
            isCorrectAnswer={isCorrectAnswer}
            showMeta
            currentIndex={currentIndex}
            totalQuestions={mockQuestions.length}
          />
        </div>

        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-border">
          <button onClick={handlePrev} disabled={currentIndex === 0} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30">
            上一题
          </button>
          <button onClick={handleNext} disabled={currentIndex >= mockQuestions.length - 1} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30">
            下一题
          </button>
        </div>
      </div>
    );
  }

  if (mode === "mock" && mockExamState === "result" && mockResult) {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-4 overflow-y-auto">
        <h2 className="text-lg font-semibold">考试结果</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{mockResult.correct_count}/{mockResult.question_count}</p>
            <p className="text-xs text-muted-foreground mt-1">正确题数</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{mockResult.accuracy}%</p>
            <p className="text-xs text-muted-foreground mt-1">正确率</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{mockResult.total_score}/{mockResult.max_score}</p>
            <p className="text-xs text-muted-foreground mt-1">得分</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{formatTimer(mockResult.duration_seconds)}</p>
            <p className="text-xs text-muted-foreground mt-1">用时</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">答题回顾</h3>
          {mockResult.details?.map((d: any, i: number) => (
            <div key={i} className={`rounded-lg border p-3 text-sm ${d.is_correct ? "border-green-500/30" : "border-red-500/30"}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 ${d.is_correct ? "text-green-500" : "text-red-500"}`}>
                  {d.is_correct ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </span>
                <div className="flex-1 space-y-1">
                  <p className="font-medium" dangerouslySetInnerHTML={{ __html: renderLatex(d.question_text) }} />
                  <p className="text-muted-foreground">你的答案：{d.selected_answer || "未作答"}</p>
                  {!d.is_correct && <p className="text-green-600 dark:text-green-400">正确答案：{d.correct_answer}</p>}
                  {d.explanation && <p className="text-muted-foreground text-xs">{d.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setMockExamState("setup"); setMockResult(null); setMockQuestions([]); loadMockExamHistory(); }}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          再考一次
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2">
        {modeButtons.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              if (m.key === "mock") {
                setMode("mock");
                setMockExamState("setup");
                loadMockExamHistory();
              } else {
                setMode(m.key);
                setMockExamState(null);
              }
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === m.key ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"
            }`}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
            {m.key === "review" && reviewQuestions.length > 0 && (
              <span className="rounded-full bg-destructive text-destructive-foreground px-1.5 text-xs">
                {reviewQuestions.length}
              </span>
            )}
          </button>
        ))}
        {mode !== "mock" && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => { setSubject(s); if (mode !== "practice") setMode("practice"); }}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  subject === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setShowGenerate(!showGenerate)}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              AI 出题
            </button>
            {mode === "wrong" && userId && (
              <>
              <button
                onClick={handleExportWrong}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Download className="h-4 w-4" />
                导出错题
              </button>
              <button
                onClick={() => window.open(getExportUrl(userId!, "wrong-questions", "pdf"), "_blank")}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4" />
                导出PDF
              </button>
              </>
            )}
          </>
        )}
      </div>

      {showGenerate && (
        <GeneratePanel
          genSubject={genSubject}
          genDifficulty={genDifficulty}
          genCount={genCount}
          genType={genType}
          generating={generating}
          onSetGenSubject={setGenSubject}
          onSetGenDifficulty={setGenDifficulty}
          onSetGenCount={setGenCount}
          onSetGenType={setGenType}
          onGenerate={handleGenerate}
        />
      )}

      {mode === "adaptive" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-primary" />
              AI 根据你的薄弱知识点智能出题
            </div>
            {weakPoints.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {weakPoints.map((wp) => (
                  <button
                    key={wp.topic}
                    onClick={() => setSubject(wp.subject)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      wp.accuracy < 40
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : wp.accuracy < 70
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {wp.topic} ({wp.accuracy}%)
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无薄弱知识点数据，先去做几道题吧</p>
            )}
            <button
              onClick={handleStartAdaptive}
              disabled={adaptiveLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {adaptiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {adaptiveLoading ? "智能出题中..." : "开始智能练习"}
            </button>
          </div>
          {adaptiveResult && adaptiveResult.total > 0 && (
            <div className="rounded-lg border border-border p-3 flex items-center gap-4 text-sm">
              <span>本轮智能练习：{adaptiveResult.correct}/{adaptiveResult.total}</span>
              <span>正确率：{Math.round((adaptiveResult.correct / adaptiveResult.total) * 100)}%</span>
              {adaptiveResult.correct / adaptiveResult.total < 0.6 && (
                <span className="text-amber-600 dark:text-amber-400">建议继续加强薄弱知识点练习</span>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "review" && reviewStats.total > 0 && (
        <div className="rounded-lg border border-border p-3 flex items-center gap-4 text-sm">
          <span>本轮复习：{reviewStats.correct}/{reviewStats.total}</span>
          <span>正确率：{reviewStats.total > 0 ? Math.round((reviewStats.correct / reviewStats.total) * 100) : 0}%</span>
        </div>
      )}

      {!current ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            {mode === "review" ? "今日没有需要复习的题目 🎉" : "暂无题目，试试 AI 出题"}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <QuestionCard
            question={current}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            fillBlankInput={fillBlankInput}
            shortAnswerInput={shortAnswerInput}
            multiSelectAnswers={multiSelectAnswers}
            mockAnswers={mockAnswers}
            onAnswer={handleAnswer}
            onNonChoiceAnswer={handleNonChoiceAnswer}
            onSetMockAnswers={setMockAnswers}
            onSetFillBlankInput={setFillBlankInput}
            onSetShortAnswerInput={setShortAnswerInput}
            onSetMultiSelectAnswers={setMultiSelectAnswers}
            isCorrectAnswer={isCorrectAnswer}
            showMeta
            currentIndex={currentIndex}
            totalQuestions={currentList.length}
          />

          {showResult && (
            <div className="space-y-2 pt-2 mt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {selectedAnswer && isCorrectAnswer(selectedAnswer) ? (
                  <span className="text-green-600 dark:text-green-400 font-medium text-sm">✓ 回答正确</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-medium text-sm">✗ 回答错误，正确答案：{current.answer}</span>
                )}
              </div>
              {current.explanation && (
                <p className="text-sm text-muted-foreground leading-relaxed">{current.explanation}</p>
              )}
              {mode === "review" && lastReviewResult && (
                <p className="text-sm text-primary">
                  {lastReviewResult.is_correct
                    ? `下次复习：${lastReviewResult.next_interval}天后`
                    : "明天再复习"}
                </p>
              )}
              {mode === "wrong" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMastered((current as WrongQuestion).wrong_id)}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    标记已掌握
                  </button>
                  <button
                    onClick={() => handleShareWrong((current as WrongQuestion).wrong_id)}
                    className="rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20 flex items-center gap-1"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    分享到社区
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30"
            >
              上一题
            </button>
            {mode === "practice" && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50 flex items-center gap-1"
              >
                {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                加载更多题目
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={currentIndex >= currentList.length - 1}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30"
            >
              下一题
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPage;
