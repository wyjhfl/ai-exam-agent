from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON, ForeignKey
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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    quiz_records = relationship("QuizRecord", back_populates="user", cascade="all, delete-orphan")
    wrong_questions = relationship("WrongQuestion", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")


class ChatHistory(Base):
    __tablename__ = "chat_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=[])
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="chat_histories")


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
