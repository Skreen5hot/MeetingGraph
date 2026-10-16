// D-UX8 (ratified 2026-10-10): traceability toggle — EMAIL-07 (OFF suppresses) / EMAIL-08 (ON retains)
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
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async t=>{w.__plain=t;},write:async items=>{w.__rich=items;}}});
  w.ClipboardItem=class{constructor(i){this.items=i}};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}; w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.confirm=()=>true; w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  // Atlas end-to-end to a folded meeting
  w.__ws=WS;
  const wsFile=w.eval('new File([window.__ws], "mkg-workspace-atlas.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[wsFile],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=TR; $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  w.__at=AT;
  const atFile=w.eval('new File([window.__at], "mkg-attendance-atlas.csv", {type:"text/csv"})');
  Object.defineProperty($('a-file'),'files',{value:[atFile],configurable:true});
  $('a-file').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(200);
  $('do-segment').click(); await sleep(250);
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  $('llm-in').value=GOLD.replace('MKG1_TOKEN_PLACEHOLDER',token);
  $('do-validate').click(); await sleep(250);
  $('import-out').querySelector('[data-accept]').click(); await sleep(500);
  d.querySelector('[data-tab="board"]').click(); await sleep(100);
  $('meeting-report').click(); await sleep(250);
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);

  // EMAIL-08: ON (default) retains everything
  let T=$('msum-preview').textContent;
  console.log('EMAIL-08 toggle present and OFF by default (recipient copy first, Aaron 2026-10-13):', !!$('msum-trace') && !$('msum-trace').checked);
  if($('msum-trace')&&!$('msum-trace').checked){$('msum-trace').checked=true;$('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(100);} T=$('msum-preview').textContent;
  console.log('EMAIL-08 ON: evidence refs + conflict + reviewer notes retained:', /Evidence: S005\./.test(T), /sources disagree/.test(T) && /40m 06s/.test(T), /Reviewer flags:/.test(T));

  // EMAIL-07: OFF renders the recipient copy
  $('msum-trace').checked=false; $('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(100);
  T=$('msum-preview').textContent;
  console.log('EMAIL-07 OFF: evidence refs suppressed:', !/Evidence: S\d{3}/.test(T));
  console.log('EMAIL-07 OFF: one attributed duration, no conflict narrative:', /27m 24s \(from the transcript header\)/.test(T), !/sources disagree/.test(T) && !/40m 06s/.test(T));
  console.log('EMAIL-07 OFF: reviewer-doctrine footnotes gone, content kept:', !/Reviewer flags:/.test(T), /Risks, dependencies and open questions/.test(T) && /Observer attendance list remains fluid/.test(T));
  console.log('EMAIL-07 OFF: substance identical (sections, timing wording):', /New actions from this meeting/.test(T), /Timing: “this morning” → Oct 9\./.test(T), /no meeting-based status update is available/.test(T));

  // copies follow the current variant
  $('msum-copy-plain').click(); await sleep(50);
  console.log('copy follows the toggle (recipient copy):', /recipient copy/.test($('toast').textContent), !/Evidence: S\d{3}/.test(w.__plain||''));
  $('msum-trace').checked=true; $('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(100);
  $('msum-copy-plain').click(); await sleep(50);
  console.log('copy follows the toggle (reviewer copy):', /reviewer copy/.test($('toast').textContent), /Evidence: S005\./.test(w.__plain||''));

  // register/reviewer workspace unaffected: history still carries evidence
  dlg.close(); await sleep(30);
  const ent=[...d.querySelectorAll('#panel .ent')].find(x=>/Coordinate site access/.test(x.textContent)); ent.click(); await sleep(120);
  const h=[...d.querySelectorAll('dialog')].find(x=>x.open).textContent;
  console.log('register keeps everything regardless:', /I will coordinate with the host liaison/.test(h));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
