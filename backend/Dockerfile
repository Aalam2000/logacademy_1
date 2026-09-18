FROM python:3.12-slim

WORKDIR /app

# Node.js обязателен для autoi18n — сканирование JS/JSX/TSX идёт через
# настоящий AST-парсер (Babel), не через регулярки (см. README autoi18n).
# libreoffice-writer/calc/impress (тянут libreoffice-core с бинарём soffice) —
# для headless-конвертации docx/xlsx/pptx в PDF при предпросмотре файла
# (см. /materials/{id}/preview в routers/materials.py). Конвертация всегда
# заново, без кэша — решение Андрея, 2026-09-18.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl fonts-dejavu-core \
       libreoffice-writer libreoffice-calc libreoffice-impress \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Зависимости JS-моста autoi18n (@babel/parser, @babel/traverse) ставятся
# отдельно — pip их не устанавливает, это npm-пакет внутри самой библиотеки.
RUN AUTOI18N_DIR=$(python -c "import autoi18n, os; print(os.path.join(os.path.dirname(autoi18n.__file__), 'extractor', 'js_bridge'))") \
    && cd "$AUTOI18N_DIR" && npm install --omit=dev

COPY . .

# Непривилегированный пользователь для рантайма — раньше контейнер работал
# от root, что увеличивает ущерб при потенциальной уязвимости в LibreOffice
# (конвертация загруженных docx/xlsx/pptx в PDF, см. routers/materials.py).
# UID/GID фиксированы (1000) — если после деплоя backend упадёт с
# Permission denied на translations/ или .env, на сервере:
#   sudo chown -R 1000:1000 translations .env.prod
# -m создаёт домашнюю директорию — она нужна LibreOffice под свой профиль,
# без неё soffice может не запуститься от непривилегированного юзера.
RUN groupadd -g 1000 appuser \
    && useradd -m -u 1000 -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser
ENV HOME=/home/appuser

CMD ["sh", "-c", "python -m app.migrate_bootstrap && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]