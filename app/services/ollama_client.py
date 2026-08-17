import requests
import json
from app.core.config import settings

def generate_questions(topic, lesson, count, language="ru"):
    prompt = f"""Ты — помощник преподавателя. Сгенерируй {count} вопросов с ответами по теме "{topic}" для урока {lesson}.
Язык: {language}.
Ответ должен быть в формате JSON списка объектов с полями "question" и "answer".
Пример: [{{"question": "Что такое ...?", "answer": "Это ..."}}]"""
    payload = {
        "model": "llama3.2",
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(settings.OLLAMA_URL, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        raw = data.get("response", "")
        import re
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        else:
            return json.loads(raw)
    except Exception as e:
        return [{"question": "Пример вопроса", "answer": "Пример ответа"}]
