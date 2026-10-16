// Probe: validate a reply in the Atlas world and dump every finding, row message and the repair prompt.
// Usage: node atlas_probe.js <MeetingGraph.html> <fixtures_dir> <reply.json>
const {JSDOM}=require('jsdom'); const fs=require('fs'); const path=require('path');
const {indexedDB}=require('fake-indexeddb');
const [,,HTML,FX,REPLY]=process.argv;
const html=fs.readFileSync(HTML,'utf8');
const WS=fs.readFileSync(path.join(FX,'mkg-workspace-atlas.json'),'utf8');
const TR=fs.readFileSync(path.join(FX,'mkg-transcript-atlas-2026-10-09.txt'),'utf8');
const RP=fs.readFileSync(REPLY,'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',beforeParse(w){
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  w.URL.createObjectURL=b=>{w.__lastBlob=b;return 'blob:x'}; w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  Object.defineProperty(w,'indexedDB',{value:indexedDB});
  Object.defineProperty(w.navigator,'storage',{value:{persist:async()=>true}});
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{},write:async()=>{}}});
  w.ClipboardItem=class{constructor(i){this.items=i}};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}; w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.confirm=()=>true; w.HTMLElement.prototype.scrollIntoView=function(){};
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  w.__ws=WS;
  const f=w.eval('new File([window.__ws], "mkg-workspace-atlas.json", {type:"application/json"})');
  Object.defineProperty($('file-in'),'files',{value:[f],configurable:true});
  $('file-in').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(400);
  d.querySelector('[data-tab="prepare"]').click();
  $('transcript').value=TR; $('transcript').dispatchEvent(new w.Event('paste',{bubbles:true})); await sleep(50);
  $('do-segment').click(); await sleep(250);
  const token=($('chat-text').value.match(/MKG1\|transcript\|[^|]+\|[0-9a-f]{8}/)||[])[0];
  $('llm-in').value=RP.replace('MKG1_TOKEN_PLACEHOLDER',token);
  $('do-validate').click(); await sleep(300);
  const out=$('import-out');
  console.log('BANNER:', out.querySelector('.banner').textContent.trim());
  console.log('CARDS:', JSON.stringify([...out.querySelectorAll('.card h3')].map(h=>h.textContent)));
  const card=[...out.querySelectorAll('.card')].find(x=>/Coverage review/.test(x.querySelector('h3').textContent));
  if (card) for (const li of card.querySelectorAll('ul.revlist > li')) { const m=li.querySelector('.msg'); console.log(' COV', m.classList.contains('warn')?'warn':'info', li.dataset.code||'-', '|', m.textContent.trim().slice(0,260)); }
  for (const m of out.querySelectorAll('.msg.warn,.msg.error')) if (!card || !card.contains(m)) console.log(' ROW', m.className, '|', m.textContent.trim().slice(0,260));
  const rt=$('repair-text'); console.log('REPAIR:', rt ? '\n'+rt.value : '(none)');
})().catch(e=>console.log('PROBE ERROR',e.message));
