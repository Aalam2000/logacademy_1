"""Индексы под подсчёт посещаемости и выборки по группам (attendance.py).

Revision ID: 0015_perf_indexes
Revises: 0014_lesson_duration
Create Date: 2026-09-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0015_perf_indexes"
down_revision: Union[str, Sequence[str], None] = "0014_lesson_duration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_lessons_group_id_date", "lessons", ["group_id", "date"])
    op.create_index("ix_group_members_group_id", "group_members", ["group_id"])
    op.create_index("ix_group_members_student_id", "group_members", ["student_id"])
    op.create_index("ix_lesson_marks_student_id", "lesson_marks", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_marks_student_id", table_name="lesson_marks")
    op.drop_index("ix_group_members_student_id", table_name="group_members")
    op.drop_index("ix_group_members_group_id", table_name="group_members")
    op.drop_index("ix_lessons_group_id_date", table_name="lessons")
