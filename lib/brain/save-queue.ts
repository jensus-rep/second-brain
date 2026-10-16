export type SaveOptions = { queue?: boolean };

/**
 * Run revision-bound writes in order; a failed write cancels its waiting successors.
 * With `runBatch`, writes that queued up behind an active write are sent together.
 * It reports one result per operation; a failed operation cancels the ones after it.
 */
export function createSaveQueue<Operation>(run: (operation: Operation) => Promise<boolean>, onBusyChange: (busy: boolean) => void, runBatch?: (operations: Operation[]) => Promise<boolean[]>) {
  const waiting: { operation: Operation; resolve: (saved: boolean) => void }[] = [];
  let busy = false;

  async function drain() {
    try {
      while (waiting.length) {
        const batch = runBatch && waiting.length > 1 ? waiting.splice(0) : [waiting.shift()!];
        let results: boolean[] = [];
        try { results = batch.length > 1 ? await runBatch!(batch.map(item => item.operation)) : [await run(batch[0].operation)]; }
        catch { results = []; }
        const saved = batch.every((_, index) => results[index] === true);
        // Resolve cancelled operations before yielding to callers. They must
        // explicitly retry after a network error or review a revision conflict.
        if (!saved) for (const pending of waiting.splice(0)) pending.resolve(false);
        batch.forEach((item, index) => item.resolve(saved || results[index] === true));
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
