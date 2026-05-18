import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import User
from models.schemas import UserCreate, UserInfo, UserLogin, UserRegister

router = APIRouter()


@router.post("/register")
async def register(request: UserRegister, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.username == request.username))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    user = User(username=request.username, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return {"user_id": user.id, "username": user.username}


@router.post("/login")
async def login(request: UserLogin, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="该用户未设置密码，请先注册")
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    if password_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"user_id": user.id, "username": user.username}


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
        raise HTTPException(status_code=404, detail="User not found")
    return UserInfo(id=user.id, username=user.username, target_school=user.target_school, target_major=user.target_major)
