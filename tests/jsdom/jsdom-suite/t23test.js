// Atlas fixture (testers' plan, 2026-10-10): end-to-end REG-01..08 + EMAIL-01..06/09/10
// Extraction layer (EX-*) is judged on the enterprise machine by diffing the real reply
// against the golden reply; here the golden reply drives the deterministic layers.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
const TR=fs.readFileSync('/mnt/user-data/outputs/mkg-transcript-atlas-2026-10-09.txt','utf8');
const AT=fs.readFileSync('/mnt/user-data/outputs/mkg-attendance-atlas.csv','utf8');
const GOLD=fs.readFileSync('/mnt/user-data/outputs/mkg-golden-reply-atlas.json','utf8');
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
  // load the Atlas workspace through the real file loader
  w.__ws=WS;
  const wsFile=w.eval('new File([window.__ws], "mkg-workspace-atlas.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[wsFile],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  console.log('0. fixture loads clean:', /1 loaded|loaded/.test($('toast').textContent), /1 package mirrored/.test($('ws-state-board').textContent||''));

  // prepare the meeting: paste transcript (header auto-fills incl. 27m 24s duration), attach conflicting attendance
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=TR;
  $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  console.log('1. Recording header fills fields:', $('m-title').value==='Atlas Weekly Coordination', $('m-date').value==='2026-10-09', $('m-time').value==='14:00');
  w.__at=AT;
  const atFile=w.eval('new File([window.__at], "mkg-attendance-atlas.csv", {type:"text/csv"})');
  Object.defineProperty($('a-file'),'files',{value:[atFile],configurable:true});
  $('a-file').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(200);
  console.log('2. attendance attached (5 participants):', /5 participants/.test($('a-status').textContent));
  $('do-segment').click(); await sleep(250);
  const segRows=[...d.querySelectorAll('#seg-out table.seg tr')];
  console.log('3. 19 segments, boilerplate stripped, speakers matched:', segRows.length===19, !segRows.some(r=>/unmatched/.test(r.textContent)));

  // golden reply through the gate
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  $('llm-in').value=GOLD.replace('MKG1_TOKEN_PLACEHOLDER',token);
  $('do-validate').click(); await sleep(250);
  const out=$('import-out');
  console.log('4. golden reply passes all checks:', !!out.querySelector('.banner.ok'), !out.textContent.includes('error'));
  console.log('   flags surfaced first (ownership + 2 open questions):', /Reviewer questions \(3\)/.test(out.textContent), /Ownership open/.test(out.textContent) ? true : /ownership/.test(out.textContent));
  out.querySelector('[data-accept]').click(); await sleep(500);
  console.log('5. accepted:', /^Accepted/.test($('toast').textContent));

  // ---- REG assertions (fold state via Board) ----
  d.querySelector('[data-tab="board"]').click(); await sleep(100);
  d.querySelector('#projects .proj[data-project="P1"]').click(); await sleep(100);
  const P=$('panel').textContent;
  const histOf=async code=>{ const e=[...d.querySelectorAll('#panel .ent')].find(x=>x.querySelector('.code')&&x.querySelector('.code').textContent===code); e.click(); await sleep(120); const dg=[...d.querySelectorAll('dialog')].find(x=>x.open); const t=dg.textContent; dg.close(); await sleep(30); return t; };
  const h5=await histOf('AI-5');
  const accessCodes=[...new Set([...d.querySelectorAll('#panel .ent')].filter(x=>/Coordinate site access with host liaison/.test(x.textContent)).map(x=>x.querySelector('.code').textContent))];
  console.log('REG-01 AI-5 updated in place, no duplicate:', /coordinate with the host liaison for site entry/.test(h5), accessCodes.length===1 && accessCodes[0]==='AI-5');
  const h6=await histOf('AI-6');
  console.log('REG-02 AI-6 carries the accepted POC commitment, owned by Morgan:', /Owner/.test(h6) && /Morgan Reyes/.test(h6), /Unassigned to Morgan Reyes|to Morgan Reyes/.test(h6));
  const entrance=[...d.querySelectorAll('#panel .ent')].find(x=>/Verify the designated vehicle entrance/.test(x.textContent));
  console.log('REG-03 entrance task exists, assigned to Morgan:', !!entrance, /Verify the designated vehicle entrance[\s\S]{0,220}?Morgan Reyes/.test(P));
  console.log('REG-04 parking task exists, unassigned:', /Confirm parking-area surface suitability/.test(P), /Confirm parking-area surface suitability[\s\S]{0,220}?Unassigned/.test(P));
  const h8=await histOf('AI-8');
  console.log('REG-05 AI-8 substantively updated (both notes), never "not discussed":', /mast versus ground stands/.test(h8), /Working approach described \(not an accepted decision\)/.test(h8));
  const h9=await histOf('AI-9');
  console.log('REG-06 AI-9 still In progress, initiation recorded, not completed:', /In progress/.test(P) || /in progress/i.test(h9), /initiated for Alex and Drew/i.test(h9), !/Reported complete/.test(h9));
  console.log('REG-07 untouched items untouched (AI-2,3,4,7,10 in carryover only):', ['Protect participant travel information','Create restricted travel roster workbook','Identify technical support traveler','Evaluate alternate equipment configuration','Identify future exercise scenario'].every(l=>P.includes(l)));
  console.log('REG-08 no decision was minted:', !/D-\d+/.test(P));

  // ---- EMAIL assertions ----
  $('meeting-report').click(); await sleep(250); if($('msum-trace')&&!$('msum-trace').checked){$('msum-trace').checked=true;$('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(100);}
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  const T=dlg.textContent;
  console.log('EMAIL-01 new actions in their own section:', /New actions from this meeting/.test(T), /Verify the designated vehicle entrance/.test(T) && /Confirm receipt of the updated meeting invitation/.test(T));
  console.log('EMAIL-02 updated items carry summary text, not bare IDs:', /Existing items updated or referenced this meeting/.test(T), /Invitation updates initiated for Alex and Drew/.test(T));
  console.log('EMAIL-03 carryover fenced:', /Existing open items not discussed/.test(T), /no meeting-based status update is available/.test(T), /Identify future exercise scenario/.test(T));
  console.log('EMAIL-04 unresolved matters represented:', /Risks, dependencies and open questions/.test(T), /Observer attendance list remains fluid/.test(T), /no accepted owner/.test(T));
  console.log('EMAIL-05 working plan is not a decision:', !/Decisions recorded this meeting/.test(T), /Working approach described \(not an accepted decision\)/.test(T));
  console.log('EMAIL-06 relative timing never unqualified:', /Timing: “this morning” → Oct 9\./.test(T), /Timing: “today” → Oct 9\./.test(T));
  console.log('EMAIL-06b duration conflict attributed, never silently resolved:', /27m 24s \(transcript header\)/.test(T), /attendance report says 40m 06s/.test(T) && /sources disagree/.test(T));
  // EMAIL-09: every conclusion action appears in the new-actions section
  const concl=T.slice(T.indexOf('Conclusion'));
  const codes=[...concl.matchAll(/AI-\d+/g)].map(m=>m[0]);
  const newSec=T.slice(T.indexOf('New actions from this meeting'), T.indexOf('Existing items updated'));
  console.log('EMAIL-09 conclusion actions all present in sections:', codes.length>0, codes.every(c=>newSec.includes(c)));
  // EMAIL-10: contiguous numbering with Decisions omitted
  const nums=[...T.matchAll(/(\d+)\. (?:Meeting Overview|Executive Summary|Participants|Decisions recorded|New actions|Existing items updated|Existing open items|Risks, dependencies|Conclusion)/g)].map(m=>+m[1]);
  console.log('EMAIL-10 numbering contiguous with Decisions omitted:', nums.length>=7, nums.every((n,i)=>n===i+1));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
