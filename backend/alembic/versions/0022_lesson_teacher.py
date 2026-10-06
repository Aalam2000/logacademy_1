"""Педагог урока: lessons.teacher_id.

У каждого урока — свой педагог (замена на один урок, передача группы с
такого-то урока). Существующим урокам ставится педагог их группы.
Правила — app/lesson_teacher.py.

Revision ID: 0022_lesson_teacher
Revises: 0021_lesson_feedback
Create Date: 2026-10-06 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0022_lesson_teacher"
down_revision: Union[str, Sequence[str], None] = "0021_lesson_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("teacher_id", sa.Integer(), nullable=True))
    op.execute("UPDATE lessons SET teacher_id = (SELECT teacher_id FROM groups WHERE groups.id = lessons.group_id)")
    op.alter_column("lessons", "teacher_id", nullable=False)
    op.create_foreign_key("fk_lessons_teacher_id_users", "lessons", "users", ["teacher_id"], ["id"])
    op.create_index("ix_lessons_teacher_id", "lessons", ["teacher_id"])


def downgrade() -> None:
    op.drop_index("ix_lessons_teacher_id", table_name="lessons")
    op.drop_constraint("fk_lessons_teacher_id_users", "lessons", type_="foreignkey")
    op.drop_column("lessons", "teacher_id")
