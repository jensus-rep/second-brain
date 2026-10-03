# NewHope – Projektkonventionen

- Dies ist eine private Sites-App. Die Identität in .openai/hosting.json erhalten.
- Deutsch ist die Produktsprache; die Oberfläche bleibt hell.
- Inhalte sind Markdown plus strukturierte Metadaten. Keine HTML-Injektion aus Notizen.
- Wissen nach allgemeinen Fachthemen ablegen, nicht nach Hochschulmodulen. Titel, Themen, Tags, Lernpfade, Lernkarten und Grafiken verwenden keine Uni- oder Kurskürzel. Erklärungen stehen für sich und nutzen übertragbare Praxisbeispiele; Quellen und fachliche Einschränkungen bleiben nachvollziehbar. Bestehende interne IDs erhalten, damit Verknüpfungen und Lernfortschritte stabil bleiben.
- Modell und Validierung: lib/brain/model.ts. Beispielinhalte: lib/brain/seed.ts.
- Persistenz: lib/brain/storage.ts und app/api/brain/route.ts. Eigentümer immer aus der serverseitigen Anmeldung ableiten.
- Keine Wissensinhalte oder Fortschritte ausschließlich im Browser speichern.
- Schreibvorgänge verwenden eine Revision. Konflikte niemals still überschreiben.
- UI: components/brain/, Gestaltung: app/globals.css. Vorhandene components/ui-Primitiven wiederverwenden.
- Seed-Inhalte werden nur beim ersten Öffnen eines neuen Nutzer-Arbeitsraums angelegt. Seed-Änderungen verändern keine bestehende Sammlung.
- Bestehendes Wissen über UI oder validierten Import ändern, nicht über destruktive Datenbank-Resets.
- Schemaänderungen mit Drizzle generieren. Bereits veröffentlichte Migrationen bleiben unverändert.
- Nach Änderungen: Typecheck, passende Modelltests, bei Verhaltensänderungen lokale Browsertests. Browsertests dürfen ausschließlich localhost verändern.
- Veröffentlichung erfolgt über Sites und bleibt privat. Keine Zugangsdaten im Quelltext.
