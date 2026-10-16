// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// T-UX-2 (plan v0.1 phase 1b): validation vs approval — "Checks passed", flags first with evidence, Accept carries the count
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
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click();
  $('do-segment').click(); await sleep(200);
  // find the ISA segment of the sample transcript dynamically (id + speaker)
  const segRow=[...d.querySelectorAll('#seg-out table.seg tr')].find(r=>/interconnection security agreement/.test(r.textContent));
  const SEG=segRow.cells[0].textContent.trim().split(/\s+/)[0];
  const SPEAKER=segRow.querySelector('strong').textContent;
  const QUOTE='interconnection security agreement';
  d.querySelector('[data-tab="prepare"]').click();

  // (a) zero-flag reply: plain "Checks passed.", no flags card, no accept suffix
  $('llm-in').value=JSON.stringify({ops:[{op:'NewTasking',ref:'NEW-1',project:'P2',label:'Zero-flag test item',assignee:'patel',src:[{seg:SEG,quote:QUOTE}]}],flags:[]});
  $('do-validate').click(); await sleep(100);
  let out=$('import-out');
  const banner0=out.querySelector('.banner.ok');
  console.log('1. zero flags: banner says Checks passed, no "Valid.":', /Checks passed\./.test(banner0.textContent), !/\bValid\./.test(out.textContent));
  console.log('2. zero flags: no "need your eyes", no Reviewer questions card:', !/need.{0,2}s? your eyes/.test(out.textContent), !/Reviewer questions/.test(out.textContent));
  const acc0=(await UXA(out)).querySelector('[data-accept]');
  console.log('3. zero flags: accept label has no review-item suffix:', !/open review item/.test(acc0.textContent));

  // (b) flagged reply: count in banner, flags card before Operations, evidence quote, accept suffix
  $('llm-in').value=JSON.stringify({ops:[{op:'NewTasking',ref:'NEW-1',project:'P2',label:'Flagged test item',assignee:'patel',src:[{seg:SEG,quote:QUOTE}]}],
    flags:[{kind:'ambiguous',seg:SEG,note:'Is this the right partner organization?'},{kind:'implied_change',seg:SEG,note:'A plan date was mentioned but not asserted.'}]});
  $('do-validate').click(); await sleep(100);
  out=$('import-out');
  const banner=out.querySelector('.banner.ok');
  console.log('4. flagged: banner counts the items:', /Checks passed — 2 items below need your eyes\./.test(banner.textContent+'.'), !/\bValid\./.test(out.textContent));
  const cards=[...out.querySelectorAll('.card h3')].map(h=>h.textContent);
  console.log('5. flags card renders before Proposed changes:', cards[0].startsWith('Reviewer questions (2)'), cards.findIndex(c=>c.startsWith('Proposed changes'))>0);
  const li=[...out.querySelectorAll('.card li')].find(x=>/right partner organization/.test(x.textContent));
  console.log('6. flag carries its evidence quote + speaker:', !!li && /“.*”/.test(li.textContent), !!li && li.textContent.includes(SPEAKER));
  console.log('7. standing instruction (chat loop, Interesting Topics):', /answer it in the chat/.test(out.textContent), /Risks, dependencies and open questions/.test(out.textContent));
  const acc=(await UXA(out)).querySelector('[data-accept]');
  console.log('8. accept label: consequence + count:', /^Accept: add the/.test(acc.textContent), /— 2 open review items$/.test(acc.textContent));
  console.log('9. accept enabled (flags never block):', !acc.disabled);

  // (c) accept folds the package, flags intact as Interesting Topics in the meeting email
  acc.click(); await sleep(400);
  console.log('10. accepted:', /^Accepted/.test($('toast').textContent));
  $('meeting-report').click(); await sleep(200);
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  console.log('11. meeting email: flags live on under open questions:', !!dlg && /Risks, dependencies and open questions/.test(dlg.textContent) && /right partner organization/.test(dlg.textContent));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
