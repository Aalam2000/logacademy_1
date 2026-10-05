"""Персональные уроки: урок группы со своим списком участников.

lessons.is_personal — признак персонального урока.
lesson_students — участники персонального урока (урок, ученик). Правило
«кто ученики урока» — backend/app/personal.py.

Revision ID: 0020_personal_lessons
Revises: 0019_student_parent
Create Date: 2026-10-06 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0020_personal_lessons"
down_revision: Union[str, Sequence[str], None] = "0019_student_parent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("is_personal", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "lesson_students",
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_lesson_students_student_id", "lesson_students", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_students_student_id", table_name="lesson_students")
    op.drop_table("lesson_students")
    op.drop_column("lessons", "is_personal")
