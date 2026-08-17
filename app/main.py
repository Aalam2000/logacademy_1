from fastapi import FastAPI, Depends, HTTPException, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime
import os

from app.core.database import init_db, SessionLocal
from app.core.security import decode_token
from app.models.models import User, Quiz, Question
from app.schemas.schemas import QuizCreate, QuestionCreate
from app.services.generator import generate_quiz_html

# Подключаем API-роутеры
from app.api import auth, quizzes, ai

app = FastAPI(title="Log Academy API")

# Подключаем роутеры
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])

# Статика и шаблоны
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Инициализация БД
init_db()

# === Вспомогательные функции ===

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_from_request(request: Request, db: Session):
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    return user

# === Веб-страницы ===

@app.get("/", response_class=HTMLResponse)
async def root(request: Request, db: Session = Depends(get_db)):
    user = get_user_from_request(request, db)
    if user:
        return RedirectResponse(url="/dashboard")
    return RedirectResponse(url="/login")

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_user_from_request(request, db)
    if not user:
        return RedirectResponse("/login")
    quizzes_list = db.query(Quiz).filter(Quiz.user_id == user.id).all()
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": user,
        "quizzes": quizzes_list
    })

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "user": None})

@app.post("/login")
def login_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    from fastapi.security import OAuth2PasswordRequestForm
    from app.api.auth import login
    form = OAuth2PasswordRequestForm(username=username, password=password)
    token = login(form, db)
    resp = RedirectResponse("/dashboard", status_code=303)
    resp.set_cookie(key="access_token", value=token.access_token, httponly=True)
    return resp

@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request, "user": None})

@app.post("/register")
def register_post(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    language: str = Form("ru"),
    db: Session = Depends(get_db)
):
    from app.schemas.schemas import UserCreate
    from app.api.auth import register
    user_data = UserCreate(email=email, password=password, language=language)
    token = register(user_data, db)
    resp = RedirectResponse("/dashboard", status_code=303)
    resp.set_cookie(key="access_token", value=token.access_token, httponly=True)
    return resp

@app.get("/logout")
def logout():
    resp = RedirectResponse("/login")
    resp.delete_cookie("access_token")
    return resp

@app.get("/create", response_class=HTMLResponse)
def create_page(request: Request, db: Session = Depends(get_db)):
    user = get_user_from_request(request, db)
    if not user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("create_quiz.html", {"request": request, "user": user})

@app.post("/create")
async def create_quiz_post(request: Request, db: Session = Depends(get_db)):
    user = get_user_from_request(request, db)
    if not user:
        return RedirectResponse("/login")
    form = await request.form()
    title = form.get("title")
    theme = form.get("theme")
    lesson_number = int(form.get("lesson_number"))
    language = form.get("language", "ru")
    questions_text = form.getlist("question_text[]")
    answers = form.getlist("answer_text[]")
    timers = form.getlist("timer[]")
    questions = []
    for i in range(len(questions_text)):
        timer = int(timers[i]) if i < len(timers) and timers[i] else 60
        questions.append(QuestionCreate(
            question=questions_text[i],
            answer=answers[i] if i < len(answers) else "",
            timer=timer
        ))
    # Сохраняем в БД
    new_quiz = Quiz(
        title=title,
        theme=theme,
        lesson_number=lesson_number,
        language=language,
        user_id=user.id
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    for idx, q in enumerate(questions):
        question = Question(
            quiz_id=new_quiz.id,
            question_text=q.question,
            answer_text=q.answer,
            timer_seconds=q.timer,
            order=idx
        )
        db.add(question)
    db.commit()
    # Генерируем HTML
    html = generate_quiz_html(title, theme, lesson_number, questions, language)
    filename = f"quiz_{new_quiz.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.html"
    filepath = os.path.join("app", "static", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    return RedirectResponse(f"/quiz/{new_quiz.id}", status_code=303)

@app.get("/quiz/{quiz_id}", response_class=HTMLResponse)
def quiz_detail(request: Request, quiz_id: int, db: Session = Depends(get_db)):
    user = get_user_from_request(request, db)
    if not user:
        return RedirectResponse("/login")
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Викторина не найдена")
    # Находим сгенерированный HTML
    static_dir = "app/static"
    url = None
    if os.path.exists(static_dir):
        for f in os.listdir(static_dir):
            if f.startswith(f"quiz_{quiz_id}_") and f.endswith(".html"):
                url = f"/static/{f}"
                break
    return templates.TemplateResponse("quiz_detail.html", {
        "request": request,
        "user": user,
        "quiz": quiz,
        "url": url
    })