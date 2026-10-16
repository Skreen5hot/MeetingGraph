// D-UX10 on the Atlas world (2026-10-11): the regression findings from porting D-UX10, each pinned.
// The revised golden is clean; single edits to it show each check firing (or staying quiet) where it should.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
const TR=fs.readFileSync('/mnt/user-data/outputs/mkg-transcript-atlas-2026-10-09.txt','utf8');
const GOLD=JSON.parse(fs.readFileSync('/mnt/user-data/outputs/mkg-golden-reply-atlas.json','utf8'));
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
const clone=x=>JSON.parse(JSON.stringify(x));
const op=(g,pred)=>{ const hit=g.ops.filter(pred); if(hit.length!==1) throw new Error('fixture op not unique'); return hit[0]; };
(async()=>{
  await sleep(300);
  w.__ws=WS;
  const wsFile=w.eval('new File([window.__ws], "mkg-workspace-atlas.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[wsFile],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=TR; $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('do-segment').click(); await sleep(250);
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  const run=async g=>{ const r=clone(g); r.context=token; $('llm-in').value=JSON.stringify(r); $('do-validate').click(); await sleep(250);
    const out=$('import-out'); const card=[...out.querySelectorAll('.card')].find(x=>/Coverage review/.test(x.querySelector('h3').textContent));
    const lis=card?[...card.querySelectorAll('ul.revlist > li')]:[];
    const warn=c=>lis.some(li=>li.dataset.code===c && li.querySelector('.msg.warn'));
    const rt=$('repair-text');
    return { out, T:out.textContent, lis, warn, repair: rt ? rt.value : '' }; };

  // 0. the revised golden: clean, no repair round, and accepted silently (nothing blocking mentioned anywhere)
  let R=await run(GOLD);
  console.log('0. revised golden: no repair-required finding, no repair round, nothing blocking mentioned:', !R.lis.some(li=>li.querySelector('.rule')), !R.out.querySelector('#repair-card'), !/error/i.test(R.T));
  console.log('0b. split deliverables are not OVER-SPLIT, and siblings draw no MATCH-01 "record it there":', !R.warn('OVER-SPLIT'), !/Shares its subject with AI-1\d/.test(R.T));

  // 1. deck + session notes merged in one tasking -> DELIVERABLES-MERGED ("notes" is a deliverable)
  let g=clone(GOLD);
  op(g,o=>o.ref==='NEW-3').label='Send the site-information slide deck and the coordination-session notes to the group';
  g.ops=g.ops.filter(o=>o.ref!=='NEW-4');
  g.selfReview.newVsExisting=g.selfReview.newVsExisting.filter(r=>r.ref!=='NEW-4');
  g.segments.find(s=>s.seg==='S012').dispositions=[{kind:'commitment',about:['NEW-3']}];
  R=await run(g);
  console.log('1. deck + notes merged -> DELIVERABLES-MERGED, repair round offered:', R.warn('DELIVERABLES-MERGED'), /bundles separate deliverables \(slide deck \+ notes\)/.test(R.repair));

  // 2. transcript + summaries merged (the pre-D-UX10 golden's NEW-4) -> DELIVERABLES-MERGED (Oct 9 precedent)
  g=clone(GOLD);
  op(g,o=>o.ref==='NEW-5').label="Send today's transcript and coordination summaries to the distribution list";
  g.ops=g.ops.filter(o=>o.ref!=='NEW-6');
  g.selfReview.newVsExisting=g.selfReview.newVsExisting.filter(r=>r.ref!=='NEW-6');
  g.segments.find(s=>s.seg==='S013').dispositions=[{kind:'commitment',about:['NEW-5']}];
  R=await run(g);
  console.log('2. transcript + summaries merged -> DELIVERABLES-MERGED:', R.warn('DELIVERABLES-MERGED'), /transcript \+ summaries\/materials/.test(R.repair));

  // 3. MATCH-01 still judges new work against EXISTING work: a new point-of-contact task instead of the AI-6 Reassign
  g=clone(GOLD);
  const re=op(g,o=>o.op==='Reassign' && o.tasking==='AI-6');
  g.ops[g.ops.indexOf(re)]={op:'NewTasking',ref:'NEW-8',project:'P1',label:'Provide Riley and Alex a direct site point of contact',assignee:'morgan-reyes',src:re.src};
  g.selfReview.newVsExisting.push({ref:'NEW-8',nearest:null,whyNew:'Nothing in the register covers giving the vehicle team a contact.'});
  R=await run(g);
  console.log('3. near-duplicate of existing AI-6 still caught (MATCH-01 row + D-UX10 repair):', /Shares its subject with AI-6/.test(R.T), R.warn('NEW-DUPLICATE') || R.warn('COV-DEFERRED-NEW'));

  // 4. AI-7 three ways: reasoned not_discussed = info; bare not_discussed = warn; undecided possible match = repair
  g=clone(GOLD);
  const ai7=g.register.find(r=>r.id==='AI-7'); delete ai7.note;
  R=await run(g);
  const li7=R.lis.find(li=>/AI-7 /.test(li.textContent));
  console.log('4a. not_discussed without a reason, subject shared -> warn (review required):', !!li7 && !!li7.querySelector('.msg.warn') && /possible discussion match, review required/.test(li7.textContent));
  g=clone(GOLD);
  Object.assign(g.register.find(r=>r.id==='AI-7'),{coverage:'possible_match_requires_review',segs:['S002'],note:'The S002 equipment-configuration discussion may bear on this item; needs a human call.'});
  R=await run(g);
  console.log('4b. undecided possible match -> COV-UNRESOLVED, first in the repair prompt:', R.warn('COV-UNRESOLVED'), /MUST FIX:\n1\. AI-7 is left as a possible match/.test(R.repair));
  console.log('4c. repair card mentions blockers only when a reply has them:', !!R.out.querySelector('#repair-card'), !/errors do/.test(R.out.querySelector('#repair-card').textContent));
  // 4d. the email still treats a reasoned not-discussed near-match as "under review", never as plain carryover
  R=await run(GOLD);
  R.out.querySelector('[data-accept]').click(); await sleep(500);
  d.querySelector('[data-tab="board"]').click(); await sleep(100);
  $('meeting-report').click(); await sleep(250);
  const E=[...d.querySelectorAll('dialog')].find(x=>x.open).textContent;
  console.log('4d. email: AI-7 under "Possibly discussed — under review", true carryover fenced:', /Evaluate alternate equipment configuration/.test(E.slice(E.indexOf('Possibly discussed'), E.indexOf('These were open'))), /Identify future exercise scenario/.test(E.slice(E.indexOf('These were open'))));
  console.log('4e. email: split deliverables listed as separate new actions:', /Send the notes from yesterday's coordination session/.test(E), /Send the related coordination summaries/.test(E));
})().catch(e=>{console.log('BAD',e.message,e.stack);});
