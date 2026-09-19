const STORAGE_KEY = "english-context-reader-draft";
const WORD_PATTERN = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+(?:[’'][A-Za-z]+)*)*/g;

const editorView = document.querySelector("#editorView");
const readerView = document.querySelector("#readerView");
const articleForm = document.querySelector("#articleForm");
const titleInput = document.querySelector("#articleTitle");
const englishInput = document.querySelector("#englishText");
const chineseInput = document.querySelector("#chineseText");
const titleError = document.querySelector("#titleError");
const englishError = document.querySelector("#englishError");
const readerTitle = document.querySelector("#readerTitle");
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
let activeWord = "";
let activeDisplayWord = "";
let cardTrigger = null;

function getDraft() {
  return {
    title: titleInput.value,
    english: englishInput.value,
    chinese: chineseInput.value,
  };
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getDraft(), vocabulary }));
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!draft || typeof draft !== "object") return;

    titleInput.value = typeof draft.title === "string" ? draft.title : "";
    englishInput.value = typeof draft.english === "string" ? draft.english : "";
    chineseInput.value = typeof draft.chinese === "string" ? draft.chinese : "";
    vocabulary = draft.vocabulary && typeof draft.vocabulary === "object"
      ? draft.vocabulary
      : {};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeWord(word) {
  return word.toLocaleLowerCase("en-US");
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
  clearValidation(englishInput, englishError);

  if (!titleInput.value.trim()) {
    showValidation(titleInput, titleError, "请填写文章标题。");
    titleInput.focus();
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

function showReader() {
  const draft = getDraft();
  readerTitle.textContent = draft.title.trim();
  renderEnglish(draft.english.trim());
  readerTranslation.textContent = draft.chinese.trim();
  translationSection.hidden = !draft.chinese.trim();
  closeTranslation();
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
  saveDraft();
  if (event.target === titleInput) clearValidation(titleInput, titleError);
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
  translationToggleText.textContent = willExpand ? "收起全文翻译" : "展开全文翻译";
  readerTranslation.hidden = !willExpand;
});

backButton.addEventListener("click", showEditor);

loadDraft();
