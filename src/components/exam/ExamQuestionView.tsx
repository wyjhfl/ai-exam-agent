import { renderLatex } from "@/lib/format";

interface ExamQuestion {
  id: number;
  section_name: string;
  question_order: number;
  question_text: string;
  question_type: string;
  options: string[];
  score: number;
  topic: string;
}

interface ExamQuestionViewProps {
  question: ExamQuestion;
  index: number;
  answer: string;
  onAnswer: (questionId: number, value: string) => void;
  onToggleMulti: (questionId: number, letter: string) => void;
}

function ExamQuestionView({ question, index, answer, onAnswer, onToggleMulti }: ExamQuestionViewProps) {
  const qt = question.question_type;

  const renderOptions = () => {
    if (qt === "single_choice") {
      return (question.options || []).map((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isSelected = answer === letter;
        return (
          <button
            key={oi}
            onClick={() => onAnswer(question.id, letter)}
            className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
              isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium ${
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {letter}
              </span>
              <span dangerouslySetInnerHTML={{ __html: renderLatex(opt) }} />
            </span>
          </button>
        );
      });
    }

    if (qt === "multiple_choice" || qt === "multi_choice") {
      return (question.options || []).map((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isSelected = (answer || "").includes(letter);
        return (
          <button
            key={oi}
            onClick={() => onToggleMulti(question.id, letter)}
            className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
              isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className={`flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center text-xs font-medium ${
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {letter}
              </span>
              <span dangerouslySetInnerHTML={{ __html: renderLatex(opt) }} />
            </span>
          </button>
        );
      });
    }

    if (qt === "true_false") {
      return (
        <div className="flex gap-3">
          {[
            { label: "正确", value: "T" },
            { label: "错误", value: "F" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onAnswer(question.id, opt.value)}
              className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${
                answer === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }

    if (qt === "fill_blank") {
      return (
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder="请输入答案"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      );
    }

    if (qt === "short_answer") {
      return (
        <textarea
          value={answer || ""}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder="请输入答案"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {question.section_name && (
        <div className="rounded-md bg-accent/50 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">{question.section_name}</span>
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>第 {index + 1} 题</span>
          <span>·</span>
          <span>{question.score}分</span>
          {question.topic && (
            <>
              <span>·</span>
              <span>{question.topic}</span>
            </>
          )}
        </div>
        <p
          className="text-sm font-medium leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderLatex(question.question_text) }}
        />
      </div>
      <div className="space-y-2">{renderOptions()}</div>
    </div>
  );
}

export default ExamQuestionView;
export type { ExamQuestion };
