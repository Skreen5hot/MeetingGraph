// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// T-UX Phase 4: Board attention-first + search/filters/compact; Dashboard plain-language signals + epistemics
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',beforeParse(w){
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  Object.defineProperty(w,'indexedDB',{value:indexedDB});
  Object.defineProperty(w.navigator,'storage',{value:{persist:async()=>true}});
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{},write:async()=>{}}});
  w.ClipboardItem=class{constructor(i){this.items=i}};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}; w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.confirm=()=>true; w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  // import the sample meeting so the register has two meetings of history
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('do-segment').click(); await sleep(200);
  $('sample-output').click(); $('do-validate').click(); await sleep(150);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);

  // ---- Board ----
  d.querySelector('[data-tab="board"]').click(); await sleep(50);
  const panel=()=>$('panel');
  const heads=()=>[...panel().querySelectorAll('.snap h3')].map(h=>h.textContent);
  console.log('1. no prominent empty Blocked card anywhere:', !/Nothing is blocked\./.test(panel().textContent));
  console.log('2. attention is one list or one quiet line:',
    heads().some(h=>/^Needs attention/.test(h)) || /Nothing needs attention — no overdue, blocked, or ownerless work\./.test(panel().textContent));
  console.log('3. "Changed at this meeting" answers what changed:', heads().some(h=>/^Changed at this meeting/.test(h)));

  // walk every project: each panel must answer attention/changed/responsible
  const projBtns=[...d.querySelectorAll('#projects .proj')].map(b=>b.dataset.project);
  let allOk=true, attentionSeen=false, quietSeen=false, notDiscussedSeen=false;
  for (const code of projBtns) {
    d.querySelector(`#projects .proj[data-project="${code}"]`).click(); await sleep(30);
    const hs=heads(), txt=panel().textContent;
    const attn=hs.some(h=>/^Needs attention/.test(h)), quiet=/Nothing needs attention/.test(txt);
    if (attn) attentionSeen=true; if (quiet) quietSeen=true;
    if (/Not discussed at the .* meeting\./.test(txt)) notDiscussedSeen=true;
    if (!( (attn||quiet) && hs.some(h=>/^Changed at this meeting/.test(h)) && hs.some(h=>/^Open work by owner/.test(h)) )) allOk=false;
  }
  console.log('4. every project panel answers all three questions:', allOk);
  console.log('   both attention states occur across the register:', attentionSeen, quietSeen||notDiscussedSeen);

  // search
  d.querySelector(`#projects .proj[data-project="P2"]`).click(); await sleep(30);
  const lis=()=>[...panel().querySelectorAll('.ownerwork li')];
  $('bd-search').value='interconnection'; $('bd-search').dispatchEvent(new w.Event('input',{bubbles:true}));
  const vis=lis().filter(li=>!li.hidden);
  console.log('5. search narrows the open list + count line:', vis.length>=1 && vis.every(li=>/interconnection/.test(li.dataset.s)), /Showing \d+ of \d+ open items\./.test($('bd-count').textContent));
  $('bd-search').value=''; $('bd-search').dispatchEvent(new w.Event('input',{bubbles:true}));

  // filters: every visible item carries the filter flag; owner groups with no hits hide
  let filtersOk=true;
  for (const mode of ['overdue','blocked','unassigned']) {
    const b=[...panel().querySelectorAll('.bfilter')].find(x=>x.dataset.bf===mode); b.click();
    const v=lis().filter(li=>!li.hidden);
    if (!v.every(li=>(li.dataset.f||'').split(' ').includes(mode))) filtersOk=false;
    if (b.getAttribute('aria-pressed')!=='true') filtersOk=false;
    const emptyGrpVisible=[...panel().querySelectorAll('.ownergrp')].some(g=>!g.hidden && ![...g.querySelectorAll('li')].some(li=>!li.hidden));
    if (emptyGrpVisible) filtersOk=false;
  }
  console.log('6. overdue/blocked/unassigned filters are exact, groups collapse:', filtersOk);
  [...panel().querySelectorAll('.bfilter')].find(x=>x.dataset.bf==='all').click();

  // compact view persists across a project switch
  $('bd-compact').click(); await sleep(20);
  console.log('7. compact view on:', panel().querySelector('.panel-inner').classList.contains('compact'));
  d.querySelector(`#projects .proj[data-project="P1"]`).click(); await sleep(30);
  console.log('   survives re-render (persisted in state):', panel().querySelector('.panel-inner').classList.contains('compact'), $('bd-compact').checked);
  $('bd-compact').click();

  // ---- Dashboard ----
  d.querySelector('[data-tab="dash"]').click(); await sleep(50);
  let T=$('dash-inner').textContent;
  console.log('8. signals card is plain-first:', [...$('dash-inner').querySelectorAll('.card h3')][0].textContent==='Signals', /What the rules mean \(policy 0\.1\)/.test(T), !/No signals under policy/.test(T));
  const chips=[...$('dash-inner').querySelectorAll('.rule')];
  console.log('9. R-ids kept, named on demand:', chips.length>0 && chips.every(c=>/^R[1-5]$/.test(c.textContent) && c.title.length>0));
  console.log('10. no-signal ≠ healthy, stated:', /No signal triggered\./.test(T), /not thereby healthy/.test(T) && /absence of evidence/.test(T));
  console.log('11. role sentence coordinates Board and Dashboard:', /Board is the working register/.test(T));

  // as-of coordination note when the Board views an earlier meeting
  d.querySelector('[data-tab="board"]').click(); await sleep(30);
  $('asof').value=$('asof').options[0].value; $('asof').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  d.querySelector('[data-tab="dash"]').click(); await sleep(50);
  T=$('dash-inner').textContent;
  console.log('12. earlier-as-of note appears:', /Board is currently showing state as of an earlier meeting/.test(T));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
