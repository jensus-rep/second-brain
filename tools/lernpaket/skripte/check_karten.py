# -*- coding: utf-8 -*-
"""Prüft eine Änderungsliste für Lernkarten und Notizen gegen einen Stand des Second Brain.

Aufruf:  python -I check_karten.py <modul.json> <stand.json> <aenderungen.json>

Modulspezifisch (aus modul.json): ID-Präfixe, Fälligkeits- und Notizdatum, zulässige Befunde,
verbotene und veraltete Ausdrücke, Übertragungsbeispiel, Referenzzeilen (z. B. Scrum Guide).
Exitcode 0 = keine Fehler (Warnungen möglich), 1 = Fehler.

Geprüft wird (Schema laut lib/brain/model.ts und Inhaltsregeln laut AGENTS.md):
- Struktur der Datei (new_cards, modified_cards, new_notes, delete_proposals)
- IDs: Regex [a-zA-Z0-9_-], Länge 1..100, eindeutig, keine Kollision mit dem Bestand
- noteIds existieren (Bestand oder new_notes); new_notes nach noteSchema
- question 1..12000, answer 1..20000 Zeichen (getrimmt, nicht leer)
- neue Karten: genau die Felder des flashcardSchema; dueAt/intervalDays/reviews wie vorgegeben
- geänderte Karten: ID existiert, before stimmt exakt mit dem Bestand überein, after nur
  question/answer/noteId, after unterscheidet sich vom Bestand
- Löschvorschläge: ID und merge_into existieren
- geänderte Notizen (Nachtrag 09.10.): Notiz existiert, before stimmt mit dem Bestand überein,
  Längen laut noteSchema, updatedAt gültig, verbotene und veraltete Ausdrücke, Bildverweise
- Literaturzeilen: Jahr bzw. „o. J.“, nicht vor der Kursaussage, vor der Quellenzeile
- verbotene Namen und Kürzel (Hochschule, Firma, Kurs-/Lehreinheitskürzel, Personenname Dozent)
- Inhaltsregeln: Quellenangabe, „Laut Kurs“ vor jeder Referenzzeile (z. B. Scrum Guide, Lehrbuch),
  Pflichthinweis bei übertragenen Beispielen, keine Absicherungsfloskeln, keine veralteten Ausdrücke
- Gesamtprüfung: Arbeitsraum nach Anwendung aller Änderungen bleibt gültig
"""
import json, re, sys
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

if len(sys.argv) != 4:
    raise SystemExit("Aufruf: check_karten.py <modul.json> <stand.json> <aenderungen.json>")
CFG = json.load(open(sys.argv[1], encoding="utf-8"))
BACKUP, CHANGES = sys.argv[2], sys.argv[3]
K = CFG["karten"]

ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")
DUE = K["faellig_ab"]
CARD_FIELDS = {"id", "question", "answer", "noteId", "dueAt", "intervalDays", "reviews"}
NOTE_FIELDS = {"id", "title", "summary", "content", "topicId", "tags", "relatedIds", "favorite",
               "archived", "createdAt", "updatedAt"}

# Verbotene Namen/Kürzel (AGENTS.md: keine Uni- oder Kurskürzel, keine Hochschul-/Firmennamen) aus modul.json
FORBIDDEN = [(x["muster"], x["grund"]) for x in CFG.get("verbotene_ausdruecke", []) + CFG.get("fehlhoerungen", [])]
OUTDATED = [(x["muster"], x["grund"]) for x in K.get("veraltete_ausdruecke", [])]
HEDGES = CFG.get("absicherungsfloskeln", [])
EXAMPLE = CFG.get("beispiel") or {}
EXAMPLE_MARKERS = tuple(EXAMPLE.get("marker", []))
EXAMPLE_HINT = EXAMPLE.get("pflichthinweis", "")
GUIDE_LINE = re.compile("^(" + "|".join(map(re.escape, CFG.get("referenz_zeilen", []))) + ")", re.M) if CFG.get("referenz_zeilen") else None
REFERENCES = CFG.get("referenzwerke", [])
NEW_CARD_PREFIX, NOTE_PREFIX = K["neue_id_praefix"], K["notiz_praefix"]
DECK_CARDS, DECK_NOTES = tuple(K["deck_karten_praefixe"]), tuple(K["deck_notiz_praefixe"])
FINDING_RE = re.compile("^(" + "|".join(K.get("befunde", ["Neue Quelle"])) + ")$")

errors, warnings = [], []
def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

data = json.load(open(BACKUP, encoding="utf-8"))
ws = data["workspace"]
cards = {c["id"]: c for c in ws["cards"]}
notes = {n["id"]: n for n in ws["notes"]}
# Neue Fachthemen stehen in modul.json („themen“) und werden beim Einspielen angelegt
topics = {t["id"] for t in ws["topics"]} | {t["id"] for t in CFG.get("themen", [])}
ch =json.load(open(CHANGES, encoding="utf-8"))

# --- Struktur
for key in ("new_cards", "modified_cards", "new_notes", "modified_notes", "delete_proposals"):
    if key not in ch or not isinstance(ch[key], list):
        err(f"Schlüssel {key} fehlt oder ist keine Liste")
extra = set(ch) - {"new_cards", "modified_cards", "new_notes", "modified_notes", "delete_proposals"}
if extra:
    err(f"unerwartete Schlüssel: {sorted(extra)}")

# --- neue Notizen
new_note_ids = set()
for n in ch.get("new_notes", []):
    nid = n.get("id", "")
    if set(n) != NOTE_FIELDS:
        err(f"Notiz {nid}: Felder {sorted(set(n) ^ NOTE_FIELDS)} weichen vom noteSchema ab")
    if not ID_RE.match(nid):
        err(f"Notiz {nid}: ungültige ID")
    if nid in notes or nid in new_note_ids:
        err(f"Notiz {nid}: ID nicht eindeutig")
    if n.get("topicId") and n["topicId"] not in topics:
        err(f"Notiz {nid}: topicId {n['topicId']} existiert nicht")
    if not (1 <= len(n.get("title", "").strip()) <= 160): err(f"Notiz {nid}: Titellänge")
    if len(n.get("summary", "")) > 600: err(f"Notiz {nid}: summary > 600")
    if len(n.get("content", "")) > 80000: err(f"Notiz {nid}: content > 80000")
    new_note_ids.add(nid)
all_notes = set(notes) | new_note_ids


def check_text(cid, q, a, where):
    for label, s, mx in (("question", q, 12000), ("answer", a, 20000)):
        if not isinstance(s, str) or not s.strip():
            err(f"{where} {cid}: {label} leer")
        elif len(s) > mx:
            err(f"{where} {cid}: {label} länger als {mx} ({len(s)})")
        elif s != s.strip():
            warn(f"{where} {cid}: {label} hat führende/abschließende Leerzeichen (App trimmt)")
    text = (q or "") + "\n" + (a or "")
    for pat, why in FORBIDDEN:
        m = re.search(pat, text)
        if m:
            err(f"{where} {cid}: verbotener Ausdruck „{m.group(0)}“ ({why})")
    for h in HEDGES:
        if h.lower() in text.lower():
            err(f"{where} {cid}: Absicherungsfloskel „{h}“")
    for pat, why in OUTDATED:
        if re.search(pat, text):
            err(f"{where} {cid}: {why}")
    if not re.search(r"^Quelle: .+", a or "", re.M):
        err(f"{where} {cid}: keine Zeile „Quelle: …“")
    if EXAMPLE_HINT and any(mk in text for mk in EXAMPLE_MARKERS) and EXAMPLE_HINT not in text:
        err(f"{where} {cid}: Beispielkarte ohne Hinweis auf das Kursbeispiel („{EXAMPLE_HINT}“)")
    g = GUIDE_LINE.search(a or "") if GUIDE_LINE else None
    if g:
        lk = (a or "").find("Laut Kurs")
        if lk < 0 or lk > g.start():
            err(f"{where} {cid}: Guide/Lehrbuch-Zeile ohne vorangehendes „Laut Kurs“")
        if REFERENCES and re.match(r"^\s*(\*\*)?(" + "|".join(map(re.escape, REFERENCES)) + ")", a):
            err(f"{where} {cid}: Antwort beginnt mit einem Referenzwerk statt mit der Kursfassung")
    lit = [m for m in re.finditer(r"^Literatur: (.+)$", a or "", re.M)]
    for m in lit:
        if not re.search(r"\((\d{4}|o\. J\.)\)", m.group(1)):
            err(f"{where} {cid}: Literaturzeile ohne Jahr bzw. „o. J.“")
        if m.start() == 0:
            err(f"{where} {cid}: Antwort beginnt mit Literatur statt mit der Kursaussage")
        qpos = (a or "").find(chr(10) + "Quelle: ")
        if qpos >= 0 and m.start() > qpos:
            err(f"{where} {cid}: Literaturzeile nach der Quellenzeile")
        for url in re.findall(r"https?://\S+", m.group(1)):
            if not url.startswith("https://"):
                warn(f"{where} {cid}: Literatur-URL ohne https: {url}")
    if "Mehrere Antworten" in (q or ""):
        opts = re.findall(r"^- \*\*([A-D])[):]", q, re.M)
        if opts != ["A", "B", "C", "D"]:
            err(f"{where} {cid}: MC-Frage ohne Optionen A–D im Deckformat")
        if not re.match(r"^\*\*(Richtig: )?[A-D]", a or ""):
            err(f"{where} {cid}: MC-Antwort beginnt nicht mit der Lösung")
        sol = re.match(r"^\*\*(?:Richtig: )?([A-D](?:(?:, | und )[A-D])*)", a or "")
        if sol:
            letters = set(re.findall(r"[A-D]", sol.group(1)))
            for wrong in re.findall(r"\*\*([A-D]) ist falsch", a):
                if wrong in letters:
                    err(f"{where} {cid}: Option {wrong} zugleich richtig und falsch")
            if len(letters) + len(set(re.findall(r"\*\*([A-D]) ist falsch", a))) != 4 and "ist falsch" in a:
                warn(f"{where} {cid}: nicht jede Option ist als richtig oder falsch erklärt")


# --- neue Karten
new_ids = set()
for c in ch.get("new_cards", []):
    cid = c.get("id", "")
    if set(c) != CARD_FIELDS:
        err(f"neu {cid}: Felder {sorted(set(c) ^ CARD_FIELDS)} weichen vom flashcardSchema ab")
    if not ID_RE.match(cid):
        err(f"neu {cid}: ID verletzt Regex oder Länge")
    if not cid.startswith(NEW_CARD_PREFIX):
        err(f"neu {cid}: ID ohne Präfix {NEW_CARD_PREFIX}")
    if cid in cards:
        err(f"neu {cid}: ID existiert bereits im Bestand")
    if cid in new_ids:
        err(f"neu {cid}: ID doppelt in new_cards")
    new_ids.add(cid)
    if c.get("noteId") not in all_notes:
        err(f"neu {cid}: noteId {c.get('noteId')} existiert nicht")
    elif not str(c.get("noteId")).startswith(DECK_NOTES):
        warn(f"neu {cid}: noteId {c.get('noteId')} gehört zu keinem Notiz-Präfix des Decks")
    if c.get("dueAt") != DUE: err(f"neu {cid}: dueAt != {DUE}")
    try:
        datetime.fromisoformat(c.get("dueAt", "").replace("Z", "+00:00"))
    except ValueError:
        err(f"neu {cid}: dueAt kein ISO-Datum")
    if c.get("intervalDays") != 0 or type(c.get("intervalDays")) is not int: err(f"neu {cid}: intervalDays != 0")
    if c.get("reviews") != 0 or type(c.get("reviews")) is not int: err(f"neu {cid}: reviews != 0")
    check_text(cid, c.get("question"), c.get("answer"), "neu")

# --- geänderte Karten
mod_ids = set()
for m in ch.get("modified_cards", []):
    cid = m.get("id", "")
    if set(m) != {"id", "before", "after", "reason", "finding"}:
        err(f"geändert {cid}: Felder {sorted(set(m))}")
    if cid in mod_ids: err(f"geändert {cid}: doppelt")
    mod_ids.add(cid)
    if cid not in cards:
        err(f"geändert {cid}: existiert nicht im Bestand"); continue
    old = cards[cid]
    b, a = m.get("before", {}), m.get("after", {})
    if set(b) != {"question", "answer"}: err(f"geändert {cid}: before-Felder {sorted(b)}")
    if b.get("question") != old["question"]: err(f"geändert {cid}: before.question weicht vom Bestand ab")
    if b.get("answer") != old["answer"]: err(f"geändert {cid}: before.answer weicht vom Bestand ab")
    if not set(a) <= {"question", "answer", "noteId"} or not {"question", "answer"} <= set(a):
        err(f"geändert {cid}: after-Felder {sorted(a)} (erlaubt: question, answer, noteId)")
    if "noteId" in a and a["noteId"] not in all_notes:
        err(f"geändert {cid}: neue noteId {a['noteId']} existiert nicht")
    if a.get("question") == old["question"] and a.get("answer") == old["answer"] and a.get("noteId", old["noteId"]) == old["noteId"]:
        err(f"geändert {cid}: after ist identisch mit dem Bestand")
    if not m.get("reason", "").strip(): err(f"geändert {cid}: reason fehlt")
    if not FINDING_RE.match(m.get("finding", "")):
        err(f"geändert {cid}: finding „{m.get('finding')}“ ungültig")
    if not cid.startswith(DECK_CARDS): err(f"geändert {cid}: keine Karte des Decks")
    check_text(cid, a.get("question"), a.get("answer"), "geändert")
    # Bilder/Links der alten Antwort, die verschwinden, melden
    for media in re.findall(r"/api/media/[0-9a-f-]+", old["answer"]):
        if media not in a.get("answer", ""):
            warn(f"geändert {cid}: Bild {media} entfällt (beabsichtigt?)")

# --- geänderte Notizen (Nachtrag 09.10.)
NOTE_UPDATED = K["notiz_stand"]
mn_ids = set()
for m in ch.get("modified_notes", []):
    nid = m.get("id", "")
    if set(m) != {"id", "before", "after", "reason"}:
        err(f"Notiz {nid}: Felder {sorted(set(m))}")
    if nid in mn_ids: err(f"Notiz {nid}: doppelt")
    mn_ids.add(nid)
    if nid not in notes:
        err(f"Notiz {nid}: existiert nicht im Bestand"); continue
    old = notes[nid]
    if not nid.startswith(DECK_NOTES): err(f"Notiz {nid}: keine Notiz des Decks")
    b, a = m.get("before", {}), m.get("after", {})
    if set(b) != {"content", "summary"}: err(f"Notiz {nid}: before-Felder {sorted(b)}")
    if b.get("content") != old["content"]: err(f"Notiz {nid}: before.content weicht vom Bestand ab")
    if b.get("summary") != old["summary"]: err(f"Notiz {nid}: before.summary weicht vom Bestand ab")
    if set(a) != {"content", "summary", "updatedAt"}: err(f"Notiz {nid}: after-Felder {sorted(a)} (erwartet content, summary, updatedAt)")
    if a.get("updatedAt") != NOTE_UPDATED: err(f"Notiz {nid}: updatedAt != {NOTE_UPDATED}")
    try:
        datetime.fromisoformat(a.get("updatedAt", "").replace("Z", "+00:00"))
    except ValueError:
        err(f"Notiz {nid}: updatedAt kein ISO-Datum")
    if len(a.get("summary", "")) > 600: err(f"Notiz {nid}: summary > 600")
    if len(a.get("content", "")) > 80000: err(f"Notiz {nid}: content > 80000")
    if a.get("content") == old["content"] and a.get("summary") == old["summary"]:
        err(f"Notiz {nid}: after identisch mit dem Bestand")
    if not m.get("reason", "").strip(): err(f"Notiz {nid}: reason fehlt")
    text = a.get("summary", "") + chr(10) + a.get("content", "")
    for pat, why in FORBIDDEN:
        mm = re.search(pat, text)
        if mm: err(f"Notiz {nid}: verbotener Ausdruck „{mm.group(0)}“ ({why})")
    for h in HEDGES:
        if h.lower() in text.lower(): err(f"Notiz {nid}: Absicherungsfloskel „{h}“")
    for pat, why in OUTDATED:
        if re.search(pat, text): err(f"Notiz {nid}: {why}")
    if EXAMPLE_HINT and any(mk in text for mk in EXAMPLE_MARKERS) and EXAMPLE_HINT not in text:
        err(f"Notiz {nid}: Beispiel ohne Hinweis auf das Kursbeispiel („{EXAMPLE_HINT}“)")
    for media in re.findall(r"/api/media/[0-9a-f-]+", old["content"]):
        if media not in a.get("content", ""):
            if media not in m.get("reason", ""):
                err(f"Notiz {nid}: Bild {media} entfernt, aber nicht in reason vermerkt")
            else:
                warn(f"Notiz {nid}: Bild {media} entfernt (vermerkt)")
    gl = GUIDE_LINE.search(a.get("content", "")) if GUIDE_LINE else None
    if gl and a["content"].find("Laut Kurs") < 0:
        err(f"Notiz {nid}: Guide/Lehrbuch-Zeile ohne Kursaussage")

# --- Löschvorschläge
for d in ch.get("delete_proposals", []):
    cid = d.get("id", "")
    if set(d) != {"id", "reason", "merge_into"}: err(f"löschen {cid}: Felder {sorted(d)}")
    if cid not in cards: err(f"löschen {cid}: existiert nicht")
    if d.get("merge_into") and d["merge_into"] not in cards and d["merge_into"] not in new_ids:
        err(f"löschen {cid}: merge_into {d['merge_into']} existiert nicht")
    if d.get("merge_into") == cid: err(f"löschen {cid}: merge_into auf sich selbst")
    if cid in mod_ids:
        warn(f"löschen {cid}: wird zugleich geändert (Änderung gilt nur, falls die Karte behalten wird)")
    if cards.get(cid, {}).get("reviews", 0) > 0:
        warn(f"löschen {cid}: Karte hat Lernfortschritt ({cards[cid]['reviews']} Wiederholungen)")

# --- Gesamtprüfung nach Anwendung
applied = {cid: dict(c) for cid, c in cards.items()}
for m in ch.get("modified_cards", []):
    if m.get("id") in applied:
        applied[m["id"]].update(m["after"])
for c in ch.get("new_cards", []):
    applied[c["id"]] = dict(c)
if len(applied) > 3000: err("Arbeitsraum: mehr als 3000 Karten")
for cid, c in applied.items():
    if c.get("noteId") and c["noteId"] not in all_notes:
        err(f"Arbeitsraum: {cid} verweist auf fehlende Notiz")
    if not (0 <= c["intervalDays"] <= 30): err(f"Arbeitsraum: {cid} intervalDays außerhalb 0..30")
for m in ch.get("modified_cards", []):
    o, n = cards.get(m["id"]), applied.get(m["id"])
    if o and n and (o["dueAt"], o["intervalDays"], o["reviews"]) != (n["dueAt"], n["intervalDays"], n["reviews"]):
        err(f"geändert {m['id']}: Lernstand verändert")
qs = {}
for cid, c in applied.items():
    if cid.startswith(DECK_CARDS):
        qs.setdefault(c["question"].strip(), []).append(cid)
for q, ids in qs.items():
    if len(ids) > 1:
        warn(f"gleiche Frage in {ids}")

deck_after = sum(1 for k in applied if k.startswith(DECK_CARDS))
print(f"Stand: rev {data.get('revision')}, {len(cards)} Karten, davon {sum(1 for k in cards if k.startswith(DECK_CARDS))} im Deck")
print(f"Änderungsliste: {len(ch.get('new_cards', []))} neu, {len(ch.get('modified_cards', []))} geändert, "
      f"{len(ch.get('new_notes', []))} neue Notizen, {len(ch.get('delete_proposals', []))} Löschvorschläge")
print(f"Geänderte Notizen: {len(ch.get('modified_notes', []))}")
print(f"Nach Anwendung (ohne Löschungen): {deck_after} Karten im Deck")
for w in warnings: print("WARNUNG:", w)
for e in errors: print("FEHLER:", e)
print(f"Ergebnis: {len(errors)} Fehler, {len(warnings)} Warnungen")
sys.exit(1 if errors else 0)
