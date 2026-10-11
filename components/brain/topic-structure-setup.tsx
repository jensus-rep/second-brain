"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Workspace } from "@/lib/brain/model";
import type { SaveWorkspace } from "@/lib/brain/use-brain";
import { applyTopicStructure, proposeTopicStructure } from "@/lib/brain/curated-topic-structure";

export function TopicStructureSetup({ workspace, save, saving }: { workspace: Workspace; save: SaveWorkspace; saving: boolean }) {
  const [open, setOpen] = useState(false);
  const proposal = proposeTopicStructure(workspace);
  if (!proposal) return null;
  return <>
    <div className="collection-structure-hint"><GitBranch size={20} aria-hidden="true" /><div><strong>Fachthemen in Ebenen ordnen</strong><p>Für deinen Bestand ist eine Themenstruktur vorbereitet: Grundlagen, Vorgehensweisen und vertiefende Unterthemen.</p></div><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Themenstruktur prüfen</Button></div>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}><DialogContent className="topic-structure-dialog"><DialogHeader><DialogTitle>Themenstruktur übernehmen</DialogTitle><DialogDescription>Die Vorschau zeigt neue Hierarchien und die Zuordnung gemeinsamer Projektmanagement-Grundlagen. Eigene Elternzuordnungen, Inhalte und Lernfortschritte bleiben erhalten.</DialogDescription></DialogHeader>
      <div className="topic-structure-changes"><h3>{proposal.topicChanges.length} Themen einordnen</h3>{proposal.topicChanges.map(change => <article key={change.id}><strong>{change.title}</strong><span>Bisher: {change.before}</span><span>Neu: {change.after}</span></article>)}
        {!!proposal.noteChanges.length && <><h3>{proposal.noteChanges.length} Notizen zu gemeinsamen Grundlagen</h3>{proposal.noteChanges.map(change => <article key={change.id}><strong>{change.title}</strong><span>Bisher: {change.before}</span><span>Neu: {change.after}</span></article>)}</>}
      </div>
      <p className="small-note">Die Struktur ordnet den Lernstoff. Querschnittsthemen können mehrere Ansätze betreffen. Self-Supervised Learning wird zur Orientierung separat gezeigt; die Trainingsziele entstehen aus den Daten selbst. Weitere Lernformen können als Unterthemen ergänzt werden.</p>
      <div className="dialog-actions"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Abbrechen</Button><Button disabled={saving} onClick={async () => { if (await save(applyTopicStructure, "Themenstruktur gespeichert")) setOpen(false); }}>Struktur übernehmen</Button></div>
    </DialogContent></Dialog>
  </>;
}
