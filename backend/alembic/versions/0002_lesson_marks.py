"""lesson marks (attendance, score, stars)

Revision ID: 0002_lesson_marks
Revises: 0001_initial_schema
Create Date: 2026-09-14 18:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_lesson_marks"
down_revision: Union[str, Sequence[str], None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_marks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        # in_person | online | excused | absent | NULL (ещё не отмечено)
        sa.Column("attendance_status", sa.String(), nullable=True),
        sa.Column("is_late", sa.Boolean(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),  # 0..100
        sa.Column("stars", sa.Integer(), nullable=True),  # 0..3
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("marked_by", sa.Integer(), nullable=True),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "student_id", name="uq_lesson_marks_lesson_student"),
    )
    op.create_index(op.f("ix_lesson_marks_id"), "lesson_marks", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_marks_lesson_id"), "lesson_marks", ["lesson_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_marks_lesson_id"), table_name="lesson_marks")
    op.drop_index(op.f("ix_lesson_marks_id"), table_name="lesson_marks")
    op.drop_table("lesson_marks")
