// Prompt-evaluation round (2026-10-10): the tester's 20 findings — schema, rules, and single-emission checks
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
const TR=fs.readFileSync('/mnt/user-data/outputs/mkg-transcript-atlas-2026-10-09.txt','utf8');
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
  w.confirm=()=>true; w.onerror=m=>console.log('WINDOW BAD',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const count=(h,n)=>h.split(n).length-1;
(async()=>{
  await sleep(300);
  w.__ws=WS;
  const wsFile=w.eval('new File([window.__ws], "a.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[wsFile],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=TR; $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('do-segment').click(); await sleep(250);
  const chat=$('chat-text').value;

  // F1/F2/F16: multi-disposition arrays + about arrays
  console.log('F1 multi-disposition schema + never-drop instruction:', /"dispositions": \[/.test(chat), /one disposition per event, as an array/.test(chat), /Never pick one event and silently drop the others/.test(chat));
  console.log('F2/F15 about arrays + flag src arrays:', /"about": \["AI-203", "NEW-1"\]/.test(chat), /"src": \["S005"\]/.test(chat), /accept a single ID, an array, or null/.test(chat));
  // F3: one completion rule, no contradiction
  console.log('F3 one completion-condition rule:', /Completion is judged against the tasking's own stated completion condition, one rule/.test(chat), !/never completed; completion needs the result established/.test(chat));
  // F4/F7: project assignment + coveredProjects
  console.log('F4 project-assignment rule:', /never assign by the mere existence of a similarly named task elsewhere/.test(chat));
  console.log('F7 coveredProjects is the stated, auditable scope:', /"coveredProjects": \["P2"\]/.test(chat), /name the projects this meeting covers in a top-level "coveredProjects" array/.test(chat));
  // F5: non-indexed speakers
  console.log('F5 non-indexed speakers handled:', /may appear in evidence quotes and note text without a NewParty op/.test(chat));
  // F6: commitment-confidence hierarchy
  console.log('F6 confidence hierarchy:', /"I can probably \/ we can \/ we'll work through \/ I'll start" = uncertain_requires_review or a ProgressNote/.test(chat));
  // F8: active-item definition
  console.log('F8 active items defined (open-unreported included):', /active means open, open \(unreported\), in_progress, or blocked/.test(chat));
  // F9/F12: unassigned acceptance + Reassign from null
  console.log('F9 unassigned acceptance = Reassign from null:', /emit Reassign with "from": null/.test(chat), /null when the task was unassigned/.test(chat));
  // F10: two NewTasking cases
  console.log('F10 NewTasking two cases:', /NewTasking in exactly two cases/.test(chat));
  // F11: one segment, many ops
  console.log('F11 multi-op segments:', /never withhold a needed op because the segment is already cited elsewhere/.test(chat));
  // F12(tech): level of technical detail
  console.log('F12 technical level:', /never restate implementation or configuration detail unless it defines a task/.test(chat));
  // F13/F14: output contradiction resolved + context equality
  console.log('F13 Part B wording consistent:', /Emit exactly one JSON object in Part B/.test(chat), !/Emit the single JSON/.test(chat));
  console.log('F14 context checked by value:', /exactly equals the CONTEXT TOKEN/.test(chat) && /exact value equality, not position/.test(chat));
  // F17: required coverage rationale
  console.log('F17 note required on discussed/possible rows:', /required for discussed_no_register_change and possible_match_requires_review/.test(chat));
  // F18: the tool emits the prompt exactly once
  console.log('F18 single emission (no duplication from the tool):', count(chat,'WORKFLOW')===1, count(chat,'=== INDEX ===')===1, count(chat,'=== MEETING ===')===1);
  // F20: participant-list instruction
  console.log('F20 participant lists are administrative:', /never create parties, assignments or project changes from them alone/.test(chat));

  // Close round (tester's final pre-run review, six edits)
  const flagLine=(chat.split('\n').find(l=>/"kind": "suggestion\|/.test(l))||'').trim().replace(/,$/,'');
  let flagParsed=null; try{flagParsed=JSON.parse(flagLine);}catch(e){}
  console.log('F21 flag schema example is strictly valid JSON:', !!flagParsed, flagParsed && Array.isArray(flagParsed.about) && flagParsed.about[0]==='P2');
  console.log('F22 rule 2 matches ACTIVE taskings (all four statuses):', /with the same completion condition as an existing ACTIVE tasking \u2014 open, open \(unreported\), in_progress, or blocked \u2014 is an UPDATE/.test(chat));
  console.log('F23 register schema covers explicitly touched completed items:', /plus one entry for any completed item explicitly referenced, updated, reopened, or otherwise discussed/.test(chat));
  console.log('F24 NewParty kind allows organizations:', /"kind": "person\|organization"/.test(chat));
  console.log('F25 identity-sufficiency rule for new people:', /Never create a NewParty from a first name, nickname, partial name, or role title alone/.test(chat), /leave the task unassigned and add an ambiguous_reference flag/.test(chat));
  console.log('F26 paste-once guard beside the context token:', /exactly one copy of this prompt, one INDEX, and one MEETING transcript/.test(chat), /use only the first copy of each/.test(chat));

  // validator behaviors: note-required finding + about-array misbound allowance
  const token=(chat.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  $('llm-in').value=JSON.stringify({context:token,coveredProjects:["P1"],ops:[
    {op:'ProgressNote',tasking:'AI-8',text:'Constraints discussed.',src:[{seg:'S002',quote:'depends on the flight plan'}]}
  ],flags:[],segments:[
    {seg:'S002',dispositions:[{kind:'discussion_of_register_item',about:['AI-8','AI-7']}]}
  ],register:[
    {id:'AI-7',coverage:'discussed_no_register_change',segs:['S002']}
  ]});
  $('do-validate').click(); await sleep(200);
  const C=$('import-out').textContent;
  console.log('V1 note required on discussed_no_register_change:', /AI-7 is marked discussed_no_register_change without the required note/.test(C));
  console.log('V2 multi-about allows either binding (no misbound for AI-8):', !/check the binding/.test(C));
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'ProgressNote',tasking:'AI-8',text:'Constraints discussed.',src:[{seg:'S002',quote:'depends on the flight plan'}]}
  ],flags:[],segments:[
    {seg:'S002',kind:'discussion_of_register_item',about:'AI-8'}
  ],register:[{id:'AI-8',coverage:'updated',segs:['S002']}]});
  $('do-validate').click(); await sleep(200);
  const C2=$('import-out').textContent;
  console.log('V3 legacy single-kind shape still parses:', /Coverage review/.test(C2), !/unknown disposition/.test(C2) && !/check the binding/.test(C2));
})().catch(e=>{console.log('BAD',e.message,e.stack);});
