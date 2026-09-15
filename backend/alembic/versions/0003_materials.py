"""materials (knowledge base) + lesson_materials link

Revision ID: 0003_materials
Revises: 0002_lesson_marks
Create Date: 2026-09-14 20:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_materials"
down_revision: Union[str, Sequence[str], None] = "0002_lesson_marks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index(op.f("ix_materials_id"), "materials", ["id"], unique=False)

    op.create_table(
        "lesson_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("added_by", sa.Integer(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"]),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "material_id", name="uq_lesson_materials_lesson_material"),
    )
    op.create_index(op.f("ix_lesson_materials_id"), "lesson_materials", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_materials_lesson_id"), "lesson_materials", ["lesson_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_materials_lesson_id"), table_name="lesson_materials")
    op.drop_index(op.f("ix_lesson_materials_id"), table_name="lesson_materials")
    op.drop_table("lesson_materials")
    op.drop_index(op.f("ix_materials_id"), table_name="materials")
    op.drop_table("materials")
