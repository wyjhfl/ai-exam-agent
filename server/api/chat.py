import json
import logging
from fastapi import APIRouter, Depends, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session, async_session
from db.models import ChatHistory, Conversation, User
from core.auth import get_current_user
from models.schemas import ChatRequest, ChatResponse, GuidedRequest
from core.llm import chat_completion_sync, chat_completion_stream, chat_completion_for_user, chat_completion_stream_for_user
from core.rag.engine import RAGEngine
from core.guided_tutor import GuidedTutor

logger = logging.getLogger(__name__)
router = APIRouter()
rag_engine = RAGEngine()


async def _ensure_conversation(user_id: int, conversation_id: int | None, message: str, session: AsyncSession) -> int | None:
    if conversation_id:
        result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv.id
    title = message[:20] + ("..." if len(message) > 20 else "")
    conv = Conversation(user_id=user_id, title=title)
    session.add(conv)
    await session.flush()
    return conv.id


async def _save_ai_message(user_id: int, content: str, sources: list = None, conversation_id: int = None):
    try:
        async with async_session() as db:
            ai_msg = ChatHistory(user_id=user_id, role="assistant", content=content, sources=sources or [], conversation_id=conversation_id)
            db.add(ai_msg)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to save AI message: {e}")


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    conv_id = await _ensure_conversation(current_user.id, request.conversation_id, request.message, session)

    user_msg = ChatHistory(user_id=current_user.id, role="user", content=request.message, conversation_id=conv_id)
    session.add(user_msg)
    await session.commit()

    history_msgs = [{"role": m.role, "content": m.content} for m in await _get_history(current_user.id, session, conversation_id=conv_id)]

    sources = []
    try:
        rag_results = rag_engine.search_with_user(request.message, user_id=current_user.id, top_k=5)
        if rag_results:
            context = "\n\n".join([r["text"] for r in rag_results])
            sources = [{"text": r["text"][:100], "metadata": r.get("metadata", {})} for r in rag_results]
            has_user_material = any(r.get("metadata", {}).get("user_id") for r in rag_results)
            prefix = "参考以下资料回答问题"
            if has_user_material:
                prefix = "参考以下资料回答问题（优先基于用户上传的教辅资料）"
            enhanced_msg = f"{prefix}：\n\n{context}\n\n学生问题：{request.message}"
            history_msgs.append({"role": "user", "content": enhanced_msg})
    except Exception as e:
        logger.warning(f"RAG search failed: {e}")

    try:
        ai_content = await chat_completion_for_user(history_msgs, current_user.id, session)
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        ai_content = f"⚠️ LLM 调用失败：{str(e)}"

    ai_msg = ChatHistory(user_id=current_user.id, role="assistant", content=ai_content, sources=sources, conversation_id=conv_id)
    session.add(ai_msg)
    await session.commit()

    return ChatResponse(response=ai_content, sources=sources, conversation_id=conv_id)


@router.get("/history")
async def get_history(conversation_id: int = None, limit: int = 50, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    messages = await _get_history(current_user.id, session, limit, conversation_id=conversation_id)
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources or [],
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "conversation_id": m.conversation_id,
        }
        for m in messages
    ]


@router.post("/stream")
async def stream_message(request: ChatRequest, http_request: Request, background_tasks: BackgroundTasks, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    conv_id = await _ensure_conversation(current_user.id, request.conversation_id, request.message, session)

    user_msg = ChatHistory(user_id=current_user.id, role="user", content=request.message, conversation_id=conv_id)
    session.add(user_msg)
    await session.commit()

    history_msgs = [{"role": m.role, "content": m.content} for m in await _get_history(current_user.id, session, conversation_id=conv_id)]

    try:
        rag_results = rag_engine.search_with_user(request.message, user_id=current_user.id, top_k=5)
        if rag_results:
            context = "\n\n".join([r["text"] for r in rag_results])
            has_user_material = any(r.get("metadata", {}).get("user_id") for r in rag_results)
            prefix = "参考以下资料回答问题"
            if has_user_material:
                prefix = "参考以下资料回答问题（优先基于用户上传的教辅资料）"
            enhanced_msg = f"{prefix}：\n\n{context}\n\n学生问题：{request.message}"
            history_msgs.append({"role": "user", "content": enhanced_msg})
    except Exception as e:
        logger.warning(f"RAG search failed: {e}")
        rag_results = []

    sources = []
    if rag_results:
        sources = [{"text": r["text"][:100], "metadata": r.get("metadata", {})} for r in rag_results]

    async def event_generator():
        if sources:
            sources_data = json.dumps({"type": "sources", "sources": sources}, ensure_ascii=False)
            yield f"data: {sources_data}\n\n"

        full_content = []
        try:
            async for chunk in chat_completion_stream_for_user(history_msgs, current_user.id, session):
                full_content.append(chunk)
                data = json.dumps({"type": "content", "content": chunk}, ensure_ascii=False)
                yield f"data: {data}\n\n"
        except Exception as e:
            logger.error(f"LLM stream failed: {e}")
            error_msg = f"⚠️ LLM 调用失败：{str(e)}"
            full_content.append(error_msg)
            data = json.dumps({"type": "content", "content": error_msg}, ensure_ascii=False)
            yield f"data: {data}\n\n"

        background_tasks.add_task(_save_ai_message, current_user.id, "".join(full_content), sources, conv_id)

        conv_id_data = json.dumps({"type": "conversation_id", "conversation_id": conv_id}, ensure_ascii=False)
        yield f"data: {conv_id_data}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def _get_history(user_id: int, session: AsyncSession, limit: int = 50, conversation_id: int = None) -> list[ChatHistory]:
    query = select(ChatHistory).where(ChatHistory.user_id == user_id)
    if conversation_id:
        query = query.where(ChatHistory.conversation_id == conversation_id)
    query = query.order_by(ChatHistory.created_at.desc()).limit(limit)
    result = await session.execute(query)
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


@router.post("/guided")
async def guided_teaching(request: GuidedRequest, http_request: Request, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    message = request.message
    user_id = current_user.id
    topic = request.topic
    hint_level = request.hint_level
    conversation_id = request.conversation_id

    conv_id = await _ensure_conversation(user_id, conversation_id, message or f"引导学习：{topic}", session)

    if not message and topic:
        response_text = GuidedTutor.generate_guided_question(user_id, topic)
        is_question = response_text.strip().endswith("？") or response_text.strip().endswith("?")
    elif hint_level and hint_level > 0 and topic:
        response_text = GuidedTutor.get_hint(user_id, topic, hint_level)
        is_question = True
    else:
        history_records = await _get_history(user_id, session, limit=10, conversation_id=conv_id)
        history = [
            {"role": m.role, "content": m.content}
            for m in history_records
            if m.role in ("user", "assistant") and m.sources is None
        ]
        result = GuidedTutor.evaluate_and_respond(user_id, topic, message, history)
        response_text = result["response"]
        is_question = result["is_question"]

    user_msg = ChatHistory(
        user_id=user_id,
        role="user",
        content=message or f"[引导学习] 请求关于「{topic}」的引导问题",
        sources=[{"chat_type": "guided"}],
        conversation_id=conv_id,
    )
    session.add(user_msg)

    ai_msg = ChatHistory(
        user_id=user_id,
        role="assistant",
        content=response_text,
        sources=[{"chat_type": "guided", "topic": topic}],
        conversation_id=conv_id,
    )
    session.add(ai_msg)
    await session.commit()

    return {
        "response": response_text,
        "is_question": is_question,
        "hint_available": hint_level < 3,
        "conversation_id": conv_id,
    }
