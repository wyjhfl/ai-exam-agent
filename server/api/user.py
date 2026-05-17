from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import User
from models.schemas import UserCreate, UserInfo

router = APIRouter()


@router.post("/create", response_model=UserInfo)
async def create_user(request: UserCreate, session: AsyncSession = Depends(get_session)):
    user = User(username=request.username)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserInfo(id=user.id, username=user.username, target_school=user.target_school, target_major=user.target_major)


@router.get("/{user_id}", response_model=UserInfo)
async def get_user(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    return UserInfo(id=user.id, username=user.username, target_school=user.target_school, target_major=user.target_major)
