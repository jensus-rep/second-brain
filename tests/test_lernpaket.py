"""Regression checks for offline course-import merging; never touches a live system."""
import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

script = Path(__file__).resolve().parents[1] / "tools/lernpaket/skripte/build_nachher.py"
spec = importlib.util.spec_from_file_location("build_nachher", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.baseline = {"revision": 2, "workspace": {
            "notes": [{"id": "n", "title": "Titel", "content": "Alt", "summary": "Kurz", "updatedAt": "alt"}],
            "cards": [{"id": "c", "question": "Frage", "answer": "Alt", "reviews": 2, "dueAt": "alt"}],
            "quizQuestions": [{"id": "q", "prompt": "Alt"}], "quizRuns": [{"id": "run"}], "topics": [],
            "futureField": {"value": "erhalten"},
        }}
        self.changes = {"modified_cards": [], "modified_notes": [], "new_cards": [], "new_notes": []}
        self.live = copy.deepcopy(self.baseline)
        self.live["revision"] = 3
        self.write("stand.json", self.baseline)

    def write(self, name, value):
        (self.root / name).write_text(json.dumps(value), encoding="utf-8")

    def build(self):
        self.write("aenderungen-final.json", self.changes)
        return module.build(self.root, self.live)["workspace"]

    def test_preserves_concurrent_question_edits_and_new_questions(self):
        self.write("pool-final.json", self.baseline["workspace"]["quizQuestions"] + [{"id": "new", "prompt": "Neu"}])
        self.live["workspace"]["quizQuestions"][0]["prompt"] = "Parallel"
        self.live["workspace"]["quizQuestions"].append({"id": "parallel", "prompt": "Parallel neu"})
        result = self.build()
        self.assertEqual([q["prompt"] for q in result["quizQuestions"]], ["Parallel", "Parallel neu", "Neu"])
        self.assertEqual(result["quizRuns"], self.baseline["workspace"]["quizRuns"])
        self.assertEqual(result["futureField"], {"value": "erhalten"})

    def test_conflicting_question_edits_fail(self):
        self.write("pool-final.json", [{"id": "q", "prompt": "Entwurf"}])
        self.live["workspace"]["quizQuestions"][0]["prompt"] = "Parallel"
        with self.assertRaisesRegex(ValueError, "Konflikt bei Aufgabe"):
            self.build()

    def test_card_content_update_preserves_review_progress(self):
        self.changes["modified_cards"] = [{"id": "c", "before": {"question": "Frage", "answer": "Alt"}, "after": {"question": "Frage", "answer": "Neu"}}]
        self.live["workspace"]["cards"][0].update(question="Parallel", reviews=7, dueAt="morgen")
        card = self.build()["cards"][0]
        self.assertEqual(card, {"id": "c", "question": "Parallel", "answer": "Neu", "reviews": 7, "dueAt": "morgen"})

    def test_learning_state_fields_cannot_be_changed_by_a_draft(self):
        self.changes["modified_cards"] = [{"id": "c", "before": {"answer": "Alt"}, "after": {"reviews": 0}}]
        with self.assertRaisesRegex(ValueError, "darf nicht verändert"):
            self.build()

    def test_no_quiz_package_preserves_live_pool(self):
        self.live["workspace"]["quizQuestions"][0]["prompt"] = "Parallel"
        self.assertEqual(self.build()["quizQuestions"], [{"id": "q", "prompt": "Parallel"}])

    def test_duplicate_new_ids_and_duplicate_pool_ids_fail(self):
        self.changes["new_cards"] = [{"id": "new"}, {"id": "new"}]
        with self.assertRaisesRegex(ValueError, "doppelt"):
            self.build()
        self.changes["new_cards"] = []
        self.write("pool-final.json", [{"id": "q"}, {"id": "q"}])
        with self.assertRaisesRegex(ValueError, "Doppelte ID"):
            self.build()

    def test_modified_note_conflicts_fail(self):
        self.changes["modified_notes"] = [{"id": "n", "before": {"content": "Alt"}, "after": {"content": "Neu"}}]
        self.live["workspace"]["notes"][0]["content"] = "Parallel"
        with self.assertRaisesRegex(ValueError, "Konflikt"):
            self.build()

    def test_baseline_questions_cannot_be_removed(self):
        self.write("pool-final.json", [])
        with self.assertRaisesRegex(ValueError, "fehlen"):
            self.build()


if __name__ == "__main__":
    unittest.main()
