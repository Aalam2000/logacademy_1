from pathlib import Path

import markdown
from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user
from ..models import User
from .i18n import translator

router = APIRouter(prefix="/help", tags=["help"])

HELP_DIR = Path(__file__).parent.parent.parent / "templates" / "help"

# Файл инструкции на роль. Ролей в системе пока 3 (admin/teacher/student),
# но заводим сразу под все 5 — examiner/parent появятся позже, файлы уже
# на месте, останется только наполнить текстом.
#
# Инструкции — документы Markdown на русском. autoi18n (doc_paths в
# backend/autoi18n.json) переводит каждый файл ЦЕЛИКОМ и кладёт перевод
# рядом: teacher.md -> teacher.en.md, teacher.az.md (в git не попадают,
# см. .gitignore; папка подключена томом, чтобы переводы переживали деплой).
ROLE_FILES = {
    "admin": "admin.md",
    "teacher": "teacher.md",
    "student": "student.md",
    "examiner": "examiner.md",
    "parent": "parent.md",
}

MD_EXTENSIONS = ["tables", "fenced_code", "sane_lists"]


@router.get("")
async def get_help(
    lang: str = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Инструкция для текущего пользователя — по его роли, на языке lang.
    Если перевода на lang ещё нет (воркер не успел) — отдаётся исходник."""
    lang = lang or translator.source_lang
    filename = ROLE_FILES.get(current_user.role, ROLE_FILES["student"])
    doc = translator.get_document(str(HELP_DIR / filename), lang)
    html = markdown.markdown(doc["text"], extensions=MD_EXTENSIONS)
    return {"html": html, "lang": doc["lang"]}
