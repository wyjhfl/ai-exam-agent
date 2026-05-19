import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuestionCard from "@/components/quiz/QuestionCard";

const mockQuestion = {
  id: 1,
  subject: "数学",
  question_text: "1+1=?",
  question_type: "single_choice" as const,
  options: ["1", "2", "3", "4"],
  answer: "B",
  explanation: "简单加法",
  difficulty: "easy",
};

const baseProps = {
  selectedAnswer: null as string | null,
  showResult: false,
  fillBlankInput: "",
  shortAnswerInput: "",
  multiSelectAnswers: [] as string[],
  mockAnswers: {} as Record<number, string>,
  onAnswer: vi.fn(),
  onNonChoiceAnswer: vi.fn(),
  onSetMockAnswers: vi.fn(),
  onSetFillBlankInput: vi.fn(),
  onSetShortAnswerInput: vi.fn(),
  onSetMultiSelectAnswers: vi.fn(),
  isCorrectAnswer: () => false,
};

describe("QuestionCard", () => {
  it("should render question text", () => {
    render(<QuestionCard question={mockQuestion} {...baseProps} />);
    expect(screen.getByText(/1\+1/)).toBeDefined();
  });

  it("should render subject tag", () => {
    render(<QuestionCard question={mockQuestion} {...baseProps} />);
    expect(screen.getByText("数学")).toBeDefined();
  });

  it("should render all options for single choice", () => {
    render(<QuestionCard question={mockQuestion} {...baseProps} />);
    const buttons = screen.getAllByRole("button");
    const optionButtons = buttons.filter((b) =>
      ["A.", "B.", "C.", "D."].some((letter) => b.textContent?.includes(letter))
    );
    expect(optionButtons.length).toBe(4);
  });

  it("should call onAnswer when option clicked", () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={mockQuestion} {...baseProps} onAnswer={onAnswer} />);
    const buttons = screen.getAllByRole("button");
    const optionA = buttons.find((b) => b.textContent?.includes("A."));
    if (optionA) {
      fireEvent.click(optionA);
      expect(onAnswer).toHaveBeenCalledWith("A");
    }
  });

  it("should render fill blank input for fill_blank type", () => {
    const fillQuestion = {
      ...mockQuestion,
      question_type: "fill_blank",
    };
    render(<QuestionCard question={fillQuestion} {...baseProps} />);
    expect(screen.getByPlaceholderText("请输入答案")).toBeDefined();
  });

  it("should render true/false buttons for true_false type", () => {
    const tfQuestion = {
      ...mockQuestion,
      question_type: "true_false",
      options: [],
      answer: "T",
    };
    render(<QuestionCard question={tfQuestion} {...baseProps} />);
    expect(screen.getByText(/正确/)).toBeDefined();
    expect(screen.getByText(/错误/)).toBeDefined();
  });
});
