"""Baut den neuen Stand aus einem frischen Pull und den geprüften Änderungen.

    python -I build_nachher.py <arbeitsordner> <vorher.json> <nachher.json>

Liest aenderungen-final.json und pool-final.json aus dem Arbeitsordner.

Keeps every unknown top-level key and all learning state; refuses if a 'before' text no longer
matches the fresh pull (someone changed the card in the meantime).
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) != 4:
    raise SystemExit(__doc__)
S = Path(sys.argv[1])
snapshot = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
w = snapshot["workspace"]
ch = json.loads((S / "aenderungen-final.json").read_text(encoding="utf-8"))
pool = json.loads((S / "pool-final.json").read_text(encoding="utf-8"))
errors = []

cards = {c["id"]: c for c in w["cards"]}
for m in ch["modified_cards"]:
    c = cards.get(m["id"])
    if c is None or c["question"] != m["before"]["question"] or c["answer"] != m["before"]["answer"]:
        errors.append(f"Karte {m['id']} hat sich seit dem Entwurf geändert")
        continue
    c.update(m["after"])  # question, answer, optional noteId; learning state stays
notes = {n["id"]: n for n in w["notes"]}
for m in ch["modified_notes"]:
    n = notes.get(m["id"])
    if n is None or n["content"] != m["before"]["content"] or n["summary"] != m["before"]["summary"]:
        errors.append(f"Notiz {m['id']} hat sich seit dem Entwurf geändert")
        continue
    n.update(m["after"])
existing = set(cards) | set(notes)
for item in ch["new_notes"] + ch["new_cards"]:
    if item["id"] in existing:
        errors.append(f"ID {item['id']} existiert schon")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)
w["notes"].extend(ch["new_notes"])
w["cards"].extend(ch["new_cards"])

old_ids = [q["id"] for q in w["quizQuestions"]]
by_id = {q["id"]: q for q in pool}
missing = [i for i in old_ids if i not in by_id]
if missing:
    print("Bestandsaufgaben fehlen im Pool:", missing)
    raise SystemExit(1)
w["quizQuestions"] = [by_id[i] for i in old_ids] + [q for q in pool if q["id"] not in set(old_ids)]

Path(sys.argv[3]).write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
size = len(json.dumps(w, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
print(f"revision {snapshot['revision']} · Notizen {len(w['notes'])} · Karten {len(w['cards'])} · Aufgaben {len(w['quizQuestions'])} · Runden {len(w['quizRuns'])} · {size:,} Bytes".replace(",", "."))
