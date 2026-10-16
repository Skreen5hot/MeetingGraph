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
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);
  // Cold entry to the gate: nothing prepared
  d.querySelector('[data-tab="prepare"]').click(); await sleep(30);
  const strip=$('import-meeting').textContent;
  console.log('1. cold strip explains both routes:', /needs its numbered transcript in this session/.test(strip), /duplicate-merge reply .* can be pasted here directly/.test(strip));
  console.log('2. mirror shortcut present with step chip:', !!$('goto-prepare') && /1/.test($('goto-prepare').textContent));
  $('goto-prepare').click(); await sleep(30);
  console.log('3. routes to Prepare, focus on the transcript (Step 1):', d.querySelector('[data-tab="prepare"]').getAttribute('aria-selected')==='true', d.activeElement && d.activeElement.id==='transcript');
  // Correction reply still imports with zero preparation (token self-routing, full path)
  d.querySelector('#view-prepare details').open=true;
  $('corr-build').click(); await sleep(100); // sample world has no candidates -> confirm auto-yes
  const tok=($('corr-text').value.match(/MKG1\|correction\|[^\n]+/)||[])[0];
  $('clear-ws').click(); await sleep(300); $('load-sample').click(); await sleep(300); // wipe prepared state entirely
  d.querySelector('[data-tab="prepare"]').click(); await sleep(30);
  console.log('4. after clear: cold again:', !!$('goto-prepare'));
  $('llm-in').value=JSON.stringify({context:tok,ops:[]});
  $('do-validate').click(); await sleep(30);
  console.log('5. tokened correction reply handled cold (valid-empty explained, no crash):', /no merges it could justify, which is a valid outcome/.test($('import-out').textContent));
})();
