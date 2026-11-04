import unittest
import requests

BASE_URL = "http://127.0.0.1:8000"

class TestAPIEndpoints(unittest.TestCase):
    def test_root_endpoint(self):
        resp = requests.get(f"{BASE_URL}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("message", data)
        self.assertIn("docs_url", data)

    def test_health_endpoint(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["docker_available"])
        self.assertIn("wav2vec2_linear", data["registered_models"])

    def test_models_endpoint(self):
        resp = requests.get(f"{BASE_URL}/api/models")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        models = data["models"]
        self.assertTrue(any(m["id"] == "wav2vec2_linear" for m in models))
        w2v = next(m for m in models if m["id"] == "wav2vec2_linear")
        self.assertTrue(w2v["image_built"])

    def test_predict_unknown_model_404(self):
        resp = requests.post(
            f"{BASE_URL}/api/predict",
            files={"file": ("dummy.wav", b"RIFF....WAVEfmt ...")},
            data={"model_id": "non_existent_model"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_predict_empty_file_400(self):
        resp = requests.post(
            f"{BASE_URL}/api/predict",
            files={"file": ("empty.wav", b"")},
            data={"model_id": "wav2vec2_linear"},
        )
        self.assertEqual(resp.status_code, 400)

if __name__ == "__main__":
    unittest.main()
