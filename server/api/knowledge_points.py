from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session
from core.auth import get_current_user
from db.models import User
from core.knowledge_graph import KNOWLEDGE_TREE, get_mastery

router = APIRouter()


@router.get("/tree/{subject}")
async def get_knowledge_tree(subject: str, current_user: User = Depends(get_current_user)):
    tree = KNOWLEDGE_TREE.get(subject)
    if not tree:
        return {"error": f"不支持的科目: {subject}"}
    return {"subject": subject, "tree": tree}


@router.get("/tree")
async def get_all_trees(current_user: User = Depends(get_current_user)):
    return KNOWLEDGE_TREE


@router.get("/mastery")
async def get_user_mastery(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    mastery = await get_mastery(current_user.id, session)
    return {"user_id": current_user.id, "mastery": mastery}
