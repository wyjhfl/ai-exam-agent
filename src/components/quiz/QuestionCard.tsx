import { memo } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { renderLatex } from "@/lib/format";

interface Question {
  id: number;
  subject: string;
  question_text: string;
  question_type?: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
}

interface WrongQuestion {
  wrong_id: number;
  question_id: number;
  id: number;
  subject: string;
  question_text: string;
  question_type?: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
  mastered: boolean;
  next_review_at?: string;
  interval?: number;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  fill_blank: "填空题",
  short_answer: "简答题",
};

interface QuestionCardProps {
  question: Question | WrongQuestion;
  isMockTaking?: boolean;
  selectedAnswer: string | null;
  showResult: boolean;
  fillBlankInput: string;
  shortAnswerInput: string;
  multiSelectAnswers: string[];
  mockAnswers: Record<number, string>;
  onAnswer: (option: string) => void;
  onNonChoiceAnswer: (answer: string) => void;
  onSetMockAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSetFillBlankInput: (value: string) => void;
  onSetShortAnswerInput: (value: string) => void;
  onSetMultiSelectAnswers: React.Dispatch<React.SetStateAction<string[]>>;
  isCorrectAnswer: (option: string) => boolean;
  showMeta?: boolean;
  currentIndex?: number;
  totalQuestions?: number;
}

function QuestionCardInner({
  question,
  isMockTaking = false,
  selectedAnswer,
  showResult,
  fillBlankInput,
  shortAnswerInput,
  multiSelectAnswers,
  mockAnswers,
  onAnswer,
  onNonChoiceAnswer,
  onSetMockAnswers,
  onSetFillBlankInput,
  onSetShortAnswerInput,
  onSetMultiSelectAnswers,
  isCorrectAnswer,
  showMeta = true,
  currentIndex,
  totalQuestions,
}: QuestionCardProps) {
  const q = question;
  const qt = q.question_type || "single_choice";

  const renderOptions = () => {
    if (qt === "single_choice") {
      return (
        <div className="space-y-2">
          {q.options?.map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selectedAnswer === letter;
            const isCorrect = isCorrectAnswer(letter);
            let btnClass = "border-border hover:bg-accent";
            if (showResult && isSelected && isCorrect) btnClass = "border-green-500 bg-green-500/10";
            else if (showResult && isSelected && !isCorrect) btnClass = "border-red-500 bg-red-500/10";
            else if (showResult && isCorrect) btnClass = "border-green-500 bg-green-500/10";

            return (
              <button
                key={i}
                onClick={() => { if (isMockTaking) { onSetMockAnswers((prev) => ({ ...prev, [q.id]: letter })); } else { onAnswer(letter); } }}
                disabled={showResult && !isMockTaking}
                className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${btnClass} disabled:cursor-default`}
              >
                <span className="font-medium mr-2">{letter}.</span>
                {option}
                {showResult && isSelected && isCorrect && <CheckCircle className="inline h-4 w-4 ml-2 text-green-500" />}
                {showResult && isSelected && !isCorrect && <XCircle className="inline h-4 w-4 ml-2 text-red-500" />}
              </button>
            );
          })}
        </div>
      );
    }

    if (qt === "multiple_choice") {
      return (
        <div className="space-y-2">
          {q.options?.map((option, i) => {
            const letter = String.fromCharCode(65 + i);
            const isChecked = isMockTaking
              ? (mockAnswers[q.id] || "").split(",").includes(letter)
              : multiSelectAnswers.includes(letter);
            const isCorrectOption = q.answer.split(",").map((a: string) => a.trim().toUpperCase()).includes(letter);

            let itemClass = "border-border hover:bg-accent";
            if (showResult && isChecked && isCorrectOption) itemClass = "border-green-500 bg-green-500/10";
            else if (showResult && isChecked && !isCorrectOption) itemClass = "border-red-500 bg-red-500/10";
            else if (showResult && isCorrectOption) itemClass = "border-green-500 bg-green-500/10";

            return (
              <button
                key={i}
                onClick={() => {
                  if (isMockTaking) {
                    const current = (mockAnswers[q.id] || "").split(",").filter(Boolean);
                    const next = current.includes(letter) ? current.filter((l: string) => l !== letter) : [...current, letter];
                    onSetMockAnswers((prev) => ({ ...prev, [q.id]: next.sort().join(",") }));
                  } else {
                    onSetMultiSelectAnswers((prev) =>
                      prev.includes(letter) ? prev.filter((l) => l !== letter) : [...prev, letter].sort()
                    );
                  }
                }}
                disabled={showResult && !isMockTaking}
                className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${itemClass} flex items-center gap-2`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${isChecked ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {isChecked ? "✓" : ""}
                </span>
                <span className="font-medium mr-2">{letter}.</span>
                {option}
              </button>
            );
          })}
          {!isMockTaking && !showResult && multiSelectAnswers.length > 0 && (
            <button
              onClick={() => onNonChoiceAnswer(multiSelectAnswers.join(","))}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              提交多选答案
            </button>
          )}
        </div>
      );
    }

    if (qt === "true_false") {
      return (
        <div className="flex gap-4">
          {[
            { label: "正确 (T)", value: "T" },
            { label: "错误 (F)", value: "F" },
          ].map((opt) => {
            const isSelected = isMockTaking ? mockAnswers[q.id] === opt.value : selectedAnswer === opt.value;
            const isCorrect = q.answer.trim().toUpperCase() === opt.value;
            let btnClass = "border-border hover:bg-accent flex-1";
            if (showResult && isSelected && isCorrect) btnClass = "border-green-500 bg-green-500/10 flex-1";
            else if (showResult && isSelected && !isCorrect) btnClass = "border-red-500 bg-red-500/10 flex-1";
            else if (showResult && isCorrect) btnClass = "border-green-500 bg-green-500/10 flex-1";

            return (
              <button
                key={opt.value}
                onClick={() => { if (isMockTaking) { onSetMockAnswers((prev) => ({ ...prev, [q.id]: opt.value })); } else { onAnswer(opt.value); } }}
                disabled={showResult && !isMockTaking}
                className={`rounded-md border px-6 py-4 text-base font-medium transition-colors ${btnClass}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (qt === "fill_blank") {
      return (
        <div className="space-y-3">
          {isMockTaking ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={mockAnswers[q.id] || ""}
                onChange={(e) => onSetMockAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="请输入答案"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={fillBlankInput}
                onChange={(e) => onSetFillBlankInput(e.target.value)}
                placeholder="请输入答案"
                disabled={showResult}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {!showResult && (
                <button
                  onClick={() => onNonChoiceAnswer(fillBlankInput)}
                  disabled={!fillBlankInput.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  提交
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (qt === "short_answer") {
      return (
        <div className="space-y-3">
          {isMockTaking ? (
            <textarea
              value={mockAnswers[q.id] || ""}
              onChange={(e) => onSetMockAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="请输入答案"
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          ) : (
            <>
              <textarea
                value={shortAnswerInput}
                onChange={(e) => onSetShortAnswerInput(e.target.value)}
                placeholder="请输入答案"
                disabled={showResult}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
              {!showResult && (
                <button
                  onClick={() => onNonChoiceAnswer(shortAnswerInput)}
                  disabled={!shortAnswerInput.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  提交答案
                </button>
              )}
            </>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-lg border border-border p-4 md:p-6 space-y-4">
      {showMeta && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5">{q.subject}</span>
          {q.question_type && q.question_type !== "single_choice" && (
            <span className="rounded-full bg-accent px-2 py-0.5">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
          )}
          {q.difficulty && <span>{q.difficulty}</span>}
          {currentIndex !== undefined && totalQuestions !== undefined && (
            <span className="ml-auto">{currentIndex + 1} / {totalQuestions}</span>
          )}
        </div>
      )}
      <p className="text-base md:text-lg font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderLatex(q.question_text) }} />
      {renderOptions()}
    </div>
  );
}

export const QuestionCard = memo(QuestionCardInner);
export default QuestionCard;
export type { Question, WrongQuestion, QuestionCardProps };
