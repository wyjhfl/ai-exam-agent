import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import QuizRecord, WrongQuestion, StudyPlan, StudySession, User
from core.auth import get_current_user
from models.schemas import SyncUploadRequest, SyncDownloadRequest, SyncFullRequest

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_MODELS = {
    "quiz_records": QuizRecord,
    "wrong_questions": WrongQuestion,
    "study_plans": StudyPlan,
    "focus_sessions": StudySession,
}


def _serialize_record(record, data_type: str) -> dict:
    result = {}
    for c in record.__table__.columns:
        val = getattr(record, c.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        result[c.name] = val
    return result


@router.post("/upload")
async def upload_data(request: SyncUploadRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    model = DATA_MODELS.get(request.data_type)
    if not model:
        raise HTTPException(status_code=400, detail=f"Unsupported data_type: {request.data_type}")

    upserted = 0
    for item in request.data:
        if "id" in item and item["id"]:
            existing = await session.get(model, item["id"])
            if existing:
                for key, val in item.items():
                    if key != "id" and hasattr(existing, key):
                        setattr(existing, key, val)
                upserted += 1
                continue
        new_record = model(**{k: v for k, v in item.items() if hasattr(model, k)})
        session.add(new_record)
        upserted += 1

    await session.commit()
    return {"status": "ok", "data_type": request.data_type, "upserted": upserted}


@router.post("/download")
async def download_data(request: SyncDownloadRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    types_to_fetch = list(DATA_MODELS.keys()) if request.data_type == "all" else [request.data_type]
    result = {}

    for dt in types_to_fetch:
        model = DATA_MODELS.get(dt)
        if not model:
            continue
        rows = await session.execute(select(model).where(model.user_id == current_user.id))
        records = rows.scalars().all()
        result[dt] = [_serialize_record(r, dt) for r in records]

    return {"status": "ok", "data": result}


@router.post("/full")
async def full_sync(request: SyncFullRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    for dt, items in request.local_data.items():
        model = DATA_MODELS.get(dt)
        if not model:
            continue
        for item in items:
            if "id" in item and item["id"]:
                existing = await session.get(model, item["id"])
                if existing:
                    local_updated = item.get("updated_at") or item.get("created_at")
                    remote_updated = getattr(existing, "updated_at", None) or getattr(existing, "created_at", None)
                    if local_updated and remote_updated:
                        try:
                            local_ts = datetime.fromisoformat(str(local_updated)) if isinstance(local_updated, str) else local_updated
                            remote_ts = datetime.fromisoformat(str(remote_updated)) if isinstance(remote_updated, str) else remote_updated
                            if local_ts <= remote_ts:
                                continue
                        except (ValueError, TypeError):
                            pass
                    for key, val in item.items():
                        if key != "id" and hasattr(existing, key):
                            setattr(existing, key, val)
                    continue
            new_record = model(**{k: v for k, v in item.items() if hasattr(model, k)})
            session.add(new_record)

    await session.commit()

    result = {}
    for dt, model in DATA_MODELS.items():
        rows = await session.execute(select(model).where(model.user_id == current_user.id))
        records = rows.scalars().all()
        result[dt] = [_serialize_record(r, dt) for r in records]

    return {"status": "ok", "data": result}


@router.get("/status")
async def sync_status(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    counts = {}
    for dt, model in DATA_MODELS.items():
        count_result = await session.execute(
            select(func.count()).select_from(model).where(model.user_id == current_user.id)
        )
        counts[dt] = count_result.scalar() or 0

    return {
        "user_id": current_user.id,
        "last_sync_time": datetime.now().isoformat(),
        "counts": counts,
    }
