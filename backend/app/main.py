from __future__ import annotations
import asyncio
import csv
import io
import json
import os
import queue
import re
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field, field_validator

from .editorial import generate_editorial

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
ENGINE = BACKEND / "engine" / "trendsignal_scout_v6_6.py"
DATA_DIR = BACKEND / "data"
RUNS_DIR = DATA_DIR / "runs"
CACHE_DIR = DATA_DIR / "cache"
DB_PATH = DATA_DIR / "history.sqlite3"
load_dotenv(ROOT / ".env", override=False)
load_dotenv(BACKEND / ".env", override=False)
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
EDITORIAL_MODEL = os.getenv("OPENAI_EDITORIAL_MODEL", "gpt-5.5")
ALLOWED_SOURCES = {"news", "hn", "github", "openalex", "arxiv", "gdelt", "reddit", "youtube", "trends"}
SOURCE_LABELS = {
    "news": "Google News RSS", "hn": "Hacker News", "github": "GitHub",
    "openalex": "OpenAlex", "arxiv": "arXiv", "gdelt": "GDELT",
    "reddit": "Reddit", "youtube": "YouTube", "trends": "Google Trends"
}
analysis_lock = asyncio.Lock()
progress_lock = threading.Lock()
_progress_started_mono: float | None = None
_progress_updated_mono: float | None = None
_progress_state: dict[str, Any] = {
    "status": "idle", "stage": "idle", "label": "Listo para investigar",
    "percent": 0, "detail": "Escribe una pregunta para iniciar una investigación.",
    "started_at": None, "updated_at": None, "run_id": None,
}

def set_progress(stage: str, label: str, percent: int, detail: str, *, status: str = "running", run_id: str | None = None, reset: bool = False) -> None:
    """Thread-safe progress snapshot consumed by the React app while analysis runs."""
    global _progress_started_mono, _progress_updated_mono
    stamp = now_iso()
    mono = time.monotonic()
    with progress_lock:
        if reset or _progress_started_mono is None:
            _progress_started_mono = mono
            _progress_state["started_at"] = stamp
        _progress_updated_mono = mono
        _progress_state.update({
            "status": status, "stage": stage, "label": label,
            "percent": max(0, min(int(percent), 100)), "detail": detail[:800],
            "updated_at": stamp, "run_id": run_id or _progress_state.get("run_id"),
        })

def get_progress_snapshot() -> dict[str, Any]:
    mono = time.monotonic()
    with progress_lock:
        snapshot = dict(_progress_state)
        started = _progress_started_mono
        updated = _progress_updated_mono
    snapshot["elapsed_seconds"] = round(max(0, mono - started), 1) if started is not None else 0
    snapshot["stalled_for_seconds"] = round(max(0, mono - updated), 1) if updated is not None and snapshot.get("status") == "running" else 0
    return snapshot

for directory in (RUNS_DIR, CACHE_DIR):
    directory.mkdir(parents=True, exist_ok=True)


class AnalyzeRequest(BaseModel):
    question: str = Field(min_length=3, max_length=800)
    days: int = Field(default=7, ge=1, le=90)
    region: str = Field(default="PE", max_length=12)
    max_items: int = Field(default=20, ge=5, le=50)
    sources: list[str] = Field(default_factory=lambda: ["news", "hn", "github", "openalex", "arxiv", "youtube", "trends"])
    use_openai: bool = True
    discover_web: bool = True
    include_gdelt: bool = False
    use_reddit: bool = False

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("Escribe una pregunta de al menos 3 caracteres.")
        return value

    @field_validator("region")
    @classmethod
    def normalize_region(cls, value: str) -> str:
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{2,12}", value):
            raise ValueError("La región debe ser WORLD o un código como PE, MX, CO, AR o CL.")
        return value

    @field_validator("sources")
    @classmethod
    def validate_sources(cls, value: list[str]) -> list[str]:
        sources = list(dict.fromkeys([str(x).strip().lower() for x in value if str(x).strip()]))
        unknown = set(sources) - ALLOWED_SOURCES
        if unknown:
            raise ValueError("Fuentes no admitidas: " + ", ".join(sorted(unknown)))
        return sources


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db_connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with db_connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY, created_at TEXT NOT NULL, question TEXT NOT NULL,
            region TEXT NOT NULL, days INTEGER NOT NULL, status TEXT NOT NULL,
            records_count INTEGER NOT NULL DEFAULT 0, result_path TEXT NOT NULL,
            elapsed_seconds REAL NOT NULL DEFAULT 0
        )""")
        con.execute("CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC)")


def safe_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo leer el informe guardado: {exc}")


def _source_details(source_status: dict[str, Any]) -> list[dict[str, Any]]:
    status_by_label = source_status or {}
    out = []
    for key, label in SOURCE_LABELS.items():
        value = status_by_label.get(label, {"status": "not_selected", "records": 0})
        out.append({
            "key": key, "name": label, "status": value.get("status", "unknown"),
            "records": int(value.get("records", 0) or 0),
            "detail": str(value.get("error") or value.get("message") or value.get("note") or value.get("status", ""))[:260],
            "query_used": value.get("query_used"),
            "attempts": len(value.get("attempted_queries", []) or []),
        })
    return out


def normalize_result(payload: dict[str, Any], request: AnalyzeRequest, run_id: str, elapsed: float, log_tail: str) -> dict[str, Any]:
    items = payload.get("items", []) or []
    for idx, item in enumerate(items, start=1):
        item["evidence_id"] = f"R{idx:04d}"
        item.setdefault("source", "Fuente desconocida")
        item.setdefault("title", "Sin título")
        item.setdefault("summary", "")
        item.setdefault("url", "")
    fixed = payload.get("fixed_metrics", {}) or {}
    source_status = payload.get("source_status", {}) or {}
    counts = fixed.get("source_counts", {}) or {}
    successful_sources = sum(1 for s in _source_details(source_status) if s["status"] in {"ok", "ok_after_fallback"} and s["records"] > 0)
    valid_items = [x for x in items if not x.get("is_time_series") and x.get("collection_method") != "discovery"]
    discovery_items = [x for x in items if x.get("collection_method") == "discovery"]
    time_series = [x for x in items if x.get("is_time_series")]
    result = {
        "run_id": run_id, "created_at": payload.get("created_at") or now_iso(),
        "question": request.question, "region": request.region, "days": request.days,
        "status": "partial" if payload.get("errors") or successful_sources < 2 else "ok",
        "elapsed_seconds": round(elapsed, 1),
        "metrics": {
            "raw_records": len(items), "unique_content": fixed.get("content_count", len(valid_items)),
            "fixed_content": len(valid_items), "discovery_records": len(discovery_items),
            "google_trends_points": len(time_series), "sources_responding": successful_sources,
            "sources_requested": len(request.sources) + int(request.include_gdelt) + int(request.use_reddit),
            "date_coverage_pct": fixed.get("date_coverage_pct", 0),
            "records_with_dates": fixed.get("records_with_dates_in_window", 0),
            "undated_records": fixed.get("undated_content_count", 0),
            "excluded_future_dates": fixed.get("excluded_future_date_count", 0),
            "excluded_outside_window": fixed.get("excluded_outside_window_count", 0),
            "topics_count": len(fixed.get("topics", [])), "growth_candidates_count": len(fixed.get("candidate_signals", [])),
            "items_with_links": sum(1 for x in items if x.get("url")),
        },
        "sources": _source_details(source_status),
        "topics": fixed.get("topics", []),
        "growth_candidates": fixed.get("candidate_signals", []),
        "ai_subtopics": fixed.get("ai_subtopics", []),
        "items": items,
        "time_series": time_series,
        "discovery_status": payload.get("discovery_status", {}),
        "classification_status": payload.get("classification_status", {}),
        "narrative": payload.get("openai_synthesis", ""),
        "synthesis_audit": payload.get("synthesis_audit", {}),
        "methodology": payload.get("methodology", {}),
        "errors": payload.get("errors", []),
        "engine_log": log_tail[-7000:],
        "raw_metrics": fixed,
        "editorial": {"status": "pending", "opportunities": []},
        "model": MODEL if request.use_openai and os.getenv("OPENAI_API_KEY") else None,
        "engine_version": payload.get("version", "unknown"),
        "source_counts": counts,
    }
    return result


def run_engine(request: AnalyzeRequest, run_id: str) -> tuple[dict[str, Any], str, float]:
    if not ENGINE.exists():
        raise RuntimeError("No se encuentra el motor v6.6 en backend/engine.")
    start = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="trendsignal_run_") as temp_dir:
        outdir = Path(temp_dir) / "reports"
        selected = list(request.sources)
        # GDELT has an enforced, persistent pacing policy; opt-in only so a normal run does not stall.
        if request.include_gdelt and "gdelt" not in selected:
            selected.append("gdelt")
        if not request.include_gdelt:
            selected = [s for s in selected if s != "gdelt"]
        if request.use_reddit and "reddit" not in selected:
            selected.append("reddit")
        if not request.use_reddit:
            selected = [s for s in selected if s != "reddit"]
        if not selected:
            selected = ["news", "hn", "github"]
        command = [
            sys.executable, "-u", str(ENGINE), "--question", request.question,
            "--mode", "search", "--region", request.region, "--days", str(request.days),
            "--max-items", str(request.max_items), "--sources", ",".join(selected),
            # Bounded batch count: classification is a second-pass enrichment, not the bottleneck.
            "--classify-limit", "60", "--batch-size", "20", "--outdir", str(outdir),
        ]
        env = os.environ.copy()
        env["TRENDSIGNAL_CACHE_DIR"] = str(CACHE_DIR)
        if request.use_openai and env.get("OPENAI_API_KEY", "").strip():
            command.extend(["--openai", "--openai-model", MODEL])
            if request.discover_web:
                command.extend(["--discover-web", "--discovery-max-results", "6", "--discovery-max-domains", "4"])

        _set_sources_count = len(selected)
        sources_started = 0
        log_chunks: list[str] = []
        _tail_chars = 18000
        def record_line(line: str) -> None:
            nonlocal sources_started
            log_chunks.append(line)
            if sum(len(x) for x in log_chunks) > _tail_chars * 2:
                joined = "".join(log_chunks)[-_tail_chars:]
                log_chunks[:] = [joined]
            stripped = line.strip()
            if "[OPENAI] Planificando consultas" in stripped:
                set_progress("planning", "Preparando las consultas", 6, "OpenAI está adaptando la pregunta a las fuentes seleccionadas.", run_id=run_id)
            elif "[CONSULTANDO]" in stripped:
                sources_started += 1
                source_name = stripped.split("[CONSULTANDO]", 1)[1].strip().rstrip(".")
                pct = min(54, 9 + int(43 * sources_started / max(1, _set_sources_count)))
                set_progress("collection", f"Consultando {source_name}", pct, f"Conectores consultados: {sources_started} de {_set_sources_count}. Una fuente lenta no impide usar las demás si devuelve un error controlado.", run_id=run_id)
            elif "[BASE FIJA]" in stripped:
                set_progress("deduplication", "Consolidando y deduplicando registros", 55, stripped[:600], run_id=run_id)
            elif "[DESCUBRIMIENTO WEB]" in stripped:
                set_progress("web_discovery", "Buscando evidencia web complementaria", 59, "La búsqueda complementaria se mantiene separada de las métricas de crecimiento.", run_id=run_id)
            elif "[CLASIFICACIÓN SEMÁNTICA]" in stripped:
                set_progress("classification", "Clasificando los resultados", 65, "La IA revisa una muestra de títulos y resúmenes; las métricas finales siguen siendo calculadas por el motor.", run_id=run_id)
            elif "Clasificados semánticamente:" in stripped:
                set_progress("classification", "Validando la clasificación", 75, stripped[:600], run_id=run_id)
            elif "[VALIDACIÓN Y MÉTRICAS]" in stripped:
                set_progress("metrics", "Validando fechas y calculando métricas", 80, "Se excluyen fechas anómalas y se separan señales temporales y contenido fijo.", run_id=run_id)
            elif "[OPENAI] Generando síntesis" in stripped:
                set_progress("synthesis", "Sintetizando la evidencia", 87, "OpenAI interpreta los hallazgos sin sustituir las métricas calculadas.", run_id=run_id)
            elif "ARCHIVOS GENERADOS:" in stripped:
                set_progress("finalizing", "Preparando el informe", 94, "La investigación de fuentes terminó; queda preparar la estrategia editorial.", run_id=run_id)

        set_progress("collection", "Iniciando la investigación", 4, f"Preparando {len(selected)} fuentes. El avance se actualizará mientras llegan los registros.", run_id=run_id)
        try:
            process = subprocess.Popen(
                command, cwd=str(ROOT), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace", bufsize=1
            )
        except OSError as exc:
            raise RuntimeError(f"No se pudo iniciar el motor de investigación: {exc}") from exc

        output_queue: queue.Queue[str | None] = queue.Queue()
        def drain_output() -> None:
            assert process.stdout is not None
            try:
                for item in process.stdout:
                    output_queue.put(item)
            finally:
                output_queue.put(None)
        reader = threading.Thread(target=drain_output, name="trendsignal-engine-log-reader", daemon=True)
        reader.start()
        timeout_seconds = max(60, int(os.getenv("TRENDSIGNAL_ENGINE_TIMEOUT_SECONDS", "180")))
        reader_done = False
        while not reader_done or process.poll() is None:
            if time.monotonic() - start > timeout_seconds:
                process.kill()
                process.wait(timeout=5)
                raise RuntimeError(f"La recopilación superó el límite de {timeout_seconds} segundos. Prueba primero con 3–4 fuentes, reduce el máximo por fuente o desactiva la búsqueda web adicional.")
            try:
                line = output_queue.get(timeout=0.35)
                if line is None:
                    reader_done = True
                else:
                    record_line(line)
            except queue.Empty:
                pass
        reader.join(timeout=1)
        stdout = "".join(log_chunks)
        candidates = sorted(outdir.glob("*_raw.json")) if outdir.exists() else []
        if process.returncode != 0 or not candidates:
            raise RuntimeError("El motor de investigación no generó un informe válido. Revisa el estado del motor y las fuentes seleccionadas.\n" + stdout[-5000:])
        try:
            payload = json.loads(candidates[-1].read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"El motor terminó, pero el JSON del informe no se pudo leer: {exc}\n{stdout[-3000:]}") from exc
        elapsed = time.monotonic() - start
        return payload, stdout[-_tail_chars:], elapsed


def store_result(result: dict[str, Any]) -> None:
    result_path = RUNS_DIR / f"{result['run_id']}.json"
    temp_path = result_path.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(result_path)
    with db_connect() as con:
        con.execute("INSERT INTO runs(id, created_at, question, region, days, status, records_count, result_path, elapsed_seconds) VALUES(?,?,?,?,?,?,?,?,?)",
                    (result["run_id"], result["created_at"], result["question"], result["region"], result["days"], result["status"], result["metrics"]["fixed_content"], str(result_path), result["elapsed_seconds"]))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="TrendSignal Scout", version="1.2.0", description="Radar de tendencias y decisiones editoriales trazables", lifespan=lifespan)
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def home():
    # The React frontend runs independently through Vite on port 5173.
    return HTMLResponse("""<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>TrendSignal Scout · API</title><style>body{font:16px system-ui;background:#f7f8f4;color:#28463b;margin:0;display:grid;min-height:100vh;place-items:center}.card{max-width:540px;margin:24px;background:#fff;border:1px solid #e1e9e0;border-radius:18px;padding:32px;box-shadow:0 15px 50px #233d3012}h1{font-size:28px;margin:0 0 12px}p{color:#6e8176;line-height:1.7}a{display:inline-block;background:#347f72;color:white;padding:11px 16px;border-radius:9px;text-decoration:none;font-weight:700;margin:6px 8px 0 0;font-size:14px}.tag{display:inline-block;border-radius:30px;background:#eaf5ed;color:#46866d;padding:6px 10px;font-size:12px;font-weight:700}</style></head><body><main class=\"card\"><span class=\"tag\">BACKEND · API REST</span><h1>TrendSignal Scout</h1><p>El backend está separado del frontend React. Arranca el frontend con <code>npm run dev</code> dentro de <code>frontend/</code> y accede a la aplicación en el puerto 5173.</p><a href=\"http://127.0.0.1:5173\">Abrir frontend React ↗</a><a href=\"/docs\">Documentación API ↗</a></main></body></html>""")

@app.get("/api/health")
async def health():
    key_configured = bool(os.getenv("OPENAI_API_KEY", "").strip())
    return {
        "status": "ok", "app": "TrendSignal Scout", "version": app.version,
        "engine": ENGINE.exists(), "engine_version": "6.6", "openai_configured": key_configured,
        "openai_model": MODEL if key_configured else None,
        "editorial_model": EDITORIAL_MODEL if key_configured else None,
        "editorial_ai": key_configured, "web_discovery": key_configured,
        "youtube_configured": bool(os.getenv("YOUTUBE_API_KEY", "").strip()),
        "reddit_configured": bool(os.getenv("REDDIT_CLIENT_ID", "").strip() and os.getenv("REDDIT_CLIENT_SECRET", "").strip()),
        "github_token_configured": bool(os.getenv("GITHUB_TOKEN", "").strip()),
    }


@app.get("/api/progress")
async def progress():
    """Live progress snapshot polled by React while /api/analyze is still running."""
    return get_progress_snapshot()


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Escribe una pregunta de investigación.")
    run_id = str(uuid.uuid4())
    async with analysis_lock:
        set_progress("starting", "Preparando la investigación", 2, "Validando consulta y conectores seleccionados.", status="running", run_id=run_id, reset=True)
        try:
            payload, log_tail, elapsed = await asyncio.to_thread(run_engine, request, run_id)
        except RuntimeError as exc:
            set_progress("error", "La investigación no pudo completarse", 100, str(exc)[:760], status="error", run_id=run_id)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            message = f"Error inesperado de investigación: {type(exc).__name__}: {str(exc)[:350]}"
            set_progress("error", "La investigación no pudo completarse", 100, message, status="error", run_id=run_id)
            raise HTTPException(status_code=500, detail=message) from exc

        result = normalize_result(payload, request, run_id, elapsed, log_tail)
        if request.use_openai and os.getenv("OPENAI_API_KEY", "").strip():
            set_progress("editorial", "Convirtiendo la evidencia en decisiones editoriales", 94, "El motor ya calculó las métricas. OpenAI está preparando ideas, ganchos, formatos y verificaciones vinculadas a la evidencia.", run_id=run_id)
            editorial = await asyncio.to_thread(generate_editorial, result, request.question, EDITORIAL_MODEL)
        else:
            editorial = {
                "status": "unavailable", "model": None,
                "executive_summary": "La recopilación y las métricas se han completado, pero falta configurar OpenAI para generar decisiones editoriales automáticas.",
                "overall_signal": "insufficient_evidence", "priority_actions": [], "audience_insights": [],
                "opportunities": [], "limitations": ["Configura OPENAI_API_KEY en el archivo .env para activar planificación, clasificación, síntesis y estrategia editorial con IA."],
                "editorial_method": "No se ha generado una interpretación editorial manual de respaldo.",
            }
        result["editorial"] = editorial
        if editorial.get("status") != "ok":
            result["warnings"] = ["La capa de estrategia editorial con IA no se completó; revisa OPENAI_API_KEY, el modelo configurado y la limitación indicada."]
        else:
            result["warnings"] = []
        store_result(result)
        set_progress("complete", "Investigación completada", 100, f"Informe listo: {result['metrics']['fixed_content']} registros de contenido y {len(result.get('editorial', {}).get('opportunities', []))} propuestas editoriales.", status="complete", run_id=run_id)
        return result

@app.get("/api/history")
async def history(limit: int = Query(default=12, ge=1, le=50)):
    with db_connect() as con:
        rows = con.execute("SELECT id, created_at, question, region, days, status, records_count, elapsed_seconds FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return {"runs": [dict(row) for row in rows]}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", run_id):
        raise HTTPException(status_code=400, detail="Identificador de ejecución no válido.")
    path = RUNS_DIR / f"{run_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No se ha encontrado esa ejecución en este equipo.")
    return safe_json(path)


@app.get("/api/runs/{run_id}/download")
async def download_run(run_id: str, format: Literal["json", "csv", "md"] = "json"):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", run_id):
        raise HTTPException(status_code=400, detail="Identificador de ejecución no válido.")
    path = RUNS_DIR / f"{run_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No se ha encontrado esa ejecución.")
    result = safe_json(path)
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", result.get("question", "radar")).strip("-")[:48] or "radar"
    if format == "json":
        return FileResponse(path, media_type="application/json", filename=f"trendsignal_{slug}.json")
    if format == "csv":
        buffer = io.StringIO(newline="")
        fields = ["evidence_id", "source", "collection_method", "title", "summary", "url", "published", "topic", "subtopic", "date_status", "metric_eligible", "classification_method", "needs_review", "domain_group"]
        writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for item in result.get("items", []):
            writer.writerow({field: (json.dumps(item.get(field), ensure_ascii=False) if isinstance(item.get(field), (dict, list)) else item.get(field, "")) for field in fields})
        return Response(content="\ufeff" + buffer.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="trendsignal_{slug}.csv"'})
    lines = [f"# TrendSignal Scout — informe de investigación", "", f"- Pregunta: {result.get('question')}", f"- Fecha UTC: {result.get('created_at')}", f"- Región: {result.get('region')} | Ventana: {result.get('days')} días", f"- Estado: {result.get('status')}", "", "## Resumen ejecutivo", "", result.get("editorial", {}).get("executive_summary", "No disponible."), "", "## Indicadores de la muestra", "", f"- Contenido único (fuentes fijas): {result.get('metrics', {}).get('fixed_content', 0)}", f"- Fuentes que respondieron: {result.get('metrics', {}).get('sources_responding', 0)}", f"- Cobertura temporal: {result.get('metrics', {}).get('date_coverage_pct', 0)}%", f"- Resultados web complementarios: {result.get('metrics', {}).get('discovery_records', 0)}", "", "> Métricas descriptivas de una muestra consultada; no equivalen a crecimiento global ni a un censo de Internet.", "", "## Temas y señales", "", "| Tema | n | % muestra | Fuentes | Dominios | Cambio muestra | Variación cuota/fuente | Soporte |", "|---|---:|---:|---:|---:|---:|---:|---|"]
    for topic in result.get("topics", [])[:20]:
        change = topic.get("sample_change_pct")
        delta = topic.get("mean_source_share_delta_pp")
        lines.append(f"| {topic.get('topic')} | {topic.get('count')} | {topic.get('share_pct')}% | {topic.get('source_count')} | {topic.get('domain_count')} | {'N/D' if change is None else str(change) + '%'} | {'N/D' if delta is None else str(delta) + ' pp'} | {topic.get('evidence_status')} |")
    lines += ["", "## Oportunidades editoriales", ""]
    for idx, op in enumerate(result.get("editorial", {}).get("opportunities", []), 1):
        lines += [f"### {idx}. {op.get('title')}", "", f"**Ángulo:** {op.get('angle')}", "", f"**Gancho:** {op.get('hook')}", "", f"**Formato:** {op.get('format')} | **Audiencia:** {op.get('target_audience')}", "", f"**Evidencia:** {op.get('evidence_summary')}", ""]
        for ev in op.get("evidence", []):
            lines.append(f"- [{ev.get('title')}]({ev.get('url')}) — {ev.get('source')} ({ev.get('published') or 'fecha no disponible'})")
        if op.get("validation_needed"):
            lines += ["", "**Validaciones previas:**"] + [f"- {x}" for x in op["validation_needed"]]
        lines.append("")
    lines += ["## Estado de las fuentes", "", "| Fuente | Estado | Registros | Detalle |", "|---|---|---:|---|"]
    for source in result.get("sources", []):
        lines.append(f"| {source.get('name')} | {source.get('status')} | {source.get('records')} | {str(source.get('detail','')).replace('|','/')} |")
    lines += ["", "## Limitaciones", ""] + [f"- {x}" for x in result.get("editorial", {}).get("limitations", [])]
    lines += ["", "## Método", "", "- Las métricas de crecimiento descriptivo vienen calculadas por el motor; OpenAI no las sustituye.", "- Los datos de descubrimiento web se separan de las métricas de crecimiento de fuentes fijas.", "- Las interacciones de redes sociales solo se muestran cuando una fuente facilita las métricas públicas pertinentes.", "- Las recomendaciones editoriales son interpretaciones asistidas por IA, revisables y respaldadas por IDs de evidencia.", ""]
    return PlainTextResponse("\n".join(lines), media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="trendsignal_{slug}.md"'})


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_json():
    return JSONResponse(app.openapi())
