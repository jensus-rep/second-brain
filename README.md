# NewHope · Dein Wissensatelier

Eine private, deutschsprachige Second-Brain-Web-App. Wissen wird als Markdown mit strukturierten Metadaten gespeichert und als Bibliothek, Notizleser, Verknüpfungskarte und Lernpfad dargestellt.

## Funktionen

- Notizen erstellen, bearbeiten, favorisieren, archivieren und wiederherstellen.
- Eigene Themenräume, Tags sowie Verbindungen und automatisch sichtbare Rückverweise.
- Volltextsuche über Titel, Zusammenfassung, Inhalt, Tags und Themennamen; kombinierbare Filter.
- Karten- und Listenansicht sowie responsive Navigation.
- Lernpfade mit sortierbaren Schritten, eigenen Aufgaben und dauerhaftem Fortschritt.
- JSON-Export und validierter Import mit ausdrücklicher Ersetzungsbestätigung.
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
~~~

Für den Browsertest muss der lokale Entwicklungsserver laufen und Google Chrome installiert sein. Alternativ die Browserkonfiguration in tests/browser.mjs auf einen verfügbaren Playwright-Browser ändern. Der Test lehnt externe Ziele ab und stellt den lokalen Ausgangsbestand nach seinem Lauf wieder her.

Er prüft Erstellen, Neuladen, Volltextsuche, Favoriten, Archivieren/Wiederherstellen, Lernfortschritt, eigene Lernpfade, konkurrierende Updates, ungültige Referenzen und die mobile Breite. Screenshots landen ausschließlich im ignorierten Verzeichnis .sites-runtime/qa/.

## Gemeinsam Wissen pflegen

Neue Inhalte lassen sich über die Oberfläche erfassen. Für vorbereitete Inhalte oder größere Änderungen:

1. Aktuellen Bestand über „Import & Datensicherung“ exportieren.
2. Notizen und Metadaten im JSON bearbeiten. Die IDs bestehender Notizen, Themen und Lernschritte beibehalten.
3. Die validierte Datei importieren und das Ersetzen bewusst bestätigen.

Das Format ist in lib/brain/model.ts beschrieben. Ein Import ersetzt den gesamten Bestand; vorher eine Sicherung aufbewahren. Änderungen an seed.ts beeinflussen ausschließlich neu angelegte Nutzer-Sammlungen.

Der Markdown-Renderer unterstützt Überschriften, Absätze, Listen, Zitate, Fettschrift, Inline-Code, Codeblöcke ohne Leerabsatz und externe HTTP(S)-Links. HTML, Skripte und gefährliche Linkprotokolle werden nicht ausgeführt. Tabellen, Bilder, Dateianhänge und vollständiges CommonMark sind noch nicht umgesetzt.

## Grenzen der ersten Version

- Maximal 1,8 MB UTF-8 pro Sammlung, 1.000 Notizen, 100 Themen und 100 Lernpfade; maximal 80.000 Zeichen je Notiz.
- Kein Offline-Modus, keine Dateianhänge, keine automatische externe Recherche.
- Änderungen werden ausdrücklich gespeichert. Bei Verbindungsfehlern bleiben offene Formulare erhalten; beim Verlassen mit ungespeicherten Änderungen erfolgt eine Warnung.
- Die Sammlung bleibt privat; weitere Nutzer erhalten separate Sammlungen, falls der Zugang später erweitert wird.
- Die Verknüpfungskarte zeigt bis zu 40 Notizen; Themenfilter grenzen größere Bestände ein.
- Browser-WebMCP wird nur bei vorhandener Unterstützung registriert: Wissen suchen oder einen ungespeicherten Notizentwurf öffnen. Es ist keine eigene KI-Chatfunktion. Die native WebMCP-Integration benötigt einen unterstützten Browser und konnte in der lokalen Chrome-Umgebung nicht nativ geprüft werden.

## Veröffentlichung

Die Sites-Projektidentität und DB-Bindung stehen in .openai/hosting.json. Veröffentlichung über den Sites-Workflow; Builds erzeugen den Cloudflare Worker samt Assets und Migrationen. Der private Zugriff bleibt erhalten. Zugangsdaten gehören weder in das Repository noch in Browsercode.

