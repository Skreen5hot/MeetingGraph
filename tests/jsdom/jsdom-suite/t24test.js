// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// Real-meeting email findings (2026-10-10): lifecycle consistency, row coverage, timing-first, initiation guard
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
  $('transcript').value=[
    'Lifecycle sync-20261010_150000UTC-Meeting Recording',
    'October 10, 2026, 3:00PM',
    '12m 4s',
    '[00:00:05] Mei Chen: I will draft the migration memo today, and actually I already finished it an hour ago and sent it to the folder.',
    '[00:00:20] Sofia Alvarez: I updated the calendar invitation for Raj just now. Raj, let me know if you receive it.',
    '[00:00:35] Raj Ortiz: On AI-203, the test transfer is now in progress since this morning.',''].join('\n');
  $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('do-segment').click(); await sleep(200);
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];

  // 1) initiation guard fires on completion citing a confirm-receipt segment
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-9',project:'P2',label:'Update calendar invitation for Raj',assignee:'alvarez',src:[{seg:'S002',quote:'I updated the calendar invitation for Raj'}]},
    {op:'Status',tasking:'NEW-9',status:'completed',src:[{seg:'S002',quote:'let me know if you receive it'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(150);
  console.log('1. initiation-vs-completion guard warns, never blocks:', /initiation is not completion \(rule 5\)/.test($('import-out').textContent), !!(await UXA($('import-out'))).querySelector('[data-accept]') && !(await UXA($('import-out'))).querySelector('[data-accept]').disabled);

  // 2) minted-and-completed in one meeting: one consistent story everywhere
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P1',label:'Draft the migration memo',assignee:'chen',dueDate:'2026-10-10',duePhrase:'today',src:[{seg:'S001',quote:'I will draft the migration memo today'}]},
    {op:'Status',tasking:'NEW-1',status:'completed',note:'Finished and sent to the folder during the meeting.',src:[{seg:'S001',quote:'I already finished it an hour ago and sent it to the folder'}]},
    {op:'Status',tasking:'AI-203',status:'in_progress',src:[{seg:'S003',quote:'the test transfer is now in progress'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(150);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);
  console.log('2. accepted:', /^Accepted/.test($('toast').textContent));

  d.querySelector('[data-tab="board"]').click(); await sleep(50);
  $('meeting-report').click(); await sleep(200);
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  const T=dlg.textContent;
  // narrative: no contradiction
  console.log('3. narrative: one story for minted+completed:', /recorded and completed within the meeting/.test(T), !/new work opened: “Draft the migration memo”/.test(T));
  // conclusion: not a "next step", stated as completed-in-meeting
  const concl=T.slice(T.indexOf('Conclusion'));
  console.log('4. conclusion consistent:', /recorded and completed within this meeting/.test(concl), !/Next steps include .*migration memo/.test(concl));
  // timing leads with the phrase, resolution second
  console.log('5. timing: phrase first, resolution second:', /Timing: “today” → Oct 10\./.test(T), !/Due Oct 10 \(stated/.test(T));
  // generic Status rows carry text (never evidence-only)
  console.log('6. in_progress update row has real content:', /Reported in progress \(was open\)|Reported in progress/.test(T), !/\|\s*Evidence: S003\.\s*\|/.test(T));
  dlg.close();

  // 7) no row can be evidence-only: PrerequisiteAdd-only update renders a sentence
  d.querySelector('[data-tab="prepare"]').click();
  $('m-time').value='16:00'; $('m-time').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('do-segment').click(); await sleep(200);
  const token2=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  $('llm-in').value=JSON.stringify({context:token2,ops:[
    {op:'PrerequisiteAdd',tasking:'AI-203',prerequisite:'AI-201',src:[{seg:'S003',quote:'the test transfer is now in progress'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(150);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);
  d.querySelector('[data-tab="board"]').click(); await sleep(50);
  [...$('asof').options].forEach(o=>{ if(/4:00|16:00|Lifecycle/.test(o.textContent)) $('asof').value=o.value; });
  $('asof').value=$('asof').options[$('asof').options.length-1].value;
  $('asof').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  $('meeting-report').click(); await sleep(200);
  const dlg2=[...d.querySelectorAll('dialog')].find(x=>x.open);
  console.log('7. prerequisite-only update renders a sentence:', /Now waits on AI-201\./.test(dlg2.textContent));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
