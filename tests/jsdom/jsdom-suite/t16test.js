// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.
const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');
  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }
  return el; };
// T-UX Phase 3: Workspace tab (seed demoted to initial setup), workspace-state line, responsive nav CSS
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
  // 1) navigation: three working destinations + Workspace
  const tabs=[...d.querySelectorAll('.tab')].map(b=>b.textContent);
  console.log('1. nav is Board/Dashboard/Process meeting/Workspace:', JSON.stringify(tabs)===JSON.stringify(['Board','Dashboard','Process meeting','Workspace']));
  d.querySelector('[data-tab="seed"]').click();
  console.log('2. Workspace view: setup is a named one-time card:', /Workspace/.test(d.querySelector('#view-seed h2').textContent), [...d.querySelectorAll('#view-seed .card h3')].some(h=>/Initial setup — seed projects \(one-time\)/.test(h.textContent)));
  // seeding still works from its new home
  $('s-sample').click(); $('s-parse').click(); await sleep(100);
  console.log('3. seed check still functions:', $('s-out').textContent.length>0);

  // 2) workspace-state line: doctrine on screen, live on Board and Process meeting
  d.querySelector('[data-tab="board"]').click(); await sleep(30);
  console.log('4. empty mirror stated on Board:', /No packages in this browser/.test($('ws-state-board').textContent), /the team folder is the record/.test($('ws-state-board').textContent));
  $('load-sample').click(); await sleep(300);
  console.log('5. count updates after load:', /1 package mirrored in this browser/.test($('ws-state-board').textContent));
  d.querySelector('[data-tab="prepare"]').click(); await sleep(30);
  console.log('6. same line on Process meeting:', /1 package mirrored/.test($('ws-state-prep').textContent));
  // accept an import -> count 2 and a download timestamp appears
  $('sample-transcript').click(); $('do-segment').click(); await sleep(200);
  $('sample-output').click(); $('do-validate').click(); await sleep(150);
  (await UXA($('import-out'))).querySelector('[data-accept]').click(); await sleep(400);
  d.querySelector('[data-tab="board"]').click(); await sleep(30);
  const t=$('ws-state-board').textContent;
  console.log('7. after accept: 2 packages + last download named:', /2 packages mirrored/.test(t), /last file downloaded/.test(t) && /mkg-meeting-2026-10-01\.json/.test(t));
  $('clear-ws').click(); await sleep(100);
  console.log('8. clear -> empty mirror again:', /No packages in this browser/.test($('ws-state-board').textContent));

  // 3) responsive nav rules present (jsdom does no layout; assert the stylesheet)
  const css=[...d.querySelectorAll('style')].map(x=>x.textContent).join('');
  console.log('9. 480px media block wraps tabs + frees tools row:', /@media \(max-width:480px\)/.test(css), /\.tabs\{flex-wrap:wrap/.test(css), /\.tools\{margin-left:0;width:100%\}/.test(css));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
