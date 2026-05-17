from openai import OpenAI
from config import settings

SYSTEM_PROMPT = """你是一个专业的考研备考AI助手。你的职责是：
1. 回答考研相关的学术问题（政治、英语、数学、专业课）
2. 提供备考策略和学习方法建议
3. 帮助分析知识点和考点
4. 给予心理支持和鼓励

回答要准确、有条理，适合考研备考使用。如果不确定，请诚实说明。"""

FALLBACK_MSG = "⚠️ 未配置 LLM API Key，请在 server/.env 中设置 LLM_API_KEY 后重试。"


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
