"""Отчёты о нарушениях CSP (claude/server-ops.md, раздел «Дальше»).

csp_reports — одна строка на вид нарушения (fingerprint), повторы
увеличивают count и сдвигают last_seen.

Revision ID: 0017_csp_reports
Revises: 0016_user_sessions
Create Date: 2026-10-01 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0017_csp_reports"
down_revision: Union[str, Sequence[str], None] = "0016_user_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "csp_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fingerprint", sa.String(64), nullable=False, unique=True),
        sa.Column("directive", sa.String(), nullable=False),
        sa.Column("blocked", sa.String(), nullable=False),
        sa.Column("page", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("disposition", sa.String(), nullable=False),
        sa.Column("sample", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("csp_reports")
