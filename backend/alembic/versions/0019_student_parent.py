"""Родитель ученика: имя и телефон в карточке ученика.

users.parent_name, users.parent_phone — заполняет педагог (своим ученикам)
или админ в окне «Ученики» группы. Телефон родителя хранится в едином виде
(app/phones.py), но, в отличие от users.phone, может повторяться: у братьев
и сестёр один родитель.

Revision ID: 0019_student_parent
Revises: 0018_academy_sectors
Create Date: 2026-10-05 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0019_student_parent"
down_revision: Union[str, Sequence[str], None] = "0018_academy_sectors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("parent_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("parent_phone", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "parent_phone")
    op.drop_column("users", "parent_name")
