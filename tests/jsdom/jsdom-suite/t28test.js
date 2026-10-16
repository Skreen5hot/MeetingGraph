// D-UX9 flawed path (COV): every finding category fires; deterministic falsity blocks; nothing self-certifies
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
const TR=fs.readFileSync('/mnt/user-data/outputs/mkg-transcript-atlas-2026-10-09.txt','utf8');
const FLAWED=fs.readFileSync('/mnt/user-data/outputs/mkg-flawed-reply-atlas.json','utf8');
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
  $('llm-in').value=FLAWED.replace('MKG1_TOKEN_PLACEHOLDER',token);
  $('do-validate').click(); await sleep(250);
  const T=$('import-out').textContent;

  // deterministic falsity: unsupported "now" timing is a hard stop
  console.log('COV-timing: unsupported due phrase is a validation stop:', /Due phrase "now" is not in the cited segment/.test(T), /Nothing has been saved/.test(T));
  console.log('COV-modality: future commitment not rendered as past activity:', /preserve the speaker's modality/.test(T));
  console.log('COV-completion: unsupported completion warned:', /initiation is not completion \(rule 5\)/.test(T));

  const card=[...$('import-out').querySelectorAll('.card')].find(x=>/Coverage review/.test(x.querySelector('h3').textContent));
  const C=card?card.textContent:'';
  console.log('COV-omitted-commitment: S008/S010 dispositioned but unproduced:', /S008 is classified commitment but no operation or flag cites it/.test(C), /S010 is classified commitment/.test(C));
  console.log('COV-omitted-discussion: AI-8 contradiction between the two tables:', /AI-8 .*marked not discussed in the register table, but the segments table says S014/.test(C) && /tables contradict each other/.test(C));
  console.log('COV-misbound: S003 about AI-1 recorded on AI-5:', /S003 is dispositioned as about AI-1, but a ProgressNote records it on AI-5/.test(C));
  console.log('COV-missing: S019 undispositioned + AI-10 unclassified:', /No disposition for 1 segment: S019/.test(C), /AI-10 .*no coverage classification/.test(C));
  console.log('COV-uncertain: empty-note uncertain flagged:', /S004 is marked uncertain_requires_review without the required one-line note/.test(C));
  console.log('COV-no-output: AI-6 claimed updated, nothing touches it:', /AI-6 is marked updated, but no operation touches it/.test(C));
  console.log('COV-resolutions offered per finding:', card && card.querySelectorAll('[data-covres]').length>=7);
})().catch(e=>{console.log('BAD',e.message,e.stack);});
