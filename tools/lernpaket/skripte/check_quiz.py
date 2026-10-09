"""Prüft Multiple-Choice-Aufgaben für das Second Brain (Modell quizQuestions).

Aufruf:  python -I check_quiz.py --modul <modul.json> <datei.json> [--pool]

Alles Modulspezifische (Fachthema, Lernbereiche mit Zielverteilung, ID-Präfix,
verbotene Ausdrücke, Fehlhörungen, Referenzwerke) steht in modul.json.

<datei.json> enthält eine JSON-Liste von Aufgaben oder ein Objekt mit
dem Schlüssel "quizQuestions". --pool aktiviert zusätzlich die Prüfungen,
die nur für den vollständigen Pool sinnvoll sind (Verteilung, Zellen je
Lernbereich und Stufe, Anteil Mehrfachantworten) sowie die Pool-Prüfungen
auf Lösungshinweise:
  - Einfachaufgaben: Anteil „richtige Option = längste“ (FEHLER > 35 %,
    HINWEIS < 10 %, weil dann umgekehrt „längste Option = falsch“ gilt)
  - Mehrfachaufgaben: Längenverhältnis richtig/falsch je Aufgabe (HINWEIS
    > 1,15) und im Pool-Mittel (HINWEIS außerhalb 0,85–1,15)
  - Fragestamm im Singular („Welche Aussage“, „Welcher …“, „Welches …“,
    „Welche drei …“) verrät die Zahl richtiger Antworten (HINWEIS)
  - Fragewort: Anteil „Welche …“-Stämme bei Einfach- und Mehrfachaufgaben
    (HINWEIS bei mehr als 25 Prozentpunkten Unterschied)
  - absolute Wörter nur in falschen Optionen (HINWEIS je Aufgabe, immer
    aktiv; FEHLER, wenn pool-weit > 25 % der Aufgaben betroffen sind)

FEHLER  = Import ins Second Brain schlägt fehl (quizQuestionSchema in
          lib/brain/model.ts) oder harte Pool-Regel/AGENTS.md verletzt.
HINWEIS = Stilregel des Pools (Distraktoren, Längen, Lösungshinweise).
Rückgabewert 1 bei mindestens einem FEHLER, sonst 0.
"""
import json
import re
import sys
from collections import Counter, defaultdict

def _load_modul():
    """Read --modul <file> from the command line and remove it from sys.argv."""
    if "--modul" not in sys.argv:
        raise SystemExit("Aufruf: check_quiz.py --modul <modul.json> <datei.json> [--pool]")
    i = sys.argv.index("--modul")
    path = sys.argv[i + 1]
    del sys.argv[i:i + 2]
    with open(path, encoding="utf-8") as f:
        return json.load(f)


CFG = _load_modul()
SUBJECT = CFG["fachthema"]
# Lernbereich (concept) -> Kürzel im ID-Schema <praefix><kürzel>-<nr>
CONCEPTS = {b["name"]: b["kuerzel"] for b in CFG["quiz"]["lernbereiche"]}
# Soll-Verteilung (Stufe 1, 2, 3); nur mit --pool geprüft.
TARGET = {b["kuerzel"]: tuple(b["ziel"]) for b in CFG["quiz"]["lernbereiche"]}
POOL_SIZE = tuple(CFG["quiz"].get("poolgroesse", [0, 10000]))
ID_PREFIX = CFG["quiz"]["id_praefix"]
REFERENCES = CFG.get("referenzwerke", [])

ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
POOL_ID_RE = re.compile(r"^" + re.escape(ID_PREFIX) + r"([a-z]+)-(\d{2,3})$")
URL_RE = re.compile(r"^https?://", re.I)
KEYS = {"id", "subject", "concept", "difficulty", "prompt", "options", "correctOptionIds", "explanation", "source"}
OPTION_KEYS = {"id", "text", "feedback"}

# AGENTS.md: keine Hochschul-, Kurs- oder Firmenkürzel; dazu Fehlhörungen aus den
# Transkripten, damit nichts ungeprüft übernommen wird. Beides steht in modul.json.
FORBIDDEN = [(x["muster"], x["grund"]) for x in CFG.get("verbotene_ausdruecke", []) + CFG.get("fehlhoerungen", [])]
SOFT = [(x["muster"], x["grund"]) for x in CFG.get("weiche_ausdruecke", [])]
CATCH_ALL = re.compile(r"\b(alle|keine|beide)\s+(der\s+)?(oben\s+)?(genannten|Antworten|Aussagen sind)\b|\bkeine Antwort\b", re.I)
PROMPT_HINT = re.compile(r"wähle alle|mehrere (richtige )?antworten|(eine|zwei|drei) antworten? (ist|sind) richtig", re.I)
# Absolute Wörter (Lösungshinweis, wenn sie nur in falschen Optionen stehen).
# „vor allem“ ist eine Gewichtung, kein absolutes Wort.
ABSOLUTE = re.compile(
    r"(?<!vor )\b(alle[mnrs]?|allein|jede[mnrs]?|nie|niemals|niemand|nichts|immer|stets|nur|"
    r"ausschließlich|grundsätzlich|zwingend|verpflichtend|verbindlich|kein(?:e[mnrs]?)?|"
    r"keinesfalls|sämtliche[mnrs]?|in jedem Fall)\b", re.I)
# Fragestamm im Singular: „Welcher/Welches“ + Nomen, „Welche“ + typisches
# Singularnomen, „Welche drei …“. Der Plural („Welche Aussagen …“) ist neutral.
SINGULAR_NOUNS = (r"Aussage|Beschreibung|Antwort|Sicht|Sichtweise|Einschätzung|Empfehlung|Zielsetzung|"
                  r"Reihenfolge|Rolle|Phase|Methode|Maßnahme|Deutung|Zuordnung|Folge|Reaktion|Lösung|"
                  r"Begründung|Frage|Option|Variante|Definition|Formulierung|Einordnung|Kombination|"
                  r"Ebene|Zahl|Größe|Story|Rechnung|Haltung|Entscheidung|Konsequenz|Ursache|Prognose")
STEM_SINGULAR = re.compile(
    r"\bWelche[rs]\s+(?:der\s+|des\s+)?[A-ZÄÖÜ][\w-]*"
    r"|\bWelche\s+(?:(?:[a-zäöüß]+e)\s+)?(?:" + SINGULAR_NOUNS + r")(?![a-zäöüß])"
    r"|\bWelche\s+(?:zwei|drei|vier|fünf)\s")
LAST_SENTENCE = re.compile(r"(?<=[.:?“])\s+(?=[A-ZÄÖÜ])")
FUNDSTELLE = re.compile(r"Aufzeichnung (\d+|[A-C])(\s\([^)]+\)|\s„[^“]+“)?\s\[\d{2}:\d{2}\]|Kurstext „[^“]+“")
AMBIGUOUS_NO = re.compile(r"Aufzeichnung (" + ("|".join(CFG.get("doppelte_nummern", [])) or "(?!)") + r")\s\[")


def jslen(s):
    """Länge wie JavaScript/zod (UTF-16-Codeeinheiten)."""
    return len(s.encode("utf-16-le")) // 2


def jstrim(s):
    return s.strip(" \t\n\r\v\f                 　﻿")


class Report:
    def __init__(self):
        self.errors, self.hints = [], []

    def err(self, where, msg):
        self.errors.append(f"FEHLER  {where}: {msg}")

    def hint(self, where, msg):
        self.hints.append(f"HINWEIS {where}: {msg}")


def check_text(r, where, value, field, min_len, max_len, trim=True):
    if not isinstance(value, str):
        r.err(where, f"{field} muss ein Text sein")
        return ""
    v = jstrim(value) if trim else value
    if trim and v != value:
        r.hint(where, f"{field} hat Leerraum am Anfang/Ende (zod kürzt ihn beim Import)")
    if jslen(v) < min_len:
        r.err(where, f"{field} ist leer")
    if jslen(v) > max_len:
        r.err(where, f"{field} hat {jslen(v)} Zeichen (max. {max_len})")
    return v


def check_id(r, where, value, field):
    if not isinstance(value, str) or not (1 <= jslen(value) <= 100) or not ID_RE.match(value):
        r.err(where, f"{field} {value!r} verletzt das ID-Schema [a-zA-Z0-9_-], 1–100 Zeichen")
        return False
    return True


def all_texts(q):
    yield "id", str(q.get("id", ""))
    for f in ("subject", "concept", "prompt", "explanation", "source"):
        if isinstance(q.get(f), str):
            yield f, q[f]
    for o in q.get("options") or []:
        if isinstance(o, dict):
            for f in ("text", "feedback"):
                if isinstance(o.get(f), str):
                    yield f"Option {o.get('id')} {f}", o[f]


def check_question(r, q, index):
    where = f"#{index + 1}"
    if not isinstance(q, dict):
        r.err(where, "Aufgabe ist kein Objekt")
        return None
    qid = q.get("id")
    where = f"#{index + 1} {qid}"
    missing = KEYS - q.keys()
    if missing:
        r.err(where, "fehlende Felder: " + ", ".join(sorted(missing)))
    extra = q.keys() - KEYS
    if extra:
        r.hint(where, "unbekannte Felder werden beim Import verworfen: " + ", ".join(sorted(extra)))

    if check_id(r, where, qid, "id"):
        m = POOL_ID_RE.match(qid)
        if not m:
            r.err(where, f"ID folgt nicht dem Pool-Schema {ID_PREFIX}<bereich>-<nr> (Nummer zweistellig)")
        elif m.group(1) not in CONCEPTS.values():
            r.err(where, f"unbekanntes Bereichskürzel {m.group(1)!r}")
        elif q.get("concept") in CONCEPTS and CONCEPTS[q["concept"]] != m.group(1):
            r.err(where, f"Bereichskürzel {m.group(1)!r} passt nicht zum Lernbereich {q['concept']!r}")

    subject = check_text(r, where, q.get("subject"), "subject", 1, 160)
    if subject and subject != SUBJECT:
        r.err(where, f"subject muss exakt „{SUBJECT}“ lauten (die App filtert den Pool auf Gleichheit)")
    concept = check_text(r, where, q.get("concept"), "concept", 1, 160)
    if concept and concept not in CONCEPTS:
        r.err(where, f"Lernbereich {concept!r} steht nicht in der festgelegten Liste")

    d = q.get("difficulty")
    if isinstance(d, bool) or not isinstance(d, int) or not 1 <= d <= 3:
        r.err(where, "difficulty muss eine ganze Zahl von 1 bis 3 sein")

    prompt = check_text(r, where, q.get("prompt"), "prompt", 1, 3000)
    if PROMPT_HINT.search(prompt):
        r.hint(where, "Fragestellung verrät die Zahl richtiger Antworten (die App zeigt den Hinweis „Wähle alle passenden Antworten“ ohnehin bei jeder Aufgabe)")

    options = q.get("options")
    option_ids = []
    if not isinstance(options, list):
        r.err(where, "options muss eine Liste sein")
        options = []
    if not 2 <= len(options) <= 6:
        r.err(where, f"{len(options)} Antwortmöglichkeiten (Schema: 2–6)")
    elif not 4 <= len(options) <= 5:
        r.hint(where, f"{len(options)} Antwortmöglichkeiten (Pool-Regel: 4–5)")
    texts = []
    for o in options:
        ow = f"{where} Option {o.get('id') if isinstance(o, dict) else '?'}"
        if not isinstance(o, dict):
            r.err(ow, "Antwortmöglichkeit ist kein Objekt")
            continue
        if OPTION_KEYS - o.keys():
            r.err(ow, "fehlende Felder: " + ", ".join(sorted(OPTION_KEYS - o.keys())))
        if check_id(r, ow, o.get("id"), "Options-ID"):
            option_ids.append(o["id"])
        t = check_text(r, ow, o.get("text"), "text", 1, 1000)
        texts.append(t)
        fb = o.get("feedback")
        if not isinstance(fb, str):
            r.err(ow, "feedback muss ein Text sein")
        else:
            if jslen(fb) > 2000:
                r.err(ow, f"feedback hat {jslen(fb)} Zeichen (max. 2000)")
            if not jstrim(fb):
                r.err(ow, "feedback fehlt (Pool-Regel: Rückmeldung je Option)")
        if CATCH_ALL.search(t):
            r.err(ow, "Sammeloption („alle/keine/beide genannten …“) ist nicht erlaubt; Optionen werden gemischt")
    if len(set(option_ids)) != len(option_ids):
        r.err(where, "Options-IDs sind nicht eindeutig")
    if len(set(texts)) != len(texts):
        r.err(where, "zwei Antwortmöglichkeiten haben denselben Text")

    correct = q.get("correctOptionIds")
    if not isinstance(correct, list) or not 1 <= len(correct) <= 6:
        r.err(where, "correctOptionIds muss 1–6 IDs enthalten")
        correct = correct if isinstance(correct, list) else []
    for c in correct:
        check_id(r, where, c, "richtige Antwort")
    if len(set(map(str, correct))) != len(correct):
        r.err(where, "correctOptionIds enthält doppelte IDs")
    unknown = [c for c in correct if c not in option_ids]
    if unknown:
        r.err(where, f"correctOptionIds verweist auf fehlende Optionen: {unknown}")
    if options and len(set(correct)) >= len(options):
        r.hint(where, "alle Optionen sind richtig; das wirkt wie eine Sammeloption")

    explanation = check_text(r, where, q.get("explanation"), "explanation", 1, 4000)
    if explanation and not FUNDSTELLE.search(explanation):
        r.err(where, "Erklärung ohne Fundstelle im Deck-Format, z. B. „Aufzeichnung 22 [00:59]–[01:28]“")
    for m in AMBIGUOUS_NO.finditer(explanation):
        r.hint(where, f"„Aufzeichnung {m.group(1)}“ ist doppelt vergeben; Zusatz wie „(Umfeld)“ bzw. „„Stakeholder Map““ ergänzen")
    mentions_guide = re.search("|".join(map(re.escape, REFERENCES)), explanation) if REFERENCES else None
    if mentions_guide and "Laut Kurs" not in explanation and "laut Kurs" not in explanation:
        r.hint(where, "Erklärung nennt ein Referenzwerk, aber keine Kursfassung („Laut Kurs …“)")

    source = q.get("source")
    if not isinstance(source, str) or jslen(source) > 1000:
        r.err(where, "source muss ein Text mit höchstens 1000 Zeichen sein")
    elif source and not URL_RE.match(source):
        r.err(where, "source muss leer oder eine HTTP(S)-URL sein (Fundstellen gehören in die Erklärung)")
    elif mentions_guide and not source:
        r.hint(where, "Referenzwerk zitiert, aber source ist leer")

    for field, text in all_texts(q):
        for pattern, why in FORBIDDEN:
            hit = re.search(pattern, text, re.I if pattern.startswith(r"\bAGPM") else 0)
            if hit:
                r.err(where, f"{field}: verbotener Begriff „{hit.group(0)}“ ({why})")
        for pattern, why in SOFT:
            hit = re.search(pattern, text)
            if hit:
                r.hint(where, f"{field}: „{hit.group(0)}“ ({why})")

    # Lösungshinweise durch Formulierung
    by_id = {o.get("id"): o for o in options if isinstance(o, dict)}
    right = [by_id[c].get("text", "") for c in correct if c in by_id]
    wrong = [o.get("text", "") for o in by_id.values() if o.get("id") not in correct]
    if wrong and any(ABSOLUTE.search(t) for t in wrong) and not any(ABSOLUTE.search(t) for t in right):
        r.hint(where, "absolute Wörter (immer/nie/zwingend …) nur in falschen Optionen")
    lengths = [jslen(t) for t in texts if t]
    if lengths and min(lengths) and max(lengths) / min(lengths) > 2.0:
        r.hint(where, f"Optionslängen ungleich ({min(lengths)}–{max(lengths)} Zeichen)")
    if len(right) == 1 and wrong and jslen(right[0]) >= 1.25 * max(jslen(t) for t in wrong):
        r.hint(where, "die einzige richtige Option ist deutlich die längste")

    size = len(json.dumps(q, ensure_ascii=False).encode("utf-8"))
    if size > 3500:
        r.hint(where, f"{size} Byte; jede Testrunde speichert eine Kopie der Aufgabe (Arbeitsraum max. 1,8 MB)")
    last = LAST_SENTENCE.split(prompt)[-1] if prompt else ""
    singular = STEM_SINGULAR.search(prompt or "")
    return {"id": qid, "concept": concept, "difficulty": d, "multi": len(correct) > 1, "bytes": size, "prompt": prompt,
            "right_len": [jslen(t) for t in right], "wrong_len": [jslen(t) for t in wrong],
            "abs_wrong_only": bool(wrong and any(ABSOLUTE.search(t) for t in wrong) and not any(ABSOLUTE.search(t) for t in right)),
            "abs_right_only": bool(right and any(ABSOLUTE.search(t) for t in right) and not any(ABSOLUTE.search(t) for t in wrong)),
            "stem_singular": singular.group(0).strip() if singular else "",
            "stem_welche": last.startswith("Welche ")}


STATS = []


def pool_hint_checks(r, stats):
    """Pool-weite Prüfungen auf Lösungshinweise (nur mit --pool)."""
    singles = [s for s in stats if len(s["right_len"]) == 1 and s["wrong_len"]]
    multis = [s for s in stats if len(s["right_len"]) > 1 and s["wrong_len"]]
    # 1. Einfachaufgaben: richtige Option ist (echt) die längste
    if singles:
        longest = [s for s in singles if s["right_len"][0] > max(s["wrong_len"])]
        share = len(longest) / len(singles)
        line = (f"richtige Option ist die längste in {len(longest)} von {len(singles)} Einfachaufgaben "
                f"({share:.0%}; Zufall bei 4 Optionen ≈ 25 %)")
        if share > 0.35:
            r.err("Pool", line + " – Grenze 35 %")
        elif share < 0.10:
            r.hint("Pool", line + " – unter 10 % gilt umgekehrt „längste Option = falsch“")
        STATS.append("Einfachaufgaben: " + line)
    # 2. Mehrfachaufgaben: mittlere Länge richtig/falsch
    ratios = []
    for s in multis:
        ratio = (sum(s["right_len"]) / len(s["right_len"])) / (sum(s["wrong_len"]) / len(s["wrong_len"]))
        ratios.append(ratio)
        if ratio > 1.15:
            r.hint(s["id"], f"richtige Optionen im Mittel {ratio - 1:.0%} länger als die falschen (Grenze 15 %)")
    if ratios:
        mean = sum(ratios) / len(ratios)
        line = (f"Längenverhältnis richtig/falsch im Mittel {mean:.2f} über {len(ratios)} Mehrfachaufgaben "
                f"({sum(x > 1.15 for x in ratios)} Aufgaben über 1,15)")
        if not 0.85 <= mean <= 1.15:
            r.hint("Pool", line + " – Ziel 0,85–1,15")
        STATS.append("Mehrfachaufgaben: " + line)
    # 3. Fragestamm im Singular
    for s in stats:
        if s["stem_singular"]:
            r.hint(s["id"], f"Fragestamm im Singular („{s['stem_singular']} …“) verrät die Zahl richtiger Antworten; "
                            "neutral formulieren, z. B. „Welche Aussagen …“ oder „Was gilt laut Kurs für …?“")
    STATS.append(f"Fragestamm im Singular: {sum(bool(s['stem_singular']) for s in stats)} Aufgaben")
    # 4. Fragewort „Welche …“ bei Einfach- und Mehrfachaufgaben ähnlich häufig
    if singles and multis:
        ws = sum(s["stem_welche"] for s in singles) / len(singles)
        wm = sum(s["stem_welche"] for s in multis) / len(multis)
        line = f"Fragesatz beginnt mit „Welche …“: {ws:.0%} der Einfach-, {wm:.0%} der Mehrfachaufgaben"
        if abs(ws - wm) > 0.25:
            r.hint("Pool", line + " – das Fragewort verrät, ob eine oder mehrere Antworten richtig sind")
        STATS.append(line)
    # 5. Absolute Wörter nur in falschen Optionen (Hinweis je Aufgabe kommt aus check_question)
    if stats:
        n_wrong = sum(s["abs_wrong_only"] for s in stats)
        n_right = sum(s["abs_right_only"] for s in stats)
        line = (f"absolute Wörter nur in falschen Optionen: {n_wrong} von {len(stats)} Aufgaben "
                f"({n_wrong / len(stats):.0%}); nur in richtigen: {n_right}")
        if n_wrong / len(stats) > 0.25:
            r.err("Pool", line + " – Grenze 25 %")
        STATS.append(line)


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    pool_mode = "--pool" in argv
    if len(args) != 1:
        print(__doc__)
        return 2
    sys.stdout.reconfigure(encoding="utf-8")
    with open(args[0], encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("quizQuestions")
    r = Report()
    if not isinstance(data, list):
        r.err("Datei", "erwartet eine JSON-Liste von Aufgaben oder {\"quizQuestions\": [...]}")
        data = []
    stats = [s for i, q in enumerate(data) if (s := check_question(r, q, i))]

    ids = Counter(s["id"] for s in stats)
    for qid, n in ids.items():
        if n > 1:
            r.err(str(qid), f"ID kommt {n}-mal vor")
    prompts = Counter(s["prompt"] for s in stats if s["prompt"])
    for p, n in prompts.items():
        if n > 1:
            r.hint("Pool", f"Fragestellung doppelt: {p[:60]}…")

    cells = defaultdict(int)
    for s in stats:
        cells[(s["concept"], s["difficulty"])] += 1
    total = len(stats)
    multi = sum(s["multi"] for s in stats)
    if pool_mode:
        if not POOL_SIZE[0] <= total <= POOL_SIZE[1]:
            r.hint("Pool", f"{total} Aufgaben (Ziel {POOL_SIZE[0]}–{POOL_SIZE[1]})")
        if total and not 0.35 <= multi / total <= 0.55:
            r.hint("Pool", f"Anteil Mehrfachantworten {multi / total:.0%} (Ziel 35–55 %)")
        for concept, code in CONCEPTS.items():
            for level in (1, 2, 3):
                n = cells[(concept, level)]
                want = TARGET[code][level - 1]
                if n < 3:
                    r.hint("Pool", f"{concept} / Stufe {level}: nur {n} Aufgaben (adaptives Üben braucht mindestens 3)")
                elif n < want:
                    r.hint("Pool", f"{concept} / Stufe {level}: {n} von {want} geplanten Aufgaben")
        pool_hint_checks(r, stats)

    print(f"Geprüft: {args[0]}")
    print(f"Aufgaben: {total} · Mehrfachantworten: {multi} ({(multi / total if total else 0):.0%})")
    if stats:
        avg = sum(s["bytes"] for s in stats) / len(stats)
        print(f"Größe: Ø {avg:.0f} Byte je Aufgabe · eine 20er-Runde speichert ca. {20 * avg / 1000:.0f} KB")
    print("Verteilung Lernbereich × Stufe (1/2/3):")
    for concept in CONCEPTS:
        row = [cells[(concept, lvl)] for lvl in (1, 2, 3)]
        if any(row) or pool_mode:
            print(f"  {concept:45s} {row[0]:3d} {row[1]:3d} {row[2]:3d}")
    if STATS:
        print("Lösungshinweise im Pool:")
        for line in STATS:
            print("  " + line)
    for line in r.errors + r.hints:
        print(line)
    print(f"Ergebnis: {len(r.errors)} Fehler, {len(r.hints)} Hinweise")
    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
