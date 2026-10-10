export type SaveOptions = { queue?: boolean };

/** Run revision-bound writes in order; a failed write cancels its waiting successors. */
export function createSaveQueue<Operation>(run: (operation: Operation) => Promise<boolean>, onBusyChange: (busy: boolean) => void) {
  const waiting: { operation: Operation; resolve: (saved: boolean) => void }[] = [];
  let busy = false;

  async function drain() {
    try {
      while (waiting.length) {
        const next = waiting.shift()!;
        let saved = false;
        try { saved = await run(next.operation); }
        catch { saved = false; }
        finally {
          // Resolve cancelled operations before yielding to callers. They must
          // explicitly retry after a network error or review a revision conflict.
          if (!saved) for (const pending of waiting.splice(0)) pending.resolve(false);
          next.resolve(saved);
        }
        if (!saved) break;
      }
    } finally {
      busy = false;
      onBusyChange(false);
    }
  }

  return {
    get busy() { return busy; },
    enqueue(operation: Operation, options: SaveOptions = {}): Promise<boolean> {
      if (busy && !options.queue) return Promise.resolve(false);
      return new Promise(resolve => {
        waiting.push({ operation, resolve });
        if (!busy) {
          busy = true;
          onBusyChange(true);
          void drain();
        }
      });
    },
  };
}
