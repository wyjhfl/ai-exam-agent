import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI
from db.database import get_session
from db.models import User
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return key[:3] + "***" + key[-3:]


@router.get("/{user_id}/llm")
async def get_llm_config(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {
            "api_key": "",
            "base_url": "",
            "model": "",
            "is_custom": False,
        }
    is_custom = bool(user.llm_api_key and user.llm_base_url and user.llm_model)
    return {
        "api_key": _mask_key(user.llm_api_key) if is_custom else "",
        "base_url": user.llm_base_url or "",
        "model": user.llm_model or "",
        "is_custom": is_custom,
    }


@router.put("/{user_id}/llm")
async def update_llm_config(user_id: int, config: dict, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}

    api_key = config.get("api_key")
    base_url = config.get("base_url")
    model = config.get("model")

    if api_key is not None:
        user.llm_api_key = api_key if api_key else None
    if base_url is not None:
        user.llm_base_url = base_url if base_url else None
    if model is not None:
        user.llm_model = model if model else None

    await session.commit()
    await session.refresh(user)

    is_custom = bool(user.llm_api_key and user.llm_base_url and user.llm_model)
    return {
        "api_key": _mask_key(user.llm_api_key) if is_custom else "",
        "base_url": user.llm_base_url or "",
        "model": user.llm_model or "",
        "is_custom": is_custom,
    }


@router.post("/{user_id}/llm/test")
async def test_llm_config(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    api_key = user.llm_api_key if user else None
    base_url = user.llm_base_url if user else None
    model = user.llm_model if user else None

    if not (api_key and base_url and model):
        api_key = settings.LLM_API_KEY
        base_url = settings.LLM_BASE_URL
        model = settings.LLM_MODEL

    if not api_key:
        return {"success": False, "message": "未配置 API Key"}

    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "回复ok"}],
            max_tokens=10,
        )
        content = response.choices[0].message.content
        return {"success": True, "message": f"连接成功：{content}"}
    except Exception as e:
        return {"success": False, "message": f"连接失败：{str(e)[:200]}"}


@router.delete("/{user_id}/llm")
async def reset_llm_config(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}

    user.llm_api_key = None
    user.llm_base_url = None
    user.llm_model = None
    await session.commit()

    return {
        "api_key": "",
        "base_url": "",
        "model": "",
        "is_custom": False,
    }
