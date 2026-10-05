"""Оценка урока учеником: три смайлика (зелёный / жёлтый / красный).

lesson_feedback — одна запись на пару (урок, ученик). Педагогу отдельные
оценки не показываются — только сводка в отчёте по педагогу у админа.

Revision ID: 0021_lesson_feedback
Revises: 0020_personal_lessons
Create Date: 2026-10-06 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0021_lesson_feedback"
down_revision: Union[str, Sequence[str], None] = "0020_personal_lessons"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_feedback",
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("rating", sa.Integer(), nullable=False),  # 3 — зелёный, 2 — жёлтый, 1 — красный
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_lesson_feedback_student_id", "lesson_feedback", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_feedback_student_id", table_name="lesson_feedback")
    op.drop_table("lesson_feedback")
