import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExamQuestionView from "@/components/exam/ExamQuestionView";

const baseQuestion = {
  id: 1,
  section_name: "选择题",
  question_order: 1,
  question_text: "1+1=?",
  question_type: "single_choice",
  options: ["1", "2", "3", "4"],
  score: 5,
  topic: "基础运算",
};

describe("ExamQuestionView", () => {
  it("renders single_choice and handles click", () => {
    const onAnswer = vi.fn();
    render(
      <ExamQuestionView
        question={baseQuestion}
        index={0}
        answer=""
        onAnswer={onAnswer}
        onToggleMulti={vi.fn()}
      />
    );
    expect(screen.getByText(/1\+1/)).toBeDefined();
    const buttons = screen.getAllByRole("button");
    const optionA = buttons.find((b) => b.textContent?.includes("A"));
    if (optionA) {
      fireEvent.click(optionA);
      expect(onAnswer).toHaveBeenCalledWith(1, "A");
    }
  });

  it("renders fill_blank and handles input", () => {
    const onAnswer = vi.fn();
    const q = { ...baseQuestion, question_type: "fill_blank", options: [] };
    render(
      <ExamQuestionView question={q} index={0} answer="" onAnswer={onAnswer} onToggleMulti={vi.fn()} />
    );
    const input = screen.getByPlaceholderText("请输入答案");
    fireEvent.change(input, { target: { value: "2" } });
    expect(onAnswer).toHaveBeenCalledWith(1, "2");
  });

  it("renders short_answer and handles input", () => {
    const onAnswer = vi.fn();
    const q = { ...baseQuestion, question_type: "short_answer", options: [] };
    render(
      <ExamQuestionView question={q} index={0} answer="" onAnswer={onAnswer} onToggleMulti={vi.fn()} />
    );
    const textarea = screen.getByPlaceholderText("请输入答案");
    fireEvent.change(textarea, { target: { value: "因为1+1=2" } });
    expect(onAnswer).toHaveBeenCalledWith(1, "因为1+1=2");
  });

  it("renders multiple_choice and toggles options", () => {
    const onToggleMulti = vi.fn();
    const q = { ...baseQuestion, question_type: "multiple_choice" };
    render(
      <ExamQuestionView question={q} index={0} answer="" onAnswer={vi.fn()} onToggleMulti={onToggleMulti} />
    );
    const buttons = screen.getAllByRole("button");
    const optionA = buttons.find((b) => b.textContent?.includes("A"));
    if (optionA) {
      fireEvent.click(optionA);
      expect(onToggleMulti).toHaveBeenCalledWith(1, "A");
    }
  });

  it("renders true_false buttons", () => {
    const q = { ...baseQuestion, question_type: "true_false", options: [] };
    render(
      <ExamQuestionView question={q} index={0} answer="" onAnswer={vi.fn()} onToggleMulti={vi.fn()} />
    );
    expect(screen.getByText("正确")).toBeDefined();
    expect(screen.getByText("错误")).toBeDefined();
  });
});
