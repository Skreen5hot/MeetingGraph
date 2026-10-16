  /* ---------------- D-UX12 Phase 2: settling labels on the board (plan §16, §16.9; ratified 2026-10-13) ----------------
     Each labeled item offers the actions for its kind. Actions collect in a pending tray; nothing reaches the board
     until Save, which compiles the board changes through the same validator as any import and writes one
     board-resolutions package (an out-of-meeting update without a chat round) to the team folder. */
  var resPending = [];
  var RES_NAME = "mkg.resolverName";
  // §16.16 (ratified for build 2026-10-14): open items are answered in meetings. The board shows them read-only:
  // the question, what is needed, and the evidence. The §16.2-§16.15 actions stay in the code, switched off, so a
  // narrow fallback can be turned back on (MKG_setBoardActions) if real use shows a need.
  var RES_ACTIONS = false;
  // §16.17 (ratified 2026-10-14): the one board action kept with §16.16 is "Not needed", one at a time or several
  // selected at once with one reason, and Reopen for a dismissed item. Saved through the tray as before.
  var RES_DISMISS = true, oiSel = new Set();
  window.MKG_setBoardActions = on => { RES_ACTIONS = !!on; if (state.packages.length) renderBoard(); };
  // A closure confirmed in an import review is a record like a board decision: it settles the item (and replaces
  // any earlier decision on it), with the meeting's words as its basis.
  function oiRecords(pkgs) {
    return pkgs.flatMap(p => (p.answers || []).filter(a => a.closed).map(a => ({ id:`${p.meeting.id}-A:${a.item}`, at:a.confirmedAt, by:a.confirmedBy,
      label:{ key:a.item, name:"Open item", target:a.target }, outcome:"settle", supersedes:a.supersedes || [], choice:"Answered in a meeting",
      decision:`Answered in ${p.meeting.title}, ${fmtDate(p.meeting.meetingAt)}: ${a.answer}`, note:a.answer,
      meetingAnswer:{ id:p.meeting.id, title:p.meeting.title, meetingAt:p.meeting.meetingAt, seg:a.seg, quote:a.quote, speaker:a.speaker || "", question:a.question || "" } })));
  }
  const resAll = () => [...state.packages.flatMap(p => p.resolutions || []), ...oiRecords(state.packages)];
  const fmtAt = iso => { try { const d = new Date(iso); return `${fmtDate(localDate(iso))} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`; } catch (e) { return String(iso || ""); } };
  const resWho = r => `${esc(r.by)}, ${esc(fmtAt(r.at))}`;
  function resParts(r) {
    const b = r.label || {};
    if (r.meetingAnswer) { const m = r.meetingAnswer;
      return `<div class="res-parts oi-answered"><div><span class="res-k">Answered in</span> ${esc(m.title)}, ${esc(fmtDate(m.meetingAt))}</div>
      ${m.question ? `<div><span class="res-k">Question</span> ${esc(m.question)}</div>` : ""}<div><span class="res-k">Answer</span> ${esc(r.note)}</div>
      <blockquote class="lbl-q">\u201c${esc(m.quote)}\u201d<div class="sub">${esc(m.speaker)}${m.seg ? ` (${esc(m.seg)})` : ""}</div></blockquote>
      <div><span class="res-k">Closure confirmed by</span> ${resWho(r)}</div></div>`; }
    return `<div class="res-parts"><div><span class="res-k">Reviewer decision</span> ${esc(r.decision || r.choice)}</div>
      <div><span class="res-k">Meeting basis</span> <span class="sub">${esc(b.meetingTitle || "")}${b.meetingDate ? `, ${esc(fmtDate(b.meetingDate))}` : ""}</span>${(b.quotes && b.quotes.length ? b.quotes : b.quote ? [{ seg:b.seg, text:b.quote }] : []).map(q => `<blockquote class="lbl-q">\u201c${esc(q.text)}\u201d<div class="sub">${esc(q.speaker || "")}${q.seg ? ` (${esc(q.seg)})` : ""}</div></blockquote>`).join("")}</div>
      <div><span class="res-k">Resolved by</span> ${resWho(r)}</div>
      <div><span class="res-k">Resolution note</span> ${esc(r.note)}</div></div>`;
  }
  function resLine(r) { return `<div class="res-line"><b>${esc(r.choice)}</b> by ${resWho(r)}: “${esc(r.note)}”</div>`; }
  function oiQuestionHtml(it) {
    const q = OI.questionFor(it, { fmtDate });
    // Aaron (2026-10-14): what the item is about, next to the question; a task opens on click.
    const S = state.lastFoldTmp || state.lastFold, pn = c => esc((S && S.projects[c] || {}).name || c);
    const assoc = it.tasks.length ? it.tasks.map(t => entBtn(S, t.iri)).join(" ")
      : it.project ? `${pn(it.project)} <span class="sub">(the project; the meeting named no task)</span>`
      : it.person || it.people ? "People" : `<span class="sub">No project or task named (${esc(it.meeting.title)}, ${esc(fmtDate(it.meeting.meetingAt))})</span>`;
    let h = `<div class="oi-q"><div><span class="res-k">Question</span> ${esc(q.question)}</div><div class="sub"><span class="res-k">Needed</span> ${esc(q.needed.replace("the person in PEOPLE they are", "the person on the board they are"))}</div><div class="oi-assoc"><span class="res-k">Associated with</span> ${assoc}</div></div>`;
    if (it.placedBy && it.placedBy.action === "reopen") h += `<div class="res-state">Reopened by ${resWho(it.placedBy)}: “${esc(String(it.placedBy.note).replace(/^Reopens [^:]*:\s*/, ""))}”</div>`;
    for (const pa of it.proposed || [])
      h += `<div class="res-state oi-proposed">${pa.status === "partial" ? "Partly answered" : "Answered, not confirmed in the review"} in ${esc(pa.title)}, ${esc(fmtDate(pa.meetingAt))}: <b>${esc(pa.answer)}</b>
        <blockquote class="lbl-q">\u201c${esc(pa.quote)}\u201d<div class="sub">${esc(pa.speaker || "")}${pa.seg ? ` (${esc(pa.seg)})` : ""}</div></blockquote><div class="sub">Still open: a later meeting can answer it.</div></div>`;
    return h;
  }
  function resBox(it) {
    const p = resPending.find(a => a.label.key === it.key);
    let h = RES_ACTIONS ? "" : oiQuestionHtml(it);
    if (it.status === "deferred" && it.res) h += `<div class="res-state">Later (${resWho(it.res.current)}): “${esc(it.res.current.note)}”</div>`;
    if (it.status === "conflict" && it.res) h += `<div class="res-state res-conflict"><b>Conflicting resolutions.</b> Two people settled this differently and neither replaced the other.${it.res.heads.map(resLine).join("")}<div class="sub">A new decision below replaces both and names them.</div></div>`;
    if (it.placedBy) { const cur = it.placedBy, ans = cur.value && cur.value.answer;
      h += ans ? `<div class="res-state res-answer">Current answer (not confirmed yet): <b>${esc(ans)}</b>. ${resWho(cur)}: “${esc(cur.note)}”</div>`
        : RES.stepsOf(cur).some(x => x.type === "attach") ? `<div class="res-state">Linked here by ${resWho(cur)}: “${esc(cur.note)}”</div>`
        : `<div class="res-state">Still open after ${esc(cur.choice)} (${resWho(cur)}): “${esc(cur.note)}”</div>`; }
    if (it.hint) h += `<div class="res-state">A similar item was resolved on ${esc(fmtAt(it.hint.at))} by ${esc(it.hint.by)}: ${esc(it.hint.choice)}. “${esc(it.hint.note)}”</div>`;
    if (!RES_ACTIONS) {
      const K = esc(it.key);
      if (p) h += `<div class="res-pending">Not saved yet: <b>${esc(p.choice)}</b>. “${esc(p.note)}” <button class="btn" data-res-undo="${K}">Undo</button></div>`;
      else if (RES_DISMISS && it.status !== "resolved")
        h += `<div class="res-acts oi-acts"><label class="chk oi-sel"><input type="checkbox" data-oi-sel="${K}"${oiSel.has(it.key) ? " checked" : ""}> Select</label><button class="btn res-btn" data-res-act="not_needed" data-res-key="${K}">Not needed</button></div><div class="res-form"></div>`;
      return `<div class="res-box oi-box" data-res-item="${K}">${h}</div>`;
    }
    if (p) h += `<div class="res-pending">Not saved yet: <b>${esc(p.choice)}</b>${p.summary ? ` (${esc(p.summary)})` : ""}. “${esc(p.note)}” <button class="btn" data-res-undo="${esc(it.key)}">Undo</button></div>`;
    else { const P = RES.primaryFor(it.kind, it.topic), more = RES.moreFor(it.kind, it.topic), K = esc(it.key);
      h += `<div class="res-acts"><button class="btn primary res-btn" data-res-act="${P}" data-res-key="${K}">${esc(RES.actionLabel(P, it.kind, it.topic))}</button>`
        + `<button class="btn res-btn" data-res-act="defer" data-res-key="${K}">Later</button>`
        + (more.length ? `<details class="res-more"><summary class="btn res-btn">More ▾</summary><div class="res-more-list">${more.map(a => `<button class="btn res-btn" data-res-act="${a}" data-res-key="${K}">${esc(RES.actionLabel(a, it.kind, it.topic))}</button>`).join("")}</div></details>` : "")
        + `</div><div class="res-form"></div>`; }
    return `<div class="res-box" data-res-item="${esc(it.key)}">${h}</div>`;
  }

  // §16.13: an attendee is matched by email first (Aaron, 2026-10-13), then by the report's name forms; a first name
  // alone never matches an attendee.
  const dispName = n => { const f = nameForms(n); return f[f.length - 1]; };
  function attendeeParty(S, a) {
    const e = String(a.email || "").trim().toLowerCase();
    if (e) { const hit = Object.values(S.parties).find(p => (p.emails || []).includes(e)); if (hit) return hit.id; }
    const forms = nameForms(a.name).map(x => x.toLowerCase());
    for (const p of Object.values(S.parties)) if ([p.name, ...(p.aliases || [])].some(x => forms.includes(String(x).toLowerCase()))) return p.id;
    const fl = x => { const t = x.split(/\s+/).filter(Boolean); return t.length >= 2 ? t[0] + " " + t[t.length - 1] : null; };
    for (const n of forms) { const k = fl(n); if (!k) continue;
      const hits = Object.values(S.parties).filter(p => p.kind === "person" && fl(String(p.name).toLowerCase()) === k); if (hits.length === 1) return hits[0].id; }
    return null;
  }
  // The items: one per label and target (a label naming several tasks is settled per task, §16.1).
  function resItems(S, cur) {
    const byCode = {}; Object.values(S.taskings).forEach(t => { if (!t.mergedInto) byCode[t.code] = t; });
    const upTo = toMs(cur.meeting.meetingAt), items = [];
    const pk = state.packages.filter(p => toMs(p.meeting.meetingAt) <= upTo && p.meeting.id !== cur.excludeId);
    for (const p of pk) {
      let newOps = null;
      // §16.4: a NEW-reference an older package left unmapped is matched to the meeting's own new task citing the same statement.
      const newBySeg = segs => { newOps = newOps || packageOps(p).filter(o => o.type === "NewTasking");
        for (const sg of segs) { const hits = [...new Set(newOps.filter(o => o.src.includes(sg)).map(o => o.f.code))]; if (hits.length === 1) return hits[0]; }
        return null; };
      const pkgProjects = [...new Set((p.deltas || []).map(d => d.project).filter(Boolean))];
      const repeats = new Set(OI.dupFlags({ flags:p.flags || [] }, (p.answers || []).map(a => ({ ...a })), null).map(x => x.index));
      for (const [fi, f] of (p.flags || []).entries()) {
        if (repeats.has(fi)) continue;   // §16.16 rule 6: the open item already tracks this question
        const segs = f.segs || (f.seg ? [f.seg] : []);
        const about = String(f.about || "").split(",").map(x => x.trim()).filter(Boolean).map(a => byCode[a] || S.projects[a] || !/^NEW-/.test(a) ? a : (newBySeg(segs) || a));
        const src = segs.map(id => (p.sources || []).find(x => x.id === id)).filter(Boolean);
        const base = { kind:f.kind, name:BOARD_FLAG[f.kind] || f.kind, note:String(f.note || "").replace(/^[^:]{2,40}: /, "").replace(/\b(?:the )?INDEX\b/g, "the board"),
          rawNote:f.note || "", src, segs, meeting:p.meeting, meetingId:p.meeting.id };
        const tasks = about.filter(a => byCode[a] && byCode[a].status !== "completed").map(a => byCode[a]);
        const project = tasks.length ? null : about.find(a => S.projects[a]) || (!about.length && f.kind !== "meeting_admin" && pkgProjects.length === 1 ? pkgProjects[0] : null);
        const targets = tasks.length ? tasks.map(t => ({ tasks:[t], project:t.project, target:t.code })) : [{ tasks:[], project, target:project || "meeting" }];
        for (const tg of targets) {
          const it = { ...base, ...tg, quote:src.length ? src[0].text : base.note };
          it.key = RES.keyOf(p.meeting.id, segs, f.kind, tg.target, it.quote);
          items.push(it);
        }
      }
    }
    // A person added from a partial reference stays to verify until someone verifies them (A4).
    for (const party of Object.values(S.parties)) {
      const ra = party.reviewerAdded; if (!ra) continue;
      const key = `person|${party.id}|person_unverified|${party.id}`;
      const has = resAll().some(r => r.label && r.label.key === key);
      if (!ra.unverified && !has) continue;
      items.push({ kind:"person_unverified", name:"Person to verify", key, target:party.id, project:null, tasks:[], segs:[], src:[], meetingId:"person", person:party.id,
        meeting:{ id:"person", title:"Board resolutions", meetingAt:ra.at }, quote:"",
        note:`${party.name}${party.org ? ` (${party.org})` : ""} was added by ${ra.by} on ${fmtDate(localDate(ra.at))}${ra.alias ? ` for the meeting’s “${ra.alias}”` : ""}. Not yet verified.` });
    }
    const att = {}, recKeys = new Set(resAll().map(r => r.label && r.label.key));
    for (const p of pk) for (const a of ((p.attendance || {}).participants || [])) {
      const key = RES.attendeeKey(a), known = attendeeParty(S, a);
      if (known && !recKeys.has(key)) continue;
      const e = att[key] = att[key] || { a, meetings:[] };
      e.meetings.push({ title:p.meeting.title, at:p.meeting.meetingAt, duration:a.duration || "" });
    }
    for (const [key, e] of Object.entries(att)) {
      const nm = dispName(e.a.name), last = e.meetings[e.meetings.length - 1];
      items.push({ kind:"attendee_unmatched", name:"Person to add", key, target:key.split("|")[1], project:null, tasks:[], segs:[], src:[], meetingId:"attendee", people:true,
        attendee:{ name:e.a.name, display:nm, email:e.a.email || "", role:e.a.role || "" }, attended:e.meetings,
        meeting:{ id:"attendee", title:last.title, meetingAt:last.at, kind:"attendance" }, quote:"",
        note:`${nm}${e.a.email ? ` (${e.a.email})` : ""} attended ${e.meetings.length} meeting${e.meetings.length === 1 ? "" : "s"} and is not on the board.` });
    }
    // Preparing a request (cur.excludeId): the items raised before that meeting, in their state NOW. A dismissal or a
    // closure saved after the meeting date still keeps the item out of the request (§16.17).
    const pkState = cur.excludeId ? state.packages.filter(p => p.meeting.id !== cur.excludeId) : pk;
    RES.attach(items, [...pkState.flatMap(p => p.resolutions || []), ...oiRecords(pkState)]);
    const prop = {};
    for (const p of pkState) for (const a of p.answers || []) if (!a.closed) (prop[a.item] = prop[a.item] || []).push({ ...a, title:p.meeting.title, meetingAt:p.meeting.meetingAt });
    for (const it of items) {
      it.proposed = prop[it.key] || [];
      it.origin = { title:it.meeting.title, date:it.meeting.meetingAt, transcript:it.meeting.kind === "transcript" };
      if (it.status === "placed") { const v = RES.stepsOf(it.res.current).find(x => x.type === "attach") || {}, t = v.task && byCode[v.task];
        it.placedBy = it.res.current;
        if (t) { it.tasks = [t]; it.project = t.project; } else if (v.project && S.projects[v.project]) { it.tasks = []; it.project = v.project; } }
      if (it.kind === "ambiguous_reference") it.refName = RES.refName(it.rawNote || it.note);
      if (it.kind === "ambiguous_reference" || it.kind === "unmatched") {
        const projNames = Object.values(S.projects).map(p => String(p.name).toLowerCase());
        const cands = [...new Set([it.refName, ...RES.namesIn(it.rawNote || it.note)].filter(Boolean))].filter(n => !projNames.some(pn => pn.includes(n.toLowerCase())));
        const off = cands.find(n => n.includes(" ") && !findParty(S, n)) || (it.refName && !findParty(S, it.refName) ? it.refName : "");
        it.topic = { person:off, known:cands.map(n => findParty(S, n)).find(Boolean) || null };
        // §16.13: a first name in a meeting where someone of that first name attended.
        if (it.refName && !it.refName.includes(" ")) {
          const mp = state.packages.find(x => x.meeting.id === it.meetingId);
          const hit = ((mp && mp.attendance && mp.attendance.participants) || []).find(a => dispName(a.name).split(/\s+/)[0].toLowerCase() === it.refName.toLowerCase());
          if (hit) { it.topic.attendee = { name:hit.name, display:dispName(hit.name), email:hit.email || "" };
            const kp = attendeeParty(S, hit); if (kp) { it.topic.known = kp; it.topic.person = ""; } else it.topic.person = dispName(hit.name); }
        }
      } else if (it.kind === "attendee_unmatched") it.topic = { person:it.attendee.display, known:null, attendee:it.attendee };
      else it.topic = {};
    }
    return items;
  }

  // Phase 1's labels, now with their resolution state. Open views hold open, deferred and conflicting items.
  function boardLabels(S, cur) {
    const out = { byTask:{}, byProject:{}, meeting:[], all:[], resolved:[], byKey:{}, decisionsByTask:{} };
    for (const it of resItems(S, cur)) {
      out.byKey[it.key] = it;
      if (it.status === "resolved") {
        out.resolved.push(it);
        const r = it.res.current;
        if (r && r.change) RES.stepsOf(r).forEach(st => { const c = st.code || (st.type !== "attach" && st.task && !/^@/.test(st.task) ? st.task : null);
          if (c && !(out.decisionsByTask[c] || []).includes(r)) (out.decisionsByTask[c] = out.decisionsByTask[c] || []).push(r); });
        continue;
      }
      if (it.tasks.length) it.tasks.forEach(t => (out.byTask[t.code] = out.byTask[t.code] || []).push(it));
      else if (it.project) (out.byProject[it.project] = out.byProject[it.project] || []).push(it);
      else out.meeting.push(it);
      out.all.push(it);
    }
    return out;
  }
  // Where the item sits, and where it came from when it names no project or task.
  function resWhere(S, it) {
    if (it.person || it.people) return "People";
    const from = it.origin ? `${it.origin.transcript ? "Meeting: " : ""}${it.origin.title}, ${fmtDate(it.origin.date)}` : "Meeting";
    const placed = it.placedBy && RES.stepsOf(it.placedBy).some(x => x.type === "attach") ? ` (linked by ${it.placedBy.by})` : "";
    if (it.project) return `${(S.projects[it.project] || {}).name || it.project}${placed}`;
    return `${from} \u2014 no project or task named`;
  }
  function lblName(it) {
    if (it.kind === "attendee_unmatched") return `<div class="res-name">Attended: ${it.attended.map(m => `${esc(m.title)}, ${esc(fmtDate(m.at))}${m.duration ? ` (${esc(m.duration)})` : ""}`).join("; ")}</div>`;
    if (it.kind !== "ambiguous_reference" && it.kind !== "unmatched") return "";
    const P = (state.lastFold || { parties:{} }).parties, known = it.topic && it.topic.known && P[it.topic.known];
    if (it.kind === "ambiguous_reference" && it.refName) return `<div class="res-name">Unclear name: <b>${esc(it.refName)}</b>${it.topic.attendee ? ` — possibly <b>${esc(it.topic.attendee.display)}</b> (attended this meeting${known ? ", on the board" : ""})` : known && known.name !== it.refName ? ` (possibly ${esc(known.name)}, who is on the board)` : ""}</div>`;
    if (it.topic && it.topic.person) return `<div class="res-name">Not on the board: <b>${esc(it.topic.person)}</b></div>`;
    if (known) return `<div class="res-name">Names <b>${esc(known.name)}</b>, who is on the board.</div>`;
    return it.kind === "ambiguous_reference" ? `<div class="res-name">This label doesn’t name the unclear person. Read the statements below; if it is really about something else, attach it where it belongs or resolve it with a note.</div>` : "";
  }
  function lblEvidence(it) {
    const from = `${esc(it.meeting.title)}, ${fmtDate(it.meeting.meetingAt)}`;
    return it.src.length ? `<details class="lbl-ev"><summary>Meeting evidence: ${from} (${it.src.length} statement${it.src.length === 1 ? "" : "s"})</summary>${lblSrc(it)}</details>` : `<div class="sub">${from}</div>`;
  }
  function lblSrc(it) {
    return `${it.src.length ? it.src.map(x => `<blockquote class="lbl-q">“${esc(x.text)}”<div class="sub">${esc(x.speakerName || "")}${x.t ? `, ${esc(x.t)}` : ""}</div></blockquote>`).join("") : ""}<div class="sub">${esc(it.meeting.title)}, ${fmtDate(it.meeting.meetingAt)}</div>`;
  }
  const lblMark = it => it.status === "deferred" ? " (later)" : it.status === "conflict" ? " (conflicting resolutions)" : "";
  // §16.16: when the question is the chat's note itself, the note is not repeated above it.
  const lblNoteShown = it => RES_ACTIONS || !String(OI.questionFor(it, { fmtDate }).question).includes(String(it.note || "").trim());
  function lblChip(it) { return `<details class="lbl"><summary class="lbl-chip k-${esc(it.kind)}${it.status !== "open" ? ` st-${it.status}` : ""}">${esc(it.name)}${lblMark(it)}</summary><div class="lbl-body">${lblNoteShown(it) ? `<p>${esc(it.note)}</p>` : ""}${lblName(it)}${resBox(it)}${lblEvidence(it)}</div></details>`; }
  function lblRow(it, withTask) {
    return `<li class="lbl-row"><span class="lbl-name">${esc(it.name)}${lblMark(it)}</span>${withTask && RES_ACTIONS && it.tasks.length ? ` ${it.tasks.map(t => entBtn(state.lastFoldTmp, t.iri)).join(" ")}` : ""}${lblNoteShown(it) ? `<div class="lbl-q-text">${esc(it.note)}</div>` : ""}${lblName(it)}${resBox(it)}${lblEvidence(it)}</li>`;
  }
  function decisionChip(r) { return `<details class="lbl"><summary class="lbl-chip res-chip">Reviewer decision</summary><div class="lbl-body">${resParts(r)}</div></details>`; }
  function renderAttention(S, LB) {
    state.lastFoldTmp = S;
    const view = state.attnView === "resolved" ? "resolved" : "open";
    const where = it => esc(resWhere(S, it));
    const groups = {}; LB.all.forEach(it => (groups[it.name] = groups[it.name] || []).push(it));
    const openHtml = LB.all.length ? Object.entries(groups).map(([n, its]) => `<section class="snap"><h3>${esc(n)} <span class="n">${its.length}</span></h3><ul class="lbl-list">${its.map(it => lblRow(it, true).replace('<li class="lbl-row">', `<li class="lbl-row"><span class="sub">${where(it)}</span> `)).join("")}</ul></section>`).join("")
      : `<p class="empty">Nothing needs attention. Every open item is settled.</p>`;
    const resHtml = LB.resolved.length ? `<ul class="lbl-list">${LB.resolved.slice().sort((a, b) => String(b.res.current.at).localeCompare(String(a.res.current.at))).map(it => `<li class="lbl-row res-done"><span class="sub">${where(it)}</span> <span class="lbl-name">${esc(it.name)}</span>${it.tasks.length ? ` ${it.tasks.map(t => entBtn(S, t.iri)).join(" ")}` : ""}
        <div>${esc(it.note)}</div>${resParts(it.res.current)}
        ${it.res.all.length > 1 ? `<details class="lbl-src"><summary>Earlier decisions (${it.res.all.length - 1})</summary>${it.res.all.filter(r => r !== it.res.current).map(r => `${resLine(r)}<div class="sub">Superseded.</div>`).join("")}</details>` : ""}
        ${RES_ACTIONS ? `<details class="lbl-src res-change"><summary>Change this decision</summary>${resBox(it)}</details>` : oiReopenHtml(it)}</li>`).join("")}</ul>`
      : `<p class="empty">Nothing has been resolved yet.</p>`;
    $("panel").innerHTML = `<div class="panel-inner"><button class="back" id="back">All projects</button>
      <h2 class="title">Needs attention</h2><p class="desc">${!RES_ACTIONS && RES_DISMISS ? "The open questions the meetings left, each with what is needed to answer it. They go to the chat with the next meeting's transcript; when a meeting answers one, the import review proposes closing it. An item that doesn't matter can be marked Not needed, with a reason, and reopened later." : RES_ACTIONS ? "Everything the meetings left uncertain, with the words it came from. Settle an item with one of its actions, then Save: the decision is recorded in your name, with your note, next to the meeting's words." : "The open questions the meetings left, each with what is needed to answer it. They go to the chat with the next meeting's transcript; when a meeting answers one, the import review proposes closing it, and the reviewer confirms."}</p>
      ${view === "open" && LB.all.length ? `<div class="actions"><button class="btn" data-oi-agenda="">Copy open items as an agenda</button>${oiBulkHtml()}</div><div class="oi-bulk-form"></div>` : ""}
      <div class="res-tabs" role="tablist"><button class="btn${view === "open" ? " on" : ""}" data-attn-view="open" aria-selected="${view === "open"}">Open (${LB.all.length})</button><button class="btn${view === "resolved" ? " on" : ""}" data-attn-view="resolved" aria-selected="${view === "resolved"}">Resolved (${LB.resolved.length})</button></div>
      ${view === "open" ? openHtml : resHtml}</div>`;
  }
  // §16.17: dismiss several at once, and reopen.
  function oiBulkHtml() {
    if (RES_ACTIONS || !RES_DISMISS) return "";
    return ` <button class="btn" data-oi-dismiss-sel${oiSel.size ? "" : " disabled"}>Dismiss selected (${oiSel.size})</button>`;
  }
  function oiBulkSync() {
    document.querySelectorAll("[data-oi-dismiss-sel]").forEach(b => { b.textContent = `Dismiss selected (${oiSel.size})`; b.disabled = !oiSel.size; });
  }
  function oiReopenHtml(it) {
    const r = it.res && it.res.current;
    if (!RES_DISMISS || !r || r.action !== "not_needed") return "";
    const p = resPending.find(a => a.label.key === it.key);
    if (p) return `<div class="res-pending">Not saved yet: <b>${esc(p.choice)}</b>. “${esc(p.note)}” <button class="btn" data-res-undo="${esc(it.key)}">Undo</button></div>`;
    return `<div class="res-box oi-box" data-res-item="${esc(it.key)}"><div class="res-acts"><button class="btn res-btn" data-oi-reopen="${esc(it.key)}">Reopen</button></div><div class="res-form"></div></div>`;
  }
  function oiReasonForm(kind, n) {
    return `<div class="res-f oi-f" data-oi-form="${kind}"><div class="res-what">${kind === "bulk" ? `Not needed: ${n} item${n === 1 ? "" : "s"}. Each is recorded in your name with this reason, leaves the open items and is no longer sent to the chat. It can be reopened.` : "Reopen. The item returns to the open items and is sent to the chat again. The dismissal stays in the history."}</div>
      <label>Reason (required) <textarea data-f="note" rows="2"></textarea></label><div class="res-err" role="alert"></div>
      <div class="actions"><button class="btn primary" data-oi-add="${kind}">Add to changes</button><button class="btn" data-oi-cancel>Cancel</button></div></div>`;
  }
  document.addEventListener("change", ev => {
    const t = ev.target; if (!t || !t.dataset || t.dataset.oiSel == null) return;
    if (t.checked) oiSel.add(t.dataset.oiSel); else oiSel.delete(t.dataset.oiSel);
    document.querySelectorAll("[data-oi-sel]").forEach(x => { if (x.dataset.oiSel === t.dataset.oiSel) x.checked = t.checked; });
    oiBulkSync();
  });
  document.addEventListener("click", ev => {
    const t = ev.target; if (!t || !t.closest) return;
    const bs = t.closest("[data-oi-dismiss-sel]");
    if (bs) { const host = bs.closest(".actions, h3"), f = (host && host.parentNode.querySelector(".oi-bulk-form")) || document.querySelector(".oi-bulk-form");
      if (f) { f.innerHTML = oiReasonForm("bulk", oiSel.size); const ta = f.querySelector("textarea"); if (ta) ta.focus(); } return; }
    const ro = t.closest("[data-oi-reopen]");
    if (ro) { const fm = ro.closest(".res-box").querySelector(".res-form"); fm.innerHTML = oiReasonForm("reopen"); fm.querySelector("textarea").focus(); return; }
    if (t.closest("[data-oi-cancel]")) { const f = t.closest(".oi-f"); if (f) f.parentNode.innerHTML = ""; return; }
    const add = t.closest("[data-oi-add]");
    if (!add) return;
    const fbox = add.closest(".oi-f"), err = m => { fbox.querySelector(".res-err").textContent = m; };
    const reason = String(fbox.querySelector("textarea").value || "").trim();
    if (reason.length < 3) return err("Give a short reason.");
    const LB = state.boardLabels;
    if (add.dataset.oiAdd === "bulk") {
      const its = [...oiSel].map(k => LB && LB.byKey[k]).filter(Boolean);
      if (!its.length) return err("Select the items first.");
      const cf = its.find(it => it.status === "conflict");
      if (cf) return err(`${cf.name} (${cf.target}) has conflicting decisions. Untick it and settle it on its own.`);
      for (const it of its) {
        const heads = it.res ? it.res.heads.map(r => r.id) : [];
        resPending = resPending.filter(x => x.label.key !== it.key).concat([{ label:resLabelOf(it), note:reason, supersedes:heads, seen:heads,
          action:"not_needed", choice:RES.actionLabel("not_needed", it.kind, it.topic), value:{}, summary:"" }]);
      }
      oiSel.clear(); resRefresh(); return;
    }
    const it = LB && LB.byKey[add.closest(".res-box").dataset.resItem]; if (!it || !it.res) return;
    const heads = it.res.heads;
    const note = `Reopens ${heads.map(r => `${r.by}'s dismissal of ${fmtDate(localDate(r.at))}`).join(" and ")}: ${reason}`;
    resPending = resPending.filter(x => x.label.key !== it.key).concat([{ label:resLabelOf(it), note, supersedes:heads.map(r => r.id), seen:heads.map(r => r.id),
      action:"reopen", outcome:"open", choice:"Reopen", value:{}, summary:"" }]);
    resRefresh();
  });
  window.MKG_setDismiss = on => { RES_DISMISS = !!on; if (state.packages.length) renderBoard(); };
  // §16.16: the open items as an agenda for the next meeting, read aloud question by question.
  function oiAgenda(S, LB, project) {
    const its = LB.all.filter(it => !it.person && !it.people && (!project || it.project === project || it.tasks.some(t => t.project === project)));
    const by = {}; its.forEach(it => { const pc = it.project || (it.tasks[0] && it.tasks[0].project) || ""; (by[pc] = by[pc] || []).push(it); });
    const head = `Open items for the next meeting (board as of ${fmtDate(new Date().toISOString())})`;
    const body = Object.entries(by).map(([pc, xs]) => `${pc ? (S.projects[pc] || {}).name || pc : "No project named"}\n` + xs.map((it, i) => {
      const q = OI.questionFor(it, { fmtDate });
      return `${i + 1}. ${q.question}\n   Needed: ${q.needed.replace("the person in PEOPLE they are", "the person on the board they are")}\n   Raised in: ${it.meeting.title}, ${fmtDate(it.meeting.meetingAt)}`; }).join("\n")).join("\n\n");
    return its.length ? `${head}\n\n${body}\n` : "";
  }
  window.MKG_oiAgenda = project => oiAgenda(state.lastFold, state.boardLabels, project || null);
  // Task history: every resolution of every label on the task, including dismissed and superseded ones (A6).
  function resHistHtml(code) {
    const LB = state.boardLabels; if (!LB) return "";
    const its = Object.values(LB.byKey).filter(it => (it.target === code || it.tasks.some(t => t.code === code)) && it.res);
    if (!its.length) return "";
    return `<section class="res-hist"><h4>Reviewer decisions</h4>${its.map(it => `<div class="res-hitem"><span class="lbl-name">${esc(it.name)}</span> ${esc(it.note)}${it.res.all.map(r => `<div class="res-hrec${it.res.heads.includes(r) ? "" : " superseded"}">${resParts(r)}${it.res.heads.includes(r) ? "" : `<div class="sub">Superseded.</div>`}</div>`).join("")}</div>`).join("")}</section>`;
  }

  // ---------- The person page (§16.13) ----------
  function openPerson(id) {
    const S = state.lastFold, p = S && S.parties[id]; if (!p) return;
    const mt = [];
    for (const k of state.packages) for (const a of ((k.attendance || {}).participants || [])) if (attendeeParty(S, a) === id) mt.push({ title:k.meeting.title, at:k.meeting.meetingAt, duration:a.duration || "", role:a.role || "" });
    const ts = Object.values(S.taskings).filter(t => !t.mergedInto && t.assignee === id).sort((a, b) => a.code.localeCompare(b.code));
    const open = ts.filter(t => t.status !== "completed"), done = ts.filter(t => t.status === "completed");
    const ra = p.reviewerAdded;
    $("hist").classList.remove("wide");
    $("hist").innerHTML = `<div class="dlg person-page"><div class="dlg-top"><h3 id="hist-title">${esc(p.name)}</h3><button class="btn" id="close-hist">Close</button></div>
      <dl class="facts">
        ${(p.aliases || []).length ? `<dt>Other names</dt><dd>${p.aliases.map(esc).join(", ")}</dd>` : ""}
        ${p.org ? `<dt>Organization</dt><dd>${esc(p.org)}</dd>` : ""}
        ${(p.emails || []).length ? `<dt>Email</dt><dd>${p.emails.map(esc).join(", ")}</dd>` : ""}
        <dt>On the board</dt><dd>${ra ? `Reviewer-added by ${esc(ra.by)}, ${esc(fmtDate(localDate(ra.at)))}${ra.unverified ? "; not yet verified" : ""}` : "From the register or a meeting"}</dd>
        <dt>Meetings attended</dt><dd>${mt.length ? `${mt.length}: first ${esc(fmtDate(mt[0].at))}, last ${esc(fmtDate(mt[mt.length - 1].at))}` : "None on file (no attendance report names this person)"}</dd>
      </dl>
      ${mt.length ? `<h4>Attendance</h4><div class="tbl-wrap"><table><thead><tr><th>Meeting</th><th>Date</th><th>Time in meeting</th></tr></thead><tbody>${mt.map(m => `<tr><td>${esc(m.title)}</td><td>${esc(fmtDate(m.at))}</td><td>${esc(m.duration)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <h4>Tasks owned (${open.length} open, ${done.length} completed)</h4>
      <ul class="hist">${[...open, ...done].map(t => `<li>${entBtn(S, t.iri)} ${pill(t.status)}</li>`).join("") || `<li class="sub">None</li>`}</ul></div>`;
    if (!$("hist").open) $("hist").showModal();
  }

  // ---------- The action form ----------
  const resPeople = () => Object.values((state.lastFold || { parties:{} }).parties).filter(p => p.kind === "person").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  var resFormN = 0;
  function resPersonOpts(steps, k, sel) {
    const fresh = steps.slice(0, k).map((x, j) => x.type === "add_person" ? `<option value="@${j}"${sel === "@" + j ? " selected" : ""}>${esc(x.name || "The new person")} (new, step ${j + 1})</option>` : "").join("");
    return `<option value="">Choose a person</option>${fresh}${resPeople().map(p => `<option value="${esc(p.id)}"${p.id === sel ? " selected" : ""}>${esc(p.name)}</option>`).join("")}<option value="__new__">+ Add a new person…</option>`;
  }
  function resTaskOpts(it, steps, k, sel, none, proj) {
    const S = state.lastFold;
    const fresh = steps.slice(0, k).map((x, j) => x.type === "create_task" ? `<option value="@${j}"${sel === "@" + j ? " selected" : ""}>The new task “${esc(x.title || "…")}” (step ${j + 1})</option>` : "").join("");
    // Attach (Aaron, 2026-10-13): a chosen project limits the list to its tasks; with no project, every task is listed.
    const ts = Object.values(S.taskings).filter(t => !t.mergedInto && t.status !== "completed" && (!proj || t.project === proj))
      .sort((a, b) => (a.project === it.project ? 0 : 1) - (b.project === it.project ? 0 : 1) || a.code.localeCompare(b.code));
    return `<option value="">${none ? "The project, no particular task" : "Choose a task"}</option>${fresh}${ts.map(t => `<option value="${esc(t.code)}"${t.code === sel ? " selected" : ""}>${esc(t.code)} ${esc(t.label)} (${esc((S.projects[t.project] || {}).name || t.project)})</option>`).join("")}`;
  }
  function resNow(st, steps, what) {
    const S0 = state.lastFold, t = st.task && !/^@/.test(st.task) && S0.taskings[S0.codeIndex[st.task]];
    if (!t) return "";
    const cur = what === "owner" ? partyName(S0, t.assignee) : what === "status" ? (STATUS_LABEL[t.status] || "Open") : t.due ? fmtDate(t.due) : "none";
    const pn = id => { const m = /^@(\d+)$/.exec(id || ""); return m ? (steps[+m[1]] || {}).name || "the new person" : (S0.parties[id] || {}).name || ""; };
    const nv = what === "owner" ? pn(st.party) : what === "status" ? (STATUS_LABEL[st.status] || "") : st.date ? fmtDate(st.date) : "";
    return `<div class="res-now">${esc(t.code)} ${what === "owner" ? "owner" : what === "status" ? "status" : "due date"}: ${esc(cur)} → ${nv ? `<b>${esc(nv)}</b>` : "…"}</div>`;
  }
  function resStepHtml(it, st, k, steps) {
    const S = state.lastFold, f = [], name = it.topic && it.topic.person ? it.topic.person : "";
    const taskSel = st.task != null ? st.task : st.type === "attach" ? "" : it.tasks.length ? it.tasks[0].code : "";
    const projOpts = sel => `<option value="">Choose a project</option>${Object.values(S.projects).map(p => `<option value="${esc(p.code)}"${p.code === sel ? " selected" : ""}>${esc(p.name)}</option>`).join("")}`;
    const val = (x, d) => esc(x != null ? x : d);
    switch (st.type) {
      case "match_person": f.push(`<label>Person <select data-f="party">${resPersonOpts(steps, k, st.party != null ? st.party : (it.topic && it.topic.known) || "")}</select></label>`,
        `<label>${it.attendee ? "Name in the attendance report" : "Name used in the meeting"} <input data-f="alias" value="${val(st.alias, it.attendee ? it.attendee.name : RES.refName(it.rawNote || it.note) || name)}"></label>`,
        `<input type="hidden" data-f="email" value="${val(st.email, (it.topic && it.topic.attendee && it.topic.attendee.email) || "")}">`); break;
      case "add_person": f.push(`<label>Full name <input data-f="name" placeholder="First and last name" value="${val(st.name, name.includes(" ") || it.attendee ? name : "")}"></label>`,
        `<label>Organization or component <input data-f="org" placeholder="If known" value="${val(st.org, "")}"></label>`,
        `<label>${it.attendee ? "Name in the attendance report" : "Name used in the meeting"} <input data-f="alias" value="${val(st.alias, it.attendee ? it.attendee.name : RES.refName(it.rawNote || it.note) || name)}"></label>`,
        `<label>Email <input data-f="email" value="${val(st.email, (it.topic && it.topic.attendee && it.topic.attendee.email) || "")}" placeholder="If known"></label>`,
        `<label class="chk"><input type="checkbox" data-f="verified"${st.verified || (st.verified == null && it.attendee) ? " checked" : ""}> I confirmed this identity directly (otherwise the person is marked “Reviewer-added, not yet verified”)</label>`); break;
      case "assign": case "confirm_owner": f.push(`<label>Task <select data-f="task">${resTaskOpts(it, steps, k, taskSel)}</select></label>`,
        `<label>Person <select data-f="party">${resPersonOpts(steps, k, st.party || "")}</select></label>`, resNow({ ...st, task:st.task != null ? st.task : taskSel }, steps, "owner")); break;
      case "set_date": f.push(`<label>Task <select data-f="task">${resTaskOpts(it, steps, k, taskSel)}</select></label>`, `<label>Task due date <input type="date" data-f="date" value="${val(st.date, "")}"></label>`, resNow({ ...st, task:st.task != null ? st.task : taskSel }, steps, "due")); break;
      case "confirm_status": f.push(`<label>Task <select data-f="task">${resTaskOpts(it, steps, k, taskSel)}</select></label>`,
        `<label>Status <select data-f="status">${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}"${v === (st.status || (it.kind === "overdue" ? "completed" : "open")) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`, resNow({ ...st, task:st.task != null ? st.task : taskSel, status:st.status || (it.kind === "overdue" ? "completed" : "open") }, steps, "status")); break;
      case "task_note": f.push(`<label>Task <select data-f="task">${resTaskOpts(it, steps, k, taskSel)}</select></label>`, `<label>Note for the task’s owner <textarea data-f="text" rows="2">${val(st.text, "")}</textarea></label>`); break;
      case "create_task": f.push(`<label>Task title <input data-f="title" value="${val(st.title, "")}" placeholder="What has to be done"></label>`,
        `<label>Project <select data-f="project">${projOpts(st.project != null ? st.project : it.project || "")}</select></label>`,
        `<label>Owner (optional) <select data-f="owner">${resPersonOpts(steps, k, st.owner || "").replace("Choose a person", "No owner yet")}</select></label>`); break;
      case "attach": { const proj = st.project != null ? st.project : it.project || "";
        f.push(`<label>Project <select data-f="project">${projOpts(proj).replace('<option value="">Choose a project</option>', '<option value="">Any project (pick the task)</option>')}</select></label>`,
          `<label>Task${proj ? " in this project" : ""} <select data-f="task">${resTaskOpts(it, steps, k, taskSel, !!proj, proj).replace('<option value="">Choose a task</option>', '<option value="">Choose a task</option>')}</select></label>`); break; }
      case "verify_person": f.push(`<input type="hidden" data-f="party" value="${esc(it.person)}">`); break;
    }
    return `<li class="res-step" data-step="${st.type}"><div class="res-step-h"><b>${k + 1}. ${esc(st.type === "match_person" ? "Identify person (someone on the board, or + Add a new person)" : RES.ACTION[st.type].label)}</b> <span class="sub">${esc(RES.consequence(st.type))}</span>${steps.length > 1 ? ` <button class="btn" data-res-rmstep="${k}">Remove</button>` : ""}</div>${f.join("")}</li>`;
  }
  function resSupPrefix(it) {
    const sup = it.res && (it.status === "resolved" || it.status === "conflict") ? it.res.heads : [];
    return sup.length ? `Supersedes ${sup.map(r => `${r.by}'s decision of ${fmtDate(localDate(r.at))}`).join(" and ")}: ` : "";
  }
  function resBuilder(it, steps, outcome, note) {
    const n = ++resFormN;
    return `<div class="res-f res-dec" data-res-action="decision" data-outcome="${outcome}"><div class="res-what">Your decision. Each step changes the board on your decision and cites your note; add as many as the item needs.</div>
      <ol class="res-steps">${steps.map((st, k) => resStepHtml(it, st, k, steps)).join("")}</ol>
      <label class="res-addstep">Add a step <select data-res-addstep><option value="">Choose a step…</option>${RES.STEPS.filter(t => t !== "verify_person" && t !== "confirm_owner").map(t => `<option value="${t}">${esc(t === "add_person" ? "Add a new person" : RES.actionLabel(t))}</option>`).join("")}</select></label>
      ${outcome === "open" ? `<div class="sub res-keeps">This doesn’t answer the question: the item stays open.</div>` : ""}
      <label>Resolution note (required) <textarea data-f="note" rows="2">${esc(note != null ? note : resSupPrefix(it))}</textarea></label>
      <div class="res-err" role="alert"></div>
      <div class="actions"><button class="btn primary" data-res-add>Add to changes</button><button class="btn" data-res-cancel>Cancel</button></div></div>`;
  }
  function resAnswerForm(it, type, keep, note, steps) {
    type = type || "text"; steps = steps || [];
    const n = ++resFormN, t0 = it.tasks.length ? it.tasks[0] : null, S = state.lastFold;
    const types = [["text", "Text"], ["date", "Date or range"], ["person", "Person"], ["choice", "Choice"], ["yesno", "Yes/No"]];
    let input = "";
    if (type === "text") input = `<textarea data-a="text" rows="2" placeholder="The answer"></textarea>`;
    if (type === "date") input = `<div class="res-row"><label>Date (or start) <input type="date" data-a="from"></label><label>End (for a range) <input type="date" data-a="to"></label></div><label class="chk"><input type="checkbox" data-a="noyear"> The year isn’t known</label>`;
    if (type === "person") input = `<select data-a="person"><option value="">Choose a person</option>${resPeople().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>`;
    if (type === "choice") input = `<div class="res-choices">${[0, 1, 2, 3].map(i => `<label class="chk"><input type="radio" name="res-ch-${n}" data-a="pick" value="${i}"> <input data-a="opt" placeholder="Option ${i + 1}${i > 1 ? " (optional)" : ""}"></label>`).join("")}<div class="sub">Type the options and select the one chosen.</div></div>`;
    if (type === "yesno") input = `<div class="res-row"><label class="chk"><input type="radio" name="res-yn-${n}" data-a="yn" value="Yes"> Yes</label><label class="chk"><input type="radio" name="res-yn-${n}" data-a="yn" value="No"> No</label></div>`;
    const also = [];
    if (t0 && type === "date") also.push(["set_date", `Also set ${t0.code} due date to this date (now: ${t0.due ? fmtDate(t0.due) : "none"}).`]);
    if (t0 && type === "person") also.push(["assign", `Also make this person owner of ${t0.code} (now: ${partyName(S, t0.assignee)})`]);
    if (t0 && type !== "date" && type !== "person") also.push(["task_note", `Also add this answer as a note on ${t0.code}`]);
    return `<div class="res-f res-dec res-ans" data-res-action="answer" data-atype="${type}" data-outcome="settle">
      <div class="res-what">Answer. ${esc(RES.consequence("answer"))}</div>
      <label>Answer as <select data-res-atype>${types.map(([v, l]) => `<option value="${v}"${v === type ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <div class="res-aval">${input}</div>
      ${also.length ? `<div class="res-also">${also.map(([k, l]) => `<label class="chk"><input type="checkbox" data-also="${k}"> ${esc(l)}</label>`).join("")}</div>` : ""}
      <ol class="res-steps">${steps.map((st, k) => resStepHtml(it, st, k, steps)).join("")}</ol>
      <label class="res-addstep">Add a step <select data-res-addstep><option value="">Choose a step…</option>${RES.STEPS.filter(t => t !== "verify_person" && t !== "confirm_owner").map(t => `<option value="${t}">${esc(t === "add_person" ? "Add a new person" : RES.actionLabel(t))}</option>`).join("")}</select></label>
      <label class="chk"><input type="checkbox" data-res-keepopen${keep ? " checked" : ""}> Keep this open (not confirmed yet)</label>
      <label>Note: how you know (required) <textarea data-f="note" rows="2">${esc(note != null ? note : resSupPrefix(it))}</textarea></label>
      <div class="res-err" role="alert"></div>
      <div class="actions"><button class="btn primary" data-res-add>Add to changes</button><button class="btn" data-res-cancel>Cancel</button></div></div>`;
  }
  function resDateAlso(fbox) {
    const box = fbox.querySelector('[data-also="set_date"]'); if (!box) return;
    const to = (fbox.querySelector("[data-a=to]") || {}).value, ny = (fbox.querySelector("[data-a=noyear]") || {}).checked;
    const why = to ? "Not available for a range." : ny ? "Not available without a year." : "";
    box.disabled = !!why; if (why) box.checked = false;
    const lab = box.closest("label"); let w = lab.querySelector(".res-why");
    if (!w) { w = document.createElement("span"); w.className = "res-why"; lab.appendChild(w); }
    w.textContent = why ? ` ${why}` : ""; lab.classList.toggle("res-off", !!why);
  }
  function resReadAnswer(fbox) {
    const type = fbox.dataset.atype, q = x => fbox.querySelector(x), S = state.lastFold;
    const full = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    const md = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" });
    if (type === "text") { const v = String(q("[data-a=text]").value || "").trim(); return v ? { type, value:v, display:v } : { err:"Write the answer." }; }
    if (type === "date") { const f = q("[data-a=from]").value, t = q("[data-a=to]").value, ny = q("[data-a=noyear]").checked;
      if (!f) return { err:"Enter the date (and the end, for a range)." };
      if (t && t < f) return { err:"The end of the range is before its start." };
      return { type, value:{ from:f, to:t || null, yearKnown:!ny }, display:ny ? `${md(f)}${t ? `–${t.slice(5, 7) === f.slice(5, 7) ? String(+t.slice(8)) : md(t)}` : ""}, year not known` : `${full(f)}${t ? ` to ${full(t)}` : ""}` }; }
    if (type === "person") { const v = q("[data-a=person]").value; return v ? { type, value:v, display:(S.parties[v] || {}).name || v } : { err:"Choose the person." }; }
    if (type === "choice") { const opts = [...fbox.querySelectorAll("[data-a=opt]")].map(x => x.value.trim()), pk = q("[data-a=pick]:checked");
      if (!pk || !opts[+pk.value]) return { err:"Type the options and select the one chosen." };
      const others = opts.filter((o, i) => o && i !== +pk.value);
      return { type, value:{ chosen:opts[+pk.value], options:opts.filter(Boolean) }, display:`${opts[+pk.value]}${others.length ? ` (not: ${others.join("; ")})` : ""}` }; }
    if (type === "yesno") { const pk = q("[data-a=yn]:checked"); return pk ? { type, value:pk.value, display:pk.value } : { err:"Choose Yes or No." }; }
    return { err:"Give the answer." };
  }
  function resForm(it, action) {
    if (action === "answer") return resAnswerForm(it, "text", false, null, []);
    if (RES.STEPS.includes(action)) return resBuilder(it, [{ type:action }], RES.primaryFor(it.kind, it.topic) === action ? "settle" : "open");
    const A = RES.ACTION[action];
    const noteLbl = A.dismiss || A.defer ? "Reason (required)" : "Resolution note (required)";
    return `<div class="res-f" data-res-action="${action}"><div class="res-what">${esc(RES.actionLabel(action, it.kind, it.topic))}. ${esc(RES.consequence(action))}</div>
      <label>${noteLbl} <textarea data-f="note" rows="2">${esc(resSupPrefix(it))}</textarea></label>
      <div class="res-err" role="alert"></div>
      <div class="actions"><button class="btn primary" data-res-add>Add to changes</button><button class="btn" data-res-cancel>Cancel</button></div></div>`;
  }
  function resReadSteps(fbox) {
    return [...fbox.querySelectorAll(".res-step")].map(li => { const v = { type:li.dataset.step };
      li.querySelectorAll("[data-f]").forEach(x => { v[x.dataset.f] = x.type === "checkbox" ? x.checked : String(x.value || "").trim(); }); return v; });
  }
  // Re-render the builder with new steps, keeping what was typed. shift(j) maps an old step index to its new one (or -1).
  function resRebuild(fbox, it, steps, shift) {
    if (shift) steps.forEach(st => ["party", "owner", "task"].forEach(f => { const m = /^@(\d+)$/.exec(st[f] || ""); if (m) { const j = shift(+m[1]); st[f] = j < 0 ? "" : "@" + j; } }));
    const outcome = fbox.dataset.outcome || "settle", note = fbox.querySelector("textarea[data-f=note]").value;
    const host = fbox.parentNode;
    if (fbox.dataset.resAction === "answer") {
      const snap = [...fbox.querySelectorAll("[data-a]")].map(x => x.type === "checkbox" || x.type === "radio" ? x.checked : x.value);
      const also = [...fbox.querySelectorAll("[data-also]")].map(x => x.checked);
      host.innerHTML = resAnswerForm(it, fbox.dataset.atype, fbox.querySelector("[data-res-keepopen]").checked, note, steps);
      const nf = host.querySelector(".res-f");
      [...nf.querySelectorAll("[data-a]")].forEach((x, i) => { if (snap[i] === undefined) return; if (x.type === "checkbox" || x.type === "radio") x.checked = snap[i]; else x.value = snap[i]; });
      [...nf.querySelectorAll("[data-also]")].forEach((x, i) => { x.checked = !!also[i]; });
      return;
    }
    host.innerHTML = resBuilder(it, steps, outcome, note);
  }
  function resSummary(action, v, steps) {
    const S = state.lastFold, st = steps || [];
    const pn = id => { const m = /^@(\d+)$/.exec(id || ""); return m ? (st[+m[1]] || {}).name || "the new person" : (S.parties[id] || {}).name || id; };
    const tn = c => { const m = /^@(\d+)$/.exec(c || ""); return m ? `the new task “${(st[+m[1]] || {}).title || ""}”` : c; };
    v = { ...v, task:v.task ? tn(v.task) : v.task };
    switch (action) {
      case "create_task": return `“${v.title}”${v.owner ? `, owner ${pn(v.owner)}` : ""}`;
      case "task_note": return `on ${v.task}`;
      case "assign": case "confirm_owner": return `${v.task} to ${pn(v.party)}`;
      case "confirm_status": return `${v.task} ${STATUS_LABEL[v.status] || v.status}`;
      case "set_date": return `${v.task} due ${fmtDate(v.date)}`;
      case "match_person": return `“${v.alias}” is ${pn(v.party)}`;
      case "add_person": return `${v.name}${v.org ? `, ${v.org}` : ""}`;
      case "attach": return v.task ? `to ${v.task}` : `to ${(S.projects[v.project] || {}).name || v.project}`;
      default: return "";
    }
  }
  function resLabelOf(it) {
    return { key:it.key, meeting:it.meetingId, meetingTitle:it.meeting.title, meetingDate:it.meeting.meetingAt ? localDate(it.meeting.meetingAt) : null,
      seg:(it.segs || [])[0] || null, kind:it.kind, name:it.name, target:it.target, quote:it.quote || "",
      quotes:(it.src || []).map(x => ({ seg:x.id, text:x.text, speaker:x.speakerName || "" })) };
  }
  // Builds the package's statements and ops and compiles them; returns { comp, prepared, build } or { errors }.
  function resCompile(pending, name) {
    const latest = state.packages.reduce((m, x) => Math.max(m, toMs(x.meeting.meetingAt)), -Infinity);
    let ms = Date.now(); if (Math.floor(ms / 1000) <= Math.floor(latest / 1000)) ms = latest + 1000;
    const nowD = new Date(ms), offMin = -nowD.getTimezoneOffset(), sign = offMin < 0 ? "-" : "+", abs = Math.abs(offMin);
    const offset = `${sign}${pad(Math.floor(abs / 60), 2)}:${pad(abs % 60, 2)}`;
    const meetingAt = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1, 2)}-${pad(nowD.getDate(), 2)}T${pad(nowD.getHours(), 2)}:${pad(nowD.getMinutes(), 2)}:${pad(nowD.getSeconds(), 2)}${offset}`;
    const S = foldPackages(state.packages);
    const build = RES.buildSave(pending, { by:name, at:new Date(ms).toISOString(), atText:`${meetingAt.slice(0, 10)} ${meetingAt.slice(11, 16)}`,
      partyName:id => (S.parties[id] || {}).name || id, projectName:c => (S.projects[c] || {}).name || c, taskLabel:c => ((S.taskings[S.codeIndex[c]] || {}).label) || "" });
    const revId = findParty(S, name);
    const prepared = { date:meetingAt.slice(0, 10), meetingAt, offset, title:"Board resolutions", kind:"attestation", forceExt:true, reviewer:name,
      segments:build.segments.map(x => ({ id:x.id, t:null, speakerName:name, speakerId:revId || null, text:x.text })) };
    const comp = compile({ ops:build.ops, flags:[] }, prepared, state.packages);
    const plain = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    const errItems = [...comp.global.filter(g => g.lvl === "error").map(g => ({ text:plain(g.text), op:null })),
      ...comp.rows.flatMap(r => r.msgs.filter(m => m.lvl === "error").map(m => ({ text:plain(m.text), op:build.opMap[r.n - 1] || null })))];
    return errItems.length ? { errors:errItems.map(e => e.text), errItems } : { comp, prepared, build };
  }

  function resRender() {
    let tray = $("res-tray");
    if (!tray) {
      tray = document.createElement("div"); tray.id = "res-tray"; tray.className = "res-tray"; tray.setAttribute("role", "region"); tray.setAttribute("aria-label", "Changes not saved");
      document.body.appendChild(tray);
    }
    if (!resPending.length) { tray.hidden = true; tray.innerHTML = ""; return; }
    let nm = ""; try { nm = localStorage.getItem(RES_NAME) || ""; } catch (e) {}
    const keep = $("res-name") ? $("res-name").value : nm;
    tray.hidden = false;
    tray.innerHTML = `<div class="res-tray-top"><b id="res-count">${resPending.length} change${resPending.length === 1 ? "" : "s"} not saved</b>
      <label>Your name <input id="res-name" value="${esc(keep)}"></label>
      <button class="btn primary" id="res-save">Save</button><button class="btn" id="res-discard">Discard all</button></div>
      <ul class="res-tray-list">${resPending.map((a, i) => `<li>${esc(a.label.name)} → <b>${esc(a.choice)}</b>${a.summary ? ` (${esc(a.summary)})` : ""}: “${esc(a.note)}” <button class="btn" data-res-undo-i="${i}">Undo</button></li>`).join("")}</ul>
      <div id="res-msg" role="alert"></div>`;
  }
  function resRefresh() { renderBoard(); resRender(); }
  function resErr(box, msg) { const e = box.querySelector(".res-err"); if (e) e.textContent = msg; }

  document.addEventListener("click", ev => {
    const t = ev.target; if (!t || !t.closest) return;
    // More ▾ closes after a choice, or a click anywhere else.
    document.querySelectorAll("details.res-more[open]").forEach(d => { if (!d.contains(t) || t.closest("[data-res-act]")) d.open = false; });
    const ag = t.closest("[data-oi-agenda]");
    if (ag) { const txt = oiAgenda(state.lastFold, state.boardLabels, ag.dataset.oiAgenda || null);
      if (!txt) return toast("No open items to copy.");
      (async () => { try { await navigator.clipboard.writeText(txt); } catch (e) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) {} ta.remove(); }
        state.oiAgendaCopied = txt; toast("Open items copied. Paste them into the next meeting's agenda."); })(); return; }
    const pp = t.closest("[data-person]");
    if (pp) { openPerson(pp.dataset.person); return; }
    const vb = t.closest("[data-attn-view]");
    if (vb) { state.attnView = vb.dataset.attnView; renderBoard(); return; }
    const ab = t.closest("[data-res-act]");
    if (ab) {
      const it = state.boardLabels && state.boardLabels.byKey[ab.dataset.resKey]; if (!it) return;
      const box = ab.closest(".res-box"), fm = box.querySelector(".res-form");
      fm.innerHTML = resForm(it, ab.dataset.resAct); const ta = fm.querySelector("[data-f=note]"); if (ta) ta.focus();
      return;
    }
    if (t.closest("[data-res-cancel]")) { const fm = t.closest(".res-form"); if (fm) fm.innerHTML = ""; return; }
    const rm = t.closest("[data-res-rmstep]");
    if (rm) { const fbox = rm.closest(".res-f"), it = state.boardLabels.byKey[rm.closest(".res-box").dataset.resItem], k = +rm.dataset.resRmstep;
      const steps = resReadSteps(fbox); steps.splice(k, 1); resRebuild(fbox, it, steps, j => j === k ? -1 : j > k ? j - 1 : j); return; }
    if (t.closest("[data-res-add]")) {
      const fbox = t.closest(".res-f"), box = t.closest(".res-box"), it = state.boardLabels.byKey[box.dataset.resItem];
      if (!it) return;
      const err = m => resErr(fbox, m);
      const note = String((fbox.querySelector("textarea[data-f=note]") || {}).value || "").trim();
      const sup = it.res && (it.status === "resolved" || it.status === "conflict") ? it.res.heads : [];
      const follows = it.res ? it.res.heads : [];
      const isDec = fbox.dataset.resAction === "decision", action = fbox.dataset.resAction, A = RES.ACTION[action] || {};
      if (!note || note.length < 3) return err(action === "answer" ? "Add a note saying how you know." : !isDec && (A.dismiss || A.defer) ? "Give a short reason." : "Add a resolution note: it is recorded as your attestation.");
      if (sup.length && sup.some(r => !note.includes(r.by))) return err("Name the earlier decision you replace (who made it and when) in your note.");
      if (sup.length && note.replace(/^Supersedes [^:]*:\s*/, "").length < 3) return err("Say why you replace the earlier decision.");
      const base = { label:resLabelOf(it), note, supersedes:follows.map(r => r.id), seen:it.res ? it.res.heads.map(r => r.id) : [] };
      let a;
      // The validator sees every step now, so a refused decision never reaches the tray (§16.1, §16.12).
      const dryRun = (a, steps) => { let nm = ""; try { nm = localStorage.getItem(RES_NAME) || ""; } catch (e) {}
        const P = (k, st) => steps.length > 1 ? `Step ${k + 1} (${RES.ACTION[st.type].label}): ` : "";
        const list = [...resPending.filter(x => x.label.key !== it.key), a];
        const dry = resCompile(list, ($("res-name") && $("res-name").value.trim()) || nm || "Reviewer");
        if (!dry.errors) return null;
        const mine = dry.errItems.find(e => e.op && e.op.d === list.length - 1) || dry.errItems[0];
        return `The board can't take this change: ${mine.op && mine.op.d === list.length - 1 ? P(mine.op.k, steps[mine.op.k]) : ""}${mine.text}`; };
      const checkSteps = steps => {
        const P = (k, st) => steps.length > 1 ? `Step ${k + 1} (${RES.ACTION[st.type].label}): ` : "";
        const others = resPending.filter(x => x.label.key !== it.key).flatMap(x => (x.steps || []).filter(y => y.type === "add_person").map(y => y.name.toLowerCase()));
        const S0 = state.lastFold;
        for (let k = 0; k < steps.length; k++) {
          const st = steps[k], p = P(k, st);
          if (st.party === "__new__" || st.owner === "__new__") return p + "Choose the person, or add them as a step first.";
          if (st.type === "attach") { const tt = st.task && !/^@/.test(st.task) && S0.taskings[S0.codeIndex[st.task]];
            if (!st.project && !st.task) return p + "Choose a project or a task.";
            if (tt) st.project = tt.project; if (!st.task) delete st.task; }
          if (["assign", "confirm_owner", "set_date", "confirm_status", "task_note"].includes(st.type) && !st.task) return p + "Choose the task.";
          if (["assign", "confirm_owner", "match_person"].includes(st.type) && !st.party) return p + "Choose the person.";
          if (st.type === "set_date" && !/^\d{4}-\d{2}-\d{2}$/.test(st.date || "")) return p + "Enter the task date.";
          if (st.type === "match_person" && !st.alias) return p + "Enter the name the meeting used.";
          if (st.type === "task_note" && String(st.text || "").length < 3) return p + "Write the note for the task.";
          if (st.type === "create_task") { if (String(st.title || "").length < 5) return p + "Give the task a title."; if (!st.project) return p + "Choose the project."; }
          if (st.type === "add_person") { const m = RES.checkPerson({ ...st, note }, resPeople()); if (m) return p + m;
            const nm = st.name.toLowerCase(); if (others.includes(nm) || steps.slice(0, k).some(y => y.type === "add_person" && y.name.toLowerCase() === nm)) return p + `${st.name} is already in your unsaved changes.`; }
          if (st.type === "add_person" || st.type === "match_person") st.alias = st.alias || "";
          if (st.type === "verify_person") delete st.task;
        }
        return null; };
      const stepsLine = steps => steps.map(st => { const x = resSummary(st.type, st, steps); return `${RES.ACTION[st.type].label}${x ? ` (${x})` : ""}`; }).join(" · ");
      if (action === "answer") {
        // §16.15.3: the answer is a Resolve-with-note record; ticked changes are its steps; "keep open" is its outcome.
        const ans = resReadAnswer(fbox); if (ans.err) return err(ans.err);
        const keep = fbox.querySelector("[data-res-keepopen]").checked;
        const ticked = [...fbox.querySelectorAll("[data-also]:checked")].map(x => x.dataset.also);
        if (keep && ticked.length) return err("An answer kept open doesn’t change records. Untick the change, or don’t keep it open.");
        const t0 = it.tasks[0], extra = resReadSteps(fbox), own = [];
        for (const k of ticked) {
          if (k === "set_date") { if (ans.type === "date" && ans.value.to) return err("A range can’t be a due date. Untick the due-date change, or clear the end date.");
            if (ans.type !== "date" || !ans.value.yearKnown) return err("A date without a year can’t be a due date. Untick the due-date change, or give the year."); own.push({ type:"set_date", task:t0.code, date:ans.value.from }); }
          if (k === "assign") own.push({ type:"assign", task:t0.code, party:ans.value });
          if (k === "task_note") own.push({ type:"task_note", task:t0.code, text:`Answer: ${ans.display}` });
        }
        const steps = [...extra, ...own];
        const e1 = checkSteps(steps); if (e1) return err(e1);
        a = { ...base, answer:ans, steps, outcome:keep ? "open" : "settle", action:"resolve_note", choice:"Answer", value:{},
          summary:`“${ans.display}”${steps.length ? ` · ${stepsLine(steps)}` : ""}${keep ? " · kept open" : ""}` };
        if (steps.length) { const e2 = dryRun(a, steps); if (e2) return err(e2); }
      }
      else if (!isDec) a = { ...base, action, choice:RES.actionLabel(action, it.kind, it.topic), value:{}, summary:"" };
      else {
        const steps = resReadSteps(fbox), outcome = fbox.dataset.outcome || "settle";
        if (!steps.length) return err("Add at least one step, or use Answer.");
        const e1 = checkSteps(steps); if (e1) return err(e1);
        const one = steps.length === 1;
        a = { ...base, steps, outcome, action:one ? steps[0].type : "decision", value:steps[0],
          choice:one ? RES.ACTION[steps[0].type].label : "Decision",
          summary:(one ? resSummary(steps[0].type, steps[0], steps) : stepsLine(steps)) + (outcome === "open" ? " · item stays open" : "") };
        const e2 = dryRun(a, steps); if (e2) return err(e2);
      }
      resPending = resPending.filter(x => x.label.key !== a.label.key).concat([a]);
      resRefresh(); return;
    }
    const ub = t.closest("[data-res-undo]");
    if (ub) { resPending = resPending.filter(a => a.label.key !== ub.dataset.resUndo); resRefresh(); return; }
    const ui = t.closest("[data-res-undo-i]");
    if (ui) { resPending.splice(+ui.dataset.resUndoI, 1); resRefresh(); return; }
    if (t.id === "res-discard") { if (confirm(`Discard ${resPending.length} unsaved change${resPending.length === 1 ? "" : "s"}?`)) { resPending = []; resRefresh(); } return; }
    if (t.id === "res-save") { resSave(); return; }
    const sc = t.closest("[data-res-stale-cancel]");
    if (sc) { const k = sc.dataset.resStaleCancel; resPending = resPending.filter(a => a.label.key !== k); resRefresh(); return; }
    const ss = t.closest("[data-res-stale-sup]");
    if (ss) {
      const k = ss.dataset.resStaleSup, a = resPending.find(x => x.label.key === k), heads = (RES.stateOf(resAll())[k] || { heads:[] }).heads;
      const row = ss.closest("li"), inp = row && row.querySelector("textarea");
      const note = inp ? inp.value.trim() : "";
      if (!a) return;
      if (heads.some(r => !note.includes(r.by)) || note.replace(/^Supersedes [^:]*:\s*/, "").length < 3) { const e = row.querySelector(".res-err"); if (e) e.textContent = "Your new note must name the earlier resolver and date, and say why."; return; }
      a.note = note; a.supersedes = heads.map(r => r.id); a.seen = heads.map(r => r.id);
      resRefresh(); toast("Updated. Press Save to record it."); return;
    }
  });

  document.addEventListener("change", ev => {
    const t = ev.target; if (!t || !t.closest) return;
    const fbox = t.closest(".res-f.res-dec"); if (!fbox) return;
    const it = state.boardLabels && state.boardLabels.byKey[t.closest(".res-box").dataset.resItem]; if (!it) return;
    // Attach: picking a project narrows the task list; picking a task with no project sets its project.
    const li = t.closest(".res-step");
    if (li && li.dataset.step === "attach" && (t.dataset.f === "project" || t.dataset.f === "task")) {
      const k = [...fbox.querySelectorAll(".res-step")].indexOf(li), steps = resReadSteps(fbox), st = steps[k], S0 = state.lastFold;
      const tt = st.task && !/^@/.test(st.task) ? S0.taskings[S0.codeIndex[st.task]] : null;
      if (t.dataset.f === "project" && tt && st.project && tt.project !== st.project) st.task = "";
      if (t.dataset.f === "task" && tt) st.project = tt.project;
      resRebuild(fbox, it, steps); return;
    }
    if (fbox.dataset.resAction === "answer" && ["from", "to", "noyear"].includes(t.dataset.a)) { resDateAlso(fbox); return; }
    if (t.hasAttribute("data-res-atype")) {
      const note = fbox.querySelector("textarea[data-f=note]").value, keep = fbox.querySelector("[data-res-keepopen]").checked;
      fbox.parentNode.innerHTML = resAnswerForm(it, t.value, keep, note, resReadSteps(fbox)); return;
    }
    if (li && li.dataset.step === "match_person" && t.dataset.f === "party" && t.value === "__new__") {
      const k = [...fbox.querySelectorAll(".res-step")].indexOf(li), steps = resReadSteps(fbox);
      steps[k] = { type:"add_person", alias:steps[k].alias }; resRebuild(fbox, it, steps); return;
    }
    if (li && ["assign", "confirm_owner", "set_date", "confirm_status"].includes(li.dataset.step) && ["task", "party", "date", "status"].includes(t.dataset.f) && t.value !== "__new__") {
      const k = [...fbox.querySelectorAll(".res-step")].indexOf(li), steps = resReadSteps(fbox);
      const what = li.dataset.step === "set_date" ? "due" : li.dataset.step === "confirm_status" ? "status" : "owner";
      const html = resNow(steps[k], steps, what) || `<div class="res-now"></div>`, old = li.querySelector(".res-now");
      if (old) old.outerHTML = html; else li.insertAdjacentHTML("beforeend", html);
      return;
    }
    if (t.hasAttribute("data-res-addstep") && t.value) { const steps = resReadSteps(fbox); steps.push({ type:t.value }); resRebuild(fbox, it, steps); return; }
    if ((t.dataset.f === "party" || t.dataset.f === "owner") && t.value === "__new__") {
      const li = t.closest(".res-step"), k = [...fbox.querySelectorAll(".res-step")].indexOf(li), steps = resReadSteps(fbox);
      steps[k][t.dataset.f] = "@NEW";
      steps.forEach(st => ["party", "owner", "task"].forEach(f => { const m = /^@(\d+)$/.exec(st[f] || ""); if (m && +m[1] >= k) st[f] = "@" + (+m[1] + 1); }));
      steps.splice(k, 0, { type:"add_person" });
      steps.forEach(st => ["party", "owner"].forEach(f => { if (st[f] === "@NEW") st[f] = "@" + k; }));
      resRebuild(fbox, it, steps);
    }
  });
  document.addEventListener("input", ev => {
    const t = ev.target, fbox = t && t.closest && t.closest(".res-f.res-ans");
    if (fbox && ["from", "to"].includes(t.dataset.a)) resDateAlso(fbox);
  });
  async function resSave() {
    const name = ($("res-name") && $("res-name").value.trim()) || "";
    const msg = $("res-msg");
    if (!name) { msg.textContent = "Enter your name: each decision is recorded in the resolver's own name."; $("res-name").focus(); return; }
    try { localStorage.setItem(RES_NAME, name); } catch (e) {}
    // A2: if the board loaded a newer decision on the same label since the action was taken, Save stops.
    const st = RES.stale(resPending, resAll());
    if (st.length) {
      msg.innerHTML = `<div class="res-stale"><b>Someone else settled ${st.length === 1 ? "this item" : "these items"} after you started.</b> Nothing was saved.<ul>${st.map(x => `<li>${esc(x.action.label.name)} (${esc(x.action.label.target)}): ${x.heads.length ? x.heads.map(resLine).join("") : "the earlier decision was replaced"}
        <div class="actions"><button class="btn" data-res-stale-cancel="${esc(x.action.label.key)}">Cancel my change</button></div>
        <label>Or supersede it. New note, naming the earlier resolver and date: <textarea rows="2">${esc(`Supersedes ${x.heads.map(r => `${r.by}'s decision of ${fmtDate(localDate(r.at))}`).join(" and ")}: ${x.action.note}`)}</textarea></label>
        <div class="res-err" role="alert"></div><div class="actions"><button class="btn" data-res-stale-sup="${esc(x.action.label.key)}">Supersede</button></div></li>`).join("")}</ul></div>`;
      return;
    }
    const r = resCompile(resPending, name);
    if (r.errors) { msg.textContent = `Nothing was saved. The board can't take one of these changes: ${r.errors[0]}`; return; }
    const pkg = await buildPackage(r.comp, r.prepared);
    pkg.meeting.resolutions = true;
    // Every decision's statement is kept, including those that change nothing on the board (A6).
    const have = new Set(pkg.sources.map(x => x.id));
    r.prepared.segments.filter(x => !have.has(x.id)).forEach(x => pkg.sources.push({ id:x.id, t:null, speaker:x.speakerId || null, speakerName:x.speakerName, text:x.text }));
    pkg.sources.sort((x, y) => x.id.localeCompare(y.id));
    const parties = r.comp.ops.filter(o => o.type === "NewParty").map(o => o.f.id), codes = r.comp.ops.filter(o => o.type === "NewTasking").map(o => o.f.code);
    let pi = 0, ci = 0;
    pkg.resolutions = r.build.records.map(rec => {
      const out = { id:`${pkg.meeting.id}-R${pad(rec.n, 2)}`, ...rec }; delete out.n;
      if (!out.steps) delete out.steps;
      (out.steps || []).forEach(st => { if (st.type === "add_person") st.partyId = parties[pi++] || null; if (st.type === "create_task") st.code = codes[ci++] || null; });
      (out.steps || []).forEach(st => ["party", "owner", "task"].forEach(f => { const m = /^@(\d+)$/.exec(st[f] || ""); if (m) { const src = out.steps[+m[1]] || {}; st[f] = f === "task" ? src.code : src.partyId; } }));
      if (out.steps && out.action !== "resolve_note") out.value = { ...out.steps[0] };
      if (out.action === "verify_person") { out.label.meeting = "person"; }
      return out;
    });
    pkg.fileName = `mkg-resolution-${r.prepared.date}-${r.prepared.meetingAt.slice(11, 19).replace(/:/g, "")}.json`;
    const added = await addPackages([pkg], "resolutions");
    if (!added.added) { msg.textContent = `Nothing was saved: ${(added.bad || [])[0] || "the package could not be added."}`; return; }
    download(pkg.fileName, pkg);
    const n = resPending.length; resPending = [];
    state.asOf = pkg.meeting.id; resRefresh();
    toast(`Saved ${n} decision${n === 1 ? "" : "s"} in your name and downloaded ${pkg.fileName}. Put it in the team folder.`);
  }
  window.addEventListener("beforeunload", ev => { if (resPending.length) { ev.preventDefault(); ev.returnValue = ""; return ""; } });
  window.MKG_resPending = () => resPending;
