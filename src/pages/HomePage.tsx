import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, MessageSquare, BookMarked, BarChart3, Clock, Target, AlertCircle, Brain, Timer } from "lucide-react";
import { fetchKnowledgeStatus, indexKnowledgeBase, fetchAnalysisOverview, fetchHistory, fetchReviewQuestions, fetchTodayFocus } from "@/services/api";
import { useChatStore } from "@/stores/chatStore";
import { toast } from "sonner";

interface KnowledgeStatus {
  document_count: number;
  collection_name: string;
}

interface Overview {
  total_study_minutes: number;
  total_quiz_count: number;
  accuracy: number;
  wrong_count: number;
}

interface RecentChat {
  id: string;
  content: string;
  role: string;
}

function HomePage() {
  const navigate = useNavigate();
  const { userId } = useChatStore();
  const [knowledgeStatus, setKnowledgeStatus] = useState<KnowledgeStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ks = await fetchKnowledgeStatus();
      setKnowledgeStatus(ks);
    } catch {
      setKnowledgeStatus(null);
    }
    if (userId) {
      try {
        const ov = await fetchAnalysisOverview(userId);
        setOverview(ov);
      } catch {
        // no data
      }
      try {
        const history = await fetchHistory(userId, 6);
        const recent = history
          .filter((m: any) => m.role === "assistant" || m.role === "user")
          .slice(-3)
          .map((m: any) => ({ id: String(m.id), content: m.content, role: m.role }));
        setRecentChats(recent);
      } catch {
        // no history
      }
      try {
        const reviews = await fetchReviewQuestions(userId);
        setReviewCount(reviews.length);
      } catch {
        // no reviews
      }
      try {
        const focusData = await fetchTodayFocus(userId);
        setTodayFocusMinutes(focusData.total_minutes);
      } catch {
        // no focus data
      }
    }
  };

  const handleIndex = async () => {
    setIndexing(true);
    try {
      await indexKnowledgeBase();
      const ks = await fetchKnowledgeStatus();
      setKnowledgeStatus(ks);
      toast.success("索引建立成功");
    } catch {
      toast.error("索引建立失败");
    }
    setIndexing(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold">考研备考智能体</h1>
        <p className="text-muted-foreground mt-1">AI 驱动的个性化考研备考助手</p>
      </div>

      {reviewCount > 0 && (
        <button
          onClick={() => navigate("/quiz")}
          className="w-full flex items-center gap-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4 hover:bg-amber-500/20 transition-colors"
        >
          <Brain className="h-6 w-6 text-amber-500" />
          <div className="text-left">
            <p className="font-medium text-amber-600 dark:text-amber-400">你有 {reviewCount} 道题需要复习</p>
            <p className="text-xs text-muted-foreground">基于间隔重复算法，现在复习效果最好</p>
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Target className="h-5 w-5" />} label="总刷题数" value={String(overview?.total_quiz_count || 0)} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="总学习时长" value={`${Math.round((overview?.total_study_minutes || 0) / 60)}h`} />
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="待复习错题" value={String(overview?.wrong_count || 0)} />
        <StatCard icon={<Timer className="h-5 w-5" />} label="今日专注" value={`${todayFocusMinutes}分钟`} />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-sm">快捷操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/quiz")}
            className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
          >
            <BookMarked className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">开始刷题</span>
          </button>
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">开始对话</span>
          </button>
          <button
            onClick={() => navigate("/plan")}
            className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
          >
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">查看规划</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              知识库状态
            </h2>
            <button
              onClick={handleIndex}
              disabled={indexing}
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {indexing ? "索引中..." : "建立索引"}
            </button>
          </div>
          {knowledgeStatus ? (
            <div className="text-sm">
              <span className="text-muted-foreground">文档块数：</span>
              <span className="font-medium">{knowledgeStatus.document_count}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">未连接到知识库</p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            最近对话
          </h2>
          {recentChats.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无对话记录</p>
          ) : (
            <div className="space-y-2">
              {recentChats.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className={`text-xs ${c.role === "user" ? "text-primary" : "text-muted-foreground"}`}>
                    {c.role === "user" ? "你" : "AI"}：
                  </span>
                  <span className="text-muted-foreground line-clamp-1">{c.content.slice(0, 60)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: BarChart3, label: "学情分析", desc: "查看学习数据统计", path: "/analysis" },
          { icon: BookMarked, label: "错题本", desc: "复习做错的题目", path: "/quiz" },
        ].map((f) => (
          <a
            key={f.path}
            href={f.path}
            className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors"
          >
            <f.icon className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

export default HomePage;
