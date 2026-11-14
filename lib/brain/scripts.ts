import { scriptSchema, type Note, type Script, type ScriptChapter, type Topic, type Workspace } from "./model.ts";
import { getTopicAncestors } from "./topics.ts";

export const scriptStatusLabels = { draft: "Entwurf", ready: "Lesefassung" };

/** Detect editorial changes; reading progress and note metadata do not affect this stamp. */
export function scriptSourceFingerprint(note: Pick<Note, "title" | "content">): string {
  const text = note.title + "\n" + note.content;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function chapterSourceState(chapter: ScriptChapter, notes: Note[]) {
  const byId = new Map(notes.map(note => [note.id, note]));
  return chapter.sources.map(source => {
    const note = byId.get(source.noteId);
    return { ...source, note, state: !note ? "missing" as const : note.archived ? "archived" as const
      : scriptSourceFingerprint(note) !== source.fingerprint ? "changed" as const : "current" as const };
  });
}

export function acknowledgeChapterSources(chapter: ScriptChapter, notes: Note[]): ScriptChapter {
  const states = chapterSourceState(chapter, notes);
  if (states.some(source => source.state === "missing" || source.state === "archived")) {
    throw new Error("Fehlende oder archivierte Quellen zuerst im Kapitel bearbeiten.");
  }
  return { ...chapter, sources: states.map(source => ({ noteId: source.noteId, fingerprint: scriptSourceFingerprint(source.note!) })) };
}

export function saveScriptPosition(workspace: Workspace, scriptId: string, chapterId: string, offset = 0, now = new Date().toISOString()): Workspace {
  const script = workspace.scripts?.find(item => item.id === scriptId);
  if (!script?.chapters.some(chapter => chapter.id === chapterId)) throw new Error("Dieses Skript oder Kapitel ist nicht mehr vorhanden.");
  return { ...workspace, scripts: workspace.scripts!.map(item => item.id === scriptId
    ? { ...item, readingPosition: { chapterId, offset: Math.max(0, Math.min(1, Number.isFinite(offset) ? offset : 0)), updatedAt: now } } : item) };
}

export function removeScript(workspace: Workspace, scriptId: string): Workspace {
  return { ...workspace, scripts: (workspace.scripts ?? []).filter(script => script.id !== scriptId),
    learningCollections: workspace.learningCollections.map(collection => collection.scriptIds?.includes(scriptId)
      ? { ...collection, scriptIds: collection.scriptIds.filter(id => id !== scriptId) } : collection) };
}

export function searchScripts(scripts: Script[], query: string, topics: Topic[] = []): Script[] {
  const terms = query.toLocaleLowerCase("de").trim().split(/\s+/).filter(Boolean);
  return scripts.filter(script => {
    const names = script.topicId ? [...getTopicAncestors(topics, script.topicId).map(topic => topic.title), topics.find(topic => topic.id === script.topicId)?.title ?? ""] : [];
    const text = [script.title, script.summary, script.introduction, ...script.tags, ...names,
      ...script.chapters.flatMap(chapter => [chapter.title, chapter.content])].join(" ").toLocaleLowerCase("de");
    return terms.every(term => text.includes(term));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function newScript(id: string, now = new Date().toISOString()): Script {
  return { id, title: "", summary: "", introduction: "", topicId: null, tags: [], status: "draft",
    chapters: [{ id: id + "-chapter-1", title: "Erstes Kapitel", content: "", sources: [] }], readingPosition: null, createdAt: now, updatedAt: now };
}

/** Nest source headings without altering fenced code or Mermaid diagrams. */
function nestHeadings(content: string): string {
  let fence: { mark: string; size: number } | null = null;
  return content.split("\n").map(line => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = { mark: match[1][0], size: match[1].length };
      else if (match[1][0] === fence.mark && match[1].length >= fence.size) fence = null;
      return line;
    }
    return fence ? line : line.replace(/^(#{1,6}) /, (_, hashes: string) => "#".repeat(Math.min(6, hashes.length + 2)) + " ");
  }).join("\n");
}

export function chapterFromNotes(id: string, title: string, notes: Note[], introduction = ""): ScriptChapter {
  return { id, title, content: [introduction, ...notes.map(note => "### " + note.title + "\n\n" + nestHeadings(note.content))].filter(Boolean).join("\n\n"),
    sources: notes.map(note => ({ noteId: note.id, fingerprint: scriptSourceFingerprint(note) })) };
}

export function scriptMarkdown(script: Script, notes: Note[] = []): string {
  const byId = new Map(notes.map(note => [note.id, note]));
  return ["# " + script.title, script.summary, script.introduction, "## Inhalt\n\n" + script.chapters.map((chapter, i) => `${i + 1}. ${chapter.title}`).join("\n"),
    ...script.chapters.map((chapter, i) => `## ${i + 1}. ${chapter.title}\n\n${chapter.content}` + (chapter.sources.length
      ? "\n\n**Verknüpfte Fachnotizen:**\n\n" + chapter.sources.map(source => "- " + (byId.get(source.noteId)?.title ?? "Fehlende Fachnotiz: " + source.noteId)).join("\n") : ""))].filter(Boolean).join("\n\n") + "\n";
}

const researchChapters = [
  ["Wissenschaft und Forschungslogik", ["wa-wissenschaft", "forschungslogik", "methodenprofile"], "Am Anfang steht die Frage, welche Art von Erkenntnis du gewinnen möchtest. Eine wissenschaftliche Antwort braucht ein nachvollziehbares Vorgehen. Betrachte als durchgehendes Beispiel die Frage, wie strukturiertes Feedback die Qualität digitaler Lernaufgaben beeinflusst. Zunächst ordnen wir dieses Vorhaben in die Forschungslogik ein."],
  ["Von der Idee zur Forschungsfrage", ["forschungsfrage", "wa-forschungsfrage", "wa-forschungsprozess"], "Aus dem Interesse an Feedback wird eine eingrenzbare Forschungsfrage: Für wen, bei welchen Aufgaben und nach welchem Qualitätsmaßstab soll eine Wirkung untersucht werden? Die Frage steuert die folgenden Entscheidungen. Die unterschiedlichen Prozessmodelle in den Fachnotizen sind dabei Orientierungshilfen für denselben Zusammenhang."],
  ["Qualität und Aussagekraft absichern", ["guetekriterien"], "Bevor wir Daten erheben, müssen wir klären, woran wir eine belastbare Antwort erkennen. Im Beispiel reicht eine konsistente Bewertung der Aufgaben allein nicht aus: Die Bewertung muss auch tatsächlich die gemeinte Qualität erfassen. Gütekriterien begründen, welche Schlüsse die Untersuchung zulässt."],
  ["Quantitativ untersuchen: messen und prüfen", ["stichprobe", "quant-erhebung", "quant-auswertung"], "Soll ein messbarer Unterschied geprüft werden, führt der Weg von der Grundgesamtheit über Stichprobe und Operationalisierung zur Auswertung. Im Feedbackbeispiel könnten vergleichbare Aufgaben mit und ohne strukturiertes Feedback untersucht werden. Ob daraus ein kausaler Schluss möglich ist, hängt vom Design ab; ein statistischer Zusammenhang allein genügt dafür nicht."],
  ["Qualitativ untersuchen: verstehen und einordnen", ["qual-prozess", "qual-erhebung", "qual-auswertung"], "Vielleicht ist zunächst unklar, was Lernende unter hilfreichem Feedback verstehen. Dann können Interviews und qualitative Auswertung den Gegenstand erschließen. Die Auswahl von Fällen, die Erhebung und die Interpretation greifen wiederholt ineinander. Die folgenden Abschnitte führen vom Material zu nachvollziehbar begründeten Kategorien und Themen."],
  ["Fälle verstehen und Lösungen gestalten", ["fallstudien", "design-science", "artefakte"], "Ein anderer Zugang untersucht Feedback in einer konkreten Lernumgebung oder entwickelt selbst eine Lösung. Eine Fallstudie vertieft das Verständnis des Kontexts. Design Science verbindet die Entwicklung eines Artefakts, etwa eines Feedbackwerkzeugs, mit seiner Evaluation. Die Wahl folgt dem Erkenntnisziel und ist in der Forschungsfrage zu begründen."],
  ["Literatur erschließen und argumentieren", ["wa-literaturarbeit", "wa-lesen"], "Jeder dieser Wege setzt vorhandenes Wissen voraus. Literatur hilft, Begriffe zu klären, eine Forschungslücke zu prüfen und Entscheidungen zu begründen. Eine Literaturarbeit kann auch selbst der Weg zur Antwort sein. Entscheidend ist, Aussagen kritisch zu verbinden und eine eigene Argumentation aufzubauen."],
  ["Die Untersuchung verständlich dokumentieren", ["wa-schreiben", "wa-aufbau-expose", "wa-zitieren", "wa-literaturverzeichnis"], "Die Qualität einer Untersuchung muss im Text erkennbar werden. Forschungsfrage, Methode, Ergebnisse und Schlussfolgerungen greifen ineinander. Fremde Beiträge werden belegt; die eigene Leistung besteht darin, sie begründet einzuordnen. Die folgenden Abschnitte verbinden den Aufbau einer Arbeit mit Schreibprozess und Quellenarbeit."],
  ["Forschungsskizze, Reflexion und Ethik", ["forschungsskizze"], "In einer Forschungsskizze wird dieser Zusammenhang vor der Durchführung sichtbar: Warum ist die Frage relevant, welche Erkenntnis fehlt, und weshalb ist das geplante Vorgehen geeignet? Auch Grenzen und ethische Fragen gehören dazu. Im Feedbackbeispiel betreffen sie etwa Freiwilligkeit, personenbezogene Daten und den Umgang mit ungleichen Lernbedingungen."],
  ["Die eigene Arbeit prüfen und präsentieren", ["mindeststandard", "wiss-arbeit", "screencast", "reflexion-ml-arbeit", "wa-praesentieren"], "Zum Abschluss wird die Argumentationskette geprüft und für andere verständlich dargestellt. Kriterien und Erfahrungsbeispiele helfen, Lücken zwischen Anspruch, Text und tatsächlichen Ergebnissen zu finden. Beispiele zu Arbeiten mit Code und Screencasts sind besondere Anwendungsfälle; ihre Anforderungen müssen jeweils mit den Vorgaben der eigenen Arbeit abgeglichen werden."],
] as const;

/** A proposal uses the owner's current notes; no private course content is shipped in source code. */
export function researchScriptProposal(workspace: Workspace, now = new Date().toISOString()): Script | null {
  if (workspace.scripts?.some(script => script.id === "script-research-methods")) return null;
  const chapters = researchChapters.flatMap(([title, suffixes, intro], index) => {
    const notes = suffixes.flatMap(suffix => {
      const note = workspace.notes.find(note => note.id === "fm-note-" + suffix && !note.archived);
      return note ? [note] : [];
    });
    return notes.length ? [chapterFromNotes("research-chapter-" + (index + 1), title, notes, intro)] : [];
  });
  if (!chapters.length || !workspace.notes.some(note => note.id === "fm-note-forschungslogik")) return null;
  return scriptSchema.parse({ id: "script-research-methods", title: "Forschungsmethoden: von der Frage zum begründeten Forschungsdesign",
    summary: "Ein zusammenhängender Weg durch Forschungslogik, Forschungsdesign, quantitative und qualitative Methoden, Fallstudien, Design Science und wissenschaftliches Arbeiten.",
    introduction: "Dieses Skript verbindet die vorhandenen Fachnotizen entlang des Forschungsprozesses. Die Kapitel beginnen mit einer Einordnung und führen dann in die ausführlichen Erklärungen, Beispiele und Quellen. Als gemeinsames Beispiel dient die Wirkung strukturierten Feedbacks auf digitale Lernaufgaben.\n\nKursaussagen, unterschiedliche Fassungen und Hinweise aus der Fachliteratur bleiben in den Fachabschnitten gekennzeichnet. Die Quellenverweise stehen dort bei den jeweiligen Aussagen. Das Skript bildet den vorhandenen Wissensstand ab; es ersetzt keine noch fehlenden Quellen. Änderungen an verknüpften Fachnotizen werden als Prüfhinweis sichtbar.",
    topicId: workspace.topics.some(topic => topic.id === "fm-topic") ? "fm-topic" : null, tags: ["forschungsmethoden", "wissenschaftliches-arbeiten"],
    status: "draft", chapters, readingPosition: null, createdAt: now, updatedAt: now });
}

export function addScript(workspace: Workspace, script: Script, collectionId?: string): Workspace {
  if (workspace.scripts?.some(item => item.id === script.id)) throw new Error("Dieses Skript ist bereits vorhanden.");
  return { ...workspace, scripts: [...(workspace.scripts ?? []), script],
    learningCollections: workspace.learningCollections.map(collection => collection.id === collectionId
      ? { ...collection, scriptIds: [...new Set([...(collection.scriptIds ?? []), script.id])] } : collection) };
}

export function editScript(workspace: Workspace, original: Script, draft: Script, now = new Date().toISOString()): Workspace {
  const current = workspace.scripts?.find(script => script.id === original.id);
  const editorial = (script: Script) => { const { readingPosition: _position, ...content } = script; return JSON.stringify(content); };
  if (!current || editorial(current) !== editorial(original)) throw new Error("Das Skript wurde inzwischen geändert. Öffne es erneut, bevor du weiterbearbeitest.");
  const position = current.readingPosition;
  const updated = scriptSchema.parse({ ...draft, updatedAt: now,
    readingPosition: position && draft.chapters.some(chapter => chapter.id === position.chapterId) ? position : null });
  return { ...workspace, scripts: workspace.scripts!.map(script => script.id === original.id ? updated : script) };
}

/** Image URLs change during ZIP import. Preserve stamps that matched before remapping. */
export function remapScriptSourceFingerprints(before: Workspace, after: Workspace): Workspace {
  if (!after.scripts) return after;
  return { ...after, scripts: after.scripts.map(script => ({ ...script, chapters: script.chapters.map(chapter => ({ ...chapter,
    sources: chapter.sources.map(source => {
      const oldNote = before.notes.find(note => note.id === source.noteId);
      const newNote = after.notes.find(note => note.id === source.noteId);
      return oldNote && newNote && scriptSourceFingerprint(oldNote) === source.fingerprint
        ? { ...source, fingerprint: scriptSourceFingerprint(newNote) } : source;
    }),
  })) })) };
}
