# Auftrag: Soll-Liste der Lerninhalte

> Platzhalter vor dem Versand ersetzen: `{{ARBEITSORDNER}}`, `{{MODUL_JSON}}`, `{{UMFANG}}` (welche Quellen dieser
> Auftrag abdeckt, z. B. „alle“ oder „Kapitel A–D“), optional `{{VORHANDEN}}` (bestehende Soll-Liste, gegen die
> abgegrenzt wird).

Du erstellst die Soll-Liste der Lerninhalte für eine Prüfung (Prüfungsform: `pruefung` in `{{MODUL_JSON}}`). Sie ist
der Maßstab dafür, ob Lernkarten und Testaufgaben vollständig sind. Du schreibst genau eine Datei. Keine Netzwerk-
oder API-Zugriffe.

## Quellen (vollständig lesen)

1. Transkripte laut `{{ARBEITSORDNER}}/quellen.json` (Nummer → Titel → Datei; Zeitmarken als **[mm:ss]**).
2. Kurstexte und Dateitexte im Kursexport `{{ARBEITSORDNER}}/kursraum/texte/` und `texte/dateien/`. Lernziele,
   Modulaufbau und Prüfungsinformationen zuerst; Organisatorisches überspringen.
3. Kursinventar `{{ARBEITSORDNER}}/kursraum/inventar.md`: Was ist nur gelistet, was fehlt (externe Videos)?
4. Falls vorhanden: {{VORHANDEN}} – nur ergänzen, was neu oder abweichend ist, und Abweichungen markieren.

Umfang: {{UMFANG}}.

## Ergebnis: `{{ARBEITSORDNER}}/soll-liste.md`

- Kopf: Quellen, Umfang, Hinweis zu Fehlhörungen (Spracherkennung: erkennbare Fehlhörungen korrigieren und
  kennzeichnen, Unsicheres mit „(?)“).
- **1. Übersicht je Einheit:** Kursabschnitt, Quelle, Titel, Kernaussage in 2–3 Sätzen, in Kursreihenfolge.
- **2. Inventar:** Methoden, Modelle, Werkzeuge, Rollen, Kennzahlen, Begriffe mit Definition laut Kurs und Beleg.
- **3. Prüfungsrelevante Aufzählungen und Zahlen** (wörtlich oder sinngemäß, mit Beleg).
- **4. Begriffspaare und Abgrenzungen** (Stoff für falsche Antworten).
- **5. Abweichungen und Widersprüche:** zwischen Einheiten, zu Referenzwerken und zur Literatur, jeweils mit Belegen
  beider Seiten. Im Test gilt die Kursfassung; widersprechen sich Einheiten, beide Fassungen nennen.
- **6. Nicht erfasst:** Quellen ohne Text (z. B. externe Videos) und welche Themen dadurch dünn sind.
- **7. Vorschlag Lernbereiche:** Bereiche mit Inhalten, Gewicht nach Prüfungsrelevanz (Lernziele als Maßstab),
  Mindestumfang (drei Aufgaben je Bereich und Stufe), Hinweise zu zwei Fassungen.

Regeln: Nichts erfinden, jede Aussage belegt. Kursfassung zuerst, Literatur nur als gekennzeichneter Zusatz. Keine
Hochschul-, Firmen- oder Personennamen außer Fachautoren; Lehrende und Gäste nur als Rolle. Lieber vollständig als
knapp.

Antwort: Umfang, wichtigste Abweichungen, unsichere Fehlhörungen, Vorschlag Lernbereiche in Kurzform.
