import logging
from core.llm import chat_completion_sync
from core.rag.engine import RAGEngine

logger = logging.getLogger(__name__)
rag_engine = RAGEngine()


class StudyGuide:

    @staticmethod
    def generate_study_plan(user_id: int, subject: str) -> str:
        query = f"{subject} 学习计划 教材 目录 章节"
        results = rag_engine.search_with_user(query, user_id=user_id, top_k=5)
        context = ""
        if results:
            context = "\n\n".join([r["text"] for r in results])

        prompt = f"""你是一位考研辅导专家。请根据学生上传的教辅资料，为该学生生成一份{subject}科目的个性化学习计划。

学生上传的资料内容摘要：
{context if context else "暂无上传资料，请基于考研大纲生成通用学习计划"}

要求：
1. 如果有上传资料，请基于资料的章节结构来安排学习计划
2. 将学习内容分为不同阶段（基础、强化、冲刺）
3. 每个阶段标注参考资料的章节
4. 给出每周的学习重点和目标
5. 用 Markdown 格式输出"""

        messages = [{"role": "user", "content": prompt}]
        return chat_completion_sync(messages)

    @staticmethod
    def explain_topic(user_id: int, topic: str) -> str:
        results = rag_engine.search_with_user(topic, user_id=user_id, top_k=5)
        context = ""
        source_files = []
        if results:
            context = "\n\n".join([r["text"] for r in results])
            source_files = list(set(
                r.get("metadata", {}).get("filename", "")
                for r in results
                if r.get("metadata", {}).get("filename")
            ))

        source_hint = ""
        if source_files:
            source_hint = f"\n\n参考来源：{', '.join(source_files)}"

        context_ref = f"参考学生上传的教辅资料内容：\n\n{context}" if context else "请基于考研大纲进行讲解"

        prompt = f"""你是一位考研辅导专家，请详细讲解以下知识点：{topic}

{context_ref}

要求：
1. 先给出核心定义和概念
2. 然后详细展开，包含公式、定理等
3. 给出典型例题和解题思路
4. 标注考研中该知识点的常见考法
5. 用 Markdown 格式输出{source_hint}"""

        messages = [{"role": "user", "content": prompt}]
        return chat_completion_sync(messages)

    @staticmethod
    def solve_question(user_id: int, question_text: str) -> str:
        results = rag_engine.search_with_user(question_text, user_id=user_id, top_k=5)
        context = ""
        source_files = []
        if results:
            context = "\n\n".join([r["text"] for r in results])
            source_files = list(set(
                r.get("metadata", {}).get("filename", "")
                for r in results
                if r.get("metadata", {}).get("filename")
            ))

        source_hint = ""
        if source_files:
            source_hint = f"\n\n参考来源：{', '.join(source_files)}"

        context_ref = f"参考学生上传的教辅资料中的相关内容：\n\n{context}" if context else ""

        prompt = f"""你是一位考研辅导专家，请解答以下题目：

{question_text}

{context_ref}

要求：
1. 先分析题目考查的知识点
2. 给出详细的解题步骤
3. 每一步都要有清晰的说明
4. 最后给出答案和总结
5. 如果有相关的解题技巧，一并说明
6. 用 Markdown 格式输出{source_hint}"""

        messages = [{"role": "user", "content": prompt}]
        return chat_completion_sync(messages)
