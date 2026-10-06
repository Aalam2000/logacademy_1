#!/usr/bin/env python3
"""Уроки из ночных копий базы: дата и время, комментарий, кто пришёл.

Только чтение: ни рабочая база, ни копии не меняются. Таблицы читаются
прямо из файлов db.dump (pg_restore печатает их данные в поток).
Для каждого урока берётся самая свежая копия, в которой он ещё был.

Запуск на сервере, от quizadm, из папки проекта:
    python3 scripts/lessons-from-backup.py 2026-09-29 2026-10-02
Даты — по Баку, обе границы включительно.
"""
import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("PROJECT_DIR", "/var/www/quiz"))
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", "/var/backups/logacademy"))
BAKU = timezone(timedelta(hours=4))
TABLES = ("lessons", "lesson_marks", "lesson_students", "groups", "users")
PRESENT = {"in_person": "очно", "online": "онлайн"}

COPY_HEAD = re.compile(r"^COPY (?:\w+\.)?(\w+) \((.*)\) FROM stdin;$")
ESCAPE = re.compile(r"\\(.)")
ESCAPES = {"t": "\t", "n": "\n", "r": "\r", "b": "\b", "f": "\f", "v": "\v"}
STAMP = re.compile(r"^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)(?:\.\d+)?([+-])(\d\d)(?::?(\d\d))?")


def field(raw):
    if raw == r"\N":
        return None
    return ESCAPE.sub(lambda m: ESCAPES.get(m.group(1), m.group(1)), raw)


def read_dump(path):
    """{таблица: [строка-словарь, ...]} из одного db.dump."""
    command = ["pg_restore", "--data-only", "-f", "-"]
    for table in TABLES:
        command += ["-t", table]
    out = subprocess.run(command + [str(path)], check=True, capture_output=True).stdout.decode("utf-8")
    data, columns, rows = {}, None, None
    for line in out.split("\n"):
        if columns is None:
            head = COPY_HEAD.match(line)
            if head:
                columns = [c.strip().strip('"') for c in head.group(2).split(",")]
                rows = data.setdefault(head.group(1), [])
        elif line == "\\.":
            columns = None
        else:
            rows.append(dict(zip(columns, map(field, line.split("\t")))))
    return data


def baku_time(text):
    m = STAMP.match(text or "")
    if not m:
        return None
    day, clock, sign, hours, minutes = m.groups()
    offset = timedelta(hours=int(hours), minutes=int(minutes or 0))
    zone = timezone(offset if sign == "+" else -offset)
    return datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=zone).astimezone(BAKU)


def live_lesson_ids():
    """id уроков в рабочей базе; None — узнать не удалось."""
    try:
        env = (PROJECT_DIR / ".env.prod").read_text(encoding="utf-8")
        url = re.search(r"^DATABASE_URL=(.*)$", env, re.M).group(1).strip()
        url = re.sub(r"@172\.18\.0\.1:", "@localhost:", url.replace("+asyncpg", ""))
        out = subprocess.run(["psql", url, "-Atc", "SELECT id FROM lessons"],
                             check=True, capture_output=True).stdout.decode()
        return set(out.split())
    except Exception:
        return None


def person(users, user_id):
    user = users.get(user_id) or {}
    return user.get("full_name") or user.get("username") or f"id {user_id}"


def main():
    try:
        first, last = (date.fromisoformat(a) for a in sys.argv[1:3])
    except ValueError:
        sys.exit("Запуск: python3 scripts/lessons-from-backup.py ГГГГ-ММ-ДД ГГГГ-ММ-ДД")

    dumps = sorted(BACKUP_DIR.glob("20*/db.dump"), reverse=True)  # от свежей копии к старой
    if not dumps:
        sys.exit(f"В {BACKUP_DIR} копий нет")

    found = {}  # id урока -> запись для печати
    for dump in dumps:
        data = read_dump(dump)
        groups = {g["id"]: g["name"] for g in data.get("groups", [])}
        users = {u["id"]: u for u in data.get("users", [])}
        for lesson in data.get("lessons", []):
            when = baku_time(lesson["date"])
            if lesson["id"] in found or when is None or not first <= when.date() <= last:
                continue
            came = [
                person(users, m["student_id"]) + " (" + PRESENT[m["attendance_status"]]
                + (", опоздал" if m["is_late"] == "t" else "") + ")"
                for m in data.get("lesson_marks", [])
                if m["lesson_id"] == lesson["id"] and m["attendance_status"] in PRESENT
            ]
            members = [person(users, s["student_id"]) for s in data.get("lesson_students", [])
                       if s["lesson_id"] == lesson["id"]]
            found[lesson["id"]] = {
                "when": when, "copy": dump.parent.name, "id": lesson["id"],
                "group": groups.get(lesson["group_id"], f"id {lesson['group_id']}"),
                "title": lesson["title"], "comment": lesson.get("comment"),
                "personal": lesson.get("is_personal") == "t",
                "members": sorted(members), "came": sorted(came),
            }

    live = live_lesson_ids()
    print(f"Копий просмотрено: {len(dumps)} ({dumps[-1].parent.name} … {dumps[0].parent.name})")
    print(f"Уроков с {first:%d.%m.%Y} по {last:%d.%m.%Y}: {len(found)}")
    if live is None:
        print("Рабочую базу прочитать не удалось — что удалено, не отмечено.")
    for row in sorted(found.values(), key=lambda r: (r["when"], r["group"])):
        state = "" if live is None else ("   [есть в рабочей базе]" if row["id"] in live else "   [УДАЛЁН]")
        kind = "персональный урок" if row["personal"] else "урок группы"
        print()
        print(f"{row['when']:%d.%m.%Y %H:%M}   {row['group']}   «{row['title']}»   {kind}{state}")
        comment = (row["comment"] or "—").strip().replace("\n", "\n" + " " * 15)
        print(f"  Комментарий: {comment}")
        if row["personal"]:
            print(f"  Участники:   {', '.join(row['members']) or '—'}")
        print(f"  Пришли:      {', '.join(row['came']) or '—'}")
        print(f"  Копия:       {row['copy']}")


if __name__ == "__main__":
    main()
