import unittest
from app.core.models_registry import parse_wav2vec_linear_output

class TestWav2VecParser(unittest.TestCase):
    def test_parse_wav2vec_linear_output_single_file(self):
        sample_stdout = """
Processing audio files: 100%|██████████| 1/1 [00:00<00:00, 19.82it/s]
p376_004.wav → shape=(1,), preds=[-2.418374], time=42.1 ms
Scores : min -2.42, max -2.42, median -2.42, mean -2.42, std 0.00
"""
        results = parse_wav2vec_linear_output(sample_stdout, threshold=0.0)
        self.assertEqual(len(results), 1)
        res = results[0]
        self.assertEqual(res["filename"], "p376_004.wav")
        self.assertEqual(res["raw_score"], -2.4184)
        self.assertEqual(res["prediction"], "spoof")
        self.assertGreater(res["confidence"], 0.9)
        self.assertEqual(res["inference_time_ms"], 42.1)

    def test_parse_wav2vec_linear_output_bonafide(self):
        sample_stdout = "clean_sample.wav → shape=(1,), preds=[3.8512], time=39.4 ms\n"
        results = parse_wav2vec_linear_output(sample_stdout, threshold=0.0)
        self.assertEqual(len(results), 1)
        res = results[0]
        self.assertEqual(res["filename"], "clean_sample.wav")
        self.assertEqual(res["raw_score"], 3.8512)
        self.assertEqual(res["prediction"], "bonafide")
        self.assertGreater(res["confidence"], 0.95)

    def test_parse_wav2vec_linear_output_multiple_files(self):
        sample_stdout = """
file1.wav → shape=(1,), preds=[-1.50], time=40.0 ms
file2.wav → shape=(1,), preds=[2.10], time=38.5 ms
"""
        results = parse_wav2vec_linear_output(sample_stdout, threshold=0.0)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["prediction"], "spoof")
        self.assertEqual(results[1]["prediction"], "bonafide")

if __name__ == "__main__":
    unittest.main()
