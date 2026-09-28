"""Ссылка на видеоконференцию группы (claude/video-conference-plan.md).

- groups.video_url — постоянная ссылка (Google Meet или любой https://),
  педагог вставляет её в настройках группы.

Revision ID: 0013_group_video_url
Revises: 0012_homework
Create Date: 2026-09-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_group_video_url"
down_revision: Union[str, Sequence[str], None] = "0012_homework"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("video_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("groups", "video_url")
