"""Übernimmt die Korrekturen der Prüfer in Änderungsliste und Pool.

Aufruf:  python -I apply_pruefung.py <arbeitsordner>

Liest aenderungen.json, pool.json, stand.json und pruefung-*.json (Format: vorlagen/PRUEFAUFTRAG.md).
Jede Ersetzung muss genau einmal passen, sonst bricht das Skript ab, ohne zu schreiben.
Schreibt aenderungen-final.json, pool-final.json und apply_pruefung.log.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) != 2:
    raise SystemExit(__doc__)
S = Path(sys.argv[1])
changes = json.loads((S / "aenderungen.json").read_text(encoding="utf-8"))
pool = json.loads((S / "pool.json").read_text(encoding="utf-8"))
live = json.loads((S / "stand.json").read_text(encoding="utf-8"))["workspace"]

cards = {c["id"]: c for c in changes["new_cards"]}
mods = {m["id"]: m for m in changes["modified_cards"]}
notes = {n["id"]: n for n in changes["new_notes"]}
mod_notes = {m["id"]: m for m in changes["modified_notes"]}
questions = {q["id"]: q for q in pool}
log, errors = [], []
# Notizdatum für Nachträge: aus der ersten Änderung übernehmen, sonst jetzt
NOTE_UPDATED = next((m["after"]["updatedAt"] for m in changes.get("modified_notes", [])), None) or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def target(datei, item_id, feld):
    """Return (container, key) for the text to change."""
    if datei == "pool":
        q = questions.get(item_id)
        if q is None:
            raise KeyError(f"Aufgabe {item_id} fehlt")
        m = re.fullmatch(r"options\[(.+)\]\.(text|feedback)", feld)
        if m:
            option = next((o for o in q["options"] if o["id"] == m.group(1)), None)
            if option is None:
                raise KeyError(f"{item_id}: Option {m.group(1)} fehlt")
            return option, m.group(2)
        return q, feld
    if item_id in cards:
        return cards[item_id], feld
    if item_id in mods:
        return mods[item_id]["after"], feld
    if item_id in notes:
        return notes[item_id], feld
    if item_id in mod_notes:
        return mod_notes[item_id]["after"], feld
    raise KeyError(f"{item_id} steht nicht in aenderungen.json")


for path in sorted(S.glob("pruefung-*.json")):
    report = json.loads(path.read_text(encoding="utf-8"))
    for r in report.get("ersetzungen", []):
        try:
            container, key = target(r["datei"], r["id"], r["feld"])
            if key == "correctOptionIds":
                old, new = json.loads(r["alt"]), json.loads(r["neu"])
                if container[key] != old:
                    raise ValueError("correctOptionIds stimmt nicht mit alt überein")
                container[key] = new
            else:
                text = container[key]
                if text.count(r["alt"]) != 1:
                    raise ValueError(f"alt kommt {text.count(r['alt'])}-mal vor")
                container[key] = text.replace(r["alt"], r["neu"])
            log.append(f"{path.stem}: {r['id']} {r['feld']} ersetzt")
        except Exception as exc:
            errors.append(f"{path.stem}: {r.get('id')} {r.get('feld')}: {exc}")
    for s in report.get("streichen", []):
        if s["datei"] == "pool":
            questions.pop(s["id"], None)
        else:
            cards.pop(s["id"], None)
        log.append(f"{path.stem}: {s['id']} gestrichen ({s['grund']})")
    nach = report.get("notiz_nachtrag")
    if nach and nach.get("id"):
        live_note = next((n for n in live["notes"] if n["id"] == nach["id"]), None)
        if live_note is None:
            errors.append(f"{path.stem}: Notiz {nach['id']} fehlt im Bestand")
            continue
        content = live_note["content"]
        anchor = nach.get("einfuegen_vor") or ""
        if anchor:
            if content.count(anchor) != 1:
                errors.append(f"{path.stem}: Einfügepunkt in {nach['id']} kommt {content.count(anchor)}-mal vor")
                continue
            new_content = content.replace(anchor, nach["abschnitt"].rstrip() + "\n\n" + anchor)
        else:
            new_content = content.rstrip() + "\n\n" + nach["abschnitt"].rstrip() + "\n"
        mod_notes[nach["id"]] = {
            "id": nach["id"],
            "before": {"content": live_note["content"], "summary": live_note["summary"]},
            "after": {"content": new_content, "summary": live_note["summary"], "updatedAt": NOTE_UPDATED},
            "reason": "Kursfassung ergänzt (Prüfung); vorhandener Literaturtext bleibt.",
        }
        log.append(f"{path.stem}: Notiz-Nachtrag {nach['id']}")

if errors:
    print("FEHLER – nichts geschrieben:")
    print("\n".join(errors))
    raise SystemExit(1)

changes["new_cards"] = list(cards.values())
changes["modified_cards"] = list(mods.values())
changes["new_notes"] = list(notes.values())
changes["modified_notes"] = list(mod_notes.values())
(S / "aenderungen-final.json").write_text(json.dumps(changes, ensure_ascii=False, indent=1), encoding="utf-8")
(S / "pool-final.json").write_text(json.dumps(list(questions.values()), ensure_ascii=False, indent=1), encoding="utf-8")
(S / "apply_pruefung.log").write_text("\n".join(log) + "\n", encoding="utf-8")
print(f"{len(log)} Änderungen übernommen; {len(cards)} neue Karten, {len(questions)} Aufgaben.")
