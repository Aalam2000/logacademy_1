FROM python:3.12-slim

WORKDIR /app

# Node.js обязателен для autoi18n — сканирование JS/JSX/TSX идёт через
# настоящий AST-парсер (Babel), не через регулярки (см. README autoi18n).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl fonts-dejavu-core \
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

CMD ["sh", "-c", "python -m app.migrate_bootstrap && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]