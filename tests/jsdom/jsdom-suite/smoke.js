// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let confirms=[], confirmReply=true;
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
  w.confirm=m=>{confirms.push(m);return confirmReply;};
  w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  // A. the one path: prepare -> token -> import -> explicit accept
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('m-date').value='2026-10-01'; $('m-time').value='10:00'; $('m-offset').value='-04:00'; $('m-title').value='Weekly board walk';
  $('do-segment').click(); await sleep(80);
  console.log('A1 token + re-extraction absent on first run:', /MKG1\|transcript\|20261001T140000Z\|[0-9a-f]{8}/.test($('chat-text').value), !/Re-extraction/.test($('seg-out').textContent));
  d.querySelector('[data-tab="prepare"]').click(); $('sample-output').click(); $('do-validate').click();
  console.log('A2 validates, explicit add label:', d.querySelector('#import-out .banner').classList.contains('ok'), /Accept: add the/.test((await UXA(d)).querySelector('#import-out [data-accept]').textContent));
  (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  console.log('A3 accepted:', [...$('asof').options].length===2);
  // B. C1 re-extraction: banner, pre-meeting INDEX, identical reply = no-op
  d.querySelector('[data-tab="prepare"]').click(); $('sample-transcript').click(); $('do-segment').click(); await sleep(80);
  const idx=$('chat-text').value.split('=== INDEX ===')[1];
  console.log('B1 re-extraction banner + pre-meeting world:', /Re-extraction/.test($('seg-out').textContent), /AI-104 \| P1 \| [^|]+\| chen \| blocked/.test(idx));
  d.querySelector('[data-tab="prepare"]').click(); $('sample-output').click(); $('do-validate').click();
  (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  console.log('B2 identical re-import is a no-op:', /exact package is already loaded/.test($('toast').textContent), [...$('asof').options].length===2);
  // C. corrections with REAL candidates: no nag confirm, gate merge works end to end
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value='Chen, Mei 0 minutes 5 seconds\nRaj will get the interconnection security agreement signed with the partner.';
  $('m-date').value='2026-10-08'; $('do-segment').click(); await sleep(80);
  d.querySelector('[data-tab="prepare"]').click();
  const mtok=null;
  $('llm-in').value=JSON.stringify({ops:[{op:'NewTasking',ref:'NEW-1',project:'P2',label:'Get the interconnection security agreement signed with the partner',assignee:'patel',src:[{seg:'S001',quote:'interconnection security agreement signed with the partner'}]}],flags:[]});
  $('do-validate').click();
  console.log('C1 duplicate warning at the gate:', /Possible duplicate of AI-402/.test($('import-out').textContent));
  (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  confirms=[];
  d.querySelector('[data-tab="prepare"]').click(); $('corr-build').click(); await sleep(100);
  console.log('C2 candidates present -> no nag confirm, pair listed:', confirms.length===0, /AI-40[23] "[^"]+" \([^)]*\) ~ AI-40[23]/.test($('corr-text').value));
  const ctok=($('corr-text').value.match(/MKG1\|correction\|[^\n]+/)||[])[0];
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({context:ctok,ops:[{op:'SameAs',duplicate:'AI-403',survivor:'AI-402',reason:'Twin created by a re-statement'}]});
  $('do-validate').click();
  (await UXA(d)).querySelector('#import-out [data-accept]').click(); await sleep(450);
  d.querySelector('[data-project="P2"]').click();
  const codes=[...d.querySelectorAll('#panel .snap [data-ent] .code')].map(c=>c.textContent);
  console.log('C3 merge folded, alias shown, twin gone from live views:', !codes.includes('AI-403'), /\(also AI-403\)/.test($('panel').textContent));
  // D. dashboard + report still render
  d.querySelector('[data-tab="dash"]').click(); await sleep(50);
  console.log('D1 dashboard renders policy header:', /policy 0\.1/.test($('dash-inner').textContent));
  d.querySelector('[data-project="P1"]').click(); $('email-report').click(); await sleep(50);
  console.log('D2 report renders with intro:', /Team,/.test(d.querySelector('.report-preview').textContent));
})();
