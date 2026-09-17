"""Живой квиз (Kahoot-style) — минимальные изменения схемы.

Сама игра (кто зарегистрировался, кто на каком вопросе, кто как ответил)
в БД не хранится вообще — живёт только в памяти backend-процесса на время
игры (см. routers/quiz_live.py). В БД остаётся только то, что нужно
после игры:

- quizzes.questions_data — структурированные вопросы/варианты live-квиза
  (не переводится, поэтому не нужно гонять через файл-шаблон, как flash).
- lesson_marks.exam_score — итоговая оценка урока из live-квиза, если
  препод на титулке запущенного квиза включил флажок "Экзамен". Это
  решение — за конкретный запуск, не свойство квиза, поэтому в БД у
  самого квиза ничего под это не хранится (флажок живёт в памяти игры,
  как и всё остальное её состояние).

Revision ID: 0009_quiz_live
Revises: 0008_user_theme
Create Date: 2026-09-17 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0009_quiz_live"
down_revision: Union[str, Sequence[str], None] = "0008_user_theme"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("questions_data", sa.JSON(), nullable=True))
    op.add_column("lesson_marks", sa.Column("exam_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("lesson_marks", "exam_score")
    op.drop_column("quizzes", "questions_data")
