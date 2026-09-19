const LEGACY_KEY = "english-context-reader-draft";
const STORAGE_KEY = "english-context-reader-library-v4";
const WORD_PATTERN = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+(?:[’'][A-Za-z]+)*)*/g;
const $ = (selector) => document.querySelector(selector);
const elements = Object.fromEntries([
  "editorView","readerView","articleForm","articleTitle","originalTitle","englishText","chineseTitle","chineseText","titleError","originalTitleError","englishError","importText","importButton","clearImportButton","importStatus","sceneSummary","articleTabs","readerUnitTitle","readerTitle","readerEnglish","readerTranslation","readerChineseTitle","readerChineseText","translationSection","translationToggle","translationToggleText","backButton","vocabularyToggle","vocabularyCount","vocabularyList","vocabularySummary","vocabularyItems","vocabularyEmpty","vocabularyFilters","wordCard","wordCardBackdrop","wordCardClose","wordCardTitle","wordCardForm","wordMeaning","wordPhonetic","wordExample","wordSource","wordCardStatus","wordCardSubmit","speakWord","deleteWord","phraseModeButton","libraryButton","editorLibraryButton","readerLibraryButton","editorNewArticleButton","libraryBackdrop","libraryPanel","libraryClose","libraryItems","libraryEmpty","libraryStatus","newArticleButton","saveArticleButton","articleVocabulary","articleVocabularyBack","articleVocabularyTitle","articleVocabularySummary","articleVocabularyFilters","articleVocabularyItems","articleVocabularyEmpty","libraryTitle"
].map((id) => [id, $(`#${id}`)]));
Object.assign(globalThis, elements);

let state = { version: 5, currentId: null, articles: [], vocabulary: {} };
let scenes = [], activeContentIndex = 0, activeEntryKey = "", activeDisplayWord = "", cardTrigger = null;
let phraseMode = false, phraseStart = null, pendingPhrase = null, vocabularyFilter = "all", libraryTrigger = null;
let articleVocabularyId = null, articleVocabularyFilter = "all";

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function uid() { return `article-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function now() { return new Date().toISOString(); }
function normalizeText(value) { return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"); }
function normalizeWord(value) { return String(value || "").toLocaleLowerCase("en-US"); }
function normalizeArticlePart(article) {
  return { title: typeof article?.title === "string" ? article.title : "", english: typeof article?.english === "string" ? article.english : "", chineseTitle: typeof article?.chineseTitle === "string" ? article.chineseTitle : "", chinese: typeof article?.chinese === "string" ? article.chinese : "" };
}
function copyVocabulary(saved) {
  const result = {};
  if (!isPlainObject(saved)) return result;
  Object.entries(saved).forEach(([key, raw]) => {
    if (!isPlainObject(raw)) return;
    const text = raw.text || raw.word || key.replace(/^(word|phrase):/, "");
    const type = raw.type === "phrase" || key.startsWith("phrase:") ? "phrase" : "word";
    const finalKey = `${type}:${type === "phrase" ? normalizeText(text) : normalizeWord(text)}`;
    const sources = [];
    const addSource = (articleId, sentence) => {
      const id = typeof articleId === "string" && articleId ? articleId : null;
      const source = typeof sentence === "string" ? sentence : "";
      if (!sources.some(item => item.articleId === id && item.source === source)) sources.push({ articleId: id, source });
    };
    if (Array.isArray(raw.sources)) raw.sources.forEach(item => isPlainObject(item) && addSource(item.articleId || item.sourceArticleId, item.source || item.sentence));
    if (Array.isArray(raw.sourceArticles)) raw.sourceArticles.forEach(item => typeof item === "string" ? addSource(item, "") : isPlainObject(item) && addSource(item.articleId || item.id, item.source || item.sentence));
    if (raw.articleId || raw.sourceArticleId || raw.source) addSource(raw.articleId || raw.sourceArticleId, raw.source);
    const previous = result[finalKey];
    result[finalKey] = { ...previous, ...raw, type, text, word: raw.word || text, createdAt: previous?.createdAt || raw.createdAt || now(), sources: [...(previous?.sources || []), ...sources].filter((item, index, all) => all.findIndex(x => x.articleId === item.articleId && x.source === item.source) === index) };
    ["articleId", "sourceArticleId", "sourceArticles", "source"].forEach(field => delete result[finalKey][field]);
  });
  return result;
}
function migrateLegacy() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isPlainObject(saved) && Array.isArray(saved.articles)) {
      state = { version: 5, currentId: saved.currentId || null, articles: saved.articles.map(normalizeUnit), vocabulary: copyVocabulary(saved.vocabulary) };
      if (!state.articles.some((item) => item.id === state.currentId)) state.currentId = state.articles[0]?.id || null;
      saveState();
      return;
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (!isPlainObject(legacy)) return;
    const original = normalizeArticlePart(isPlainObject(legacy.original) ? legacy.original : { title: legacy.title, english: legacy.english, chineseTitle: legacy.chineseTitle, chinese: legacy.chinese });
    const createdAt = now();
    const unit = normalizeUnit({ id: uid(), articleTitle: legacy.articleTitle || legacy.title || original.title || "未命名文章", original, scenes: Array.isArray(legacy.scenes) ? legacy.scenes : [], createdAt, updatedAt: createdAt, lastContentIndex: 0 });
    state = { version: 5, currentId: unit.id, articles: [unit], vocabulary: copyVocabulary(legacy.vocabulary) };
    saveState();
  } catch { /* Never alter malformed source storage. */ }
}
function normalizeUnit(raw) {
  const createdAt = typeof raw?.createdAt === "string" ? raw.createdAt : now();
  return { id: typeof raw?.id === "string" && raw.id ? raw.id : uid(), articleTitle: typeof raw?.articleTitle === "string" ? raw.articleTitle : (raw?.title || "未命名文章"), original: normalizeArticlePart(raw?.original || raw), scenes: Array.isArray(raw?.scenes) ? raw.scenes.slice(0, 5).map(normalizeArticlePart) : [], createdAt, updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : createdAt, lastContentIndex: Number.isInteger(raw?.lastContentIndex) ? raw.lastContentIndex : 0, lastScrollY: Number.isFinite(raw?.lastScrollY) ? raw.lastScrollY : 0 };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function currentUnit() { return state.articles.find((item) => item.id === state.currentId) || null; }
function getOriginal() { return { title: originalTitle.value, english: englishText.value, chineseTitle: chineseTitle.value, chinese: chineseText.value }; }
function fillEditor(unit) {
  articleTitle.value = unit?.articleTitle || ""; originalTitle.value = unit?.original.title || ""; englishText.value = unit?.original.english || ""; chineseTitle.value = unit?.original.chineseTitle || ""; chineseText.value = unit?.original.chinese || ""; scenes = unit?.scenes.map(normalizeArticlePart) || []; activeContentIndex = unit?.lastContentIndex || 0; updateSceneSummary();
}
function saveCurrent(showStatus = false) {
  if (!state.currentId) state.currentId = uid();
  const old = currentUnit(); const stamp = now();
  const unit = normalizeUnit({ id: state.currentId, articleTitle: articleTitle.value.trim() || "未命名文章", original: getOriginal(), scenes, createdAt: old?.createdAt || stamp, updatedAt: stamp, lastContentIndex: activeContentIndex });
  const index = state.articles.findIndex((item) => item.id === unit.id);
  if (index < 0) state.articles.push(unit); else state.articles[index] = unit;
  saveState(); renderLibrary();
  if (showStatus) libraryStatus.textContent = "当前文章已保存到此设备。";
  return unit;
}
function getContents() { return [getOriginal(), ...scenes]; }
function updateSceneSummary() { sceneSummary.textContent = scenes.length ? `当前已保存 ${scenes.length} 篇场景文章：${scenes.map((x) => x.title).join("、")}` : "当前没有场景文章"; }
function clearValidation(input, output) { input.classList.remove("invalid"); input.removeAttribute("aria-invalid"); output.textContent = ""; }
function showValidation(input, output, message) { input.classList.add("invalid"); input.setAttribute("aria-invalid", "true"); output.textContent = message; }
function validateDraft() {
  [[articleTitle,titleError,"请填写学习单元标题。"],[originalTitle,originalTitleError,"请填写原文英文标题。"],[englishText,englishError,"请粘贴英文原文。"]].forEach(([input,out]) => clearValidation(input,out));
  for (const [input,out,message] of [[articleTitle,titleError,"请填写学习单元标题。"],[originalTitle,originalTitleError,"请填写原文英文标题。"],[englishText,englishError,"请粘贴英文原文。"]]) if (!input.value.trim()) { showValidation(input,out,message); input.focus(); return false; }
  return true;
}
function wordKey(word) { return `word:${normalizeWord(word)}`; }
function getWordEntry(word) { return state.vocabulary[wordKey(word)] || null; }
function entryArticleIds(entry) { return [...new Set((entry.sources || []).map(item => item.articleId).filter(Boolean))]; }
function isEntryInArticle(entry, articleId) { return entryArticleIds(entry).includes(articleId); }
function articlePhraseEntries() { return Object.entries(state.vocabulary).filter(([,entry]) => entry.type === "phrase" && isEntryInArticle(entry, state.currentId)); }
function sourceSentence(text, start, end) { const left = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("!", start - 1), text.lastIndexOf("?", start - 1), text.lastIndexOf("\n", start - 1)); const after = [text.indexOf(".", end), text.indexOf("!", end), text.indexOf("?", end), text.indexOf("\n", end)].filter((n) => n >= 0); const right = after.length ? Math.min(...after) + 1 : text.length; return text.slice(left + 1, right).trim(); }
function renderEnglish(text) {
  const fragment = document.createDocumentFragment(); let cursor = 0, tokenIndex = 0; const tokens = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    fragment.append(document.createTextNode(text.slice(cursor, match.index)));
    const button = document.createElement("button"); button.type = "button"; button.className = "word-token"; button.dataset.word = normalizeWord(match[0]); button.dataset.index = String(tokenIndex); button.dataset.start = String(match.index); button.dataset.end = String(match.index + match[0].length); button.dataset.paragraph = String(text.slice(0, match.index).split(/\n\s*\n/).length - 1); button.textContent = match[0]; button.setAttribute("aria-label", `${match[0]}，打开词卡`); button.classList.toggle("is-saved", Boolean(getWordEntry(match[0]) && isEntryInArticle(getWordEntry(match[0]), state.currentId))); fragment.append(button); tokens.push({ button, text: match[0] }); cursor = match.index + match[0].length; tokenIndex++;
  }
  fragment.append(document.createTextNode(text.slice(cursor))); readerEnglish.replaceChildren(fragment);
  for (const [,entry] of articlePhraseEntries()) {
    const wanted = entry.text.match(WORD_PATTERN)?.map(normalizeWord) || [];
    for (let i=0; i<=tokens.length-wanted.length; i++) if (wanted.length && wanted.every((w,j) => normalizeWord(tokens[i+j].text) === w)) for (let j=0;j<wanted.length;j++) tokens[i+j].button.classList.add("is-saved","is-phrase");
  }
}
function renderTabs() { articleTabs.replaceChildren(); getContents().forEach((_,index) => { const tab=document.createElement("button"); tab.type="button"; tab.className="article-tab"; tab.dataset.index=String(index); tab.setAttribute("role","tab"); tab.setAttribute("aria-selected",String(index===activeContentIndex)); tab.tabIndex=index===activeContentIndex?0:-1; tab.textContent=index?`场景${index}`:"原文"; tab.setAttribute("aria-label",`阅读${tab.textContent}`); articleTabs.append(tab); }); }
function renderActiveContent() { const contents=getContents(); if(activeContentIndex>=contents.length)activeContentIndex=0; const content=contents[activeContentIndex]; readerUnitTitle.textContent=articleTitle.value.trim(); readerTitle.textContent=content.title; renderEnglish(content.english); readerChineseTitle.textContent=content.chineseTitle; readerChineseTitle.hidden=!content.chineseTitle.trim(); readerChineseText.textContent=content.chinese; translationSection.hidden=!content.chineseTitle.trim()&&!content.chinese.trim(); closeTranslation(); renderTabs(); renderVocabulary(); const unit=currentUnit(); if(unit){unit.lastContentIndex=activeContentIndex;saveState();} }
function sourceForArticle(entry, articleId) { return (entry.sources || []).find(item => item.articleId === articleId)?.source || (entry.sources || []).find(item => item.source)?.source || "暂无来源原句"; }
function makeVocabularyItem(key, entry, articleId = null) {
  const row=document.createElement("div"); row.className="vocabulary-item-row";
  const button=document.createElement("button"); button.type="button"; button.className="vocabulary-item"; button.dataset.key=key;
  button.textContent=`${entry.type === "phrase" ? "短语" : "单词"} · ${entry.text} · ${entry.meaning || "暂无中文释义"} · ${sourceForArticle(entry, articleId)}`;
  button.setAttribute("aria-label",`打开${entry.text}的词卡`); row.append(button);
  if (articleId) { const remove=document.createElement("button"); remove.type="button"; remove.className="remove-article-word"; remove.dataset.action="remove-vocabulary"; remove.dataset.key=key; remove.textContent="从本篇移除"; remove.setAttribute("aria-label",`从本篇移除${entry.text}`); row.append(remove); }
  return row;
}
function renderVocabulary() { const entries=Object.entries(state.vocabulary).filter(([,e])=>vocabularyFilter==="all"||e.type===vocabularyFilter).sort((a,b)=>a[1].text.localeCompare(b[1].text,"en")); const total=Object.keys(state.vocabulary).length; vocabularyCount.textContent=String(total); vocabularySummary.textContent=`显示 ${entries.length} / 共 ${total} 个`; vocabularyEmpty.hidden=entries.length>0; vocabularyItems.replaceChildren(); entries.forEach(([key,e])=>vocabularyItems.append(makeVocabularyItem(key,e))); }
function renderArticleVocabulary() { const unit=state.articles.find(x=>x.id===articleVocabularyId); if(!unit)return; const all=Object.entries(state.vocabulary).filter(([,e])=>isEntryInArticle(e,unit.id)); const shown=all.filter(([,e])=>articleVocabularyFilter==="all"||e.type===articleVocabularyFilter); articleVocabularyTitle.textContent=`《${unit.articleTitle}》的词汇`; articleVocabularySummary.textContent=`显示 ${shown.length} / 共 ${all.length} 个`; articleVocabularyEmpty.hidden=shown.length>0; articleVocabularyItems.replaceChildren(); shown.sort((a,b)=>a[1].text.localeCompare(b[1].text,"en")).forEach(([key,e])=>articleVocabularyItems.append(makeVocabularyItem(key,e,unit.id))); }
function clearTemporarySelection(){readerEnglish.querySelectorAll(".word-token.is-selected").forEach((x)=>x.classList.remove("is-selected"));}
function openCard(key, trigger, draft=null) { const entry=state.vocabulary[key]; activeEntryKey=key; activeDisplayWord=entry?.text||draft?.text||""; pendingPhrase=draft; cardTrigger=trigger||document.activeElement; wordCardTitle.textContent=activeDisplayWord; wordMeaning.value=entry?.meaning||"";wordPhonetic.value=entry?.phonetic||"";wordExample.value=entry?.example||"";wordSource.value=sourceForArticle(entry||{sources:[]},articleVocabularyId||state.currentId);if(!entry)wordSource.value=draft?.source||"";wordCardSubmit.textContent=entry?"保存修改":"加入词汇表";deleteWord.hidden=!entry;const names=entryArticleIds(entry||{}).map(id=>state.articles.find(x=>x.id===id)?.articleTitle).filter(Boolean);wordCardStatus.textContent=names.length?`来源文章：${names.join("、")}`:"未归属文章";wordCard.hidden=false;wordCardBackdrop.hidden=false;document.body.style.overflow="hidden";wordCardClose.focus(); }
function closeCard(){if(wordCard.hidden)return;clearTemporarySelection();wordCard.hidden=true;wordCardBackdrop.hidden=true;document.body.style.overflow="";activeEntryKey="";pendingPhrase=null;if(cardTrigger&&document.contains(cardTrigger))cardTrigger.focus();cardTrigger=null;}
function setPhraseMode(on){phraseMode=on;phraseStart=null;pendingPhrase=null;clearTemporarySelection();phraseModeButton.setAttribute("aria-pressed",String(on));phraseModeButton.textContent=on?"取消选择":"选择短语";phraseModeButton.setAttribute("aria-label",on?"取消选择短语模式":"开启选择短语模式");readerEnglish.classList.toggle("phrase-mode",on);}
function handlePhraseToken(token){const paragraph=token.dataset.paragraph;if(!phraseStart){phraseStart=token;token.classList.add("is-selected");phraseModeButton.textContent="请选择结束词";return;}if(phraseStart.dataset.paragraph!==paragraph){clearTemporarySelection();phraseStart=token;token.classList.add("is-selected");phraseModeButton.textContent="不能跨段，请选择结束词";return;}const all=[...readerEnglish.querySelectorAll(".word-token")];let a=all.indexOf(phraseStart),b=all.indexOf(token);if(a>b)[a,b]=[b,a];all.slice(a,b+1).forEach(x=>x.classList.add("is-selected"));const content=getContents()[activeContentIndex].english;const start=Number(all[a].dataset.start),end=Number(all[b].dataset.end);const text=content.slice(start,end).replace(/^[\s,.;:!?"“”‘’()[\]{}]+|[\s,.;:!?"“”‘’()[\]{}]+$/g,"");const key=`phrase:${normalizeText(text)}`;setPhraseMode(false);openCard(key,token,{type:"phrase",text,articleId:state.currentId,source:sourceSentence(content,start,end)});all.slice(a,b+1).forEach(x=>x.classList.add("is-selected"));}
function closeTranslation(){translationToggle.setAttribute("aria-expanded","false");translationToggleText.textContent="展开全文翻译";readerTranslation.hidden=true;}
function showReader(){const unit=currentUnit();activeContentIndex=unit?.lastContentIndex||0;renderActiveContent();vocabularyList.hidden=true;vocabularyToggle.setAttribute("aria-expanded","false");editorView.hidden=true;readerView.hidden=false;window.scrollTo({top:unit?.lastScrollY||0});backButton.focus();}
function showEditor(){closeCard();setPhraseMode(false);readerView.hidden=true;editorView.hidden=false;window.scrollTo({top:0});articleTitle.focus();}
function renderLibrary(){libraryItems.replaceChildren();libraryEmpty.hidden=state.articles.length>0;state.articles.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).forEach(unit=>{const card=document.createElement("article");card.className="library-card";const related=Object.values(state.vocabulary).filter(e=>isEntryInArticle(e,unit.id)).length;const info=document.createElement("div"),heading=document.createElement("h3"),original=document.createElement("p"),meta=document.createElement("p");heading.textContent=unit.articleTitle;original.className="library-chinese";original.textContent=unit.original.title||"暂无英文标题";meta.className="library-meta";meta.textContent=`${unit.scenes.length} 个场景 · ${related} 个词汇 · ${new Date(unit.updatedAt).toLocaleString("zh-CN")}`;info.append(heading);info.append(original);info.append(meta);card.append(info);[["open","打开"],["vocabulary",`本篇词汇（${related}）`],["rename","重命名"],["delete","删除"]].forEach(([action,label])=>{const b=document.createElement("button");b.type="button";b.dataset.action=action;b.dataset.id=unit.id;b.textContent=label;b.setAttribute("aria-label",`${label}，${unit.articleTitle}`);if(action==="delete")b.className="danger-text";card.append(b);});libraryItems.append(card);});}
function showLibraryList(){articleVocabularyId=null;articleVocabulary.hidden=true;libraryItems.hidden=false;libraryEmpty.hidden=state.articles.length>0;newArticleButton.hidden=false;saveArticleButton.hidden=false;libraryTitle.textContent="文章库";}
function openLibrary(event){libraryTrigger=event?.currentTarget||document.activeElement;renderLibrary();showLibraryList();libraryPanel.hidden=false;libraryBackdrop.hidden=false;document.body.style.overflow="hidden";libraryClose.focus();}
function closeLibrary(){articleVocabularyId=null;libraryPanel.hidden=true;libraryBackdrop.hidden=true;document.body.style.overflow="";if(libraryTrigger&&document.contains(libraryTrigger))libraryTrigger.focus();libraryTrigger=null;}
function createNewArticle(){state.currentId=uid();fillEditor(null);saveState();closeLibrary();showEditor();}
function openUnit(id){const unit=state.articles.find(x=>x.id===id);if(!unit)return;state.currentId=id;fillEditor(unit);saveState();closeLibrary();showReader();}
function parseImport(value){let x;try{x=JSON.parse(value)}catch{throw new Error("JSON 格式无效，请检查引号、逗号和括号。")}if(!isPlainObject(x)||typeof x.articleTitle!=="string"||!x.articleTitle.trim())throw new Error("articleTitle 必须是非空字符串。");if(!isPlainObject(x.original)||!x.original.title?.trim()||!x.original.english?.trim())throw new Error("original 必须包含英文标题 title 和正文 english。");if(!Array.isArray(x.scenes)||x.scenes.length<1||x.scenes.length>5)throw new Error("scenes 必须包含 1～5 篇场景文章。");x.scenes.forEach((s,i)=>{if(!isPlainObject(s)||!s.title?.trim()||!s.english?.trim())throw new Error(`场景${i+1}缺少 title 或 english。`)});return normalizeUnit({...x,id:typeof x.id==="string"?x.id:uid(),createdAt:x.createdAt||now(),updatedAt:now()});}

readerEnglish.addEventListener("click",e=>{const token=e.target.closest(".word-token");if(!token)return;if(phraseMode)return handlePhraseToken(token);clearTemporarySelection();const key=wordKey(token.dataset.word);if(!state.vocabulary[key])token.classList.add("is-selected");const content=getContents()[activeContentIndex].english;openCard(key,token,{type:"word",text:token.textContent,articleId:state.currentId,source:sourceSentence(content,Number(token.dataset.start),Number(token.dataset.end))});});
phraseModeButton.addEventListener("click",()=>setPhraseMode(!phraseMode));
articleTabs.addEventListener("click",e=>{const tab=e.target.closest(".article-tab");if(!tab)return;closeCard();setPhraseMode(false);activeContentIndex=Number(tab.dataset.index);renderActiveContent();});
articleTabs.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();activeContentIndex=(activeContentIndex+(e.key==="ArrowRight"?1:-1)+getContents().length)%getContents().length;renderActiveContent();articleTabs.querySelector(`[data-index="${activeContentIndex}"]`)?.focus();});
vocabularyToggle.addEventListener("click",()=>{const open=vocabularyList.hidden;vocabularyList.hidden=!open;vocabularyToggle.setAttribute("aria-expanded",String(open));});
vocabularyFilters.addEventListener("click",e=>{const b=e.target.closest("button[data-filter]");if(!b)return;vocabularyFilter=b.dataset.filter;[...vocabularyFilters.querySelectorAll("button")].forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderVocabulary();});
vocabularyItems.addEventListener("click",e=>{const item=e.target.closest(".vocabulary-item");if(item)openCard(item.dataset.key,item);});
wordCardForm.addEventListener("submit",e=>{e.preventDefault();if(!activeEntryKey)return;const old=state.vocabulary[activeEntryKey],draft=pendingPhrase||{};const articleId=draft.articleId||articleVocabularyId||state.currentId||null;const sources=[...(old?.sources||[])];const sourceIndex=sources.findIndex(item=>item.articleId===articleId);const sourceRecord={articleId,source:wordSource.value.trim()};if(sourceIndex<0)sources.push(sourceRecord);else sources[sourceIndex]=sourceRecord;state.vocabulary[activeEntryKey]={...old,type:old?.type||draft.type||"word",text:old?.text||draft.text||activeDisplayWord,word:old?.word||draft.text||activeDisplayWord,meaning:wordMeaning.value.trim(),phonetic:wordPhonetic.value.trim(),example:wordExample.value.trim(),sources,createdAt:old?.createdAt||now()};saveState();clearTemporarySelection();renderActiveContent();renderLibrary();if(articleVocabularyId)renderArticleVocabulary();wordCardSubmit.textContent="保存修改";deleteWord.hidden=false;wordCardStatus.textContent=old?"修改已保存到此设备":"已加入词汇表并保存到此设备";pendingPhrase=null;});
deleteWord.addEventListener("click",()=>{if(!activeEntryKey)return;if(!window.confirm("彻底删除后，该词汇会从总词汇表移除，并在所有相关文章中取消标蓝。确定删除吗？"))return;delete state.vocabulary[activeEntryKey];saveState();renderActiveContent();renderVocabulary();renderLibrary();if(articleVocabularyId)renderArticleVocabulary();closeCard();});
speakWord.addEventListener("click",()=>{if(!activeDisplayWord||!("speechSynthesis" in window)){wordCardStatus.textContent="当前浏览器不支持系统朗读。";return;}const u=new SpeechSynthesisUtterance(activeDisplayWord);u.lang="en-US";const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==="en-US")||voices.find(v=>v.lang.startsWith("en"))||null;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);});
wordCardClose.addEventListener("click",closeCard);wordCardBackdrop.addEventListener("click",closeCard);
articleForm.addEventListener("input",e=>{if(e.target===importText){importStatus.textContent="";return;}if(state.currentId)saveCurrent();});
articleForm.addEventListener("submit",e=>{e.preventDefault();if(!validateDraft())return;saveCurrent();showReader();});
importButton.addEventListener("click",()=>{try{let unit=parseImport(importText.value);const duplicate=state.articles.find(x=>x.id===unit.id);if(duplicate){const overwrite=window.confirm("发现相同 id。确定：覆盖现有文章；取消：另存为新文章。");if(!overwrite)unit={...unit,id:uid(),createdAt:now()};}state.currentId=unit.id;const i=state.articles.findIndex(x=>x.id===unit.id);if(i<0)state.articles.push(unit);else state.articles[i]=unit;fillEditor(unit);saveState();renderLibrary();importStatus.textContent=duplicate&&unit.id===duplicate.id?"已覆盖现有文章":"已作为新学习单元导入";importStatus.className="import-status is-success";}catch(error){importStatus.textContent=error.message;importStatus.className="import-status is-error";}});
clearImportButton.addEventListener("click",()=>{importText.value="";importStatus.textContent="";importText.focus();});
translationToggle.addEventListener("click",()=>{const open=translationToggle.getAttribute("aria-expanded")==="false";translationToggle.setAttribute("aria-expanded",String(open));translationToggleText.textContent=open?"收起全文翻译":"展开全文翻译";readerTranslation.hidden=!open;});
backButton.addEventListener("click",showEditor);
[libraryButton,editorLibraryButton,readerLibraryButton].forEach(button=>button.addEventListener("click",openLibrary));libraryClose.addEventListener("click",closeLibrary);libraryBackdrop.addEventListener("click",closeLibrary);saveArticleButton.addEventListener("click",()=>saveCurrent(true));
[newArticleButton,editorNewArticleButton].forEach(button=>button.addEventListener("click",createNewArticle));
function openArticleVocabulary(id){articleVocabularyId=id;articleVocabularyFilter="all";libraryItems.hidden=true;libraryEmpty.hidden=true;newArticleButton.hidden=true;saveArticleButton.hidden=true;articleVocabulary.hidden=false;libraryTitle.textContent="本篇词汇";[...articleVocabularyFilters.querySelectorAll("button")].forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.filter==="all")));renderArticleVocabulary();articleVocabularyBack.focus();}
articleVocabularyBack.addEventListener("click",()=>{renderLibrary();showLibraryList();});
articleVocabularyFilters.addEventListener("click",e=>{const button=e.target.closest("button[data-filter]");if(!button)return;articleVocabularyFilter=button.dataset.filter;[...articleVocabularyFilters.querySelectorAll("button")].forEach(item=>item.setAttribute("aria-pressed",String(item===button)));renderArticleVocabulary();});
articleVocabularyItems.addEventListener("click",e=>{const remove=e.target.closest("button[data-action]");if(remove?.dataset.action==="remove-vocabulary"){const entry=state.vocabulary[remove.dataset.key];if(!entry||!window.confirm(`确定从本篇移除“${entry.text}”吗？这不会从总词汇表删除。`))return;entry.sources=(entry.sources||[]).filter(item=>item.articleId!==articleVocabularyId);if(!entryArticleIds(entry).length&&window.confirm("该词汇已没有任何文章来源。是否从总词汇表彻底删除？取消将默认保留。"))delete state.vocabulary[remove.dataset.key];saveState();renderArticleVocabulary();renderLibrary();renderVocabulary();return;}const item=e.target.closest(".vocabulary-item");if(item)openCard(item.dataset.key,item);});
libraryItems.addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const unit=state.articles.find(x=>x.id===b.dataset.id);if(!unit)return;if(b.dataset.action==="open")openUnit(unit.id);if(b.dataset.action==="vocabulary")openArticleVocabulary(unit.id);if(b.dataset.action==="rename"){const name=window.prompt("输入新的学习单元标题",unit.articleTitle);if(name?.trim()){unit.articleTitle=name.trim();unit.updatedAt=now();if(unit.id===state.currentId)articleTitle.value=unit.articleTitle;saveState();renderLibrary();}}if(b.dataset.action==="delete"){if(!window.confirm(`确定删除“${unit.articleTitle}”吗？文章关联会解除，但词汇默认保留。`))return;const exclusive=Object.entries(state.vocabulary).filter(([,entry])=>isEntryInArticle(entry,unit.id)&&entryArticleIds(entry).length===1);const deleteExclusive=exclusive.length&&window.confirm(`有 ${exclusive.length} 个词汇只来源于此文章。是否一并从总词汇表删除？取消将默认保留为“未归属文章”。`);Object.entries(state.vocabulary).forEach(([key,entry])=>{if(deleteExclusive&&exclusive.some(([exclusiveKey])=>exclusiveKey===key)){delete state.vocabulary[key];return;}entry.sources=(entry.sources||[]).filter(item=>item.articleId!==unit.id);});state.articles=state.articles.filter(x=>x.id!==unit.id);if(state.currentId===unit.id){state.currentId=state.articles[0]?.id||null;fillEditor(currentUnit());}saveState();renderLibrary();renderVocabulary();}});
window.addEventListener?.("scroll",()=>{const unit=currentUnit();if(!readerView.hidden&&unit){unit.lastScrollY=window.scrollY||0;saveState();}},{passive:true});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!wordCard.hidden)closeCard();else if(!libraryPanel.hidden)closeLibrary();else if(phraseMode)setPhraseMode(false);}});

migrateLegacy();fillEditor(currentUnit());renderLibrary();renderVocabulary();
