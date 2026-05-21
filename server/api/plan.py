import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import StudyPlan, User
from models.schemas import PlanGenerateRequest
from core.auth import get_current_user
from core.planner.engine import PlanningEngine

logger = logging.getLogger(__name__)
router = APIRouter()
planning_engine = PlanningEngine()


@router.post("/generate")
async def generate_plan(request: PlanGenerateRequest, http_request: Request, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    plan_data = await planning_engine.generate_plan(
        target_school=request.target_school,
        target_major=request.target_major,
        exam_date=request.exam_date,
        subjects=request.subjects,
        user_id=current_user.id,
        session=session,
    )

    existing = await session.execute(
        select(StudyPlan).where(StudyPlan.user_id == current_user.id, StudyPlan.is_active == True)
    )
    old_plan = existing.scalar_one_or_none()
    if old_plan:
        old_plan.is_active = False

    new_plan = StudyPlan(
        user_id=current_user.id,
        target_school=request.target_school,
        subject=request.target_major,
        current_level=json_level(request.subjects),
        plan_data=plan_data,
        is_active=True,
    )
    session.add(new_plan)
    await session.commit()
    await session.refresh(new_plan)

    return {"id": new_plan.id, "plan_data": plan_data, "target_school": request.target_school, "target_major": request.target_major}


@router.get("")
async def get_plan(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(StudyPlan).where(StudyPlan.user_id == current_user.id, StudyPlan.is_active == True)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return {"id": None, "plan_data": None}
    return {"id": plan.id, "plan_data": plan.plan_data, "target_school": plan.target_school, "target_major": plan.subject}


@router.put("/{plan_id}")
async def update_plan(plan_id: int, request: dict, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(StudyPlan).where(StudyPlan.id == plan_id, StudyPlan.user_id == current_user.id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if "plan_data" in request:
        plan.plan_data = request["plan_data"]
    await session.commit()
    return {"status": "ok", "id": plan.id}


def json_level(subjects: dict) -> str:
    parts = [f"{k}:{v}" for k, v in subjects.items()]
    return ",".join(parts)
