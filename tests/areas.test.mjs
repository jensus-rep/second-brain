import test from "node:test";
import assert from "node:assert/strict";
import { AREA_TONES, areaTone, rootTopicId, rootTopics } from "../lib/brain/areas.ts";

const topic = (id, parentId = null) => ({ id, title: id, description: "", color: "blue", parentId });
const topics = [
  topic("pm"), topic("pm-agil", "pm"), topic("pm-scrum", "pm-agil"),
  topic("ki"), topic("fm"), topic("fm-quant", "fm"), topic("swe"), topic("lang"), topic("extra"),
];

test("root topics keep their order and orphaned children count as roots", () => {
  assert.deepEqual(rootTopics(topics).map(t => t.id), ["pm", "ki", "fm", "swe", "lang", "extra"]);
  assert.deepEqual(rootTopics([topic("a", "missing")]).map(t => t.id), ["a"]);
});

test("every topic resolves to its Gebiet", () => {
  assert.equal(rootTopicId(topics, "pm-scrum"), "pm");
  assert.equal(rootTopicId(topics, "fm"), "fm");
  assert.equal(rootTopicId(topics, null), null);
  assert.equal(rootTopicId(topics, "unknown"), null);
});

test("tones follow the root order and repeat after five Gebiete", () => {
  assert.equal(areaTone(topics, "pm-scrum"), "forest");
  assert.equal(areaTone(topics, "ki"), "teal");
  assert.equal(areaTone(topics, "fm-quant"), "violet");
  assert.equal(areaTone(topics, "swe"), "sky");
  assert.equal(areaTone(topics, "lang"), "clay");
  assert.equal(areaTone(topics, "extra"), AREA_TONES[0]);
  assert.equal(areaTone(topics, null), null);
});

test("a parent cycle cannot hang the lookup", () => {
  const cyclic = [topic("a", "b"), topic("b", "a")];
  assert.ok(["a", "b"].includes(rootTopicId(cyclic, "a")));
});
