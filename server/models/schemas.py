from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    conversation_id: int | None = None


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    conversation_id: int | None = None


class UserCreate(BaseModel):
    username: str = "default"


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str
    target_school: str | None = None
    target_major: str | None = None


class TokenResponse(BaseModel):
    user_id: int
    username: str
    token: str


class QuizAnswerRequest(BaseModel):
    question_id: int
    selected_answer: str


class QuizAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str


class PlanGenerateRequest(BaseModel):
    target_school: str
    target_major: str
    exam_date: str = ""
    subjects: dict[str, int] = {}


class GuidanceStudyPlanRequest(BaseModel):
    subject: str


class GuidanceExplainRequest(BaseModel):
    topic: str


class GuidanceSolveRequest(BaseModel):
    question_text: str


class SyncUploadRequest(BaseModel):
    data_type: str
    data: list[dict]


class SyncDownloadRequest(BaseModel):
    data_type: str = "all"


class SyncFullRequest(BaseModel):
    local_data: dict[str, list[dict]]


class CommunityShareRequest(BaseModel):
    title: str
    content: str
    item_type: str
    subject: str = ""


class CommunityCommentRequest(BaseModel):
    content: str


class ExamPaperCreate(BaseModel):
    title: str
    subject: str
    year: int
    exam_type: str | None = None
    description: str | None = None
    total_score: float = 150.0
    duration_minutes: int = 180

class ExamQuestionCreate(BaseModel):
    section_name: str | None = None
    question_order: int
    question_text: str
    question_type: str = "single_choice"
    options: list | None = None
    answer: str | None = None
    explanation: str | None = None
    score: float = 0
    topic: str | None = None

class ExamPaperImport(BaseModel):
    title: str
    subject: str
    year: int
    exam_type: str | None = None
    description: str | None = None
    total_score: float = 150.0
    duration_minutes: int = 180
    sections: list[dict]

class ResourceDownload(BaseModel):
    url: str
    subject: str = ""
    file_type: str = ""

class ResourceGenerate(BaseModel):
    url: str
    subject: str = "数学"
    question_type: str = "single_choice"
    count: int = 5

class GuidedRequest(BaseModel):
    message: str = ""
    topic: str = ""
    hint_level: int = 0
    conversation_id: int | None = None

class LLMConfigUpdate(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None

class ExamSubmitRequest(BaseModel):
    answers: list[dict]

class WritingEvaluateRequest(BaseModel):
    text: str
    essay_type: str = "english_writing"
