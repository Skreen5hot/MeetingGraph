// T-UX Phase 2: one Process meeting destination; review rows as sentences with evidence; technical detail on demand
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let scrolled=[];
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
  w.confirm=()=>true; w.onerror=m=>console.log('WINDOW ERROR',m);
  w.HTMLElement.prototype.scrollIntoView=function(){scrolled.push(this.id||this.className);};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  // 1) one destination
  console.log('1. no Import tab; Process meeting tab present:', !d.querySelector('[data-tab="import"]'), d.querySelector('[data-tab="prepare"]').textContent==='Process meeting');
  console.log('   step-4 card lives inside the merged view:', !!d.querySelector('#view-prepare #import-card'), !d.getElementById('view-import'));
  const chip=d.querySelector('#import-card h3 .stepchip');
  console.log('2. import card is Step 4:', !!chip && chip.textContent==='4');

  // 2) cold entry: the gate is reachable and self-describing with zero preparation
  d.querySelector('[data-tab="prepare"]').click(); await sleep(30);
  console.log('3. cold strip rendered in-page:', /needs its numbered transcript in this session/.test($('import-meeting').textContent), /duplicate-merge reply/.test($('import-meeting').textContent));
  console.log('   step-1 shortcut present:', !!$('goto-prepare') && /Step 1/.test($('goto-prepare').textContent));

  // 3) sentences, evidence, technical detail
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click();
  $('do-segment').click(); await sleep(200);
  scrolled=[];
  $('go-import').click(); await sleep(30);
  console.log('4. Go to the reply box scrolls to Step 4, focuses the box:', scrolled.includes('import-card'), d.activeElement===$('llm-in'));
  $('sample-output').click();
  $('do-validate').click(); await sleep(150);
  const out=$('import-out');
  const sents=[...out.querySelectorAll('.rev-sent')].map(x=>x.textContent);
  console.log('5. rows are sentences, not op labels:', sents.length>=10,
    sents.some(t=>/^New work item AI-\d+ “Get interconnection security agreement signed”, assigned to Sofia Alvarez, due 2026-10-31\.$/.test(t)),
    sents.some(t=>/reported completed — Open → Completed/.test(t)),
    sents.some(t=>/handed from .+ to Linh Nguyen\.$/.test(t)),
    sents.some(t=>/^Decision for .+: Keep fields 41 and 57/.test(t)));
  const evs=[...out.querySelectorAll('.rev-ev')].map(x=>x.textContent);
  console.log('6. evidence adjacent (quote, speaker, segment):', evs.length>=10, evs.some(t=>/“.+” — .+ · S\d{3}/.test(t)));
  const det=[...out.querySelectorAll('details')].find(x=>/Technical detail/.test(x.textContent));
  console.log('7. ops table collapsed under Technical detail:', !!det && !det.open, !!det && /NewTasking/.test(det.textContent) && /Reassign/.test(det.textContent));
  console.log('   op labels absent from the main list:', !sents.some(t=>/NewTasking|ProgressNote|DueDate/.test(t)));

  // 4) duplicate-merge path still routes to the same gate
  $('import-out').querySelector('[data-accept]').click(); await sleep(400); // accept so corr-build has a clean register
  d.querySelector('[data-tab="prepare"]').click();
  d.querySelector('#view-prepare details summary').click();
  scrolled=[];
  $('corr-build').click(); await sleep(150); // no transcript bump: transcript numbered state cleared? (transcript still there+numbered -> no bump)
  if($('corr-go')){ $('corr-go').click(); await sleep(30);
    console.log('8. correction flow: reply-box shortcut works in-page:', scrolled.includes('import-card'), d.activeElement===$('llm-in'));
  } else console.log('8. correction flow: reply-box shortcut works in-page:', false, 'corr-out:', $('corr-out').textContent.slice(0,120));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
