from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from db.database import get_session
from db.models import WrongQuestion, StudyPlan

router = APIRouter()


@router.get("/{user_id}")
async def get_reminders(user_id: int, session: AsyncSession = Depends(get_session)):
    reminders = []

    now = datetime.now()
    due_result = await session.execute(
        select(func.count()).select_from(WrongQuestion).where(
            WrongQuestion.user_id == user_id,
            WrongQuestion.mastered == False,
            (WrongQuestion.next_review_at <= now) | (WrongQuestion.next_review_at.is_(None)),
        )
    )
    due_count = due_result.scalar() or 0
    if due_count > 0:
        reminders.append({
            "type": "review",
            "title": f"今日有 {due_count} 道错题待复习",
            "action": "/quiz",
            "count": due_count,
        })

    plan_result = await session.execute(
        select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True)
    )
    active_plans = plan_result.scalars().all()
    if active_plans:
        reminders.append({
            "type": "plan",
            "title": f"你有 {len(active_plans)} 个活跃学习计划",
            "action": "/plan",
            "count": len(active_plans),
        })

    return {"reminders": reminders, "total": len(reminders)}
