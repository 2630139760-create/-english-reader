const assert = require("node:assert/strict");
const { normalizeStoredDraft, normalizeWord, parseImport } = require("../content-model.js");

function makePayload(sceneCount) {
  return JSON.stringify({
    articleTitle: "Unit title",
    original: {
      title: "Original title",
      english: "Keep  punctuation, spaces,\nand paragraphs.",
      chineseTitle: "原文标题",
      chinese: "原文翻译",
    },
    scenes: Array.from({ length: sceneCount }, (_, index) => ({
      title: `Scene ${index + 1}`,
      english: `A shared Word appears in scene ${index + 1}.`,
      chineseTitle: index % 2 ? "" : `场景 ${index + 1}`,
      chinese: "",
    })),
  });
}

for (const count of [1, 3, 5]) {
  const imported = parseImport(makePayload(count));
  assert.equal(imported.scenes.length, count);
  assert.equal(imported.original.english, "Keep  punctuation, spaces,\nand paragraphs.");
}

const oldVocabulary = { word: { word: "word", meaning: "单词" } };
const legacy = normalizeStoredDraft({
  title: "Legacy title",
  english: "Legacy body",
  chinese: "旧翻译",
  vocabulary: oldVocabulary,
  futureField: "preserved",
});
assert.deepEqual(legacy.original, {
  title: "Legacy title",
  english: "Legacy body",
  chineseTitle: "",
  chinese: "旧翻译",
});
assert.deepEqual(legacy.scenes, []);
assert.equal(legacy.vocabulary, oldVocabulary);
assert.equal(legacy.futureField, "preserved");

for (const invalid of [
  "not json",
  JSON.stringify({ articleTitle: "Unit", original: {}, scenes: [{}] }),
  JSON.stringify({
    articleTitle: "Unit",
    original: { title: "Original", english: "Text" },
    scenes: [],
  }),
  JSON.stringify({
    articleTitle: "Unit",
    original: { title: "Original", english: "Text" },
    scenes: Array.from({ length: 6 }, () => ({ title: "Scene", english: "Text" })),
  }),
]) {
  assert.throws(() => parseImport(invalid));
}

assert.equal(normalizeWord("Word"), normalizeWord("WORD"));
assert.equal(normalizeWord("Word"), "word");

console.log("content-model tests passed");
