"""Длительность уроков (claude/calendar-duration-plan.md).

- lessons.duration_min — длительность конкретного урока в минутах;
- groups.lesson_duration_min — длительность по умолчанию для группы
  (подставляется при генерации расписания и «+ Урок»; урок хранит копию).
Существующие уроки и группы получают 120 минут.

Revision ID: 0014_lesson_duration
Revises: 0013_group_video_url
Create Date: 2026-09-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0014_lesson_duration"
down_revision: Union[str, Sequence[str], None] = "0013_group_video_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("duration_min", sa.Integer(), nullable=False, server_default="120"))
    op.add_column("groups", sa.Column("lesson_duration_min", sa.Integer(), nullable=False, server_default="120"))


def downgrade() -> None:
    op.drop_column("groups", "lesson_duration_min")
    op.drop_column("lessons", "duration_min")
