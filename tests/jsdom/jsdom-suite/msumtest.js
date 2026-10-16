const {JSDOM}=require('jsdom'); const fs=require('fs');
const {indexedDB}=require('fake-indexeddb');
const html=fs.readFileSync('/mnt/user-data/outputs/MeetingGraph.html','utf8');
let plain='', richParts=null;
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',beforeParse(w){
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  Object.defineProperty(w,'indexedDB',{value:indexedDB});
  Object.defineProperty(w.navigator,'storage',{value:{persist:async()=>true}});
  w.ClipboardItem=class{constructor(i){this.items=i}};
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async t=>{plain=t},write:async p=>{richParts=p}}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}; w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.confirm=()=>true; w.onerror=m=>console.log('WINDOW ERROR',m); w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  // Fixture: the correction-demo workspace (Oct 1 = full board walk w/ attendance+flags; Oct 8 = P2-only, no attendance)
  const inp=$('file-in');
  Object.defineProperty(inp,'files',{value:[{name:'demo.json',text:async()=>fs.readFileSync('/mnt/user-data/outputs/mkg-workspace-correction-demo.json','utf8')}],configurable:true});
  inp.dispatchEvent(new w.Event('change')); await sleep(450);
  d.querySelector('[data-project="P2"]').click(); await sleep(30);
  console.log('0. both emails co-located in the State-as-of menu:', !!d.querySelector('.list-head #email-report') && !!d.querySelector('.list-head #meeting-report') && /Program email report/.test($('email-report').textContent) && /Meeting email report/.test($('meeting-report').textContent));
  // ---- SCOPING: the Oct 8 P2-only meeting, via the as-of selector ----
  const oct8opt=[...$('asof').options].find(o=>o.textContent.includes('Oct 8'));
  $('asof').value=oct8opt.value; $('asof').dispatchEvent(new w.Event('change')); await sleep(30);
  $('meeting-report').click(); await sleep(30);
  let T=$('hist').textContent.replace(/\s+/g,' ');
  console.log('1. scoped title + projects line:', /Meeting email report — Partner data exchange/.test(T), /Projects covered: Partner data exchange/.test(T));
  console.log('2. only P2 efforts, nothing from other projects:', /AI-404/.test(T) && /AI-203/.test(T), !/AI-104|Intake portal|AI-302|Records retention/.test(T));
  console.log('3. efforts bundled formally:', /Owner: Sofia Alvarez\. Status: Open\. Timing: “end of October” → Oct 31/.test(T), /Reported complete \(Test transfer ran clean\)\./.test(T));
  console.log('4. omit-if-empty: no attendance -> no Participants/Duration, no flags -> no section 5:', !/Participants/.test(T), !/Duration/.test(T), !/Risks, dependencies/.test(T));
  console.log('5. conclusion names next step + register line:', /new actions? came out of this meeting/.test(T), /board has been updated with the accepted actions and task updates/.test(T));
  console.log('6. draft-fallback note shown:', /executive summary uses the generated draft/.test(T));
  d.querySelector('#close-hist').click();
  // ---- FULL BOARD WALK: Oct 1 via the selector ----
  const oct1opt=[...$('asof').options].find(o=>o.textContent.includes('Oct 1'));
  $('asof').value=oct1opt.value; $('asof').dispatchEvent(new w.Event('change')); await sleep(30);
  $('meeting-report').click(); await sleep(30);
  T=$('hist').textContent.replace(/\s+/g,' ');
  console.log('7. duration + 7 participants with emails:', /Duration: 34m 7s/.test(T), (T.match(/@example\.gov/g)||[]).length===7);
  console.log('8. four projects covered, project tag on effort rows:', /Projects covered: .*Intake portal redesign.*Partner data exchange.*Reporting dashboard migration.*Records retention cleanup/.test(T), /P2 · AI-403/.test(T));
  console.log('9. chronological: BL-102 leads the updated-items table:', (()=>{const tb=[...$('hist').querySelectorAll('.report-preview table')].find(x=>/BL-102/.test(x.textContent));return !!tb && tb.querySelectorAll('tr')[1].textContent.includes('BL-102');})());
  console.log('10. decisions + flags sections present:', /Decisions recorded this meeting/.test(T) && /D-302/.test(T) && /D-303/.test(T), /Risks, dependencies and open questions/.test(T) && /Overdue item \(AI-303 /.test(T));
  console.log('11. reassignment + unblock rendered:', /Reassigned from Raj Patel to Linh Nguyen\./.test(T), /Unblocked; work may proceed\./.test(T));
  // copies
  $('msum-copy-plain').click(); await sleep(20);
  console.log('12. plain copy: subject + markdown tables + omit rules:', /^Subject: Weekly board walk — Meeting Summary/.test(plain), /\| Name \| Email \|/.test(plain), /\| Effort \|/.test(plain));
  $('msum-copy-rich').click(); await sleep(20);
  console.log('13. rich copy carries text\/html part:', !!richParts && 'text/html' in richParts[0].items);
  d.querySelector('#close-hist').click();
  // ---- one path: no per-row button; baseline selection explains itself ----
  console.log('14. per-row button removed everywhere:', !d.querySelector('[data-msum]'));
  const baseopt=[...$('asof').options].find(o=>o.textContent.includes('Baseline'));
  $('asof').value=baseopt.value; $('asof').dispatchEvent(new w.Event('change')); await sleep(30);
  $('meeting-report').click(); await sleep(30);
  console.log('15. baseline selection -> plain toast, no dialog:', /register import, which has no transcript/.test($('toast').textContent) && /pick one in the selector/.test($('toast').textContent), !$('hist').open);
  console.log('16. dialogs cross-reference each other:', true); // asserted inline below
  $('asof').value=oct1opt.value; $('asof').dispatchEvent(new w.Event('change')); await sleep(30);
  $('meeting-report').click(); await sleep(30);
  const sub=$('hist').textContent;
  d.querySelector('#close-hist').click();
  $('email-report').click(); await sleep(30);
  console.log('16. dialogs cross-reference each other:', /Register-wide status is in the Program email report/.test(sub), /Participants appear in the Meeting email report/.test($('hist').textContent) && /Program email report —/.test($('hist').textContent));
})();
