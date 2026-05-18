from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    user_id: int = 1
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []


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


class QuizAnswerRequest(BaseModel):
    user_id: int
    question_id: int
    selected_answer: str


class QuizAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str


class PlanGenerateRequest(BaseModel):
    user_id: int
    target_school: str
    target_major: str
    exam_date: str = ""
    subjects: dict[str, int] = {}


class GuidanceStudyPlanRequest(BaseModel):
    user_id: int
    subject: str


class GuidanceExplainRequest(BaseModel):
    user_id: int
    topic: str


class GuidanceSolveRequest(BaseModel):
    user_id: int
    question_text: str
