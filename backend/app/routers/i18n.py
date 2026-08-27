from fastapi import APIRouter, HTTPException
import os
import json
from autoi18n import Translator
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/i18n", tags=["i18n"])

translator = Translator(
    api_key=os.getenv("OPENAI_API_KEY"),
    source_lang=os.getenv("SOURCE_LANG", "ru"),
    target_langs=os.getenv("AUTO_I18N_TARGET_LANGS", "en,uk,az,tr").split(','),
    cache_dir=os.getenv("AUTO_I18N_TRANSLATIONS_DIR", "./translations"),
)

@router.get("/languages")
async def get_languages():
    target_langs = os.getenv("AUTO_I18N_TARGET_LANGS", "en,uk,az,tr").split(',')
    source_lang = os.getenv("SOURCE_LANG", "ru")
    return {
        "languages": [{"code": lang, "name": lang} for lang in [source_lang] + target_langs],
        "default": source_lang
    }

@router.get("/translations")
async def get_translations(lang: str = "ru"):
    file_path = os.path.join("translations", f"{lang}.json")
    if os.path.isfile(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

@router.post("/translate")
async def translate_text(text: str, target_lang: str):
    try:
        translated = translator.translate_text(text, target_lang, page_name="api")
        return {"translated": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))