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
  // 1) empty workspace: status says load the register first
  d.querySelector('[data-tab="prepare"]').click();
  console.log('1. status: load register first:', /load the register/.test($('prep-status').textContent), $('prep-status').className.includes('bad'));
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  console.log('2. status: step 1 paste transcript:', /Step 1: paste the meeting transcript/.test($('prep-status').textContent));
  // 2) Aaron's exact path: sample transcript loaded, numbering SKIPPED
  $('sample-transcript').click();
  console.log('3. status flips to Step 2, urgent:', /Step 2: Number segments/.test($('prep-status').textContent), $('prep-status').className.includes('bad'));
  // open the collapsed corrections card and click Build (what he did)
  d.querySelector('#view-prepare details').open=true;
  confirms=[];
  $('corr-build').click(); await sleep(80);
  console.log('4. speed bump, not a build:', /hasn’t been numbered|hasn\'t been numbered/.test($('corr-out').textContent), !$('corr-text'), confirms.length===0);
  console.log('5. bump offers Step 2 routing:', !!$('corr-goseg'));
  $('corr-goseg').click();
  console.log('6. routed: focus on Number segments, bump cleared:', d.activeElement && d.activeElement.id==='do-segment', $('corr-out').innerHTML==='');
  // 3) deliberate correction path: click twice to pass the bump, then the no-candidates confirm
  confirms=[]; confirmReply=true;
  $('corr-build').click(); await sleep(50);   // bump again (transcript still un-numbered)
  $('corr-build').click(); await sleep(100);  // second click proceeds
  console.log('7. second click proceeds to confirm + builds:', confirms.length===1 && /No duplicate candidates/.test(confirms[0]), /MKG1\|correction\|/.test(($('corr-text')||{}).value||''));
  // 4) the intended flow: numbering flips status to Step 3; corr-build after numbering has no bump
  $('do-segment').click(); await sleep(100);
  console.log('8. status: numbered, Step 3 next:', /Numbered ✓/.test($('prep-status').textContent), /Step 3: Copy text for the chat/.test($('prep-status').textContent));
  console.log('9. step chips on the three actions:', /2/.test($('do-segment').textContent) && /3/.test($('copy-chat').textContent) && !!d.querySelector('.stepchip'));
  confirms=[];
  $('corr-build').click(); await sleep(100);
  console.log('10. numbered world: no bump, straight to confirm:', confirms.length===1 && !/hasn\'t been numbered/.test($('corr-out').textContent));
  // 5) a11y affordances present
  const css=html;
  console.log('11. focus-visible + large primary in CSS:', /:focus-visible\{outline:3px/.test(css), /min-height:40px/.test(css));
  console.log('12. status line is a live region:', $('prep-status').getAttribute('role')==='status' && $('prep-status').getAttribute('aria-live')==='polite');
})();
