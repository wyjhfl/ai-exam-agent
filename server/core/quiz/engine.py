import json
import re
import logging
from core.llm import chat_completion_sync

logger = logging.getLogger(__name__)

QUESTION_TYPE_LABELS = {
    "single_choice": "单选题",
    "multiple_choice": "多选题",
    "true_false": "判断题",
    "fill_blank": "填空题",
    "short_answer": "简答题",
}


class QuizEngine:
    async def generate_questions(
        self,
        subject: str,
        topic: str = "",
        difficulty: str = "medium",
        count: int = 5,
        question_type: str = "single_choice",
    ) -> list[dict]:
        prompt = self._build_prompt(subject, topic, difficulty, count, question_type)
        messages = [{"role": "user", "content": prompt}]
        try:
            response = chat_completion_sync(messages)
            return self._parse_response(response, question_type)
        except Exception as e:
            logger.error(f"Failed to generate questions: {e}")
            return []

    def _build_prompt(self, subject: str, topic: str, difficulty: str, count: int, question_type: str) -> str:
        subject_hints = {
            "数学": "数学题需包含LaTeX公式（用$...$包裹行内公式，$$...$$包裹独立公式）。涵盖高数、线代、概率论的典型考研题型。",
            "英语": "英语题需包含完形填空、阅读理解、翻译等题型。阅读理解需提供一段短文和基于短文的题目。",
            "政治": "政治题需涵盖马原、毛概、史纲、思修的核心考点。",
        }
        hint = subject_hints.get(subject, "")
        topic_str = f"，知识点：{topic}" if topic else ""
        type_label = QUESTION_TYPE_LABELS.get(question_type, "单选题")

        if question_type == "single_choice":
            return f"""请生成 {count} 道考研{subject}单选题，难度为{difficulty}{topic_str}。

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
    "difficulty": "{difficulty}",
    "question_type": "single_choice"
  }}
]"""

        elif question_type == "multiple_choice":
            return f"""请生成 {count} 道考研{subject}多选题，难度为{difficulty}{topic_str}。

{hint}

要求：
1. 题目要符合考研真题风格和难度
2. 包含4个选项（A/B/C/D格式），正确答案有2个或以上
3. answer为逗号分隔的字母，如"A,C"或"A,B,D"
4. 给出详细解析，说明每个选项对错原因
5. 标注考查的知识点

请以纯JSON格式返回（不要包含markdown代码块标记），格式如下：
[
  {{
    "question_text": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "正确答案字母，逗号分隔（如A,C）",
    "explanation": "详细解析",
    "topic": "知识点",
    "difficulty": "{difficulty}",
    "question_type": "multiple_choice"
  }}
]"""

        elif question_type == "true_false":
            return f"""请生成 {count} 道考研{subject}判断题，难度为{difficulty}{topic_str}。

{hint}

要求：
1. 题目要符合考研真题风格和难度
2. 判断陈述是否正确
3. answer为"T"（正确）或"F"（错误）
4. 给出详细解析
5. 标注考查的知识点

请以纯JSON格式返回（不要包含markdown代码块标记），格式如下：
[
  {{
    "question_text": "判断题陈述内容",
    "answer": "T或F",
    "explanation": "详细解析",
    "topic": "知识点",
    "difficulty": "{difficulty}",
    "question_type": "true_false"
  }}
]"""

        elif question_type == "fill_blank":
            return f"""请生成 {count} 道考研{subject}填空题，难度为{difficulty}{topic_str}。

{hint}

要求：
1. 题目要符合考研真题风格和难度
2. 用______标记空位
3. answer为应填入的内容
4. 给出详细解析
5. 标注考查的知识点

请以纯JSON格式返回（不要包含markdown代码块标记），格式如下：
[
  {{
    "question_text": "题目内容，空位用______标记",
    "answer": "应填入的答案",
    "explanation": "详细解析",
    "topic": "知识点",
    "difficulty": "{difficulty}",
    "question_type": "fill_blank"
  }}
]"""

        elif question_type == "short_answer":
            return f"""请生成 {count} 道考研{subject}简答题，难度为{difficulty}{topic_str}。

{hint}

要求：
1. 题目要符合考研真题风格和难度
2. answer为参考答案要点
3. 给出详细解析和评分要点
4. 标注考查的知识点

请以纯JSON格式返回（不要包含markdown代码块标记），格式如下：
[
  {{
    "question_text": "简答题题目内容",
    "answer": "参考答案要点",
    "explanation": "详细解析和评分要点",
    "topic": "知识点",
    "difficulty": "{difficulty}",
    "question_type": "short_answer"
  }}
]"""

        return self._build_prompt(subject, topic, difficulty, count, "single_choice")

    def _parse_response(self, text: str, expected_type: str = "single_choice") -> list[dict]:
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
            qt = item.get("question_type", expected_type)
            q = {
                "question_text": item.get("question_text") or item.get("question", ""),
                "options": item.get("options", []),
                "answer": item.get("answer", ""),
                "explanation": item.get("explanation", ""),
                "topic": item.get("topic", ""),
                "difficulty": item.get("difficulty", "medium"),
                "question_type": qt,
            }
            if not q["question_text"] or not q["answer"]:
                continue
            if qt in ("single_choice", "multiple_choice") and not q["options"]:
                continue
            normalized.append(q)
        return normalized
