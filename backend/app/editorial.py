"""Editorial strategy layer. Model output is constrained and grounded in collected evidence."""
from __future__ import annotations
import json
import os
import re
from typing import Any
from urllib.parse import urlparse

MODEL_DEFAULT = os.getenv("OPENAI_EDITORIAL_MODEL", "gpt-5.5")

EDITORIAL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "executive_summary": {"type": "string"},
        "overall_signal": {"type": "string", "enum": ["clear_opportunity", "promising_but_early", "mixed_signals", "insufficient_evidence"]},
        "priority_actions": {"type": "array", "items": {"type": "string"}},
        "audience_insights": {"type": "array", "items": {"type": "string"}},
        "opportunities": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "topic": {"type": "string"},
                "angle": {"type": "string"},
                "hook": {"type": "string"},
                "format": {"type": "string"},
                "target_audience": {"type": "string"},
                "why_now": {"type": "string"},
                "evidence_summary": {"type": "string"},
                "evidence_ids": {"type": "array", "items": {"type": "string"}},
                "evidence_strength": {"type": "string", "enum": ["strong", "moderate", "exploratory", "insufficient"]},
                "confidence_level": {"type": "string", "enum": ["high", "medium", "low"]},
                "confidence_rationale": {"type": "string"},
                "outline": {"type": "array", "items": {"type": "string"}},
                "cta": {"type": "string"},
                "content_pillar": {"type": "string"},
                "localization": {"type": "string"},
                "validation_needed": {"type": "array", "items": {"type": "string"}},
                "risks": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["title", "topic", "angle", "hook", "format", "target_audience", "why_now", "evidence_summary", "evidence_ids", "evidence_strength", "confidence_level", "confidence_rationale", "outline", "cta", "content_pillar", "localization", "validation_needed", "risks"],
            "additionalProperties": False
        }},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "editorial_method": {"type": "string"}
    },
    "required": ["executive_summary", "overall_signal", "priority_actions", "audience_insights", "opportunities", "limitations", "editorial_method"],
    "additionalProperties": False
}


def requested_count(question: str, default: int = 6) -> int:
    """Infer a requested list size from natural language, while enforcing output limits."""
    match = re.search(r"\b(?:dame|mu[eé]strame|lista de|top|los|las|unos?|unas?)\s*(\d{1,2})\b|\b(\d{1,2})\s+(?:temas|ideas|oportunidades|titulares|propuestas)", question, re.I)
    number = next((int(x) for x in match.groups() if x), default) if match else default
    return max(3, min(number, 12))


def _evidence_pack(result: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    source_records = [x for x in result.get("items", []) if not x.get("is_time_series") and x.get("url")]
    source_records.sort(key=lambda x: (x.get("metric_eligible", False), bool(x.get("published")), x.get("published") or ""), reverse=True)
    evidence = source_records[:45]
    by_id: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(evidence, start=1):
        item["evidence_id"] = f"E{index:03d}"
        by_id[item["evidence_id"]] = item
    return evidence, by_id


def editorial_fallback(reason: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "model": None,
        "executive_summary": "La capa de estrategia editorial con IA no se ha podido completar. No se muestran recomendaciones automáticas no verificadas.",
        "overall_signal": "insufficient_evidence",
        "priority_actions": ["Revisa la cobertura de fuentes y repite el análisis con una consulta más concreta."],
        "audience_insights": [], "opportunities": [],
        "limitations": [reason],
        "editorial_method": "Sin interpretación editorial generada por OpenAI en esta ejecución.",
    }


def generate_editorial(result: dict[str, Any], question: str, model: str | None = None) -> dict[str, Any]:
    """Use a separate Responses API call to turn evidence into grounded editorial briefs."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return editorial_fallback("OPENAI_API_KEY no está configurada; configura backend/.env para activar esta capa.")
    try:
        from openai import OpenAI
    except ImportError:
        return editorial_fallback("Falta el paquete openai. Instala las dependencias de requirements.txt.")

    evidence, evidence_lookup = _evidence_pack(result)
    fixed = result.get("raw_metrics", {}) or {}
    topic_stats = fixed.get("topics", [])[:14]
    ai_subtopics = fixed.get("ai_subtopics", [])[:14]
    candidates = fixed.get("candidate_signals", [])[:10]
    sources = result.get("sources", [])
    evidence_for_prompt = [{
        "evidence_id": item["evidence_id"],
        "title": item.get("title", ""), "summary": (item.get("summary") or "")[:650],
        "source": item.get("source", ""), "url": item.get("url", ""),
        "published": item.get("published"), "date_status": item.get("date_status"),
        "metric_eligible": item.get("metric_eligible"), "topic": item.get("topic"),
        "subtopic": item.get("subtopic"), "collection_method": item.get("collection_method"),
        "domain_group": item.get("domain_group"), "needs_review": item.get("needs_review"),
        "date_semantics": (item.get("extra") or {}).get("date_semantics"),
        "found_in_sources": item.get("found_in_sources", [])
    } for item in evidence]
    count = requested_count(question)
    region_label = {"PE": "Perú y audiencia profesional latinoamericana", "MX": "México y audiencia profesional latinoamericana", "AR": "Argentina y audiencia profesional latinoamericana", "CL": "Chile y audiencia profesional latinoamericana", "CO": "Colombia y audiencia profesional latinoamericana", "BR": "Brasil y audiencia profesional latinoamericana", "WORLD": "Latinoamérica con perspectiva global"}.get(result.get("region", "PE"), "Latinoamérica")
    pack = {
        "question": question, "audience_context": region_label,
        "days": result.get("days"), "region": result.get("region"),
        "collection_summary": result.get("metrics", {}), "fixed_source_topic_metrics": topic_stats,
        "ai_subtopic_metrics": ai_subtopics, "growth_candidates": candidates,
        "source_status": sources, "existing_openai_synthesis": result.get("narrative", ""),
        "evidence_records": evidence_for_prompt,
    }
    prompt = f"""Eres el director editorial de TrendSignal Scout para 30X: una audiencia de líderes, fundadores, responsables de equipo y profesionales de Latinoamérica que quieren aplicar ideas útiles en su trabajo. Tu tarea es convertir resultados de investigación exploratoria en decisiones editoriales concretas, originales y trazables.

Consulta del usuario: {question}
Propón exactamente {count} oportunidades editoriales como máximo (hasta {count}; prioriza calidad y evidencia sobre cantidad). Responde en español natural, con ideas concretas y listas para producir.

REGLAS OBLIGATORIAS:
1) Basa la recomendación en los registros y métricas adjuntos. No inventes fuentes, URLs, publicaciones, cifras, estadísticas de redes, engagement, volumen global ni crecimiento.
2) Usa `evidence_ids` SOLO con IDs existentes en evidence_records. Si una afirmación no se puede respaldar, dilo en evidence_summary/validation_needed y no cites un ID irrelevante.
3) Las métricas de topic/subtopic describen una muestra recuperada. No las presentes como tendencia global, causalidad, probabilidad de viralidad ni rendimiento previsto.
4) No confundas artículos, repositorios, papers, YouTube y Google Trends: miden fenómenos distintos. No sumes series temporales de Google Trends como si fueran artículos.
5) Un candidato de crecimiento solo puede llamarse «señal consistente en esta muestra» si aparece en growth_candidates con apoyo mínimo. Para otros casos usa «interés observado», «tema emergente por validar» o «hipótesis editorial».
6) Los registros con `collection_method=discovery` pueden aportar contexto o ejemplos, pero no forman parte de la métrica de crecimiento de fuentes fijas. No uses fechas anómalas o sin verificar como evidencia temporal.
7) Para 30X, busca utilidad demostrable: decisiones, workflows, casos, comparativas honestas, errores habituales, coste/beneficio, adopción en equipos, implementación en pymes, liderazgo y ejemplos de Latinoamérica. No fuerces localización peruana cuando no haya evidencia local.
8) Cada propuesta debe ser distinguible de las demás e incluir un gancho fuerte pero no engañoso, formato concreto, público, mini-guion, CTA, riesgos y qué validar antes de publicar.
9) `confidence_level` es una valoración cualitativa no calibrada; justifica el nivel y no lo llames probabilidad. El soporte `strong` requiere variedad de fuentes/dominios y apoyo temporal verificable; `moderate` requiere evidencia verificable pero parcial; `exploratory` significa indicio limitado; `insufficient` significa que faltan pruebas.
10) Si faltan pruebas para la cantidad pedida, devuelve menos ideas y explica el hueco en limitations. No rellenes por rellenar.
11) No propongas inventar comentarios, métricas ni testimonios; las plataformas sociales que no aparecen en las fuentes deben constar como no cubiertas. Distingue propuesta creativa de hallazgo verificado.

Devuelve SOLO un objeto JSON que cumpla el esquema solicitado.

PAQUETE DE EVIDENCIA:
{json.dumps(pack, ensure_ascii=False, separators=(',', ':'))}
"""
    chosen_model = (model or MODEL_DEFAULT).strip() or "gpt-4.1-mini"
    client = OpenAI(api_key=api_key, timeout=120.0, max_retries=2)
    try:
        response = client.responses.create(
            model=chosen_model,
            input=prompt,
            text={"format": {"type": "json_schema", "name": "trendsignal_editorial_strategy", "strict": True, "schema": EDITORIAL_SCHEMA}},
            max_output_tokens=10000,
        )
        raw = (getattr(response, "output_text", "") or "").strip()
        data = json.loads(raw)
    except Exception as exc:
        fallback = editorial_fallback(f"OpenAI no completó la estrategia editorial: {type(exc).__name__}: {str(exc)[:240]}")
        fallback["model"] = chosen_model
        return fallback

    valid_ids = set(evidence_lookup)
    accepted_opportunities: list[dict[str, Any]] = []
    for opportunity in data.get("opportunities", []):
        opportunity["evidence_ids"] = [eid for eid in opportunity.get("evidence_ids", []) if eid in valid_ids]
        opportunity["evidence"] = [{
            "id": eid,
            "title": evidence_lookup[eid].get("title", ""),
            "source": evidence_lookup[eid].get("source", ""),
            "url": evidence_lookup[eid].get("url", ""),
            "published": evidence_lookup[eid].get("published", ""),
            "date_semantics": (evidence_lookup[eid].get("extra") or {}).get("date_semantics"),
            "collection_method": evidence_lookup[eid].get("collection_method", "fixed"),
            "date_status": evidence_lookup[eid].get("date_status", "missing"),
            "metric_eligible": evidence_lookup[eid].get("metric_eligible", False),
            "domain_group": evidence_lookup[eid].get("domain_group", "unknown-domain"),
            "found_in_sources": evidence_lookup[eid].get("found_in_sources") or [evidence_lookup[eid].get("source", "unknown")],
        } for eid in opportunity["evidence_ids"]]
        # The model proposes a support level, but the backend enforces a conservative floor.
        cited = opportunity["evidence"]
        fixed_cited = [ev for ev in cited if ev.get("collection_method") != "discovery"]
        source_names = {name for ev in fixed_cited for name in (ev.get("found_in_sources") or [ev.get("source", "unknown")]) if name and name != "unknown"}
        domains = {ev.get("domain_group") for ev in fixed_cited if ev.get("domain_group") and ev.get("domain_group") != "unknown-domain"}
        dated_fixed = [ev for ev in fixed_cited if ev.get("published") and ev.get("date_status") not in {"missing", "future_anomaly"} and ev.get("metric_eligible", False)]
        if not cited:
            opportunity["evidence_strength"] = "insufficient"
            opportunity["validation_needed"] = list(opportunity.get("validation_needed", [])) + ["Vincular al menos una fuente relevante antes de presentar esta propuesta como respaldada por evidencia."]
            opportunity["confidence_level"] = "low"
        else:
            if len(cited) < 2 or len(source_names) < 2:
                if opportunity["evidence_strength"] in {"strong", "moderate"}:
                    opportunity["evidence_strength"] = "exploratory"
                opportunity["validation_needed"] = list(opportunity.get("validation_needed", [])) + ["Añadir corroboración independiente de otra fuente antes de presentar la evidencia como amplia."]
            if len(cited) < 3 or len(source_names) < 2 or len(domains) < 2 or len(dated_fixed) < 2:
                if opportunity["evidence_strength"] == "strong":
                    opportunity["evidence_strength"] = "moderate" if len(cited) >= 2 and len(source_names) >= 2 else "exploratory"
                if len(dated_fixed) < 2:
                    opportunity["validation_needed"] = list(opportunity.get("validation_needed", [])) + ["Verificar las fechas y corroborar la actualidad del hallazgo antes de presentarlo como una señal temporal."]
            if opportunity["evidence_strength"] == "insufficient" and len(cited) >= 1:
                opportunity["validation_needed"] = list(opportunity.get("validation_needed", [])) + ["La evidencia citada es limitada; comprueba que respalde directamente el ángulo propuesto."]
            if opportunity["evidence_strength"] != "strong" and opportunity["confidence_level"] == "high":
                opportunity["confidence_level"] = "medium" if opportunity["evidence_strength"] in {"moderate", "exploratory"} else "low"
            if opportunity["evidence_strength"] == "insufficient":
                opportunity["confidence_level"] = "low"
        accepted_opportunities.append(opportunity)
    data["opportunities"] = accepted_opportunities[:count]
    data["status"] = "ok"
    data["model"] = chosen_model
    data["evidence_pool_size"] = len(evidence)
    data["evidence_ids_validated"] = True
    return data
