import { useState, useEffect } from "react";
import { PenLine, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { evaluateWriting, fetchWritingHistory } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

type EssayType = "english_writing" | "politics_essay";

interface EvaluationResult {
  score: number;
  max_score: number;
  grammar_errors: { error: string; correction: string; type: string }[];
  vocabulary_suggestions: { original: string; suggestion: string; reason: string }[];
  structure_feedback: string;
  improved_version: string;
}

interface HistoryItem {
  id: number;
  score: number;
  max_score: number;
  feedback: string;
  created_at: string;
}

function WritingPage() {
  const { userId } = useUserStore();
  const [essayType, setEssayType] = useState<EssayType>("english_writing");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showImproved, setShowImproved] = useState(false);

  useEffect(() => {
    if (userId) loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    if (!userId) return;
    try {
      const data = await fetchWritingHistory(userId);
      setHistory(data);
    } catch {
      // no history
    }
  };

  const handleSubmit = async () => {
    if (text.trim().length < 50) {
      toast.error("作文内容太短，至少需要50字");
      return;
    }
    if (!userId) return;

    setLoading(true);
    try {
      const data = await evaluateWriting(text, essayType, userId);
      setResult(data as EvaluationResult);
      toast.success("批改完成！");
      loadHistory();
    } catch {
      toast.error("批改失败，请稍后重试");
    }
    setLoading(false);
  };

  const scoreColor = result
    ? result.score / result.max_score >= 0.7
      ? "text-green-500"
      : result.score / result.max_score >= 0.4
        ? "text-amber-500"
        : "text-red-500"
    : "";

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="flex-1 border-b md:border-b-0 md:border-r border-border p-4 md:p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <PenLine className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">作文批改</h2>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setEssayType("english_writing")}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                essayType === "english_writing" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"
              }`}
            >
              英语作文
            </button>
            <button
              onClick={() => setEssayType("politics_essay")}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                essayType === "politics_essay" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"
              }`}
            >
              政治论述
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={essayType === "english_writing" ? "在此输入英语作文..." : "在此输入政治论述..."}
          className="flex-1 min-h-[200px] rounded-md border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{text.length} 字</span>
          <button
            onClick={handleSubmit}
            disabled={loading || text.trim().length < 50}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {loading ? "批改中..." : "提交批改"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {!result ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">提交作文后查看批改结果</p>
          </div>
        ) : (
          <>
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-1">得分</p>
              <p className={`text-5xl font-bold ${scoreColor}`}>
                {result.score}
                <span className="text-lg text-muted-foreground">/{result.max_score}</span>
              </p>
            </div>

            {result.grammar_errors && result.grammar_errors.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <h3 className="text-sm font-medium text-red-500">语法/表述错误</h3>
                {result.grammar_errors.map((err, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-red-500 line-through">{err.error}</span>
                    <span className="mx-1">→</span>
                    <span className="text-green-500">{err.correction}</span>
                    <span className="text-xs text-muted-foreground ml-1">({err.type})</span>
                  </div>
                ))}
              </div>
            )}

            {result.vocabulary_suggestions && result.vocabulary_suggestions.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <h3 className="text-sm font-medium text-green-500">词汇建议</h3>
                <div className="flex flex-wrap gap-1">
                  {result.vocabulary_suggestions.map((s, i) => (
                    <span key={i} className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs">
                      {s.original} → <span className="text-green-600 dark:text-green-400">{s.suggestion}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.structure_feedback && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <h3 className="text-sm font-medium">结构反馈</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.structure_feedback}</p>
              </div>
            )}

            {result.improved_version && (
              <div className="rounded-lg border border-border">
                <button
                  onClick={() => setShowImproved(!showImproved)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <span>改进版本</span>
                  {showImproved ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showImproved && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed border-t border-border pt-2 whitespace-pre-wrap">
                    {result.improved_version}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <h3 className="text-sm font-medium">批改历史</h3>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{h.score}/{h.max_score}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{h.feedback.slice(0, 50)}</span>
                <span className="text-xs text-muted-foreground">{h.created_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WritingPage;
