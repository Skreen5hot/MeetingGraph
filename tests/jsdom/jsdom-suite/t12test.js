// T-UX-1 (plan v0.1 phase 1a): preparation staleness — readiness derives from all meeting inputs
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
const setVal=(id,v)=>{ $(id).value=v; $(id).dispatchEvent(new w.Event('input',{bubbles:true})); $(id).dispatchEvent(new w.Event('change',{bubbles:true})); };
const token=()=>{ const m=($('chat-text')&&$('chat-text').value||'').match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/); return m?m[0]:null; };
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click();
  $('do-segment').click(); await sleep(200);
  console.log('1. numbered, status ok:', /Numbered ✓/.test($('prep-status').textContent));
  const tok1=token();
  console.log('   token emitted:', !!tok1);

  // title edit -> stale
  setVal('m-title','Weekly board walk EDITED');
  console.log('2. title edit -> stale status:', /Preparation out of date/.test($('prep-status').textContent), /title changed/.test($('prep-status').textContent), $('prep-status').className.includes('bad'));
  $('copy-chat').click(); await sleep(50);
  console.log('3. Copy text refuses while stale:', /Preparation out of date/.test($('toast').textContent), !/^Copied/.test($('toast').textContent));

  // restoring the field reconciles without re-numbering
  setVal('m-title','Weekly board walk');
  console.log('4. restore title -> fresh again:', /Numbered ✓/.test($('prep-status').textContent));
  $('copy-chat').click(); await sleep(50);
  console.log('   copy works again:', /^Copied/.test($('toast').textContent));

  // date edit -> stale; visible on the Import strip too
  setVal('m-date','2026-10-02');
  console.log('5. date edit -> stale names the field:', /meeting date changed/.test($('prep-status').textContent));
  d.querySelector('[data-tab="prepare"]').click(); await sleep(50);
  console.log('6. import strip warns, uses prepared values:', /Preparation out of date/.test($('import-meeting').textContent), /prepared values/.test($('import-meeting').textContent));
  d.querySelector('[data-tab="prepare"]').click();

  // re-number reconciles and re-keys the token (new meeting id)
  $('do-segment').click(); await sleep(200);
  const tok2=token();
  console.log('7. re-number -> fresh, token re-keyed:', /Numbered ✓/.test($('prep-status').textContent), !!tok2 && tok2!==tok1, /20261002/.test(tok2||''));

  // idempotency: re-number with unchanged inputs -> same token
  $('do-segment').click(); await sleep(200);
  console.log('8. idempotent re-number, same token:', token()===tok2);

  // time + offset edits also count
  setVal('m-time','11:30');
  console.log('9. time edit -> stale:', /start time changed/.test($('prep-status').textContent));
  setVal('m-time','10:00');
  setVal('m-offset','-05:00');
  console.log('   offset edit -> stale:', /time zone changed/.test($('prep-status').textContent));
  setVal('m-offset','-04:00');

  // attendance attaches at Accept by design: changing it is effective, never stale
  $('a-sample').click(); await sleep(50);
  console.log('10. attendance attach after numbering is NOT stale:', /Numbered ✓/.test($('prep-status').textContent), !/Preparation out of date/.test($('prep-status').textContent));

  // transcript edit falls back to the step-2 state (and copy refuses)
  $('transcript').value=$('transcript').value+'\nAn extra line.';
  $('transcript').dispatchEvent(new w.Event('input',{bubbles:true}));
  console.log('11. transcript edit -> back to Step 2:', /Step 2: Number segments/.test($('prep-status').textContent));
  $('copy-chat').click(); await sleep(50);
  console.log('    copy refuses (transcript named):', /transcript/.test($('toast').textContent) && /Preparation out of date/.test($('toast').textContent));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
