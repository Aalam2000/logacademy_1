import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./logacademy.db")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")

settings = Settings()
