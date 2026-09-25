"""ДЗ (схема v2, claude/homework-plan.md) + контроль дублей в «Базе знаний».

- materials.is_personal — персональный файл ДЗ (homework-tasks/), в БЗ не попадает;
- materials.content_hash — sha256 содержимого, контроль дублей;
- homework_tasks — задания урока: файл + срок; student_id NULL = всем;
- homework_answers — ответ студента на всё ДЗ урока: одна оценка 0–100 и «принято»
  (любое из них = проверено); не больше 2 заданий (файлов) в ДЗ студента;
- homework_answer_files — файлы ответа (homework-answers/);
- lesson_messages — диалог педагог ↔ студент в строке урока (заменяет комментарий).
  Существующие lesson_marks.comment переносятся первым сообщением педагога.

Revision ID: 0012_homework
Revises: 0011_group_member_expel
Create Date: 2026-09-25 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_homework"
down_revision: Union[str, Sequence[str], None] = "0011_group_member_expel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("materials", sa.Column("is_personal", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("materials", sa.Column("content_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_materials_content_hash"), "materials", ["content_hash"], unique=False)

    op.create_table(
        "homework_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("material_id", sa.Integer(), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_homework_tasks_id"), "homework_tasks", ["id"], unique=False)
    op.create_index(op.f("ix_homework_tasks_lesson_id"), "homework_tasks", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_homework_tasks_material_id"), "homework_tasks", ["material_id"], unique=False)
    op.create_index(op.f("ix_homework_tasks_student_id"), "homework_tasks", ["student_id"], unique=False)

    op.create_table(
        "homework_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("lesson_id", "student_id", name="uq_homework_answers_lesson_student"),
    )
    op.create_index(op.f("ix_homework_answers_id"), "homework_answers", ["id"], unique=False)
    op.create_index(op.f("ix_homework_answers_lesson_id"), "homework_answers", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_homework_answers_student_id"), "homework_answers", ["student_id"], unique=False)

    op.create_table(
        "homework_answer_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("answer_id", sa.Integer(), sa.ForeignKey("homework_answers.id"), nullable=False),
        sa.Column("object_key", sa.String(), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_homework_answer_files_id"), "homework_answer_files", ["id"], unique=False)
    op.create_index(op.f("ix_homework_answer_files_answer_id"), "homework_answer_files", ["answer_id"], unique=False)

    op.create_table(
        "lesson_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_lesson_messages_id"), "lesson_messages", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_messages_lesson_id"), "lesson_messages", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_lesson_messages_student_id"), "lesson_messages", ["student_id"], unique=False)

    # Старые комментарии к оценке → первое сообщение педагога в диалоге.
    # Автор — кто ставил отметку, иначе педагог группы.
    op.execute("""
        INSERT INTO lesson_messages (lesson_id, student_id, author_id, text, created_at)
        SELECT m.lesson_id, m.student_id, COALESCE(m.marked_by, g.teacher_id), m.comment,
               COALESCE(m.marked_at, m.created_at, now())
        FROM lesson_marks m
        JOIN lessons l ON l.id = m.lesson_id
        JOIN groups g ON g.id = l.group_id
        WHERE m.comment IS NOT NULL AND btrim(m.comment) <> ''
    """)


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_messages_student_id"), table_name="lesson_messages")
    op.drop_index(op.f("ix_lesson_messages_lesson_id"), table_name="lesson_messages")
    op.drop_index(op.f("ix_lesson_messages_id"), table_name="lesson_messages")
    op.drop_table("lesson_messages")
    op.drop_index(op.f("ix_homework_answer_files_answer_id"), table_name="homework_answer_files")
    op.drop_index(op.f("ix_homework_answer_files_id"), table_name="homework_answer_files")
    op.drop_table("homework_answer_files")
    op.drop_index(op.f("ix_homework_answers_student_id"), table_name="homework_answers")
    op.drop_index(op.f("ix_homework_answers_lesson_id"), table_name="homework_answers")
    op.drop_index(op.f("ix_homework_answers_id"), table_name="homework_answers")
    op.drop_table("homework_answers")
    op.drop_index(op.f("ix_homework_tasks_student_id"), table_name="homework_tasks")
    op.drop_index(op.f("ix_homework_tasks_material_id"), table_name="homework_tasks")
    op.drop_index(op.f("ix_homework_tasks_lesson_id"), table_name="homework_tasks")
    op.drop_index(op.f("ix_homework_tasks_id"), table_name="homework_tasks")
    op.drop_table("homework_tasks")
    op.drop_index(op.f("ix_materials_content_hash"), table_name="materials")
    op.drop_column("materials", "content_hash")
    op.drop_column("materials", "is_personal")
