from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON, ForeignKey, Date, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=True)
    target_school = Column(String(200))
    target_major = Column(String(200))
    exam_date = Column(String(20))
    llm_api_key = Column(String(255), nullable=True)
    llm_base_url = Column(String(500), nullable=True)
    llm_model = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    quiz_records = relationship("QuizRecord", back_populates="user", cascade="all, delete-orphan")
    wrong_questions = relationship("WrongQuestion", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), default="新对话")
    chat_mode = Column(String(20), default="normal")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("ChatHistory", back_populates="conversation", cascade="all, delete-orphan")


class ChatHistory(Base):
    __tablename__ = "chat_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=[])
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="chat_histories")
    conversation = relationship("Conversation", back_populates="messages")


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_school = Column(String(200))
    subject = Column(String(100))
    current_level = Column(String(50))
    plan_data = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="study_plans")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(200))
    difficulty = Column(String(20))
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30), default="single_choice")
    options = Column(JSON, default=[])
    answer = Column(Text, nullable=False)
    explanation = Column(Text)
    source = Column(String(200))
    created_at = Column(DateTime, server_default=func.now())

    quiz_records = relationship("QuizRecord", back_populates="question", cascade="all, delete-orphan")
    wrong_questions = relationship("WrongQuestion", back_populates="question", cascade="all, delete-orphan")


class QuizRecord(Base):
    __tablename__ = "quiz_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("quiz_questions.id"), nullable=False)
    selected_answer = Column(Text)
    is_correct = Column(Boolean)
    time_spent = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="quiz_records")
    question = relationship("QuizQuestion", back_populates="quiz_records")


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("quiz_questions.id"), nullable=False)
    review_count = Column(Integer, default=0)
    last_reviewed_at = Column(DateTime)
    mastered = Column(Boolean, default=False)
    easiness_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=1)
    next_review_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="wrong_questions")
    question = relationship("QuizQuestion", back_populates="wrong_questions")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100))
    duration = Column(Integer, default=0)
    session_type = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="study_sessions")


class SharedItem(Base):
    __tablename__ = "shared_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    item_type = Column(String(50), nullable=False)
    subject = Column(String(100))
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
    comments = relationship("Comment", back_populates="shared_item", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_item_id = Column(Integer, ForeignKey("shared_items.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
    shared_item = relationship("SharedItem", back_populates="comments")


class UserUpload(Base):
    __tablename__ = "user_uploads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_id = Column(String(100), nullable=False)
    filename = Column(String(255), nullable=False)
    subject = Column(String(100))
    file_type = Column(String(50))
    file_path = Column(String(500))
    file_size = Column(Integer, default=0)
    indexed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class StudyStreak(Base):
    __tablename__ = "study_streaks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    streak_days = Column(Integer, default=0)
    last_checkin_date = Column(Date, nullable=True)
    max_streak = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class MockExam(Base):
    __tablename__ = "mock_exams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    duration = Column(Integer, default=0)
    question_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    exam_type = Column(String(50))
    description = Column(Text)
    question_count = Column(Integer, default=0)
    total_score = Column(Float, default=150.0)
    duration_minutes = Column(Integer, default=180)
    created_at = Column(DateTime, server_default=func.now())

    questions = relationship("ExamQuestion", back_populates="paper", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_exam_subject_year", "subject", "year"),
    )


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("exam_papers.id"), nullable=False)
    section_name = Column(String(100))
    question_order = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30))
    options = Column(JSON)
    answer = Column(Text)
    explanation = Column(Text)
    score = Column(Float, default=0)
    topic = Column(String(200))
    created_at = Column(DateTime, server_default=func.now())

    paper = relationship("ExamPaper", back_populates="questions")

    __table_args__ = (
        Index("idx_exam_question_paper", "paper_id", "question_order"),
    )
