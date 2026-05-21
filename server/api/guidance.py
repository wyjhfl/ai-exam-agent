import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session
from db.models import User
from core.auth import get_current_user
from models.schemas import GuidanceStudyPlanRequest, GuidanceExplainRequest, GuidanceSolveRequest
from core.study_guide import StudyGuide

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/study-plan")
async def generate_study_plan(request: GuidanceStudyPlanRequest, current_user: User = Depends(get_current_user)):
    try:
        result = StudyGuide.generate_study_plan(current_user.id, request.subject)
        return {"plan": result}
    except Exception as e:
        logger.error(f"Generate study plan failed: {e}")
        return {"plan": f"生成学习计划失败：{str(e)}"}


@router.post("/explain")
async def explain_topic(request: GuidanceExplainRequest, current_user: User = Depends(get_current_user)):
    try:
        result = StudyGuide.explain_topic(current_user.id, request.topic)
        return {"explanation": result}
    except Exception as e:
        logger.error(f"Explain topic failed: {e}")
        return {"explanation": f"讲解知识点失败：{str(e)}"}


@router.post("/solve")
async def solve_question(request: GuidanceSolveRequest, current_user: User = Depends(get_current_user)):
    try:
        result = StudyGuide.solve_question(current_user.id, request.question_text)
        return {"solution": result}
    except Exception as e:
        logger.error(f"Solve question failed: {e}")
        return {"solution": f"解题失败：{str(e)}"}
