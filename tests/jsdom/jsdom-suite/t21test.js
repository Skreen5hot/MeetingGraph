// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// Field feedback 2026-10-09: meeting email v2 — provenance sections, verified duration, stated timing, evidence refs; prompt upgrades
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

  // Teams Recording header with a 1h duration; two segments, one spawning a same-day commitment
  $('transcript').value=[
    'Board sync-20261001_140000UTC-Meeting Recording',
    'October 1, 2026, 2:00PM',
    '1h 1m 42s',
    '[00:00:05] Mei Chen: I will send the partner contact details to the team this morning.',
    '[00:00:12] Raj Ortiz: On the test transfer, the firewall change is holding and we are watching throughput.',''].join('\n');
  $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('a-sample').click(); await sleep(50); // attendance says 34m 7s -> deliberate conflict with 1h 1m 42s
  $('do-segment').click(); await sleep(200);

  // prompt upgrades present in the chat text
  const chat=$('chat-text').value;
  console.log('1. prompt: commitment language + completion-condition test (D-UX10c):', /The speaker of "I will" is the owner/.test(chat), /One tasking per completion condition, judged by how the work gets done/.test(chat) && !/emit each as its own NewTasking, never one broad task/.test(chat));
  console.log('2. prompt: informal timing needs its phrase; Discussed vs ProgressNote; ownership flag kind:', /overstates certainty/.test(chat), /reserve Discussed for mentions that add nothing/.test(chat), /overdue\|ownership/.test(chat));

  // reply: one new same-day commitment (stated "this morning"), one progress note on an existing item, one ownership flag
  $('llm-in').value=JSON.stringify({ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P2',label:'Send partner contact details to the team',assignee:'chen',dueDate:'2026-10-01',duePhrase:'this morning',src:[{seg:'S001',quote:'I will send the partner contact details to the team this morning'}]},
    {op:'ProgressNote',tasking:'AI-203',text:'Firewall change holding; throughput being watched.',src:[{seg:'S002',quote:'the firewall change is holding'}]}
  ],flags:[{kind:'ownership',about:'AI-203',seg:'S002',note:'Raj reported progress but no owner change was spoken; likely contributor only.'}]});
  $('do-validate').click(); await sleep(150);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);

  // meeting email
  d.querySelector('[data-tab="board"]').click(); await sleep(50);
  $('meeting-report').click(); await sleep(200); if($('msum-trace')&&!$('msum-trace').checked){$('msum-trace').checked=true;$('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(100);}
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  const T=dlg.textContent;
  console.log('3. duration verified against both sources, conflict flagged:', /1h 1m 42s \(transcript header\)/.test(T), /attendance report says 34m 7s/.test(T) && /sources disagree/.test(T));
  console.log('4. new actions separated, with owner/status/stated timing:', /New actions from this meeting/.test(T), /Owner: Mei Chen\. Status: Open\. Timing: “this morning” → Oct 1\./.test(T));
  console.log('5. updated items separated:', /Existing items updated or referenced this meeting/.test(T), /Firewall change holding/.test(T));
  console.log('6. carryover fenced off with the no-update line:', /Existing open items not discussed/.test(T), /no meeting-based status update is available/.test(T));
  console.log('7. evidence refs on rows:', /Evidence: S001\./.test(T), /Evidence: S002\./.test(T));
  console.log('8. ownership flag under open questions:', /Risks, dependencies and open questions/.test(T), /No owner yet \(AI-203 /.test(T) && /likely contributor only/.test(T));
  console.log('9. flags note separates claims from register changes:', /these are not register changes/.test(T));
  const nums=[...T.matchAll(/(\d+)\. (?:Meeting Overview|Executive Summary|Participants|Decisions recorded|New actions|Existing items updated|Existing open items|Risks, dependencies|Conclusion)/g)].map(m=>+m[1]);
  console.log('10. numbering is contiguous (no gap for omitted sections):', nums.length>=7, nums.every((n,i)=>n===i+1));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
