import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Preparation tests may only mutate localhost.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
const subject = "Lokale Vorbereitung";
const concept = "Kosten, Zeit und Qualität";
const otherConcept = "Entscheidungsrahmen";
let initial;

async function snapshot() {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200, "Authenticated local snapshot");
  return response.json();
}

async function write(workspace) {
  const current = await snapshot();
  const response = await page.request.put(origin + "/api/brain", { headers: { Origin: origin }, data: { revision: current.revision, workspace } });
  assert.equal(response.status(), 200, await response.text());
}

const button = (name, scope = page) => scope.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(name, scope = page) {
  await expect(button(name, scope)).toBeEnabled();
  await button(name, scope).click();
}

async function openTests() {
  if (!await button("Tests & Übungen").isVisible()) await click("Navigation öffnen");
  await click("Tests & Übungen");
  await expect(page.locator(".quizzes, .quiz-session")).toBeVisible();
}

async function reload() {
  const response = await page.reload({ waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Local preview reload must compile and return 200");
  await openTests();
}

async function mobileFits(stage) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${stage} fits ${width}px` }).toBe(true);
    const overflow = await page.locator(".quiz-preparation, .quiz-preparation-detail, .quiz-result-summary, .quiz-learning-material, .quiz-session").evaluateAll(elements => elements.filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 1).map(element => element.className));
    assert.deepEqual(overflow, [], `${stage}: no overflowing panels at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function answer(question, selectedIds, runId, count) {
  for (const id of selectedIds) await page.getByRole("checkbox", { name: question.options.find(option => option.id === id).text, exact: true }).check();
  await click("Bestätigen");
  await expect.poll(async () => (await snapshot()).workspace.quizRuns.find(run => run.id === runId)?.answers.length).toBe(count);
  await expect(page.locator(".quiz-verdict")).toBeVisible();
}

async function result(correct, total, incorrect, unanswered) {
  const summary = page.locator(".quiz-result-summary");
  const percent = Math.round(correct / total * 100);
  const heading = summary.getByRole("heading", { name: `${correct} von ${total} richtig · ${percent} %`, exact: true });
  await expect(heading).toBeVisible();
  await expect.poll(() => summary.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= -1 && bounds.top < 10 && bounds.top < innerHeight;
  }), { message: "Result summary immediately returns to the top of the viewport" }).toBe(true);
  await expect(heading).toBeFocused();
  await expect(summary.locator(".quiz-result-ring-label strong")).toHaveText(`${percent}%`);
  await expect(summary.locator(".is-correct dd")).toHaveText(String(correct));
  await expect(summary.locator(".is-incorrect dd")).toHaveText(String(incorrect));
  await expect(summary.locator(".is-unanswered dd")).toHaveText(String(unanswered));
  return summary;
}

try {
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Local preview must compile and return 200");
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible();
  initial = (await snapshot()).workspace;
  const encodedImage = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 220;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f3f7fd"; context.fillRect(0, 0, 640, 220);
    context.font = "24px sans-serif";
    ["Kosten", "Zeit", "Qualität"].forEach((text, i) => {
      context.fillStyle = "#dce8fa"; context.fillRect(20 + i * 210, 65, 180, 90);
      context.fillStyle = "#304b71"; context.fillText(text, 35 + i * 210, 120);
    });
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const uploaded = await page.request.post(origin + "/api/media", { headers: { "Content-Type": "image/png", Origin: origin }, data: Buffer.from(encodedImage, "base64") });
  assert.equal(uploaded.status(), 201);
  const imageUrl = (await uploaded.json()).url;
  const now = new Date().toISOString();
  const note = (id, title, content) => ({ id, title, content, summary: "Eine vorhandene Lernnotiz erläutert den Zusammenhang der Aufgaben.", topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now });
  const notes = [
    note("qa-preparation-diagram", "Steuerungsdimensionen im Zusammenhang", '## Drei Größen\n\nKosten, Zeit und Qualität beeinflussen sich gegenseitig.\n\n```mermaid\nflowchart LR\n K["Kosten"] --> Z["Zeit"]\n Z --> Q["Qualität"]\n Q --> K\n```'),
    note("qa-preparation-table", "Steuerungsdimensionen nachschlagen", "## Vergleich\n\n| Dimension | Bedeutung |\n|---|---|\n| Kosten | Finanzieller Aufwand |\n| Zeit | Dauer und Termine |\n| Qualität | Vereinbarte Anforderungen an das Ergebnis |"),
    note("qa-preparation-image", "Drei Größen als Abbildung", `## Abbildung\n\n![Kosten, Zeit und Qualität](${imageUrl} "Steuerungsgrößen gemeinsam betrachten.")`),
    note("qa-preparation-scope", "Umfang und Qualität unterscheiden", "## Abgrenzung\n\nEine optionale Funktion später zu liefern verändert den Umfang. Die vereinbarten Qualitätsanforderungen bleiben bestehen."),
    note("qa-preparation-change", "Änderungen vorbereiten", "## Alternativen\n\nDie Projektleitung bewertet Auswirkungen auf Kosten, Zeit und Qualität und bereitet Entscheidungen vor."),
    note("qa-preparation-authority", "Entscheidungsrahmen vereinbaren", "## Befugnisse\n\nEigene Entscheidungen bleiben im vereinbarten Rahmen. Änderungen darüber hinaus klärt die Projektleitung mit den zuständigen Personen."),
  ];
  const makeQuestion = (id, difficulty, prompt, texts, noteIds, selectedConcept = concept) => ({ id, subject, concept: selectedConcept, difficulty, noteIds, prompt, options: texts.map((text, i) => ({ id: `${id}-option-${i}`, text, feedback: i === 2 ? "Prüfe den vereinbarten Rahmen und unterscheide Umfang von Qualität." : "" })), correctOptionIds: [`${id}-option-0`, `${id}-option-1`], explanation: "Vollständig richtig ist die Auswahl der ersten beiden Aussagen. Bewerte die Auswirkungen und halte die vereinbarten Qualitätsanforderungen ein.", source: "" });
  const questions = [
    makeQuestion("qa-preparation-q1", 1, "Welche Größen gehören neben Qualität zum Dreieck?", ["Kosten", "Zeit", "Anzahl der Standorte"], [notes[0].id, notes[1].id]),
    makeQuestion("qa-preparation-q2", 2, "Eine optionale Funktion wird später geliefert. Welche Aussagen passen?", ["Der Umfang der ersten Lieferung wird kleiner.", "Die vereinbarte Qualität bleibt erhalten.", "Alle Qualitätskriterien werden aufgegeben."], [notes[2].id, notes[3].id]),
    makeQuestion("qa-preparation-q3", 3, "Ein Termin gerät in Gefahr. Wie bereitest du eine Entscheidung vor?", ["Alternativen und ihre Folgen bewerten.", "Mit den zuständigen Personen entscheiden.", "Alle Qualitätsanforderungen stillschweigend streichen."], [notes[4].id, notes[5].id]),
    makeQuestion("qa-preparation-q4", 1, "Was beschreiben die Steuerungsgrößen?", ["Kosten beschreiben finanziellen Aufwand.", "Zeit betrifft Dauer und Termine.", "Qualität ist immer frei verzichtbar."], [notes[0].id, notes[1].id]),
    makeQuestion("qa-preparation-q5", 2, "Wie behandelst du eine optionale Erweiterung bei knappem Termin?", ["Den Umfang ausdrücklich priorisieren.", "Vereinbarte Qualitätsanforderungen beibehalten.", "Fehler als fertige Funktion liefern."], [notes[2].id, notes[3].id]),
    makeQuestion("qa-preparation-q6", 3, "Was gehört zur Steuerung einer Abweichung?", ["Folgen für die Steuerungsgrößen prüfen.", "Eine Entscheidung im vereinbarten Rahmen treffen.", "Budgetänderungen ohne Befugnis beschließen."], [notes[4].id, notes[5].id]),
    ...[1, 2, 3].map(level => makeQuestion(`qa-preparation-r${level}`, level, `Entscheidungsrahmen auf Stufe ${level}: Was ist zu beachten?`, ["Befugnisse ausdrücklich klären.", "Entscheidungen im vereinbarten Rahmen treffen.", "Zuständigkeiten vollständig ignorieren."], [notes[5].id], otherConcept)),
  ];
  await write({ ...initial, notes: [...initial.notes, ...notes], quizQuestions: questions, quizRuns: [], learningReminders: [] });
  await reload();

  console.log("Checking preparation overview, reading material and short round");
  const preparation = page.locator(".quiz-preparation");
  await expect(preparation.locator(".quiz-preparation-unit")).toHaveCount(2);
  await expect(preparation.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 von 2 Lerneinheiten bearbeitet");
  await click("Vorbereitung starten", preparation);
  await expect(preparation.locator(".quiz-preparation-detail h3")).toHaveText(concept);
  await expect(preparation.locator(".quiz-preparation-answers")).toHaveCount(0);
  await expect(preparation.locator(".quiz-preparation-note")).toHaveCount(4);
  await click("Weitere Lerninhalte (2)", preparation);
  await expect(preparation.locator(".quiz-preparation-note")).toHaveCount(6);
  await expect(button("Weniger Lerninhalte", preparation)).toHaveAttribute("aria-expanded", "true");
  await mobileFits("Preparation and expanded material");
  await click(`Lerninhalt öffnen: ${notes[0].title}`, preparation);
  let reader = page.getByRole("dialog", { name: notes[0].title, exact: true });
  await expect(reader).toBeVisible();
  await expect(reader.locator(".diagram-zoom img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await click("Lerneinheit üben", preparation);
  let run = (await snapshot()).workspace.quizRuns.at(-1);
  assert.equal(run.preparationConcept, concept);
  assert.deepEqual(run.questions.map(question => question.difficulty), [1, 2, 3]);
  assert.equal(run.questions.length, 3, "Default preparation remains a three-level short round");
  await expect(page.locator(".quiz-learning-material")).toHaveCount(0);

  await answer(run.questions[0], [run.questions[0].correctOptionIds[0]], run.id, 1);
  await expect(page.getByRole("heading", { name: "Nicht ganz richtig", exact: true })).toBeVisible();
  const material = page.getByRole("region", { name: "Passender Lerninhalt", exact: true });
  await expect(material.locator(".diagram-zoom img")).toBeVisible();
  await expect.poll(() => material.locator(".diagram-zoom img").evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(material.locator(".comparison-visual")).toHaveCount(1);
  await expect(material.locator(".comparison-visual svg[role='img']")).toHaveCount(3);
  await mobileFits("Practice feedback with diagram and comparison");
  await click("Lerninhalt öffnen", material.locator(".quiz-learning-note").filter({ hasText: notes[0].title }));
  reader = page.getByRole("dialog", { name: notes[0].title, exact: true });
  await expect(reader).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  assert.equal((await snapshot()).workspace.quizRuns.length, 1, "Reading a note does not create another round");
  await click("Nächste Aufgabe");
  await answer(run.questions[1], run.questions[1].correctOptionIds, run.id, 2);
  await expect(material.getByRole("img", { name: "Kosten, Zeit und Qualität", exact: true })).toBeVisible();
  await expect.poll(() => material.getByRole("img", { name: "Kosten, Zeit und Qualität", exact: true }).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await mobileFits("Practice feedback with stored private image");
  await click("Nächste Aufgabe");
  await answer(run.questions[2], run.questions[2].options.map(option => option.id), run.id, 3);
  // Read to the end of long feedback while the mobile finish action stays pinned.
  // Finishing from that scroll position must reveal and focus the result immediately.
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByLabel("Mein Denkfehler / Merksatz").scrollIntoViewIfNeeded();
  assert.ok(await page.locator(".quiz-question h2").first().evaluate(heading => heading.getBoundingClientRect().top < 0), "Finish after scrolling the question heading out of view");
  await click("Runde abschließen");
  let summary = await result(1, 3, 2, 0);
  assert.equal(await summary.locator(".quiz-result-ring-value").evaluate(element => getComputedStyle(element).animationName), "quiz-result-fill");
  assert.equal(await summary.locator(".quiz-result-stat").first().evaluate(element => getComputedStyle(element).animationName), "quiz-result-stat-enter");
  await mobileFits("Animated final result");
  await click("Zur Testübersicht");
  await reload();
  await expect(preparation.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 von 2 Lerneinheiten bearbeitet");
  await expect(preparation.locator(".quiz-preparation-unit.is-complete")).toHaveCount(1);
  await preparation.locator(".quiz-preparation-unit").filter({ hasText: concept }).click();
  await expect(preparation.locator(".quiz-preparation-answers")).toHaveText("Letzte Runde: 1 von 3 richtig.");

  console.log("Checking full question pool and reduced motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await click("Alle 6 Aufgaben üben", preparation);
  run = (await snapshot()).workspace.quizRuns.at(-1);
  assert.equal(run.questions.length, 6);
  assert.equal(new Set(run.questions.map(question => question.id)).size, 6);
  for (const [index, question] of run.questions.entries()) {
    await answer(question, question.correctOptionIds, run.id, index + 1);
    await click(index === run.questions.length - 1 ? "Runde abschließen" : "Nächste Aufgabe");
  }
  summary = await result(6, 6, 0, 0);
  assert.equal(await summary.locator(".quiz-result-ring-value").evaluate(element => getComputedStyle(element).animationName), "none");
  assert.ok((await summary.locator(".quiz-result-stat").evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName))).every(name => name === "none"));
  await mobileFits("Reduced-motion full-pool result");
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.screenshot({ path: ".sites-runtime/qa/quiz-preparation-result-desktop.png", fullPage: true, animations: "disabled" });
  await click("Zur Testübersicht");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  console.log("Checking early finish without completion");
  await click("Vorbereitung fortsetzen", preparation);
  await expect(preparation.locator(".quiz-preparation-detail h3")).toHaveText(otherConcept);
  await click("Lerneinheit üben", preparation);
  run = (await snapshot()).workspace.quizRuns.at(-1);
  await answer(run.questions[0], run.questions[0].correctOptionIds, run.id, 1);
  await click("Runde vorzeitig beenden");
  await result(1, 3, 0, 2);
  await click("Zur Testübersicht");
  await reload();
  await expect(preparation.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 von 2 Lerneinheiten bearbeitet");
  await expect(preparation.locator(".quiz-preparation-unit").filter({ hasText: otherConcept })).not.toHaveClass(/is-complete/);
  await mobileFits("Durable preparation progress after early finish");
  await page.screenshot({ path: ".sites-runtime/qa/quiz-preparation-overview-desktop.png", fullPage: true, animations: "disabled" });

  console.log("Checking exam privacy through reload and final scoring");
  await page.getByLabel("Modus", { exact: true }).selectOption("exam");
  await page.getByLabel("Aufgabenanzahl").selectOption("3");
  await page.getByLabel("Zeitlimit").selectOption("0");
  await click("Simulation starten");
  run = (await snapshot()).workspace.quizRuns.at(-1);
  const first = run.questions[0];
  await page.getByRole("checkbox", { name: first.options.find(option => option.id === first.correctOptionIds[0]).text, exact: true }).check();
  await click("Antwort speichern");
  await expect.poll(async () => (await snapshot()).workspace.quizRuns.find(item => item.id === run.id)?.answers.length).toBe(1);
  for (const selector of [".quiz-preparation", ".quiz-feedback", ".quiz-learning-material", ".quiz-result-summary", ".quiz-explanation", ".diagram-zoom", ".knowledge-figure"]) await expect(page.locator(selector)).toHaveCount(0);
  await mobileFits("Exam before submission");
  await reload();
  for (const selector of [".quiz-preparation", ".quiz-feedback", ".quiz-learning-material", ".quiz-result-summary"]) await expect(page.locator(selector)).toHaveCount(0);
  await click("Test abgeben");
  summary = await result(0, 3, 1, 2);
  await expect(page.locator(".quiz-learning-material")).toHaveCount(3);
  await mobileFits("Exam result and revealed learning material");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".sites-runtime/qa/quiz-preparation-result-mobile.png", fullPage: true, animations: "disabled" });

  console.log("Checking question-editor learning links and persistence");
  await click("Zur Testübersicht");
  await click(`Aufgabe bearbeiten: ${questions[0].prompt}`);
  const editor = page.getByRole("dialog", { name: "Testaufgabe bearbeiten", exact: true });
  await expect(editor).toBeVisible();
  const updatedNoteIds = [notes[2].id, notes[5].id];
  await editor.getByLabel("Verknüpfte Lernnotizen", { exact: true }).selectOption(updatedNoteIds);
  await click("Aufgabe speichern", editor);
  await expect(editor).toHaveCount(0);
  await reload();
  const edited = (await snapshot()).workspace;
  assert.deepEqual(edited.quizQuestions.find(question => question.id === questions[0].id).noteIds, updatedNoteIds, "Learning-note selection survives save and reload");
  assert.deepEqual(edited.quizRuns[0].questions.find(question => question.id === questions[0].id).noteIds, questions[0].noteIds, "Editing learning links preserves the historical question snapshot");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: three-level short preparation, full question pool, matching Mermaid/table/private image and note reader, durable completion, early finish, exact-set scoring, visible/focused results, animation/reduced motion, exam privacy, durable editor links and 390/320px layout.");
} finally {
  try { if (initial) await write(initial); }
  finally { await browser.close(); }
}
