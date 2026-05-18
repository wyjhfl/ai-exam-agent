import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import SharedItem, Comment, WrongQuestion, User
from models.schemas import CommunityShareRequest, CommunityCommentRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/share")
async def share_content(request: CommunityShareRequest, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    item = SharedItem(
        user_id=request.user_id,
        title=request.title,
        content=request.content,
        item_type=request.item_type,
        subject=request.subject,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return {"id": item.id, "title": item.title, "item_type": item.item_type, "subject": item.subject}


@router.get("/posts")
async def get_posts(
    subject: str = Query(None),
    type: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    query = select(SharedItem).order_by(SharedItem.created_at.desc())
    count_query = select(func.count()).select_from(SharedItem)

    if subject:
        query = query.where(SharedItem.subject == subject)
        count_query = count_query.where(SharedItem.subject == subject)
    if type:
        query = query.where(SharedItem.item_type == type)
        count_query = count_query.where(SharedItem.item_type == type)

    total = (await session.execute(count_query)).scalar() or 0
    query = query.offset((page - 1) * limit).limit(limit)
    result = await session.execute(query)
    items = result.scalars().all()

    posts = []
    for item in items:
        user = await session.get(User, item.user_id)
        comment_count = (await session.execute(
            select(func.count()).select_from(Comment).where(Comment.shared_item_id == item.id)
        )).scalar() or 0
        posts.append({
            "id": item.id,
            "user_id": item.user_id,
            "username": user.username if user else "未知",
            "title": item.title,
            "content": item.content[:200] + ("..." if len(item.content) > 200 else ""),
            "item_type": item.item_type,
            "subject": item.subject,
            "likes": item.likes,
            "comment_count": comment_count,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        })

    return {"posts": posts, "total": total, "page": page, "limit": limit}


@router.get("/posts/{post_id}")
async def get_post_detail(post_id: int, session: AsyncSession = Depends(get_session)):
    item = await session.get(SharedItem, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="帖子不存在")

    user = await session.get(User, item.user_id)
    comments_result = await session.execute(
        select(Comment).where(Comment.shared_item_id == post_id).order_by(Comment.created_at)
    )
    comments = comments_result.scalars().all()

    comment_list = []
    for c in comments:
        c_user = await session.get(User, c.user_id)
        comment_list.append({
            "id": c.id,
            "user_id": c.user_id,
            "username": c_user.username if c_user else "未知",
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {
        "id": item.id,
        "user_id": item.user_id,
        "username": user.username if user else "未知",
        "title": item.title,
        "content": item.content,
        "item_type": item.item_type,
        "subject": item.subject,
        "likes": item.likes,
        "comments": comment_list,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.post("/posts/{post_id}/like")
async def like_post(post_id: int, session: AsyncSession = Depends(get_session)):
    item = await session.get(SharedItem, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="帖子不存在")
    item.likes = (item.likes or 0) + 1
    await session.commit()
    return {"id": item.id, "likes": item.likes}


@router.post("/posts/{post_id}/comment")
async def add_comment(post_id: int, request: CommunityCommentRequest, session: AsyncSession = Depends(get_session)):
    item = await session.get(SharedItem, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="帖子不存在")

    user = await session.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    comment = Comment(
        user_id=request.user_id,
        shared_item_id=post_id,
        content=request.content,
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return {"id": comment.id, "content": comment.content, "username": user.username}


@router.get("/posts/{post_id}/comments")
async def get_comments(post_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Comment).where(Comment.shared_item_id == post_id).order_by(Comment.created_at)
    )
    comments = result.scalars().all()

    comment_list = []
    for c in comments:
        user = await session.get(User, c.user_id)
        comment_list.append({
            "id": c.id,
            "user_id": c.user_id,
            "username": user.username if user else "未知",
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {"comments": comment_list}


@router.post("/share-wrong/{wrong_id}")
async def share_wrong_question(wrong_id: int, session: AsyncSession = Depends(get_session)):
    from db.models import QuizQuestion

    wq = await session.get(WrongQuestion, wrong_id)
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")

    question = await session.get(QuizQuestion, wq.question_id) if wq.question_id else None
    title = f"错题分享：{question.subject if question else '未知科目'}"
    content_parts = []
    if question:
        content_parts.append(f"**题目：** {question.question_text}")
        if question.options:
            opts = question.options if isinstance(question.options, list) else []
            for i, opt in enumerate(opts):
                content_parts.append(f"  {chr(65+i)}. {opt}")
        content_parts.append(f"\n**正确答案：** {question.answer}")
        if question.explanation:
            content_parts.append(f"\n**解析：** {question.explanation}")

    content = "\n".join(content_parts) if content_parts else "（无内容）"

    item = SharedItem(
        user_id=wq.user_id,
        title=title,
        content=content,
        item_type="wrong_question",
        subject=question.subject if question else None,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return {"id": item.id, "title": item.title, "item_type": item.item_type}
