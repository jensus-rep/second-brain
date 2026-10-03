import type { Workspace, Note } from "./model";

const createdAt = "2026-10-03T10:00:00.000Z";
const entries = [
  ["start", "Dein Wissen bekommt ein Zuhause", "Eine konkrete Frage gibt deiner Wissenssammlung eine Richtung.", "wissen", ["einstieg", "orientierung"], "## Beginne mit einer guten Frage\nWofür möchtest du dein Wissen nutzen? Eine konkrete Frage macht aus einer Sammlung einen Ort zum Weiterdenken.\n\nZum Beispiel: **Was möchte ich über gutes Schreiben verstehen?**\n\n## Ein kleiner Anfang\n1. Halte deine Frage in einer eigenen Notiz fest.\n2. Sammle dazu einen hilfreichen Gedanken.\n3. Ergänze ein Beispiel aus deinem Alltag.\n4. Formuliere einen nächsten Schritt.\n\n> Deine Sammlung darf wachsen. Sie muss nicht von Anfang an vollständig sein.\n\n## Jetzt ausprobieren\nLege über **Neue Notiz** deinen ersten Gedanken an."],
  ["capture", "Gedanken festhalten, bevor sie verschwinden", "Ein Gedanke, etwas Kontext und eine offene Frage reichen für den Anfang.", "wissen", ["notizen", "sammeln"], "## Erfassen darf leicht sein\nEine erste Notiz muss noch nicht fertig sein. Schreibe auf, was dir wichtig erscheint und warum du es behalten möchtest.\n\n## Drei hilfreiche Fragen\n- Was ist der Gedanke?\n- In welchem Zusammenhang ist er entstanden?\n- Wofür könnte er später nützlich sein?\n\n## Eine kleine Vorlage\n**Gedanke:** …\n\n**Kontext oder Quelle:** …\n\n**Meine offene Frage:** …\n\n## Jetzt ausprobieren\nErfasse einen Gedanken aus deinem heutigen Alltag."],
  ["understand", "Aus einer Fundstelle wird eigenes Wissen", "Formuliere die Kernaussage selbst und prüfe sie an einem eigenen Beispiel.", "denken", ["verstehen", "schreiben"], "## Schreibe in deinen eigenen Worten\nErgänze zu einer Fundstelle, wie du sie verstehst. Trenne die Aussage der Quelle von deiner eigenen Interpretation.\n\n## Gib dem Gedanken einen Kern\n- Was wird behauptet?\n- Unter welchen Bedingungen gilt es?\n- Welches Beispiel macht die Aussage verständlich?\n- Was ist noch unklar?\n\n## Jetzt ausprobieren\nWähle eine Notiz. Ergänze eine Kernaussage, ein eigenes Beispiel und eine offene Frage."],
  ["connect", "Die besten Ideen entstehen dazwischen", "Themen geben Orientierung. Verbindungen machen Zusammenhänge sichtbar.", "denken", ["verbindungen", "struktur"], "## Wissen lebt von Verbindungen\nEine Notiz kann mehrere Anschlussstellen haben. Ordne sie einem Thema zu und nutze wenige passende Tags.\n\n## Beziehungen brauchen einen Gedanken\n- Ergänzen sich die Notizen?\n- Beschreiben sie verschiedene Sichtweisen?\n- Ist eine ein Beispiel für die andere?\n- Widersprechen sie sich?\n\n## Jetzt ausprobieren\nÖffne **Bearbeiten** und wähle unter **Verknüpfte Notizen** passende Gedanken aus. Halte im Text fest, warum sie zusammengehören."],
  ["path", "Vom Sammeln ins Verstehen", "Ein Lernpfad ordnet Wissen nach dem, was du anschließend können möchtest.", "lernen", ["lernpfade", "planung"], "## Beschreibe das Ergebnis\nFormuliere dein Ziel als Fähigkeit: **Ich kann … erklären, unterscheiden, anwenden oder erstellen.**\n\n## Plane eine kurze Folge\n1. Orientierung: Worum geht es?\n2. Grundlage: Welche Begriffe brauche ich?\n3. Anwendung: Was probiere ich selbst aus?\n4. Rückblick: Was kann ich bereits, was fehlt noch?\n\n## Jetzt ausprobieren\nErstelle unter **Lernpfade** einen eigenen Pfad. Wähle drei bis fünf Notizen und gib jedem Schritt eine konkrete Aufgabe."],
  ["review", "Wissen, das mit dir weiterwächst", "Ein kurzer Rückblick hält deine Sammlung verständlich und nützlich.", "lernen", ["reflexion", "anwenden"], "## Ein Rückblick mit drei Fragen\n- Welche Notiz hat mir zuletzt geholfen?\n- Was ist unklar, doppelt oder nicht mehr relevant?\n- Welchen Gedanken möchte ich als Nächstes anwenden?\n\n## Prüfe dein Verständnis\nVersuche, einen Gedanken ohne Nachlesen zu erklären. Notiere anschließend, was dir gefehlt hat.\n\n## Jetzt ausprobieren\nVerbessere eine Notiz und leite einen nächsten Schritt ab. Nicht mehr benötigte Notizen kannst du archivieren und später wiederherstellen."],
] as const;

export const seedWorkspace: Workspace = {
  schemaVersion: 1,
  topics: [
    { id: "wissen", title: "Wissensarbeit", description: "Gedanken sammeln, ordnen und wiederfinden.", color: "blue" },
    { id: "denken", title: "Denken & Verstehen", description: "Verbindungen entdecken. Eigene Ideen entwickeln.", color: "purple" },
    { id: "lernen", title: "Lernen & Anwenden", description: "Aus Wissen neue Fähigkeiten machen.", color: "orange" },
  ],
  notes: entries.map(([id, title, summary, topicId, tags, content], i): Note => ({
    id, title, summary, topicId, tags: [...tags], content, relatedIds: i < entries.length - 1 ? [entries[i + 1][0]] : ["start"],
    favorite: false, archived: false, createdAt, updatedAt: createdAt,
  })),
  paths: [{ id: "erster-pfad", title: "Dein Second Brain aufbauen", description: "Sechs kleine Schritte von deiner ersten Frage zu einer lebendigen Wissenssammlung.", steps: entries.map(([id], i) => ({ id: "einstieg-" + i, noteId: id, objective: ["Formuliere deine erste Wissensfrage.", "Erfasse einen Gedanken mit Kontext.", "Erkläre eine Idee in deinen eigenen Worten.", "Verbinde zwei verwandte Gedanken.", "Erstelle einen eigenen Lernpfad.", "Wende einen Gedanken im Alltag an."][i] })) }],
  completedStepIds: [],
};

