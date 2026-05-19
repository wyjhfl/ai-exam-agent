import { Sparkles, Loader2 } from "lucide-react";

interface GeneratePanelProps {
  genSubject: string;
  genDifficulty: string;
  genCount: number;
  genType: string;
  generating: boolean;
  onSetGenSubject: (value: string) => void;
  onSetGenDifficulty: (value: string) => void;
  onSetGenCount: (value: number) => void;
  onSetGenType: (value: string) => void;
  onGenerate: () => void;
}

function GeneratePanel({
  genSubject,
  genDifficulty,
  genCount,
  genType,
  generating,
  onSetGenSubject,
  onSetGenDifficulty,
  onSetGenCount,
  onSetGenType,
  onGenerate,
}: GeneratePanelProps) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <h3 className="text-sm font-medium">AI 智能出题</h3>
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-foreground">科目</label>
          <select value={genSubject} onChange={(e) => onSetGenSubject(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
            <option value="数学">数学</option>
            <option value="英语">英语</option>
            <option value="政治">政治</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">难度</label>
          <select value={genDifficulty} onChange={(e) => onSetGenDifficulty(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">题型</label>
          <select value={genType} onChange={(e) => onSetGenType(e.target.value)} className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm">
            <option value="single_choice">单选题</option>
            <option value="multiple_choice">多选题</option>
            <option value="true_false">判断题</option>
            <option value="fill_blank">填空题</option>
            <option value="short_answer">简答题</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">数量</label>
          <input type="number" min={1} max={10} value={genCount} onChange={(e) => onSetGenCount(Number(e.target.value))} className="ml-2 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" />
        </div>
        <button onClick={onGenerate} disabled={generating} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? "生成中..." : "生成"}
        </button>
      </div>
    </div>
  );
}

export default GeneratePanel;
