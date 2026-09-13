import logging
import threading

from .routers.i18n import translator

logger = logging.getLogger(__name__)


def start_translation_worker(interval: int = 1800) -> None:
    """
    Фоновый поток: раз в interval секунд пересканировать проект (extract)
    и перевести накопленную очередь (process_queue) — обе операции делает
    Translator.run_translation_loop() из autoi18n за один вызов.
    """
    thread = threading.Thread(
        target=translator.run_translation_loop,
        kwargs={"interval": interval},
        daemon=True,
    )
    thread.start()
    logger.info(f"autoi18n: фоновый воркер запущен (interval={interval}s)")
