# AI Exam Agent - 考研备考智能体

AI 驱动的考研备考桌面应用，基于 Tauri 2.0 + React + Python FastAPI 构建，支持政治/英语/数学三科备考。

**当前版本：v0.6.0**

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
| 知识库 RAG | ChromaDB 本地向量检索，13 个考研知识文档增强 |
| 多用户系统 | 注册/登录，数据按用户隔离，支持多人共用 |
| 数据导出 | 错题本和学习总结导出 Excel |
| 番茄专注 | 番茄钟计时器，今日专注统计 |
| 应用更新 | 启动时自动检查更新，Sidebar 手动检查 |
| 文件上传 | 上传 PDF/DOCX/TXT 教辅资料，自动提取文本并分块索引 |
| AI 学习指导 | 基于上传资料生成学习计划、讲解知识点、解答题目 |
| 云端同步 | 多设备数据同步（上传/下载/全量合并），登录自动同步 |
| 社区论坛 | 分享错题和备考经验，帖子点赞、评论、筛选 |
| 多题型支持 | 单选/多选/判断/填空/简答 5 种题型，AI 智能出题 |
| 模拟考试 | 计时组卷、题号导航、成绩报告、错题自动收录 |
| 知识点掌握度 | 三科知识点树 + 掌握度追踪（红/黄/绿三色标记） |
| 在线资源搜索 | DuckDuckGo 搜索考研资料，一键下载索引 |
| 苏格拉底引导教学 | 引导式提问、3 级提示、不直接给答案 |
| RAG 语义增强 | 语义切分、查询扩展、LLM 重排序 |
| 数学公式渲染 | KaTeX 渲染行内/独立公式，暗色模式适配 |
| 学习提醒 | 待复习错题提醒、活跃计划提醒、Sidebar badge |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.0 |
| 前端 | React 19 + TypeScript + Vite 8 |
| UI | Tailwind CSS v4 + shadcn/ui + sonner (Toast) |
| 状态管理 | Zustand |
| 路由 | React Router DOM v7 |
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
│   │   ├── layout/         # Sidebar + LoginForm
│   │   └── ui/             # shadcn/ui 组件
│   ├── pages/              # 11 个页面
│   │   ├── HomePage        # 首页仪表盘
│   │   ├── ChatPage        # AI 对话
│   │   ├── QuizPage        # 刷题训练
│   │   ├── PlanPage        # 备考规划
│   │   ├── AnalysisPage    # 学情分析
│   │   ├── WritingPage     # 作文批改
│   │   ├── FocusPage       # 番茄专注
│   │   ├── MaterialsPage   # 资料管理
│   │   ├── CommunityPage   # 社区论坛
│   │   └── KnowledgePage   # 知识点体系
│   ├── stores/             # Zustand (chatStore, userStore, appStore, syncStore)
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
│   │   ├── user.py         # 用户注册/登录
│   │   ├── focus.py        # 番茄专注
│   │   ├── export.py       # 数据导出 (Excel)
│   │   ├── uploads.py      # 文件上传管理
│   │   ├── guidance.py     # AI 学习指导
│   │   ├── sync.py         # 云端数据同步
│   │   ├── community.py    # 社区论坛
│   │   ├── knowledge_points.py # 知识点体系
│   │   ├── resources.py    # 在线资源搜索
│   │   ├── reminders.py    # 学习提醒
│   │   ├── search.py       # 全局搜索
│   │   ├── settings.py     # 用户 LLM 配置
│   │   ├── streak.py       # 学习打卡
│   │   └── exception_handler.py  # 统一异常处理
│   ├── core/               # AI 核心逻辑
│   │   ├── llm.py          # LLM 调用封装
│   │   ├── rag/            # RAG 引擎 (ChromaDB)
│   │   ├── planner/        # 智能规划引擎
│   │   ├── quiz/           # 题目引擎 (AI 出题)
│   │   ├── writing_evaluator.py  # 作文批改引擎
│   │   ├── spaced_repetition.py  # SM-2 间隔重复
│   │   ├── document_processor.py # 文档解析 (PDF/DOCX/TXT)
│   │   ├── study_guide.py  # AI 学习指导引擎
│   │   ├── knowledge_graph.py # 知识点树 + 掌握度
│   │   └── guided_tutor.py # 苏格拉底引导教学
│   ├── db/                 # 数据库层
│   │   ├── database.py     # 异步引擎 + 会话
│   │   └── models.py       # SQLAlchemy 模型
│   ├── models/             # Pydantic schemas
│   ├── prompts/            # Prompt 模板
│   ├── config.py           # 统一配置 (pydantic-settings)
│   └── scripts/            # 数据初始化脚本
├── data/                   # 运行时数据
│   ├── knowledge-base/     # 考研知识文档 (13 个 Markdown)
│   └── chroma_db/          # ChromaDB 向量索引
└── docs/                   # 项目文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.11
- Rust >= 1.77（Tauri 2.0 要求）
- Visual Studio Build Tools（Windows，C++ 桌面开发工作负载）

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

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

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

## Docker 部署

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

后端将在 `http://localhost:8000` 启动，数据持久化到 `./data` 目录。

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | 空（必须配置） |
| `LLM_BASE_URL` | LLM API 地址 | `https://token-plan-cn.xiaomimimo.com/v1` |
| `LLM_MODEL` | 模型名称 | `mimo-v2.5` |
| `DATABASE_DIR` | SQLite 数据目录 | `../data` |
| `CHROMA_PERSIST_DIR` | ChromaDB 持久化目录 | `../data/chroma_db` |
| `KNOWLEDGE_BASE_DIR` | 知识库文档目录 | `../data/knowledge-base` |

> 所有配置统一由 `server/config.py` 管理（pydantic-settings），支持 `.env` 文件和环境变量。

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
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
| POST | `/api/knowledge/index` | 建立知识库索引 |
| POST | `/api/knowledge/reindex` | 重建知识库索引 |
| GET | `/api/knowledge/status` | 知识库状态 |
| POST | `/api/focus/start` | 开始专注 |
| POST | `/api/focus/complete` | 完成专注 |
| GET | `/api/focus/today/{user_id}` | 今日专注统计 |
| GET | `/api/export/{user_id}/wrong-questions/excel` | 导出错题本 Excel |
| GET | `/api/export/{user_id}/study-summary/excel` | 导出学习总结 Excel |
| POST | `/api/uploads/upload` | 上传教辅资料 |
| GET | `/api/uploads/{user_id}` | 获取上传列表 |
| DELETE | `/api/uploads/{user_id}/{file_id}` | 删除上传文件 |
| POST | `/api/uploads/{user_id}/{file_id}/reindex` | 重新索引文件 |
| POST | `/api/guidance/study-plan` | AI 生成学习计划 |
| POST | `/api/guidance/explain` | AI 讲解知识点 |
| POST | `/api/guidance/solve` | AI 解答题目 |
| POST | `/api/sync/upload` | 上传数据到云端 |
| POST | `/api/sync/download` | 从云端下载数据 |
| POST | `/api/sync/full` | 全量同步 |
| GET | `/api/sync/status/{user_id}` | 同步状态 |
| POST | `/api/community/share` | 分享内容到社区 |
| GET | `/api/community/posts` | 获取社区帖子列表 |
| GET | `/api/community/posts/{id}` | 获取帖子详情 |
| POST | `/api/community/posts/{id}/like` | 点赞 |
| POST | `/api/community/posts/{id}/comment` | 评论 |
| GET | `/api/community/posts/{id}/comments` | 获取评论列表 |
| POST | `/api/community/share-wrong/{wrong_id}` | 一键分享错题 |
| GET | `/api/knowledge-points/tree` | 获取全部知识点树 |
| GET | `/api/knowledge-points/tree/{subject}` | 获取科目知识点树 |
| GET | `/api/knowledge-points/{user_id}/mastery` | 获取用户掌握度 |
| POST | `/api/quiz/mock-exam` | 开始模拟考试 |
| POST | `/api/quiz/mock-exam/{exam_id}/submit` | 提交模拟考试 |
| GET | `/api/resources/search` | 搜索在线资源 |
| POST | `/api/resources/download` | 下载并索引资源 |
| POST | `/api/resources/generate-from-url` | 从 URL 生成题目 |
| POST | `/api/chat/guided` | 苏格拉底引导教学 |
| GET | `/api/reminders/{user_id}` | 获取学习提醒 |

## 数据库

SQLite 本地数据库，包含以下表：

- `users` — 用户信息（含密码哈希）
- `chat_histories` — 对话历史（含 RAG sources）
- `study_plans` — 学习计划
- `quiz_questions` — 题目库
- `quiz_records` — 答题记录
- `wrong_questions` — 错题本（含 SM-2 间隔重复字段）
- `study_sessions` — 学习记录
- `user_uploads` — 用户上传文件
- `shared_items` — 社区分享内容
- `comments` — 社区评论
- `mock_exams` — 模拟考试记录

## 更新日志

### v0.6.0

- 模拟考试历史记录与回顾
- 全局搜索（Ctrl+K），支持搜索题目、对话、资料
- 学习打卡连续天数追踪
- 用户自定义 LLM API 配置（支持 OpenAI 兼容接口）
- 代码质量优化：PyPDF2→pypdf、pydantic ConfigDict 迁移
- 修复错题本 N+1 查询问题
- 补充 settings/streak/search 测试

### v0.5.0

**新功能：**
- 新增错题智能练习（基于薄弱知识点自适应出题，AI 分析正确率 < 70% 的 topic 优先出题）
- 新增薄弱知识点分析（按 topic 聚合正确率，返回 Top 5 薄弱知识点）
- 新增错题导出 PDF（reportlab 生成 A4 排版，中文字体，分页+页脚）
- 新增学习周报（AI 生成周度摘要 + 3 条改进建议 + 下周重点方向）
- 新增周报页面（WeeklyReportPage，统计卡片+各科对比+AI摘要+薄弱知识点）

**工程化改进：**
- 后端日志系统（RotatingFileHandler 10MB 轮转 + 请求日志中间件）
- 前端 ErrorBoundary 错误边界（渲染崩溃时显示友好界面 + 重试按钮）
- 自动化测试补充（pytest 后端 15 个 + vitest 前端 29 个 = 44 个测试用例）
- CI 流水线（GitHub Actions：前端 vitest + 后端 pytest）
- 部署配置（Dockerfile + docker-compose + .env.example + requirements.txt）
- 数据库索引优化（QuizQuestion/QuizRecord/WrongQuestion/ChatHistory 关键字段）
- 前端性能优化（React.lazy 路由懒加载 + 组件拆分 + useMemo 缓存）
- N+1 查询修复（get_wrong_questions 改为 JOIN 查询）

**Bug 修复：**
- 修复资源下载/生成端点返回 error dict 而非 HTTPException
- 修复 mockTimer useEffect 依赖导致的重渲染
- 修复引导对话历史误排除正常消息
- 修复 HomePage reminders[0] 空数组访问风险
- 修复 formatMarkdown XSS 风险（新增 sanitizeHtml）
- 版本号统一更新至 0.5.0

### v0.4.0

- 新增多题型支持（单选/多选/判断/填空/简答 5 种题型，AI 智能出题）
- 新增模拟考试（计时组卷、题号导航、成绩报告、错题自动收录）
- 新增知识点掌握度追踪（三科知识点树 + 红/黄/绿三色标记）
- 新增在线资源搜索与下载（DuckDuckGo 搜索、一键下载索引、从 URL 生成题目）
- 新增苏格拉底式引导教学（引导式提问、3 级提示系统、不直接给答案）
- 新增 RAG 语义增强（语义切分、查询扩展、LLM 重排序）
- 新增数学公式渲染（KaTeX 渲染行内/独立公式，暗色模式适配）
- 新增学习提醒系统（待复习错题提醒、活跃计划提醒、Sidebar badge）
- LLM System Prompt 新增 LaTeX 公式格式规则
- 共享 formatMarkdown/renderLatex 工具函数（src/lib/format.ts）
- 版本号统一更新至 0.4.0

### v0.3.0

- 新增云端数据同步（上传/下载/全量合并，按 updated_at 时间戳合并策略）
- 新增社区论坛（分享错题和备考经验，帖子 CRUD + 点赞 + 评论 + 筛选分页）
- 新增文件上传管理（PDF/DOCX/TXT 上传、自动文本提取分块、ChromaDB 索引）
- 新增 AI 学习指导（基于上传资料生成学习计划、讲解知识点、解答题目）
- 新增资料管理页面（MaterialsPage，上传/删除/重新索引教辅资料）
- 新增社区页面（CommunityPage，发帖/浏览/评论/点赞）
- 新增同步状态管理（syncStore，登录自动同步 + Sidebar 同步状态显示）
- 新增错题本"分享到社区"一键分享功能
- RAG 引擎支持按用户检索（search_with_user）和文档删除（remove_document）
- ChatPage 新增"讲解知识点"和"解答题目"快捷按钮
- PlanPage 新增"基于教辅生成计划"选项
- Sidebar 新增社区导航项和同步状态区域
- 版本号统一更新至 0.3.0

### v0.2.0

- 新增 10 个考研知识库文件（政治 4 个、英语 3 个、数学 3 个），知识库扩充至 13 个文件
- 新增多用户注册/登录系统（SHA256 密码哈希、localStorage 会话持久化）
- 新增数据导出功能（错题本 Excel、学习总结 Excel）
- 新增知识库重新索引功能（POST /api/knowledge/reindex）
- 新增知识库状态面板（文件列表、文档块数、可折叠显示）
- 新增应用更新检查占位（Sidebar 版本号 + 检查更新按钮）
- 新增 Tauri updater 插件集成
- 所有页面 userId 统一从 userStore 获取，数据按用户隔离
- 未登录时显示登录/注册表单覆盖层
- 版本号统一更新至 0.2.0

### v0.1.0

- 初始版本发布
- AI 对话问答（RAG + 流式输出）
- 刷题训练 + AI 智能出题
- 错题本（SM-2 间隔重复算法）
- 备考规划（LLM 生成）
- 学情分析看板
- 英语作文 AI 批改
- 番茄专注计时器
- 暗色模式 + Toast 通知
- 统一配置管理 + 统一异常处理

## License

MIT
