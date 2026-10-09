"""Führt die Entwürfe eines Lernpakets zusammen.

Aufruf:  python -I zusammenfuehren.py <arbeitsordner>

Liest aus dem Arbeitsordner:
  stand.json                 frischer Pull des Second Brain (Bestand)
  entwurf/karten-*.json      Änderungslisten der Karten-Autoren (new_cards, modified_cards, new_notes, ...)
  entwurf/notiz-*.json       eigene Notizänderungen (gleiches Format)
  entwurf/quiz-*.json        Listen neuer Testaufgaben
Schreibt:
  aenderungen.json           alle Karten- und Notizänderungen
  pool.json                  vollständiger Aufgabenpool (Bestand + neu), Bestandsreihenfolge bleibt

Bricht ab, wenn eine ID doppelt vorkommt oder zwei Autoren dieselbe Karte oder Notiz ändern.
"""
import collections
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) != 2:
    raise SystemExit(__doc__)
root = Path(sys.argv[1])
stand = json.loads((root / "stand.json").read_text(encoding="utf-8"))["workspace"]

KEYS = ("new_cards", "modified_cards", "new_notes", "modified_notes", "delete_proposals")
merged = {k: [] for k in KEYS}
sources = sorted((root / "entwurf").glob("karten-*.json")) + sorted((root / "entwurf").glob("notiz-*.json"))
for path in sources:
    part = json.loads(path.read_text(encoding="utf-8"))
    for k in KEYS:
        merged[k] += part.get(k, [])
    print(f"{path.name}: " + ", ".join(f"{k} {len(part.get(k, []))}" for k in KEYS if part.get(k)))

problems = []
for k in KEYS:
    for item_id, n in collections.Counter(x["id"] for x in merged[k]).items():
        if n > 1:
            problems.append(f"{k}: {item_id} kommt {n}-mal vor")
existing = {c["id"] for c in stand["cards"]} | {n["id"] for n in stand["notes"]}
for x in merged["new_cards"] + merged["new_notes"]:
    if x["id"] in existing:
        problems.append(f"{x['id']} existiert schon im Bestand")

quiz = []
for path in sorted((root / "entwurf").glob("quiz-*.json")):
    part = json.loads(path.read_text(encoding="utf-8"))
    quiz += part
    print(f"{path.name}: {len(part)} Aufgaben")
old_ids = {q["id"] for q in stand["quizQuestions"]}
for q_id, n in collections.Counter(q["id"] for q in quiz).items():
    if n > 1:
        problems.append(f"Aufgabe {q_id} kommt {n}-mal vor")
    if q_id in old_ids:
        problems.append(f"Aufgabe {q_id} existiert schon im Bestand")

if problems:
    print("FEHLER – nichts geschrieben:\n" + "\n".join(problems))
    raise SystemExit(1)
(root / "aenderungen.json").write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
(root / "pool.json").write_text(json.dumps(stand["quizQuestions"] + quiz, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"aenderungen.json: {len(merged['new_cards'])} neue, {len(merged['modified_cards'])} geänderte Karten, "
      f"{len(merged['new_notes'])} neue, {len(merged['modified_notes'])} geänderte Notizen")
print(f"pool.json: {len(stand['quizQuestions'])} Bestand + {len(quiz)} neu = {len(stand['quizQuestions']) + len(quiz)}")
