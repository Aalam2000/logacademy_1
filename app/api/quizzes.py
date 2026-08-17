from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.api.auth import oauth2_scheme, get_db
from app.core.security import decode_token
from app.models.models import User, Quiz, Question
from app.schemas.schemas import QuizCreate, QuizOut
from app.services.generator import generate_quiz_html
import os
from datetime import datetime

router = APIRouter()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401)
    return user

@router.post("/", response_model=dict)
def create_quiz(quiz: QuizCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_quiz = Quiz(
        title=quiz.title,
        theme=quiz.theme,
        lesson_number=quiz.lesson_number,
        language=quiz.language,
        user_id=current_user.id
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    for idx, q in enumerate(quiz.questions):
        question = Question(
            quiz_id=new_quiz.id,
            question_text=q.question,
            answer_text=q.answer,
            timer_seconds=q.timer,
            order=idx
        )
        db.add(question)
    db.commit()
    html = generate_quiz_html(quiz.title, quiz.theme, quiz.lesson_number, quiz.questions, quiz.language)
    filename = f"quiz_{new_quiz.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.html"
    filepath = os.path.join("app", "static", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    return {"id": new_quiz.id, "url": f"/static/{filename}"}

@router.get("/", response_model=list[QuizOut])
def list_quizzes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).filter(Quiz.user_id == current_user.id).all()
    return quizzes
