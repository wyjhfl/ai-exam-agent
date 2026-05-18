import { useEffect, useState } from "react";
import { Network, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { getKnowledgeTree, getUserMastery } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";

interface TreeNode {
  [key: string]: string[] | TreeNode;
}

function KnowledgePage() {
  const { userId } = useUserStore();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState("数学");
  const [tree, setTree] = useState<TreeNode>({});
  const [mastery, setMastery] = useState<Record<string, { total: number; correct: number; accuracy: number }>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const subjects = ["数学", "英语", "政治"];

  useEffect(() => {
    loadTree();
  }, [selectedSubject]);

  useEffect(() => {
    if (userId) loadMastery();
  }, [userId]);

  const loadTree = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeTree(selectedSubject);
      setTree(data.tree || {});
      setExpandedCategories(new Set());
      setExpandedChapters(new Set());
      setSelectedChapter(null);
    } catch {
      console.error("Failed to load knowledge tree");
    }
    setLoading(false);
  };

  const loadMastery = async () => {
    if (!userId) return;
    try {
      const data = await getUserMastery(userId);
      setMastery(data.mastery?.[selectedSubject] || {});
    } catch {
      console.error("Failed to load mastery");
    }
  };

  useEffect(() => {
    if (userId) loadMastery();
  }, [selectedSubject, userId]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChapter = (key: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMasteryColor = (accuracy: number) => {
    if (accuracy >= 70) return "bg-green-500";
    if (accuracy >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMasteryTextColor = (accuracy: number) => {
    if (accuracy >= 70) return "text-green-600 dark:text-green-400";
    if (accuracy >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const selectedMastery = selectedChapter ? mastery[selectedChapter] : null;

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4 overflow-hidden">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">知识点体系</h2>
      </div>

      <div className="flex gap-2">
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSubject(s)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              selectedSubject === s ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-72 shrink-0 rounded-lg border border-border overflow-y-auto p-3 space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">加载中...</p>
          ) : (
            Object.entries(tree).map(([category, chapters]) => {
              const catKey = `${selectedSubject}-${category}`;
              const isCatExpanded = expandedCategories.has(catKey);

              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    {isCatExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {category}
                  </button>

                  {isCatExpanded && typeof chapters === "object" && !Array.isArray(chapters) && (
                    <div className="ml-4 space-y-0.5">
                      {Object.entries(chapters as TreeNode).map(([chapter, topics]) => {
                        const chapKey = `${selectedSubject}-${category}-${chapter}`;
                        const isChapExpanded = expandedChapters.has(chapKey);
                        const chapMastery = mastery[chapter];
                        const accuracy = chapMastery?.accuracy ?? -1;

                        return (
                          <div key={chapter}>
                            <button
                              onClick={() => {
                                toggleChapter(chapKey);
                                setSelectedChapter(chapter);
                              }}
                              className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent transition-colors ${
                                selectedChapter === chapter ? "bg-accent" : ""
                              }`}
                            >
                              {isChapExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <span className="flex-1 text-left truncate">{chapter}</span>
                              {accuracy >= 0 && (
                                <span className={`text-xs ${getMasteryTextColor(accuracy)}`}>
                                  {accuracy}%
                                </span>
                              )}
                            </button>

                            {isChapExpanded && Array.isArray(topics) && (
                              <div className="ml-6 space-y-0.5">
                                {topics.map((topic) => {
                                  const topicMastery = mastery[topic];
                                  const tAccuracy = topicMastery?.accuracy ?? -1;

                                  return (
                                    <div key={topic} className="flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground">
                                      <span className="flex-1 truncate">{topic}</span>
                                      {tAccuracy >= 0 ? (
                                        <div className="flex items-center gap-1">
                                          <div className="w-12 h-1.5 rounded-full bg-accent overflow-hidden">
                                            <div className={`h-full rounded-full ${getMasteryColor(tAccuracy)}`} style={{ width: `${tAccuracy}%` }} />
                                          </div>
                                          <span className={`w-8 text-right ${getMasteryTextColor(tAccuracy)}`}>{tAccuracy}%</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground/50">未练习</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex-1 rounded-lg border border-border overflow-y-auto p-4 space-y-4">
          {selectedChapter ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{selectedChapter}</h3>
                <button
                  onClick={() => navigate("/quiz")}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  去练习
                </button>
              </div>

              {selectedMastery ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xl font-bold">{selectedMastery.total}</p>
                      <p className="text-xs text-muted-foreground">总题数</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xl font-bold">{selectedMastery.correct}</p>
                      <p className="text-xs text-muted-foreground">正确数</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className={`text-xl font-bold ${getMasteryTextColor(selectedMastery.accuracy)}`}>
                        {selectedMastery.accuracy}%
                      </p>
                      <p className="text-xs text-muted-foreground">正确率</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">掌握度</p>
                    <div className="w-full h-3 rounded-full bg-accent overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getMasteryColor(selectedMastery.accuracy)}`}
                        style={{ width: `${selectedMastery.accuracy}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="text-red-500">薄弱 (&lt;40%)</span>
                      <span className="text-yellow-500">一般 (40-70%)</span>
                      <span className="text-green-500">良好 (&gt;70%)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">暂无练习数据</p>
                  <button
                    onClick={() => navigate("/quiz")}
                    className="mt-3 flex items-center gap-1.5 mx-auto rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    <BookOpen className="h-4 w-4" />
                    开始练习
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Network className="h-12 w-12 mb-3 opacity-30" />
              <p>选择左侧知识点查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KnowledgePage;
