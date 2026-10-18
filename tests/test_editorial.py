import unittest
import json
import sys
from types import SimpleNamespace
from unittest.mock import patch

from backend.app.editorial import EDITORIAL_SCHEMA, editorial_fallback, requested_count, generate_editorial


class EditorialTests(unittest.TestCase):
    def test_requested_count_from_common_prompts(self):
        self.assertEqual(requested_count("Dame los 10 temas más importantes de esta semana"), 10)
        self.assertEqual(requested_count("Quiero 4 oportunidades de contenido"), 4)
        self.assertEqual(requested_count("Haz un análisis general"), 6)

    def test_requested_count_is_bounded(self):
        self.assertEqual(requested_count("Top 99 temas"), 12)
        self.assertEqual(requested_count("Dame 1 tema"), 3)

    def test_schema_is_strict_root_object(self):
        self.assertEqual(EDITORIAL_SCHEMA["type"], "object")
        self.assertFalse(EDITORIAL_SCHEMA["additionalProperties"])
        self.assertTrue(set(EDITORIAL_SCHEMA["required"]).issubset(EDITORIAL_SCHEMA["properties"]))

    def test_generate_editorial_does_not_call_model_without_key(self):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            response = generate_editorial({"items": []}, "tema de prueba")
        self.assertEqual(response["status"], "unavailable")
        self.assertEqual(response["opportunities"], [])

    def test_fallback_never_claims_ai_result(self):
        fallback = editorial_fallback("clave ausente")
        self.assertEqual(fallback["status"], "unavailable")
        self.assertIn("Sin interpretación", fallback["editorial_method"])

    def test_openai_evidence_ids_are_validated_and_strength_is_downgraded(self):
        output = {
            "executive_summary": "Resumen", "overall_signal": "promising_but_early",
            "priority_actions": [], "audience_insights": [],
            "opportunities": [{
                "title": "Idea", "topic": "Tema", "angle": "Ángulo", "hook": "Gancho",
                "format": "Carrusel", "target_audience": "Líderes", "why_now": "Indicio limitado",
                "evidence_summary": "La evidencia es ilustrativa", "evidence_ids": ["E001", "FAKE"],
                "evidence_strength": "strong", "confidence_level": "high", "confidence_rationale": "Justificación",
                "outline": ["Paso uno"], "cta": "Comenta", "content_pillar": "Trabajo",
                "localization": "No afirmar resultados locales sin datos", "validation_needed": [], "risks": []
            }],
            "limitations": [], "editorial_method": "Prueba"
        }
        class FakeResponses:
            def create(self, **kwargs):
                return SimpleNamespace(output_text=json.dumps(output))
        class FakeOpenAI:
            def __init__(self, **kwargs):
                self.responses = FakeResponses()
        fake_module = SimpleNamespace(OpenAI=FakeOpenAI)
        result = {
            "region": "PE", "days": 7, "metrics": {}, "raw_metrics": {}, "sources": [], "narrative": "",
            "items": [{"title":"Fuente de prueba", "summary":"Resumen con fecha", "url":"https://example.org/a",
                "source":"Google News RSS", "published":"2026-10-18T10:00:00+00:00", "date_status":"valid",
                "metric_eligible":True, "collection_method":"fixed", "domain_group":"example.org"}]
        }
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}), patch.dict(sys.modules, {'openai': fake_module}):
            response = generate_editorial(result, "dame 3 ideas")
        self.assertEqual(response['status'], 'ok')
        opportunity = response['opportunities'][0]
        self.assertEqual(opportunity['evidence_ids'], ['E001'])
        self.assertEqual(len(opportunity['evidence']), 1)
        self.assertNotEqual(opportunity['evidence_strength'], 'strong')
        self.assertNotEqual(opportunity['confidence_level'], 'high')
        self.assertTrue(opportunity['validation_needed'])


if __name__ == "__main__":
    unittest.main()
