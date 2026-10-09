# Auftrag: unabhängige Prüfung von Lernkarten und Testaufgaben

> Platzhalter vor dem Versand ersetzen: `{{ARBEITSORDNER}}`, `{{MODUL_JSON}}`, `{{PAKET}}`, `{{KARTEN}}` (IDs oder
> Regel, welche Karten und Notizen geprüft werden), `{{AUFGABEN}}` (ID-Muster), `{{NOTIZ}}` (optional: Literatur-Notiz,
> die einen Abschnitt „Laut Kurs“ bekommt), `{{UNSICHER}}` (bekannte Unsicherheiten der Autoren).

Du prüfst Lernkarten und Multiple-Choice-Aufgaben, die andere geschrieben haben, für eine echte Prüfung (`pruefung` in
`{{MODUL_JSON}}`). Sei streng: Ein Fehler trainiert eine falsche Antwort ein. Keine API-Aufrufe, kein Push. Du schreibst
nur die Ausgabedatei.

## Prüfgegenstand

- Karten und Notizen in `{{ARBEITSORDNER}}/aenderungen.json`: {{KARTEN}}.
- Testaufgaben in `{{ARBEITSORDNER}}/pool.json`: {{AUFGABEN}}.
- Notiz-Nachtrag: {{NOTIZ}}.
- Gezielt prüfen: {{UNSICHER}}.

## Maßstab

Kursfassung laut Transkripten (`quellen.json`) und Kurstexten (`kursraum/texte/`), Soll-Liste (`soll-liste.md`,
besonders Abschnitt 5), Regeln der Aufträge `BRIEFING_KARTEN.md` und `BRIEFING_QUIZ.md` im Ordner
`<repo>/tools/lernpaket/vorlagen/`.

## Vorgehen

1. **Aufgaben zuerst selbst lösen**, ohne `correctOptionIds` anzusehen; dann vergleichen.
2. Je Karte und Aufgabe: laut Kurs richtig? Eindeutig (keine falsche Option, die der Kurs auch trägt; keine richtige,
   die strittig ist)? Fundstelle stimmt (±30 s)? Zwei Kursfassungen nicht gegeneinander ausgespielt? Lösungshinweise?
   Rückmeldungen richtig, Erklärung begründet alle richtigen Optionen? Literatur gekennzeichnet? Keine Hochschul-,
   Firmen- oder Personennamen? Dubletten im Paket oder zum Bestand (`stand.json`)?
3. Eindeutige Fehler als exakte Textersetzung korrigieren, Unklares melden, streichen nur, wenn nicht zu retten.
4. Notiz-Nachtrag: Abschnitt `## Laut Kurs` mit der Kursfassung und Belegen; vorhandener Text bleibt; Abweichungen zur
   Literatur benennen.

## Ausgabe `{{ARBEITSORDNER}}/pruefung-{{PAKET}}.json`

```json
{
  "befunde": [{"id": "...", "art": "karte|aufgabe|notiz", "urteil": "ok|korrigiert|melden|streichen", "befund": "...", "beleg": "Aufzeichnung NN [mm:ss]: Zitat"}],
  "ersetzungen": [{"datei": "aenderungen|pool", "id": "...", "feld": "answer|question|content|summary|prompt|explanation|options[<id>].text|options[<id>].feedback|correctOptionIds", "alt": "exakter Text", "neu": "neuer Text"}],
  "streichen": [{"datei": "aenderungen|pool", "id": "...", "grund": "..."}],
  "notiz_nachtrag": {"id": "<notiz-id>", "abschnitt": "## Laut Kurs\n\n…", "einfuegen_vor": "exakter Text oder leer"}
}
```

`alt` muss genau einmal im Feld vorkommen; bei geänderten Karten ist das Feld der Text nach der Änderung. Bei
`correctOptionIds` sind `alt`/`neu` JSON-Listen als Text. Vor der Abgabe die Ersetzungen auf Kopien anwenden und beide
Prüfskripte laufen lassen.

Antwort: Zählung ok/korrigiert/melden/streichen, schwerwiegende Befunde einzeln, Fälle mit abweichender eigener
Lösung, offene Entscheidungen.
