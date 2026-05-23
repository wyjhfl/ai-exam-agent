import type { ExamQuestion } from "./ExamQuestionView";

interface ExamAnswerCardProps {
  questions: ExamQuestion[];
  currentIdx: number;
  answers: Record<number, string>;
  onJump: (idx: number) => void;
}

function ExamAnswerCard({ questions, currentIdx, answers, onJump }: ExamAnswerCardProps) {
  return (
    <div className="w-[180px] flex-shrink-0 border-l border-border overflow-y-auto p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">答题卡</p>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const isAnswered = q.id in answers;
          const isCurrent = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => onJump(i)}
              className={`w-7 h-7 rounded text-[10px] font-medium transition-colors flex items-center justify-center ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isAnswered
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="pt-2 space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary" />
          <span>当前</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800" />
          <span>已答</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-border" />
          <span>未答</span>
        </div>
      </div>
    </div>
  );
}

export default ExamAnswerCard;
