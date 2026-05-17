import json
import re
import logging
from core.llm import chat_completion_sync

logger = logging.getLogger(__name__)


class WritingEvaluator:
    async def evaluate_essay(self, essay_text: str, essay_type: str = "english_writing") -> dict:
        if essay_type == "english_writing":
            return await self._evaluate_english(essay_text)
        else:
            return await self._evaluate_politics(essay_text)

    async def _evaluate_english(self, text: str) -> dict:
        prompt = f"""你是一个专业的考研英语作文批改专家。请对以下英语作文进行详细批改。

作文内容：
{text}

请以JSON格式返回批改结果（不要包含markdown标记）：
{{
  "score": 评分(满分20分,整数),
  "max_score": 20,
  "grammar_errors": [
    {{"error": "错误内容", "correction": "正确写法", "type": "语法/拼写/标点"}}
  ],
  "vocabulary_suggestions": [
    {{"original": "原文用词", "suggestion": "建议用词", "reason": "原因"}}
  ],
  "structure_feedback": "文章结构评价和改进建议",
  "improved_version": "改进后的完整作文"
}}"""

        return await self._call_llm(prompt, 20)

    async def _evaluate_politics(self, text: str) -> dict:
        prompt = f"""你是一个专业的考研政治论述题批改专家。请对以下政治论述进行详细批改。

论述内容：
{text}

请以JSON格式返回批改结果（不要包含markdown标记）：
{{
  "score": 评分(满分10分,整数),
  "max_score": 10,
  "grammar_errors": [
    {{"error": "表述问题", "correction": "正确表述", "type": "论点/论据/逻辑"}}
  ],
  "vocabulary_suggestions": [
    {{"original": "原文表述", "suggestion": "建议表述", "reason": "原因"}}
  ],
  "structure_feedback": "答题规范和结构建议",
  "improved_version": "改进后的完整论述"
}}"""

        return await self._call_llm(prompt, 10)

    async def _call_llm(self, prompt: str, max_score: int) -> dict:
        try:
            messages = [{"role": "user", "content": prompt}]
            response = chat_completion_sync(messages)
            return self._parse_response(response, max_score)
        except Exception as e:
            logger.error(f"Writing evaluation failed: {e}")
            return {
                "score": 0,
                "max_score": max_score,
                "grammar_errors": [],
                "vocabulary_suggestions": [],
                "structure_feedback": "批改服务暂时不可用，请稍后重试",
                "improved_version": "",
            }

    def _parse_response(self, text: str, max_score: int) -> dict:
        text = text.strip()
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            text = json_match.group(1).strip()
        text = re.sub(r',\s*}', '}', text)
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                try:
                    result = json.loads(text[start:end])
                except json.JSONDecodeError:
                    result = {}
            else:
                result = {}

        return {
            "score": result.get("score", 0),
            "max_score": result.get("max_score", max_score),
            "grammar_errors": result.get("grammar_errors", []),
            "vocabulary_suggestions": result.get("vocabulary_suggestions", []),
            "structure_feedback": result.get("structure_feedback", ""),
            "improved_version": result.get("improved_version", ""),
        }
