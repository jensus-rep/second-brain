# Übergabe an einen weiteren Nutzer

Stand: 21.10.2026. Geprüft wurden der Quelltext und die Dokumentation von `second-brain` und dem benachbarten Repo `audio_downloader`. API-Helfer, Validierung und Zusammenführung wurden lokal getestet. Ein vollständiger Lauf mit einem neuen Uni-Konto und einer neuen Bereitstellung wurde dabei nicht ausgeführt.

## Was die beiden Anwendungen heute leisten

Der Downloader erfasst Moodle-Kursseiten, Abschnitte, unterstützte Aktivitäten und Dateien. Mit `--with-media` lädt er unterstützte Medien und versucht bei Vimeo zuerst Untertitel, sonst die Tonspur abzurufen. `transcribe.py` wandelt Untertitel lokal um und transkribiert Audio über Azure AI Speech.

Second Brain speichert Notizen, Lernkarten, Testaufgaben und Lernfortschritt. Ein Agent koordiniert dazwischen Quellenabgleich, Konsolidierung, Entwürfe, fachliche Prüfung und Übertragung nach [README.md](README.md).

**Ein Kurslink startet derzeit keinen vollständigen automatischen Import in der Web-App oder Downloader-GUI.** Die GUI bietet den Download/Kursexport; Transkription und Wissensaufbereitung sind weitere Schritte. Der Export garantiert keine vollständige Erfassung beliebiger Hochschulplattformen, dynamisch nachgeladener Inhalte oder externer Videos. Das Inventar muss gegen den sichtbaren Kurs und die entstandenen Texte/Transkripte geprüft werden. Fehlende Inhalte werden als Lücke dokumentiert.

## Eigene Einrichtung statt Übernahme der persönlichen Installation

1. Beide Repositories separat klonen: [Second Brain](https://github.com/jensus-rep/second-brain) und [Downloader](https://github.com/jensus-rep/audio_downloader). Der Downloader ist kein Bestandteil des Second-Brain-Repos. Bei privaten Repos muss der Kollege Zugriff auf beide erhalten. Installation jeweils nach der zugehörigen README; für Second Brain nach Möglichkeit `npm ci` mit dem vorhandenen Lockfile verwenden.
2. Second Brain zuerst lokal mit `npm run dev` starten. Vorher sicherstellen, dass `AZURE_SQL_SERVER` nicht gesetzt ist: Der Speicheradapter wählt bei gesetzter Variable auch lokal SQL statt SQLite. Der automatische Entwicklungslogin ist nur für die lokale Entwicklung bestimmt.
3. Für eine eigene Azure-Bereitstellung Web App, Datenbank, Session-Geheimnis, Einrichtungscode und GitHub-OIDC-Vertrauen selbst einrichten. `.github/workflows/main_second-brain.yml` enthält feste Werte für App und Ressourcengruppe des bisherigen Eigentümers; diese vor einem Deployment auf eigene Ziele ändern. Keine vorhandenen Secrets oder Datenbanken übernehmen.
4. Die öffentliche Kontoeinrichtung legt ausschließlich das erste Konto an und wird danach gesperrt. Es gibt derzeit keinen regulären Einladungs- oder Registrierungsablauf für zusätzliche Konten. Obwohl Daten nach Eigentümer getrennt sind, ist die vorhandene Installation daher nicht ohne Weiteres für einen zweiten Nutzer eingerichtet. Für die Übergabe eine eigene Instanz verwenden.
5. Den Downloader mit eigenem Uni-Konto konfigurieren oder `--manual-login` nutzen. Login-Selektoren und Kursstruktur müssen zur eigenen Plattform passen. Tests, Abgaben und andere ausgeschlossene Aktivitäten weiterhin nur inventarisieren.
6. Eigene Azure-Speech-Ressource und Berechtigungen verwenden. Für Audio muss der Nutzer die Übertragung der Kursdateien an seinen konfigurierten Speech-Dienst und die damit verbundenen Kosten einplanen. Untertitel benötigen diesen Dienst nicht. `transcribe.py` liest Speech-Zugangsdaten aus der Prozessumgebung oder über Azure CLI; eine Eintragung ausschließlich in `.env` wird von diesem Skript nicht automatisch geladen.

Beispiel aus dem Downloader-Verzeichnis, mit eigenen Werten:

```powershell
.\.venv\Scripts\python main.py --export --with-media --manual-login "https://<moodle>/course/view.php?id=<id>"
.\.venv\Scripts\python transcribe.py exports\kurs-<id>\medien --out <Arbeitsordner>\transkripte --resource <eigene-speech-ressource> --resource-group <eigene-gruppe>
```

## Übertragung und Schutz vorhandener Daten

- **API-Helfer im Repo:** `tools/lernpaket/brain-api.mjs` ersetzt den früher referenzierten Helfer außerhalb des Repos. Aus dem Second-Brain-Verzeichnis `.env.brain.example` nach `.env.brain` kopieren, eigene Basisadresse und eigenen persönlichen Zugangsschlüssel eintragen. Danach etwa `node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs pull <Arbeitsordner>/stand.json` ausführen. Schlüssel erstellt man im angemeldeten Browser unter „Zugangsschlüssel“. Keine Schlüssel als Kommandozeilenargument oder im Chat angeben.
- **Manueller Übertragungsweg vorhanden:** Zuerst den eigenen Bestand exportieren, auf dieser Grundlage ergänzen und über „Import & Datensicherung“ validiert importieren. Der Import ersetzt den gesamten Bestand. ZIP für Sicherungen einschließlich Bildern verwenden; JSON enthält nur Bildreferenzen derselben Umgebung. Niemals den Export eines anderen Nutzers als Ausgangsbestand verwenden.
- **API-Vertrag:** `GET /api/brain` liefert den aktuellen Snapshot; `PUT /api/brain` erwartet JSON mit `revision` und `workspace`. Persönliche Zugangsschlüssel werden als `Authorization: Bearer <schlüssel>` übergeben und gelten für `/api/brain` und `/api/media`, nicht für `/api/tutor` oder Schlüsselverwaltung. Bei `409` neu lesen und Änderungen erneut abgleichen; niemals nur die Revision hochsetzen und einen alten Gesamtstand erneut senden. Schlüssel gehören ausschließlich zum eigenen Zielkonto.
- **Sicherung und Kontrolle:** Der Helfer prüft Schema, Herkunftsinstanz und Revision, legt vor und nach dem Schreiben JSON-Sicherungen unter `.data/brain-api-backups/` an und vergleicht einen Kontroll-Pull. Es gibt keine automatische Wiederholung eines Schreibens. Bei unterbrochener Übertragung den gespeicherten Stand prüfen, bevor erneut gearbeitet wird. Die Herkunftsadresse identifiziert die Instanz, nicht das Konto: immer mit dem eigenen Schlüssel und einem eigenen frischen Pull arbeiten. Die Sicherungen enthalten Bildreferenzen; ZIP sichert zusätzlich die Bilddateien.
- **Strikte Validierung:** `skripte/validate.mjs` und der Helfer brechen ab, wenn Schemafelder verloren gingen, Eingabewerte normalisiert würden oder die Sammlung das Speicherlimit überschreitet. Ergänzte Standardwerte sind erlaubt. Der Schema-Check ersetzt keine fachliche Prüfung.
- **Änderungsabgleich:** `build_nachher.py` braucht `stand.json` als feste Entwurfsbasis und einen frischen Pull als Eingabe. Beabsichtigte Änderungen an Karten, Notizen und Aufgaben werden mit beiden Ständen verglichen; Konflikte führen zum Abbruch. Unveränderte Entwurfsfelder überschreiben keine parallelen Änderungen. Lernstandfelder bestehender Karten dürfen nicht in der Änderungsliste stehen.
- **Pakete ohne Quiz:** Fehlt `pool-final.json`, erhält `build_nachher.py` den gesamten frischen Aufgabenbestand. Ein vorhandener Pool muss alle Aufgaben-IDs der Entwurfsbasis enthalten. Neue IDs dürfen nicht doppelt vergeben sein. Bestehende Ausgabe- und Pull-Dateien werden nicht überschrieben; für eine neue Runde neue Dateinamen wählen.

Die Offline-Prüfungen laufen aus dem Second-Brain-Repo mit `npm run test:lernpaket` (Node und Python erforderlich). Sie prüfen unter anderem parallele Änderungen, erhaltenen Lernstand, verworfene Felder, Revisionskonflikte, Zielinstanzen und Sicherungen. Der Deployment-Workflow führt diese Prüfungen ebenfalls aus.

Prüfstand vom 21.10.2026: Typecheck, alle 273 JavaScript-Modell- und Werkzeugtests, acht Python-Tests zur Zusammenführung, der lokale Zugangsschlüssel-Browsertest und ein API-Helfer-Durchlauf gegen eine isolierte lokale SQLite-Sammlung bestanden. Der erneute Downloader-Kursexporttest konnte wegen fehlender Python-Abhängigkeiten und eines abgebrochenen Paketdownloads nicht abgeschlossen werden; dieser Teil bleibt vor der Abnahme auf dem Zielrechner zu prüfen.

## Wiederverwendbarer Auftrag für Codex

> Lies zuerst AGENTS.md, tools/lernpaket/UEBERGABE.md und tools/lernpaket/README.md sowie die README des Downloaders. Erstelle aus meinem Kurslink ein Lernpaket für meine eigene Second-Brain-Instanz. Prüfe zunächst Repo-Pfade, Zielinstanz, Anmeldung, Transkriptionskonfiguration und verfügbaren Übertragungsweg. Verwende keine persönlichen Pfade, Azure-Ressourcen oder Bestandsdaten des ursprünglichen Entwicklers. Lies oder veröffentliche keine Geheimnisse. Erfasse den Kurs mit Inventar und unterstützten Medien, ohne Tests oder Abgaben zu öffnen. Gleiche das Inventar mit Texten und Transkripten ab und dokumentiere Lücken. Konsolidiere Quellen, kennzeichne Widersprüche und belege die Inhalte. Erstelle fachlich allgemein benannte Notizen, Lernkarten und zur Prüfungsform passende Übungsaufgaben. Bestehende IDs, Inhalte und Lernfortschritte bleiben erhalten. Prüfe Schema, Speicherbudget und Änderungen am vollständigen Bestand. Zeige vor der ersten Übertragung die konkrete Änderungsliste; beachte bereits erteilte Freigaben. Sichere vorher den frischen Bestand und kontrolliere nachher die gespeicherten Daten. Melde fehlende Werkzeuge ausdrücklich, statt einen nicht ausgeführten Schritt als erledigt zu behandeln.

Die vorhandenen Moduldateien sind Beispiele aus einer persönlichen Installation. Mit `module/vorlage.json` beginnen, eigene Pfade und Quellenbereiche festlegen und Beispiele nicht unverändert ausführen. Zusätzliche Aufgabenwerkzeuge und persönliches Gedächtnis sind optional. Mehrere Agenten werden nur bei entsprechender Beauftragung eingesetzt; fachliche Gegenprüfung bleibt erforderlich.

## Vor dem Teilen und vor dem ersten echten Import

Nur versionierten Quelltext teilen, keine Kopie des gesamten Arbeitsverzeichnisses. `.env`, `.data`, Downloads, Exporte, Transkripte, Backups und Browserzustand nicht mitgeben. Das versionierte `login-page.png` im Downloader wurde visuell geprüft: leere Anmeldemaske, keine eingetragenen persönlichen Zugangsdaten. Eine gezielte Suche im aktuellen versionierten Stand und in Änderungen der lokal verfügbaren Git-Historie fand keine privaten Schlüssel oder Zugangstoken der geprüften Formate (Second-Brain-, GitHub- und Google-API-Token). Das ist kein vollständiger Scan aller Geheimnisformate.

**Vor Versand des Links die Veröffentlichung prüfen:** Lokale uncommittete Änderungen sind im GitHub-Link nicht enthalten; ebenso wenig Commits, die noch vor `origin/main` liegen. Beide Repos müssen die gewünschten Änderungen im geteilten Branch enthalten. Ein Push auf `main` von Second Brain löst zugleich das produktive Azure-Deployment aus.

Für die Abnahme auf dem Rechner des Kollegen: beide Projekte frisch einrichten, Downloader-Tests gegen localhost ausführen, einen erlaubten Beispielkurs exportieren und Inventarlücken prüfen, ein kurzes Transkript erstellen und ein kleines geprüftes Lernpaket in eine lokale Testsammlung importieren. Danach Neuladen, Quellverweise, Karten, Aufgaben und erhaltenen Lernfortschritt kontrollieren. Erst anschließend die eigene produktive Instanz befüllen.
