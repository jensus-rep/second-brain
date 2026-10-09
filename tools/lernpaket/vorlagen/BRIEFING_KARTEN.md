# Auftrag: Lernkarten und Notizen für ein Lernpaket

> Platzhalter vor dem Versand ersetzen: `{{ARBEITSORDNER}}`, `{{MODUL_JSON}}`, `{{TEIL}}`, `{{INHALTE}}` (Lernbereiche
> und Themen dieses Teils), `{{QUELLEN}}`, `{{NOTIZEN}}` (Notizen, an denen dieser Teil Karten ändern darf),
> `{{ID_PRAEFIX}}` (eindeutiges Präfix für neue Karten dieses Teils, z. B. `<neue_id_praefix>a-`).

Du schreibst Lernkarten und, wo nötig, neue Notizen für die Prüfungsvorbereitung in der Lern-App Second Brain.
Modul, Prüfungsform und Regeln stehen in `{{MODUL_JSON}}`. Du schreibst **nur** deine Ausgabedateien. Keine
API-Aufrufe, kein Push, keine Änderung anderer Dateien.

## Lesen

1. `{{MODUL_JSON}}`.
2. Soll-Liste `{{ARBEITSORDNER}}/soll-liste.md`: Maßstab für Vollständigkeit; Abschnitt 5 für zwei Fassungen im Kurs.
3. Quellen `{{ARBEITSORDNER}}/quellen.json`; die Transkripte deines Teils vollständig lesen.
4. Bestand `{{ARBEITSORDNER}}/stand.json` → `workspace.notes`, `workspace.cards`, `workspace.topics`. **Alle** Notizen
   eines Fachthemas prüfen, auch solche mit anderem Präfix (Notizen aus Literatur, z. B. `pm-note-*`): Vor jeder neuen
   Karte und Notiz sicherstellen, dass es sie nicht schon gibt; vorhandene passende Notizen nutzen statt Dubletten.
5. Inhaltsregeln `<repo>/AGENTS.md`.
6. Prüfskript (muss 0 Fehler melden):
   `python -I <repo>/tools/lernpaket/skripte/check_karten.py {{MODUL_JSON}} {{ARBEITSORDNER}}/stand.json <deine-datei.json>`

## Dein Teil

{{TEIL}}: {{INHALTE}}. Quellen: {{QUELLEN}}. Neue Karten-IDs beginnen mit `{{ID_PRAEFIX}}`. Geänderte Karten nur an
diesen Notizen: {{NOTIZEN}}. Andere Themen bearbeiten andere Autoren.

## Regeln

- **Kursfassung gilt.** Keine Karte wertet eine Kursaussage als falsch. Bei Abweichung zu einem Referenzwerk oder zur
  Literatur beginnt die Antwort mit „Laut Kurs: …“; die Referenz folgt als eigene Zeile (`referenz_zeilen` in
  modul.json, z. B. „Scrum Guide 2020: …“, „Lehrbuch-Hinweis: … (Autor Jahr)“). **Zwei Fassungen im Kurs** werden
  beide genannt, mit Bezug auf die jeweilige Einheit.
- **Eine Frage, eine eindeutige Antwort.** Kern fett am Anfang, dann knappe Erklärung. Aufzählungen vollständig und in
  Kursreihenfolge. Lieber eine Karte je Aufzählung als eine Karte mit drei.
- **Quelle** als letzte Zeile: „Quelle: Aufzeichnung NN „Titel“ [mm:ss]–[mm:ss].“ oder „Quelle: Kurstext „…“.“
  Nummern nur aus `quellen.json` bzw. dem Quellenverzeichnis des Decks.
- **Namen:** keine Kurs-/Lehreinheitskürzel, keine Hochschul-, Firmen- oder Personennamen (Lehrende, Gäste nur als
  Rolle; Firmen umschreiben). Standards, Werkzeuge und Fachautoren sind erlaubt.
- **Übertragungsbeispiel** laut `beispiel` in modul.json, mit der dort genannten Pflichtzeile, nur wo der Kurs selbst
  ein Beispiel nutzt.
- **Neue Karten:** genau `id, question, answer, noteId, dueAt, intervalDays, reviews`; `dueAt` = `karten.faellig_ab`,
  `intervalDays` 0, `reviews` 0.
- **Neue Notizen** nur für Lernbereiche ohne passende Notiz: Felder laut noteSchema, `createdAt`/`updatedAt` =
  `karten.notiz_stand`, `topicId` aus den **bestehenden** Themen, Stil wie vorhandene Notizen, Quellen am Ende.
- **Geänderte Karten** nur, wo eine bestehende Karte durch die neuen Quellen unvollständig, einseitig oder falsch wird:
  `{"id", "before": {"question","answer"} exakt wie im Bestand, "after": {...}, "reason": "...", "finding": "<Wert aus karten.befunde>"}`.
  Der Lernstand bleibt.

## Ausgabe

- `{{ARBEITSORDNER}}/entwurf/karten-{{TEIL}}.json` mit `{"new_cards": [...], "modified_cards": [...], "new_notes": [...], "modified_notes": [], "delete_proposals": []}`.
- `{{ARBEITSORDNER}}/entwurf/karten-{{TEIL}}.md`: lesbare Fassung.
- Antwort: Zahlen, Prüfskript-Ergebnis, Abdeckungslücken, Literaturstellen, Unsicherheiten, mögliche Dubletten zu
  anderen Teilen.
