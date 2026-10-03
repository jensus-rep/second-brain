# NewHope · Dein Wissensatelier

Eine private, deutschsprachige Second-Brain-Web-App. Wissen wird als Markdown mit strukturierten Metadaten gespeichert und als Bibliothek, Notizleser, Verknüpfungskarte und Lernpfad dargestellt.

## Funktionen

- Notizen erstellen, bearbeiten, favorisieren, archivieren und wiederherstellen.
- Eigene Themenräume, Tags sowie Verbindungen und automatisch sichtbare Rückverweise.
- Volltextsuche über Titel, Zusammenfassung, Inhalt, Tags und Themennamen; kombinierbare Filter.
- Karten- und Listenansicht sowie responsive Navigation.
- Lernpfade mit sortierbaren Schritten, eigenen Aufgaben und dauerhaftem Fortschritt.
- JSON-Export und validierter Import mit ausdrücklicher Ersetzungsbestätigung.
- Bilder (PNG, JPEG, WebP, GIF) mit Beschriftung, Kartenvorschau und vergrößerbarer Ansicht; private Speicherung in R2.
- Sichere Mermaid-Ablaufdiagramme, Sequenzdiagramme und Mindmaps direkt im Markdown.
- Lernkarten mit Frage, aufdeckbarer Antwort und geplanten Wiederholungen; Bilder und Diagramme auf beiden Seiten.
- Vollständige ZIP-Sicherungen inklusive Bilder und Lernkarten; JSON bleibt zum Bearbeiten der Wissensdaten verfügbar.
- Sechs editierbare Einstiegsnotizen und ein unbegonnener Beispiel-Lernpfad.
- Private Sites-Bereitstellung; Speicherung in Cloudflare D1 pro angemeldetem Nutzer.
- Konflikterkennung über Revisionen statt stiller Überschreibung in mehreren Fenstern.

## Architektur

| Bereich | Ort |
| --- | --- |
| Typen, Datenvalidierung, Suche, Fortschritt | lib/brain/model.ts |
| Editierbare Startinhalte für neue Sammlungen | lib/brain/seed.ts |
| Datenbankzugriff | lib/brain/storage.ts |
| Authentifizierte GET-/PUT-Schnittstelle | app/api/brain/route.ts |
| Clientseitiges Laden und Speichern | lib/brain/use-brain.ts |
| Arbeitsoberfläche | components/brain/brain-app.tsx |
| Notiz-, Themen- und Lernpfad-Editoren | components/brain/editors.tsx |
| Sicherer Markdown-Renderer | components/brain/markdown.tsx |
| Abbildungen, Diagramme, Uploads | components/brain/visual.tsx, media-toolbar.tsx, app/api/media/ |
| Lernkarten und Lernansicht | components/brain/flashcards.tsx |
| Bildsicherungen und Import | lib/brain/backup.ts, components/brain/transfer-dialog.tsx |
| Design-Tokens, Layout, responsive Gestaltung | app/globals.css |
| Datenbankschema und Migrationen | db/schema.ts, drizzle/ |
| Wiederverwendbare UI-Primitiven | components/ui/ |

React 19, TypeScript, Vinext/Vite und Tailwind. Die Plattform stellt private Zugriffssteuerung und ChatGPT-Anmeldung bereit. Anfragen ohne Identität werden von der API abgelehnt. Nutzer-IDs kommen ausschließlich aus serverseitigen Plattform-Headern.

Die erste Version speichert eine vollständige Sammlung atomar als versioniertes Dokument. Dadurch bleiben Verknüpfungen, Lernpfade und Fortschritte beim Speichern konsistent. Die Update-Abfrage prüft Eigentümer und Revision. Für umfangreiche Sammlungen lässt sich die isolierte Speicherschicht später in einzelne Datensätze und einen Suchindex aufteilen.

## Lokal entwickeln

Node.js 24 LTS empfohlen, mindestens 22.13. Abhängigkeiten mit npm installieren.

~~~sh
npm install
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ambiguous_zodiak.sql
npm run dev
~~~

Die bestehende Migration nur beim erstmaligen Anlegen der lokalen Datenbank ausführen. Weitere Migrationen in Reihenfolge anwenden. Der Entwicklungsserver gibt seine URL aus, standardmäßig http://127.0.0.1:5173. Lokale Vorschauen verwenden eine Testidentität und eine getrennte lokale Datenbank; Produktivdaten werden nicht heruntergeladen.

Falls die npm-CMD-Weiterleitung auf Windows fehlschlägt, kann man die npm-CLI direkt aus dem Node.js-Installationsverzeichnis starten. Auch der Framework-Befehl ist direkt ausführbar: `node scripts/run-framework.mjs build` beziehungsweise `node scripts/run-framework.mjs dev`.

## Prüfen

~~~sh
npm run typecheck
npm test
npm run test:browser
npm run test:visual
~~~

Für den Browsertest muss der lokale Entwicklungsserver laufen und Google Chrome installiert sein. Alternativ die Browserkonfiguration in tests/browser.mjs auf einen verfügbaren Playwright-Browser ändern. Der Test lehnt externe Ziele ab und stellt den lokalen Ausgangsbestand nach seinem Lauf wieder her.

Er prüft Erstellen, Neuladen, Volltextsuche, Favoriten, Archivieren/Wiederherstellen, Lernfortschritt, eigene Lernpfade, konkurrierende Updates, ungültige Referenzen und die mobile Breite. Screenshots landen ausschließlich im ignorierten Verzeichnis .sites-runtime/qa/.

## Gemeinsam Wissen pflegen

Neue Inhalte lassen sich über die Oberfläche erfassen. Für vorbereitete Inhalte oder größere Änderungen:

1. Aktuellen Bestand über „Import & Datensicherung“ exportieren.
2. Notizen und Metadaten im JSON bearbeiten. Die IDs bestehender Notizen, Themen und Lernschritte beibehalten.
3. Die validierte Datei importieren und das Ersetzen bewusst bestätigen.

Das Format ist in lib/brain/model.ts beschrieben. Ein Import ersetzt den gesamten Bestand; vorher eine Sicherung aufbewahren. Änderungen an seed.ts beeinflussen ausschließlich neu angelegte Nutzer-Sammlungen.

Der Markdown-Renderer verwendet react-markdown und remark-gfm: Überschriften, Listen, Tabellen, Zitate, Code, Links und private Bilder. Bilder über „Bild einfügen“ hochladen; Bildunterschriften stehen im Markdown-Titel. Externe Bilder werden nicht automatisch abgerufen. HTML wird nicht ausgeführt.

„Diagramm einfügen“ legt eine editierbare Mermaid-Vorlage an. Unterstützt sind klassische flowchart/graph-Diagramme, sequenceDiagram und mindmap. HTML, Konfigurationsdirektiven, externe Ressourcen und Bildformen sind ausgeschlossen. Das Ergebnis wird mit DOMPurify bereinigt und als isoliertes SVG-Bild angezeigt.

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

Die Sites-Projektidentität und DB-Bindung stehen in .openai/hosting.json. Veröffentlichung über den Sites-Workflow; Builds erzeugen den Cloudflare Worker samt Assets und Migrationen. Der private Zugriff bleibt erhalten. Zugangsdaten gehören weder in das Repository noch in Browsercode.
