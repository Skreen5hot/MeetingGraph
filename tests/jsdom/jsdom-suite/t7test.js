const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let confirms=[], confirmReply=true;
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
  w.confirm=m=>{confirms.push(m);return confirmReply;};
  w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  // 1) corrections card is collapsed + labeled advanced
  const det=d.querySelector('#view-prepare details');
  console.log('1. collapsed advanced card:', !!det && !det.open && /advanced, rarely needed/.test(det.querySelector('summary').textContent));
  // 2) corr-build on a register with no duplicates asks first; decline builds nothing
  confirms=[]; confirmReply=false;
  d.querySelector('[data-tab="prepare"]').click();
  $('corr-build').click(); await sleep(80);
  console.log('2. no-candidates confirm:', confirms.length===1 && /No duplicate candidates were detected/.test(confirms[0]) && /use Number segments above/.test(confirms[0]));
  console.log('2. declined -> nothing built:', !$('corr-text'));
  // accept it to reproduce Aaron's exact test
  confirms=[]; confirmReply=true;
  $('corr-build').click(); await sleep(80);
  console.log('3. accepted -> request built with correction token:', /MKG1\|correction\|/.test($('corr-text').value));
  const tok=($('corr-text').value.match(/MKG1\|correction\|[^\n]+/)||[])[0];
  // 4) Aaron's empty reply: valid outcome, stated plainly, nothing importable, meeting flow named
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({context:tok,ops:[]});
  $('do-validate').click();
  const out=$('import-out').textContent;
  console.log('4. empty correction stated as valid outcome:', /no merges it could justify, which is a valid outcome/.test(out));
  console.log('4. points to the meeting flow:', /meeting flow above: Number segments . Copy text for the chat/.test(out));
  console.log('4. nothing importable:', !d.querySelector('#import-out [data-accept]'));
  // 5) empty MEETING reply is a hard stop with rule-8 guidance
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('m-date').value='2026-10-01'; $('m-time').value='10:00'; $('m-offset').value='-04:00'; $('m-title').value='Weekly board walk';
  $('do-segment').click(); await sleep(80);
  const mtok=($('chat-text').value.match(/MKG1\|transcript\|[^\n]+/)||[])[0];
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({context:mtok,ops:[]});
  $('do-validate').click();
  console.log('5. empty meeting reply blocked with rule-8 guidance:', /at least Discussed entries \(rule 8\)/.test($('import-out').textContent), !d.querySelector('#import-out [data-accept]'));
  // 6) the real sample import still flows normally
  $('sample-output').click(); $('do-validate').click();
  console.log('6. normal import unaffected:', d.querySelector('#import-out .banner').classList.contains('ok'), /Accept: add the/.test(d.querySelector('#import-out [data-accept]').textContent));
})();
