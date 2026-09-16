"""courses.description — текстовое описание курса, необязательное поле

Обычное добавление nullable-колонки, существующие курсы не трогаем
(значение NULL = описания нет).

Revision ID: 0007_course_description
Revises: 0006_group_whatsapp
Create Date: 2026-09-16 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0007_course_description"
down_revision: Union[str, Sequence[str], None] = "0006_group_whatsapp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("courses", "description")
