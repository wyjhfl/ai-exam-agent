import { CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { renderLatex } from "@/lib/format";

interface ExamResultDetail {
  question_id: number;
  question_text: string;
  question_order: number;
  section_name: string;
  question_type: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  explanation: string;
}

interface ExamResult {
  paper_id: number;
  total_score: number;
  max_score: number;
  accuracy: number;
  question_count: number;
  duration_seconds: number;
  details: ExamResultDetail[];
}

interface ExamResultViewProps {
  result: ExamResult;
  onRetry: () => void;
  onBack: () => void;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getScoreColor(acc: number) {
  if (acc < 40) return "text-red-600 dark:text-red-400";
  if (acc < 70) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function getScoreBg(acc: number) {
  if (acc < 40) return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  if (acc < 70) return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
}

function ExamResultView({ result, onRetry, onBack }: ExamResultViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">成绩报告</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新练习
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>

      <div className={`rounded-lg border p-6 ${getScoreBg(result.accuracy)}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className={`text-3xl font-bold ${getScoreColor(result.accuracy)}`}>{result.total_score}</p>
            <p className="text-xs text-muted-foreground mt-1">得分 / 满分 {result.max_score}</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${getScoreColor(result.accuracy)}`}>{result.accuracy}%</p>
            <p className="text-xs text-muted-foreground mt-1">正确率</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{result.question_count}</p>
            <p className="text-xs text-muted-foreground mt-1">答题题数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{formatTime(result.duration_seconds)}</p>
            <p className="text-xs text-muted-foreground mt-1">用时</p>
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>第 {d.question_order || i + 1} 题</span>
                  {d.section_name && (
                    <>
                      <span>·</span>
                      <span>{d.section_name}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{d.score}/{d.max_score}分</span>
                </div>
                {d.question_text && (
                  <p className="font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderLatex(d.question_text) }} />
                )}
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">你的答案：{d.selected_answer || "未作答"}</span>
                  {!d.is_correct && (
                    <span className="text-green-600 dark:text-green-400 font-medium">正确答案：{d.correct_answer}</span>
                  )}
                </div>
                {d.explanation && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">解析：{d.explanation}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExamResultView;
export type { ExamResult, ExamResultDetail };
