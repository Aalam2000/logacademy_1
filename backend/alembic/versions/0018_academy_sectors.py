"""Данные академии и справочник секторов (вкладка «Академия» у админа).

academy — одна запись: название, сайт, контакты.
sectors — направления обучения (раньше ru/az были зашиты в коде): код,
название, слово «Урок» на языке сектора. Существующие ru и az
переносятся сюда; у групп и материалов ничего не меняется (там хранится
код сектора строкой, как и раньше).

Revision ID: 0018_academy_sectors
Revises: 0017_csp_reports
Create Date: 2026-10-02 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0018_academy_sectors"
down_revision: Union[str, Sequence[str], None] = "0017_csp_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    academy = op.create_table(
        "academy",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("website", sa.String(), nullable=True),
        sa.Column("telegram", sa.String(), nullable=True),
        sa.Column("whatsapp", sa.String(), nullable=True),
        sa.Column("instagram", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
    )
    sectors = op.create_table(
        "sectors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("lesson_word", sa.String(), nullable=False),
    )
    op.bulk_insert(academy, [{"name": "Log Academy"}])
    op.bulk_insert(sectors, [
        {"code": "ru", "name": "Русский сектор", "lesson_word": "Урок"},
        {"code": "az", "name": "Azərbaycan sektoru", "lesson_word": "Dərs"},
    ])


def downgrade() -> None:
    op.drop_table("sectors")
    op.drop_table("academy")
