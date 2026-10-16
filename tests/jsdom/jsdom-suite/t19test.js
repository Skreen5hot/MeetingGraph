// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// Field fixes 2026-10-09: Recording-header variant; quote diagnosis (wrong segment / spanning); partial-reply guard; banner teaching
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

  // ---- Issue 1: "-Meeting Recording" header with UTC suffix and 1h duration line ----
  const header='PAREEAD-Full Team Synchronization Weekly Meeting-20260930_135723UTC-Meeting Recording\nSeptember 30, 2026, 1:57PM\n1h 1m 42s\nMark M. started transcription\n';
  const body='[00:00:05] Mei Chen: We will finalize the intake field list on Friday.\n[00:00:09] Mei Chen: Sofia will own the partner agreement work after that.\n';
  $('transcript').value=header+body;
  $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  console.log('1. Recording header fills ALL fields (title included):',
    $('m-title').value==='PAREEAD-Full Team Synchronization Weekly Meeting',
    $('m-date').value==='2026-09-30', $('m-time').value==='13:57');
  $('do-segment').click(); await sleep(200);
  const segRows=[...d.querySelectorAll('#seg-out table.seg tr')].map(r=>r.textContent);
  console.log('2. boilerplate stripped (header, date line, 1h duration, started transcription):', segRows.length===2, !segRows.some(t=>/Meeting Recording|1h 1m 42s|started transcription|September 30, 2026/.test(t)));

  // ---- Issue 2a: quote diagnosis ----
  const op=(seg,quote)=>({ops:[{op:'ProgressNote',tasking:'AI-104',text:'x',src:[{seg,quote}]}],flags:[]});
  $('llm-in').value=JSON.stringify(op('S001','Sofia will own the partner agreement'));
  $('do-validate').click(); await sleep(100);
  let T=$('import-out').textContent;
  console.log('3. wrong-segment citation is diagnosed:', /Quote not found in S001/.test(T) && /the words are in S002 — cite that segment/.test(T));
  $('llm-in').value=JSON.stringify(op('S001','list on Friday. Sofia will own'));
  $('do-validate').click(); await sleep(100);
  T=$('import-out').textContent;
  console.log('4. spanning citation is diagnosed:', /the quote spans S001–S002 — split it/.test(T));
  console.log('5. red banner teaches the complete-reply loop:', /ask for the complete corrected reply/.test(T) && /would be imported as the whole meeting/.test(T));

  // ---- Issue 2c: partial-reply guard ----
  $('clear-ws').click(); await sleep(100);
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('do-segment').click(); await sleep(200);
  $('sample-output').click(); $('do-validate').click(); await sleep(150);
  console.log('6. full reply validates with no shrink warning:', !!$('import-out').querySelector('.banner.ok'), !/an earlier paste for this meeting had/.test($('import-out').textContent));
  // now a "fragment" reply: one valid op wrapped as a full reply
  const segRow=[...d.querySelectorAll('#seg-out table.seg tr')].find(r=>/interconnection security agreement/.test(r.textContent));
  const SEG=segRow.cells[0].textContent.trim().split(/\s+/)[0];
  $('llm-in').value=JSON.stringify({ops:[{op:'ProgressNote',tasking:'AI-203',text:'Partial correction only.',src:[{seg:SEG,quote:'interconnection security agreement'}]}],flags:[]});
  $('do-validate').click(); await sleep(150);
  T=$('import-out').textContent;
  console.log('7. shrunken reply warns loudly, names both counts:', /This reply has 1 operation; an earlier paste for this meeting had 10/.test(T), /records the whole meeting as just this one operation/.test(T));
  console.log('8. warning does not block the gate (reviewer decides):', !!(await UXA($('import-out'))).querySelector('[data-accept]') && !(await UXA($('import-out'))).querySelector('[data-accept]').disabled);
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
