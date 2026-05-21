import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { generatePlan, fetchPlan, generateStudyPlanFromMaterials } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { formatMarkdown } from "@/lib/format";
import { toast } from "sonner";

interface PlanData {
  overall_strategy: string;
  subjects: {
    name: string;
    target_score: number;
    daily_hours: number;
    key_chapters: string[];
    materials: string[];
  }[];
  timeline: {
    phase: string;
    months: string;
    milestone: string;
  }[];
}

const DEFAULT_SUBJECTS: Record<string, number> = { 政治: 5, 英语: 5, 数学: 5 };

function PlanPage() {
  const { userId } = useUserStore();
  const [targetSchool, setTargetSchool] = useState("");
  const [targetMajor, setTargetMajor] = useState("");
  const [examDate, setExamDate] = useState("");
  const [subjects, setSubjects] = useState<Record<string, number>>(DEFAULT_SUBJECTS);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [materialPlan, setMaterialPlan] = useState<string | null>(null);
  const [materialPlanSubject, setMaterialPlanSubject] = useState("数学");
  const [materialPlanLoading, setMaterialPlanLoading] = useState(false);

  useEffect(() => {
    if (userId) loadPlan();
  }, [userId]);

  const loadPlan = async () => {
    if (!userId) return;
    try {
      const data = await fetchPlan();
      if (data.plan_data) {
        setPlan(data.plan_data as PlanData);
        if (data.target_school) setTargetSchool(data.target_school);
        if (data.target_major) setTargetMajor(data.target_major);
      }
    } catch {
      // no plan yet
    }
  };

  const handleGenerate = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await generatePlan(targetSchool || "未定", targetMajor || "未定", examDate, subjects);
      setPlan(data.plan_data as PlanData);
      toast.success("计划生成成功！");
    } catch {
      toast.error("生成失败，请稍后重试");
    }
    setLoading(false);
  };

  const handleMaterialPlan = async () => {
    if (!userId) return;
    setMaterialPlanLoading(true);
    try {
      const data = await generateStudyPlanFromMaterials(materialPlanSubject);
      setMaterialPlan(data.plan);
      toast.success("基于教辅的计划生成成功！");
    } catch {
      toast.error("生成失败，请稍后重试");
    }
    setMaterialPlanLoading(false);
  };

  const handleSubjectLevel = (name: string, value: number) => {
    setSubjects((prev) => ({ ...prev, [name]: Math.max(1, Math.min(10, value)) }));
  };

  const toggleSubject = (idx: number) => {
    setExpandedSubject(expandedSubject === idx ? null : idx);
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border p-4 space-y-4 overflow-y-auto">
        <h2 className="text-lg font-semibold">目标信息</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">目标院校</label>
            <input
              value={targetSchool}
              onChange={(e) => setTargetSchool(e.target.value)}
              placeholder="如：北京大学"
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">报考专业</label>
            <input
              value={targetMajor}
              onChange={(e) => setTargetMajor(e.target.value)}
              placeholder="如：计算机科学与技术"
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">考试日期</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">各科自评水平（1-10）</label>
            {Object.entries(subjects).map(([name, level]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-12 text-sm">{name}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={level}
                  onChange={(e) => handleSubjectLevel(name, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-6 text-sm text-right">{level}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : plan ? (
            <>
              <RefreshCw className="h-4 w-4" />
              重新生成
            </>
          ) : (
            "生成计划"
          )}
        </button>

        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            基于我的教辅生成计划
          </p>
          <select
            value={materialPlanSubject}
            onChange={(e) => setMaterialPlanSubject(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="政治">政治</option>
            <option value="英语">英语</option>
            <option value="数学">数学</option>
          </select>
          <button
            onClick={handleMaterialPlan}
            disabled={materialPlanLoading}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm hover:bg-accent/80 disabled:opacity-50"
          >
            {materialPlanLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              "基于教辅生成"
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {materialPlan && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              基于教辅的学习计划
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(materialPlan) }} />
            </div>
          </div>
        )}

        {!plan && !materialPlan ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">填写目标信息后点击"生成计划"</p>
          </div>
        ) : plan ? (
          <>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-2">总体策略</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.overall_strategy}</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">各科计划</h3>
              {plan.subjects?.map((s, i) => (
                <div key={i} className="rounded-lg border border-border">
                  <button
                    onClick={() => toggleSubject(i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground">目标 {s.target_score} 分</span>
                      <span className="text-xs text-muted-foreground">每日 {s.daily_hours}h</span>
                    </div>
                    {expandedSubject === i ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedSubject === i && (
                    <div className="px-4 pb-3 space-y-2 border-t border-border pt-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">重点章节</p>
                        <div className="flex flex-wrap gap-1">
                          {s.key_chapters?.map((ch, j) => (
                            <span key={j} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">推荐资料</p>
                        <ul className="text-xs space-y-0.5">
                          {s.materials?.map((m, j) => (
                            <li key={j} className="text-muted-foreground">• {m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">时间线</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {plan.timeline?.map((t, i) => {
                  const colors = ["bg-blue-500", "bg-amber-500", "bg-red-500"];
                  return (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-3 w-3 rounded-full ${colors[i % colors.length]}`} />
                        <span className="text-sm font-medium">{t.phase}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.months}</p>
                      <p className="text-xs mt-1">{t.milestone}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default PlanPage;
