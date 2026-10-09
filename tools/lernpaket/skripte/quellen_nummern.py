"""Vergibt Aufzeichnungsnummern für neue Transkripte in Kursreihenfolge.

Aufruf:  python -I quellen_nummern.py <arbeitsordner> [--start N]

Liest:
  stand.json             Bestand; die höchste dort zitierte „Aufzeichnung NN“ bestimmt den Start (nächster Zehner)
  kursraum/inventar.json Kursexport des Downloaders (Reihenfolge der Aktivitäten)
  transkripte/*.md       Transkripte aus transcribe.py (Dateinamen „<Aktivitäts-ID>_…“ oder „vimeo_<ID>_…“)
Schreibt:
  quellen.json           [{aufzeichnung, titel, art, kursabschnitt, datei, dublette_von?}]

Inhaltsgleiche Transkripte (gleiche Dauer, mindestens 90 % gleicher Wortbestand; die Spracherkennung liefert bei
derselben Datei nicht exakt denselben Text) bekommen keine eigene Nummer, sondern einen Verweis.
Ob ein neues Transkript schon unter einer alten Nummer im Deck steckt, prüft das Skript nicht: das bei gleicher
Dauer und ähnlichem Anfang von Hand klären.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if len(args) != 1:
    raise SystemExit(__doc__)
root = Path(args[0])
start = None
if "--start" in sys.argv:
    start = int(sys.argv[sys.argv.index("--start") + 1])

stand = json.loads((root / "stand.json").read_text(encoding="utf-8"))["workspace"]
texts = [c["answer"] for c in stand["cards"]] + [n["content"] for n in stand["notes"]] + [q["explanation"] for q in stand["quizQuestions"]]
used = {int(n) for t in texts for n in re.findall(r"Aufzeichnung (\d+)", t)}
if start is None:
    start = ((max(used) // 10) + 1) * 10 + 1 if used else 1
if start in used or any(n in used for n in range(start, start + 100)):
    raise SystemExit(f"Startnummer {start} kollidiert mit vergebenen Nummern {sorted(n for n in used if n >= start)[:10]}")

inv = json.loads((root / "kursraum" / "inventar.json").read_text(encoding="utf-8"))
sections = {s["number"]: unicodedata.normalize("NFC", s.get("name") or "") for s in inv["sections"]}
position = {}
for a in inv["activities"]:
    if a.get("cmid"):
        position.setdefault(str(a["cmid"]), (a["index"], a["section_number"]))
    for m in a.get("media") or []:
        match = re.search(r"player\.vimeo\.com/video/(\d+)", m.get("src") or "")
        if match:
            position.setdefault("vimeo_" + match.group(1), (a["index"], a["section_number"]))

entries, seen = [], {}
for md in sorted((root / "transkripte").glob("*.md")):
    match = re.match(r"(vimeo_\d+|\d+)_", md.name)
    key = match.group(1) if match else None
    if key not in position:
        print(f"Ohne Kursposition (ans Ende): {md.name}")
    lines = md.read_text(encoding="utf-8").split("\n")
    body = "\n".join(lines[3:])
    words = set(re.findall(r"\w+", re.sub(r"\*\*\[\d+:\d+\]\*\*", "", body).lower()))
    meta = re.search(r"· (\d{2}:\d{2}) ·", lines[2]) if len(lines) > 2 else None
    title = re.sub(r"^## \d+\. ", "", lines[0]).strip()
    # Kurs- und Dateikürzel gehören nicht in Quellenzeilen
    title = re.sub(r"^(\d+\s+)?(Podcast\s+|Video\s+)?(LV\s?\d+\s+)?", "", title)
    title = re.sub(r"\s{2,}", " & ", title).strip()
    idx, sec = position.get(key, (10 ** 6, None))
    entries.append({"pos": idx, "titel": title, "art": "Video" if key and key.startswith("vimeo_") else "Audio",
                    "kursabschnitt": sections.get(sec, ""), "datei": str(md),
                    "woerter": words, "dauer": meta.group(1) if meta else ""})
entries.sort(key=lambda e: (e["pos"], e["datei"]))


def same(a, b):
    """Same recording: equal duration and at least 90 % shared vocabulary."""
    if not a["dauer"] or a["dauer"] != b["dauer"] or not a["woerter"] or not b["woerter"]:
        return False
    return len(a["woerter"] & b["woerter"]) / len(a["woerter"] | b["woerter"]) >= 0.9


out, numbered, number = [], [], start
for e in entries:
    item = {k: e[k] for k in ("titel", "art", "kursabschnitt", "datei")}
    twin = next((n for n, other in numbered if same(e, other)), None)
    if twin is not None:
        item["dublette_von"] = twin
    else:
        item["aufzeichnung"] = number
        numbered.append((number, e))
        number += 1
    out.append(item)
(root / "quellen.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"Im Bestand zitiert: {sorted(used)}")
for item in out:
    label = item.get("aufzeichnung", f"= {item.get('dublette_von')}")
    print(f"{label!s:>5}  {item['art']:5}  {item['kursabschnitt'][:30]:30}  {item['titel']}")
print(f"quellen.json: {sum('aufzeichnung' in i for i in out)} Nummern ab {start}, {sum('dublette_von' in i for i in out)} Dubletten")
