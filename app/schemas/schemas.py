from pydantic import BaseModel, EmailStr
from typing import List, Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    language: str = "ru"

class UserOut(BaseModel):
    id: int
    email: str
    language: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class QuestionCreate(BaseModel):
    question: str
    answer: str
    timer: int = 60

class QuizCreate(BaseModel):
    title: str
    theme: str
    lesson_number: int
    language: str = "ru"
    questions: List[QuestionCreate]

class QuizOut(BaseModel):
    id: int
    title: str
    theme: str
    lesson_number: int
    language: str
    questions: List[QuestionCreate]
