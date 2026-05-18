import os
import re
import json
import logging
from pathlib import Path
import chromadb

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", str(_PROJECT_ROOT / "data" / "chroma_db"))
COLLECTION_NAME = "exam_knowledge"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
SEMANTIC_CHUNK_MAX = 800


class RAGEngine:
    def __init__(self):
        self._client = None
        self._collection = None

    def _get_collection(self):
        if self._collection is None:
            persist_dir = Path(CHROMA_PERSIST_DIR)
            persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(persist_dir))
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def _chunk_text(self, text: str) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + CHUNK_SIZE
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - CHUNK_OVERLAP
        return chunks

    def _semantic_chunk(self, text: str) -> list[str]:
        sections = re.split(r'\n(?=#{1,3}\s)', text)
        chunks = []
        current_header = ""

        for section in sections:
            section = section.strip()
            if not section:
                continue

            header_match = re.match(r'^(#{1,3}\s.+)', section)
            if header_match:
                current_header = header_match.group(1).strip()

            if len(section) <= SEMANTIC_CHUNK_MAX:
                if current_header and not section.startswith(current_header):
                    section = current_header + "\n" + section
                chunks.append(section)
            else:
                sub_chunks = re.split(r'[。\n]', section)
                buffer = current_header + "\n" if current_header and not section.startswith(current_header) else ""
                for sub in sub_chunks:
                    sub = sub.strip()
                    if not sub:
                        continue
                    if len(buffer) + len(sub) + 1 > SEMANTIC_CHUNK_MAX:
                        if buffer.strip():
                            chunks.append(buffer.strip())
                        buffer = sub
                    else:
                        buffer += ("\n" if buffer.endswith("\n") or not buffer else "。") + sub
                if buffer.strip():
                    chunks.append(buffer.strip())

        return [c for c in chunks if c.strip()]

    def index_document(self, doc_id: str, text: str, metadata: dict = None):
        chunks = self._semantic_chunk(text)
        if not chunks:
            chunks = self._chunk_text(text)
        if not chunks:
            return
        collection = self._get_collection()
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{**(metadata or {}), "doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
        existing = collection.get(ids=ids)
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
        collection.add(ids=ids, documents=chunks, metadatas=metadatas)
        logger.info(f"Indexed {len(chunks)} chunks for document {doc_id}")

    def index_document_with_count(self, doc_id: str, text: str, metadata: dict = None) -> int:
        chunks = self._semantic_chunk(text)
        if not chunks:
            chunks = self._chunk_text(text)
        if not chunks:
            return 0
        collection = self._get_collection()
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{**(metadata or {}), "doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
        existing = collection.get(ids=ids)
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
        collection.add(ids=ids, documents=chunks, metadatas=metadatas)
        logger.info(f"Indexed {len(chunks)} chunks for document {doc_id}")
        return len(chunks)

    def clear_collection(self):
        if self._client is not None:
            try:
                self._client.delete_collection(name=COLLECTION_NAME)
            except Exception:
                pass
        self._collection = None
        self._client = None

    def _expand_query(self, query: str) -> list[str]:
        try:
            from core.llm import chat_completion_sync
            prompt = f"请为以下搜索查询生成2个语义等价的搜索词，用换行分隔，只输出搜索词：\n{query}"
            response = chat_completion_sync([{"role": "user", "content": prompt}])
            expanded = [query]
            for line in response.strip().split("\n"):
                line = line.strip().lstrip("0123456789.-) ")
                if line and line != query:
                    expanded.append(line)
            return expanded[:3]
        except Exception as e:
            logger.warning(f"Query expansion failed: {e}")
            return [query]

    def _rerank(self, query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
        if len(candidates) <= top_k:
            return candidates
        try:
            from core.llm import chat_completion_sync
            numbered = ""
            for i, c in enumerate(candidates):
                numbered += f"{i+1}. {c['text'][:200]}\n"
            prompt = f"查询：{query}\n\n以下是从知识库中检索到的内容片段，请评估每个片段与查询的相关性（1-10分）：\n{numbered}\n请以JSON返回：{{\"scores\": [分数列表]}}"
            response = chat_completion_sync([{"role": "user", "content": prompt}])
            text = response.strip()
            if text.startswith("```"):
                m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
                if m:
                    text = m.group(1).strip()
            result = json.loads(text)
            scores = result.get("scores", [])
            if len(scores) == len(candidates):
                paired = list(zip(candidates, scores))
                paired.sort(key=lambda x: x[1], reverse=True)
                return [c for c, s in paired[:top_k]]
        except Exception as e:
            logger.warning(f"Reranking failed: {e}")
        return candidates[:top_k]

    def search(self, query: str, top_k: int = 3, enable_rerank: bool = True) -> list[dict]:
        collection = self._get_collection()
        if collection.count() == 0:
            return []

        all_results = {}
        if enable_rerank:
            queries = self._expand_query(query)
        else:
            queries = [query]

        for q in queries:
            try:
                results = collection.query(query_texts=[q], n_results=min(top_k * 2, collection.count()))
                if results and results["documents"] and results["documents"][0]:
                    for i, doc in enumerate(results["documents"][0]):
                        meta = results["metadatas"][0][i] if results["metadatas"] else {}
                        key = doc[:200]
                        if key not in all_results:
                            all_results[key] = {
                                "text": doc,
                                "metadata": meta,
                                "distance": results["distances"][0][i] if results.get("distances") else None,
                            }
            except Exception as e:
                logger.warning(f"Search query '{q}' failed: {e}")

        items = list(all_results.values())
        if enable_rerank and len(items) > top_k:
            items = self._rerank(query, items, top_k)

        return items[:top_k]

    def search_with_user(self, query: str, user_id: int = None, top_k: int = 5, enable_rerank: bool = True) -> list[dict]:
        global_results = self.search(query, top_k=top_k, enable_rerank=enable_rerank)
        user_results = []
        if user_id:
            collection = self._get_collection()
            try:
                user_res = collection.query(
                    query_texts=[query],
                    n_results=min(top_k, collection.count()) if collection.count() > 0 else 0,
                    where={"user_id": user_id},
                )
                if user_res and user_res["documents"] and user_res["documents"][0]:
                    for i, doc in enumerate(user_res["documents"][0]):
                        meta = user_res["metadatas"][0][i] if user_res["metadatas"] else {}
                        user_results.append({"text": doc, "metadata": meta, "distance": user_res["distances"][0][i] if user_res.get("distances") else None})
            except Exception as e:
                logger.warning(f"User-specific search failed: {e}")

        seen = set()
        merged = []
        for r in user_results + global_results:
            key = r["text"][:200]
            if key not in seen:
                seen.add(key)
                merged.append(r)
        return merged[:top_k]

    def remove_document(self, doc_id: str):
        collection = self._get_collection()
        try:
            all_data = collection.get(where={"doc_id": doc_id})
            if all_data and all_data["ids"]:
                collection.delete(ids=all_data["ids"])
                logger.info(f"Removed {len(all_data['ids'])} chunks for document {doc_id}")
        except Exception as e:
            logger.warning(f"Failed to remove document {doc_id}: {e}")

    def get_status(self) -> dict:
        collection = self._get_collection()
        all_meta = collection.get(include=["metadatas"])
        file_set = set()
        for m in (all_meta.get("metadatas") or []):
            if m and "filename" in m:
                file_set.add(m["filename"])
        return {
            "document_count": collection.count(),
            "collection_name": COLLECTION_NAME,
            "persist_dir": CHROMA_PERSIST_DIR,
            "files": sorted(file_set),
        }
