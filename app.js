const STORAGE_KEY = "english-context-reader-draft";
const WORD_PATTERN = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+(?:[’'][A-Za-z]+)*)*/g;

const $ = (selector) => document.querySelector(selector);
const editorView = $("#editorView");
const readerView = $("#readerView");
const articleForm = $("#articleForm");
const titleInput = $("#articleTitle");
const originalTitleInput = $("#originalTitle");
const englishInput = $("#englishText");
const chineseTitleInput = $("#chineseTitle");
const chineseInput = $("#chineseText");
const titleError = $("#titleError");
const originalTitleError = $("#originalTitleError");
const englishError = $("#englishError");
const importText = $("#importText");
const importButton = $("#importButton");
const clearImportButton = $("#clearImportButton");
const importStatus = $("#importStatus");
const sceneSummary = $("#sceneSummary");
const articleTabs = $("#articleTabs");
const readerUnitTitle = $("#readerUnitTitle");
const readerTitle = $("#readerTitle");
const readerEnglish = $("#readerEnglish");
const readerTranslation = $("#readerTranslation");
const readerChineseTitle = $("#readerChineseTitle");
const readerChineseText = $("#readerChineseText");
const translationSection = $("#translationSection");
const translationToggle = $("#translationToggle");
const translationToggleText = $("#translationToggleText");
const backButton = $("#backButton");
const vocabularyToggle = $("#vocabularyToggle");
const vocabularyCount = $("#vocabularyCount");
const vocabularyList = $("#vocabularyList");
const vocabularySummary = $("#vocabularySummary");
const vocabularyItems = $("#vocabularyItems");
const vocabularyEmpty = $("#vocabularyEmpty");
const wordCard = $("#wordCard");
const wordCardBackdrop = $("#wordCardBackdrop");
const wordCardClose = $("#wordCardClose");
const wordCardTitle = $("#wordCardTitle");
const wordCardForm = $("#wordCardForm");
const wordMeaning = $("#wordMeaning");
const wordPhonetic = $("#wordPhonetic");
const wordExample = $("#wordExample");
const wordCardStatus = $("#wordCardStatus");
const wordCardSubmit = $("#wordCardSubmit");
const speakWord = $("#speakWord");
const deleteWord = $("#deleteWord");

let vocabulary = Object.create(null);
let scenes = [];
let activeContentIndex = 0;
let activeWord = "";
let activeDisplayWord = "";
let cardTrigger = null;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeArticle(article) {
  return {
    title: typeof article?.title === "string" ? article.title : "",
    english: typeof article?.english === "string" ? article.english : "",
    chineseTitle: typeof article?.chineseTitle === "string" ? article.chineseTitle : "",
    chinese: typeof article?.chinese === "string" ? article.chinese : "",
  };
}

function getOriginal() {
  return {
    title: originalTitleInput.value,
    english: englishInput.value,
    chineseTitle: chineseTitleInput.value,
    chinese: chineseInput.value,
  };
}

function getDraft() {
  const original = getOriginal();
  return {
    articleTitle: titleInput.value,
    original,
    scenes,
    vocabulary,
    // Keep the phase-one fields so older builds can still open this draft.
    title: titleInput.value,
    english: original.english,
    chinese: original.chinese,
  };
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getDraft()));
}

function copyVocabulary(savedVocabulary) {
  const result = Object.create(null);
  if (!isPlainObject(savedVocabulary)) return result;
  Object.entries(savedVocabulary).forEach(([word, entry]) => {
    if (isPlainObject(entry)) result[normalizeWord(word)] = { ...entry };
  });
  return result;
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!isPlainObject(draft)) return;

    const hasNewOriginal = isPlainObject(draft.original);
    const original = hasNewOriginal
      ? normalizeArticle(draft.original)
      : normalizeArticle({
          title: draft.title,
          english: draft.english,
          chineseTitle: draft.chineseTitle,
          chinese: draft.chinese,
        });

    titleInput.value = typeof draft.articleTitle === "string"
      ? draft.articleTitle
      : (typeof draft.title === "string" ? draft.title : "");
    originalTitleInput.value = original.title;
    englishInput.value = original.english;
    chineseTitleInput.value = original.chineseTitle;
    chineseInput.value = original.chinese;
    scenes = Array.isArray(draft.scenes)
      ? draft.scenes.slice(0, 5).map(normalizeArticle)
      : [];
    vocabulary = copyVocabulary(draft.vocabulary);
    updateSceneSummary();
  } catch {
    // Leave malformed storage untouched so a newer or external version can recover it.
  }
}

function normalizeWord(word) {
  return word.toLocaleLowerCase("en-US");
}

function getVocabularyEntry(word) {
  return Object.prototype.hasOwnProperty.call(vocabulary, word) ? vocabulary[word] : null;
}

function renderEnglish(text) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    fragment.append(document.createTextNode(text.slice(cursor, match.index)));
    const normalized = normalizeWord(match[0]);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-token";
    button.dataset.word = normalized;
    button.textContent = match[0];
    button.setAttribute("aria-label", `${match[0]}，打开生词卡`);
    button.classList.toggle("is-saved", Boolean(getVocabularyEntry(normalized)));
    fragment.append(button);
    cursor = match.index + match[0].length;
  }

  fragment.append(document.createTextNode(text.slice(cursor)));
  readerEnglish.replaceChildren(fragment);
}

function renderVocabulary() {
  const words = Object.keys(vocabulary).sort((a, b) => a.localeCompare(b, "en"));
  vocabularyCount.textContent = String(words.length);
  vocabularySummary.textContent = `共 ${words.length} 个`;
  vocabularyEmpty.hidden = words.length > 0;
  vocabularyItems.replaceChildren();

  words.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vocabulary-item";
    button.dataset.word = word;
    button.textContent = vocabulary[word].word || word;
    button.setAttribute("aria-label", `打开 ${button.textContent} 的生词卡`);
    vocabularyItems.append(button);
  });

  readerEnglish.querySelectorAll(".word-token").forEach((token) => {
    token.classList.toggle("is-saved", Boolean(getVocabularyEntry(token.dataset.word)));
  });
}

function clearTemporarySelection() {
  readerEnglish.querySelectorAll(".word-token.is-selected").forEach((token) => {
    token.classList.remove("is-selected");
  });
}

function openWordCard(word, trigger, displayWord = word) {
  const entry = getVocabularyEntry(word);
  activeWord = word;
  activeDisplayWord = entry?.word || displayWord;
  cardTrigger = trigger || document.activeElement;
  wordCardTitle.textContent = activeDisplayWord;
  wordMeaning.value = entry?.meaning || "";
  wordPhonetic.value = entry?.phonetic || "";
  wordExample.value = entry?.example || "";
  wordCardSubmit.textContent = entry ? "保存修改" : "加入生词表";
  deleteWord.hidden = !entry;
  wordCardStatus.textContent = "";
  wordCard.hidden = false;
  wordCardBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  wordCardClose.focus();
}

function closeWordCard() {
  if (wordCard.hidden) return;
  clearTemporarySelection();
  wordCard.hidden = true;
  wordCardBackdrop.hidden = true;
  document.body.style.overflow = "";
  if (cardTrigger && document.contains(cardTrigger)) cardTrigger.focus();
  activeWord = "";
  activeDisplayWord = "";
  cardTrigger = null;
}

function clearValidation(input, errorElement) {
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
  errorElement.textContent = "";
}

function showValidation(input, errorElement, message) {
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
  errorElement.textContent = message;
}

function validateDraft() {
  clearValidation(titleInput, titleError);
  clearValidation(originalTitleInput, originalTitleError);
  clearValidation(englishInput, englishError);

  if (!titleInput.value.trim()) {
    showValidation(titleInput, titleError, "请填写学习单元标题。");
    titleInput.focus();
    return false;
  }
  if (!originalTitleInput.value.trim()) {
    showValidation(originalTitleInput, originalTitleError, "请填写原文英文标题。");
    originalTitleInput.focus();
    return false;
  }
  if (!englishInput.value.trim()) {
    showValidation(englishInput, englishError, "请粘贴英文原文。");
    englishInput.focus();
    return false;
  }
  return true;
}

function closeTranslation() {
  translationToggle.setAttribute("aria-expanded", "false");
  translationToggleText.textContent = "展开全文翻译";
  readerTranslation.hidden = true;
}

function getContents() {
  return [getOriginal(), ...scenes];
}

function renderTabs() {
  articleTabs.replaceChildren();
  getContents().forEach((_, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "article-tab";
    tab.id = `articleTab${index}`;
    tab.dataset.index = String(index);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "readerEnglish");
    tab.setAttribute("aria-selected", String(index === activeContentIndex));
    tab.tabIndex = index === activeContentIndex ? 0 : -1;
    tab.textContent = index === 0 ? "原文" : `场景${index}`;
    articleTabs.append(tab);
  });
}

function renderActiveContent() {
  const contents = getContents();
  if (activeContentIndex >= contents.length) activeContentIndex = 0;
  const content = contents[activeContentIndex];
  readerUnitTitle.textContent = titleInput.value.trim();
  readerTitle.textContent = content.title;
  renderEnglish(content.english);
  readerChineseTitle.textContent = content.chineseTitle;
  readerChineseTitle.hidden = !content.chineseTitle.trim();
  readerChineseText.textContent = content.chinese;
  translationSection.hidden = !content.chineseTitle.trim() && !content.chinese.trim();
  closeTranslation();
  renderTabs();
  renderVocabulary();
}

function showReader() {
  activeContentIndex = 0;
  renderActiveContent();
  vocabularyList.hidden = true;
  vocabularyToggle.setAttribute("aria-expanded", "false");
  editorView.hidden = true;
  readerView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  backButton.focus({ preventScroll: true });
}

function showEditor() {
  closeWordCard();
  readerView.hidden = true;
  editorView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  titleInput.focus({ preventScroll: true });
}

function validateImportedArticle(article, label) {
  if (!isPlainObject(article)) return `${label}必须是对象。`;
  if (typeof article.title !== "string" || !article.title.trim()) return `${label}缺少英文标题 title。`;
  if (typeof article.english !== "string" || !article.english.trim()) return `${label}缺少英文正文 english。`;
  if (article.chineseTitle !== undefined && typeof article.chineseTitle !== "string") {
    return `${label}的 chineseTitle 必须是字符串。`;
  }
  if (article.chinese !== undefined && typeof article.chinese !== "string") {
    return `${label}的 chinese 必须是字符串。`;
  }
  return "";
}

function parseImport(value) {
  let imported;
  try {
    imported = JSON.parse(value);
  } catch {
    throw new Error("JSON 格式无效，请检查引号、逗号和括号。");
  }
  if (!isPlainObject(imported)) throw new Error("导入内容必须是一个 JSON 对象。");
  if (typeof imported.articleTitle !== "string" || !imported.articleTitle.trim()) {
    throw new Error("articleTitle 必须是非空字符串。");
  }
  const originalError = validateImportedArticle(imported.original, "original");
  if (originalError) throw new Error(originalError);
  if (!Array.isArray(imported.scenes) || imported.scenes.length < 1 || imported.scenes.length > 5) {
    throw new Error("scenes 必须包含 1～5 篇场景文章。");
  }
  imported.scenes.forEach((scene, index) => {
    const error = validateImportedArticle(scene, `场景${index + 1}`);
    if (error) throw new Error(error);
  });
  return {
    articleTitle: imported.articleTitle,
    original: normalizeArticle(imported.original),
    scenes: imported.scenes.map(normalizeArticle),
  };
}

function updateSceneSummary() {
  sceneSummary.textContent = scenes.length
    ? `当前已保存 ${scenes.length} 篇场景文章：${scenes.map((scene) => scene.title).join("、")}`
    : "当前没有场景文章";
}

readerEnglish.addEventListener("click", (event) => {
  const token = event.target.closest(".word-token");
  if (!token) return;
  clearTemporarySelection();
  if (!getVocabularyEntry(token.dataset.word)) token.classList.add("is-selected");
  openWordCard(token.dataset.word, token, token.textContent);
});

articleTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".article-tab");
  if (!tab) return;
  closeWordCard();
  activeContentIndex = Number(tab.dataset.index);
  renderActiveContent();
  articleTabs.querySelector(`[data-index="${activeContentIndex}"]`)?.focus();
});

articleTabs.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const count = getContents().length;
  activeContentIndex = (activeContentIndex + (event.key === "ArrowRight" ? 1 : -1) + count) % count;
  renderActiveContent();
  articleTabs.querySelector(`[data-index="${activeContentIndex}"]`)?.focus();
});

vocabularyToggle.addEventListener("click", () => {
  const willExpand = vocabularyList.hidden;
  vocabularyList.hidden = !willExpand;
  vocabularyToggle.setAttribute("aria-expanded", String(willExpand));
});

vocabularyItems.addEventListener("click", (event) => {
  const item = event.target.closest(".vocabulary-item");
  if (item) openWordCard(item.dataset.word, item);
});

wordCardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activeWord) return;
  const existing = getVocabularyEntry(activeWord);
  vocabulary[activeWord] = {
    ...existing,
    word: existing?.word || activeDisplayWord,
    meaning: wordMeaning.value.trim(),
    phonetic: wordPhonetic.value.trim(),
    example: wordExample.value.trim(),
  };
  saveDraft();
  clearTemporarySelection();
  renderVocabulary();
  wordCardSubmit.textContent = "保存修改";
  deleteWord.hidden = false;
  wordCardStatus.textContent = existing ? "修改已保存到此设备" : "已加入生词表并保存到此设备";
});

deleteWord.addEventListener("click", () => {
  if (!activeWord) return;
  delete vocabulary[activeWord];
  saveDraft();
  renderVocabulary();
  closeWordCard();
});

speakWord.addEventListener("click", () => {
  if (!activeWord || !("speechSynthesis" in window)) {
    wordCardStatus.textContent = "当前浏览器不支持系统朗读。";
    return;
  }
  const utterance = new SpeechSynthesisUtterance(activeDisplayWord || activeWord);
  utterance.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang === "en-US")
    || voices.find((voice) => voice.lang === "en-GB")
    || voices.find((voice) => voice.lang.startsWith("en"))
    || null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
});

wordCardClose.addEventListener("click", closeWordCard);
wordCardBackdrop.addEventListener("click", closeWordCard);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !wordCard.hidden) closeWordCard();
  if (event.key !== "Tab" || wordCard.hidden) return;
  const focusable = [...wordCard.querySelectorAll("button:not([hidden]), input, textarea")];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

articleForm.addEventListener("input", (event) => {
  if (event.target === importText) {
    importStatus.textContent = "";
    importStatus.className = "import-status";
    return;
  }
  saveDraft();
  if (event.target === titleInput) clearValidation(titleInput, titleError);
  if (event.target === originalTitleInput) clearValidation(originalTitleInput, originalTitleError);
  if (event.target === englishInput) clearValidation(englishInput, englishError);
});

articleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveDraft();
  if (validateDraft()) showReader();
});

importButton.addEventListener("click", () => {
  try {
    const imported = parseImport(importText.value);
    titleInput.value = imported.articleTitle;
    originalTitleInput.value = imported.original.title;
    englishInput.value = imported.original.english;
    chineseTitleInput.value = imported.original.chineseTitle;
    chineseInput.value = imported.original.chinese;
    scenes = imported.scenes;
    saveDraft();
    updateSceneSummary();
    importStatus.textContent = "内容导入成功";
    importStatus.className = "import-status is-success";
    clearValidation(titleInput, titleError);
    clearValidation(originalTitleInput, originalTitleError);
    clearValidation(englishInput, englishError);
  } catch (error) {
    importStatus.textContent = error.message;
    importStatus.className = "import-status is-error";
  }
});

clearImportButton.addEventListener("click", () => {
  importText.value = "";
  importStatus.textContent = "";
  importStatus.className = "import-status";
  importText.focus();
});

translationToggle.addEventListener("click", () => {
  const willExpand = translationToggle.getAttribute("aria-expanded") === "false";
  translationToggle.setAttribute("aria-expanded", String(willExpand));
  translationToggleText.textContent = willExpand ? "收起全文翻译" : "展开全文翻译";
  readerTranslation.hidden = !willExpand;
});

backButton.addEventListener("click", showEditor);

loadDraft();
