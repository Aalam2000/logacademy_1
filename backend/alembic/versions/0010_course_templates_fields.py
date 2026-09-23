"""Шаблоны курсов — теги базы знаний + направление группы.

Добавляет поля, нужные для будущего механизма шаблонов курса
(claude/course-templates-plan.md): каждый материал/квиз/ссылка в базе
знаний может быть помечен как часть шаблона курса — course_id + sector +
template_lesson_no, с отдельным статусом draft/approved. Простановка
этих полей — только через админский UI (следующий этап, не эта миграция).

Отдельно — groups.sector: направление самой группы (ru/az), не связано
с тегами материалов напрямую, нужно для фильтрации при подборе шаблона.

Все новые колонки nullable — ни одна существующая запись не ломается,
бэкфилл (например простановка sector у уже существующих групп) —
отдельный ручной шаг позже, не часть этой миграции.

Revision ID: 0010_course_templates_fields
Revises: 0009_quiz_live
Create Date: 2026-09-23 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0010_course_templates_fields"
down_revision: Union[str, Sequence[str], None] = "0009_quiz_live"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # groups — направление группы
    op.add_column("groups", sa.Column("sector", sa.String(), nullable=True))

    # materials — course_id уже существует (0003_materials); добавляем
    # только теги шаблона
    op.add_column("materials", sa.Column("sector", sa.String(), nullable=True))
    op.add_column("materials", sa.Column("template_lesson_no", sa.String(), nullable=True))
    op.add_column("materials", sa.Column("template_status", sa.String(), nullable=True))

    # links — course_id ещё не было, заводим вместе с тегами шаблона
    op.add_column("links", sa.Column("course_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_links_course_id_courses", "links", "courses", ["course_id"], ["id"]
    )
    op.add_column("links", sa.Column("sector", sa.String(), nullable=True))
    op.add_column("links", sa.Column("template_lesson_no", sa.String(), nullable=True))
    op.add_column("links", sa.Column("template_status", sa.String(), nullable=True))

    # quizzes — course_id ещё не было, заводим вместе с тегами шаблона
    op.add_column("quizzes", sa.Column("course_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_quizzes_course_id_courses", "quizzes", "courses", ["course_id"], ["id"]
    )
    op.add_column("quizzes", sa.Column("sector", sa.String(), nullable=True))
    op.add_column("quizzes", sa.Column("template_lesson_no", sa.String(), nullable=True))
    op.add_column("quizzes", sa.Column("template_status", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("quizzes", "template_status")
    op.drop_column("quizzes", "template_lesson_no")
    op.drop_column("quizzes", "sector")
    op.drop_constraint("fk_quizzes_course_id_courses", "quizzes", type_="foreignkey")
    op.drop_column("quizzes", "course_id")

    op.drop_column("links", "template_status")
    op.drop_column("links", "template_lesson_no")
    op.drop_column("links", "sector")
    op.drop_constraint("fk_links_course_id_courses", "links", type_="foreignkey")
    op.drop_column("links", "course_id")

    op.drop_column("materials", "template_status")
    op.drop_column("materials", "template_lesson_no")
    op.drop_column("materials", "sector")

    op.drop_column("groups", "sector")
