import os
from jinja2 import Template

def generate_quiz_html(title, theme, lesson_number, questions, language="ru"):
    template_path = os.path.join(os.path.dirname(__file__), "..", "templates", "logacademy-quiz.html")
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            template_str = f.read()
    else:
        template_str = "<html><head><meta charset='UTF-8'><title>{{ title }}</title></head><body><h1>{{ title }}</h1><ul>{% for q in questions %}<li>{{ q.question }} — {{ q.answer }}</li>{% endfor %}</ul></body></html>"
    template = Template(template_str)
    return template.render(
        title=title,
        theme=theme,
        lesson_number=lesson_number,
        questions=[{"question": q.question, "answer": q.answer, "timer": q.timer} for q in questions],
        language=language
    )
