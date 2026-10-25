import unittest
from fastapi.testclient import TestClient

from nlp.app import create_app, MAX_BODY_BYTES
from nlp.engine import SemanticEngine
from nlp.tests.test_engine import FakeModel


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.loads = 0

        def loader():
            self.loads += 1
            return SemanticEngine(FakeModel())

        self.app = create_app(loader)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.payload = {"resumeText": "Created accessible pages.", "jobDescription": "Build web interfaces."}

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_health_inference_and_model_reuse(self):
        self.assertEqual(self.client.get("/health/live").status_code, 200)
        self.assertEqual(self.client.get("/health/ready").status_code, 200)
        for _ in range(2):
            result = self.client.post("/match", json=self.payload)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["matches"][0]["similarity"], 1)
        self.assertEqual(self.loads, 1)

    def test_invalid_inputs_do_not_echo_documents(self):
        for payload in [{}, {**self.payload, "extra": "secret"}, {**self.payload, "resumeText": "x" * 60001},
                        {**self.payload, "jobDescription": "short"}, {**self.payload, "jobDescription": " " * 20 + "a"}, {**self.payload, "resumeText": 123},
                        {**self.payload, "resumeText": " "}, {**self.payload, "jobDescription": "!" * 20}]:
            response = self.client.post("/match", json=payload)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["error"]["code"], "INVALID_INPUT")
            self.assertNotIn("secret", response.text)

    def test_json_and_body_limits(self):
        self.assertEqual(self.client.post("/match", content="{broken", headers={"Content-Type": "application/json"}).status_code, 422)
        self.assertEqual(self.client.post("/match", content=b"x" * (MAX_BODY_BYTES + 1)).status_code, 413)

    def test_busy_service_and_recovery(self):
        self.app.state.busy.acquire()
        try:
            self.assertEqual(self.client.post("/match", json=self.payload).json()["error"]["code"], "NLP_BUSY")
        finally:
            self.app.state.busy.release()
        self.assertEqual(self.client.post("/match", json=self.payload).status_code, 200)

    def test_inference_errors_and_passage_limit_release_lock(self):
        from unittest.mock import Mock
        from nlp.engine import PassageLimitError
        for error, status, code in [(RuntimeError("secret"), 500, "INFERENCE_FAILED"),
                                    (ValueError("secret"), 422, "UNREADABLE_PASSAGES"),
                                    (PassageLimitError("Too many passages"), 422, "PASSAGE_LIMIT")]:
            self.app.state.engine = Mock()
            self.app.state.engine.match.side_effect = error
            response = self.client.post("/match", json=self.payload)
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.json()["error"]["code"], code)
            self.assertNotIn("secret", response.text)
            self.assertFalse(self.app.state.busy.locked())

    def test_model_load_failure_is_not_ready_but_live(self):
        def fail():
            raise RuntimeError("secret path")
        with TestClient(create_app(fail)) as client:
            self.assertEqual(client.get("/health/live").status_code, 200)
            self.assertEqual(client.get("/health/ready").status_code, 503)
            response = client.post("/match", json=self.payload)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("secret", response.text)


if __name__ == "__main__":
    unittest.main()
