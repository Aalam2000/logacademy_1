"""Сессии присутствия пользователей (claude/presence-plan.md).

user_sessions — одна строка на непрерывный отрезок работы в системе:
started_at / last_seen_at, без IP и браузера.

Revision ID: 0016_user_sessions
Revises: 0015_perf_indexes
Create Date: 2026-09-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0016_user_sessions"
down_revision: Union[str, Sequence[str], None] = "0015_perf_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_sessions_user_last_seen", "user_sessions", ["user_id", "last_seen_at"])
    op.create_index("ix_user_sessions_last_seen", "user_sessions", ["last_seen_at"])
    op.create_index("ix_user_sessions_started", "user_sessions", ["started_at"])


def downgrade() -> None:
    op.drop_table("user_sessions")
