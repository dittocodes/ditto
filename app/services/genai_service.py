import os
import google.generativeai as genai
from dotenv import load_dotenv

from app.services.gemini_gateway import _MODELS

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


class _FallbackModel:
    """Try Gemini 2.5 Flash, then smaller Flash models if that call fails."""

    def generate_content(self, prompt, **kwargs):
        last_error = None
        for name in _MODELS:
            try:
                response = genai.GenerativeModel(name).generate_content(prompt, **kwargs)
                if getattr(response, "text", None):
                    return response
            except Exception as exc:
                last_error = exc
        if last_error:
            raise last_error
        raise RuntimeError("Insight service is not configured")


model = _FallbackModel()




