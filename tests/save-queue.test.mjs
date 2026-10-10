import test from "node:test";
import assert from "node:assert/strict";
import { createSaveQueue } from "../lib/brain/save-queue.ts";

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test("queued writes execute against the last confirmed revision without overlap", async () => {
  const first = deferred();
  const requests = [];
  const busyStates = [];
  let revision = 5;
  let answers = [];
  let active = 0;
  const queue = createSaveQueue(async answer => {
    active++;
    assert.equal(active, 1);
    requests.push({ answer, revision, answers: [...answers] });
    if (answer === "first") await first.promise;
    answers.push(answer);
    revision++;
    active--;
    return true;
  }, busy => busyStates.push(busy));
  const savedFirst = queue.enqueue("first", { queue: true });
  const savedSecond = queue.enqueue("second", { queue: true });
  const savedThird = queue.enqueue("third", { queue: true });
  assert.equal(queue.busy, true);
  assert.deepEqual(requests, [{ answer: "first", revision: 5, answers: [] }]);
  first.resolve();
  assert.deepEqual(await Promise.all([savedFirst, savedSecond, savedThird]), [true, true, true]);
  assert.deepEqual(requests, [
    { answer: "first", revision: 5, answers: [] },
    { answer: "second", revision: 6, answers: ["first"] },
    { answer: "third", revision: 7, answers: ["first", "second"] },
  ]);
  assert.deepEqual(busyStates, [true, false]);
  assert.equal(queue.busy, false);
});

test("ordinary writes remain blocked while a queued write is active", async () => {
  const request = deferred();
  const calls = [];
  const queue = createSaveQueue(async operation => { calls.push(operation); return request.promise; }, () => {});
  const saved = queue.enqueue("answer");
  assert.equal(await queue.enqueue("unrelated edit"), false);
  assert.deepEqual(calls, ["answer"]);
  request.resolve(true);
  assert.equal(await saved, true);
});

for (const failure of ["network error", "revision conflict"]) {
  test(`${failure} cancels waiting writes until an explicit retry`, async () => {
    const first = deferred();
    const calls = [];
    let retrying = false;
    const queue = createSaveQueue(async operation => {
      calls.push(operation);
      return retrying ? true : first.promise;
    }, () => {});
    const saves = [queue.enqueue("first", { queue: true }), queue.enqueue("second", { queue: true }), queue.enqueue("finish", { queue: true })];
    first.resolve(false);
    assert.deepEqual(await Promise.all(saves), [false, false, false]);
    assert.deepEqual(calls, ["first"]);
    assert.equal(queue.busy, false);
    retrying = true;
    assert.equal(await queue.enqueue("first", { queue: true }), true);
    assert.equal(await queue.enqueue("second", { queue: true }), true);
    assert.deepEqual(calls, ["first", "first", "second"]);
  });
}

test("an unexpected rejection also cancels waiting writes and releases the queue", async () => {
  const failure = deferred();
  const calls = [];
  const queue = createSaveQueue(async operation => {
    calls.push(operation);
    await failure.promise;
    throw new Error("Unexpected failure");
  }, () => {});
  const first = queue.enqueue("first", { queue: true });
  const second = queue.enqueue("second", { queue: true });
  failure.resolve();
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.deepEqual(calls, ["first"]);
  assert.equal(queue.busy, false);
});
