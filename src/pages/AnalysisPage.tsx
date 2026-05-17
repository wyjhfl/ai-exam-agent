import { useEffect, useState } from "react";
import { Clock, Target, TrendingUp, AlertCircle } from "lucide-react";
import { fetchAnalysisOverview, fetchSubjectStats, fetchTrend } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";

interface Overview {
  total_study_minutes: number;
  total_quiz_count: number;
  accuracy: number;
  wrong_count: number;
}

interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface TrendDay {
  date: string;
  total: number;
  correct: number;
  accuracy: number;
}

function AnalysisPage() {
  const { userId } = useChatStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [trend, setTrend] = useState<TrendDay[]>([]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    if (!userId) return;
    try {
      const [ov, ss, tr] = await Promise.all([
        fetchAnalysisOverview(userId),
        fetchSubjectStats(userId),
        fetchTrend(userId),
      ]);
      setOverview(ov);
      setSubjectStats(ss);
      setTrend(tr);
    } catch {
      // load failed
    }
  };

  const hasData = overview && overview.total_quiz_count > 0;
  const maxQuizInTrend = Math.max(...trend.map((t) => t.total), 1);

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold">学情分析</h1>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">暂无学习数据</p>
          <p className="text-sm text-muted-foreground">去刷几道题再来查看分析</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="总学习时长"
              value={`${Math.round((overview.total_study_minutes || 0) / 60)}h`}
            />
            <StatCard
              icon={<Target className="h-5 w-5" />}
              label="总刷题数"
              value={String(overview.total_quiz_count)}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="正确率"
              value={`${overview.accuracy}%`}
            />
            <StatCard
              icon={<AlertCircle className="h-5 w-5" />}
              label="待复习错题"
              value={String(overview.wrong_count)}
            />
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">各科正确率</h3>
            {subjectStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <div className="space-y-2">
                {subjectStats.map((s) => (
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
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">最近 7 天学习趋势</h3>
            <div className="flex items-end gap-2 h-32">
              {trend.map((d) => {
                const heightPct = (d.total / maxQuizInTrend) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{d.total}</span>
                    <div className="w-full relative" style={{ height: "100px" }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t bg-primary/80 transition-all"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
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

export default AnalysisPage;
