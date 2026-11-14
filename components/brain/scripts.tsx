"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeTags, scriptSchema, type Script, type ScriptChapter, type Workspace } from "@/lib/brain/model";
import { acknowledgeChapterSources, addScript, chapterFromNotes, chapterSourceState, editScript, newScript, removeScript, researchScriptProposal, saveScriptPosition, scriptMarkdown, scriptSourceFingerprint, scriptStatusLabels, searchScripts } from "@/lib/brain/scripts";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { flattenTopics, getTopicOptionLabel, getTopicPathLabel } from "@/lib/brain/topics";
import { Markdown } from "./markdown";
import { MediaToolbar } from "./media-toolbar";

type Props = { workspace: Workspace; save: SaveWorkspace; saving: boolean; query: string;
  selectedId: string | null; onSelect: (id: string | null) => void; onOpenNote: (id: string) => void };

function exportMarkdown(script: Script, workspace: Workspace) {
  const url = URL.createObjectURL(new Blob([scriptMarkdown(script, workspace.notes)], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url;
  link.download = script.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 120) + ".md";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ScriptEditor({ script, workspace, save, saving, onClose, onSaved }: {
  script: Script; workspace: Workspace; save: SaveWorkspace; saving: boolean; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState(script);
  const [chapterId, setChapterId] = useState(script.chapters[0].id);
  const [tags, setTags] = useState(script.tags.join(", "));
  const [sourceQuery, setSourceQuery] = useState("");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const existed = useRef(!!workspace.scripts?.some(item => item.id === script.id));
  const busy = saving || uploading;
  const dirty = JSON.stringify(draft) !== JSON.stringify(script) || tags !== script.tags.join(", ");
  const chapter = draft.chapters.find(item => item.id === chapterId) ?? draft.chapters[0];
  const chapterIndex = draft.chapters.indexOf(chapter);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function close() { if (!busy && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) onClose(); }
  function changeChapter(update: Partial<ScriptChapter>) {
    setDraft(current => ({ ...current, chapters: current.chapters.map(item => item.id === chapter.id ? { ...item, ...update } : item) }));
  }
  function moveChapter(direction: number) {
    const chapters = [...draft.chapters]; const other = chapterIndex + direction;
    if (other < 0 || other >= chapters.length) return;
    [chapters[chapterIndex], chapters[other]] = [chapters[other], chapters[chapterIndex]];
    setDraft({ ...draft, chapters });
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog script-editor" onInteractOutside={event => event.preventDefault()}>
    <DialogHeader><DialogTitle>{existed.current ? "Skript bearbeiten" : "Skript anlegen"}</DialogTitle><DialogDescription>Verbinde Wissen zu einer zusammenhängenden Erklärung. Kapitel und Quellen bleiben einzeln bearbeitbar.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={busy} aria-busy={busy} onSubmit={async event => {
      event.preventDefault(); setError("");
      const candidate = { ...draft, tags: normalizeTags(tags), readingPosition: draft.readingPosition && draft.chapters.some(item => item.id === draft.readingPosition?.chapterId) ? draft.readingPosition : null };
      const result = scriptSchema.safeParse(candidate);
      if (!result.success) { setError(result.error.issues[0]?.message ?? "Bitte das Skript prüfen."); return; }
      const ok = await save(current => existed.current ? editScript(current, script, result.data) : addScript(current, result.data,
        script.id === "script-research-methods" ? "learning-collection-research-methods" : undefined), "Skript gespeichert");
      if (ok) { onSaved(script.id); onClose(); }
    }}>
      <label className="field"><span>Titel des Skripts</span><Input required maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="field"><span>Kurzbeschreibung und Lernziel</span><Textarea maxLength={600} rows={2} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label>
      <div className="form-columns"><label className="field"><span>Thema des Skripts</span><select value={draft.topicId ?? ""} onChange={event => setDraft({ ...draft, topicId: event.target.value || null })}><option value="">Ohne Thema</option>{flattenTopics(workspace.topics).map(({ topic }) => <option key={topic.id} value={topic.id}>{getTopicOptionLabel(workspace.topics, topic.id)}</option>)}</select></label>
        <label className="field"><span>Bearbeitungsstand</span><select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Script["status"] })}><option value="draft">Entwurf</option><option value="ready">Lesefassung</option></select></label></div>
      <label className="field"><span>Tags</span><Input maxLength={800} value={tags} onChange={event => setTags(event.target.value)} placeholder="Mit Komma trennen" /></label>
      <label className="field"><span>Einführung</span><Textarea maxLength={12000} rows={3} value={draft.introduction} onChange={event => setDraft({ ...draft, introduction: event.target.value })} /></label>
      <div className="script-chapter-tools"><label className="field"><span>Kapitel bearbeiten</span><select value={chapter.id} onChange={event => { setChapterId(event.target.value); setPreview(false); }}>{draft.chapters.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title || "Ohne Titel"}</option>)}</select></label>
        <Button type="button" variant="outline" disabled={draft.chapters.length >= 100} onClick={() => { const id = crypto.randomUUID(); setDraft({ ...draft, chapters: [...draft.chapters, { id, title: "Neues Kapitel", content: "", sources: [] }] }); setChapterId(id); setPreview(false); }}><Plus size={15} />Kapitel hinzufügen</Button>
        <Button type="button" variant="outline" aria-label="Kapitel nach oben" disabled={chapterIndex === 0} onClick={() => moveChapter(-1)}><ArrowUp size={16} /></Button><Button type="button" variant="outline" aria-label="Kapitel nach unten" disabled={chapterIndex === draft.chapters.length - 1} onClick={() => moveChapter(1)}><ArrowDown size={16} /></Button>
        <Button type="button" variant="ghost" disabled={draft.chapters.length === 1} onClick={() => { if (!window.confirm("Dieses Kapitel aus dem Skript entfernen?")) return; const chapters = draft.chapters.filter(item => item.id !== chapter.id); setDraft({ ...draft, chapters }); setChapterId(chapters[Math.max(0, chapterIndex - 1)].id); }}><Trash2 size={15} />Kapitel entfernen</Button></div>
      <label className="field"><span>Kapiteltitel</span><Input required maxLength={160} value={chapter.title} onChange={event => changeChapter({ title: event.target.value })} /></label>
      <div className="script-preview-toggle"><Button type="button" variant="outline" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "Kapiteltext bearbeiten" : "Kapitelvorschau"}</Button></div>
      {preview ? <div className="markdown-preview"><Markdown content={chapter.content || "Dieses Kapitel hat noch keinen Text."} /></div> : <><label className="field"><span>Kapiteltext</span><Textarea className="markdown-input" maxLength={80000} rows={12} value={chapter.content} onChange={event => changeChapter({ content: event.target.value })} /></label><MediaToolbar onBusy={setUploading} insert={text => changeChapter({ content: chapter.content + text })} /></>}
      <details className="script-source-picker"><summary>Verknüpfte Fachnotizen ({chapter.sources.length})</summary><p>Diese Verweise halten die Herkunft fest und zeigen spätere Änderungen als Prüfhinweis an.</p>
        <Input aria-label="Fachnotizen für Kapitel filtern" placeholder="Fachnotizen suchen …" value={sourceQuery} onChange={event => setSourceQuery(event.target.value)} />
        <div className="collection-picker-list">{workspace.notes.filter(note => !note.archived && (note.title + " " + note.summary).toLocaleLowerCase("de").includes(sourceQuery.toLocaleLowerCase("de"))).map(note => <label key={note.id}><Checkbox checked={chapter.sources.some(source => source.noteId === note.id)} onCheckedChange={checked => changeChapter({ sources: checked === true ? [...chapter.sources, { noteId: note.id, fingerprint: scriptSourceFingerprint(note) }] : chapter.sources.filter(source => source.noteId !== note.id) })} /><span>{note.title}</span></label>)}
          {chapter.sources.filter(source => !workspace.notes.some(note => note.id === source.noteId && !note.archived)).map(source => <label key={source.noteId}><Checkbox checked onCheckedChange={() => changeChapter({ sources: chapter.sources.filter(item => item.noteId !== source.noteId) })} /><span>{workspace.notes.find(note => note.id === source.noteId)?.title ?? source.noteId} · fehlt oder archiviert</span></label>)}</div>
        <Button type="button" variant="outline" disabled={!chapter.sources.length} onClick={() => { if (chapter.content && !window.confirm("Kapiteltext durch die aktuellen Texte der verknüpften Fachnotizen ersetzen? Eigene Übergänge werden dabei ersetzt.")) return; const notes = chapter.sources.flatMap(source => { const note = workspace.notes.find(note => note.id === source.noteId && !note.archived); return note ? [note] : []; }); if (!notes.length) { setError("Keine verfügbare Fachnotiz zum Übernehmen."); return; } changeChapter(chapterFromNotes(chapter.id, chapter.title, notes)); }}>Texte der Fachnotizen übernehmen</Button>
      </details>
      {error && <p role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={close}>Abbrechen</Button><Button type="submit">Skript speichern</Button></div>
    </form>
  </DialogContent></Dialog>;
}

function ScriptReader({ script, workspace, save, saving, onBack, onEdit, onOpenNote }: {
  script: Script; workspace: Workspace; save: SaveWorkspace; saving: boolean; onBack: () => void; onEdit: () => void; onOpenNote: (id: string) => void;
}) {
  const [chapterId, setChapterId] = useState(script.readingPosition?.chapterId ?? script.chapters[0].id);
  const [whole, setWhole] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ chapterId: string; offset: number } | null>(null);
  const position = useRef(script.readingPosition);
  const restoring = useRef(false);
  const chapter = script.chapters.find(item => item.id === chapterId) ?? script.chapters[0];
  const index = script.chapters.indexOf(chapter);
  const states = chapterSourceState(chapter, workspace.notes);
  const outdated = states.some(source => source.state !== "current");
  const persist = (id: string, offset: number) => save(current => saveScriptPosition(current, script.id, id, offset), "");
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    restoring.current = true;
    const frame = requestAnimationFrame(() => {
      element.scrollTop = !whole && position.current?.chapterId === chapter.id ? position.current.offset * Math.max(0, element.scrollHeight - element.clientHeight) : 0;
      requestAnimationFrame(() => { restoring.current = false; });
    });
    return () => cancelAnimationFrame(frame);
  }, [chapter.id, whole]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const target = pending.current;
    if (target) void save(current => saveScriptPosition(current, script.id, target.chapterId, target.offset), "");
  }, [save, script.id]);
  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    const target = pending.current;
    if (!target) return true;
    const ok = await persist(target.chapterId, target.offset);
    if (ok && pending.current === target) pending.current = null;
    return ok;
  }
  async function navigate(id: string) {
    if (timer.current) clearTimeout(timer.current);
    if (!await persist(id, 0)) return;
    pending.current = null; position.current = null; setWhole(false); setChapterId(id); setOutlineOpen(false);
  }
  return <article className="script-reader" aria-label={script.title}>
    <div className="script-actions"><Button variant="ghost" disabled={saving} onClick={async () => { if (await flush()) onBack(); }}><ArrowLeft size={16} />Alle Skripte</Button><span>{scriptStatusLabels[script.status]}</span><Button variant="outline" disabled={saving} onClick={async () => { if (await flush()) onEdit(); }}><Pencil size={15} />Skript bearbeiten</Button><Button variant="outline" onClick={() => exportMarkdown(script, workspace)}><Download size={15} />Markdown exportieren</Button></div>
    <header className="script-heading"><span className="eyebrow">SKRIPT · {script.chapters.length} KAPITEL</span><h2>{script.title}</h2><p>{script.summary}</p>{script.topicId && <small>{getTopicPathLabel(workspace.topics, script.topicId)}</small>}</header>
    <div className="script-reading-layout"><aside className="script-outline"><h3>Inhalt</h3><Button className="script-outline-toggle" variant="outline" aria-expanded={outlineOpen} aria-controls={"script-outline-" + script.id} onClick={() => setOutlineOpen(!outlineOpen)}><BookOpen size={16} />Inhaltsübersicht<span>{index + 1} / {script.chapters.length}</span></Button><div id={"script-outline-" + script.id} className={"script-outline-content" + (outlineOpen ? " is-open" : "")}><ol>{script.chapters.map((item, i) => <li key={item.id}><button disabled={saving} aria-current={!whole && item.id === chapter.id ? "step" : undefined} onClick={() => void navigate(item.id)}><span>{i + 1}.</span><span className="script-outline-title">{item.title}{chapterSourceState(item, workspace.notes).some(source => source.state !== "current") && <small>Quelle prüfen</small>}</span></button></li>)}</ol>
      <Button variant="outline" aria-pressed={whole} disabled={saving} onClick={async () => { if (await flush()) setWhole(!whole); }}>{whole ? "Kapitelansicht" : "Gesamtes Skript lesen"}</Button><p className="small-note">Die Leseposition in der Kapitelansicht wird automatisch gespeichert.</p></div></aside>
      <div className="script-scroll" ref={scrollRef} tabIndex={0} aria-label="Skript lesen" onScroll={() => {
        const element = scrollRef.current;
        if (whole || restoring.current || !element) return;
        const offset = element.scrollHeight > element.clientHeight ? element.scrollTop / (element.scrollHeight - element.clientHeight) : 0;
        const target = { chapterId: chapter.id, offset };
        pending.current = target; position.current = { ...target, updatedAt: new Date().toISOString() };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => { if (await persist(target.chapterId, target.offset) && pending.current === target) pending.current = null; }, 900);
      }}>
        {(whole || index === 0) && script.introduction && <section className="script-introduction"><Markdown content={script.introduction} /></section>}
        {whole ? script.chapters.map((item, i) => <section className="script-full-chapter" key={item.id}><h3>{i + 1}. {item.title}</h3><Markdown content={item.content} />{chapterSourceState(item, workspace.notes).some(source => source.state !== "current") && <p className="script-source-warning">Quellenstand prüfen: In diesem Kapitel gibt es geänderte, archivierte oder fehlende Fachnotizen.</p>}</section>) : <section><span className="eyebrow">KAPITEL {index + 1} VON {script.chapters.length}</span><h3 className="script-chapter-title">{chapter.title}</h3>
          {outdated && <div className="script-source-warning" role="status"><strong>Quellenstand prüfen</strong><p>Eine verknüpfte Fachnotiz wurde geändert, archiviert oder ist nicht mehr vorhanden. Prüfe den Kapiteltext gegen die Quelle.</p>{states.every(source => source.note && source.state !== "archived") && <Button variant="outline" size="sm" disabled={saving} onClick={() => void save(current => {
            const currentScript = current.scripts?.find(item => item.id === script.id);
            const currentChapter = currentScript?.chapters.find(item => item.id === chapter.id);
            if (!currentChapter || JSON.stringify(currentChapter) !== JSON.stringify(chapter)) throw new Error("Das Kapitel wurde inzwischen geändert. Öffne es erneut.");
            if (states.some(source => source.note && scriptSourceFingerprint(current.notes.find(note => note.id === source.noteId) ?? { title: "", content: "" }) !== scriptSourceFingerprint(source.note))) throw new Error("Eine Quelle wurde inzwischen erneut geändert. Prüfe den aktuellen Stand.");
            return { ...current, scripts: current.scripts!.map(item => item.id === script.id ? { ...item, updatedAt: new Date().toISOString(), chapters: item.chapters.map(value => value.id === chapter.id ? acknowledgeChapterSources(value, current.notes) : value) } : item) };
          }, "Kapitel als geprüft markiert")}><Check size={14} />Nach Prüfung als aktuell markieren</Button>}</div>}
          <Markdown content={chapter.content || "Dieses Kapitel hat noch keinen Text."} />
          {!!states.length && <div className="script-sources"><h4>Fachnotizen zu diesem Kapitel</h4>{states.map(source => <div key={source.noteId}>{source.note ? <Button variant="link" onClick={async () => { if (await flush()) onOpenNote(source.noteId); }}>{source.note.title}</Button> : <span>Fehlende Fachnotiz: {source.noteId}</span>}<small>{({ current: "Stand übernommen", changed: "Geändert – prüfen", archived: "Archiviert – prüfen", missing: "Nicht mehr vorhanden" })[source.state]}</small></div>)}</div>}
          <div className="script-chapter-navigation"><Button variant="outline" disabled={saving || index === 0} onClick={() => void navigate(script.chapters[index - 1].id)}><ArrowLeft size={15} />Vorheriges Kapitel</Button><span>{index + 1} / {script.chapters.length}</span><Button disabled={saving || index === script.chapters.length - 1} onClick={() => void navigate(script.chapters[index + 1].id)}>Nächstes Kapitel<ArrowRight size={15} /></Button></div>
        </section>}
      </div>
    </div>
  </article>;
}

export function Scripts({ workspace, save, saving, query, selectedId, onSelect, onOpenNote }: Props) {
  const [editing, setEditing] = useState<Script | null>(null);
  const [status, setStatus] = useState("");
  const [topicId, setTopicId] = useState("");
  const selected = workspace.scripts?.find(script => script.id === selectedId);
  const scripts = searchScripts(workspace.scripts ?? [], query, workspace.topics).filter(script => (!status || script.status === status) && (!topicId || script.topicId === topicId));
  const proposal = researchScriptProposal(workspace);
  return <section className="scripts-workspace" aria-label="Skripte">
    {selected ? <ScriptReader key={selected.id} script={selected} workspace={workspace} save={save} saving={saving} onBack={() => onSelect(null)} onEdit={() => setEditing(selected)} onOpenNote={onOpenNote} /> : <>
      <div className="section-heading"><div><h2>Deine Skripte</h2><p>Wissen in einem roten Faden – mit Kapiteln, Beispielen und verknüpften Fachnotizen.</p></div><Button disabled={saving || (workspace.scripts?.length ?? 0) >= 100} onClick={() => setEditing(newScript(crypto.randomUUID()))}><Plus size={16} />Neues Skript</Button></div>
      {proposal && <div className="script-proposal"><BookOpen size={25} /><div><h3>Forschungsmethoden als zusammenhängendes Skript</h3><p>Aus deinen vorhandenen Fachnotizen: {proposal.chapters.length} Kapitel mit Einordnungen, Übergängen und Quellenverweisen.</p></div><Button variant="outline" disabled={saving || (workspace.scripts?.length ?? 0) >= 100} onClick={() => setEditing(proposal)}>Forschungsmethoden-Skript vorbereiten</Button></div>}
      <div className="script-filters"><label>Bearbeitungsstand<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Alle</option><option value="draft">Entwurf</option><option value="ready">Lesefassung</option></select></label><label>Fachthema<select value={topicId} onChange={event => setTopicId(event.target.value)}><option value="">Alle Themen</option>{flattenTopics(workspace.topics).map(({ topic }) => <option key={topic.id} value={topic.id}>{getTopicOptionLabel(workspace.topics, topic.id)}</option>)}</select></label></div>
      {!scripts.length && <p className="script-empty">{workspace.scripts?.length ? "Keine Skripte zu dieser Suche oder Filterauswahl." : "Lege dein erstes Skript an. Du kannst frei schreiben und Texte aus vorhandenen Fachnotizen übernehmen."}</p>}
      <div className="script-cards">{scripts.map(script => {
        const changed = script.chapters.filter(chapter => chapterSourceState(chapter, workspace.notes).some(source => source.state !== "current")).length;
        const position = script.readingPosition ? script.chapters.findIndex(chapter => chapter.id === script.readingPosition?.chapterId) : -1;
        return <article className="script-card" key={script.id}><span className="eyebrow"><FileText size={15} />{scriptStatusLabels[script.status]} · {script.chapters.length} Kapitel</span><h3><button onClick={() => onSelect(script.id)}>{script.title}</button></h3><p>{script.summary}</p>{script.topicId && <small>{getTopicPathLabel(workspace.topics, script.topicId)}</small>}{changed > 0 && <p className="script-source-warning">{changed} Kapitel: Quellenstand prüfen</p>}
          <div className="script-card-actions"><Button onClick={() => onSelect(script.id)}><BookOpen size={15} />{position >= 0 ? `Weiterlesen · Kapitel ${position + 1}` : "Skript lesen"}</Button><Button variant="ghost" disabled={saving} aria-label={script.title + " bearbeiten"} onClick={() => setEditing(script)}><Pencil size={16} /></Button><Button variant="ghost" disabled={saving} aria-label={script.title + " löschen"} onClick={async () => { if (window.confirm("Dieses Skript löschen? Die verknüpften Fachnotizen bleiben erhalten.")) await save(current => removeScript(current, script.id), "Skript gelöscht"); }}><Trash2 size={16} /></Button></div>
        </article>;
      })}</div>
    </>}
    {editing && <ScriptEditor key={editing.id} script={editing} workspace={workspace} save={save} saving={saving} onClose={() => setEditing(null)} onSaved={id => onSelect(id)} />}
  </section>;
}
