from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    type = Column(String, nullable=False)  # flash, live, sprint
    template_type = Column(String, nullable=False, default="flash")  # flash, live, sprint
    html_content = Column(Text, nullable=False)  # исходный HTML на русском
    html_translations = Column(JSON, default={})  # {lang: translated_html}
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())