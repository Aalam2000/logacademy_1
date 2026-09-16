"""lessons.comment — общий комментарий педагога к уроку

Обычное добавление nullable-колонки, существующие уроки не трогаем
(значение NULL = комментария нет).

Revision ID: 0005_lesson_comment
Revises: 0004_lesson_resources
Create Date: 2026-09-15 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0005_lesson_comment"
down_revision: Union[str, Sequence[str], None] = "0004_lesson_resources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("comment", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "comment")
