const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let confirms=[];
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
  w.confirm=m=>{confirms.push(m);return true;};
  w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  // Step 1 of the runbook: load the demo workspace file
  const inp=$('file-in');
  Object.defineProperty(inp,'files',{value:[{name:'mkg-workspace-correction-demo.json',text:async()=>fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-correction-demo.json','utf8')}],configurable:true});
  inp.dispatchEvent(new w.Event('change')); await sleep(450);
  console.log('1. loaded 3 packages:', /3 loaded/.test($('toast').textContent), [...$('asof').options].length===3);
  d.querySelector('[data-project="P2"]').click();
  const codes=[...d.querySelectorAll('#panel .snap [data-ent] .code')].map(c=>c.textContent);
  console.log('2. twin visible on the board:', codes.includes('AI-403') && codes.includes('AI-404'));
  // Step 2: Build correction request — candidates found, no nag
  d.querySelector('[data-tab="prepare"]').click();
  d.querySelector('#view-prepare details').open=true;
  confirms=[];
  $('corr-build').click(); await sleep(100);
  const req=$('corr-text').value;
  console.log('3. request built silently (real candidates):', confirms.length===0, /AI-40[34] "[^"]+" \([^)]*\) ~ AI-40[34]/.test(req), /MKG1\|correction\|/.test(req));
  // Step 3: paste the canned reply (tokenless on purpose — a real chat reply carries the token)
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({ops:[{op:'SameAs',duplicate:'AI-404',survivor:'AI-403',reason:'AI-404 restates the interconnection security agreement already tracked as AI-403: same work, same owner, same due date.'}]});
  $('do-validate').click();
  const out=$('import-out').textContent;
  console.log('4. validates: merge info + tokenless fallback warn:', /same work as AI-403/.test(out), /No context token/.test(out));
  console.log('5. accept label says correction:', /Accept: add correction package/.test(d.querySelector('#import-out [data-accept]').textContent));
  d.querySelector('#import-out [data-accept]').click(); await sleep(450);
  // Step 4: watch it fold
  d.querySelector('[data-project="P2"]').click();
  const codes2=[...d.querySelectorAll('#panel .snap [data-ent] .code')].map(c=>c.textContent);
  console.log('6. AI-404 absorbed, alias shown:', !codes2.includes('AI-404'), /\(also AI-404\)/.test($('panel').textContent));
  [...d.querySelectorAll('[data-ent]')].find(b=>b.querySelector('.code')?.textContent==='AI-403').click(); await sleep(30);
  console.log('7. survivor history carries the reason:', /restates the interconnection security agreement/.test($('hist').textContent));
})();
