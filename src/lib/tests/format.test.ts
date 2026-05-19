import { describe, it, expect } from "vitest";
import { formatMarkdown, renderLatex } from "@/lib/format";

describe("formatMarkdown", () => {
  it("should escape HTML entities", () => {
    const result = formatMarkdown("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("should render bold text", () => {
    const result = formatMarkdown("**hello**");
    expect(result).toContain("<strong>hello</strong>");
  });

  it("should render italic text", () => {
    const result = formatMarkdown("*world*");
    expect(result).toContain("<em>world</em>");
  });

  it("should render inline code", () => {
    const result = formatMarkdown("`code`");
    expect(result).toContain("<code>code</code>");
  });

  it("should sanitize script tags after markdown processing", () => {
    const result = formatMarkdown("test <script>alert(1)</script> end");
    expect(result).not.toContain("<script>");
  });

  it("should render headings", () => {
    expect(formatMarkdown("# Title")).toContain("<h1>");
    expect(formatMarkdown("## Title")).toContain("<h2>");
    expect(formatMarkdown("### Sub")).toContain("<h3>");
  });

  it("should escape ampersands", () => {
    const result = formatMarkdown("A & B");
    expect(result).toContain("&amp;");
  });
});

describe("renderLatex", () => {
  it("should render inline latex", () => {
    const result = renderLatex("$x^2$");
    expect(result).toContain("katex-inline");
  });

  it("should render display latex", () => {
    const result = renderLatex("$$x^2$$");
    expect(result).toContain("katex-display");
  });

  it("should escape HTML in latex input", () => {
    const result = renderLatex("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("should sanitize script tags", () => {
    const result = renderLatex("test <script>bad</script> end");
    expect(result).not.toContain("<script>");
  });
});
