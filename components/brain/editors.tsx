"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, X, ChevronUp, ChevronDown, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "./markdown";
import { normalizeTags, type Note, type Topic, type LearningPath, type Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function useUnsaved(dirty: boolean) {
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
}
function closeIfSafe(dirty: boolean, close: () => void) {
  if (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?")) close();
}

export function NoteEditor({ note, workspace, save, saving, onClose }: {
  note: Note; workspace: Workspace; save: SaveWorkspace; saving: boolean; onClose: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [linkQuery, setLinkQuery] = useState("");
  const dirty = JSON.stringify(note) !== JSON.stringify(draft) || tags !== note.tags.join(", ");
  useUnsaved(dirty);
  const change = <K extends keyof Note>(key: K, value: Note[K]) => setDraft(d => ({ ...d, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const updated = { ...draft, title: draft.title.trim(), tags: normalizeTags(tags), updatedAt: new Date().toISOString() };
    const ok = await save(w => ({ ...w, notes: w.notes.some(n => n.id === note.id) ? w.notes.map(n => n.id === note.id ? updated : n) : [...w.notes, updated] }), "Notiz gespeichert");
    if (ok) onClose();
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) closeIfSafe(dirty, onClose); }}>
    <DialogContent className="editor-dialog" onInteractOutside={e => e.preventDefault()}>
      <DialogHeader><DialogTitle>{workspace.notes.some(n => n.id === note.id) ? "Notiz bearbeiten" : "Ein neuer Gedanke"}</DialogTitle><DialogDescription>Halte fest, was du verstehen und behalten möchtest.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="editor-form" inert={saving} aria-busy={saving}>
        <Field label="Titel"><Input value={draft.title} onChange={e => change("title", e.target.value)} placeholder="Was möchtest du festhalten?" required maxLength={160} autoFocus /></Field>
        <div className="form-columns">
          <Field label="Thema"><Select value={draft.topicId ?? "none"} onValueChange={v => change("topicId", v === "none" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Noch nicht zugeordnet</SelectItem>{workspace.topics.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Tags" hint="Mit Komma trennen"><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="z. B. ideen, schreiben" maxLength={800} /></Field>
        </div>
        <Field label="Kurzbeschreibung"><Textarea value={draft.summary} onChange={e => change("summary", e.target.value)} placeholder="Die wichtigste Idee in einem Satz." maxLength={600} rows={2} /></Field>
        <Tabs defaultValue="edit"><TabsList aria-label="Inhaltsansicht"><TabsTrigger value="edit">Schreiben</TabsTrigger><TabsTrigger value="preview">Vorschau</TabsTrigger></TabsList>
          <TabsContent value="edit"><Field label="Inhalt" hint="Markdown: ## Überschrift · **fett** · - Aufzählung · [Quelle](https://…)"><Textarea className="markdown-input" value={draft.content} onChange={e => change("content", e.target.value)} placeholder="Deine Gedanken, Beispiele und Quellen …" maxLength={80000} rows={10} /></Field></TabsContent>
          <TabsContent value="preview"><div className="markdown-preview"><Markdown content={draft.content || "Deine Vorschau erscheint hier."} /></div></TabsContent>
        </Tabs>
        <fieldset className="link-picker"><legend>Verknüpfte Notizen</legend><Input aria-label="Verknüpfbare Notizen filtern" value={linkQuery} onChange={e => setLinkQuery(e.target.value)} placeholder="Notizen finden …" /><div className="checkbox-list">{workspace.notes.filter(n => n.id !== note.id && (!n.archived || draft.relatedIds.includes(n.id)) && n.title.toLowerCase().includes(linkQuery.toLowerCase())).map(n => <label key={n.id}><Checkbox checked={draft.relatedIds.includes(n.id)} onCheckedChange={checked => change("relatedIds", checked ? [...draft.relatedIds, n.id] : draft.relatedIds.filter(id => id !== n.id))} /><span>{n.title}{n.archived ? " (archiviert)" : ""}</span></label>)}</div></fieldset>
        <div className="dialog-actions"><Button type="button" variant="outline" disabled={saving} onClick={() => closeIfSafe(dirty, onClose)}>Abbrechen</Button><Button type="submit" disabled={saving || !draft.title.trim()}><Save size={16} />{saving ? "Wird gespeichert …" : "Notiz speichern"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function TopicEditor({ topic, save, saving, onClose }: { topic: Topic; save: SaveWorkspace; saving: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(topic);
  const dirty = JSON.stringify(topic) !== JSON.stringify(draft);
  useUnsaved(dirty);
  return <Dialog open onOpenChange={open => { if (!open && !saving) closeIfSafe(dirty, onClose); }}><DialogContent><DialogHeader><DialogTitle>Dein Themenraum</DialogTitle><DialogDescription>Gib zusammengehörenden Gedanken einen Ort.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={saving} aria-busy={saving} onSubmit={async e => { e.preventDefault(); if (await save(w => ({ ...w, topics: w.topics.some(t => t.id === draft.id) ? w.topics.map(t => t.id === draft.id ? draft : t) : [...w.topics, draft] }), "Thema gespeichert")) onClose(); }}>
      <Field label="Name"><Input required autoFocus maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="Beschreibung"><Textarea maxLength={600} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
      <Field label="Farbe"><Select value={draft.color} onValueChange={color => setDraft({ ...draft, color: color as Topic["color"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[["blue", "Blau"], ["purple", "Violett"], ["orange", "Orange"], ["green", "Grün"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
      <div className="dialog-actions"><Button variant="outline" type="button" disabled={saving} onClick={() => closeIfSafe(dirty, onClose)}>Abbrechen</Button><Button disabled={saving || !draft.title.trim()} type="submit">Thema speichern</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function PathEditor({ path, workspace, save, saving, onClose }: { path: LearningPath; workspace: Workspace; save: SaveWorkspace; saving: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(path);
  const [query, setQuery] = useState("");
  const dirty = JSON.stringify(path) !== JSON.stringify(draft);
  useUnsaved(dirty);
  function move(index: number, direction: number) {
    const steps = [...draft.steps];
    [steps[index], steps[index + direction]] = [steps[index + direction], steps[index]];
    setDraft({ ...draft, steps });
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) closeIfSafe(dirty, onClose); }}><DialogContent className="editor-dialog" onInteractOutside={e => e.preventDefault()}><DialogHeader><DialogTitle>Lernpfad gestalten</DialogTitle><DialogDescription>Verbinde deine Notizen zu einem Weg mit einem klaren Ziel.</DialogDescription></DialogHeader>
    <form className="editor-form" inert={saving} aria-busy={saving} onSubmit={async e => {
      e.preventDefault();
      const removed = path.steps.filter(s => !draft.steps.some(d => d.id === s.id)).map(s => s.id);
      if (await save(w => ({ ...w, paths: w.paths.some(p => p.id === draft.id) ? w.paths.map(p => p.id === draft.id ? draft : p) : [...w.paths, draft], completedStepIds: w.completedStepIds.filter(id => !removed.includes(id)) }), "Lernpfad gespeichert")) onClose();
    }}>
      <Field label="Titel"><Input required autoFocus value={draft.title} maxLength={160} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="Dein Lernziel"><Textarea value={draft.description} maxLength={600} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Was möchtest du anschließend können?" /></Field>
      <div className="path-editor-steps">{draft.steps.map((s, i) => <div className="path-editor-step" key={s.id}><span className="step-number">{i + 1}</span><div><strong>{workspace.notes.find(n => n.id === s.noteId)?.title}</strong><Input aria-label={"Aufgabe für Schritt " + (i + 1)} maxLength={300} placeholder="Eine konkrete Aufgabe …" value={s.objective} onChange={e => setDraft({ ...draft, steps: draft.steps.map(st => st.id === s.id ? { ...st, objective: e.target.value } : st) })} /></div><div className="step-actions"><Button type="button" variant="ghost" size="icon" aria-label="Schritt nach oben" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={16} /></Button><Button type="button" variant="ghost" size="icon" aria-label="Schritt nach unten" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}><ChevronDown size={16} /></Button><Button type="button" variant="ghost" size="icon" aria-label="Schritt entfernen" onClick={() => setDraft({ ...draft, steps: draft.steps.filter(st => st.id !== s.id) })}><X size={16} /></Button></div></div>)}</div>
      <Field label="Notizen hinzufügen"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Notiz suchen …" /></Field>
      <div className="note-picker">{workspace.notes.filter(n => !n.archived && n.title.toLowerCase().includes(query.toLowerCase()) && !draft.steps.some(s => s.noteId === n.id)).map(n => <button type="button" key={n.id} onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: crypto.randomUUID(), noteId: n.id, objective: "" }] })}><Plus size={16} />{n.title}</button>)}</div>
      <div className="dialog-actions"><Button variant="outline" type="button" disabled={saving} onClick={() => closeIfSafe(dirty, onClose)}>Abbrechen</Button><Button disabled={saving || !draft.title.trim() || draft.steps.length === 0} type="submit">Lernpfad speichern</Button></div>
    </form>
  </DialogContent></Dialog>;
}
