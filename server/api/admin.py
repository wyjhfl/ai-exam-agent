from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session
from db.models import User
from core.auth import get_current_user
from core.data_cleanup import run_full_cleanup

router = APIRouter()


@router.post("/cleanup")
async def trigger_cleanup(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await run_full_cleanup()
    return {"status": "ok", **result}
