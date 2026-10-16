// D-UX6 (ratified 2026-10-09): out-of-meeting update — reviewer attestation through the same gate
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
  d.querySelector('[data-tab="seed"]').click();
  console.log('1. Workspace card present:', /Out-of-meeting update \(reviewer attestation\)/.test(d.querySelector('#view-seed').textContent), !!$('att-name') && !!$('att-text') && !!$('att-build'));

  // guards
  $('att-build').click(); await sleep(30);
  console.log('2. refuses without a register:', /Load the register first/.test($('toast').textContent));
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="seed"]').click();
  $('att-build').click(); await sleep(30);
  console.log('3. refuses without a name:', /recorded in the reviewer's own name/.test($('toast').textContent));
  $('att-name').value='Aaron D.';
  $('att-build').click(); await sleep(30);
  console.log('4. refuses without statements:', /one fact per line/.test($('toast').textContent));
  $('att-text').value='My SSN is 123-45-6789 for the record.';
  $('att-build').click(); await sleep(30);
  console.log('5. hard-blocks PII:', /Social Security number/.test($('toast').textContent), !$('att-out').textContent.trim());

  // build a real request
  $('att-text').value='Priya Patel confirmed by email on Oct 8: the dashboard rebuild AI-302 is due 2026-10-20.\nSofia Alvarez told me after the meeting that step three review is underway on AI-103.';
  $('att-build').click(); await sleep(200);
  const req=$('att-text-out').value;
  const token=(req.match(/MKG1\|attestation\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  console.log('6. request: token, attestation note, statements as segments in the reviewer’s name:', !!token, /REVIEWER ATTESTATION: what follows is not a meeting/.test(req), /S001 Aaron D\.: Priya Patel confirmed/.test(req), /Out-of-meeting update \(reviewer attestation\)/.test(req));

  // the reply box knows what is prepared
  $('att-go').click(); await sleep(50);
  console.log('7. strip: attestation by name, 2 statements; consequence named:', /out-of-meeting update \(reviewer attestation\) by Aaron D\. — 2 statements/.test($('import-meeting').textContent), /adds a reviewer-attestation package/.test($('import-meeting').textContent));

  // import the reply
  $('llm-in').value=JSON.stringify({context:token,ops:[
    {op:'Deadline',tasking:'AI-302',dueDate:'2026-10-20',duePhrase:'confirmed by email',src:[{seg:'S001',quote:'AI-302 is due 2026-10-20'}]},
    {op:'ProgressNote',tasking:'AI-103',text:'Reviewer reports step three review underway (per Sofia Alvarez, after the meeting).',src:[{seg:'S002',quote:'step three review is underway'}]}
  ],flags:[]});
  $('do-validate').click(); await sleep(150);
  let T=$('import-out').textContent;
  console.log('8. checks passed as attestations; accept names the act:', /recorded as reviewer attestations/.test(T), /the evidence is your written statements/.test(T), /Accept: add out-of-meeting update/.test($('import-out').querySelector('[data-accept]').textContent));
  console.log('   routing labeled Attestation, not Seed:', /Attestation \(extension\)/.test($('import-out').innerHTML), !/Seed \(extension\)/.test($('import-out').innerHTML));
  $('import-out').querySelector('[data-accept]').click(); await sleep(400);
  console.log('9. accepted; attestation file downloaded (ws-state names it):', /^Accepted/.test($('toast').textContent), /mkg-attestation-/.test($('ws-state-prep').textContent));

  // fold + board
  d.querySelector('[data-tab="board"]').click(); await sleep(50);
  d.querySelector('#projects .proj[data-project="P3"]').click(); await sleep(50);
  const panelT=$('panel').textContent;
  const attSec=[...d.querySelectorAll('#panel .meeting')].find(x=>/Out-of-meeting update/.test(x.textContent));
  console.log('10. log shows the update with full entries (not the manual one-liner):', !!attSec, /Due date/.test(attSec.textContent), !!attSec.querySelector('ul.ops') && !/entries imported without transcript evidence/.test(attSec.textContent));
  const ent=[...d.querySelectorAll('#panel .ent')].find(x=>/AI-302/.test(x.textContent)); ent.click(); await sleep(100);
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  console.log('11. AI-302 history carries the due date and the reviewer’s statement as evidence:', /Oct 20|2026-10-20/.test(dlg.textContent), /Priya Patel confirmed by email/.test(dlg.textContent), /Aaron D\./.test(dlg.textContent));
  dlg.close();

  // email guard + empty-reply outcome
  $('asof').value=[...$('asof').options].find(o=>/Out-of-meeting update/.test(o.textContent)).value;
  $('asof').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  $('meeting-report').click(); await sleep(50);
  console.log('12. meeting-email guard names the attestation kind:', /an out-of-meeting update/.test($('toast').textContent));
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({context:token,ops:[]});
  $('do-validate').click(); await sleep(100);
  T=$('import-out').textContent;
  console.log('13. empty attestation reply is a valid outcome, no accept:', /valid outcome/.test(T) && /nothing in the statements/.test(T), !$('import-out').querySelector('[data-accept]'));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
