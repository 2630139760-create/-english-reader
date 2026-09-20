const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class Element {
  constructor(id) {
    this.id = id; this.hidden = false; this.disabled = false; this.value = ""; this.textContent = "";
    this.className = ""; this.classList = new ClassList(); this.listeners = {}; this.files = []; this.attributes = {};
  }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type, extra = {}) { for (const handler of this.listeners[type] || []) handler({ target: this, currentTarget: this, key: "", ...extra }); }
  focus() { document.activeElement = this; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  scrollIntoView() {}
  dispatchEvent(event) { this.dispatch(event.type); }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
for (const id of ["ocrModal", "ocrProgress", "ocrWorkspace", "ocrResultArea", "ocrFill", "ocrFillChoices"]) elements[id].hidden = true;

let fillMode = null;
const document = {
  activeElement: null,
  body: new Element("body"),
  head: { append() {} },
  listeners: {},
  getElementById: (id) => elements[id],
  querySelector: (selector) => selector === 'input[name="ocrFillMode"]:checked' && fillMode ? { value: fillMode } : null,
  createElement: () => new Element("script"),
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
};
const objectUrls = new Set();
const URL = {
  createObjectURL() { const url = `blob:${objectUrls.size + 1}`; objectUrls.add(url); return url; },
  revokeObjectURL(url) { objectUrls.delete(url); }
};
class Image {
  set src(value) { this.naturalWidth = 100; this.naturalHeight = 50; queueMicrotask(() => this.onload()); }
}
class Event { constructor(type) { this.type = type; } }
const responses = [];
const workers = [];
const Tesseract = {
  async createWorker(language, oem, options) {
    assert.equal(language, "eng");
    assert.match(options.workerPath, /tesseract\.js@5\.1\.1/);
    assert.match(options.langPath, /@tesseract\.js-data\/eng@1\.0\.0/);
    const worker = { terminated: false, async recognize() { return { data: { text: await responses.shift() } }; }, async terminate() { this.terminated = true; } };
    workers.push(worker); return worker;
  }
};
const window = { confirm: () => true };
const context = { document, URL, Image, Event, Tesseract, window, console, Promise, Set, Object, String, Math };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "ocr.js"), "utf8"), context, { filename: "ocr.js" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
  elements.openOcrButton.dispatch("click");
  assert.equal(elements.ocrModal.hidden, false);
  elements.ocrModal.dispatch("click", { target: elements.ocrPanel });
  assert.equal(elements.ocrModal.hidden, false, "clicking inside the panel must not close it");

  elements.ocrFile.files = [{ name: "bad.gif", type: "image/gif", size: 100 }];
  elements.ocrFile.dispatch("change");
  assert.match(elements.ocrStatus.textContent, /不支持/);

  elements.ocrFile.files = [{ name: "page.png", type: "image/png", size: 1024 }];
  elements.ocrFile.dispatch("change");
  await settle();
  assert.equal(elements.ocrStart.disabled, false);

  elements.englishText.value = "Existing paragraph.";
  responses.push("Recognized text.");
  elements.ocrStart.dispatch("click");
  await settle(); await settle();
  assert.equal(elements.ocrText.value, "Recognized text.");
  elements.ocrText.value = "User corrected text!";
  elements.ocrFill.dispatch("click");
  assert.equal(elements.ocrFillChoices.hidden, false);
  fillMode = "append";
  elements.ocrConfirmFill.dispatch("click");
  assert.equal(elements.englishText.value, "Existing paragraph.\n\nUser corrected text!");
  assert.equal(elements.ocrModal.hidden, true);
  assert.equal(objectUrls.size, 0);

  const beforeCancel = elements.englishText.value;
  elements.openOcrButton.dispatch("click");
  elements.ocrCancel.dispatch("click");
  assert.equal(elements.englishText.value, beforeCancel);

  elements.openOcrButton.dispatch("click");
  elements.ocrModal.dispatch("click", { target: elements.ocrBackdrop });
  assert.equal(elements.ocrModal.hidden, true, "only the actual backdrop closes the dialog");

  elements.openOcrButton.dispatch("click");
  elements.ocrFile.files = [{ name: "blank.jpg", type: "image/jpeg", size: 10 }];
  elements.ocrFile.dispatch("change"); await settle();
  responses.push("   ");
  elements.ocrStart.dispatch("click"); await settle(); await settle();
  assert.match(elements.ocrStatus.textContent, /没有识别到/);
  assert.equal(elements.ocrFill.hidden, true);
  assert.ok(workers.every((worker) => worker.terminated), "workers must always be terminated");
  console.log("Passed: OCR validation, editable preview, append latest edit, empty result, cancellation and cleanup");
})().catch((error) => { console.error(error); process.exitCode = 1; });
