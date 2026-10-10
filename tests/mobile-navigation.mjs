import { chromium, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin = process.env.BRAIN_TEST_URL ?? "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Mobile navigation tests may only change localhost.");
const engine = process.env.BRAIN_TEST_ENGINE === "webkit" ? webkit : chromium;
const browser = await engine.launch(engine === chromium ? { channel: "chrome", headless: true } : { headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let initial;
const snapshot = async () => {
  const response = await page.request.get(origin + "/api/brain");
  assert.equal(response.status(), 200, "Load the local test workspace");
  return response.json();
};
const write = async workspace => {
  const latest = await snapshot();
  const response = await page.request.put(origin + "/api/brain", { data: { revision: latest.revision, workspace } });
  assert.equal(response.status(), 200, "Write local test data using its current revision");
};

const navigation = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
const menu = page.getByRole("dialog", { name: "Alle Bereiche", exact: true });
const directNames = ["Mein Überblick", "Wissensbibliothek", "Lernkarten", "Tests & Übungen"];
const more = navigation.getByRole("button", { name: "Weitere Bereiche öffnen", exact: true });
const destinations = ["Themen", "Lernsammlungen", "Lernpfade", "Verbindungen", "Favoriten", "Archiv"];
const current = name => navigation.getByRole("button", { name, exact: true });

async function noOverflow(label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${label}: document fits viewport`);
}

async function touchTarget(locator, label) {
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    return box ? Math.min(box.width, box.height) : 0;
  }, { message: `${label}: wait for its full touch target after opening animations` }).toBeGreaterThanOrEqual(43.9);
  const bounds = await locator.boundingBox();
  assert.ok(bounds && bounds.width >= 43.9 && bounds.height >= 43.9, `${label}: target is at least 44 × 44 px (${JSON.stringify(bounds)})`);
}

async function navigate(name) {
  await current(name).click();
  await expect(current(name)).toHaveAttribute("aria-current", "page");
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(page.locator(".breadcrumb strong")).toHaveText(name);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
}

async function contentEndIsReachable(label) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const navBounds = await navigation.boundingBox();
  const footerBounds = await page.locator(".page-footer").boundingBox();
  assert.ok(footerBounds && footerBounds.y + footerBounds.height <= navBounds.y + 1, `${label}: content end remains above bottom navigation`);
}

async function mobileLayout(width, height) {
  await page.setViewportSize({ width, height });
  await expect(navigation).toBeVisible();
  await navigate("Mein Überblick");
  await expect(page.locator(".mobile-toggle")).toBeVisible();
  await touchTarget(page.locator(".mobile-toggle"), "Top menu toggle");
  await expect(page.locator('[data-slot="sidebar-container"]')).not.toBeVisible();
  const navBounds = await navigation.boundingBox();
  assert.ok(navBounds.x >= -1 && navBounds.x + navBounds.width <= width + 1, `${width} × ${height}: navigation fits width`);
  assert.ok(Math.abs(navBounds.y + navBounds.height - height) <= 1, `${width} × ${height}: navigation stays at viewport bottom`);
  for (const name of [...directNames, "Weitere Bereiche öffnen"]) await touchTarget(current(name), name);
  assert.equal(await navigation.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, "Bottom navigation has no horizontal overflow");
  await noOverflow(`${width} × ${height}`);
  await contentEndIsReachable(`${width} × ${height}`);
  await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-${width}x${height}.png`, animations: "disabled" });
}

async function readerLayout(note, width, height) {
  console.log(`Checking reader navigation ${width} × ${height}`);
  await page.setViewportSize({ width, height });
  await page.goto(origin + "/#note=" + note.id, { waitUntil: "networkidle" });
  const reader = page.getByRole("dialog", { name: note.title, exact: true });
  await expect(reader).toBeVisible();
  const dock = reader.getByRole("navigation", { name: "Eintragsaktionen", exact: true });
  await expect(dock).toBeVisible();
  await expect(reader.locator(".entry-toolbar")).not.toBeVisible();
  await expect.poll(async () => { const box = await dock.boundingBox(); return Math.abs(box.y + box.height - height); }).toBeLessThan(.1);
  const readerBounds = await reader.boundingBox();
  const dockBounds = await dock.boundingBox();
  assert.ok(readerBounds.x >= -1 && readerBounds.x + readerBounds.width <= width + 1, "Reader fits viewport");
  assert.ok(Math.abs(dockBounds.y + dockBounds.height - height) <= 1, `Reader controls occupy the bottom edge at ${width} × ${height}: ${JSON.stringify(dockBounds)}`);
  for (const name of ["Schließen", "Inhaltsübersicht öffnen", "Bearbeiten", "Weitere Notizaktionen"]) await touchTarget(dock.getByRole("button", { name, exact: true }), name);

  const scroll = reader.locator(".entry-scroll");
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(reader.getByText("Lesbarer Schluss der mobilen Prüfnotiz.", { exact: true })).toBeInViewport();
  const contentEnd = await reader.locator(".entry-context").boundingBox();
  assert.ok(contentEnd.y + contentEnd.height <= dockBounds.y + 1, "Reader's final content stays above its controls");
  assert.equal(await reader.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, "Reader has no horizontal overflow");
  await noOverflow("Mobile reader");
  if (width === 390 && height === 844) await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-reader.png`, animations: "disabled" });

  const outlineToggle = dock.getByRole("button", { name: "Inhaltsübersicht öffnen", exact: true });
  const outline = page.locator(".reader-mobile-outline");
  await outlineToggle.click();
  await expect(outline).toBeVisible();
  await expect(outline.getByRole("button")).toHaveCount(5);
  for (const button of await outline.getByRole("button").all()) await touchTarget(button, "Heading jump");
  const outlineBounds = await outline.boundingBox();
  assert.ok(outlineBounds.x >= -1 && outlineBounds.x + outlineBounds.width <= width + 1 && outlineBounds.y >= -1, "Outline fits viewport");
  assert.ok(outlineBounds.y + outlineBounds.height <= dockBounds.y + 1, "Outline opens above reader controls");
  await outline.getByRole("button", { name: "Anwendung", exact: true }).click();
  await expect(outline).not.toBeVisible();
  await expect(reader.getByRole("heading", { name: "Anwendung", exact: true })).toBeFocused();
  await expect(reader.getByRole("heading", { name: "Anwendung", exact: true })).toBeInViewport();
  await outlineToggle.click();
  await page.keyboard.press("Escape");
  await expect(outline).not.toBeVisible();
  await expect(reader).toBeVisible();
  await expect(outlineToggle).toBeFocused();

  await dock.getByRole("button", { name: "Weitere Notizaktionen", exact: true }).click();
  const actions = page.getByRole("menu");
  await expect(actions).toBeVisible();
  for (const name of ["Als Favorit merken", "Lernkarte erstellen", "Archivieren"]) await touchTarget(actions.getByRole("menuitem", { name, exact: true }), name);
  await page.keyboard.press("Escape");
  await expect(actions).not.toBeVisible();
  await expect(reader).toBeVisible();
  await dock.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(reader).not.toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe("");
}

async function fixedControls(controls, height, label) {
  await expect(controls).toBeVisible();
  const bounds = await controls.boundingBox();
  assert.ok(Math.abs(bounds.y + bounds.height - height) <= 1, `${label}: actions stay at the viewport bottom`);
  for (const button of await controls.getByRole("button").all()) await touchTarget(button, label);
  await expect(navigation).not.toBeVisible();
  await noOverflow(label);
  return bounds;
}

async function learningLayouts(workspace, note) {
  const card = {
    id: crypto.randomUUID(), noteId: note.id, dueAt: new Date(Date.now() - 60000).toISOString(), intervalDays: 0, reviews: 0,
    question: `${("Welche Zusammenhänge helfen beim Anwenden des Wissens? ").repeat(80)}\n\nLesbarer Schluss der Lernfrage.`,
    answer: `${("Ein Beispiel verbindet den Gedanken mit einer konkreten Handlung. ").repeat(120)}\n\nLesbarer Schluss der Lernantwort.`,
  };
  for (const [width, height] of [[320, 700], [390, 844], [767, 390]]) {
    console.log(`Checking learning card navigation ${width} × ${height}`);
    await write({ ...workspace, cards: [card], quizRuns: [] });
    await page.setViewportSize({ width, height });
    await page.goto(origin, { waitUntil: "networkidle" });
    await navigate("Lernkarten");
    await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
    const reveal = page.getByRole("group", { name: "Aktionen für die Lernkarte", exact: true });
    const revealBounds = await fixedControls(reveal, height, "Flashcard reveal");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const questionEnd = await page.getByText("Lesbarer Schluss der Lernfrage.", { exact: true }).boundingBox();
    assert.ok(questionEnd.y + questionEnd.height <= revealBounds.y + 1, "Long learning question remains above its actions");
    await reveal.getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
    const rating = page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true });
    const ratingBounds = await fixedControls(rating, height, "Flashcard rating");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const answerEnd = await page.getByText("Lesbarer Schluss der Lernantwort.", { exact: true }).boundingBox();
    assert.ok(answerEnd.y + answerEnd.height <= ratingBounds.y + 1, "Long learning answer remains above its rating actions");
    if (width === 390) await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-learning-card.png`, animations: "disabled" });
    await rating.getByRole("button", { name: "Beenden", exact: true }).click();
    await expect(navigation).toBeVisible();
    await page.getByRole("button", { name: "Lernrunde starten", exact: true }).click();
    await page.getByRole("group", { name: "Aktionen für die Lernkarte", exact: true }).getByRole("button", { name: "Antwort aufdecken", exact: true }).click();
    await page.getByRole("group", { name: "Bewertung der Lernkarte", exact: true }).getByRole("button", { name: /^Gewusst/ }).click();
    await expect(page.getByRole("heading", { name: "Ein Stück Wissen bleibt.", exact: true })).toBeVisible();
    await expect(navigation).toBeVisible();
    assert.equal((await snapshot()).workspace.cards.find(c => c.id === card.id).reviews, 1, "Rating still persists one review");
  }

  const questions = Array.from({ length: 2 }, (_, index) => ({
    id: crypto.randomUUID(), subject: "Mobile Navigation", concept: "Zusammenhänge", difficulty: 1, noteIds: [note.id],
    prompt: `Welche Handlung ${index + 1} unterstützt das Lernen? ${("Überlege ein konkretes Beispiel und prüfe die Zusammenhänge. ").repeat(20)}`,
    options: [
      { id: "correct", text: `Passende Antwort ${index + 1}: ${("Ein Beispiel auf eine neue Situation übertragen. ").repeat(8)}`, feedback: "Das Wissen wird in einer konkreten Situation angewendet." },
      { id: "wrong", text: `Unpassende Antwort ${index + 1}: ${("Nur Wörter lesen und Zusammenhänge überspringen. ").repeat(8)}`, feedback: "Das Beispiel und sein Zusammenhang fehlen." },
    ],
    correctOptionIds: ["correct"], explanation: ("Prüfe den Gedanken anhand eines neuen Beispiels und begründe deine Entscheidung. ").repeat(25), source: "",
  }));
  for (const mode of ["practice", "exam"]) {
    for (const [width, height] of [[320, 700], [390, 844], [767, 390]]) {
      console.log(`Checking ${mode} navigation ${width} × ${height}`);
      await write({ ...workspace, cards: [], quizQuestions: questions, quizRuns: [] });
      await page.setViewportSize({ width, height });
      await page.goto(origin, { waitUntil: "networkidle" });
      await navigate("Tests & Übungen");
      await page.getByLabel("Fachthema für den Test", { exact: true }).selectOption("Mobile Navigation");
      await page.getByLabel("Modus", { exact: true }).selectOption(mode);
      await page.getByLabel("Aufgabenanzahl", { exact: true }).selectOption("2");
      if (mode === "exam") await page.getByLabel("Zeitlimit", { exact: true }).selectOption("0");
      await page.getByRole("button", { name: mode === "practice" ? "Übungsrunde starten" : "Simulation starten", exact: true }).click();
      const controls = page.getByRole("group", { name: "Aktionen für die Testaufgabe", exact: true });
      const controlBounds = await fixedControls(controls, height, `Quiz ${mode}`);
      if (mode === "exam") for (const button of await page.getByRole("navigation", { name: "Aufgaben im Test", exact: true }).getByRole("button").all()) await touchTarget(button, "Question number");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const sessionEnd = await page.locator(".quiz-session-end").boundingBox();
      assert.ok(sessionEnd.y + sessionEnd.height <= controlBounds.y + 1, "Long test content stays above its actions");
      const run = (await snapshot()).workspace.quizRuns.at(-1);
      for (const [index, question] of run.questions.entries()) {
        const correctOption = question.options.find(option => question.correctOptionIds.includes(option.id));
        await page.getByRole("checkbox", { name: correctOption.text, exact: true }).check();
        await controls.getByRole("button", { name: mode === "practice" ? "Bestätigen" : "Antwort speichern", exact: true }).click();
        if (mode === "practice") {
          await expect(page.getByRole("heading", { name: "Richtig beantwortet", exact: true })).toBeVisible();
          await fixedControls(controls, height, "Quiz feedback");
          if (width === 390 && index === 0) await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-quiz-feedback.png`, animations: "disabled" });
          await controls.getByRole("button", { name: index === run.questions.length - 1 ? "Runde abschließen" : "Nächste Aufgabe", exact: true }).click();
        } else {
          await expect.poll(async () => (await snapshot()).workspace.quizRuns.find(r => r.id === run.id).answers.length).toBe(index + 1);
        }
      }
      if (mode === "exam") await controls.getByRole("button", { name: "Test abgeben", exact: true }).click();
      await expect(page.getByRole("heading", { name: "2 von 2 richtig · 100 %", exact: true })).toBeVisible();
      await expect(navigation).toBeVisible();
      assert.ok((await snapshot()).workspace.quizRuns.find(r => r.id === run.id).finishedAt, "Completed test still persists its result");
    }
  }
}

try {
  await mkdir(".sites-runtime/qa", { recursive: true });
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dein Wissen", exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".page-footer")).toBeVisible();
  initial = (await snapshot()).workspace;
  const now = new Date().toISOString();
  const readerNote = {
    id: crypto.randomUUID(), title: "Mobile Navigationsprüfung", summary: "Ein lokaler Prüftext für erreichbare Navigation und Inhaltsübersicht.",
    content: ["Orientierung", "Zusammenhänge", "Anwendung", "Vertiefung", "Abschluss"].map(title => `## ${title}\n\n${("Zusammenhänge verstehen und im Alltag anwenden. ").repeat(35)}`).join("\n\n") + "\n\nLesbarer Schluss der mobilen Prüfnotiz.",
    topicId: null, tags: [], relatedIds: [], favorite: false, archived: false, createdAt: now, updatedAt: now,
  };
  // Extra cards make the scroll-reset check independent of the user's collection size.
  const navigationNotes = Array.from({ length: 6 }, (_, i) => ({ ...readerNote, id: crypto.randomUUID(), title: `Lokaler Navigationsgedanke ${i + 1}`, content: "Ein kurzer lokaler Prüfgedanke." }));
  const fixtureWorkspace = { ...initial, notes: [...initial.notes, readerNote, ...navigationNotes] };
  await write(fixtureWorkspace);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".page-footer")).toBeVisible();

  for (const [width, height] of [[320, 700], [390, 844], [767, 844], [390, 320], [767, 390]]) {
    console.log(`Checking mobile navigation ${width} × ${height}`);
    await mobileLayout(width, height);
    await more.click();
    await expect(menu).toBeVisible();
    await expect.poll(async () => { const box = await menu.boundingBox(); return Math.abs(box.y + box.height - height); }).toBeLessThan(.1);
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, "Menu fits viewport width");
    assert.ok(bounds.y >= -1 && Math.abs(bounds.y + bounds.height - height) <= 1, "Menu opens from viewport bottom");
    for (const name of [...destinations, "Import & Datensicherung", "Zugangsschlüssel"]) {
      const button = menu.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      await expect(button).toBeInViewport();
      await touchTarget(button, name);
    }
    await touchTarget(menu.getByRole("button", { name: "Menü schließen", exact: true }), "Close menu");
    await noOverflow("Open menu");
    if (width === 390 && height === 844) await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-menu.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(more).toBeFocused();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of directNames) {
    await navigate(name);
    await noOverflow(name);
    await contentEndIsReachable(name);
  }
  // A long library page verifies that fixed navigation is reachable while scrolled,
  // and that moving to a different area brings its heading back into view.
  await navigate("Wissensbibliothek");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  assert.ok(await page.evaluate(() => window.scrollY) > 0, "Library gives a real scroll position to reset");
  await navigate("Mein Überblick");

  for (const name of destinations) {
    await more.click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name, exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(more).toHaveAttribute("aria-current", "page");
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(".breadcrumb strong")).toHaveText(name);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
    await noOverflow(name);
    await contentEndIsReachable(name);
  }

  await more.click();
  await menu.getByRole("button", { name: "Menü schließen", exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(more).toBeFocused();
  for (const [name, title] of [["Import & Datensicherung", "Dein Wissen bleibt deins."], ["Zugangsschlüssel", "Zugangsschlüssel"]]) {
    await more.click();
    await menu.getByRole("button", { name, exact: true }).click();
    await expect(menu).not.toBeVisible();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await noOverflow(name);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }

  // The existing top menu remains usable alongside the new bottom shortcuts.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(".mobile-toggle").click();
  const sidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Mein Überblick", exact: true }).click();
  await expect(sidebar).not.toBeVisible();
  await expect(current("Mein Überblick")).toHaveAttribute("aria-current", "page");

  // Crossing the CSS/sidebar breakpoint while a sheet is open must release the overlay.
  await more.click();
  await expect(menu).toBeVisible();
  for (const [width, height] of [[768, 844], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect(navigation).not.toBeVisible();
    await expect(menu).not.toBeVisible();
    await expect(page.locator(".mobile-toggle")).not.toBeVisible();
    await expect(page.locator('[data-slot="sidebar-container"]')).toBeVisible();
    await page.locator('[data-slot="sidebar-container"]').getByRole("button", { name: "Wissensbibliothek", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Wissensbibliothek", exact: true })).toBeVisible();
    await noOverflow(`Desktop ${width} × ${height}`);
    await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-${width}x${height}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).toBeVisible();
  await expect(menu).not.toBeVisible();
  await expect(current("Wissensbibliothek")).toHaveAttribute("aria-current", "page");

  for (const [width, height] of [[320, 700], [390, 844], [767, 844], [390, 320], [767, 390]]) await readerLayout(readerNote, width, height);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/#note=" + readerNote.id, { waitUntil: "networkidle" });
  const reader = page.getByRole("dialog", { name: readerNote.title, exact: true });
  await reader.locator(".reader-mobile-actions").getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Notiz bearbeiten", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: "Inhaltsübersicht öffnen", exact: true }).click();
  await expect(page.locator(".reader-mobile-outline")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.locator(".reader-mobile-outline")).not.toBeVisible();
  await expect(reader.locator(".reader-mobile-actions")).not.toBeVisible();
  await expect(reader.locator(".entry-toolbar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).not.toBeVisible();
  await learningLayouts(fixtureWorkspace, readerNote);
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(`PASS (${engine.name()}): bottom navigation, all destinations, active state, touch targets, content clearance, sheet closure/focus/Escape, scroll reset, top menu, reader dock/outline/editing, learning card/review persistence, practice/exam actions and results, portrait/landscape and 767/768px breakpoint.`);
} catch (error) {
  await page.screenshot({ path: `.sites-runtime/qa/mobile-navigation-${engine.name()}-failure.png`, animations: "disabled" });
  throw error;
} finally {
  try { if (initial) await write(initial); }
  finally { await browser.close(); }
}
