import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, BookOpen, Brain, Sparkles, Loader2, Download, Share2, Timer, Clock } from "lucide-react";
import { fetchQuestions, submitAnswer, fetchWrongQuestions, markWrongMastered, fetchReviewQuestions, submitReviewAnswer, generateQuizQuestions, fetchMoreQuestions, getExportUrl, shareWrongToCommunity, startMockExam, submitMockExam } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { renderLatex } from "@/lib/format";
import { toast } from "sonner";

type Mode = "practice" | "wrong" | "review" | "mock";
type MockState = "setup" | "taking" | "result" | null;

interface Question {
  id: number;
  subject: string;
  question_text: string;
  question_type?: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
}

interface WrongQuestion {
  wrong_id: number;
  question_id: number;
  id: number;
  subject: string;
  question_text: string;
  question_type?: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
  mastered: boolean;
  next_review_at?: string;
  interval?: number;
}

interface ReviewResult {
  is_correct: boolean;
  next_interval: number;
  next_review_at: string;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  fill_blank: "填空题",
  short_answer: "简答题",
};

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

  const subjects = ["全部", "政治", "英语", "数学"];

  useEffect(() => {
    if (mode !== "mock") loadData();
  }, [mode, subject, userId]);

  const loadData = async () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setCurrentIndex(0);
    setLastReviewResult(null);
    setReviewStats({ total: 0, correct: 0 });
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
      }
    } catch {
      toast.error("加载题目失败");
    }
  };

  const currentList = mode === "practice" ? questions : mode === "wrong" ? wrongQuestions : mode === "review" ? reviewQuestions : mockQuestions;
  const current = currentList[currentIndex];

  const resetAnswerState = useCallback(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setLastReviewResult(null);
    setFillBlankInput("");
    setShortAnswerInput("");
    setMultiSelectAnswers([]);
  }, []);

  const handleAnswer = async (option: string) => {
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
      } else if (mode === "practice") {
        await submitAnswer(userId!, (current as Question).id, option);
      }
    } catch {
      toast.error("提交失败");
    }
  };

  const handleNonChoiceAnswer = async (answer: string) => {
    if (showResult || !current) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    try {
      if (mode === "practice") {
        await submitAnswer(userId!, (current as Question).id, answer);
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
  };

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

  const isCorrectAnswer = (option: string) => {
    if (!current) return false;
    return option.trim().toUpperCase() === current.answer.trim().toUpperCase();
  };

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
    if (mockExamState !== "taking" || mockTimer <= 0) return;
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
  }, [mockExamState, mockTimer > 0]);

  useEffect(() => {
    if (mockExamState === "taking" && mockTimer === 0 && mockExamId) {
      handleSubmitMock();
    }
  }, [mockTimer]);

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

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const modeButtons: { key: Mode; label: string; icon: typeof BookOpen }[] = [
    { key: "practice", label: "练习模式", icon: BookOpen },
    { key: "wrong", label: "错题本", icon: XCircle },
    { key: "review", label: "今日复习", icon: Brain },
    { key: "mock", label: "模拟考试", icon: Timer },
  ];

  const renderQuestionContent = (q: Question | WrongQuestion, isMockTaking: boolean = false) => {
    const qt = q.question_type || "single_choice";

    if (qt === "single_choice") {
      return (
        <div className="space-y-2">
          {q.options?.map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === letter;
            const isCorrect = isCorrectAnswer(letter);
            let btnClass = "border-border hover:bg-accent";
            if (showResult && isSelected && isCorrect) btnClass = "border-green-500 bg-green-500/10";
            else if (showResult && isSelected && !isCorrect) btnClass = "border-red-500 bg-red-500/10";
            else if (showResult && isCorrect) btnClass = "border-green-500 bg-green-500/10";

            return (
              <button
                key={i}
                onClick={() => { if (isMockTaking) { setMockAnswers((prev) => ({ ...prev, [q.id]: letter })); } else { handleAnswer(letter); } }}
                disabled={showResult && !isMockTaking}
                className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${btnClass} disabled:cursor-default`}
              >
                <span className="font-medium mr-2">{letter}.</span>
                {option}
                {showResult && isSelected && isCorrect && <CheckCircle className="inline h-4 w-4 ml-2 text-green-500" />}
                {showResult && isSelected && !isCorrect && <XCircle className="inline h-4 w-4 ml-2 text-red-500" />}
              </button>
            );
          })}
        </div>
      );
    }

    if (qt === "multiple_choice") {
      return (
        <div className="space-y-2">
          {q.options?.map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isChecked = isMockTaking
              ? (mockAnswers[q.id] || "").split(",").includes(letter)
              : multiSelectAnswers.includes(letter);
            const isCorrectOption = q.answer.split(",").map((a: string) => a.trim().toUpperCase()).includes(letter);

            let itemClass = "border-border hover:bg-accent";
            if (showResult && isChecked && isCorrectOption) itemClass = "border-green-500 bg-green-500/10";
            else if (showResult && isChecked && !isCorrectOption) itemClass = "border-red-500 bg-red-500/10";
            else if (showResult && isCorrectOption) itemClass = "border-green-500 bg-green-500/10";

            return (
              <button
                key={i}
                onClick={() => {
                  if (isMockTaking) {
                    const current = (mockAnswers[q.id] || "").split(",").filter(Boolean);
                    const next = current.includes(letter) ? current.filter((l: string) => l !== letter) : [...current, letter];
                    setMockAnswers((prev) => ({ ...prev, [q.id]: next.sort().join(",") }));
                  } else {
                    setMultiSelectAnswers((prev) =>
                      prev.includes(letter) ? prev.filter((l) => l !== letter) : [...prev, letter].sort()
                    );
                  }
                }}
                disabled={showResult && !isMockTaking}
                className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${itemClass} flex items-center gap-2`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${isChecked ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {isChecked ? "✓" : ""}
                </span>
                <span className="font-medium mr-2">{letter}.</span>
                {option}
              </button>
            );
          })}
          {!isMockTaking && !showResult && multiSelectAnswers.length > 0 && (
            <button
              onClick={() => handleNonChoiceAnswer(multiSelectAnswers.join(","))}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              提交多选答案
            </button>
          )}
        </div>
      );
    }

    if (qt === "true_false") {
      return (
        <div className="flex gap-4">
          {[
            { label: "正确 (T)", value: "T" },
            { label: "错误 (F)", value: "F" },
          ].map((opt) => {
            const isSelected = isMockTaking ? mockAnswers[q.id] === opt.value : selectedAnswer === opt.value;
            const isCorrect = q.answer.trim().toUpperCase() === opt.value;
            let btnClass = "border-border hover:bg-accent flex-1";
            if (showResult && isSelected && isCorrect) btnClass = "border-green-500 bg-green-500/10 flex-1";
            else if (showResult && isSelected && !isCorrect) btnClass = "border-red-500 bg-red-500/10 flex-1";
            else if (showResult && isCorrect) btnClass = "border-green-500 bg-green-500/10 flex-1";

            return (
              <button
                key={opt.value}
                onClick={() => { if (isMockTaking) { setMockAnswers((prev) => ({ ...prev, [q.id]: opt.value })); } else { handleAnswer(opt.value); } }}
                disabled={showResult && !isMockTaking}
                className={`rounded-md border px-6 py-4 text-base font-medium transition-colors ${btnClass}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (qt === "fill_blank") {
      return (
        <div className="space-y-3">
          {isMockTaking ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={mockAnswers[q.id] || ""}
                onChange={(e) => setMockAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="请输入答案"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={fillBlankInput}
                onChange={(e) => setFillBlankInput(e.target.value)}
                placeholder="请输入答案"
                disabled={showResult}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {!showResult && (
                <button
                  onClick={() => handleNonChoiceAnswer(fillBlankInput)}
                  disabled={!fillBlankInput.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  提交
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (qt === "short_answer") {
      return (
        <div className="space-y-3">
          {isMockTaking ? (
            <textarea
              value={mockAnswers[q.id] || ""}
              onChange={(e) => setMockAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="请输入答案"
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          ) : (
            <>
              <textarea
                value={shortAnswerInput}
                onChange={(e) => setShortAnswerInput(e.target.value)}
                placeholder="请输入答案"
                disabled={showResult}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
              {!showResult && (
                <button
                  onClick={() => handleNonChoiceAnswer(shortAnswerInput)}
                  disabled={!shortAnswerInput.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  提交答案
                </button>
              )}
            </>
          )}
        </div>
      );
    }

    return null;
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
      </div>
    );
  }

  if (mode === "mock" && mockExamState === "taking" && mockQuestions.length > 0) {
    const mockQ = mockQuestions[currentIndex];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Clock className={`h-5 w-5 ${mockTimer < 300 ? "text-red-500 animate-pulse" : "text-primary"}`} />
            <span className={`text-lg font-mono font-bold ${mockTimer < 300 ? "text-red-500" : ""}`}>
              {formatTimer(mockTimer)}
            </span>
          </div>
          <div className="flex gap-1 flex-wrap max-w-[60%]">
            {mockQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); resetAnswerState(); }}
                className={`w-7 h-7 rounded text-xs font-medium ${
                  i === currentIndex ? "bg-primary text-primary-foreground" :
                  mockAnswers[mockQuestions[i].id] ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                  "bg-accent text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => { if (confirm("确定交卷吗？")) handleSubmitMock(); }}
            disabled={mockSubmitting}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            交卷
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="rounded-lg border border-border p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5">{mockQ.subject}</span>
              {mockQ.question_type && <span className="rounded-full bg-accent px-2 py-0.5">{QUESTION_TYPE_LABELS[mockQ.question_type] || mockQ.question_type}</span>}
              <span className="ml-auto">{currentIndex + 1} / {mockQuestions.length}</span>
            </div>
            <p className="text-base md:text-lg font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderLatex(mockQ.question_text) }} />
            {renderQuestionContent(mockQ, true)}
          </div>
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
          onClick={() => { setMockExamState("setup"); setMockResult(null); setMockQuestions([]); }}
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
              <button
                onClick={handleExportWrong}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Download className="h-4 w-4" />
                导出错题
              </button>
            )}
          </>
        )}
      </div>

      {showGenerate && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-medium">AI 智能出题</h3>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-xs text-muted-foreground">科目</label>
              <select value={genSubject} onChange={(e) => setGenSubject(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
                <option value="数学">数学</option>
                <option value="英语">英语</option>
                <option value="政治">政治</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">难度</label>
              <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">题型</label>
              <select value={genType} onChange={(e) => setGenType(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
                <option value="single_choice">单选题</option>
                <option value="multiple_choice">多选题</option>
                <option value="true_false">判断题</option>
                <option value="fill_blank">填空题</option>
                <option value="short_answer">简答题</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">数量</label>
              <input type="number" min={1} max={10} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="ml-2 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" />
            </div>
            <button onClick={handleGenerate} disabled={generating} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generating ? "生成中..." : "生成"}
            </button>
          </div>
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
          <div className="rounded-lg border border-border p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5">{current.subject}</span>
              {current.question_type && current.question_type !== "single_choice" && (
                <span className="rounded-full bg-accent px-2 py-0.5">{QUESTION_TYPE_LABELS[current.question_type] || current.question_type}</span>
              )}
              {current.difficulty && <span>{current.difficulty}</span>}
              <span className="ml-auto">{currentIndex + 1} / {currentList.length}</span>
            </div>

            <p className="text-base md:text-lg font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderLatex(current.question_text) }} />

            {renderQuestionContent(current)}

            {showResult && (
              <div className="space-y-2 pt-2 border-t border-border">
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
          </div>

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
