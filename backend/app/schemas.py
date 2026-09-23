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
    full_name: Optional[str] = None
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
    description: Optional[str] = None

class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    course_id: int
    teacher_id: int  # какому педагогу принадлежит
    telegram_chat_id: Optional[str] = None
    whatsapp: Optional[str] = None
    sector: Optional[str] = None  # 'ru' | 'az' — см. course-templates-plan.md

class GroupOut(BaseModel):
    id: int
    name: str
    course_id: int
    teacher_id: int
    telegram_chat_id: Optional[str]
    whatsapp: Optional[str] = None
    sector: Optional[str] = None
    status: str
    invite_code: str
    created_at: datetime
    student_count: int = 0
    teacher_name: Optional[str] = None

    class Config:
        from_attributes = True

class GroupInviteOut(BaseModel):
    id: int
    name: str
    course_title: Optional[str] = None

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
    time: int = 60
    answer: Optional[str] = None            # flash — текст ответа
    options: Optional[List[str]] = None      # live — 4 варианта
    correct_index: Optional[int] = None      # live — индекс правильного (0..3)

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