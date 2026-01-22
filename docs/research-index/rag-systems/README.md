# RAG Systems

**Purpose**: Document parsing, embedding, retrieval systems for knowledge augmentation

## Overview

RAG (Retrieval-Augmented Generation) systems provide external knowledge to AI models. This category tracks vector databases, document parsers, embedding systems, and retrieval frameworks for Borg's RAG capabilities.

## Known RAG Systems

### Frameworks

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| LlamaIndex | https://github.com/run-llama/llama_index | 📖 Fully Researched | RAG framework |
| LlamaIndex Developers | https://developers.llamaindex.ai/ | 📖 Fully Researched | Docs |
| LangChain | https://github.com/langchain-ai/langchain | 📖 Fully Researched | Agent/RAG framework |
| LangGraph | https://www.langchain.com/langgraph | 📖 Fully Researched | Agent framework |
| Haystack | https://github.com/deepset-ai/haystack | 📖 Fully Researched | NLP framework |
| Instructor | https://github.com/jxnl/instructor | 📖 Fully Researched | Data validation |

### Vector Databases

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| Pinecone | https://www.pinecone.io/lp/get-vector-database/ | ❓ Not Started | Managed vector DB |
| Qdrant | https://qdrant.tech/ | 📖 Fully Researched | Vector DB |
| Chroma | https://www.trychroma.com/ | 📖 Fully Researched | Vector DB |
| Weaviate | https://github.com/weaviate/weaviate | 📖 Fully Researched | Vector DB |
| Milvus | https://github.com/milvus-io/milvus | 📖 Fully Researched | Vector DB |
| Orama | https://github.com/oramasearch/orama | 📖 Fully Researched | JS vector DB |
| pgvector | https://github.com/pgvector/pgvector | 📖 Fully Researched | Postgres vector extension |

### RAG Services

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| RAGie | https://www.ragie.ai/ | ❓ Not Started | RAG service |
| MindsDB | https://github.com/mindsdb/mindsdb | 📖 Fully Researched | AI database |
| Ragie | https://www.ragie.ai/ | ❓ Not Started | RAG platform |
| Vectorize UI | https://github.com/medright/vectorize-ui | ❓ Not Started | Vector UI |

### Document Processing

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| Docling | https://github.com/DS4SD/docling | 📖 Fully Researched | Document parsing |
| PageIndex | https://github.com/VectifyAI/PageIndex | ❓ Not Started | Vision RAG |
| WeKnora | https://github.com/Tencent/WeKnora | ❓ Not Started | Knowledge engine |

### Notebooks & Research

| Repository | URL | Status | Notes |
|------------|-----|--------|-------|
| NotebookLM | https://notebooklm.google/ | ❓ Not Started | Google's notebook |
| NotebookLM Docs | https://blog.google/technology/developers/file-search/ | ❓ Not Started | File search docs |
| notebooklm-mcp | https://github.com/roomi-fields/notebooklm-mcp | 📖 Fully Researched | NotebookLM MCP |

---

## Integration Strategy

1. **Add as submodules** for reference
2. **Study RAG architectures** (chunking, embedding, retrieval)
3. **Implement document ingestion** (PDF, web, code)
4. **Create embedding pipeline** with multiple models
5. **Build semantic search** across all documents
6. **Add OCR capabilities** for scanned docs
7. **Implement Google Docs/Drive integration**

---

## Borg RAG Architecture

Borg should provide:
- **Multi-format ingestion**: PDF, DOCX, web pages, code, images
- **OCR**: Text extraction from images/PDFs
- **Smart chunking**: Semantic-aware document splitting
- **Multiple embedding models**: Configurable per use case
- **Vector search**: Fast semantic retrieval
- **Hybrid search**: Vector + keyword
- **Reranking**: Reorder results for relevance
- **Google integration**: Docs, Drive, Gmail
- **NotebookLM parity**: Similar features
- **Local-first**: All processing on local machine

---

## Research Tasks

- [ ] Study LlamaIndex architecture
- [ ] Research chunking strategies
- [ ] Analyze embedding model options
- [ ] Study document parsers (Docling)
- [ ] Research OCR capabilities
- [ ] Study NotebookLM features
- [ ] Analyze MindsDB integration
- [ ] Design ingestion pipeline
- [ ] Build vector search system
- [ ] Implement Google integrations

---

## Related

- [Memory Systems](../memory-systems/README.md)
- [Code Indexing](../code-indexing/README.md)
