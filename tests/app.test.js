const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...xs) { xs.forEach(x => this.set.add(x)); }
  remove(...xs) { xs.forEach(x => this.set.delete(x)); }
  toggle(x, force) { const on = force === undefined ? !this.set.has(x) : force; on ? this.set.add(x) : this.set.delete(x); return on; }
  contains(x) { return this.set.has(x); }
}
class El {
  constructor(tag='div', id='') { this.tagName=tag.toUpperCase(); this.id=id; this.value=''; this.textContent=''; this.hidden=false; this.dataset={}; this.attrs={}; this.children=[]; this.listeners={}; this.classList=new ClassList(this); this.style={}; this.tabIndex=0; }
  set className(v) { this._className=v; this.classList.set=new Set(v.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classList.set].join(' '); }
  setAttribute(k,v){this.attrs[k]=String(v)} removeAttribute(k){delete this.attrs[k]} getAttribute(k){return this.attrs[k]}
  append(x){ if(x?.fragment) this.children.push(...x.children); else this.children.push(x); }
  replaceChildren(...xs){this.children=[]; xs.forEach(x=>this.append(x));}
  addEventListener(type, fn){(this.listeners[type]??=[]).push(fn)}
  dispatch(type, props={}){const e={target:this, preventDefault(){}, key:'', shiftKey:false,...props}; for(const fn of this.listeners[type]||[]) fn(e);}
  focus(){document.activeElement=this}
  closest(sel){ if(sel.startsWith('.') && this.classList.contains(sel.slice(1))) return this; return null; }
  querySelectorAll(sel){ let all=[]; const walk=n=>{if(!n || !n.classList)return; if(sel==='.word-token'&&n.classList.contains('word-token'))all.push(n); if(sel==='.word-token.is-selected'&&n.classList.contains('word-token')&&n.classList.contains('is-selected'))all.push(n); n.children.forEach(walk)}; this.children.forEach(walk); return all; }
  querySelector(sel){ const m=sel.match(/\[data-index="(\d+)"\]/); if(m)return this.children.find(x=>x.dataset.index===m[1]); return null; }
}
const ids=[...fs.readFileSync(require('path').join(__dirname, '..', 'index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const map=Object.fromEntries(ids.map(id=>['#'+id,new El('div',id)]));
map['#articleForm'].tagName='FORM'; map['#wordCardForm'].tagName='FORM'; map['#wordCard'].hidden=true; map['#wordCardBackdrop'].hidden=true; map['#readerView'].hidden=true;
const document={activeElement:null, body:new El('body'), querySelector:s=>map[s], createElement:t=>new El(t), createTextNode:t=>({textContent:t,nodeType:3}), createDocumentFragment(){const x=new El();x.fragment=true;return x}, contains:()=>true, listeners:{}, addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}};
const store={"english-context-reader-draft":JSON.stringify({title:'Legacy title',english:'Keep  spaces\nand Lines.',chinese:'旧翻译',vocabulary:{keep:{word:'Keep',meaning:'保留'}}})};
const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};
const window={scrollTo(){},speechSynthesis:{getVoices:()=>[],cancel(){},speak(){}}};
const context={document,window,localStorage,SpeechSynthesisUtterance:function(){},console};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, '..', 'app.js'),'utf8'),context,{filename:'app.js'});
assert.equal(map['#articleTitle'].value,'Legacy title');
assert.equal(map['#originalTitle'].value,'Legacy title');
assert.equal(map['#englishText'].value,'Keep  spaces\nand Lines.');
assert.equal(map['#sceneSummary'].textContent,'当前没有场景文章');

function payload(n){return {articleTitle:`Unit ${n}`,original:{title:'Original',english:'Keep  spaces\nand Word.\n\nParagraph',chineseTitle:'原标题',chinese:'原译'},scenes:Array.from({length:n},(_,i)=>({title:`Scene ${i+1}`,english:`WORD scene ${i+1}.`,chineseTitle:i%2?'':`场景${i+1}`,chinese:i%2?'':`译文${i+1}`}))}}
function importN(n){map['#importText'].value=JSON.stringify(payload(n));map['#importButton'].dispatch('click');assert.equal(map['#importStatus'].textContent,'内容导入成功');assert.equal(JSON.parse(store['english-context-reader-draft']).scenes.length,n);assert.ok(JSON.parse(store['english-context-reader-draft']).vocabulary.keep)}
for(const n of [1,3,5]) importN(n);
const before=store['english-context-reader-draft']; map['#importText'].value='{bad'; map['#importButton'].dispatch('click'); assert.equal(store['english-context-reader-draft'],before); assert.ok(map['#importStatus'].classList.contains('is-error'));
map['#articleForm'].dispatch('submit'); assert.equal(map['#articleTabs'].children.length,6); assert.equal(map['#readerTitle'].textContent,'Original');
const textParts=map['#readerEnglish'].children.map(x=>x.textContent).join(''); assert.equal(textParts,payload(5).original.english);
let word=map['#readerEnglish'].children.find(x=>x.classList?.contains('word-token')&&x.dataset.word==='word');
map['#readerEnglish'].dispatch('click',{target:word}); assert.ok(word.classList.contains('is-selected')); map['#wordCardClose'].dispatch('click'); assert.ok(!word.classList.contains('is-selected'));
map['#readerEnglish'].dispatch('click',{target:word}); map['#wordCardForm'].dispatch('submit'); assert.ok(word.classList.contains('is-saved'));
map['#articleTabs'].dispatch('click',{target:map['#articleTabs'].children[1]});
word=map['#readerEnglish'].children.find(x=>x.classList?.contains('word-token')&&x.dataset.word==='word'); assert.ok(word.classList.contains('is-saved'));
map['#readerEnglish'].dispatch('click',{target:word}); map['#deleteWord'].dispatch('click'); assert.ok(!word.classList.contains('is-saved')); assert.ok(!JSON.parse(store['english-context-reader-draft']).vocabulary.word);
console.log('Passed: legacy storage; 1/3/5 scenes; valid/invalid import; exact text; temporary/save/delete; cross-scene sync');
