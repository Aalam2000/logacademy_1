from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Quiz, User, Lesson, Group
from ..schemas import QuizCreate, QuizOut
from ..dependencies import get_current_user
from .i18n import translator
import json
import os
import re
from pathlib import Path

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

SOURCE_LANG = os.getenv("SOURCE_LANG", "ru")
TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates" / "quiz"


async def _verify_lesson_access(lesson_id: int, db: AsyncSession, current_user: User) -> None:
    # Та же проверка владения, что и в routers/lessons.py: admin — любой
    # урок, teacher — только урок своей группы.
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    group_query = select(Group).where(Group.id == lesson.group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    group = await db.execute(group_query)
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")



def render_translated_template(template_type: str, lang: str, data: dict) -> str:
    # Сначала читаем шаблон БЕЗ перевода
    template_path = TEMPLATE_DIR / f"{template_type}.html"
    if not template_path.exists():
        raise HTTPException(status_code=400, detail=f"Template {template_type} not found")

    with open(template_path, "r", encoding="utf-8") as f:
        template_content = f.read()

    # Сначала переводим уже готовый HTML (текст, атрибуты и содержимое
    # <script>, включая шаблонные строки вида `Вопрос ${i} / ${n}`)
    if lang != SOURCE_LANG:
        try:
            template_content = translator.apply_to_html(template_content, lang)
        except Exception as e:
            print(f"❌ Ошибка перевода шаблона: {e}")

    # Потом подставляем данные
    for key, value in data.items():
        template_content = template_content.replace(f"{{{{ {key} }}}}", str(value))


    return template_content

@router.get("/", response_model=list[QuizOut])
async def get_quizzes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Quiz).where(Quiz.created_by == current_user.id))
    return result.scalars().all()

@router.post("/", response_model=QuizOut)
async def create_quiz(quiz_data: QuizCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if quiz_data.lesson_id is not None:
        await _verify_lesson_access(quiz_data.lesson_id, db, current_user)

    print(f"📥 Received lang: {quiz_data.lang}")
    template_type = quiz_data.template_type or "flash"
    questions_dict = [q.model_dump() for q in quiz_data.questions]
    data = {
        "title": quiz_data.title,
        "topic": quiz_data.topic or "Викторина",
        "questions_count": len(questions_dict),
        "questions_json": json.dumps(questions_dict, ensure_ascii=False),
    }
    html = render_translated_template(template_type, quiz_data.lang, data)
    print(f"📄 Generated HTML (first 200 chars): {html[:200]}...")

    new_quiz = Quiz(
        title=quiz_data.title,
        topic=quiz_data.topic,
        type=template_type,
        template_type=template_type,
        html_content=html,
        html_translations={},
        created_by=current_user.id,
        lesson_id=quiz_data.lesson_id
    )
    db.add(new_quiz)
    await db.commit()
    await db.refresh(new_quiz)
    return new_quiz

@router.put("/{quiz_id}", response_model=QuizOut)
async def update_quiz(quiz_id: int, quiz_data: QuizCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.created_by == current_user.id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    print(f"📥 Update lang: {quiz_data.lang}")
    template_type = quiz_data.template_type or "flash"
    questions_dict = [q.model_dump() for q in quiz_data.questions]
    data = {
        "title": quiz_data.title,
        "topic": quiz_data.topic or "Викторина",
        "questions_count": len(questions_dict),
        "questions_json": json.dumps(questions_dict, ensure_ascii=False),
    }
    html = render_translated_template(template_type, quiz_data.lang, data)
    print(f"📄 Updated HTML (first 200 chars): {html[:200]}...")

    quiz.title = quiz_data.title
    quiz.topic = quiz_data.topic
    quiz.template_type = template_type
    quiz.type = template_type
    quiz.html_content = html
    quiz.html_translations = {}

    await db.commit()
    await db.refresh(quiz)
    return quiz

@router.delete("/{quiz_id}")
async def delete_quiz(quiz_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.created_by == current_user.id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await db.delete(quiz)
    await db.commit()
    return {"detail": "Deleted"}

@router.get("/{quiz_id}/html")
async def get_quiz_html(quiz_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.created_by == current_user.id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"html": quiz.html_content}

@router.get("/{quiz_id}/edit")
async def get_quiz_edit_data(quiz_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.created_by == current_user.id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    match = re.search(r'const QUESTIONS\s*=\s*(\[.*?\])\s*;', quiz.html_content, re.DOTALL)
    questions = []
    if match:
        try:
            questions = json.loads(match.group(1))
        except Exception:
            pass

    return {
        "id": quiz.id,
        "title": quiz.title,
        "topic": quiz.topic,
        "template_type": quiz.template_type,
        "questions": questions
    }