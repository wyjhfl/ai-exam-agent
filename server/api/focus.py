import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import StudySession, User
from core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/start")
async def start_focus(request: dict, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    subject = request.get("subject", "")
    duration = request.get("duration", 25)

    if duration < 1 or duration > 180:
        raise HTTPException(status_code=400, detail="专注时长需在1-180分钟之间")

    study_session = StudySession(
        user_id=user_id,
        subject=subject,
        duration=duration,
        session_type="focus",
    )
    session.add(study_session)
    await session.commit()
    await session.refresh(study_session)

    return {
        "session_id": study_session.id,
        "user_id": study_session.user_id,
        "subject": study_session.subject,
        "duration": study_session.duration,
        "session_type": study_session.session_type,
        "created_at": study_session.created_at.isoformat() if study_session.created_at else None,
    }


@router.post("/complete")
async def complete_focus(request: dict, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    session_id = request.get("session_id")
    actual_duration = request.get("actual_duration")

    if not session_id:
        raise HTTPException(status_code=400, detail="缺少 session_id")

    result = await session.execute(select(StudySession).where(StudySession.id == session_id))
    study_session = result.scalar_one_or_none()
    if not study_session:
        raise HTTPException(status_code=404, detail="专注会话不存在")

    if study_session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此专注会话")

    if actual_duration is not None and actual_duration > 0:
        study_session.duration = actual_duration

    await session.commit()

    return {
        "session_id": study_session.id,
        "duration": study_session.duration,
        "status": "completed",
    }


@router.get("/today")
async def get_today_focus(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    local_tz = datetime.now().astimezone().tzinfo
    now_local = datetime.now(local_tz)
    today_start_local = datetime(now_local.year, now_local.month, now_local.day, tzinfo=local_tz)
    today_end_local = today_start_local + timedelta(days=1)

    today_start_utc = today_start_local.astimezone(timezone.utc).replace(tzinfo=None)
    today_end_utc = today_end_local.astimezone(timezone.utc).replace(tzinfo=None)

    total_result = await session.execute(
        select(func.coalesce(func.sum(StudySession.duration), 0)).where(
            StudySession.user_id == user_id,
            StudySession.session_type == "focus",
            StudySession.created_at >= today_start_utc,
            StudySession.created_at < today_end_utc,
        )
    )
    total_minutes = total_result.scalar() or 0

    count_result = await session.execute(
        select(func.count()).where(
            StudySession.user_id == user_id,
            StudySession.session_type == "focus",
            StudySession.created_at >= today_start_utc,
            StudySession.created_at < today_end_utc,
        )
    )
    count = count_result.scalar() or 0

    return {
        "total_minutes": total_minutes,
        "count": count,
    }
