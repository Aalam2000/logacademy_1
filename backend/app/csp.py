"""Разбор и нормализация CSP-отчётов браузера (без БД — чистые функции).

Браузеры шлют два формата:
- report-uri: Content-Type application/csp-report,
  тело {"csp-report": {"document-uri": …, "blocked-uri": …, …}};
- report-to (Reporting API): application/reports+json,
  тело [{"type": "csp-violation", "body": {"documentURL": …, …}}, …].

normalize() приводит отчёт к виду, по которому считается fingerprint:
одинаковые по смыслу нарушения дают одну строку в csp_reports.
"""
import hashlib
import re
from urllib.parse import urlsplit

# Расширения браузера и служебные схемы — не наш код, только шум.
IGNORED_SCHEMES = (
    "chrome-extension", "moz-extension", "safari-extension", "safari-web-extension",
    "ms-browser-extension", "webkit-masked-url", "about",
)
KEYWORDS = {"inline", "eval", "self", "data", "blob", "wasm-eval", "trusted-types-policy",
            "trusted-types-sink"}

_ID_SEGMENT = re.compile(r"^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,})$", re.I)
# Хэш в именах собранных Vite файлов: index-AbC12_3x.js -> index-*.js
_ASSET_HASH = re.compile(r"-[A-Za-z0-9_-]{8,}(\.(?:js|css|mjs))$")


def _clip(value, limit: int = 300) -> str:
    return str(value or "")[:limit]


def _path(url: str) -> str:
    """Путь страницы без query, числовые/uuid сегменты -> :id."""
    try:
        path = urlsplit(url).path or "/"
    except ValueError:
        return _clip(url, 200)
    segs = [":id" if _ID_SEGMENT.match(s) else s for s in path.split("/")]
    return _clip("/".join(segs) or "/", 200)


def _blocked(value: str) -> str:
    """Источник: ключевое слово (inline/eval/data…) или только scheme://host."""
    v = (value or "").strip()
    if not v:
        return "inline"
    if v in KEYWORDS:
        return v
    parts = urlsplit(v)
    if parts.scheme and parts.netloc:
        return f"{parts.scheme}://{parts.netloc}"
    if parts.scheme:                       # data:, blob: и т.п. без хоста
        return parts.scheme
    return _clip(v, 100)


def _source(file: str, line) -> str:
    if not file:
        return ""
    parts = urlsplit(file)
    if parts.scheme in IGNORED_SCHEMES:
        return file
    path = _ASSET_HASH.sub(r"-*\1", _path(file))
    host = parts.netloc
    ref = path if not host else f"{parts.scheme}://{host}{path}"
    return _clip(f"{ref}:{line}" if line else ref, 300)


def _is_ignored(*urls: str) -> bool:
    for u in urls:
        scheme = (u or "").split(":", 1)[0].lower()
        if scheme in IGNORED_SCHEMES:
            return True
    return False


def extract(payload) -> list[dict]:
    """Тело запроса (оба формата) -> список «сырых» отчётов в едином виде."""
    raw = []
    if isinstance(payload, dict) and isinstance(payload.get("csp-report"), dict):
        r = payload["csp-report"]
        raw.append({
            "page": r.get("document-uri"),
            "blocked": r.get("blocked-uri"),
            "directive": r.get("effective-directive") or r.get("violated-directive"),
            "file": r.get("source-file"),
            "line": r.get("line-number"),
            "disposition": r.get("disposition"),
            "sample": r.get("script-sample"),
        })
    elif isinstance(payload, list):
        for item in payload[:50]:
            if not isinstance(item, dict) or item.get("type") != "csp-violation":
                continue
            b = item.get("body") or {}
            raw.append({
                "page": b.get("documentURL") or item.get("url"),
                "blocked": b.get("blockedURL"),
                "directive": b.get("effectiveDirective"),
                "file": b.get("sourceFile"),
                "line": b.get("lineNumber"),
                "disposition": b.get("disposition"),
                "sample": b.get("sample"),
            })
    return raw


def normalize(r: dict) -> dict | None:
    """Сырой отчёт -> поля строки csp_reports (+fingerprint) или None (шум)."""
    if _is_ignored(r.get("blocked") or "", r.get("file") or "", r.get("page") or ""):
        return None
    directive = _clip((r.get("directive") or "unknown").split()[0], 60)
    row = {
        "directive": directive,
        "blocked": _blocked(r.get("blocked") or ""),
        "page": _path(r.get("page") or ""),
        "source": _source(r.get("file") or "", r.get("line")),
        "disposition": _clip(r.get("disposition") or "report", 20),
        "sample": _clip(r.get("sample"), 200) or None,
    }
    key = "|".join([row["directive"], row["blocked"], row["page"], row["source"], row["disposition"]])
    row["fingerprint"] = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return row
