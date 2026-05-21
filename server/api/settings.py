import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI
from db.database import get_session
from db.models import User
from core.auth import get_current_user
from config import settings
from models.schemas import LLMConfigUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return key[:3] + "***" + key[-3:]


@router.get("/llm")
async def get_llm_config(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
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


@router.put("/llm")
async def update_llm_config(config: LLMConfigUpdate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}

    api_key = config.api_key
    base_url = config.base_url
    model = config.model

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


@router.post("/llm/test")
async def test_llm_config(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    user_api_key = user.llm_api_key if user else None
    user_base_url = user.llm_base_url if user else None
    user_model = user.llm_model if user else None

    api_key = user_api_key or settings.LLM_API_KEY
    base_url = user_base_url or settings.LLM_BASE_URL
    model = user_model or settings.LLM_MODEL

    if not api_key:
        return {"success": False, "message": "未配置 API Key，请先填写 API Key 并保存"}
    if not base_url:
        return {"success": False, "message": "未配置 Base URL，请先填写 Base URL 并保存"}
    if not model:
        return {"success": False, "message": "未配置 Model，请先填写 Model 并保存"}

    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "请回复ok"}],
            max_tokens=50,
        )
        content = response.choices[0].message.content or ""
        using_user = "自定义" if (user_api_key and user_base_url and user_model) else "全局默认"
        if content.strip():
            return {"success": True, "message": f"连接成功（{using_user}配置）：{content.strip()}"}
        return {"success": True, "message": f"连接成功（{using_user}配置）：API 已响应"}
    except Exception as e:
        error_msg = str(e)[:200]
        return {"success": False, "message": f"连接失败：{error_msg}"}


@router.delete("/llm")
async def reset_llm_config(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
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
