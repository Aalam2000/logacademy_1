from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class QuestionSchema(BaseModel):
    question: str
    time: int
    answer: str

class QuizCreate(BaseModel):
    title: str
    topic: Optional[str] = None
    template_type: Optional[str] = None
    questions: List[QuestionSchema]
    lang: str

class QuizOut(BaseModel):
    id: int
    title: str
    topic: Optional[str]
    type: str
    template_type: str
    created_at: datetime
    created_by: int
    html_translations: Optional[Dict[str, str]] = None