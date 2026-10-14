import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { referenceAnswerComparison } from "../lib/brain/answer-comparison.ts";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Flashcard tests may only change localhost.");
const sqlitePath = resolve(process.env.BRAIN_TEST_SQLITE_PATH ?? process.env.NEWHOPE_SQLITE_PATH ?? ".data/newhope.sqlite");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
let held;
let heldComparison;
const comparisonRequests = [];
const referenceComparison = body => referenceAnswerComparison(body, cards.find(card => card.id === body.cardId).answer);
const shortComparison = body => ({ ...referenceComparison(body), source: "llm", verdict: "partial",
  summary: "Deine Erklärung enthält die eigene Anwendung. Für die ganze Antwort fehlt noch ein Zusammenhang.",
  matched: ["Du nennst ein eigenes Praxisbeispiel."], missing: ["Verbinde das Beispiel noch mit aktivem Erinnern."],
});
let comparisonHandler = async (route, body) => route.fulfill({ json: referenceComparison(body) });
await page.route(origin + "/api/tutor/compare", async route => {
  assert.equal(route.request().method(), "POST");
  const body = route.request().postDataJSON();
  comparisonRequests.push(body);
  await comparisonHandler(route, body);
});

async function snapshot() {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200);
  return response.json();
}

async function write(workspace) {
  const current = await snapshot();
  assert.equal((await realpath(sqlitePath)).toLowerCase(), sqlitePath.toLowerCase());
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT body, revision FROM newhope_workspaces WHERE owner_id = ?").get("local_dev");
    assert.equal(row.revision, current.revision, "API and local SQLite must match before writes.");
    const stored = JSON.parse(row.body);
    for (const key of ["cards", "quizQuestions", "quizRuns", "learningReminders", "learningCollections"]) stored[key] ??= [];
    assert.deepEqual(stored, current.workspace);
  } finally { db.close(); }
  const response = await page.request.put(origin + "/api/brain", { data: { workspace, revision: current.revision } });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}

const dueAt = new Date(Date.now() - 60000).toISOString();
const cards = [
  {
    id: "compact-choices", question: "Welche Aussagen helfen beim Lernen? Mehrere Antworten sind möglich.\n\n- **A:** Ein konkretes Beispiel verbindet Wissen mit einer Handlung.\n- **B:** Zusammenhänge lassen sich durch bloßes Wiederlesen immer sicher anwenden.\n- **C:** Eine Erklärung in eigenen Worten prüft das Verständnis.\n- **D:** Mit `aktiver Wiederholung` wird der Gedanke aus dem Gedächtnis abgerufen.",
    answer: "**Richtig: A, C und D.**\n\nB ist falsch: Das Anwenden braucht auch eigene Beispiele.",
  },
  { id: "next-question", question: "Wie lässt sich ein Gedanke auf eine neue Situation übertragen?", answer: "Ein passendes Beispiel suchen und die Zusammenhänge erklären.\n\n" + "Ein eigener Gedanke bleibt durch aktives Wiederholen leichter im Gedächtnis. ".repeat(80) },
  { id: "last-question", question: "Welche Schritte unterstützen die Wiederholung?\n\n1. Eine Frage lesen.\n2. Die Antwort aus dem Gedächtnis erklären.\n3. Die eigene Antwort prüfen.", answer: "Die eigene Erinnerung prüfen und die nächste Wiederholung planen." },
].map(card => ({ ...card, noteId: null, reviews: 0, intervalDays: 0, dueAt, priority: 1 }));
// IDs determine the due-card order when timestamps match.
cards[1].dueAt = new Date(Date.parse(dueAt) + 1).toISOString();
cards[2].dueAt = new Date(Date.parse(dueAt) + 2).toISOString();
const fixture = { schemaVersion: 1, topics: [], notes: [], paths: [], completedStepIds: [], cards, quizQuestions: [], quizRuns: [], learningReminders: [], learningCollections: [] };

async function start(workspace = fixture) {
  await write(workspace);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lernkarten", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
}

const reveal = () => page.getByRole("button", { name: "Antwort aufdecken", exact: true });
const rating = known => page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: known ? /^Gewusst/ : /^Noch üben/ });

// The request stays blocked until assertions prove that the current card stays stable.
async function holdWrite(status = 200) {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  await page.route(origin + "/api/brain", async route => {
    assert.equal(route.request().method(), "PUT");
    arrived(route.request().postDataJSON());
    await gate;
    if (status === 503) await route.fulfill({ status, json: { error: "Speichern nicht möglich. Bitte versuche es erneut." } });
    else await route.fulfill({ response: await route.fetch() });
    finished();
  }, { times: 1 });
  held = { request, done, release };
  return held;
}

async function finishWrite() {
  held.release();
  await held.done;
  held = null;
  await expect(page.locator(".save-state")).toHaveText("Gespeichert");
}

async function holdComparison() {
  let release, arrived, finished;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  comparisonHandler = async (route, body) => {
    comparisonHandler = async (nextRoute, nextBody) => nextRoute.fulfill({ json: referenceComparison(nextBody) });
    arrived(body);
    await gate;
    try { await route.fulfill({ json: shortComparison(body) }); }
    catch (error) { if (!/aborted|Invalid Interception|Target.*closed|Request.*finished/i.test(error.message)) throw error; }
    finally { finished(); }
  };
  heldComparison = { request, done, release };
  return heldComparison;
}

try {
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible();
  initial = (await snapshot()).workspace;

  console.log("Checking the local comparison endpoint and revision/origin protection");
  await start();
  const endpointSnapshot = await snapshot();
  const endpointInput = { revision: endpointSnapshot.revision, sessionId: endpointSnapshot.workspace.flashcardSession.id, cardId: cards[0].id, response: "Ein eigenes Beispiel hilft mir beim Erinnern." };
  const endpointReply = await page.request.post(origin + "/api/tutor/compare", { headers: { Origin: origin }, data: endpointInput });
  assert.equal(endpointReply.status(), 200, await endpointReply.text());
  const endpointResult = await endpointReply.json();
  assert.equal(endpointResult.cardId, cards[0].id);
  assert.equal(endpointResult.revision, endpointSnapshot.revision);
  assert.equal(endpointResult.source, "reference", "The unconfigured isolated local server returns an honest reference.");
  assert.equal(endpointResult.verdict, "reference");
  assert.equal((await snapshot()).revision, endpointSnapshot.revision, "A comparison reads the workspace without changing progress.");
  const outdatedReply = await page.request.post(origin + "/api/tutor/compare", { headers: { Origin: origin }, data: { ...endpointInput, revision: endpointInput.revision - 1 } });
  assert.equal(outdatedReply.status(), 409);
  const foreignReply = await page.request.post(origin + "/api/tutor/compare", { headers: { Origin: "https://example.invalid" }, data: endpointInput });
  assert.equal(foreignReply.status(), 403);

  console.log("Checking preparation during a writing pause and reuse on reveal");
  comparisonHandler = async (route, body) => route.fulfill({ json: shortComparison(body) });
  await start();
  const preparedRequestCount = comparisonRequests.length;
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Ein eigenes Beispiel hilft beim aktiven Erinnern.");
  await expect.poll(() => comparisonRequests.length).toBe(preparedRequestCount + 1);
  await expect(page.locator(".study-answer")).toHaveCount(0);
  await reveal().click();
  await expect(page.locator(".study-answer-comparison")).toHaveAttribute("data-source", "llm");
  assert.equal(comparisonRequests.length, preparedRequestCount + 1, "Revealing a prepared comparison must not start another request");

  await start();
  await holdComparison();
  const pendingRequestCount = comparisonRequests.length;
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Diese Erklärung wird bereits vor dem Aufdecken vorbereitet.");
  await heldComparison.request;
  await reveal().click();
  await expect(page.locator(".study-answer-comparison")).toHaveAttribute("aria-busy", "true");
  assert.equal(comparisonRequests.length, pendingRequestCount + 1, "Reveal must preserve the running comparison");
  heldComparison.release();
  await heldComparison.done;
  heldComparison = null;
  await expect(page.locator(".study-answer-comparison")).toHaveAttribute("data-source", "llm");

  console.log("Checking edits after preparation and the speculative request budget");
  await start();
  await holdComparison();
  const editedRequestCount = comparisonRequests.length;
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Ein erster Entwurf, der noch verändert wird.");
  await heldComparison.request;
  const finalResponse = "Mein endgültiges Beispiel erklärt den Zusammenhang mit aktivem Erinnern.";
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill(finalResponse);
  heldComparison.release();
  await heldComparison.done;
  heldComparison = null;
  await page.waitForTimeout(1400);
  assert.equal(comparisonRequests.length, editedRequestCount + 1, "Only one speculative draft per card is compared");
  await expect(page.locator(".study-answer")).toHaveCount(0);
  comparisonHandler = async (route, body) => route.fulfill({ json: shortComparison(body) });
  await reveal().click();
  await expect(page.locator(".study-answer-comparison")).toHaveAttribute("data-source", "llm");
  assert.equal(comparisonRequests.length, editedRequestCount + 2);
  assert.equal(comparisonRequests.at(-1).response, finalResponse);

  console.log("Checking concise own-answer comparison and its manual rating");
  comparisonHandler = async (route, body) => route.fulfill({ json: shortComparison(body) });
  await page.setViewportSize({ width: 320, height: 844 });
  await start();
  const comparisonResponse = "Mein eigenes Beispiel macht den Gedanken auf eine neue Situation anwendbar.";
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("  " + comparisonResponse + "  ");
  const beforeComparison = await snapshot();
  await reveal().click();
  const comparison = page.locator(".study-answer-comparison");
  await expect(comparison).toHaveAttribute("data-source", "llm");
  const comparisonRequest = comparisonRequests.at(-1);
  assert.deepEqual(comparisonRequest, { revision: beforeComparison.revision, sessionId: beforeComparison.workspace.flashcardSession.id, cardId: cards[0].id, response: comparisonResponse });
  await expect(comparison).toContainText("Das passt schon:");
  await expect(comparison).toContainText("Das fehlt noch:");
  await expect(comparison).toContainText("Musterantwort in Kürze");
  await expect(comparison).toContainText("Richtig: A, C und D.");
  await expect(comparison.locator(".prose-brain")).toHaveCount(0);
  await page.getByRole("button", { name: "Vollständige Musterantwort", exact: true }).click();
  await expect(comparison.locator(".prose-brain strong")).toHaveText("Richtig: A, C und D.");
  await expect(rating(false)).toBeEnabled();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await rating(false).click();
  await expect(page.locator(".study-topline")).toContainText("2 von 3");
  const comparedReview = (await snapshot()).workspace.cardReviewEvents.at(-1);
  assert.equal(comparedReview.response, comparisonResponse);
  assert.equal(comparedReview.comparison.source, "llm");
  assert.equal(comparedReview.comparison.verdict, "partial");
  assert.equal(comparedReview.known, false, "The user's choice determines the review, independently of the comparison verdict.");
  assert.equal((await snapshot()).workspace.cards[0].intervalDays, 0);

  console.log("Checking comparison failure, empty answers and stale completion");
  comparisonHandler = async route => route.fulfill({ status: 503, json: { error: "Kurzvergleich nicht erreichbar." } });
  await start();
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Eine Erklärung mit einem Beispiel hilft beim Erinnern.");
  await reveal().click();
  await expect(comparison).toHaveAttribute("aria-busy", "false");
  await expect(comparison).toHaveAttribute("data-source", "reference");
  await expect(comparison).toHaveAttribute("data-verdict", "reference");
  await expect(comparison).toContainText("Der kurze Vergleich ist gerade nicht verfügbar.");
  await expect(comparison).not.toContainText("Das passt schon:");
  await expect(comparison).not.toContainText("Das fehlt noch:");
  await expect(rating(true)).toBeEnabled();
  await rating(true).click();
  await expect(page.locator(".study-topline")).toContainText("2 von 3");
  assert.equal((await snapshot()).workspace.cardReviewEvents.at(-1).comparison.source, "reference");

  console.log("Checking recovery without re-entering the answer or restarting the card");
  await start();
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Ein Praxisbeispiel hilft mir beim aktiven Erinnern.");
  await reveal().click();
  await expect(comparison).toHaveAttribute("aria-busy", "false");
  await expect(comparison).toHaveAttribute("data-source", "reference");
  comparisonHandler = async (route, body) => route.fulfill({ json: shortComparison(body) });
  const retryRevision = (await snapshot()).revision;
  await page.getByRole("button", { name: "Vergleich erneut versuchen", exact: true }).click();
  await expect(comparison).toHaveAttribute("data-source", "llm");
  await expect(page.locator(".study-topline")).toContainText("1 von 3");
  assert.equal((await snapshot()).revision, retryRevision, "Retrying does not save or rate the card");
  await rating(false).click();
  await expect(page.locator(".study-topline")).toContainText("2 von 3");
  assert.equal((await snapshot()).workspace.cardReviewEvents.at(-1).comparison.source, "llm");

  comparisonHandler = async (route, body) => route.fulfill({ json: { ...shortComparison(body), revision: body.revision + 1, summary: "Dieser fremde Vergleich darf nicht erscheinen." } });
  await start();
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Diese eigene Erklärung gehört zur aktuellen Revision.");
  await reveal().click();
  await expect(comparison).toHaveAttribute("aria-busy", "false");
  await expect(comparison).toHaveAttribute("data-source", "reference");
  await expect(comparison).not.toContainText("Dieser fremde Vergleich darf nicht erscheinen.");
  await expect(rating(true)).toBeEnabled();

  await start();
  const requestsBeforeEmpty = comparisonRequests.length;
  await reveal().click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(comparison).toHaveCount(0);
  await expect(page.locator(".study-answer .prose-brain strong")).toHaveText("Richtig: A, C und D.");
  assert.equal(comparisonRequests.length, requestsBeforeEmpty, "An empty own answer does not issue a comparison request.");

  await start();
  await page.getByLabel("Deine Antwort in eigenen Worten", { exact: true }).fill("Diese Antwort wird vor dem verspäteten Vergleich selbst bewertet.");
  await holdComparison();
  await reveal().click();
  await heldComparison.request;
  await expect(comparison).toHaveAttribute("aria-busy", "true");
  await expect(rating(true)).toBeEnabled();
  await rating(true).click();
  await expect(page.locator(".study-topline")).toContainText("2 von 3");
  await expect(comparison).toHaveCount(0);
  heldComparison.release();
  await heldComparison.done;
  heldComparison = null;
  await reveal().click();
  await expect(comparison).toHaveCount(0);
  assert.equal((await snapshot()).workspace.cardReviewEvents.at(-1).comparison.source, "reference", "Late comparison must not replace the reference captured with the manual rating.");
  await expect(page.locator(".study-answer")).not.toContainText("Deine Erklärung enthält die eigene Anwendung.");
  comparisonHandler = async (route, body) => route.fulfill({ json: referenceComparison(body) });

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await start();
    const options = page.locator(".study-question .prose-brain > ul");
    await expect(options.locator("li")).toHaveCount(4);
    const styles = await options.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), align: getComputedStyle(el).textAlign, weight: getComputedStyle(el).fontWeight }));
    assert.ok(styles.font <= 16, "Answer choices use compact text on desktop and mobile.");
    assert.equal(styles.align, "left");
    assert.equal(styles.weight, "400");
    await expect(options.locator("strong")).toHaveText(["A:", "B:", "C:", "D:"]);
    await expect(options.locator("code")).toHaveText("aktiver Wiederholung");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `.sites-runtime/qa/flashcards-choices-${width}.png`, fullPage: true });
    const responseField = page.getByLabel("Deine Antwort in eigenen Worten", { exact: true });
    const ownResponse = "Ein Praxisbeispiel und eine eigene Erklärung helfen beim aktiven Erinnern.";
    await responseField.fill(ownResponse);
    await reveal().click();
    if (width < 768) await expect.poll(async () => {
      const bounds = await page.locator(".study-rating").boundingBox();
      return bounds && Math.abs(bounds.y + bounds.height - page.viewportSize().height) < 1;
    }).toBe(true, { message: "The mobile rating bar stays fixed to the viewport during the answer animation." });

    await holdWrite();
    const currentQuestion = await page.locator(".study-question").textContent();
    const currentCard = await page.locator(".study-card").elementHandle();
    // Two clicks in one event turn must still issue one review.
    await rating(true).evaluate(button => { button.click(); button.click(); });
    const submitted = await held.request;
    assert.equal(submitted.workspace.cards[0].reviews, 1);
    await expect(page.locator(".study-topline")).toContainText("1 von 3", { timeout: 1000 });
    await expect(page.locator(".study-question")).toHaveText(currentQuestion);
    await expect(page.locator(".study-answer")).toBeVisible();
    await expect(responseField).toHaveValue(ownResponse);
    assert.equal(await currentCard.evaluate(element => element.isConnected), true, "Pending saves retain the same card element.");
    await expect(reveal()).toHaveCount(0);
    await expect(page.locator(".study-save-status")).toBeVisible();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 0, "The rating is still awaiting confirmation from the server.");
    await expect(rating(true)).toBeDisabled();
    await expect(rating(false)).toBeDisabled();
    await finishWrite();
    await expect(page.locator(".study-topline")).toContainText("2 von 3");
    await expect(page.locator(".study-question")).toHaveText(cards[1].question);
    await expect(page.locator(".study-question")).toBeInViewport();
    await expect(responseField).toHaveValue("");
    await expect(reveal()).toBeFocused();
    await reveal().click();
    await expect(rating(false)).toBeEnabled();

    await holdWrite();
    await rating(false).click();
    await held.request;
    await expect(page.locator(".study-topline")).toContainText("2 von 3", { timeout: 1000 });
    await expect(page.locator(".study-question")).toHaveText(cards[1].question);
    await expect(page.locator(".study-answer")).toBeVisible();
    await finishWrite();
    await expect(page.locator(".study-topline")).toContainText("3 von 3");
    await expect(page.locator(".study-question")).toBeInViewport();
    assert.equal(await page.locator(".study-question ol").evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 16);
    await reveal().click();
    await holdWrite();
    await rating(true).click();
    await held.request;
    await expect(page.locator(".study-topline")).toContainText("3 von 3");
    await expect(page.locator(".study-question")).toContainText("Welche Schritte unterstützen die Wiederholung?");
    await expect(page.locator(".study-answer")).toBeVisible();
    await expect(page.locator(".study-save-status")).toBeVisible();
    await expect(page.locator(".study-finished")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Zur Kartenübersicht", exact: true })).toHaveCount(0);
    await finishWrite();
    await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    const saved = (await snapshot()).workspace.cards;
    assert.deepEqual(saved.map(card => card.reviews), [1, 1, 1]);
    assert.deepEqual(saved.map(card => card.intervalDays), [1, 0, 1]);
    assert.ok(Math.abs(Date.parse(saved[1].dueAt) - Date.now() - 600000) < 15000, "Unknown answer schedules another review in ten minutes.");
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const final of [false, true]) {
    await start(final ? { ...fixture, cards: [cards[0]] } : fixture);
    const responseField = page.getByLabel("Deine Antwort in eigenen Worten", { exact: true });
    await responseField.fill("Diese eigene Erklärung bleibt bei einem fehlgeschlagenen Speichern erhalten.");
    await reveal().click();
    const currentCard = await page.locator(".study-card").elementHandle();
    const questionText = await page.locator(".study-question").textContent();
    await holdWrite(503);
    await rating(false).click();
    await held.request;
    await expect(page.locator(".study-save-status")).toBeVisible();
    await expect(page.locator(".study-finished")).toHaveCount(0);
    await expect(page.locator(".study-question")).toHaveText(questionText);
    await expect(page.locator(".study-answer")).toBeVisible();
    const focusDuringSave = await page.evaluate(() => ({ tag: document.activeElement?.tagName, className: document.activeElement?.className }));
    held.release();
    await held.done;
    held = null;
    await expect(page.locator(".study-topline")).toContainText(final ? "1 von 1" : "1 von 3");
    await expect(page.locator(".study-answer")).toBeVisible();
    await expect(responseField).toHaveValue("Diese eigene Erklärung bleibt bei einem fehlgeschlagenen Speichern erhalten.");
    assert.equal(await currentCard.evaluate(element => element.isConnected), true, "A rejected rating leaves the same card mounted rather than rolling back from the next one.");
    assert.deepEqual(await page.evaluate(() => ({ tag: document.activeElement?.tagName, className: document.activeElement?.className })), focusDuringSave, "A failed save does not move focus to a different card.");
    await expect(page.getByRole("alert").filter({ hasText: "Speichern nicht möglich." })).toBeVisible();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 0, "Failed review must not persist or skip its card.");
    await expect(rating(false)).toBeEnabled();
    await holdWrite();
    await rating(false).click();
    await held.request;
    await finishWrite();
    assert.equal((await snapshot()).workspace.cards[0].reviews, 1, "Retry saves exactly one review.");
  }

  await start();
  await reveal().click();
  const external = structuredClone(fixture);
  external.cards[1].reviews = 4;
  external.cards[1].intervalDays = 7;
  await write(external);
  await holdWrite();
  await rating(true).click();
  await held.request;
  held.release();
  await held.done;
  held = null;
  await expect(page.getByRole("alert").filter({ hasText: "in einem anderen Fenster geändert" })).toBeVisible();
  await expect(page.locator(".study-topline")).toContainText("1 von 3");
  await expect(page.locator(".study-answer")).toBeVisible();
  const conflicted = (await snapshot()).workspace.cards;
  assert.deepEqual(conflicted.map(card => card.reviews), [0, 4, 0], "Conflict preserves the external revision without adding a review.");

  console.log("Checking reduced motion and a stationary mobile answer reveal");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start();
  const reducedCard = await page.locator(".study-card").evaluate(element => ({ animation: getComputedStyle(element).animationName, transition: getComputedStyle(element).transitionDuration }));
  assert.equal(reducedCard.animation, "none");
  assert.equal(reducedCard.transition, "0s");
  const scrollBeforeReveal = await page.evaluate(() => scrollY);
  await reveal().click();
  await expect(page.locator(".study-answer")).toBeVisible();
  assert.equal(await page.locator(".study-answer").evaluate(element => getComputedStyle(element).animationName), "none");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrollBeforeReveal);
  const footer = await page.locator(".study-rating").boundingBox();
  assert.ok(Math.abs(footer.y + footer.height - page.viewportSize().height) < 1, "Reduced-motion controls remain fixed to the viewport.");
  assert.deepEqual(errors, [], "No browser runtime errors.");
  console.log("PASS: concise own-answer comparison, honest fallback, nonblocking manual ratings, stale-result protection, compact A–D choices at 1440/390/320px, stable card/answer/draft until saved, clean next-card focus, fixed mobile controls, reduced motion, duplicate-click protection, truthful completion, failed-save retry and revision conflict preservation.");
} finally {
  heldComparison?.release();
  if (heldComparison) await heldComparison.done;
  held?.release();
  if (held) await held.done;
  await page.unrouteAll({ behavior: "wait" });
  if (initial) await write(initial);
  await browser.close();
}
