import logging
from openai import OpenAI, AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from config import settings
from db.models import User

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个专业的考研备考AI助手。你的职责是：
1. 回答考研相关的学术问题（政治、英语、数学、专业课）
2. 提供备考策略和学习方法建议
3. 帮助分析知识点和考点
4. 给予心理支持和鼓励
5. 涉及数学公式时，使用LaTeX格式：行内公式用$...$，独立公式用$$...$$

回答要准确、有条理，适合考研备考使用。如果不确定，请诚实说明。"""

FALLBACK_MSG = "⚠️ 未配置 LLM API Key，请在设置页面配置后重试。"


def is_configured() -> bool:
    return bool(settings.LLM_API_KEY and settings.LLM_API_KEY not in ("", "your_api_key_here"))


def get_client() -> OpenAI:
    return OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)


def chat_completion(messages: list[dict], stream: bool = False):
    client = get_client()
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    return client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=all_messages,
        stream=stream,
    )


def chat_completion_sync(messages: list[dict]) -> str:
    if not is_configured():
        return FALLBACK_MSG
    response = chat_completion(messages, stream=False)
    return response.choices[0].message.content


def chat_completion_stream(messages: list[dict]):
    if not is_configured():
        yield FALLBACK_MSG
        return
    stream = chat_completion(messages, stream=True)
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def _get_user_llm_config(user_id: int, session: AsyncSession) -> dict:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    user_api_key = user.llm_api_key if user else None
    user_base_url = user.llm_base_url if user else None
    user_model = user.llm_model if user else None

    api_key = user_api_key or settings.LLM_API_KEY
    base_url = user_base_url or settings.LLM_BASE_URL
    model = user_model or settings.LLM_MODEL

    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "has_user_config": bool(user_api_key or user_base_url or user_model),
    }


async def chat_completion_for_user(messages: list[dict], user_id: int, session: AsyncSession) -> str:
    config = await _get_user_llm_config(user_id, session)
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    if not config["api_key"]:
        return FALLBACK_MSG

    try:
        client = AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"])
        response = await client.chat.completions.create(
            model=config["model"],
            messages=all_messages,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return f"⚠️ LLM 调用失败：{str(e)[:200]}"


async def chat_completion_stream_for_user(messages: list[dict], user_id: int, session: AsyncSession):
    config = await _get_user_llm_config(user_id, session)
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    if not config["api_key"]:
        yield FALLBACK_MSG
        return

    try:
        client = AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"])
        stream = await client.chat.completions.create(
            model=config["model"],
            messages=all_messages,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        logger.error(f"LLM stream failed: {e}")
        yield f"⚠️ LLM 调用失败：{str(e)[:200]}"
