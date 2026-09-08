from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    telegram_username: Optional[str] = None
    whatsapp: Optional[str] = None
    role: str = "teacher"
    created_by: Optional[int] = None

class StudentRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    invite_code: str  # код группы из QR

class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    telegram_username: Optional[str]
    whatsapp: Optional[str]
    photo_url: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class CourseCreate(BaseModel):
    title: str

class CourseOut(BaseModel):
    id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    course_id: int
    teacher_id: int  # какому педагогу принадлежит
    telegram_chat_id: Optional[str] = None

class GroupOut(BaseModel):
    id: int
    name: str
    course_id: int
    status: str
    invite_code: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    telegram_username: Optional[str] = None
    whatsapp: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None

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

    class Config:
        from_attributes = True