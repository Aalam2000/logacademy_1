from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.ollama_client import generate_questions

router = APIRouter()

class AIRequest(BaseModel):
    topic: str
    lesson: int
    count: int = 5
    language: str = "ru"

@router.post("/generate-questions")
def ai_generate(request: AIRequest):
    try:
        questions = generate_questions(request.topic, request.lesson, request.count, request.language)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
