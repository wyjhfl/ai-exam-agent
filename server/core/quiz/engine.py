import json
import re
import logging
from core.llm import chat_completion_sync

logger = logging.getLogger(__name__)


class QuizEngine:
    async def generate_questions(self, subject: str, topic: str = "", difficulty: str = "medium", count: int = 5) -> list[dict]:
        prompt = self._build_prompt(subject, topic, difficulty, count)
        messages = [{"role": "user", "content": prompt}]
        try:
            response = chat_completion_sync(messages)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"Failed to generate questions: {e}")
            return []

    def _build_prompt(self, subject: str, topic: str, difficulty: str, count: int) -> str:
        subject_hints = {
            "数学": "数学题需包含LaTeX公式（用$...$包裹行内公式，$$...$$包裹独立公式）。涵盖高数、线代、概率论的典型考研题型。",
            "英语": "英语题需包含完形填空、阅读理解、翻译等题型。阅读理解需提供一段短文和基于短文的题目。",
            "政治": "政治题需包含单选题和多选题（多选题在题目中标注[多选]）。涵盖马原、毛概、史纲、思修的核心考点。",
        }
        hint = subject_hints.get(subject, "")
        topic_str = f"，知识点：{topic}" if topic else ""

        return f"""请生成 {count} 道考研{subject}选择题，难度为{difficulty}{topic_str}。

{hint}

要求：
1. 题目要符合考研真题风格和难度
2. 包含4个选项（A/B/C/D格式）
3. 给出正确答案和详细解析
4. 标注考查的知识点

请以纯JSON格式返回（不要包含markdown代码块标记），格式如下：
[
  {{
    "question_text": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "正确答案字母（如A/B/C/D）",
    "explanation": "详细解析",
    "topic": "知识点",
    "difficulty": "{difficulty}"
  }}
]"""

    def _parse_response(self, text: str) -> list[dict]:
        text = text.strip()
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            text = json_match.group(1).strip()
        text = re.sub(r',\s*]', ']', text)
        text = re.sub(r',\s*}', '}', text)
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            start = text.find('[')
            end = text.rfind(']') + 1
            if start >= 0 and end > start:
                try:
                    result = json.loads(text[start:end])
                except json.JSONDecodeError:
                    logger.warning("Failed to parse LLM response as JSON")
                    return []
            else:
                return []

        if not isinstance(result, list):
            return []

        normalized = []
        for item in result:
            q = {
                "question_text": item.get("question_text") or item.get("question", ""),
                "options": item.get("options", []),
                "answer": item.get("answer", ""),
                "explanation": item.get("explanation", ""),
                "topic": item.get("topic", ""),
                "difficulty": item.get("difficulty", "medium"),
            }
            if q["question_text"] and q["options"] and q["answer"]:
                normalized.append(q)
        return normalized
