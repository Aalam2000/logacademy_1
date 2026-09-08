from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from .database import Base


# Все пользователи: admin | teacher | student
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False, default="teacher")  # admin | teacher | student
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # кто создал пользователя
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    telegram_username = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)  # путь к фото, MinIO — этап 2


# Курс / тема преподавания
class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Группа — поток учеников по курсу
class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(String, nullable=False)
    telegram_chat_id = Column(String, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False, default="active")  # active | archived
    invite_code = Column(String, unique=True, nullable=False)  # для регистрации студентов по QR
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Состав группы
class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False, default="active")  # active | expelled
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


# Урок — одна запись на группу, копируется для новых групп
class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, nullable=False, default=0)  # порядок урока в группе
    date = Column(DateTime(timezone=True), nullable=True)  # дата проведения
    is_open = Column(Boolean, nullable=False, default=False)  # педагог открывает доступ
    source = Column(String, nullable=True)  # academy | teacher
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Квизы — привязаны к уроку
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)  # привязка к уроку
    title = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    type = Column(String, nullable=False)  # flash | live | sprint
    template_type = Column(String, nullable=False, default="flash")
    html_content = Column(Text, nullable=False)
    html_translations = Column(JSON, default={})
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())