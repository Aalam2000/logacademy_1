"""groups.whatsapp — WhatsApp группы, необязательное поле

Обычное добавление nullable-колонки, существующие группы не трогаем
(значение NULL = не указано). Аналог уже существующего telegram_chat_id.

Revision ID: 0006_group_whatsapp
Revises: 0005_lesson_comment
Create Date: 2026-09-16 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0006_group_whatsapp"
down_revision: Union[str, Sequence[str], None] = "0005_lesson_comment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("whatsapp", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("groups", "whatsapp")
