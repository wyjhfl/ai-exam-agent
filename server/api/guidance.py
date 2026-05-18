import logging
from fastapi import APIRouter
from models.schemas import GuidanceStudyPlanRequest, GuidanceExplainRequest, GuidanceSolveRequest
from core.study_guide import StudyGuide

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/study-plan")
async def generate_study_plan(request: GuidanceStudyPlanRequest):
    try:
        result = StudyGuide.generate_study_plan(request.user_id, request.subject)
        return {"plan": result}
    except Exception as e:
        logger.error(f"Generate study plan failed: {e}")
        return {"plan": f"生成学习计划失败：{str(e)}"}


@router.post("/explain")
async def explain_topic(request: GuidanceExplainRequest):
    try:
        result = StudyGuide.explain_topic(request.user_id, request.topic)
        return {"explanation": result}
    except Exception as e:
        logger.error(f"Explain topic failed: {e}")
        return {"explanation": f"讲解知识点失败：{str(e)}"}


@router.post("/solve")
async def solve_question(request: GuidanceSolveRequest):
    try:
        result = StudyGuide.solve_question(request.user_id, request.question_text)
        return {"solution": result}
    except Exception as e:
        logger.error(f"Solve question failed: {e}")
        return {"solution": f"解题失败：{str(e)}"}
