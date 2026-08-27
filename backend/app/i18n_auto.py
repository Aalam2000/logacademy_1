import os
import json
import logging
from dotenv import load_dotenv
from autoi18n import Translator

load_dotenv()
logger = logging.getLogger(__name__)

def build_translations():
    # logger.info("🔍 Scanning React sources...")
    translator = Translator(
        api_key=os.getenv("OPENAI_API_KEY"),
        source_lang=os.getenv("SOURCE_LANG", "ru"),
        target_langs=os.getenv("AUTO_I18N_TARGET_LANGS", "en,uk,az,tr").split(','),
        cache_dir=os.getenv("AUTO_I18N_TRANSLATIONS_DIR", "./translations"),
    )

    # Используем три отдельных glob'а
    js_globs = [
        "/app/frontend_src/**/*.js",
        "/app/frontend_src/**/*.jsx",
        "/app/frontend_src/**/*.tsx"
    ]
    report = translator.extract_js_keys(js_globs=js_globs)   # без namespace
    # logger.info(f"   Extracted: {report['extracted']}, Queued: {report['queued']}")

    # logger.info("🔄 Translating...")
    for lang in translator.target_langs:
        if lang != translator.source_lang:
            processed = translator.process_pending_translations(target_lang=lang, batch_size=50)
            logger.info(f"   {lang}: {processed} items translated")

    os.makedirs("translations", exist_ok=True)
    for lang in [translator.source_lang] + translator.target_langs:
        translations = translator.get_frontend_translations(lang)
        # Убедимся, что ключи чистые (без хешей) – get_frontend_translations уже возвращает {text: translation}
        with open(f"translations/{lang}.json", "w", encoding="utf-8") as f:
            json.dump(translations, f, ensure_ascii=False, indent=2)
        # logger.info(f"   ✅ {lang}.json saved")

    # logger.info("🎉 All translations built!")