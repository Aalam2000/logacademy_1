"""users.theme — выбор визуальной темы интерфейса (brand | playful | dark)

Обычное добавление nullable-колонки, существующих пользователей не трогаем
(значение NULL = тема не выбрана, фронт трактует это как "brand" по умолчанию).

Revision ID: 0008_user_theme
Revises: 0007_course_description
Create Date: 2026-09-16 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0008_user_theme"
down_revision: Union[str, Sequence[str], None] = "0007_course_description"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("theme", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "theme")
