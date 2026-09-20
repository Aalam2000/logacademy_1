from pathlib import Path

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user
from ..models import User
from .i18n import translator

router = APIRouter(prefix="/help", tags=["help"])

HELP_DIR = Path(__file__).parent.parent.parent / "templates" / "help"

# Файл инструкции на роль. Ролей в системе пока 3 (admin/teacher/student),
# но заводим сразу под все 5 — examiner/parent появятся позже, файлы уже
# на месте, останется только наполнить текстом (см. claude/... план).
ROLE_FILES = {
    "admin": "admin.html",
    "teacher": "teacher.html",
    "student": "student.html",
    "examiner": "examiner.html",
    "parent": "parent.html",
}


@router.get("")
async def get_help(
    lang: str = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Инструкция для текущего пользователя — по его роли. Тот же приём
    перевода HTML-шаблона, что и в students.py (render_student_card_html):
    apply_to_html() переводит то, что autoi18n нашёл сканированием файла
    на диске (backend/templates входит в scan_paths, сканируется рекурсивно —
    подпапка help/ туда тоже попадает)."""
    lang = lang or translator.source_lang
    filename = ROLE_FILES.get(current_user.role, ROLE_FILES["student"])
    path = HELP_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    if lang != translator.source_lang:
        try:
            html = translator.apply_to_html(html, lang)
        except Exception as e:
            print(f"❌ Ошибка перевода инструкции: {e}")

    return {"html": html}
