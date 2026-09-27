"""Текст из файла урока — для Помощника квиза (промпт с материалами урока).

docx / pptx — это zip с XML: читаем стандартной библиотекой (без новых
зависимостей). pdf — через pypdf. txt / md — как есть. Картинки и сканы
текста не дают — вернётся пустая строка.
"""
import io
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

SUPPORTED = {".docx", ".pptx", ".pdf", ".txt", ".md"}


def _docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    lines = []
    for p in root.iter(f"{W}p"):
        text = "".join(t.text or "" for t in p.iter(f"{W}t")).strip()
        if text:
            lines.append(text)
    return "\n".join(lines)


def _pptx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        names.sort(key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))
        out = []
        for i, name in enumerate(names, 1):
            root = ET.fromstring(z.read(name))
            paras = []
            for p in root.iter(f"{A}p"):
                text = "".join(t.text or "" for t in p.iter(f"{A}t")).strip()
                if text:
                    paras.append(text)
            if paras:
                out.append(f"[Слайд {i}]\n" + "\n".join(paras))
    return "\n\n".join(out)


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()


def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".docx":
        return _docx(data)
    if ext == ".pptx":
        return _pptx(data)
    if ext == ".pdf":
        return _pdf(data)
    if ext in (".txt", ".md"):
        return data.decode("utf-8", errors="replace")
    raise ValueError("Текст из этого формата не достать — поддерживаются docx, pptx, pdf, txt, md")
