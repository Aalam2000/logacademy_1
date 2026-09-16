"""links + lesson_resources (unified library ↔ lesson linking); drop lesson_materials, quizzes.lesson_id

Данные не переносятся — функционал ещё не использовался ни на деве, ни
на проде (по решению Андрея, 2026-09-15).

Revision ID: 0004_lesson_resources
Revises: 0003_materials
Create Date: 2026-09-15 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004_lesson_resources"
down_revision: Union[str, Sequence[str], None] = "0003_materials"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("added_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_links_id"), "links", ["id"], unique=False)

    op.create_table(
        "lesson_resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=False),
        sa.Column("added_by", sa.Integer(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lesson_id", "resource_type", "resource_id",
            name="uq_lesson_resources_lesson_type_resource",
        ),
    )
    op.create_index(op.f("ix_lesson_resources_id"), "lesson_resources", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_resources_lesson_id"), "lesson_resources", ["lesson_id"], unique=False)

    # Старая связка файл↔урок и старая прямая привязка квиз→урок —
    # выводятся из эксплуатации без переноса данных.
    op.drop_index(op.f("ix_lesson_materials_lesson_id"), table_name="lesson_materials")
    op.drop_index(op.f("ix_lesson_materials_id"), table_name="lesson_materials")
    op.drop_table("lesson_materials")

    op.drop_column("quizzes", "lesson_id")


def downgrade() -> None:
    op.add_column("quizzes", sa.Column("lesson_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "quizzes", "lessons", ["lesson_id"], ["id"])

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

    op.drop_index(op.f("ix_lesson_resources_lesson_id"), table_name="lesson_resources")
    op.drop_index(op.f("ix_lesson_resources_id"), table_name="lesson_resources")
    op.drop_table("lesson_resources")

    op.drop_index(op.f("ix_links_id"), table_name="links")
    op.drop_table("links")
