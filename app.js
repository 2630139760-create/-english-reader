const STORAGE_KEY = "english-context-reader-draft";
const WORD_PATTERN = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+(?:[’'][A-Za-z]+)*)*/g;

const editorView = document.querySelector("#editorView");
const readerView = document.querySelector("#readerView");
const articleForm = document.querySelector("#articleForm");
const titleInput = document.querySelector("#articleTitle");
const originalTitleInput = document.querySelector("#originalTitle");
const englishInput = document.querySelector("#englishText");
const chineseTitleInput = document.querySelector("#chineseTitle");
const chineseInput = document.querySelector("#chineseText");
const titleError = document.querySelector("#titleError");
const originalTitleError = document.querySelector("#originalTitleError");
const englishError = document.querySelector("#englishError");
const structuredImport = document.querySelector("#structuredImport");
const importContent = document.querySelector("#importContent");
const clearImport = document.querySelector("#clearImport");
const importStatus = document.querySelector("#importStatus");
const contentSwitcher = document.querySelector("#contentSwitcher");
const readerUnitTitle = document.querySelector("#readerUnitTitle");
const readerTitle = document.querySelector("#readerTitle");
const readerChineseTitle = document.querySelector("#readerChineseTitle");
const readerEnglish = document.querySelector("#readerEnglish");
const readerTranslation = document.querySelector("#readerTranslation");
const translationSection = document.querySelector("#translationSection");
const translationToggle = document.querySelector("#translationToggle");
const translationToggleText = document.querySelector("#translationToggleText");
const backButton = document.querySelector("#backButton");
const vocabularyToggle = document.querySelector("#vocabularyToggle");
const vocabularyCount = document.querySelector("#vocabularyCount");
const vocabularyList = document.querySelector("#vocabularyList");
const vocabularySummary = document.querySelector("#vocabularySummary");
const vocabularyItems = document.querySelector("#vocabularyItems");
const vocabularyEmpty = document.querySelector("#vocabularyEmpty");
const wordCard = document.querySelector("#wordCard");
const wordCardBackdrop = document.querySelector("#wordCardBackdrop");
const wordCardClose = document.querySelector("#wordCardClose");
const wordCardTitle = document.querySelector("#wordCardTitle");
const wordCardForm = document.querySelector("#wordCardForm");
const wordMeaning = document.querySelector("#wordMeaning");
const wordPhonetic = document.querySelector("#wordPhonetic");
const wordExample = document.querySelector("#wordExample");
const wordCardStatus = document.querySelector("#wordCardStatus");
const wordCardSubmit = document.querySelector("#wordCardSubmit");
const speakWord = document.querySelector("#speakWord");
const deleteWord = document.querySelector("#deleteWord");

let vocabulary = {};
let scenes = [];
let persistedDraft = {};
let activeContentIndex = 0;
let activeWord = "";
let activeDisplayWord = "";
let cardTrigger = null;

function getDraft() {
  const original = {
    title: originalTitleInput.value,
    english: englishInput.value,
    chineseTitle: chineseTitleInput.value,
    chinese: chineseInput.value,
  };
  return {
    title: titleInput.value,
    original,
    scenes,
    // Keep legacy fields current so older versions can still open the original article.
    english: original.english,
    chineseTitle: original.chineseTitle,
    chinese: original.chinese,
  };
}

function saveDraft() {
  persistedDraft = { ...persistedDraft, ...getDraft(), vocabulary };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedDraft));
}

function loadDraft() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const draft = ContentModel.normalizeStoredDraft(JSON.parse(stored));
    persistedDraft = draft;
    titleInput.value = typeof draft.title === "string" ? draft.title : "";
    originalTitleInput.value = draft.original.title;
    englishInput.value = draft.original.english;
    chineseTitleInput.value = draft.original.chineseTitle;
    chineseInput.value = draft.original.chinese;
    scenes = draft.scenes;
    vocabulary = draft.vocabulary;
  } catch {
    // Preserve unreadable existing data instead of deleting user content.
  }
}

function normalizeWord(word) {
  return ContentModel.normalizeWord(word);
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
    button.classList.toggle("is-saved", Boolean(vocabulary[normalized]));
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
    token.classList.toggle("is-saved", Boolean(vocabulary[token.dataset.word]));
  });
}

function getContents() {
  return [getDraft().original, ...scenes];
}

function renderContentSwitcher() {
  contentSwitcher.replaceChildren();
  getContents().forEach((content, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "content-tab";
    tab.id = `contentTab${index}`;
    tab.dataset.index = String(index);
    tab.textContent = index === 0 ? "原文" : `场景 ${index}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "articleContent");
    tab.setAttribute("aria-selected", String(index === activeContentIndex));
    tab.tabIndex = index === activeContentIndex ? 0 : -1;
    tab.title = content.title;
    contentSwitcher.append(tab);
  });
}

function showContent(index, { focusTab = false } = {}) {
  const contents = getContents();
  if (!contents[index]) return;
  closeWordCard();
  activeContentIndex = index;
  const content = contents[index];
  readerTitle.textContent = content.title.trim();
  readerChineseTitle.textContent = content.chineseTitle.trim();
  readerChineseTitle.hidden = !content.chineseTitle.trim();
  renderEnglish(content.english);
  document.querySelector("#articleContent").setAttribute("aria-labelledby", `contentTab${index} readerTitle`);
  readerTranslation.textContent = content.chinese;
  translationSection.hidden = !content.chinese.trim();
  closeTranslation();
  renderContentSwitcher();
  if (focusTab) contentSwitcher.querySelector(`[data-index="${index}"]`)?.focus();
}

function clearTemporarySelection() {
  readerEnglish.querySelectorAll(".word-token.is-selected").forEach((token) => {
    token.classList.remove("is-selected");
  });
}

function openWordCard(word, trigger, displayWord = word) {
  const entry = vocabulary[word];
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
    showValidation(titleInput, titleError, "请填写文章标题。");
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
  translationToggleText.textContent = "展开中文翻译";
  readerTranslation.hidden = true;
}

function showReader() {
  activeContentIndex = 0;
  readerUnitTitle.textContent = getDraft().title.trim();
  showContent(activeContentIndex);
  renderVocabulary();

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

readerEnglish.addEventListener("click", (event) => {
  const token = event.target.closest(".word-token");
  if (!token) return;
  clearTemporarySelection();
  if (!vocabulary[token.dataset.word]) token.classList.add("is-selected");
  openWordCard(token.dataset.word, token, token.textContent);
});

contentSwitcher.addEventListener("click", (event) => {
  const tab = event.target.closest(".content-tab");
  if (tab) showContent(Number(tab.dataset.index));
});

contentSwitcher.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const lastIndex = getContents().length - 1;
  let nextIndex = activeContentIndex;
  if (event.key === "ArrowLeft") nextIndex = activeContentIndex === 0 ? lastIndex : activeContentIndex - 1;
  if (event.key === "ArrowRight") nextIndex = activeContentIndex === lastIndex ? 0 : activeContentIndex + 1;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = lastIndex;
  showContent(nextIndex, { focusTab: true });
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
  const isNewWord = !vocabulary[activeWord];
  vocabulary[activeWord] = {
    ...vocabulary[activeWord],
    word: activeDisplayWord.toLocaleLowerCase("en-US"),
    meaning: wordMeaning.value.trim(),
    phonetic: wordPhonetic.value.trim(),
    example: wordExample.value.trim(),
  };
  saveDraft();
  clearTemporarySelection();
  renderVocabulary();
  wordCardSubmit.textContent = "保存修改";
  deleteWord.hidden = false;
  wordCardStatus.textContent = isNewWord ? "已加入生词表并保存到此设备" : "修改已保存到此设备";
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
  const focusable = [...wordCard.querySelectorAll("button, input, textarea")];
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
  if (event.target === structuredImport) return;
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

translationToggle.addEventListener("click", () => {
  const willExpand = translationToggle.getAttribute("aria-expanded") === "false";
  translationToggle.setAttribute("aria-expanded", String(willExpand));
  translationToggleText.textContent = willExpand ? "收起中文翻译" : "展开中文翻译";
  readerTranslation.hidden = !willExpand;
});

backButton.addEventListener("click", showEditor);

importContent.addEventListener("click", () => {
  importStatus.classList.remove("is-error", "is-success");
  try {
    const imported = ContentModel.parseImport(structuredImport.value);
    titleInput.value = imported.articleTitle;
    originalTitleInput.value = imported.original.title;
    englishInput.value = imported.original.english;
    chineseTitleInput.value = imported.original.chineseTitle;
    chineseInput.value = imported.original.chinese;
    scenes = imported.scenes;
    saveDraft();
    clearValidation(titleInput, titleError);
    clearValidation(originalTitleInput, originalTitleError);
    clearValidation(englishInput, englishError);
    importStatus.textContent = "内容导入成功";
    importStatus.classList.add("is-success");
  } catch (error) {
    importStatus.textContent = error.message;
    importStatus.classList.add("is-error");
  }
});

clearImport.addEventListener("click", () => {
  structuredImport.value = "";
  importStatus.textContent = "";
  importStatus.classList.remove("is-error", "is-success");
  structuredImport.focus();
});

loadDraft();
