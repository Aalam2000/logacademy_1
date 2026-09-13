import logging
from fastapi import APIRouter, Request, Response
from autoi18n import Translator

logger = logging.getLogger("i18n-trace")

router = APIRouter(prefix="/i18n", tags=["i18n"])

# Единый экземпляр Translator для всего backend (используется также в
# routers/quizzes.py для перевода HTML-шаблонов квизов).
translator = Translator(env_path=".env")


@router.get("/languages")
async def get_languages():
    return {
        "languages": [
            {"code": lang, "name": lang}
            for lang in [translator.source_lang] + translator.get_target_langs()
        ],
        "default": translator.source_lang,
    }


@router.get("/translations")
async def get_translations(lang: str = "ru"):
    """Плоский словарь {оригинальный_текст: перевод} — именно его ждёт
    клиентский рантайм (window.autoI18n.setLanguage) при смене языка."""
    result = translator.get_translations_dict(lang)
    logger.info(f"🔍[i18n-trace] 3f-BACKEND. GET /i18n/translations?lang={lang} -> {len(result)} переводов")
    return result


@router.get("/runtime.js")
async def get_runtime_js(request: Request, lang: str = "ru"):
    """
    Клиентский JS-рантайм для React-фронтенда — подключается один раз
    в точке входа (frontend/src/index.js), без правок кода компонентов.

    URL для смены языка внутри рантайма делаем абсолютным (а не
    относительным) — сам скрипт выполняется в контексте страницы на
    origin фронтенда (localhost:3000 в dev), а не на origin backend'а,
    откуда он был загружен. Относительный fetch('/i18n/translations...')
    ушёл бы на фронтенд-сервер и получил бы обратно его index.html вместо
    JSON. Берём origin прямо из входящего запроса — так работает и в dev,
    и при любой конфигурации reverse-proxy в проде.
    """
    base = str(request.base_url).rstrip("/")
    translations_url_template = f"{base}/i18n/translations?lang={{lang}}"
    logger.info(f"🔍[i18n-trace] 0-BACKEND. GET /i18n/runtime.js?lang={lang} | translations_url_template={translations_url_template}")
    script = translator.build_runtime(
        lang,
        dynamic_dom_enabled=True,
        translations_url_template=translations_url_template,
    )
    return Response(content=script, media_type="application/javascript")


@router.post("/languages")
async def add_language(lang: str):
    """Добавить целевой язык 'на лету' (для будущей админки): дописывает
    .env и сразу переводит на него весь известный реестр фраз."""
    return translator.add_target_lang(lang)
