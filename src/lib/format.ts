import katex from "katex";
import "katex/dist/katex.min.css";

function sanitizeHtml(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

export function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula: string) => {
    try {
      const rendered = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      return `<div class="katex-display">${rendered}</div>`;
    } catch {
      return `$$${formula}$$`;
    }
  });

  html = html.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_match, formula: string) => {
    try {
      const rendered = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      return `<span class="katex-inline">${rendered}</span>`;
    } catch {
      return `$${formula}$`;
    }
  });

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\n/g, "<br/>");
  return sanitizeHtml(html);
}

export function renderLatex(text: string): string {
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula: string) => {
    try {
      const rendered = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      return `<div class="katex-display">${rendered}</div>`;
    } catch {
      return `$$${formula}$$`;
    }
  });

  result = result.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_match, formula: string) => {
    try {
      const rendered = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      return `<span class="katex-inline">${rendered}</span>`;
    } catch {
      return `$${formula}$`;
    }
  });

  return sanitizeHtml(result);
}
