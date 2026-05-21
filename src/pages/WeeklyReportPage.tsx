import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Target, TrendingUp, CheckCircle, Sparkles, Lightbulb, ArrowRight, Download, Loader2 } from "lucide-react";
import { fetchWeeklyReport, getExportUrl } from "@/services/api";
import { useUserStore } from "@/stores/userStore";

interface WeeklyStats {
  total_quiz: number;
  accuracy: number;
  study_hours: number;
  new_wrong: number;
  mastered: number;
}

interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface WeakTopic {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface WeeklyReport {
  period: string;
  stats: WeeklyStats;
  subject_stats: SubjectStat[];
  weak_topics: WeakTopic[];
  summary: string;
  suggestions: string[];
  next_focus: string;
}

function WeeklyReportPage() {
  const { userId } = useUserStore();
  const navigate = useNavigate();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadReport();
  }, [userId]);

  const loadReport = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchWeeklyReport();
      setReport(data);
    } catch {
      // load failed
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-3">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">暂无周报数据</p>
        <p className="text-sm text-muted-foreground">去刷几道题再来查看周报</p>
      </div>
    );
  }

  const { stats, subject_stats, weak_topics, summary, suggestions, next_focus, period } = report;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">学习周报</h1>
          <p className="text-sm text-muted-foreground">{period}</p>
        </div>
        <button
          onClick={() => window.open(getExportUrl("study-summary", "excel"), "_blank")}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          导出周报
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Target className="h-5 w-5" />} label="刷题数" value={String(stats.total_quiz)} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="正确率" value={`${stats.accuracy}%`} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="学习时长" value={`${stats.study_hours}h`} />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="掌握错题" value={String(stats.mastered)} />
      </div>

      {subject_stats.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">各科对比</h3>
          <div className="space-y-2">
            {subject_stats.map((s) => (
              <div key={s.subject} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{s.subject}</span>
                  <span className="text-muted-foreground">
                    {s.correct}/{s.total} ({s.accuracy}%)
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.accuracy >= 70 ? "bg-green-500" : s.accuracy >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.max(s.accuracy, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">AI 摘要</h3>
          </div>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm">改进建议</h3>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-border p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <p className="text-sm">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {next_focus && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-primary">下周重点</h3>
          </div>
          <p className="text-sm font-medium">{next_focus}</p>
        </div>
      )}

      {weak_topics.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">薄弱知识点 Top 3</h3>
          <div className="space-y-2">
            {weak_topics.map((w) => (
              <div key={w.topic} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      w.accuracy < 40
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : w.accuracy < 70
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {w.topic}
                  </span>
                  <span className="text-xs text-muted-foreground">{w.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.correct}/{w.total} ({w.accuracy}%)
                  </span>
                </div>
                <button
                  onClick={() => navigate("/quiz?mode=adaptive&subject=" + encodeURIComponent(w.subject))}
                  className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
                >
                  <ArrowRight className="h-3 w-3" />
                  去练习
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default WeeklyReportPage;
