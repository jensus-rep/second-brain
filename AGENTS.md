# Second Brain – Projektkonventionen

- Private Next.js-App auf Azure App Service (Web App `second-brain`, Node 22). Deployment ausschließlich über `.github/workflows/main_second-brain.yml` bei Push auf `main`.
- Deutsch ist die Produktsprache; die Oberfläche bleibt hell.
- Inhalte sind Markdown plus strukturierte Metadaten. Keine HTML-Injektion aus Notizen.
- Wissen nach allgemeinen Fachthemen ablegen, nicht nach Hochschulmodulen. Titel, Themen, Tags, Lernpfade, Lernkarten und Grafiken verwenden keine Uni- oder Kurskürzel. Erklärungen stehen für sich und nutzen übertragbare Praxisbeispiele; Quellen und fachliche Einschränkungen bleiben nachvollziehbar. Bestehende interne IDs erhalten, damit Verknüpfungen und Lernfortschritte stabil bleiben.
- Modell und Validierung: lib/brain/model.ts. Beispielinhalte: lib/brain/seed.ts.
- Persistenz: lib/server/store.ts (Azure SQL in Produktion, lokale SQLite-Datei in Entwicklung) über lib/brain/storage.ts und app/api/brain/route.ts. Eigene Tabellen `newhope_*`; die Tabellen `second_brain_*` der Vorgänger-App nicht verändern.
- Anmeldung: lib/server/auth.ts (eigenes Konto, scrypt, signiertes Session-Cookie). Eigentümer immer aus der serverseitigen Session ableiten. Das erste Konto entsteht nur mit `NEWHOPE_SETUP_TOKEN`.
- Keine Wissensinhalte oder Fortschritte ausschließlich im Browser speichern.
- Schreibvorgänge verwenden eine Revision. Konflikte niemals still überschreiben.
- UI: components/brain/, Gestaltung: app/globals.css und app/reading-workspace.css. Vorhandene components/ui-Primitiven wiederverwenden.
- Seed-Inhalte werden nur beim ersten Öffnen eines neuen Nutzer-Arbeitsraums angelegt. Seed-Änderungen verändern keine bestehende Sammlung.
- Bestehendes Wissen über UI oder validierten Import ändern, nicht über destruktive Datenbank-Resets.
- Schemaänderungen nur additiv in den Schema-Skripten von store-mssql.ts und store-sqlite.ts (`IF ... IS NULL` / `IF NOT EXISTS`). Bestehende Tabellen und Spalten nicht umbenennen oder löschen.
- Nach Änderungen: Typecheck, passende Modelltests, bei Verhaltensänderungen lokale Browsertests gegen `npm run dev`. Browsertests dürfen ausschließlich localhost verändern; lokal wird nie die Azure-Datenbank verwendet.
- Keine Zugangsdaten im Quelltext. Geheimnisse liegen in den App-Einstellungen der Web App bzw. in GitHub-Secrets.
