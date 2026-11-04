import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { rehypeTranslations, TRANSLATION_TAG } from "../lib/brain/translations.ts";
import { buildGlossary } from "../lib/brain/glossary.ts";

function render(content, extraPlugins = []) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    skipHtml: true,
    rehypePlugins: [rehypeTranslations, ...extraPlugins],
    components: { [TRANSLATION_TAG]: ({ children, ...props }) => createElement("span", { "data-translation": props["data-translation"] }, children) },
  }, content));
}

test("Indonesian sentences translate repeated words and keep idioms together", () => {
  const output = render("**Nama saya Jens. Saya baru mulai belajar bahasa Indonesia.** Saya belum mengerti. Bisa diulangi, tolong? Apa arti kata ini? Terima kasih!");
  assert.match(output, /data-translation="Name">Nama/);
  assert.equal((output.match(/data-translation="ich \/ mein"/g) ?? []).length, 3);
  for (const meaning of ["lernen", "verstehen", "noch nicht", "können", "wiederholt werden", "bitte / helfen", "was", "Bedeutung", "Wort", "dies / dieses"]) {
    assert.ok(output.includes(`data-translation="${meaning}"`), meaning);
  }
  assert.match(output, /data-translation="Indonesisch">bahasa Indonesia/);
  assert.match(output, /data-translation="danke">Terima kasih/);
  assert.match(output, /<strong>.*Jens\./);
});

test("Only whole words are translated, case and phrase whitespace are preserved", () => {
  const output = render("Saya: NAMASTE, xsayax, saya_foo, nama2, nama. TERIMA\u00a0KASIH!");
  assert.match(output, /NAMASTE, xsayax, saya_foo, nama2,/);
  assert.match(output, /data-translation="Name">nama/);
  assert.match(output, /data-translation="danke">TERIMA\u00a0KASIH/);
  assert.equal(render("Was bedeutet dieser Name? Die Kamera kann das."), "<p>Was bedeutet dieser Name? Die Kamera kann das.</p>");
});

test("Code and links neither gain nested controls nor activate automatic translations", () => {
  const output = render('Saya `saya` [saya](https://example.com "Linktitel")\n\n```text\nsaya\n```');
  assert.equal((output.match(/data-translation=/g) ?? []).length, 1);
  assert.match(output, /<code>saya<\/code>/);
  assert.match(output, /<a href="https:\/\/example.com" title="Linktitel">saya<\/a>/);
  const inactive = render('Ein Name. `saya` [saya](https://example.com)');
  assert.equal(inactive.includes("data-translation"), false);
});

test("Explicit annotations keep their titles and HTML stays disabled", () => {
  const output = render('[bonjour](#translation "Guten Tag")\n\n<script>alert(1)</script>');
  assert.match(output, /<a href="#translation" title="Guten Tag">bonjour<\/a>/);
  assert.equal(output.includes("<script"), false);
});

test("Glossary links do not nest inside translations", async () => {
  const { linkGlossaryTerms } = await import("../lib/brain/glossary.ts");
  const glossary = buildGlossary([{ id: "saya", title: "Saya", archived: false }]);
  const output = render("Saya", [() => tree => linkGlossaryTerms(tree, glossary)]);
  assert.match(output, /data-translation="ich \/ mein">Saya/);
  assert.equal(output.includes("glossary-term"), false);
});
