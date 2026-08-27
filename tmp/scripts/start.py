# diagnose_translation.py
import os, json, subprocess

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(root)

report = []
report.append("=" * 60)
report.append("ДИАГНОСТИКА ПЕРЕВОДА")
report.append("=" * 60)

# 1. Проверить переменные окружения
env_file = os.path.join(root, ".env")
if os.path.isfile(env_file):
    with open(env_file, 'r') as f:
        env_content = f.read()
    report.append("\n📄 .env:")
    for line in env_content.splitlines():
        if "OPENAI_API_KEY" in line:
            if "sk-" in line:
                report.append("  ✅ OPENAI_API_KEY установлен")
            else:
                report.append("  ❌ OPENAI_API_KEY не похож на ключ")
        elif "AUTO_I18N_TARGET_LANGS" in line:
            report.append(f"  ✅ {line}")
else:
    report.append("❌ .env отсутствует")

# 2. Проверить наличие таблицы quizzes и поле html_translations
try:
    result = subprocess.run(
        ["docker", "exec", "logacademy_db", "psql", "-U", "logacademy", "-d", "logacademy", "-c", "\\d quizzes"],
        capture_output=True, text=True, timeout=5
    )
    if result.returncode == 0:
        report.append("\n🐘 Структура таблицы quizzes:")
        report.append(result.stdout)
        if "html_translations" in result.stdout:
            report.append("  ✅ Поле html_translations существует")
        else:
            report.append("  ❌ Поле html_translations отсутствует")
    else:
        report.append("\n⚠️ Ошибка получения структуры БД")
except Exception as e:
    report.append(f"\n⚠️ Ошибка: {e}")

# 3. Проверить содержимое таблицы quizzes
try:
    result = subprocess.run(
        ["docker", "exec", "logacademy_db", "psql", "-U", "logacademy", "-d", "logacademy", "-c", "SELECT id, title, html_translations FROM quizzes;"],
        capture_output=True, text=True, timeout=5
    )
    if result.returncode == 0:
        report.append("\n📋 Данные из quizzes:")
        report.append(result.stdout)
    else:
        report.append("\n⚠️ Ошибка запроса")
except Exception as e:
    report.append(f"\n⚠️ Ошибка: {e}")

# 4. Проверить логи бэкенда на наличие ошибок перевода
try:
    logs = subprocess.check_output(
        ["docker", "logs", "logacademy_backend", "--tail", "100"],
        stderr=subprocess.STDOUT, text=True, timeout=5
    )
    report.append("\n📋 Логи бэкенда (последние 100 строк):")
    report.append(logs)
except Exception as e:
    report.append(f"\n⚠️ Не удалось получить логи: {e}")

# Запись отчёта
reports_dir = os.path.join(root, "tmp", "reports")
os.makedirs(reports_dir, exist_ok=True)
report_path = os.path.join(reports_dir, "translation_diagnostic.txt")
with open(report_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(report))

print(f"✅ Отчёт сохранён: {report_path}")