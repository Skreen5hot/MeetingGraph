// Round-3 guards (2026-10-10): STATUS-01 broadened completion check, MATCH-01 subject overlap, MATCH-02 compound labels, prompt doctrine
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
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
  // Atlas world: existing AI-6 "Send host-site point-of-contact details"
  w.__ws=WS;
  const wsFile=w.eval('new File([window.__ws], "mkg-workspace-atlas.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[wsFile],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=[
    'Guard sync-20261011_150000UTC-Meeting Recording',
    'October 11, 2026, 3:00PM',
    '9m 2s',
    '[00:00:05] Morgan Reyes: I updated the calendar invitation for Alex just now. Alex, let me know if you receive it.',
    '[00:00:15] Morgan Reyes: The update shows in the system on my side.',
    '[00:00:30] Riley Novak: Morgan will provide the arrival point of contact and verify the vehicle entry route.',''].join('\n');
  $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('do-segment').click(); await sleep(250);
  const chat=$('chat-text').value;
  console.log('1. prompt: match-before-create update doctrine:', /is an UPDATE to that tasking \(ProgressNote, Reassign, Deadline on it\), never a near-duplicate/.test(chat));
  console.log('2. prompt: completion-condition test (D-UX10c) + structured open verification:', /Separate deliverables or separate deadlines are separate taskings/.test(chat) && !/one per LABEL/.test(chat), /names BOTH the verification and its contingency/.test(chat));
  console.log('3. prompt: completion judged against the task’s own wording:', /Completion is judged against the tasking's own stated completion condition/.test(chat));
  console.log('4. prompt: notes routed to the tasking whose scope they concern:', /tasking whose own scope the fact concerns/.test(chat));
  const token=(chat.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];

  // STATUS-01: completion op cites S002 (no confirm phrase) but the SAME tasking's NewTasking cites S001 (confirm phrase) -> guard fires
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P1',label:'Update the calendar invitation for Alex',assignee:'morgan-reyes',src:[{seg:'S001',quote:'I updated the calendar invitation for Alex'}]},
    {op:'Status',tasking:'NEW-1',status:'completed',src:[{seg:'S002',quote:'The update shows in the system'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(200);
  let T=$('import-out').textContent;
  console.log('STATUS-01 guard sees the whole tasking’s citations:', /asks for receipt confirmation/.test(T) && /initiation is not completion \(rule 5\)/.test(T), !!$('import-out').querySelector('[data-accept]'));

  // MATCH-02 retired by D-UX10c (2026-10-11): the "verb and verb" warning also caught single completion conditions
  // ("verify the route and confirm which to use"). DELIVERABLES-MERGED / TIMING-MERGED replace it (t31, t34).
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P1',label:'Provide arrival point of contact and verify vehicle entry route',assignee:'morgan-reyes',src:[{seg:'S003',quote:'provide the arrival point of contact and verify the vehicle entry route'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(200);
  T=$('import-out').textContent;
  console.log('MATCH-02 retired (D-UX10c), no "and" warning:', !/two completion conditions means two taskings/.test(T));
  console.log('MATCH-01 overlap with AI-6 also flagged (point, contact):', /Shares its subject with AI-6/.test(T) && /record it there/.test(T));
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P1',label:'Confirm parking-area surface suitability and identify an alternate location if needed',src:[{seg:'S003',quote:'verify the vehicle entry route'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(200);
  T=$('import-out').textContent;
  console.log('MATCH-02 contingency ("... if needed") stays one task, no warn:', !/two completion conditions means two taskings/.test(T));

  // MATCH-01 alone: distinct-subject label draws no overlap noise
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'NewTasking',ref:'NEW-1',project:'P1',label:'Arrange generator fuel delivery for the exercise week',assignee:'morgan-reyes',src:[{seg:'S003',quote:'verify the vehicle entry route'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(200);
  T=$('import-out').textContent;
  console.log('MATCH-01 stays quiet on a distinct subject:', !/Shares its subject with/.test(T));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
