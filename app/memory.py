from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memory
from app.provider import NineRouter, ProviderError


async def retrieve_memories(session: AsyncSession, provider: NineRouter, query: str, limit: int) -> list[str]:
    try:
        vector = await provider.embed(query)
    except ProviderError:
        rows = (await session.scalars(select(Memory).order_by(Memory.created_at.desc()).limit(limit))).all()
        return [row.content for row in reversed(rows)]
    statement = (
        select(Memory)
        .where(Memory.embedding.is_not(None), func.vector_dims(Memory.embedding) == len(vector))
        .order_by(Memory.embedding.cosine_distance(vector))
        .limit(limit)
    )
    rows = (await session.scalars(statement)).all()
    return [row.content for row in rows]


async def store_memory(
    session: AsyncSession, provider: NineRouter, content: str, conversation_id: str
) -> None:
    vector = None
    try:
        vector = await provider.embed(content)
    except ProviderError:
        pass
    session.add(Memory(
        conversation_id=conversation_id,
        content=content,
        embedding=vector,
        embedding_model=provider.embedding_model if vector else None,
    ))
