# AI Exam Agent - 考研备考智能体

AI 驱动的考研备考桌面应用，基于 Tauri 2.0 + React + Python FastAPI 构建，支持政治/英语/数学三科备考。

## 功能概览

| 功能 | 说明 |
|------|------|
| AI 对话问答 | 基于 RAG 的考研知识问答，流式输出，支持知识溯源 |
| 智能备考规划 | 输入目标院校和当前水平，LLM 生成个性化复习计划 |
| 刷题训练 | 预置题库 + AI 智能出题，支持数学/英语/政治三科 |
| 错题本 | 自动记录错题，SM-2 间隔重复算法智能安排复习 |
| 作文批改 | 英语作文 AI 批改（语法/词汇/结构/改进版本），政治论述题评分 |
| 学情分析 | 答题统计、各科正确率、7 天趋势图 |
| 暗色模式 | 支持 light/dark/system 三种主题 |
| 知识库 RAG | ChromaDB 本地向量检索，考研大纲知识增强 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.0 |
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS v4 + shadcn/ui + sonner (Toast) |
| 状态管理 | Zustand |
| 路由 | React Router DOM v6 |
| 后端 | Python FastAPI + Uvicorn |
| ORM | SQLAlchemy 2.0 (async) + aiosqlite |
| 向量数据库 | ChromaDB（本地嵌入式） |
| 本地存储 | SQLite |
| LLM | 小米 MiMo (兼容 OpenAI SDK) |
| 配置管理 | pydantic-settings + python-dotenv |

## 项目结构

```
ai-exam-agent/
├── src-tauri/              # Tauri Rust 后端
├── src/                    # React 前端
│   ├── components/
│   │   ├── layout/         # Sidebar + MainLayout
│   │   └── ui/             # shadcn/ui 组件
│   ├── pages/              # 6 个页面
│   │   ├── HomePage        # 首页仪表盘
│   │   ├── ChatPage        # AI 对话
│   │   ├── QuizPage        # 刷题训练
│   │   ├── PlanPage        # 备考规划
│   │   ├── AnalysisPage    # 学情分析
│   │   └── WritingPage     # 作文批改
│   ├── stores/             # Zustand (chatStore, userStore, appStore)
│   ├── services/           # API 调用层 (axios + 拦截器)
│   └── lib/                # 工具库
├── server/                 # Python FastAPI 后端
│   ├── api/                # 路由层
│   │   ├── chat.py         # 对话 (SSE 流式)
│   │   ├── quiz.py         # 刷题 + AI 出题
│   │   ├── writing.py      # 作文批改
│   │   ├── plan.py         # 备考规划
│   │   ├── analysis.py     # 学情分析
│   │   ├── knowledge.py    # 知识库管理
│   │   ├── user.py         # 用户管理
│   │   └── exception_handler.py  # 统一异常处理
│   ├── core/               # AI 核心逻辑
│   │   ├── llm.py          # LLM 调用封装
│   │   ├── rag/            # RAG 引擎 (ChromaDB)
│   │   ├── planner/        # 智能规划引擎
│   │   ├── quiz/           # 题目引擎 (AI 出题)
│   │   ├── writing_evaluator.py  # 作文批改引擎
│   │   └── spaced_repetition.py  # SM-2 间隔重复
│   ├── db/                 # 数据库层
│   │   ├── database.py     # 异步引擎 + 会话
│   │   └── models.py       # SQLAlchemy 模型
│   ├── models/             # Pydantic schemas
│   ├── prompts/            # Prompt 模板
│   ├── config.py           # 统一配置 (pydantic-settings)
│   └── scripts/            # 数据初始化脚本
├── data/                   # 运行时数据
│   ├── knowledge-base/     # 考研知识文档 (Markdown)
│   └── chroma_db/          # ChromaDB 向量索引
└── docs/                   # 项目文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- Rust >= 1.77（Tauri 2.0 要求）
- Python >= 3.10

### 1. 前端

```bash
npm install
npm run dev
```

### 2. 后端

```bash
cd server
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. 配置环境变量

在 `server/` 目录下创建 `.env` 文件：

```env
LLM_API_KEY=你的API密钥
LLM_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro
```

> 如果系统环境变量中已有同名变量（如 `LLM_BASE_URL`），项目会优先使用 `.env` 中的值（`load_dotenv(override=True)`）。

### 4. 启动后端

```bash
cd server
uvicorn main:app --reload --port 8000
```

### 5. 启动桌面应用

```bash
npm run tauri dev
```

### 6. 初始化题库（可选）

```bash
cd server
python scripts/seed_quiz.py
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | 空（必须配置） |
| `LLM_BASE_URL` | LLM API 地址 | `https://token-plan-cn.xiaomimimo.com/v1` |
| `LLM_MODEL` | 模型名称 | `mimo-v2.5-pro` |
| `DATABASE_DIR` | SQLite 数据目录 | `../data` |
| `CHROMA_PERSIST_DIR` | ChromaDB 持久化目录 | `../data/chroma_db` |
| `KNOWLEDGE_BASE_DIR` | 知识库文档目录 | `../data/knowledge-base` |

> 所有配置统一由 `server/config.py` 管理（pydantic-settings），支持 `.env` 文件和环境变量。

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/stream` | AI 对话（SSE 流式） |
| GET | `/api/chat/history/{user_id}` | 对话历史 |
| GET | `/api/quiz/questions` | 获取题目列表 |
| POST | `/api/quiz/generate` | AI 智能出题 |
| POST | `/api/quiz/answer` | 提交答案 |
| GET | `/api/quiz/wrong/{user_id}` | 错题本 |
| POST | `/api/quiz/wrong/{id}/master` | 标记已掌握 |
| GET | `/api/quiz/review/{user_id}` | 待复习错题 |
| POST | `/api/quiz/review/{wrong_id}/answer` | 复习答题 |
| POST | `/api/writing/evaluate` | 作文批改 |
| GET | `/api/writing/history/{user_id}` | 批改历史 |
| POST | `/api/plan/generate` | 生成备考规划 |
| GET | `/api/plan/{user_id}` | 获取规划 |
| GET | `/api/analysis/{user_id}/overview` | 学情分析总览 |
| GET | `/api/analysis/{user_id}/subject-stats` | 各科统计 |
| GET | `/api/analysis/{user_id}/trend` | 7 天趋势 |
| POST | `/api/knowledge/index` | 重建知识库索引 |
| GET | `/api/knowledge/status` | 知识库状态 |

## 数据库

SQLite 本地数据库，包含以下表：

- `users` — 用户信息
- `chat_histories` — 对话历史（含 RAG sources）
- `study_plans` — 学习计划
- `quiz_questions` — 题目库
- `quiz_records` — 答题记录
- `wrong_questions` — 错题本（含 SM-2 间隔重复字段）
- `study_sessions` — 学习记录

## License

MIT
