import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Target, TrendingUp, AlertCircle, Download, Zap, ClipboardList } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { fetchAnalysisOverview, fetchSubjectStats, fetchTrend, getExportUrl, fetchWeakPoints } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";

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

interface TrendPoint {
  date: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface WeakPoint {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

const SUBJECT_BAR_COLORS: Record<string, string> = {
  数学: "#3b82f6",
  英语: "#22c55e",
  政治: "#f97316",
};

function getAccuracyColor(acc: number) {
  if (acc < 40) return "#ef4444";
  if (acc < 70) return "#f59e0b";
  return "#22c55e";
}

function CustomTrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TrendPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{d.date}</p>
      <p className="text-muted-foreground">刷题数：{d.total}</p>
      <p className="text-muted-foreground">正确数：{d.correct}</p>
      <p className="text-primary font-medium">正确率：{d.accuracy}%</p>
    </div>
  );
}

function CustomSubjectTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as SubjectStat;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{d.subject}</p>
      <p className="text-muted-foreground">总题数：{d.total}</p>
      <p className="text-muted-foreground">正确数：{d.correct}</p>
      <p className="text-primary font-medium">正确率：{d.accuracy}%</p>
    </div>
  );
}

function CustomAccuracyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as SubjectStat;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{d.subject}</p>
      <p className="font-medium" style={{ color: getAccuracyColor(d.accuracy) }}>
        正确率：{d.accuracy}%
      </p>
    </div>
  );
}

function AnalysisPage() {
  const { userId } = useUserStore();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trend60, setTrend60] = useState<TrendPoint[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [ov, ss, tr, wp, tr60] = await Promise.all([
        fetchAnalysisOverview(),
        fetchSubjectStats(),
        fetchTrend(30),
        fetchWeakPoints(),
        fetchTrend(60),
      ]);
      setOverview(ov);
      setSubjectStats(Array.isArray(ss) ? ss : ss.items || []);
      setTrend(Array.isArray(tr) ? tr : tr.items || []);
      setWeakPoints(Array.isArray(wp) ? wp : wp.items || []);
      setTrend60(Array.isArray(tr60) ? tr60 : tr60.items || []);
    } catch {
      toast.error("加载分析数据失败");
    }
    setLoading(false);
  };

  const handleExport = (type: "wrong-questions" | "study-summary") => {
    if (!userId) return;
    const url = getExportUrl(type, "excel");
    window.open(url, "_blank");
    setShowExport(false);
  };

  if (loading) {
    return <PageLoader />;
  }

  const hasData = overview && overview.total_quiz_count > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">学情分析</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/weekly-report")}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            查看周报
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Download className="h-4 w-4" />
              导出数据
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-card shadow-lg z-10">
                <button
                  onClick={() => handleExport("wrong-questions")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  导出错题本(Excel)
                </button>
                <button
                  onClick={() => handleExport("study-summary")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  导出学习总结(Excel)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={AlertCircle}
          title="暂无学习数据"
          description="去刷几道题再来查看分析"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Clock className="h-5 w-5" />} label="总学习时长" value={`${Math.round((overview.total_study_minutes || 0) / 60)}h`} />
            <StatCard icon={<Target className="h-5 w-5" />} label="总刷题数" value={String(overview.total_quiz_count)} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="正确率" value={`${overview.accuracy}%`} />
            <StatCard icon={<AlertCircle className="h-5 w-5" />} label="待复习错题" value={String(overview.wrong_count)} />
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

          {weakPoints.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">薄弱知识点</h3>
              </div>
              <div className="space-y-2">
                {weakPoints.map((wp) => (
                  <div key={wp.topic} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          wp.accuracy < 40
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : wp.accuracy < 70
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {wp.topic}
                      </span>
                      <span className="text-xs text-muted-foreground">{wp.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {wp.correct}/{wp.total} ({wp.accuracy}%)
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/quiz?mode=adaptive&subject=" + encodeURIComponent(wp.subject))}
                      className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Zap className="h-3 w-3" />
                      去练习
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">近 30 天正确率趋势</h3>
              {trend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无趋势数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={<CustomTrendTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">各科刷题量对比</h3>
              {subjectStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip content={<CustomSubjectTooltip />} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} name="刷题量">
                      {subjectStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SUBJECT_BAR_COLORS[entry.subject] || "hsl(var(--primary))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">各科正确率对比</h3>
              {subjectStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis
                      domain={[0, 100]}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={<CustomAccuracyTooltip />} />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="正确率">
                      {subjectStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getAccuracyColor(entry.accuracy)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">学习活跃度</h3>
              {trend60.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1">
                    {trend60.map((d) => {
                      const level = d.total === 0 ? 0 : d.total <= 5 ? 1 : d.total <= 15 ? 2 : 3;
                      const colors = [
                        "bg-muted",
                        "bg-green-200 dark:bg-green-900/40",
                        "bg-green-400 dark:bg-green-700",
                        "bg-green-600 dark:bg-green-500",
                      ];
                      return (
                        <div
                          key={d.date}
                          className={`w-3 h-3 rounded-sm ${colors[level]}`}
                          title={`${d.date}: ${d.total} 题, 正确率 ${d.accuracy}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <span>少</span>
                    <div className="w-3 h-3 rounded-sm bg-muted" />
                    <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
                    <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
                    <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
                    <span>多</span>
                  </div>
                </>
              )}
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
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default AnalysisPage;
