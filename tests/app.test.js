const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

class ClassList { constructor(){this.set=new Set()} add(...x){x.forEach(v=>this.set.add(v))} remove(...x){x.forEach(v=>this.set.delete(v))} toggle(x,f){const on=f===undefined?!this.set.has(x):f;on?this.set.add(x):this.set.delete(x);return on} contains(x){return this.set.has(x)} }
class El {
  constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.value='';this.textContent='';this.hidden=false;this.dataset={};this.attrs={};this.children=[];this.listeners={};this.classList=new ClassList();this.style={};this.tabIndex=0}
  set className(v){this.classList.set=new Set(v.split(/\s+/).filter(Boolean))} get className(){return [...this.classList.set].join(' ')}
  setAttribute(k,v){this.attrs[k]=String(v)} removeAttribute(k){delete this.attrs[k]} getAttribute(k){return this.attrs[k]}
  append(x){if(x?.fragment)this.children.push(...x.children);else this.children.push(x)} replaceChildren(...x){this.children=[];x.forEach(v=>this.append(v))}
  addEventListener(t,f){(this.listeners[t]??=[]).push(f)} dispatch(t,p={}){const e={target:this,preventDefault(){},key:'',...p};for(const f of this.listeners[t]||[])f(e)} focus(){document.activeElement=this}
  closest(sel){if(sel.startsWith('.')&&this.classList.contains(sel.slice(1)))return this;if(sel==='button[data-action]'&&this.tagName==='BUTTON'&&this.dataset.action)return this;if(sel==='button[data-filter]'&&this.tagName==='BUTTON'&&this.dataset.filter)return this;return null}
  querySelectorAll(sel){const out=[];const walk=n=>{if(!n?.classList)return;if(sel==='.word-token'&&n.classList.contains('word-token'))out.push(n);if(sel==='.word-token.is-selected'&&n.classList.contains('word-token')&&n.classList.contains('is-selected'))out.push(n);if(sel==='button'&&n.tagName==='BUTTON')out.push(n);n.children.forEach(walk)};this.children.forEach(walk);return out}
  querySelector(sel){const m=sel.match(/\[data-index="(\d+)"\]/);return m?this.children.find(x=>x.dataset.index===m[1]):null}
}
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const map=Object.fromEntries(ids.map(id=>['#'+id,new El('div',id)]));
for(const id of ['articleForm','wordCardForm'])map['#'+id].tagName='FORM';
for(const id of ['wordCard','wordCardBackdrop','readerView','libraryPanel','libraryBackdrop','articleVocabulary','dataPanel','dataBackdrop','backupPreview'])map['#'+id].hidden=true;
for(const filter of ['all','word','phrase']){const b=new El('button');b.dataset.filter=filter;map['#vocabularyFilters'].append(b);const c=new El('button');c.dataset.filter=filter;map['#articleVocabularyFilters'].append(c)}
let selectedImportMode='merge';
const document={activeElement:null,body:new El('body'),querySelector:s=>s==='input[name="importMode"]:checked'?{value:selectedImportMode}:map[s],createElement:t=>new El(t),createTextNode:t=>({textContent:t,nodeType:3}),createDocumentFragment(){const x=new El();x.fragment=true;return x},contains:()=>true,listeners:{},addEventListener(t,f){(this.listeners[t]??=[]).push(f)}};
const legacy={articleTitle:'Legacy unit',original:{title:'Legacy English',english:'Keep  spaces. A well-known writer can\'t stop now.\n\nSecond paragraph.',chineseTitle:'旧标题',chinese:'旧翻译'},scenes:[{title:'Legacy scene',english:'Keep this scene.',chineseTitle:'旧场景',chinese:'场景翻译'}],vocabulary:{keep:{word:'Keep',meaning:'保留'}}};
const store={'english-context-reader-draft':JSON.stringify(legacy)};
const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};
let confirms=[],promptValue=null;
const window={scrollY:0,scrollTo(options){this.scrollY=options?.top||0},listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)},dispatch(type){for(const fn of this.listeners[type]||[])fn()},confirm(){return confirms.length?confirms.shift():false},prompt(){return promptValue},speechSynthesis:{getVoices:()=>[],cancel(){},speak(){}}};
class FileReader { readAsText(file){this.result=file.content;this.onload()} }
const navigator={clipboard:{writeText:async text=>{navigator.copied=text}}};
const context={document,window,localStorage,navigator,FileReader,SpeechSynthesisUtterance:function(){},console,Date,Math};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),context,{filename:'app.js'});
const saved=()=>JSON.parse(store['english-context-reader-library-v4']);

// The actual DOM exposes every phase-four action instead of only implementing its data model.
for(const id of ['editorLibraryButton','editorNewArticleButton','readerLibraryButton','phraseModeButton','vocabularyToggle'])assert.ok(ids.includes(id),`${id} must exist`);
for(const label of ['文章库','词汇表','选择短语','全部','单词','短语'])assert.ok(html.includes(`>${label}<`)||html.includes(`>${label} `),`${label} must be visible`);
assert.ok(css.includes('.reader-nav')&&css.match(/\.reader-nav\s*\{[^}]*flex-wrap:\s*wrap/s),'reader navigation must wrap at iPad landscape widths');
assert.ok(css.match(/\.reader-actions\s*\{[^}]*flex-wrap:\s*wrap/s),'reader actions must not overflow');
for(const id of ['editorLibraryButton','editorNewArticleButton','readerLibraryButton','phraseModeButton','vocabularyToggle'])assert.ok((map['#'+id].listeners.click||[]).length,`${id} must bind a click event`);

// Legacy migration retains article, scene, translation and vocabulary without deleting the old key.
assert.equal(saved().articles.length,1);assert.equal(saved().articles[0].scenes[0].chinese,'场景翻译');assert.equal(saved().articles[0].original.chinese,'旧翻译');assert.equal(saved().vocabulary['word:keep'].meaning,'保留');assert.ok(store['english-context-reader-draft']);

function payload(id,title='Imported unit'){return {id,articleTitle:title,original:{title:'Original title',english:"Hello, brave new-world can't wait.\n\nAnother paragraph.",chineseTitle:'原标题',chinese:'原译'},scenes:[{title:'Scene 1',english:"Brave new-world can't wait here.",chineseTitle:'场景一',chinese:'译文'}]}}
// Import creates a second unit rather than replacing the legacy one.
map['#importText'].value=JSON.stringify(payload('stable-id'));map['#importButton'].dispatch('click');assert.equal(saved().articles.length,2);assert.equal(map['#importStatus'].textContent,'已作为新学习单元导入');
// Duplicate IDs offer overwrite (confirm) or save-as-new (cancel).
confirms=[false];map['#importText'].value=JSON.stringify(payload('stable-id','Copy'));map['#importButton'].dispatch('click');assert.equal(saved().articles.length,3);assert.ok(saved().articles.some(x=>x.articleTitle==='Copy'&&x.id!=='stable-id'));
confirms=[true];map['#importText'].value=JSON.stringify(payload('stable-id','Overwritten'));map['#importButton'].dispatch('click');assert.equal(saved().articles.length,3);assert.equal(saved().articles.find(x=>x.id==='stable-id').articleTitle,'Overwritten');

// Save and open/continue preserve the current article and reading tab.
map['#articleForm'].dispatch('submit');assert.equal(map['#articleTabs'].children.length,2);map['#articleTabs'].dispatch('click',{target:map['#articleTabs'].children[1]});assert.equal(saved().articles.find(x=>x.id==='stable-id').lastContentIndex,1);
// Word selection is temporary until confirmation, then persists; closing cancels it.
let words=map['#readerEnglish'].querySelectorAll('.word-token');let brave=words.find(x=>x.dataset.word==='brave');map['#readerEnglish'].dispatch('click',{target:brave});assert.ok(brave.classList.contains('is-selected'));map['#wordCardClose'].dispatch('click');assert.ok(!brave.classList.contains('is-selected'));map['#readerEnglish'].dispatch('click',{target:brave});map['#wordCardForm'].dispatch('submit');assert.ok(saved().vocabulary['word:brave']);assert.ok(map['#readerEnglish'].querySelectorAll('.word-token').find(x=>x.dataset.word==='brave').classList.contains('is-saved'));

// Phrase mode selects the inclusive range, preserving hyphen/apostrophe and source sentence.
map['#phraseModeButton'].dispatch('click');words=map['#readerEnglish'].querySelectorAll('.word-token');const first=words.find(x=>x.dataset.word==='brave'),last=words.find(x=>x.dataset.word==="can't");map['#readerEnglish'].dispatch('click',{target:first});map['#readerEnglish'].dispatch('click',{target:last});assert.equal(map['#wordCardTitle'].textContent,"Brave new-world can't");assert.ok(words.filter(x=>x.classList.contains('is-selected')).length===3);map['#wordCardClose'].dispatch('click');assert.equal(Object.values(saved().vocabulary).filter(x=>x.type==='phrase').length,0);assert.ok(words.every(x=>!x.classList.contains('is-selected')));
words=map['#readerEnglish'].querySelectorAll('.word-token');const firstAgain=words.find(x=>x.dataset.word==='brave'),lastAgain=words.find(x=>x.dataset.word==="can't");map['#phraseModeButton'].dispatch('click');map['#readerEnglish'].dispatch('click',{target:firstAgain});map['#readerEnglish'].dispatch('click',{target:lastAgain});map['#wordCardForm'].dispatch('submit');let phrase=Object.values(saved().vocabulary).find(x=>x.type==='phrase');assert.equal(phrase.text,"Brave new-world can't");assert.ok(phrase.sources.some(x=>x.articleId==='stable-id'&&x.source.includes("Brave new-world can't wait here.")));

// All/word/phrase filters show the correct item type.
const filters=[...map['#vocabularyFilters'].children];map['#vocabularyFilters'].dispatch('click',{target:filters.find(x=>x.dataset.filter==='phrase')});assert.ok(map['#vocabularyItems'].children.every(x=>x.children[0].textContent.startsWith('短语')));map['#vocabularyFilters'].dispatch('click',{target:filters.find(x=>x.dataset.filter==='word')});assert.ok(map['#vocabularyItems'].children.every(x=>x.children[0].textContent.startsWith('单词')));
map['#vocabularyToggle'].dispatch('click');assert.equal(map['#vocabularyList'].hidden,false);assert.equal(map['#vocabularyToggle'].getAttribute('aria-expanded'),'true');

// Both editor and reader library entry points open the real interface.
map['#editorLibraryButton'].dispatch('click');assert.equal(map['#libraryPanel'].hidden,false);map['#libraryClose'].dispatch('click');
map['#readerLibraryButton'].dispatch('click');assert.equal(map['#libraryPanel'].hidden,false);map['#libraryClose'].dispatch('click');

// Cards expose exactly Open, per-article vocabulary, Rename and Delete; the count is deduplicated.
map['#libraryButton'].dispatch('click');
let targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));
assert.deepEqual(targetCard.children.filter(x=>x.dataset.action).map(x=>x.dataset.action),['open','vocabulary','rename','delete']);
const stableCount=Object.values(saved().vocabulary).filter(x=>x.sources?.some(source=>source.articleId==='stable-id')).length;
assert.equal(targetCard.children.find(x=>x.dataset.action==='vocabulary').textContent,`本篇词汇（${stableCount}）`);

// The article panel contains only associated entries and supports all/word/phrase filters.
map['#libraryItems'].dispatch('click',{target:targetCard.children.find(x=>x.dataset.action==='vocabulary')});
assert.equal(map['#articleVocabulary'].hidden,false);assert.equal(map['#articleVocabularyTitle'].textContent,'《Overwritten》的词汇');
assert.equal(map['#articleVocabularyItems'].children.length,stableCount);
const articleFilters=map['#articleVocabularyFilters'].children;
map['#articleVocabularyFilters'].dispatch('click',{target:articleFilters.find(x=>x.dataset.filter==='phrase')});
assert.ok(map['#articleVocabularyItems'].children.every(row=>row.children[0].textContent.startsWith('短语')));
map['#articleVocabularyFilters'].dispatch('click',{target:articleFilters.find(x=>x.dataset.filter==='word')});
assert.ok(map['#articleVocabularyItems'].children.every(row=>row.children[0].textContent.startsWith('单词')));
map['#articleVocabularyBack'].dispatch('click');

// Reopening with the single Open action restores the last tab and scroll position.
window.scrollY=245;window.dispatch('scroll');
targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));
map['#libraryItems'].dispatch('click',{target:targetCard.children.find(x=>x.dataset.action==='open')});
assert.equal(map['#articleTabs'].children.find(x=>x.getAttribute('aria-selected')==='true').dataset.index,'1');assert.equal(window.scrollY,245);

// Saving an existing word in a second article adds a source without duplicating the global card.
map['#libraryButton'].dispatch('click');let copyCard=map['#libraryItems'].children.find(card=>card.children[0].children[0].textContent==='Copy');
map['#libraryItems'].dispatch('click',{target:copyCard.children.find(x=>x.dataset.action==='open')});
words=map['#readerEnglish'].querySelectorAll('.word-token');const braveAgain=words.find(x=>x.dataset.word==='brave');map['#readerEnglish'].dispatch('click',{target:braveAgain});map['#wordCardForm'].dispatch('submit');
const sharedKey='word:brave';assert.equal(Object.keys(saved().vocabulary).filter(x=>x===sharedKey).length,1);assert.ok(saved().vocabulary[sharedKey].sources.some(x=>x.articleId==='stable-id'));assert.ok(saved().vocabulary[sharedKey].sources.some(x=>x.articleId===copyCard.children.find(x=>x.dataset.id).dataset.id));

// From-this-article removal preserves the global entry and its other article relation.
map['#libraryButton'].dispatch('click');copyCard=map['#libraryItems'].children.find(card=>card.children[0].children[0].textContent==='Copy');
map['#libraryItems'].dispatch('click',{target:copyCard.children.find(x=>x.dataset.action==='vocabulary')});
let sharedRow=map['#articleVocabularyItems'].children.find(row=>row.children[0].dataset.key===sharedKey);confirms=[true];map['#articleVocabularyItems'].dispatch('click',{target:sharedRow.children[1]});
assert.ok(saved().vocabulary[sharedKey]);assert.ok(!saved().vocabulary[sharedKey].sources.some(x=>x.articleId===copyCard.children.find(x=>x.dataset.id).dataset.id));assert.ok(saved().vocabulary[sharedKey].sources.some(x=>x.articleId==='stable-id'));

// Rename and article deletion retain exclusive vocabulary by default and unlink the removed article.
map['#articleVocabularyBack'].dispatch('click');targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));promptValue='Renamed';map['#libraryItems'].dispatch('click',{target:targetCard.children.find(x=>x.dataset.action==='rename')});assert.equal(saved().articles.find(x=>x.id==='stable-id').articleTitle,'Renamed');
targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));confirms=[true,false];map['#libraryItems'].dispatch('click',{target:targetCard.children.find(x=>x.dataset.action==='delete')});assert.ok(!saved().articles.some(x=>x.id==='stable-id'));assert.ok(Object.values(saved().vocabulary).some(x=>x.type==='phrase'&&!x.sources.some(source=>source.articleId==='stable-id')));

// Global deletion is confirmed and removes the card, which also removes all blue associations.
map['#vocabularyFilters'].dispatch('click',{target:filters.find(x=>x.dataset.filter==='all')});const deleteTarget=map['#vocabularyItems'].children[0].children[0],deleteKey=deleteTarget.dataset.key;map['#vocabularyItems'].dispatch('click',{target:deleteTarget});confirms=[true];map['#deleteWord'].dispatch('click');assert.ok(!saved().vocabulary[deleteKey]);

// Stored state contains current id, last reading positions, normalized source arrays and vocabulary.
assert.ok(saved().currentId);assert.ok(saved().articles.every(x=>Number.isInteger(x.lastContentIndex)&&Number.isFinite(x.lastScrollY)));assert.ok(Object.values(saved().vocabulary).every(x=>Array.isArray(x.sources)));

// Phase-five data management is visible and every primary control has a real event handler.
for(const id of ['dataManagementButton','exportDataButton','copyBackupButton','backupFile','previewBackupButton','confirmImportButton','undoImportButton'])assert.ok(ids.includes(id)&&Object.values(map['#'+id].listeners).some(x=>x.length),`${id} must be visible and interactive`);
map['#dataManagementButton'].dispatch('click');assert.equal(map['#dataPanel'].hidden,false);

// A complete export contains the envelope, translations, scenes, vocabulary fields, relations and progress.
const exported=JSON.parse(context.backupJSON());
assert.equal(exported.application,'英语语境阅读器');assert.equal(exported.schemaVersion,1);assert.equal(exported.statistics.articles,saved().articles.length);
assert.ok(exported.data.library.articles.every(x=>'lastContentIndex'in x&&'lastScrollY'in x&&x.original.chinese!==undefined));
assert.ok(Object.values(exported.data.library.vocabulary).every(x=>Array.isArray(x.sources)));
map['#copyBackupButton'].dispatch('click');

// Invalid JSON and structurally incomplete backups never change local data.
let before=store['english-context-reader-library-v4'];map['#backupText'].value='{broken';map['#previewBackupButton'].dispatch('click');assert.equal(store['english-context-reader-library-v4'],before);assert.ok(map['#dataStatus'].textContent.includes('JSON'));
map['#backupText'].value=JSON.stringify({application:'英语语境阅读器',schemaVersion:1,exportedAt:new Date().toISOString(),data:{}});map['#previewBackupButton'].dispatch('click');assert.equal(store['english-context-reader-library-v4'],before);assert.ok(map['#dataStatus'].className.includes('is-error'));

// Merge mode retains local content, deduplicates words/phrases, merges article relations, and safely renames same-title/different-content articles.
const base=saved(),shared=base.vocabulary['word:brave']||Object.values(base.vocabulary)[0];
const incoming={version:5,currentId:'incoming-1',articles:[
  {id:'incoming-1',articleTitle:base.articles[0].articleTitle,original:{title:'Different',english:'Different article body.',chineseTitle:'不同',chinese:'不同译文'},scenes:[{title:'S1',english:'One.',chineseTitle:'一',chinese:'一'}],lastContentIndex:1,lastScrollY:321},
  {id:'incoming-3',articleTitle:'Three scenes',original:{title:'Three',english:'Three body.',chineseTitle:'三',chinese:'译'},scenes:[1,2,3].map(n=>({title:`S${n}`,english:`Scene ${n}.`,chineseTitle:`景${n}`,chinese:`译${n}`})),lastContentIndex:3,lastScrollY:123},
  {id:'incoming-5',articleTitle:'Five scenes',original:{title:'Five',english:'Five body.',chineseTitle:'五',chinese:'译'},scenes:[1,2,3,4,5].map(n=>({title:`S${n}`,english:`Scene ${n}.`,chineseTitle:`景${n}`,chinese:`译${n}`})),lastContentIndex:5,lastScrollY:456}
],vocabulary:{'word:brave':{...shared,type:'word',text:'brave',meaning:'勇敢',sources:[{articleId:'incoming-1',source:'Different article body.'}]},'phrase:train station':{type:'phrase',text:'train station',meaning:'火车站',phonetic:'',example:'Meet at the train station.',sources:[{articleId:'incoming-3',source:'Three body.'}]}}};
const incomingBackup={application:'英语语境阅读器',schemaVersion:1,exportedAt:'2026-09-19T19:29:00.000Z',statistics:{},data:{library:incoming,settings:{currentArticleId:'incoming-1'}}};
map['#backupText'].value=JSON.stringify(incomingBackup);map['#previewBackupButton'].dispatch('click');assert.equal(map['#backupPreview'].hidden,false);assert.ok(map['#backupPreviewDetails'].textContent.includes('安全导入：是'));
selectedImportMode='merge';map['#confirmImportButton'].dispatch('click');let merged=saved();assert.ok(merged.articles.length>=base.articles.length+3);assert.ok(merged.articles.some(x=>x.articleTitle.includes('（导入')));assert.equal(Object.keys(merged.vocabulary).filter(x=>x==='word:brave').length,1);assert.equal(Object.keys(merged.vocabulary).filter(x=>x==='phrase:train station').length,1);assert.ok(merged.vocabulary['word:brave'].sources.some(x=>x.articleId==='incoming-1'));assert.equal(merged.articles.find(x=>x.id==='incoming-3').scenes.length,3);assert.equal(merged.articles.find(x=>x.id==='incoming-5').scenes.length,5);assert.equal(merged.articles.find(x=>x.id==='incoming-5').lastScrollY,456);

// File selection follows the same validate/preview path without writing immediately.
before=store['english-context-reader-library-v4'];map['#backupFile'].files=[{name:'valid.json',content:JSON.stringify(incomingBackup)}];map['#backupFile'].dispatch('change');assert.equal(store['english-context-reader-library-v4'],before);assert.equal(map['#backupPreview'].hidden,false);

// Current raw/old library data is migrated through normalization before import.
map['#backupText'].value=JSON.stringify({version:4,currentId:'old',articles:[{id:'old',articleTitle:'Old backup',original:{title:'Old',english:'Old text.'},scenes:[]}],vocabulary:{this:{word:'this',meaning:'这个'}}});map['#previewBackupButton'].dispatch('click');assert.ok(map['#backupPreviewDetails'].textContent.includes('旧版本数据：是'));

// Replace is double-confirmed, fully restores the backup, and undo is double-confirmed and restores the pre-import snapshot.
const preReplace=store['english-context-reader-library-v4'];map['#backupText'].value=JSON.stringify(incomingBackup);map['#previewBackupButton'].dispatch('click');selectedImportMode='replace';confirms=[true,true];map['#confirmImportButton'].dispatch('click');assert.equal(saved().articles.length,3);assert.equal(saved().articles.find(x=>x.id==='incoming-1').lastContentIndex,1);assert.ok(store['english-context-reader-import-snapshot-v1']);
confirms=[true,true];map['#undoImportButton'].dispatch('click');assert.equal(store['english-context-reader-library-v4'],preReplace);assert.ok(!store['english-context-reader-import-snapshot-v1']);

console.log('Passed: legacy migration; UI behavior; complete backup; JSON/file preview; safe merge/deduplication; old-data migration; replace/undo; 1/3/5 scenes; progress restoration');
