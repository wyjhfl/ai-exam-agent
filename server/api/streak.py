import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import StudyStreak, User
from core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/checkin")
async def checkin(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(
        select(StudyStreak).where(StudyStreak.user_id == user_id)
    )
    streak = result.scalar_one_or_none()

    today = date.today()

    if not streak:
        streak = StudyStreak(
            user_id=user_id,
            streak_days=1,
            last_checkin_date=today,
            max_streak=1,
        )
        session.add(streak)
        await session.commit()
        await session.refresh(streak)
        return {
            "streak_days": streak.streak_days,
            "max_streak": streak.max_streak,
            "is_new_day": True,
        }

    if streak.last_checkin_date == today:
        return {
            "streak_days": streak.streak_days,
            "max_streak": streak.max_streak,
            "is_new_day": False,
        }

    if streak.last_checkin_date == today - timedelta(days=1):
        streak.streak_days += 1
    else:
        streak.streak_days = 1

    streak.last_checkin_date = today
    if streak.streak_days > streak.max_streak:
        streak.max_streak = streak.streak_days

    await session.commit()
    await session.refresh(streak)

    return {
        "streak_days": streak.streak_days,
        "max_streak": streak.max_streak,
        "is_new_day": True,
    }


@router.get("")
async def get_streak(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(
        select(StudyStreak).where(StudyStreak.user_id == user_id)
    )
    streak = result.scalar_one_or_none()

    today = date.today()

    if not streak:
        return {
            "streak_days": 0,
            "max_streak": 0,
            "last_checkin_date": None,
            "checked_in_today": False,
        }

    return {
        "streak_days": streak.streak_days,
        "max_streak": streak.max_streak,
        "last_checkin_date": streak.last_checkin_date.isoformat() if streak.last_checkin_date else None,
        "checked_in_today": streak.last_checkin_date == today,
    }
