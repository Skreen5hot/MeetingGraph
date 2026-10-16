// Builds mkg-workspace-atlas.json: the Project Atlas baseline register as one
// digest-clean manual package through the real compile/buildPackage pipeline.
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
const w=dom.window,sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(300);
  const out = await w.eval(`(async () => {
    const rows = [
      ["R01","Finalize participant travel roster", null, "open"],
      ["R02","Protect participant travel information", null, "open"],
      ["R03","Create restricted travel roster workbook", "NEW-P1", "in_progress"],
      ["R04","Identify technical support traveler", "NEW-P6", "open"],
      ["R05","Coordinate site access with host liaison", "NEW-P1", "open"],
      ["R06","Send host-site point-of-contact details", null, "open"],
      ["R07","Evaluate alternate equipment configuration", "NEW-P1", "in_progress"],
      ["R08","Assess equipment integration options", null, "open"],
      ["R09","Update recurring coordination meeting invitations", "NEW-P1", "in_progress"],
      ["R10","Identify future exercise scenario", null, "open"]
    ];
    const meeting = { date:"2026-09-15", meetingAt:"2026-09-15T08:00:00-04:00", offset:"-04:00",
      title:"Atlas baseline register import", kind:"manual", forceExt:true,
      segments: rows.map(r => ({ id:r[0], t:null, speakerName:"Project register", speakerId:null, text:r[1] + " \\u2014 " + (r[3] === "in_progress" ? "in progress" : "open") + (r[2] ? "" : ", no owner") })) };
    const parties = [
      ["NEW-P1","person","Morgan Reyes"],["NEW-P2","person","Taylor Brooks"],["NEW-P3","person","Casey Lin"],
      ["NEW-P4","person","Riley Novak"],["NEW-P5","person","Alex Kim"],["NEW-P6","organization","Vendor Team"]
    ];
    const llm = { ops: [
      { op:"NewProject", ref:"NEW-J1", name:"Atlas Field Exercise", description:"Synthetic validation project for meeting-extraction, task-provenance, timing and report testing.", src:[{seg:"R01"}] },
      ...parties.map(p => ({ op:"NewParty", ref:p[0], kind:p[1], name:p[2], src:[{seg:"R01"}] })),
      ...rows.map((r, i) => ({ op:"NewTasking", ref:"NEW-" + (i + 1), project:"NEW-J1", label:r[1],
        assignee:r[2] || undefined, status:r[3] === "in_progress" ? "in_progress" : undefined, src:[r[0]] }))
    ] };
    const comp = compile(llm, meeting, []);
    const errs = comp.global.filter(m => m.lvl === "error").map(m => m.text)
      .concat(comp.rows.flatMap(r => r.msgs.filter(m => m.lvl === "error").map(m => r.type + ": " + m.text)));
    if (errs.length) return { error: errs };
    const pkg = await buildPackage(comp, meeting);
    pkg.fileName = "mkg-atlas-baseline-2026-09-15.json";
    const v = await verifyPackage(pkg);
    const S = foldPackages([pkg]);
    return {
      ws: JSON.stringify({ mkgWorkspace:"0.1", tool:WB_VERSION, contract:MANIFEST, packages:[pkg] }, null, 1),
      verify: v,
      parties: Object.keys(S.parties),
      taskings: Object.values(S.taskings).map(t => t.code + " | " + t.label + " | " + (t.status || "open") + " | " + (t.assignee || "-")),
      project: Object.keys(S.projects)
    };
  })()`);
  if (out.error) { console.log('BUILD ERRORS:', out.error); return; }
  fs.writeFileSync('/mnt/user-data/outputs/mkg-workspace-atlas.json', out.ws);
  console.log('verify:', JSON.stringify(out.verify));
  console.log('project:', out.project.join(','));
  console.log('parties:', out.parties.join(', '));
  out.taskings.forEach(t=>console.log('  ', t));
})().catch(e=>{console.log('ERROR',e.message,e.stack);});
