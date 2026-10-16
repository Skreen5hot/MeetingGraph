// Validation-criteria rule tightenings (2026-10-10): initiation≠completion, plan≠decision, event window≠deadline
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
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('do-segment').click(); await sleep(200);
  const chat=$('chat-text').value;
  console.log('1. rule 5: initiation is not completion (both directions guarded):',
    /initiation is not completion/.test(chat), /let me know if you receive it/.test(chat),
    /downgrading a stated completion to a ProgressNote loses it/.test(chat));
  console.log('2. rule 5: confirm-receipt request can be its own tasking:', /record the receipt confirmation as its own tasking only when accepted or explicitly required/.test(chat));
  console.log('3. rule 6: event windows are never deadlines:', /planning window .* is a ProgressNote on the relevant work, never a dueDate/.test(chat));
  console.log('4. rule 11: a described plan is not a decision:', /describing their current plan or expected approach is a ProgressNote, not a Decision/.test(chat));
  d.querySelector('[data-tab="seed"]').click();
  $('att-name').value='Aaron D.'; $('att-text').value='Mei Chen confirmed by email that the field review is complete.';
  $('att-build').click(); await sleep(300);
  console.log('5. attestation request carries the same rules:', /initiation is not completion/.test($('att-text-out').value));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
