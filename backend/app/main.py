from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, quizzes, i18n, admin, groups, lessons, materials, links, library, students
import logging
from .i18n_auto import start_translation_worker

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
app.include_router(materials.router)
app.include_router(links.router)
app.include_router(library.router)
app.include_router(students.router)


@app.on_event("startup")
async def startup():
    start_translation_worker(interval=1800)
