import { useEffect, useState } from "react";
import { CheckCircle, XCircle, BookOpen, Brain, Sparkles, Loader2, Download } from "lucide-react";
import { fetchQuestions, submitAnswer, fetchWrongQuestions, markWrongMastered, fetchReviewQuestions, submitReviewAnswer, generateQuizQuestions, fetchMoreQuestions, getExportUrl } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

type Mode = "practice" | "wrong" | "review";

interface Question {
  id: number;
  subject: string;
  question_text: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
}

interface WrongQuestion {
  wrong_id: number;
  question_id: number;
  subject: string;
  question_text: string;
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
  const [generating, setGenerating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const subjects = ["全部", "政治", "英语", "数学"];

  useEffect(() => {
    loadData();
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
      } else {
        const data = await fetchReviewQuestions(userId);
        setReviewQuestions(data);
      }
    } catch {
      toast.error("加载题目失败");
    }
  };

  const currentList = mode === "practice" ? questions : mode === "wrong" ? wrongQuestions : reviewQuestions;
  const current = currentList[currentIndex];

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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateQuizQuestions(genSubject, "", genDifficulty, genCount);
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
    setSelectedAnswer(null);
    setShowResult(false);
    setLastReviewResult(null);
    if (currentIndex < currentList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setLastReviewResult(null);
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

  const isCorrectAnswer = (option: string) => {
    if (!current) return false;
    return option.trim().toUpperCase() === current.answer.trim().toUpperCase();
  };

  const modeButtons: { key: Mode; label: string; icon: typeof BookOpen }[] = [
    { key: "practice", label: "练习模式", icon: BookOpen },
    { key: "wrong", label: "错题本", icon: XCircle },
    { key: "review", label: "今日复习", icon: Brain },
  ];

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2">
        {modeButtons.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
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
              {current.difficulty && <span>{current.difficulty}</span>}
              <span className="ml-auto">{currentIndex + 1} / {currentList.length}</span>
            </div>

            <p className="text-base md:text-lg font-medium leading-relaxed">{current.question_text}</p>

            <div className="space-y-2">
              {current.options?.map((option, i) => {
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
                    onClick={() => handleAnswer(letter)}
                    disabled={showResult}
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
                  <button
                    onClick={() => handleMastered((current as WrongQuestion).wrong_id)}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    标记已掌握
                  </button>
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
