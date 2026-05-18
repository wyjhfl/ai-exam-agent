from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session
from core.knowledge_graph import KNOWLEDGE_TREE, get_mastery

router = APIRouter()


@router.get("/tree/{subject}")
async def get_knowledge_tree(subject: str):
    tree = KNOWLEDGE_TREE.get(subject)
    if not tree:
        return {"error": f"不支持的科目: {subject}"}
    return {"subject": subject, "tree": tree}


@router.get("/tree")
async def get_all_trees():
    return KNOWLEDGE_TREE


@router.get("/{user_id}/mastery")
async def get_user_mastery(user_id: int, session: AsyncSession = Depends(get_session)):
    mastery = await get_mastery(user_id, session)
    return {"user_id": user_id, "mastery": mastery}
