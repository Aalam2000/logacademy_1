import logging
import os

from fastapi import APIRouter, Depends, Request, Response
from autoi18n import Translator

from ..dependencies import require_admin
from ..models import User

logger = logging.getLogger("i18n-trace")

router = APIRouter(prefix="/i18n", tags=["i18n"])

# Единый экземпляр Translator для всего backend (используется также в
# routers/quizzes.py для перевода HTML-шаблонов квизов).
translator = Translator(env_path=".env")

# POST /i18n/languages дёргает библиотеку autoi18n, а она переводит СРАЗУ
# весь реестр исходного языка через OpenAI (платно, синхронно). Библиотека
# общая для разных проектов, поэтому свой порог "сколько можно отправить за
# один раз" держим тут, в проекте, а не в библиотеке. Меряем размер файла
# реестра в КБ — это быстрее и проще, чем парсить JSON и считать фразы.
# Ориентир: сейчас ~285 фраз ~= 21 КБ (~76 байт/фразу); 5000 фраз ~= 372 КБ.
# Порог берём с запасом.
MAX_REGISTRY_KB = 400


def _registry_size_kb() -> float:
    """Размер файла реестра исходного языка (translations/{source_lang}.json)
    в КБ — то, что уйдёт в библиотеку (и дальше в OpenAI) при добавлении
    нового языка."""
    path = os.path.join(translator.cache_dir, f"{translator.source_lang}.json")
    try:
        return os.path.getsize(path) / 1024
    except OSError:
        return 0.0


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
async def add_language(lang: str, current_user: User = Depends(require_admin)):
    """Добавить целевой язык 'на лету' (для будущей админки): дописывает
    .env и сразу переводит на него весь известный реестр фраз.

    Защита: только админ (наружу этот путь и так не выпущен — см. nginx),
    и порог по объёму реестра (MAX_REGISTRY_KB) перед передачей в библиотеку.
    Если реестр больше порога — в библиотеку не передаём вообще (не будет
    синхронного платного вызова OpenAI), пишем тревогу в лог, дальше решает
    администратор."""
    size_kb = _registry_size_kb()
    if size_kb > MAX_REGISTRY_KB:
        logger.error(
            f"🚨[i18n-guard] POST /i18n/languages?lang={lang} ЗАБЛОКИРОВАН: "
            f"реестр исходного языка {size_kb:.1f} КБ превышает лимит {MAX_REGISTRY_KB} КБ. "
            f"В библиотеку не передано, OpenAI не вызывался. Инициатор: {current_user.username}."
        )
        return {"added": 0, "translated": 0, "blocked": True, "registry_kb": round(size_kb, 1)}
    return translator.add_target_lang(lang)
