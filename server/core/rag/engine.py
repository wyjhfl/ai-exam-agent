import os
import logging
from pathlib import Path
import chromadb

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", str(_PROJECT_ROOT / "data" / "chroma_db"))
COLLECTION_NAME = "exam_knowledge"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


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

    def index_document(self, doc_id: str, text: str, metadata: dict = None):
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

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        collection = self._get_collection()
        if collection.count() == 0:
            return []
        results = collection.query(query_texts=[query], n_results=min(top_k, collection.count()))
        items = []
        if results and results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                items.append({"text": doc, "metadata": meta, "distance": results["distances"][0][i] if results.get("distances") else None})
        return items

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
