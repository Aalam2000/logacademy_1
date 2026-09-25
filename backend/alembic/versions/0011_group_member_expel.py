"""group_members.expel_reason/expelled_at/expelled_by — отчисление ученика
из группы с обязательным комментарием.

Отчисление — на уровне конкретного членства (group_members), не ученика
целиком: один и тот же ученик может состоять в нескольких группах
одновременно и быть отчислен только из одной. status остаётся
active | expelled (было и раньше, просто не использовалось); эти три поля
заполняются только при status='expelled', очищаются при восстановлении
("вернуть из архива") — истории отчислений не храним, только последнее.

Revision ID: 0011_group_member_expel
Revises: 0010_course_templates_fields
Create Date: 2026-09-24 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0011_group_member_expel"
down_revision: Union[str, Sequence[str], None] = "0010_course_templates_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("group_members", sa.Column("expel_reason", sa.Text(), nullable=True))
    op.add_column("group_members", sa.Column("expelled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("group_members", sa.Column("expelled_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_group_members_expelled_by_users",
        "group_members", "users",
        ["expelled_by"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_group_members_expelled_by_users", "group_members", type_="foreignkey")
    op.drop_column("group_members", "expelled_by")
    op.drop_column("group_members", "expelled_at")
    op.drop_column("group_members", "expel_reason")
