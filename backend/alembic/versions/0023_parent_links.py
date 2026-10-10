"""Личные ссылки родителей: parent_links.

Ссылка /p/<token> принадлежит телефону родителя; по ней родитель без логина
видит успеваемость своих детей. Правила — app/routers/parent.py.

Revision ID: 0023_parent_links
Revises: 0022_lesson_teacher
Create Date: 2026-10-10 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0023_parent_links"
down_revision: Union[str, Sequence[str], None] = "0022_lesson_teacher"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parent_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parent_phone", sa.String(), nullable=False),
        sa.Column("token", sa.String(length=8), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("token", name="uq_parent_links_token"),
    )
    op.create_index("ix_parent_links_parent_phone", "parent_links", ["parent_phone"])


def downgrade() -> None:
    op.drop_index("ix_parent_links_parent_phone", table_name="parent_links")
    op.drop_table("parent_links")
