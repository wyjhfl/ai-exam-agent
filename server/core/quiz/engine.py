import json
import re
import logging
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import QuizRecord, QuizQuestion, WrongQuestion
from core.llm import chat_completion_sync, chat_completion_for_user

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
        user_id: int = None,
        session: AsyncSession = None,
    ) -> list[dict]:
        prompt = self._build_prompt(subject, topic, difficulty, count, question_type)
        messages = [{"role": "user", "content": prompt}]
        try:
            if user_id and session:
                response = await chat_completion_for_user(messages, user_id, session)
            else:
                response = chat_completion_sync(messages)
            return self._parse_response(response, question_type)
        except Exception as e:
            logger.error(f"Failed to generate questions: {e}")
            return []

    async def generate_adaptive_questions(
        self,
        user_id: int,
        session: AsyncSession,
        count: int = 5,
        subject: str | None = None,
    ) -> list[dict]:
        weak_topics = await self._get_weak_topics(user_id, session, subject)
        if not weak_topics:
            return await self.generate_questions(
                subject=subject or "数学",
                difficulty="medium",
                count=count,
                user_id=user_id,
                session=session,
            )

        topic_str = "、".join(weak_topics[:5])
        prompt = f"""请为考研{subject or '数学'}生成{count}道练习题。
重点考察以下薄弱知识点：{topic_str}
难度：中等偏难
题型：单选题

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
    "difficulty": "medium",
    "question_type": "single_choice"
  }}
]"""

        messages = [{"role": "user", "content": prompt}]
        try:
            if user_id and session:
                response = await chat_completion_for_user(messages, user_id, session)
            else:
                response = chat_completion_sync(messages)
            return self._parse_response(response, "single_choice")
        except Exception as e:
            logger.error(f"Failed to generate adaptive questions: {e}")
            return []

    async def _get_weak_topics(
        self,
        user_id: int,
        session: AsyncSession,
        subject: str | None = None,
    ) -> list[str]:
        query = (
            select(
                QuizQuestion.topic,
                func.count().label("total"),
                func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
            )
            .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
            .where(QuizRecord.user_id == user_id)
        )
        if subject:
            query = query.where(QuizQuestion.subject == subject)
        query = query.group_by(QuizQuestion.topic).order_by(func.count().desc())
        result = await session.execute(query)
        rows = result.all()

        weak = []
        for row in rows:
            if not row.topic:
                continue
            total = row.total or 0
            correct = row.correct or 0
            accuracy = (correct / total * 100) if total > 0 else 100
            if accuracy < 70:
                weak.append(row.topic)

        if not weak:
            wrong_query = (
                select(QuizQuestion.topic, func.count().label("cnt"))
                .join(WrongQuestion, WrongQuestion.question_id == QuizQuestion.id)
                .where(WrongQuestion.user_id == user_id, WrongQuestion.mastered == False)
            )
            if subject:
                wrong_query = wrong_query.where(QuizQuestion.subject == subject)
            wrong_query = wrong_query.group_by(QuizQuestion.topic).order_by(func.count().desc())
            wrong_result = await session.execute(wrong_query)
            for row in wrong_result.all():
                if row.topic:
                    weak.append(row.topic)

        return weak

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
