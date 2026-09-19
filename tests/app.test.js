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
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const map=Object.fromEntries(ids.map(id=>['#'+id,new El('div',id)]));
for(const id of ['articleForm','wordCardForm'])map['#'+id].tagName='FORM';
for(const id of ['wordCard','wordCardBackdrop','readerView','libraryPanel','libraryBackdrop'])map['#'+id].hidden=true;
for(const filter of ['all','word','phrase']){const b=new El('button');b.dataset.filter=filter;map['#vocabularyFilters'].append(b)}
const document={activeElement:null,body:new El('body'),querySelector:s=>map[s],createElement:t=>new El(t),createTextNode:t=>({textContent:t,nodeType:3}),createDocumentFragment(){const x=new El();x.fragment=true;return x},contains:()=>true,listeners:{},addEventListener(t,f){(this.listeners[t]??=[]).push(f)}};
const legacy={articleTitle:'Legacy unit',original:{title:'Legacy English',english:'Keep  spaces. A well-known writer can\'t stop now.\n\nSecond paragraph.',chineseTitle:'旧标题',chinese:'旧翻译'},scenes:[{title:'Legacy scene',english:'Keep this scene.',chineseTitle:'旧场景',chinese:'场景翻译'}],vocabulary:{keep:{word:'Keep',meaning:'保留'}}};
const store={'english-context-reader-draft':JSON.stringify(legacy)};
const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};
let confirms=[],promptValue=null;
const window={scrollTo(){},confirm(){return confirms.length?confirms.shift():false},prompt(){return promptValue},speechSynthesis:{getVoices:()=>[],cancel(){},speak(){}}};
const context={document,window,localStorage,SpeechSynthesisUtterance:function(){},console,Date,Math};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),context,{filename:'app.js'});
const saved=()=>JSON.parse(store['english-context-reader-library-v4']);

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
words=map['#readerEnglish'].querySelectorAll('.word-token');const firstAgain=words.find(x=>x.dataset.word==='brave'),lastAgain=words.find(x=>x.dataset.word==="can't");map['#phraseModeButton'].dispatch('click');map['#readerEnglish'].dispatch('click',{target:firstAgain});map['#readerEnglish'].dispatch('click',{target:lastAgain});map['#wordCardForm'].dispatch('submit');let phrase=Object.values(saved().vocabulary).find(x=>x.type==='phrase');assert.equal(phrase.text,"Brave new-world can't");assert.equal(phrase.articleId,'stable-id');assert.ok(phrase.source.includes("Brave new-world can't wait here."));

// All/word/phrase filters show the correct item type.
const filters=[...map['#vocabularyFilters'].children];map['#vocabularyFilters'].dispatch('click',{target:filters.find(x=>x.dataset.filter==='phrase')});assert.ok(map['#vocabularyItems'].children.every(x=>x.textContent.startsWith('短语')));map['#vocabularyFilters'].dispatch('click',{target:filters.find(x=>x.dataset.filter==='word')});assert.ok(map['#vocabularyItems'].children.every(x=>x.textContent.startsWith('单词')));

// Rename and delete use confirmations; vocabulary is retained by default after article deletion.
map['#libraryButton'].dispatch('click');let targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));promptValue='Renamed';let rename=targetCard.children.find(x=>x.dataset.action==='rename');map['#libraryItems'].dispatch('click',{target:rename});assert.equal(saved().articles.find(x=>x.id==='stable-id').articleTitle,'Renamed');targetCard=map['#libraryItems'].children.find(card=>card.children.some(x=>x.dataset.id==='stable-id'));confirms=[true,false];map['#libraryItems'].dispatch('click',{target:targetCard.children.find(x=>x.dataset.action==='delete')});assert.ok(!saved().articles.some(x=>x.id==='stable-id'));assert.ok(Object.values(saved().vocabulary).some(x=>x.type==='phrase'&&x.articleId==='stable-id'));

// Stored state contains current id, last reading positions and vocabulary, so a reload can restore them.
assert.ok(saved().currentId);assert.ok(saved().articles.every(x=>Number.isInteger(x.lastContentIndex)));assert.ok(Object.keys(saved().vocabulary).length>=3);
console.log('Passed: migration; multi-article CRUD/import choices; reading position; temporary/saved words; phrase select/cancel/save; normalization; filters; safe deletion; persistence');
