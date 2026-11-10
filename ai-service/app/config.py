import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").strip().lower() or "groq"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or None
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip() or "qwen/qwen3.8-27b"
GROQ_API_BASE_URL = (
    os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1").strip().rstrip("/")
    or "https://api.groq.com/openai/v1"
)
GROQ_TIMEOUT_SECONDS = 40
AI_REQUEST_TIMEOUT_SECONDS = 45
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "").strip() or None
