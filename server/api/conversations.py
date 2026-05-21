import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import Conversation, ChatHistory, User
from core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_conversations(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()

    items = []
    for c in conversations:
        count_result = await session.execute(
            select(func.count(ChatHistory.id)).where(ChatHistory.conversation_id == c.id)
        )
        message_count = count_result.scalar() or 0

        last_msg_result = await session.execute(
            select(ChatHistory.created_at)
            .where(ChatHistory.conversation_id == c.id)
            .order_by(ChatHistory.created_at.desc())
            .limit(1)
        )
        last_message_at = last_msg_result.scalar_one_or_none()

        items.append({
            "id": c.id,
            "title": c.title,
            "chat_mode": c.chat_mode,
            "message_count": message_count,
            "last_message_at": last_message_at.isoformat() if last_message_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return items


@router.post("")
async def create_conversation(request: dict = None, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    request = request or {}
    conversation = Conversation(
        user_id=user_id,
        title=request.get("title", "新对话"),
        chat_mode=request.get("chat_mode", "normal"),
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title,
        "chat_mode": conversation.chat_mode,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
    }


@router.get("/detail/{conversation_id}")
async def get_conversation_detail(conversation_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_result = await session.execute(
        select(ChatHistory)
        .where(ChatHistory.conversation_id == conversation_id)
        .order_by(ChatHistory.created_at.asc())
    )
    messages = msg_result.scalars().all()

    return {
        "id": conversation.id,
        "title": conversation.title,
        "chat_mode": conversation.chat_mode,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "sources": m.sources or [],
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.put("/{conversation_id}")
async def update_conversation(conversation_id: int, request: dict, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if "title" in request:
        conversation.title = request["title"]
    await session.commit()

    return {
        "id": conversation.id,
        "title": conversation.title,
        "chat_mode": conversation.chat_mode,
    }


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await session.delete(conversation)
    await session.commit()
    return {"status": "ok", "deleted_conversation_id": conversation_id}
