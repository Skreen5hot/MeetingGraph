// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let confirms=[];
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
  w.confirm=m=>{confirms.push(m);return true;};
  w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  // Aaron's intended loop: prepare once, import, answer questions, paste the revised reply — NO re-prepare
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('m-date').value='2026-10-01'; $('m-time').value='10:00'; $('m-offset').value='-04:00'; $('m-title').value='Weekly board walk';
  $('do-segment').click(); await sleep(100);
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^\n]+/)||[])[0];
  d.querySelector('[data-tab="prepare"]').click(); $('sample-output').click();
  const original=JSON.parse($('llm-in').value);
  $('do-validate').click(); (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  console.log('1. accept toast teaches the loop:', /answer the chat.s questions and paste its new reply/.test($('toast').textContent));
  d.querySelector('[data-tab="prepare"]').click();
  console.log('2. preparation survived Accept (status + chat text intact):', /Numbered ✓/.test($('prep-status').textContent), $('chat-text') && $('chat-text').value.includes(token));
  // The "revised reply": same token, one op's note changed (as answering a question would)
  const revised=JSON.parse(JSON.stringify(original)); revised.context=token;
  revised.ops.push({op:'ProgressNote',tasking:'AI-105',text:'Review checklist drafted after the walk.',src:[{seg:'S003',quote:'Accessibility review is still on for the eighth.'}]});
  d.querySelector('[data-tab="prepare"]').click();
  const strip=$('import-meeting').textContent;
  console.log('3. strip shows RE-EXTRACTION / REPLACES, revised-reply sentence present:', /RE-EXTRACTION of an already-accepted meeting/.test(strip), /REPLACES the existing/.test(strip));
  $('llm-in').value=JSON.stringify(revised); $('do-validate').click();
  console.log('4. revised reply validates with its token, no re-prepare:', d.querySelector('#import-out .banner').classList.contains('ok'), !/No context token/.test($('import-out').textContent));
  confirms=[]; (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  console.log('5. one plain replace confirm, still two packages:', confirms.length===1 && /Replace the existing package/.test(confirms[0]), [...$('asof').options].length===2);
  // Reload-in-between case: clear (simulating lost session), the refusal now teaches the recovery
  $('clear-ws').click(); await sleep(300); $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify(revised); $('do-validate').click(); await sleep(30);
  const out=$('import-out').textContent;
  console.log('6. refusal includes the revised-reply recovery:', /revised reply after answering the chat.s questions also lands here/.test(out), /preparations live only in this session/.test(out));
  // Rename landed everywhere user-facing
  d.querySelector('[data-tab="prepare"]').click();
  console.log('7. duplicate-merge naming:', /Merge duplicate entries \(advanced/.test(d.querySelector('#view-prepare details summary').textContent), /Build duplicate-merge request/.test($('corr-build').textContent));
  const strip2=$('import-meeting').textContent; d.querySelector('[data-tab="prepare"]').click();
  console.log('8. cold strip: merge sentence + revised-reply sentence:', /duplicate-merge reply/.test($('import-meeting').textContent), /belongs to its original preparation/.test($('import-meeting').textContent));
})();
