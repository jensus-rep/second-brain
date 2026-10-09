# Auftrag: Testaufgaben für ein Lernpaket

> Platzhalter vor dem Versand ersetzen: `{{ARBEITSORDNER}}`, `{{MODUL_JSON}}`, `{{TEIL}}`, `{{BEREICHE}}` (Lernbereiche
> mit Stückzahl je Stufe und ID-Nummern), `{{QUELLEN}}` (Aufzeichnungsnummern dieses Teils).

Du entwirfst Multiple-Choice-Testaufgaben für die Prüfungsvorbereitung in der Lern-App Second Brain (Modell
`quizQuestions`). Modul, Prüfungsform, Fachthema, Lernbereiche und Regeln stehen in `{{MODUL_JSON}}`. Du schreibst
**nur** deine Ausgabedateien. Keine API-Aufrufe, kein Push, keine anderen Dateien ändern.

## Lesen

- `{{MODUL_JSON}}` (Prüfungsform `pruefung`, Fachthema, Lernbereiche, verbotene Ausdrücke, Übertragungsbeispiel).
- Soll-Liste im Arbeitsordner `{{ARBEITSORDNER}}` (`soll-liste.md`): Abschnitte 2–5 sind der Stoff, Abschnitt 4 liefert
  Distraktoren, Abschnitt 5 Abweichungen und „zwei Fassungen im Kurs“, Abschnitt 7 die Lernbereiche.
- Quellen: `{{ARBEITSORDNER}}/quellen.json` (Aufzeichnungsnummer → Titel → Transkriptdatei). Jede Aussage im Transkript
  prüfen. Kurstexte im Kursexport (`kursraum/texte/`).
- Bestand: `{{ARBEITSORDNER}}/stand.json` → `workspace.quizQuestions`. Keine Dubletten, auch nicht in anderer Form.
- Prüfskript (muss 0 Fehler melden):
  `python -I <repo>/tools/lernpaket/skripte/check_quiz.py --modul {{MODUL_JSON}} <deine-datei.json>`

## Dein Teil

{{TEIL}}: {{BEREICHE}}. Hauptquellen: {{QUELLEN}}. Keine Aufgaben außerhalb deiner Bereiche.

Stufe 1 = Wissen, Stufe 2 = Verständnis/Abgrenzung, Stufe 3 = Praxistransfer. IDs `<id_praefix><kürzel>-<nn>`,
zweistellig, fortlaufend je Lernbereich; `concept` wörtlich aus `modul.json`, `subject` = `fachthema`.

## Inhaltliche Regeln

1. **Kursfassung gilt.** Keine Aufgabe wertet eine Kursaussage als falsch. Weicht der Kurs von einem Referenzwerk
   oder der Literatur ab, sagt der Fragestamm „laut Kurs“; die Referenz steht in der Erklärung (z. B. „Scrum Guide
   2020: …“, „Hinweis (Lehrmeinung): …“). Wo der Kurs **zwei Fassungen** hat, nie eine gegen die andere ausspielen:
   den Stamm auf die konkrete Einheit beziehen oder nur abfragen, was beide Fassungen tragen.
2. **Jede Aussage belegt:** Die Erklärung endet mit „Fundstelle: Aufzeichnung NN „Titel“ [mm:ss]–[mm:ss].“ oder
   „Fundstelle: Kurstext „…“.“ Nie Kurs- oder Lehreinheitskürzel.
3. **Übertragungsbeispiel** nur bei Transferaufgaben, wo es passt; keine Hochschul-, Firmen- oder Personennamen
   (Lehrende und Gesprächspartner nur als Rolle; Firmen umschreiben). Standards, Werkzeuge und Fachautoren sind erlaubt.
4. **Literatur** nur, wo der Kurs nichts Eindeutiges sagt, gekennzeichnet, mit URL in `source`, wenn es eine gibt.
5. **Nur abfragen, was im Kursmaterial steht.** Inhalte, die nur in nicht transkribierten Quellen (externe Videos)
   stecken, nicht voraussetzen.

## Format-Regeln

**Mehrfachantworten:** etwa 40 % des Pools, gestaffelt: Stufe 1 ≈ 25 %, Stufe 2 ≈ 45 %, Stufe 3 ≈ 50 %. Zwei oder drei
richtige, nie alle. Begründung: Die App schreibt bei jeder Aufgabe „Wähle alle passenden Antworten“; bei rund 40 %
lässt sich die Anzahl nicht erraten. Der echte Test gibt keine Teilpunkte.

**Optionen:** 4–5 je Aufgabe (Einfachauswahl meist 4, Mehrfachauswahl meist 5), IDs `a`–`e`.
- Distraktoren aus typischen Verwechslungen (Soll-Liste Abschnitt 4): Zahlen tauschen, Zuordnungen kreuzen,
  Nachbarbegriffe, Lehrmeinung, wo der Kurs anders lehrt (nur als falsche Option, wenn der Stamm „laut Kurs“ sagt).
- **Keine Sammeloptionen** („alle genannten“, „keine“, „beide“); die App mischt die Reihenfolge.
- **Keine Lösungshinweise:** absolute Wörter (immer, nie, ausschließlich) nicht nur in falschen Optionen; ähnliche
  Längen (die einzige richtige Option nicht deutlich die längste); gleicher grammatischer Bau; der Stamm nennt nicht
  die Zahl richtiger Antworten und steht nicht im Singular („Welche Aussage …“); keine Wortgleichheit Stamm ↔ richtige
  Option.
- Fachbegriffe wie im Kurs.

**Rückmeldung je Option (`feedback`):** 1–2 Sätze; bei falschen Optionen der Denkfehler und die richtige Zuordnung.
Die App zeigt **nur die Rückmeldungen falsch gewählter Optionen**; deshalb begründet die **Erklärung** alle richtigen
Optionen.

**Erklärung (`explanation`):** „Laut Kurs …“ (Kernaussage mit allen richtigen Punkten) → ggf. Referenz- oder
Literaturzeile → ggf. Zeile zum übertragenen Beispiel → „Fundstelle: …“. `source` ist leer oder eine HTTP(S)-URL.

**Größe:** höchstens 2,5 KB JSON je Aufgabe. Jede Übungsrunde speichert eine Kopie ihrer Aufgaben; der ganze
Arbeitsraum hat 4 MB.

**IDs nach dem Import nie ändern** (Runden verweisen darauf); `concept` nie umbenennen (Lernprofil hängt daran).

## Wie die App die Aufgaben nutzt

- **Prüfungssimulation:** zieht zufällig über das ganze Fachthema, ohne Schichtung. Gewichtung wirkt nur über die
  Zahl der Aufgaben je Lernbereich.
- **Adaptives Üben:** je Durchgang eine Aufgabe pro Lernbereich, nur aus der aktuellen Stufe; Aufstieg nach zwei
  richtigen in Folge, ein Fehler senkt. Deshalb **mindestens drei Aufgaben je Zelle** (Lernbereich × Stufe).
- Bewertung exakt wie im echten Test: Die Auswahl muss vollständig stimmen.

## Ausgabe

- `{{ARBEITSORDNER}}/entwurf/quiz-{{TEIL}}.json`: JSON-Liste deiner Aufgaben.
- `{{ARBEITSORDNER}}/entwurf/quiz-{{TEIL}}.md`: lesbare Fassung (ID, Lernbereich, Stufe, Stamm, Optionen mit ✔/✘,
  Erklärung gekürzt, Fundstelle).
- Antwort: Anzahl je Lernbereich × Stufe, Anteil Mehrfachantworten, Prüfskript-Ergebnis, Literaturstellen,
  Unsicherheiten (besonders: zwei Kursfassungen, unklare Transkriptstellen).
