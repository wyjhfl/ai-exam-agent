import json
import logging
from core.llm import chat_completion_sync, is_configured

logger = logging.getLogger(__name__)

PLAN_PROMPT = """你是一个考研备考规划专家。请根据以下信息生成个性化备考计划，必须以JSON格式返回。

目标院校：{target_school}
报考专业：{target_major}
考试日期：{exam_date}
各科当前水平（1-10分）：{subjects}

请返回如下JSON格式（不要包含其他文字，只返回纯JSON）：
{{
  "overall_strategy": "总体备考策略描述",
  "subjects": [
    {{
      "name": "科目名称",
      "target_score": 目标分数,
      "daily_hours": 每日学习时长(小时),
      "key_chapters": ["重点章节1", "重点章节2", "重点章节3"],
      "materials": ["推荐资料1", "推荐资料2"]
    }}
  ],
  "timeline": [
    {{
      "phase": "阶段名称（如：基础阶段）",
      "months": "时间范围（如：1-3月）",
      "milestone": "里程碑目标"
    }}
  ]
}}"""


class PlanningEngine:
    async def generate_plan(
        self,
        target_school: str,
        target_major: str,
        exam_date: str,
        subjects: dict[str, int],
    ) -> dict:
        if not is_configured():
            return self._fallback_plan(target_school, target_major, subjects)

        prompt = PLAN_PROMPT.format(
            target_school=target_school,
            target_major=target_major,
            exam_date=exam_date or "未确定",
            subjects=json.dumps(subjects, ensure_ascii=False),
        )

        try:
            messages = [{"role": "user", "content": prompt}]
            response_text = chat_completion_sync(messages)
            plan_data = self._parse_json_response(response_text)
            if plan_data:
                return plan_data
        except Exception as e:
            logger.error(f"LLM plan generation failed: {e}")

        return self._fallback_plan(target_school, target_major, subjects)

    def _parse_json_response(self, text: str) -> dict | None:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
        return None

    def _fallback_plan(self, target_school: str, target_major: str, subjects: dict[str, int]) -> dict:
        subject_list = []
        for name, level in subjects.items():
            subject_list.append({
                "name": name,
                "target_score": 70 + (10 - level) * 3,
                "daily_hours": round(1.5 + (10 - level) * 0.3, 1),
                "key_chapters": [f"{name}核心考点一", f"{name}核心考点二", f"{name}核心考点三"],
                "materials": [f"《{name}考研复习全书》", f"《{name}历年真题解析》"],
            })

        return {
            "overall_strategy": f"针对{target_school}{target_major}专业，采用分阶段递进式复习策略。先夯实基础，再强化提升，最后冲刺模拟。",
            "subjects": subject_list,
            "timeline": [
                {"phase": "基础阶段", "months": "1-4月", "milestone": "完成所有科目基础知识学习"},
                {"phase": "强化阶段", "months": "5-8月", "milestone": "重点突破难点，大量刷题巩固"},
                {"phase": "冲刺阶段", "months": "9-12月", "milestone": "模拟考试，查漏补缺"},
            ],
        }
