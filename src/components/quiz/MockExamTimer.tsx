import { Clock } from "lucide-react";
import type { Question } from "./QuestionCard";

interface MockExamTimerProps {
  mockTimer: number;
  mockQuestions: Question[];
  mockAnswers: Record<number, string>;
  currentIndex: number;
  mockSubmitting: boolean;
  formatTimer: (seconds: number) => string;
  onSubmit: () => void;
  onNavigate: (index: number) => void;
}

function MockExamTimer({
  mockTimer,
  mockQuestions,
  mockAnswers,
  currentIndex,
  mockSubmitting,
  formatTimer,
  onSubmit,
  onNavigate,
}: MockExamTimerProps) {
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <Clock className={`h-5 w-5 ${mockTimer < 300 ? "text-red-500 animate-pulse" : "text-primary"}`} />
        <span className={`text-lg font-mono font-bold ${mockTimer < 300 ? "text-red-500" : ""}`}>
          {formatTimer(mockTimer)}
        </span>
      </div>
      <div className="flex gap-1 flex-wrap max-w-[60%]">
        {mockQuestions.map((_, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className={`w-7 h-7 rounded text-xs font-medium ${
              i === currentIndex ? "bg-primary text-primary-foreground" :
              mockAnswers[mockQuestions[i].id] ? "bg-green-500/20 text-green-700 dark:text-green-400" :
              "bg-accent text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          const unanswered = mockQuestions.length - Object.keys(mockAnswers).length;
          if (unanswered > 0) {
            if (!confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`)) return;
          } else {
            if (!confirm("确定交卷吗？")) return;
          }
          onSubmit();
        }}
        disabled={mockSubmitting}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        交卷
      </button>
    </div>
  );
}

export default MockExamTimer;
