# Second Brain · Dein Wissensatelier

Eine private, deutschsprachige Second-Brain-Web-App. Wissen wird als Markdown mit strukturierten Metadaten gespeichert und als Bibliothek, Notizleser, Verknüpfungskarte und Lernpfad dargestellt.

## Funktionen

- Notizen erstellen, bearbeiten, favorisieren, archivieren und wiederherstellen.
- Eigene Themenräume, Tags sowie Verbindungen und automatisch sichtbare Rückverweise.
- Volltextsuche über Titel, Zusammenfassung, Inhalt, Tags und Themennamen; kombinierbare Filter.
- Karten- und Listenansicht sowie responsive Navigation.
- Eigene Themenübersicht mit Eintragszahlen und einer Ansicht für noch nicht zugeordnete Einträge; Themen- und Tagfilter öffnen bei Bedarf.
- Großzügige Eintragsansicht mit moderner Lesetypografie, Gliederung aus den tatsächlichen Markdown-Überschriften und einklappbaren Metadaten.
- Verwandte Einträge mit Browsernavigation; nach dem Bearbeiten oder Erstellen einer Lernkarte zurück zum gelesenen Eintrag.
- Lernpfade mit sortierbaren Schritten, eigenen Aufgaben und dauerhaftem Fortschritt.
- JSON-Export und validierter Import mit ausdrücklicher Ersetzungsbestätigung.
- Bilder (PNG, JPEG, WebP, GIF) mit Beschriftung, Kartenvorschau und vergrößerbarer Ansicht; private Speicherung in der Datenbank.
- Sichere Mermaid-Ablaufdiagramme, Sequenzdiagramme und Mindmaps direkt im Markdown.
- Markdown-Tabellen erscheinen als responsive SVG-Karten mit umbrechender Schrift. Eine aufklappbare Textansicht erhält Formatierungen und bedienbare Links; Notizen und Lernkarten nutzen dieselbe Darstellung.
- Lernkarten mit Frage, aufdeckbarer Antwort und geplanten Wiederholungen; Bilder und Diagramme auf beiden Seiten.
- Multiple-Choice-Prüfungssimulationen mit optionalem Zeitlimit und adaptiver Übung, Fehlerjournal und eigenen Testaufgaben.
- Gespeicherte Lernerinnerungen im Überblick mit Kalenderexport und Alarm.
- Vollständige ZIP-Sicherungen inklusive Bilder und Lernkarten; JSON bleibt zum Bearbeiten der Wissensdaten verfügbar.
- Sechs editierbare Einstiegsnotizen und ein unbegonnener Beispiel-Lernpfad.
- Private Bereitstellung auf Azure App Service mit eigenem Login; Speicherung in Azure SQL pro Konto.
- Konflikterkennung über Revisionen statt stiller Überschreibung in mehreren Fenstern.

## Architektur

| Bereich | Ort |
| --- | --- |
| Typen, Datenvalidierung, Suche, Fortschritt | lib/brain/model.ts |
| Editierbare Startinhalte für neue Sammlungen | lib/brain/seed.ts |
| Datenbankzugriff | lib/brain/storage.ts, lib/server/store*.ts |
| Anmeldung und Sessions | lib/server/auth.ts, app/login/, app/api/auth/ |
| Authentifizierte GET-/PUT-Schnittstelle | app/api/brain/route.ts |
| Clientseitiges Laden und Speichern | lib/brain/use-brain.ts |
| Arbeitsoberfläche | components/brain/brain-app.tsx |
| Notiz-, Themen- und Lernpfad-Editoren | components/brain/editors.tsx |
| Sicherer Markdown-Renderer | components/brain/markdown.tsx |
| Leseansicht und kompakte Wissensfilter | components/brain/note-reader.tsx, knowledge-filters.tsx |
| Abbildungen, Diagramme, Uploads | components/brain/visual.tsx, media-toolbar.tsx, app/api/media/ |
| Lernkarten und Lernansicht | components/brain/flashcards.tsx |
| Tests, Fehlerjournal und Erinnerungen | components/brain/quizzes.tsx, lib/brain/quiz.ts, quiz-examples.ts |
| Bildsicherungen und Import | lib/brain/backup.ts, components/brain/transfer-dialog.tsx |
| Design-Tokens, Layout, responsive Gestaltung | app/globals.css |
| Bibliotheks- und Lesegestaltung | app/reading-workspace.css |
| Wiederverwendbare UI-Primitiven | components/ui/ |

React 19, TypeScript, Next.js 16 (eigenständiger Node-Server) und Tailwind. Die App hat ein eigenes Konto mit E-Mail und Passwort (scrypt-Hash, signiertes HttpOnly-Cookie, Sperre nach wiederholten Fehlversuchen). Anfragen ohne gültige Session werden von der API abgelehnt. Nutzer-IDs kommen ausschließlich aus der serverseitigen Session.

In Produktion liegen Konten, Sammlungen und Bilder in Azure SQL (Tabellen `newhope_users`, `newhope_workspaces`, `newhope_media`; sie werden beim ersten Start angelegt). Die Tabellen `second_brain_*` der Vorgänger-App bleiben unberührt. Lokal verwendet die App eine SQLite-Datei unter `.data/`.

Die erste Version speichert eine vollständige Sammlung atomar als versioniertes Dokument. Dadurch bleiben Verknüpfungen, Lernpfade und Fortschritte beim Speichern konsistent. Die Update-Abfrage prüft Eigentümer und Revision. Für umfangreiche Sammlungen lässt sich die isolierte Speicherschicht später in einzelne Datensätze und einen Suchindex aufteilen.

## Lokal entwickeln

Node.js 24 LTS empfohlen, mindestens 22.13.

~~~sh
npm install
npm run dev
~~~

Der Entwicklungsserver läuft unter http://127.0.0.1:5173. Lokal meldet sich der Browser automatisch als Testnutzer an (`/api/auth/dev-login`, nur im Entwicklungsmodus). Daten liegen in `.data/newhope.sqlite`; die Azure-Datenbank wird lokal nie verwendet, solange `AZURE_SQL_SERVER` nicht gesetzt ist. Mit `NEWHOPE_DEV_AUTOLOGIN=false` lässt sich der echte Login-Ablauf lokal prüfen.

## Prüfen

~~~sh
npm run typecheck
npm test
npm run test:browser
npm run test:visual
npm run test:reading
npm run test:quizzes
npm run test:comparisons
~~~

Für den Browsertest muss der lokale Entwicklungsserver laufen und Google Chrome installiert sein. Alternativ die Browserkonfiguration in tests/browser.mjs auf einen verfügbaren Playwright-Browser ändern. Der Test lehnt externe Ziele ab und stellt den lokalen Ausgangsbestand nach seinem Lauf wieder her.

Er prüft Erstellen, Neuladen, Volltextsuche, Favoriten, Archivieren/Wiederherstellen, Lernfortschritt, eigene Lernpfade, konkurrierende Updates, ungültige Referenzen und die mobile Breite. Screenshots landen ausschließlich im ignorierten Verzeichnis .sites-runtime/qa/.

Die Leseprüfung ergänzt Themenwechsel, nicht zugeordnete Einträge, Tags im Archiv, Gliederung mit wiederholten Überschriften, Rückkehr aus dem Editor, Zurück/Vorwärts im Browser, direkte Eintragslinks und die mobile Lesefläche. Alle veränderten lokalen Wissensdaten werden nach dem Test wiederhergestellt. Datenändernde Browsertests nacheinander ausführen.

Die Testprüfung ergänzt gespeicherte Multiple-Choice-Runden, Antwortkombinationen, Fehlerhinweise und Merksätze, verborgene Lösungen während einer Simulation, Konfliktbehandlung, Zeitablauf, eigene Aufgaben, Erinnerungen und Kalenderexport sowie die mobile Breite.

## Lernen mit Tests

Unter „Tests & Übungen“ lassen sich eigene Aufgaben für allgemeine Fachthemen anlegen. „Beispiele hinzufügen“ ergänzt einmalig zwölf editierbare Aufgaben zu Projektmanagement (Scrum) und Produktmanagement (Discovery-Risiken) mit Quellen, drei Schwierigkeitsstufen und Rückmeldungen zu typischen Verwechslungen. Bestehende Inhalte werden dabei erhalten; die Beispiele werden nicht automatisch in bestehende Sammlungen eingespielt.

„Adaptiv üben“ gibt nach jeder gespeicherten Antwort eine Erklärung. Die nächste Runde priorisiert zuletzt falsch beantwortete Lernbereiche und wählt Aufgaben auf der passenden Stufe. Zwei richtige Antworten auf mindestens der aktuellen Stufe erhöhen sie um eins; ein Fehler senkt sie um eins. Gibt es zu wenige passende Aufgaben, bleibt die Runde kürzer als die gewünschte Aufgabenanzahl. Das Verfahren verwendet feste Regeln und hinterlegte Hinweise. Es erzeugt keine neuen Aufgaben oder Diagnosen durch KI.

Die Prüfungssimulation mischt die Aufgaben des Fachthemas, lässt gespeicherte Antworten vor der Abgabe ändern und zeigt Lösungen erst am Ende. Alle richtigen Antworten müssen ausgewählt sein, ohne zusätzliche falsche Antworten; es gibt keine Teilpunkte. Unbeantwortete Aufgaben zählen im Ergebnis als falsch, beeinflussen aber nicht das Lernprofil. Das optionale Zeitlimit bleibt beim Neuladen erhalten; bei Ablauf wird die Runde ausgewertet, sobald die Testansicht geöffnet ist. Ergebnisse sind Lernhilfen und keine offizielle Prüfungsbewertung.

Aufgaben, laufende Runden, Antworten, persönliche Merksätze und Erinnerungen liegen im versionierten Arbeitsraum auf dem Server und sind im JSON-/ZIP-Backup enthalten. Alte Sicherungen erhalten beim validierten Einlesen leere Testfelder. Jede Runde speichert ihre damaligen Aufgaben, damit spätere Bearbeitungen die Auswertung nicht verändern. Höchstens 200 Runden, 1.000 Aufgaben und 100 Erinnerungen passen in das Modell; zusätzlich gilt die bestehende Grenze von 1,8 MB für den gesamten Arbeitsraum.

Erinnerungen sind in der App sichtbar. Für einen Alarm außerhalb der App kann der gespeicherte Termin als `.ics` exportiert und in einen Kalender importiert werden. Der Termin enthält einen Alarm zehn Minuten vorher; die Benachrichtigung richtet sich nach den Einstellungen des Kalenders. Die Datumseingabe nutzt die Gerätezeitzone, die Anzeige Europe/Berlin und der Export UTC.

Das generierte Second-Brain-Logo liegt in `public/brand/second-brain-mark.png` und wird in Navigation, Login und als Browser-Icon verwendet. Es verbindet zwei abstrakte Gehirnhälften mit einem offenen Buch. Der endgültige Imagegen-Prompt steht in `public/brand/second-brain-mark.prompt.txt`.

Der Produktname lautet Second Brain. Bestehende technische Bezeichner (`newhope_*`, `NEWHOPE_*`, Session-Cookie und SQLite-Pfad) bleiben für die Kompatibilität mit gespeicherten Daten und der Serverkonfiguration erhalten.

## Gemeinsam Wissen pflegen

Neue Inhalte lassen sich über die Oberfläche erfassen. Für vorbereitete Inhalte oder größere Änderungen:

1. Aktuellen Bestand über „Import & Datensicherung“ exportieren.
2. Notizen und Metadaten im JSON bearbeiten. Die IDs bestehender Notizen, Themen und Lernschritte beibehalten.
3. Die validierte Datei importieren und das Ersetzen bewusst bestätigen.

Das Format ist in lib/brain/model.ts beschrieben. Ein Import ersetzt den gesamten Bestand; vorher eine Sicherung aufbewahren. Änderungen an seed.ts beeinflussen ausschließlich neu angelegte Nutzer-Sammlungen.

Der Markdown-Renderer verwendet react-markdown und remark-gfm: Überschriften, Listen, Vergleiche als SVG-Karten, Zitate, Code, Links und private Bilder. Bestehende Markdown-Tabellen werden beim Lesen automatisch als SVG-Karten dargestellt; die gespeicherten Inhalte bleiben erhalten. Bilder über „Bild einfügen“ hochladen; Bildunterschriften stehen im Markdown-Titel. Externe Bilder werden nicht automatisch abgerufen. HTML wird nicht ausgeführt.

„Diagramm einfügen“ legt eine editierbare Mermaid-Vorlage an. Unterstützt sind klassische flowchart/graph-Diagramme, sequenceDiagram und mindmap. HTML, Konfigurationsdirektiven, externe Ressourcen und Bildformen sind ausgeschlossen. Das Ergebnis wird mit DOMPurify bereinigt und als isoliertes SVG-Bild angezeigt.

Die Diagrammvorlage verläuft von oben nach unten, damit sie auch mobil lesbar bleibt. Drei Einstiegsnotizen neuer Sammlungen erklären Verstehen, Verbindungen und Lernplanung zusätzlich mit SVG-Diagrammen. `test:comparisons` prüft die SVG-Vergleiche auf Desktop und bei 320/390 Pixel Breite, lange Wörter, Links, Vorschau, Lernkarten und die neuen Diagramme; lokale Ausgangsdaten werden anschließend wiederhergestellt.

## Lernen mit Karten

Unter „Lernkarten“ eigene Fragen und Antworten erstellen, oder im Notizleser „Lernkarte erstellen“ wählen. Eine Lernrunde zeigt fällige Karten. Erst nach dem Aufdecken erscheinen die Bewertungen. „Noch üben“ plant zehn Minuten später; „Gewusst“ steigert den Abstand auf 1, 3, 7, 14 und höchstens 30 Tage. Bewertungen werden vor dem Weiterblättern atomar gespeichert. Ältere Sammlungen ohne Lernkarten bleiben kompatibel. Termine werden in UTC gespeichert und für Europe/Berlin angezeigt.

## Abbildungen sichern

ZIP-Sicherungen enthalten die Wissensdaten sowie hochgeladene Bilder. Beim Import werden die Bilder dem angemeldeten Nutzer neu zugeordnet und ihre Referenzen angepasst. JSON enthält nur Referenzen auf Bilder derselben Umgebung. Fehlende Abbildungen verhindern einen unvollständigen Import oder ZIP-Export. Die Bildsicherung unterstützt bis zu 200 Bilder und insgesamt 64 MB. Bilder bleiben beim Entfernen einer Notiz erhalten, damit andere Verknüpfungen und vorhandene JSON-Sicherungen funktionieren.

## Grenzen

- Maximal 1,8 MB UTF-8 für Text und Metadaten, 1.000 Notizen, 100 Themen, 100 Lernpfade und 3.000 Lernkarten; maximal 80.000 Zeichen je Notiz. Bilddateien zählen nicht in dieses Textlimit.
- Bilder: höchstens 8 MB und 24 Megapixel. Der Server prüft Format und Abmessungen, der Browser decodiert Uploads und importierte Bilder vor dem Speichern.
- Kein Offline-Modus, keine allgemeinen Dateianhänge und keine automatische externe Recherche.
- Änderungen werden ausdrücklich gespeichert. Bei Verbindungsfehlern bleiben offene Formulare erhalten; beim Verlassen mit ungespeicherten Änderungen erfolgt eine Warnung.
- Die Sammlung bleibt privat; weitere Nutzer erhalten separate Sammlungen, falls der Zugang später erweitert wird.
- Die Verknüpfungskarte zeigt bis zu 40 Notizen; Themenfilter grenzen größere Bestände ein.
- Browser-WebMCP wird nur bei vorhandener Unterstützung registriert: Wissen suchen oder einen ungespeicherten Notizentwurf öffnen. Es ist keine eigene KI-Chatfunktion. Die native WebMCP-Integration benötigt einen unterstützten Browser und konnte in der lokalen Chrome-Umgebung nicht nativ geprüft werden.

## Veröffentlichung

Ein Push auf `main` baut die App mit GitHub Actions (`.github/workflows/main_second-brain.yml`) und deployt sie auf die Azure Web App `second-brain` (Linux, Node 22). Der Workflow prüft vorab, dass die benötigten App-Einstellungen vorhanden sind, und testet danach Anmeldeseite und API.

Die Azure-Anmeldung verwendet OIDC mit den GitHub-Secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` und `AZURE_SUBSCRIPTION_ID`. Die Deployment-Identität erhält die Rolle `Website Contributor` ausschließlich für die Web App in `rg-toolhub-dev-we`. Ihre föderierte Identität vertraut nur dem Branch `main` dieses Repositorys; beim Anlegen oder Umziehen eines Repositorys muss das tatsächliche OIDC-Subject aus den GitHub-Einstellungen übernommen werden, einschließlich unveränderlicher Besitzer- und Repository-IDs, falls aktiviert. Ein Client-Kennwort wird nicht benötigt.

Benötigte App-Einstellungen der Web App:

| Einstellung | Zweck |
| --- | --- |
| `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USERNAME`, `AZURE_SQL_PASSWORD` | Datenbankzugang (optional `AZURE_SQL_PORT`, `AZURE_SQL_ENCRYPT`, `AZURE_SQL_TRUST_SERVER_CERTIFICATE`, `AZURE_SQL_CONNECTION_TIMEOUT`) |
| `SESSION_SECRET` | Mindestens 32 zufällige Zeichen zum Signieren der Sessions |
| `NEWHOPE_SETUP_TOKEN` | Einmaliger Einrichtungscode für das erste Konto; wird aus dem GitHub-Secret gleichen Namens gesetzt |

Beim ersten Aufruf zeigt `/login` die Kontoeinrichtung. Sie verlangt den Einrichtungscode und ist gesperrt, sobald ein Konto existiert. Danach die ZIP-Sicherung über „Import & Datensicherung“ einspielen.
