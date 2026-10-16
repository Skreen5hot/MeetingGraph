const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',beforeParse(w){
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; w.DecompressionStream=DecompressionStream;
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
const HDR=`Q4-Planning-20261008_141530-Meeting Transcript
October 8, 2026, 2:15PM
12m 3s

Chen, Mei started transcription
Chen, Mei 0 minutes 5 seconds
Quick planning check-in on the portal work.
Patel, Raj 0 minutes 40 seconds
All good on my side.`;
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  // 1) PASTE path: hyphenated title, PM arithmetic, seconds dropped
  $('transcript').value=HDR;
  $('transcript').dispatchEvent(new w.Event('paste')); await sleep(30);
  console.log('1. paste fills all three:', $('m-title').value==='Q4-Planning', $('m-date').value==='2026-10-08', $('m-time').value==='14:15');
  console.log('2. toast announces values:', /Teams header detected/.test($('toast').textContent) && /Q4-Planning/.test($('toast').textContent) && /2026-10-08 14:15/.test($('toast').textContent));
  // 3) header lines never become segments
  $('do-segment').click(); await sleep(100);
  const rows=[...d.querySelectorAll('#seg-out .seg tr')].map(tr=>tr.textContent.replace(/\s+/g,' '));
  console.log('3. two segments, no header junk:', rows.length===2, rows[0].includes('S001') && /Chen/.test(rows[0]), !rows.some(r=>/Meeting Transcript|started transcription|12m 3s/.test(r)));
  console.log('4. chat text carries populated meeting line:', /MEETING: 2026-10-08 .*Q4-Planning/.test($('chat-text').value));
  // 5) fallback: no filename line, only the human-readable date line (incl 12AM edge)
  $('m-title').value='Keep me'; 
  $('transcript').value='December 31, 2026, 12:05 AM\nChen, Mei 0 minutes 5 seconds\nMidnight ops check.';
  $('transcript').dispatchEvent(new w.Event('paste')); await sleep(30);
  console.log('5. fallback date/time, title untouched:', $('m-date').value==='2026-12-31', $('m-time').value==='00:05', $('m-title').value==='Keep me');
  // 6) non-Teams paste: nothing changes
  $('m-date').value='2026-01-01'; $('m-time').value='09:00';
  $('transcript').value='[00:00:40] Mei Chen: Plain bracket transcript.';
  $('transcript').dispatchEvent(new w.Event('paste')); await sleep(30);
  console.log('6. plain paste leaves fields alone:', $('m-date').value==='2026-01-01' && $('m-time').value==='09:00');
  // 7) DOCX path end to end
  const buf=fs.readFileSync('/tmp/teams-header.docx');
  w.__bytes=Array.from(buf);
  const file=w.eval("new File([new Uint8Array(window.__bytes)],'sync.docx')");
  const inp=$('t-file');
  Object.defineProperty(inp,'files',{value:[file],configurable:true});
  inp.dispatchEvent(new w.Event('change')); await sleep(400);
  console.log('7. docx fills fields:', $('m-title').value==='Dashboard migration sync', $('m-date').value==='2026-10-13', $('m-time').value==='14:00');
  console.log('8. docx toast combined:', /Teams header detected/.test($('toast').textContent) && /2026-10-13 14:00/.test($('toast').textContent));
})();
