// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// D-UX9 clean path (COV): golden with coverage tables cross-checks clean; resolutions stored; email renders claims honestly
const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const WS=fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json','utf8');
const TR=fs.readFileSync('/mnt/user-data/outputs/mkg-transcript-atlas-2026-10-09.txt','utf8');
const GOLD=fs.readFileSync('/mnt/user-data/outputs/mkg-golden-reply-atlas.json','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',beforeParse(w){
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  w.URL.createObjectURL=b=>{w.__lastBlob=b;return 'blob:x';}; w.URL.revokeObjectURL=()=>{};
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
  const chat=$('chat-text').value;
  console.log('1. prompt carries the four-step workflow + table schema:', /STEP 1\. Classify EVERY segment/.test(chat), /review EVERY active register item/.test(chat), /"segments": \[/.test(chat) && /"register": \[/.test(chat), /claims for the reviewer, not proof/.test(chat));
  const token=(chat.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];

  // tables missing -> audit warning, never a block
  $('llm-in').value=JSON.stringify({context:token,ops:[{op:'ProgressNote',tasking:'AI-5',text:'x',src:[{seg:'S005',quote:'I will coordinate with the host liaison'}]}],flags:[]});
  $('do-validate').click(); await sleep(200);
  let out=$('import-out');
  console.log('2. no tables -> coverage cannot be audited (warn, accept stays):', /completeness cannot be audited/.test(out.textContent), !!(await UXA(out)).querySelector('[data-accept]') && !(await UXA(out)).querySelector('[data-accept]').disabled);

  // the golden: cross-checks clean (info-level findings only, by design)
  $('llm-in').value=GOLD.replace('MKG1_TOKEN_PLACEHOLDER',token);
  $('do-validate').click(); await sleep(250);
  out=$('import-out');
  const card=[...out.querySelectorAll('.card')].find(x=>/Coverage review/.test(x.querySelector('h3').textContent));
  const warns=card?[...card.querySelectorAll('.msg.warn')]:[];
  const infos=card?[...card.querySelectorAll('.msg.info')]:[];
  console.log('3. golden: coverage card present, zero warn-level findings:', !!card, warns.length===0);
  console.log('3b. golden: no repair round (zero repair-required findings, selfReview present):', !out.querySelector('#repair-card'), !/SELF-REVIEW-MISSING/.test(card.textContent));
  const infoCodes=infos.map(x=>(x.closest('li')||{dataset:{}}).dataset.code||'-').sort().join(',');
  console.log('4. designed info findings: AI-7 decided with its reason (D-UX10) + three advisories:', infos.some(x=>/AI-7 .*marked not discussed with a reason/.test(x.textContent) && /nothing was reported on evaluating the alternate configuration/.test(x.textContent)), infoCodes==='-,MATCH-SCOPE-MISFIT,NEW-DUPLICATE,QUOTE-TRUNCATED');
  console.log('5. true not-discussed items draw no noise (AI-2/3/10 absent from card):', card && !/AI-2 |AI-3 |AI-10 /.test(card.textContent));
  // record a non-default resolution, then accept
  const sel=card.querySelector('[data-covres="1"]')||card.querySelector('[data-covres]');
  sel.value='deferred';
  (await UXA(out)).querySelector('[data-accept]').click(); await sleep(500);
  console.log('6. accepted with coverage stored:', /^Accepted/.test($('toast').textContent));
  const pkgTxt=await w.eval('new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsText(window.__lastBlob);})');
  const pkgObj=JSON.parse(pkgTxt);
  const cv=pkgObj.coverage;
  console.log('7. downloaded package carries tables + per-finding resolutions:', !!cv && cv.segments.length===19 && cv.register.length===10, !!cv && cv.findings.length===4 && cv.findings.filter(f=>f.resolution==='deferred').length===1, !!cv && cv.findings.some(f=>f.code==='QUOTE-TRUNCATED' && f.repair===false));

  // email: "not discussed" stays a claim; the flagged possible match renders under review
  d.querySelector('[data-tab="board"]').click(); await sleep(100);
  $('meeting-report').click(); await sleep(250);
  const T=[...d.querySelectorAll('dialog')].find(x=>x.open).textContent;
  console.log('8. AI-7 renders as possibly discussed/under review:', /Possibly discussed — under review/.test(T), /Evaluate alternate equipment configuration/.test(T.slice(T.indexOf('Possibly discussed'), T.indexOf('These were open'))));
  console.log('9. true carryover stays plainly fenced:', /no meeting-based status update is available/.test(T), /Identify future exercise scenario/.test(T.slice(T.indexOf('These were open'))));
})().catch(e=>{console.log('BAD',e.message,e.stack);});
