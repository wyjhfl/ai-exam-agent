import { useEffect, useState, useRef, useCallback } from "react";
import {
  FileText,
  Clock,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import { fetchExamPapers, fetchExamPaperDetail, startExam, submitExam } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { renderLatex } from "@/lib/format";
import { toast } from "sonner";

interface ExamPaper {
  id: number;
  title: string;
  subject: string;
  year: number;
  question_count: number;
  duration_minutes: number;
}

interface ExamQuestion {
  id: number;
  section_name: string;
  question_text: string;
  question_type: string;
  options: string[];
  answer: string;
  explanation: string;
  score: number;
}

interface ExamResult {
  total_score: number;
  max_score: number;
  accuracy: number;
  duration_seconds: number;
  details: {
    question_id: number;
    question_text: string;
    selected_answer: string;
    correct_answer: string;
    is_correct: boolean;
    score: number;
    max_score: number;
    explanation: string;
  }[];
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

function ExamPapersPage() {
  const { userId } = useUserStore();

  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [loadingPapers, setLoadingPapers] = useState(false);

  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadPapers();
  }, [selectedSubject, selectedYear, userId]);

  const loadPapers = async () => {
    if (!userId) return;
    setLoadingPapers(true);
    try {
      const data = await fetchExamPapers(
        selectedSubject !== "全部" ? selectedSubject : undefined,
        selectedYear
      );
      setPapers(data);
    } catch {
      toast.error("加载试卷列表失败");
    }
    setLoadingPapers(false);
  };

  const handleSelectPaper = async (paper: ExamPaper) => {
    if (examStarted && !examSubmitted) {
      if (!window.confirm("当前正在做题，确定要切换试卷吗？")) return;
    }
    setLoadingDetail(true);
    try {
      const data = await fetchExamPaperDetail(paper.id);
      setSelectedPaper(paper);
      setQuestions(data.questions || []);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setExamStarted(false);
      setExamSubmitted(false);
      setResult(null);
      setTimeLeft(paper.duration_minutes * 60);
    } catch {
      toast.error("加载试卷详情失败");
    }
    setLoadingDetail(false);
  };

  const handleStartExam = async () => {
    if (!selectedPaper) return;
    setLoadingDetail(true);
    try {
      await startExam(selectedPaper.id);
      setExamStarted(true);
      setExamSubmitted(false);
      setResult(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setTimeLeft(selectedPaper.duration_minutes * 60);
      startTimeRef.current = Date.now();
    } catch {
      toast.error("开始考试失败");
    }
    setLoadingDetail(false);
  };

  useEffect(() => {
    if (!examStarted || examSubmitted) {
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
  }, [examStarted, examSubmitted]);

  useEffect(() => {
    if (examStarted && !examSubmitted && timeLeft === 0 && selectedPaper) {
      handleSubmitExam();
    }
  }, [timeLeft]);

  const handleSubmitExam = useCallback(async () => {
    if (!selectedPaper || submitting) return;
    setSubmitting(true);
    try {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const answerList = Object.entries(answers).map(([qid, ans]) => ({
        question_id: Number(qid),
        selected_answer: ans,
      }));
      const data = await submitExam(selectedPaper.id, answerList, elapsed);
      setResult(data);
      setExamSubmitted(true);
    } catch {
      toast.error("提交考试失败");
    }
    setSubmitting(false);
  }, [selectedPaper, answers, submitting]);

  const handleSubmitRef = useRef(handleSubmitExam);
  handleSubmitRef.current = handleSubmitExam;

  useEffect(() => {
    if (examStarted && !examSubmitted && timeLeft === 0 && selectedPaper) {
      handleSubmitRef.current();
    }
  }, [timeLeft, examStarted, examSubmitted, selectedPaper]);

  const handleSelectAnswer = (questionId: number, option: string) => {
    if (!examStarted || examSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleReset = () => {
    setSelectedPaper(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setExamStarted(false);
    setExamSubmitted(false);
    setResult(null);
    setTimeLeft(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const groupedQuestions = questions.reduce<Record<string, ExamQuestion[]>>((acc, q) => {
    const section = q.section_name || "未分类";
    if (!acc[section]) acc[section] = [];
    acc[section].push(q);
    return acc;
  }, {});

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const currentQuestion = questions[currentQuestionIndex];

  const getScoreColor = (accuracy: number) => {
    if (accuracy < 40) return "text-red-600 dark:text-red-400";
    if (accuracy < 70) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const getScoreBg = (accuracy: number) => {
    if (accuracy < 40) return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    if (accuracy < 70) return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-3 space-y-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">真题库</h2>
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
                <option key={y} value={y}>
                  {y}年
                </option>
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
            <p className="text-xs text-muted-foreground text-center py-8">暂无试卷</p>
          ) : (
            papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => handleSelectPaper(paper)}
                className={`w-full text-left rounded-lg border p-3 space-y-2 transition-colors ${
                  selectedPaper?.id === paper.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <p className="text-sm font-medium leading-tight line-clamp-2">{paper.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${SUBJECT_COLORS[paper.subject] || "bg-accent text-muted-foreground"}`}>
                    {paper.subject}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{paper.year}年</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3 w-3" />
                    {paper.question_count}题
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {paper.duration_minutes}分钟
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedPaper ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground">请选择一套真题开始练习</p>
            </div>
          </div>
        ) : examSubmitted && result ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">成绩报告</h2>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                返回列表
              </button>
            </div>

            <div className={`rounded-lg border p-6 ${getScoreBg(result.accuracy)}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className={`text-3xl font-bold ${getScoreColor(result.accuracy)}`}>
                    {result.total_score}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    总分 / 满分 {result.max_score}
                  </p>
                </div>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${getScoreColor(result.accuracy)}`}>
                    {result.accuracy}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">正确率</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {formatTime(result.duration_seconds)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">用时</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {result.details.filter((d) => d.is_correct).length}/{result.details.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">正确题数</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">答题详情</h3>
              {result.details.map((d, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-sm ${
                    d.is_correct
                      ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                      : "border-red-500/30 bg-red-50/50 dark:bg-red-900/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 flex-shrink-0 ${d.is_correct ? "text-green-500" : "text-red-500"}`}>
                      {d.is_correct ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p
                        className="font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderLatex(d.question_text) }}
                      />
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          你的答案：{d.selected_answer || "未作答"}
                        </span>
                        {!d.is_correct && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            正确答案：{d.correct_answer}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {d.score}/{d.max_score}分
                        </span>
                      </div>
                      {d.explanation && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          解析：{d.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="border-b border-border px-4 md:px-6 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold truncate">{selectedPaper.title}</h2>
                {!examStarted ? (
                  <button
                    onClick={handleStartExam}
                    disabled={loadingDetail}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
                  >
                    {loadingDetail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {loadingDetail ? "加载中..." : "开始做题"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
                        timeLeft < 300 ? "text-red-600 dark:text-red-400" : "text-foreground"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                )}
              </div>
              {examStarted && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {answeredCount}/{totalQuestions}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {!examStarted ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4 space-y-3">
                      <h3 className="text-base font-semibold">{selectedPaper.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${SUBJECT_COLORS[selectedPaper.subject] || ""}`}>
                          {selectedPaper.subject}
                        </span>
                        <span>{selectedPaper.year}年</span>
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {selectedPaper.question_count}题
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {selectedPaper.duration_minutes}分钟
                        </span>
                      </div>
                    </div>
                    {Object.keys(groupedQuestions).length > 0 && (
                      <div className="space-y-3">
                        {Object.entries(groupedQuestions).map(([section, qs]) => (
                          <div key={section} className="rounded-lg border border-border p-3 space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground">{section}</h4>
                            <div className="space-y-1">
                              {qs.map((q, i) => (
                                <p key={q.id} className="text-xs text-muted-foreground">
                                  {i + 1}. {q.question_text.slice(0, 60)}...
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : currentQuestion ? (
                  <div className="space-y-4">
                    {(() => {
                      const sectionEntries = Object.entries(groupedQuestions);
                      let globalIdx = 0;
                      for (const [section, qs] of sectionEntries) {
                        const sectionStart = globalIdx;
                        const sectionEnd = globalIdx + qs.length - 1;
                        if (currentQuestionIndex >= sectionStart && currentQuestionIndex <= sectionEnd) {
                          return (
                            <div key={section} className="space-y-4">
                              <div className="rounded-md bg-accent/50 px-3 py-1.5">
                                <span className="text-xs font-medium text-muted-foreground">{section}</span>
                              </div>
                              <div className="space-y-3">
                                <p
                                  className="text-sm font-medium leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: renderLatex(
                                      `${currentQuestionIndex + 1}. ${currentQuestion.question_text}`
                                    ),
                                  }}
                                />
                                {currentQuestion.question_type === "single_choice" &&
                                  currentQuestion.options.map((opt, oi) => {
                                    const letter = String.fromCharCode(65 + oi);
                                    const isSelected = answers[currentQuestion.id] === letter;
                                    return (
                                      <button
                                        key={oi}
                                        onClick={() => handleSelectAnswer(currentQuestion.id, letter)}
                                        className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                                          isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-accent"
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium ${
                                              isSelected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border"
                                            }`}
                                          >
                                            {letter}
                                          </span>
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: renderLatex(opt),
                                            }}
                                          />
                                        </span>
                                      </button>
                                    );
                                  })}
                                {currentQuestion.question_type === "multi_choice" &&
                                  currentQuestion.options.map((opt, oi) => {
                                    const letter = String.fromCharCode(65 + oi);
                                    const currentAns = answers[currentQuestion.id] || "";
                                    const isSelected = currentAns.includes(letter);
                                    return (
                                      <button
                                        key={oi}
                                        onClick={() => {
                                          if (!examStarted || examSubmitted) return;
                                          const current = answers[currentQuestion.id] || "";
                                          const newAns = isSelected
                                            ? current.replace(letter, "")
                                            : current + letter;
                                          setAnswers((prev) => ({
                                            ...prev,
                                            [currentQuestion.id]: newAns
                                              .split("")
                                              .sort()
                                              .join(""),
                                          }));
                                        }}
                                        className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                                          isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-accent"
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center text-xs font-medium ${
                                              isSelected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border"
                                            }`}
                                          >
                                            {letter}
                                          </span>
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: renderLatex(opt),
                                            }}
                                          />
                                        </span>
                                      </button>
                                    );
                                  })}
                                {currentQuestion.question_type === "fill_blank" && (
                                  <input
                                    type="text"
                                    value={answers[currentQuestion.id] || ""}
                                    onChange={(e) =>
                                      handleSelectAnswer(currentQuestion.id, e.target.value)
                                    }
                                    placeholder="请输入答案"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        }
                        globalIdx += qs.length;
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">暂无题目</p>
                  </div>
                )}
              </div>

              {examStarted && questions.length > 0 && (
                <div className="w-[180px] flex-shrink-0 border-l border-border overflow-y-auto p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">答题卡</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((q, i) => {
                      const isAnswered = q.id in answers;
                      const isCurrent = i === currentQuestionIndex;
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentQuestionIndex(i)}
                          className={`w-7 h-7 rounded text-[10px] font-medium transition-colors flex items-center justify-center ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : isAnswered
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                              : "border border-border hover:bg-accent"
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-2 space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-primary" />
                      <span>当前</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800" />
                      <span>已答</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded border border-border" />
                      <span>未答</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {examStarted && questions.length > 0 && (
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-border">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一题
                </button>
                <button
                  onClick={() => handleSubmitExam()}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? "提交中..." : "交卷"}
                </button>
                <button
                  onClick={() =>
                    setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))
                  }
                  disabled={currentQuestionIndex >= questions.length - 1}
                  className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  下一题
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExamPapersPage;
