from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from .models import Base
from .routers import auth, quizzes, i18n, admin, groups, lessons
import threading
import time
import logging
from .i18n_auto import build_translations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(quizzes.router)
app.include_router(i18n.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(lessons.router)

def start_translation_worker():
    def worker_loop():
        while True:
            try:
                # logger.info("⏰ Running translation worker...")
                build_translations()
                # logger.info("✅ Translation worker cycle completed.")
            except Exception as e:
                logger.exception(f"❌ Translation worker error: {e}")
            time.sleep(60)

    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()
    # logger.info("🔄 Translation worker thread started.")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    start_translation_worker()