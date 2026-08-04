import os
import sys

from dotenv import load_dotenv
from langchain_nvidia_ai_endpoints import ChatNVIDIA

sys.stdout.reconfigure(encoding="utf-8")
load_dotenv()

llm = ChatNVIDIA(
    model="openai/gpt-oss-20b",
    api_key=os.getenv("NVIDIA_API_KEY"),
    temperature=1,
    top_p=1,
    max_completion_tokens=16384,
    seed=42,
    timeout=180,
)