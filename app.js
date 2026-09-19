const STORAGE_KEY = "english-context-reader-draft";

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

function getDraft() {
  return {
    title: titleInput.value,
    english: englishInput.value,
    chinese: chineseInput.value,
  };
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getDraft()));
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!draft || typeof draft !== "object") return;

    titleInput.value = typeof draft.title === "string" ? draft.title : "";
    englishInput.value = typeof draft.english === "string" ? draft.english : "";
    chineseInput.value = typeof draft.chinese === "string" ? draft.chinese : "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
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
  readerEnglish.textContent = draft.english.trim();
  readerTranslation.textContent = draft.chinese.trim();
  translationSection.hidden = !draft.chinese.trim();
  closeTranslation();

  editorView.hidden = true;
  readerView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  backButton.focus({ preventScroll: true });
}

function showEditor() {
  readerView.hidden = true;
  editorView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  titleInput.focus({ preventScroll: true });
}

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
