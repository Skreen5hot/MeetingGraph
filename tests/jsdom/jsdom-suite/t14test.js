// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// T-UX-3 (plan v0.1 phase 1c): report wording — "due date set" for minted items, "moved" only for real changes
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
const openDialog=()=>[...d.querySelectorAll('dialog')].find(x=>x.open);
(async()=>{
  await sleep(300);
  $('load-sample').click(); await sleep(300);

  // Meeting 1 (Oct 1): sample extractor output mints a tasking WITH a due date (2026-10-31)
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click();
  $('do-segment').click(); await sleep(200);
  const segRow=[...d.querySelectorAll('#seg-out table.seg tr')].find(r=>/interconnection security agreement/.test(r.textContent));
  const SEG=segRow.cells[0].textContent.trim().split(/\s+/)[0];
  const QUOTE='interconnection security agreement';
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-output').click();
  $('do-validate').click(); await sleep(150);
  const mintRow=[...d.querySelectorAll('#import-out .msg')].map(x=>x.textContent).find(t=>/^Creates AI-/.test(t));
  const CODE=(mintRow.match(/Creates (AI-\d+)/)||[])[1];
  console.log('1. sample output valid, mints a coded item:', !!$('import-out').querySelector('.banner.ok'), !!CODE);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);
  console.log('2. accepted meeting 1:', /^Accepted/.test($('toast').textContent));

  // Program email report as of Oct 1: the new item's due date was ESTABLISHED, not moved
  $('email-report').click(); await sleep(200);
  let T=openDialog().textContent;
  console.log('3. report: minted due date reads "set":', /due date set: Oct 31/.test(T));
  console.log('4. report: no "moved" for the minted item:', !/due date moved to Oct 31/.test(T));
  openDialog().close();

  // Meeting 2 (Oct 8): a Deadline op on that SAME item — now it genuinely moved
  d.querySelector('[data-tab="prepare"]').click();
  $('m-date').value='2026-10-08'; $('m-date').dispatchEvent(new w.Event('input',{bubbles:true}));
  $('do-segment').click(); await sleep(200);
  d.querySelector('[data-tab="prepare"]').click();
  $('llm-in').value=JSON.stringify({ops:[{op:'Deadline',tasking:CODE,dueDate:'2026-11-06',src:[{seg:SEG,quote:QUOTE}]}],flags:[]});
  $('do-validate').click(); await sleep(150);
  console.log('5. deadline-change reply valid:', !!$('import-out').querySelector('.banner.ok'));
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);
  console.log('6. accepted meeting 2:', /^Accepted/.test($('toast').textContent));

  $('email-report').click(); await sleep(200);
  T=openDialog().textContent;
  console.log('7. report: a real change still reads "moved":', /due date moved to Nov 6/.test(T));
  console.log('8. report: no "set" wording for the change:', !/due date set: Nov 6/.test(T));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
