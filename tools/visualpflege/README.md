# Visualpflege – wiederholbarer Ablauf

Werkzeuge für den Grafik-Agenten ([agents/grafik-agent.md](../../agents/grafik-agent.md)). Nur `brain-api.mjs` spricht mit der API; alle anderen Schritte arbeiten auf lokalen Dateien unter `.data/` (nicht versioniert).

1. **Stand holen** (nur lesen):
   `node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs pull .data/exports/<datum>.json`
2. **Prüfen**: `node tools/visualpflege/audit.mjs .data/exports/<datum>.json`
   → `bericht.md` (Notizen ohne Grafik nach Priorität, Skriptabdeckung je Thema, Kapitel mit geänderten Quellen, technische Auffälligkeiten) und `arbeitsliste.json` (Grundlage für Agentenaufträge).
   Bewusst grafikfreie Einträge mit Begründung in `ausnahmen.json` eintragen.
3. **Entwürfe** der Agenten: JSON-Array `[{ id, title, content, status: "ergänzt" | "begründet ohne Grafik", ... }]`. Bestehender Text bleibt unverändert, Diagramme werden nur eingefügt.
4. **Rendern**: `node tools/visualpflege/render-check.mjs <png-ordner> <entwurf.json>...`
   Rendert jedes Mermaid-Diagramm mit der App-Konfiguration bei 390 px Breite. Richtwert Mobilskalierung ≥ 0,6; darunter PNG ansehen. Bewährt: Übersichts-mindmap nur Wurzel + 3–4 kurze Äste ohne Blätter; Ketten ab 4 Bausteinen als `flowchart TD`; höchstens 3 Knoten nebeneinander.
5. **Zusammenführen** auf einen frischen Pull:
   `node --experimental-strip-types tools/visualpflege/merge.mjs <basis.json> <nachher.json> <entwurf.json>...`
   Bricht ab, wenn alter Text fehlt oder ein Diagramm unzulässig ist; setzt `updatedAt` und zieht Skript-Fingerabdrücke nach.
6. **Einspielen**: `brain-api.mjs push <nachher.json>` (Sicherung, Revisionsprüfung, Kontroll-Pull). Bei „Speicherstatus unklar“ nicht erneut senden, sondern neu pullen und mit dem Entwurf vergleichen.
7. Prüfbericht erneut erstellen und Ergebnis festhalten.
