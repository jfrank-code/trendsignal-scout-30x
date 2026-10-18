import json
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app.main import app, RUNS_DIR


class ApiTests(unittest.TestCase):
    def test_health_does_not_return_secrets(self):
        with TestClient(app) as client:
            response = client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['engine'])
        self.assertNotIn('OPENAI_API_KEY', response.text)

    def test_analyze_normalizes_mocked_engine_and_stores_report_without_openai_key(self):
        payload = {
            'version': '6.6', 'created_at': '2026-10-18T15:00:00+00:00', 'question': 'Test query',
            'source_status': {'Google News RSS': {'status': 'ok', 'records': 1, 'query_used': 'test'}},
            'fixed_metrics': {
                'content_count': 1, 'topics': [{'topic': 'Artificial intelligence', 'count': 1, 'share_pct': 100.0,
                'source_count': 1, 'domain_count': 1, 'recent_half': 1, 'previous_half': 0,
                'sample_change_pct': None, 'mean_source_share_delta_pp': None, 'trend_direction': 'not_comparable',
                'growth_candidate': False, 'evidence_status': 'insufficient_support'}],
                'candidate_signals': [], 'ai_subtopics': [], 'source_counts': {'Google News RSS': 1},
                'date_coverage_pct': 100, 'records_with_dates_in_window': 1, 'undated_content_count': 0,
                'excluded_future_date_count': 0, 'excluded_outside_window_count': 0
            },
            'items': [{'source': 'Google News RSS', 'title': 'Test result', 'summary': 'Test summary',
                       'url': 'https://example.org/test', 'published': '2026-10-18T14:00:00+00:00',
                       'topic': 'Artificial intelligence', 'metric_eligible': True, 'date_status': 'valid',
                       'collection_method': 'fixed', 'domain_group': 'example.org'}],
            'google_trends_time_series': [], 'errors': [], 'openai_synthesis': '', 'methodology': {}
        }
        with patch.dict('os.environ', {'OPENAI_API_KEY': ''}), patch('backend.app.main.run_engine', return_value=(payload, 'fake engine run', 0.3)):
            with TestClient(app) as client:
                response = client.post('/api/analyze', json={
                    'question': 'Analiza este tema de prueba', 'sources': ['news'], 'use_openai': True,
                    'discover_web': False, 'region': 'PE', 'days': 7, 'max_items': 10
                })
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertEqual(data['question'], 'Analiza este tema de prueba')
                self.assertEqual(data['items'][0]['title'], 'Test result')
                self.assertEqual(data['editorial']['status'], 'unavailable')
                self.assertEqual(data['editorial']['opportunities'], [])
                saved = client.get('/api/runs/' + data['run_id'])
                self.assertEqual(saved.status_code, 200)
                self.assertEqual(saved.json()['run_id'], data['run_id'])
                for fmt, content_type in [('csv', 'text/csv'), ('md', 'text/markdown')]:
                    exported = client.get(f"/api/runs/{data['run_id']}/download?format={fmt}")
                    self.assertEqual(exported.status_code, 200, exported.text[:250])
                    self.assertIn(content_type, exported.headers.get('content-type', ''))
                    self.assertTrue(exported.content)
        (RUNS_DIR / f"{data['run_id']}.json").unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
