// Shared navigation for browser tests: three main areas (Start, Wissen, Lernen) with a sub-navigation per area.
export const VIEW_AREAS = {
  "Mein Überblick": "Start",
  "Wissensbibliothek": "Wissen", "Themen": "Wissen", "Skripte": "Wissen", "Verbindungen": "Wissen", "Favoriten": "Wissen", "Archiv": "Wissen",
  "Heute": "Lernen", "Tutor": "Lernen", "Lernsammlungen": "Lernen", "Lernpfade": "Lernen", "Lernkarten": "Lernen", "Tests & Übungen": "Lernen",
};

/** The visible area switcher: the header on wide screens, the bottom bar on phones. */
async function areaNavigation(page) {
  const header = page.getByRole("navigation", { name: "Hauptbereiche", exact: true });
  const bottom = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
  // A closing dialog keeps the page inert for a moment; wait until one switcher is reachable again.
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await header.isVisible()) return header;
    if (await bottom.isVisible()) return bottom;
    await page.waitForTimeout(100);
  }
  throw new Error("No area navigation is visible.");
}

/** Opens a former sidebar view by its label, e.g. openView(page, "Lernkarten"). */
export async function openView(page, label) {
  const area = VIEW_AREAS[label];
  if (!area) throw new Error("Unknown view: " + label);
  const areas = await areaNavigation(page);
  if (area === "Start") { await areas.getByRole("button", { name: "Start", exact: true }).click(); return; }
  const sub = page.getByRole("navigation", { name: "Bereich " + area, exact: true });
  if (!await sub.isVisible()) {
    await areas.getByRole("button", { name: area, exact: true }).click();
    await sub.waitFor();
  }
  await sub.getByRole("button", { name: label, exact: true }).click();
}

/** Opens the account menu and returns the menu item, e.g. accountItem(page, "Import & Datensicherung"). */
export async function accountItem(page, name) {
  const item = page.getByRole("menuitem", { name, exact: true });
  if (!await item.isVisible()) await page.getByRole("button", { name: "Konto und Einstellungen", exact: true }).click();
  await item.waitFor();
  return item;
}

export async function closeAccountMenu(page) {
  if (await page.getByRole("menu").isVisible()) await page.keyboard.press("Escape");
}
