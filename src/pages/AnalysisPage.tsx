import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Target, TrendingUp, AlertCircle, Download, Zap, ClipboardList } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { fetchAnalysisOverview, fetchSubjectStats, fetchTrend, getExportUrl, fetchWeakPoints } from "@/services/api";
import { useUserStore } from "@/stores/userStore";

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

interface WeakPoint {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

function AnalysisPage() {
  const { userId } = useUserStore();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [trend60, setTrend60] = useState<TrendDay[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    if (!userId) return;
    try {
      const [ov, ss, tr, wp, tr60] = await Promise.all([
        fetchAnalysisOverview(),
        fetchSubjectStats(),
        fetchTrend(30),
        fetchWeakPoints(),
        fetchTrend(60),
      ]);
      setOverview(ov);
      setSubjectStats(ss);
      setTrend(tr);
      setWeakPoints(wp);
      setTrend60(tr60);
    } catch {
      // load failed
    }
  };

  const handleExport = (type: "wrong-questions" | "study-summary") => {
    if (!userId) return;
    const url = getExportUrl(type, "excel");
    window.open(url, "_blank");
    setShowExport(false);
  };

  const hasData = overview && overview.total_quiz_count > 0;
  const maxQuizInTrend = Math.max(...trend.map((t) => t.total), 1);

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

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">近 30 天正确率趋势</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(value: any) => [`${value}%`, '正确率']} labelFormatter={(label: any) => `日期: ${label}`} />
                <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">各科刷题量对比</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="刷题量" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">各科正确率对比</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(value: any) => [`${value}%`, '正确率']} />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="正确率">
                  {subjectStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.accuracy >= 70 ? '#22c55e' : entry.accuracy >= 40 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">学习活跃度</h3>
            <div className="flex flex-wrap gap-1">
              {trend60.map((d) => {
                const level = d.total === 0 ? 0 : d.total <= 5 ? 1 : d.total <= 15 ? 2 : 3;
                const colors = ['bg-muted', 'bg-green-200 dark:bg-green-900', 'bg-green-400 dark:bg-green-700', 'bg-green-600 dark:bg-green-500'];
                return (
                  <div
                    key={d.date}
                    className={`w-3 h-3 rounded-sm ${colors[level]}`}
                    title={`${d.date}: ${d.total} 题`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <span>少</span>
              <div className="w-3 h-3 rounded-sm bg-muted" />
              <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
              <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
              <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
              <span>多</span>
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
