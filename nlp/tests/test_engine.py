import math
import unittest

from nlp.engine import SemanticEngine, PassageLimitError, cosine_matrix, match_status, split_passages


class FakeTokenizer:
    def num_special_tokens_to_add(self, pair=False):
        return 2

    def __call__(self, text, **kwargs):
        # One token per character makes the token budget observable in tests.
        return {"offset_mapping": [(i, i + 1) for i in range(len(text))]}


class FakeModel:
    tokenizer = FakeTokenizer()
    max_seq_length = 256

    def __init__(self):
        self.calls = 0

    def encode(self, texts, **kwargs):
        self.calls += 1
        vectors = {
            "Build web interfaces.": [1, 0, 0],
            "Manage databases.": [0, 1, 0],
            "Lead the team.": [0, 0, 1],
            "Created accessible pages.": [1, 0, 0],
            "Wrote database queries.": [0.8, 0.6, 0],
        }
        return [vectors[text] for text in texts]


class EngineTests(unittest.TestCase):
    def test_passages_keep_tech_names_bullets_and_line_wrapped_sentences(self):
        self.assertEqual(split_passages("• Build Node.js APIs\nwith Python.\n- Deploy services.\n\nUse C++ and C#; Write tests.", 10),
                         ["Build Node.js APIs with Python.", "Deploy services.", "Use C++ and C#;", "Write tests."])

    def test_dedup_empty_long_passages_and_limits(self):
        self.assertEqual(split_passages("React. React.\n\n!!!", 5), ["React."])
        text = "a" * 600 + "b" * 600 + "c" * 300
        self.assertEqual("".join(split_passages(text, 5)), text)
        with self.assertRaises(PassageLimitError):
            split_passages("One. Two. Three.", 2)
        self.assertEqual(split_passages("   !!! ", 5), [])

    def test_token_offsets_prevent_silent_truncation(self):
        text = "a" * 30 + "b" * 30 + "c" * 20
        pieces = split_passages(text, 10, FakeTokenizer(), 30)
        self.assertEqual([len(p) for p in pieces], [30, 30, 20])
        self.assertEqual("".join(pieces), text)

    def test_cosine_is_real_normalized_similarity(self):
        self.assertAlmostEqual(cosine_matrix([[3, 0], [10, 0]], 1)[0, 0], 1)
        self.assertAlmostEqual(cosine_matrix([[1, 0], [0, 5]], 1)[0, 0], 0)
        self.assertAlmostEqual(cosine_matrix([[1, 0], [-1, 0]], 1)[0, 0], -1)
        for invalid in ([0, 0], [math.nan, 1], [math.inf, 1], [1]):
            with self.assertRaises(ValueError):
                cosine_matrix([[1, 0], invalid], 1)

    def test_status_boundaries_are_explicit_and_uncalibrated(self):
        for value, status in [(0.65, "strong"), (0.64999, "possible"), (0.4, "possible"), (0.39999, "weak"), (-1, "weak")]:
            self.assertEqual(match_status(value), status)

    def test_retrieval_uses_fixed_vectors_and_preserves_evidence(self):
        model = FakeModel()
        engine = SemanticEngine(model)
        result = engine.match("Created accessible pages. Wrote database queries.",
                              "Build web interfaces. Manage databases. Lead the team.")
        self.assertEqual([match["status"] for match in result["matches"]], ["strong", "possible", "weak"])
        self.assertEqual(result["matches"][1]["evidence"], {"text": "Wrote database queries.", "passageIndex": 1, "section": "unspecified", "relevant": True})
        self.assertAlmostEqual(result["matches"][1]["similarity"], 0.6)
        self.assertEqual(result["matches"][2]["evidence"]["passageIndex"], 0)  # stable ties
        engine.match("Created accessible pages.", "Build web interfaces.")
        self.assertEqual(model.calls, 2)
        self.assertNotIn("baselinePercentage", result)

    def test_no_passages_and_invalid_embedding_fail_clearly(self):
        with self.assertRaises(ValueError):
            SemanticEngine(FakeModel()).match("!!!", "Build web interfaces.")


if __name__ == "__main__":
    unittest.main()
