import type { FlashcardSession, Workspace } from "./model.ts";
import { collectionItems, learningCollections } from "./learning-collections.ts";

const MAX_PAUSED_SESSIONS = 100;

export function flashcardSessionForCollection(workspace: Workspace, collectionId: string | null): FlashcardSession | null {
  if (workspace.flashcardSession?.collectionId === collectionId) return workspace.flashcardSession;
  return workspace.pausedFlashcardSessions?.find(session => session.collectionId === collectionId) ?? null;
}

// Only the selected deck becomes active. Other rounds keep their original
// queue snapshots, so returning to a deck preserves its saved position.
export function activateFlashcardSession(workspace: Workspace, session: FlashcardSession): Workspace {
  const previous = workspace.flashcardSession;
  if (previous && previous.id === session.id && previous.collectionId !== session.collectionId) {
    throw new Error("Eine Kartenrunde kann nicht zu einer anderen Lernsammlung verschoben werden.");
  }
  let paused = (workspace.pausedFlashcardSessions ?? []).filter(item => item.collectionId !== session.collectionId);
  if (previous && previous.collectionId !== session.collectionId && previous.index < previous.queue.length) {
    paused = paused.filter(item => item.collectionId !== previous.collectionId);
    paused = [...paused, previous];
  }
  if (paused.length > MAX_PAUSED_SESSIONS) {
    throw new Error("Es sind bereits 100 Kartenrunden pausiert. Schließe zuerst eine gespeicherte Runde ab.");
  }
  const sessions = [...paused, session];
  if (new Set(sessions.map(item => item.id)).size !== sessions.length || new Set(sessions.map(item => item.collectionId)).size !== sessions.length) {
    throw new Error("Die gespeicherten Kartenrunden sind nicht eindeutig. Bitte lade den aktuellen Lernstand neu.");
  }
  return {
    ...workspace,
    flashcardSession: session,
    ...(paused.length || workspace.pausedFlashcardSessions !== undefined ? { pausedFlashcardSessions: paused } : {}),
  };
}

export function resumableDeckSession(workspace: Workspace, collectionId: string | null, now: Date): FlashcardSession | null {
  const session = flashcardSessionForCollection(workspace, collectionId);
  if (!session) return null;
  const collection = collectionId === null ? null : learningCollections(workspace).find(item => item.id === collectionId);
  // A missing deck is never permission to expand its scope to every card.
  if (collectionId !== null && !collection) return null;
  const cards = new Map((collection ? collectionItems(workspace, collection).cards : workspace.cards).map(card => [card.id, card]));
  let index = session.index;
  while (index < session.queue.length) {
    const entry = session.queue[index];
    const card = cards.get(entry.id);
    if (card && card.reviews === entry.reviews && card.dueAt === entry.dueAt) break;
    index++;
  }
  return index < session.queue.length ? { ...session, index, updatedAt: now.toISOString() } : null;
}
