// T-UX Phase 5: polish — color-for-action, hierarchy, one primary per action row, scannable dialogs, empty-state copy
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
const css=[...''].concat();
(async()=>{
  await sleep(300);
  const styles=[...d.querySelectorAll('style')].map(x=>x.textContent).join('');

  // 1) color reserved for actionable conditions
  console.log('1. default card top is neutral; attention/due keep color; decisions demoted:',
    /\.snap\{[^}]*border-top:3px solid var\(--line\)/.test(styles),
    /\.snap\.blockers\{border-top-color:var\(--block\)\}/.test(styles) && /\.snap\.due\{border-top-color:var\(--due\)\}/.test(styles),
    !/\.snap\.decisions\{border-top-color/.test(styles));

  // 2) hierarchy: codes read as identifiers, not prose
  console.log('2. .code is monospace + .sub readable at 13px:', /\.code\{font-family:ui-monospace/.test(styles), /\.sub\{font-size:13px/.test(styles));

  // 3) dialogs: internal scroll + sticky header
  console.log('3. dialogs scroll inside with a sticky header:', /\.dlg\{[^}]*max-height:82vh;overflow:auto\}/.test(styles), /\.dlg-top\{[^}]*position:sticky;top:0/.test(styles));
  console.log('   toast is 15px with a shadow:', /\.toast\{[^}]*font-size:15px/.test(styles) && /box-shadow/.test(styles.match(/\.toast\{[^}]*\}/)[0]));

  // exercise the app, then audit live DOM
  $('load-sample').click(); await sleep(300);
  d.querySelector('[data-tab="prepare"]').click();
  $('sample-transcript').click(); $('do-segment').click(); await sleep(200);
  $('sample-output').click(); $('do-validate').click(); await sleep(150);

  // 4) one primary per action row, across everything currently rendered
  const rows=[...d.querySelectorAll('.actions')];
  const bad=rows.filter(a=>a.querySelectorAll('.btn.primary').length>1);
  console.log('4. every action row has at most one primary:', rows.length>5 && bad.length===0);

  $('import-out').querySelector('[data-accept]').click(); await sleep(400);

  // 5) long-history dialog opens with the sticky-header structure
  const ent=d.querySelector('#panel .ent'); ent.click(); await sleep(100);
  const dlg=[...d.querySelectorAll('dialog')].find(x=>x.open);
  console.log('5. history dialog: .dlg wrapper + .dlg-top header present:', !!dlg && !!dlg.querySelector('.dlg') && !!dlg.querySelector('.dlg-top'));
  if (dlg) dlg.close();

  // 6) empty states say what the absence means (copy present in the build)
  console.log('6. empty-state copy upgraded:',
    html.includes('No open work \\u2014 everything recorded for this project is reported complete.'),
    html.includes('No projects yet \\u2014 load packages from the team folder, or seed the register under Workspace.'),
    html.includes('Nothing is reported blocked \\u2014 a claim about meetings, not an observation of the work.'));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
