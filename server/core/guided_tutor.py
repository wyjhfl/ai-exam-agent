import logging
from core.llm import chat_completion_sync
from core.rag.engine import RAGEngine

logger = logging.getLogger(__name__)
rag_engine = RAGEngine()

GUIDED_SYSTEM_PROMPT = """你是一位善于引导学生思考的考研辅导老师。你的教学原则是：
1. 不要直接告诉学生答案，而是通过提问引导他们自己思考
2. 如果学生答对了，给予肯定并追问更深层的问题
3. 如果学生答错了，不要直接纠正，而是给出提示让学生自己发现错误
4. 如果学生请求提示，给出方向性的提示而非直接答案
5. 保持耐心和鼓励的语气
6. 每次回复末尾提出一个引导性问题"""


class GuidedTutor:

    @staticmethod
    def generate_guided_question(user_id: int, topic: str) -> str:
        context = ""
        try:
            results = rag_engine.search_with_user(topic, user_id=user_id, top_k=3, enable_rerank=False)
            if results:
                context = "\n\n".join([r["text"] for r in results[:2]])
        except Exception:
            pass

        prompt = f"请基于知识点「{topic}」生成一个引导式场景问题，让学生通过思考场景来理解这个知识点。"
        if context:
            prompt += f"\n\n参考资料：\n{context[:1500]}"
        prompt += "\n\n注意：不要直接问定义，而是设计一个具体的场景或案例，让学生在分析场景的过程中自然理解知识点。只输出问题本身，不要输出答案。"

        messages = [
            {"role": "system", "content": GUIDED_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        try:
            return chat_completion_sync(messages)
        except Exception as e:
            logger.error(f"Generate guided question failed: {e}")
            return f"关于「{topic}」，你能想到什么相关的概念吗？试着用自己的话描述一下。"

    @staticmethod
    def evaluate_and_respond(user_id: int, topic: str, user_answer: str, conversation_history: list) -> dict:
        messages = [{"role": "system", "content": GUIDED_SYSTEM_PROMPT}]

        for msg in conversation_history[-10:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        prompt = f"学生在学习「{topic}」时回答了：{user_answer}\n\n请根据教学原则回应：\n- 如果回答正确，肯定并追问\n- 如果回答错误，给提示而非答案\n- 如果部分正确，肯定对的部分，引导补全\n\n注意：回复末尾一定要提出一个引导性问题。"

        messages.append({"role": "user", "content": prompt})

        try:
            response = chat_completion_sync(messages)
            is_question = response.strip().endswith("？") or response.strip().endswith("?")
            return {"response": response, "is_question": is_question}
        except Exception as e:
            logger.error(f"Evaluate and respond failed: {e}")
            return {"response": "你的思考很有价值！能再深入想想吗？", "is_question": True}

    @staticmethod
    def get_hint(user_id: int, topic: str, hint_level: int) -> str:
        context = ""
        try:
            results = rag_engine.search_with_user(topic, user_id=user_id, top_k=2, enable_rerank=False)
            if results:
                context = "\n\n".join([r["text"] for r in results[:2]])
        except Exception:
            pass

        level_descriptions = {
            1: "给出思考方向（如'想想这个条件意味着什么'）",
            2: "给出关键线索（如'注意题目中的连续性条件'）",
            3: "给出接近答案的提示（如'试试用拉格朗日中值定理'）",
        }
        desc = level_descriptions.get(hint_level, level_descriptions[1])

        prompt = f"关于「{topic}」，请给出第{hint_level}级提示：{desc}"
        if context:
            prompt += f"\n\n参考资料：\n{context[:1000]}"
        prompt += "\n\n注意：这是提示，不要直接给出完整答案。"

        messages = [
            {"role": "system", "content": GUIDED_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        try:
            return chat_completion_sync(messages)
        except Exception as e:
            logger.error(f"Get hint failed: {e}")
            return "试着回顾一下这个知识点的核心定义。"
