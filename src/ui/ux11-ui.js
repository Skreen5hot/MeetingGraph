  /* ---------------- D-UX11 user mode (ratified 2026-10-12; user-mode plan §3, §4, §7, §8) ----------------
     Two views of one gate. User mode (default) shows the next action, the changes, the meeting-scope questions and
     the open items in plain language; Reviewer details shows today's full screen plus the same decisions. Both views
     share state.uxChoices and the same Accept wrapper (uxAccept), which applies the choices to the reply and compiles
     it again, so the accepted package is the same whichever view the reviewer used. */
  var UX_KEY = "mkg.reviewerDetails";
  var uxRDMem = false;
  function uxRD() { try { const v = localStorage.getItem(UX_KEY); if (v !== null) return v === "1"; } catch (e) {} return uxRDMem; }
  function uxSetRD(on) { uxRDMem = !!on; try { localStorage.setItem(UX_KEY, on ? "1" : "0"); } catch (e) {} uxApplyMode(); }
  window.MKG_setReviewerDetails = uxSetRD;
  function uxApplyMode() {
    const v = $("view-prepare"); if (v) v.classList.toggle("um", !uxRD());
    const t = $("rd-toggle"); if (t) t.checked = uxRD();
    uxRenderNext();
  }
  function uxCtx(llm) {
    const m = state.prepared, sameId = utcKey(m.meetingAt);
    const S = foldPackages(state.packages.filter(p => p.meeting.id !== sameId));
    const tasks = Object.values(S.taskings).filter(t => !t.mergedInto && t.status !== "completed").map(t => ({ code:t.code, label:t.label, project:t.project, status:"open" }));
    const segments = (m.segments || []).map(s => ({ id:s.id, t:s.t || "", speakerName:s.speakerName || "", text:s.text }));
    let trigger = [];
    try { trigger = UX11_TRIGGER.candidates({ segments:segments.map(s => ({ id:s.id, text:s.text })), tasks:tasks.map(t => ({ id:t.code, title:t.label, status:"open" })), ops:DUX10.adapt(llm).ops }); }
    catch (e) { trigger = []; }
    return { segments, tasks, trigger, rangeRe:UX11_TRIGGER.RANGE_RE, coveredProjects:(llm && llm.coveredProjects) || [],
      partyName:id => (S.parties[id] && S.parties[id].name) || id };
  }
  // D-UX12 (ratified 2026-10-12): the defaults and the person's overrides applied, compiled, and settled (the same gate in
  // both views). Cached per set of choices.
  var uxSettleKey = null, uxSettleVal = null;
  function uxSettle() {
    if (!state.uxLlm || !state.uxModel) return null;
    const key = JSON.stringify(state.uxChoices) + "|" + (state.prepared && state.prepared.token);
    if (uxSettleKey === key && uxSettleVal && uxSettleVal.src === state.uxLlm) return uxSettleVal;
    const run = r => { const c = compile(r, state.prepared, state.packages); return { comp:c, model:UX11.classify(c, r, uxCtx(r)) }; };
    let v = null;
    try { v = UX11.settle(state.uxLlm, state.uxChoices, run, uxCtx(state.uxLlm)); v.src = state.uxLlm; } catch (e) { v = null; }
    uxSettleKey = key; uxSettleVal = v; return v;
  }
  var UX_DO = { admin:"Goes in as a meeting note (Meeting administration), not as project work.", notask:"Goes in as a project open item (Not a task yet), not as a task.",
    demote:"Not applied. It is noted on the task as a possible change for someone to confirm.", noparty:"No new person is created; the name stays in a note.",
    unown:"Goes in without an owner (Possible owner change).", undate:"Goes in without the due date (Date unclear).", scope:"Goes in as written, labeled Scope to confirm.",
    keep:"Goes in as written." };
  // Called by Validate for a meeting reply, before the results render.
  function uxOnValidated(comp, llm) {
    state.uxLlm = llm; state.uxComp = comp; state.uxModel = null; state.uxAwaitRepair = false; state.uxSkipRepair = false;
    state.uxChoices = { drop:[], undate:[], answers:{} }; state.uxDefaults = null;
    if (state.prepared && state.prepared.kind === "transcript") { state.uxModel = UX11.classify(comp, llm, uxCtx(llm)); state.uxDefaults = UX11.defaults(state.uxModel, llm); }
  }
  function uxAccept(onAccept) {
    return async () => {
      const m = state.uxModel;
      if (!m || !state.prepared || state.prepared.kind !== "transcript") return onAccept();
      if (m.replyBlocked) { toast("The chat's reply can't be used yet. Send it the fix request."); uxRefresh(); return; }
      const st = uxSettle();
      if (!st || st.comp.errors || st.model.replyBlocked) { toast("Placing this reply left a problem the workbench can't accept. Switch on Reviewer details to see it."); uxRefresh(); return; }
      const comp2 = st.comp, orig = state.compiled;
      state.compiledOrig = orig; state.compiled = comp2;
      const by = ($("att-name") && $("att-name").value.trim()) || null;
      state.uxReview = UX11.reviewRecord(m, st.choices, by, new Date().toISOString(), null);
      state.uxReview.labels = UX11.labelsOf(st.llm).map(f => ({ kind:f.kind, about:f.about, note:f.note }));
      try { await onAccept(); }
      finally {
        const accepted = state.compiled === null;
        if (!accepted && state.compiled === comp2) state.compiled = orig;
        state.uxReview = null; state.compiledOrig = null;
        if (accepted) { state.uxModel = null; state.uxComp = null; state.uxLlm = null; }
        uxRenderNext();
      }
    };
  }
  // Plain language: new-item refs become their labels, segment ids disappear (D-UX11f).
  function uxPlain(s) {
    const lab = {}; ((state.uxLlm && state.uxLlm.ops) || []).forEach(o => { if (o && o.ref) lab[o.ref] = o.label || o.text || o.name || ""; });
    return String(s == null ? "" : s).replace(/<[^>]+>/g, "")
      .replace(/\bNEW-[A-Z]*\d+\b/g, r => lab[r] ? `“${lab[r]}”` : "a new item").replace(/\bS\d{3}\b/g, "a statement").replace(/\b(?:the )?INDEX\b/g, "the board");
  }
  var UX_FLAG = { open_question:"Open question", suggestion:"Suggestion", ownership:"No owner yet", conflict:"Conflict", implied_change:"Possible date change",
    unmatched:"Not matched to the board", ambiguous_reference:"Unclear reference", overdue:"Overdue" };
  function uxAns(q) { const ch = state.uxChoices || { answers:{} }; return ch.answers[q.id] || (state.uxDefaults && state.uxDefaults.answers[q.id]) || ""; }
  function uxNeedText(m, ch) {
    if (m.replyBlocked) return "The chat's reply needs another correction first.";
    return "Nothing needs deciding. Anything uncertain is labeled on the board for follow-up.";
  }
  function uxChangeHtml(c, ch) {
    const dropped = ch.drop.includes(c.opIndex), undated = ch.undate.includes(c.opIndex);
    const why = c.quote ? `<details class="small ux-why"><summary>Why?</summary>“${esc(c.quote)}”${c.speaker ? ` — ${esc(c.speaker)}` : ""}${c.time ? `, ${esc(c.time)}` : ""}</details>` : "";
    let blk = "";
    const pl = state.uxDefaults && state.uxDefaults.place[c.opIndex];
    if (c.blocks.length && pl) {
      const reasons = [...new Set(c.blocks.map(b => b.reason))].join("; ");
      const does = pl.acts.filter(a => a !== "keep").map(a => UX_DO[a]).join(" ") || UX_DO.keep;
      blk = dropped ? `<div class="ux-done">Left out by you. <button class="btn" data-ux-undo="${c.opIndex}">Undo</button></div>`
        : `<div class="ux-place">${esc(does)} <span class="small">(${esc(reasons)})</span> <button class="btn" data-ux-drop="${c.opIndex}">Leave it out instead</button></div>`;
    }
    return `<li class="${dropped ? "ux-dropped" : ""}${c.blocks.length && !dropped ? " ux-placed" : ""}">
      <label class="small ux-keep"><input type="checkbox" data-ux-keep="${c.opIndex}" ${dropped ? "" : "checked"}> Keep</label>
      <div class="ux-sent">${esc(uxPlain(c.sentence))}${undated ? " (without the due date)" : ""}</div>${why}${blk}</li>`;
  }
  function uxQHtml(q, k, ch, p) {
    return `<li class="ux-q"><div class="ux-qtext">${esc(uxPlain(q.prompt))}</div>
      ${q.statement && q.statement.speaker ? `<div class="small">${esc(q.statement.speaker)}${q.statement.time ? `, ${esc(q.statement.time)}` : ""}</div>` : ""}
      <div class="ux-ans" role="radiogroup">${q.answers.map(a => `<label><input type="radio" name="${p}q${k}" data-ux-q="${esc(q.id)}" value="${esc(a.value)}" ${uxAns(q) === a.value ? "checked" : ""}> ${esc(a.label)}${state.uxDefaults && state.uxDefaults.answers[q.id] === a.value ? " (default)" : ""}</label>`).join("")}</div></li>`;
  }
  function uxLabelsHtml(st) {
    const labs = st ? UX11.labelsOf(st.llm) : [];
    if (!labs.length) return "";
    const by = {}; labs.forEach(f => (by[f.kind] = by[f.kind] || []).push(f));
    return `<div class="card ux-labels" id="ux-labels"><h3>Labeled for follow-up on the board (${labs.length})</h3>
      <p class="small">Nothing to decide now. These go on the board with a label and the meeting's words, so whoever picks them up can settle them.</p>
      ${Object.entries(by).map(([k, fs]) => `<h4>${esc(UX11.LABELS[k])} (${fs.length})</h4><ul class="ux-list">${fs.map(f => `<li>${esc(uxPlain(f.note.replace(/^[^:]+: /, "")))}</li>`).join("")}</ul>`).join("")}</div>`;
  }
  function uxOverridesHtml(m, ch, p) {
    if (!m.questions.length) return "";
    return `<details class="ux-over"${p === "r" ? " open" : ""}><summary>Change how something is placed (optional, ${m.questions.length})</summary>
      <p class="small">Each item already has a sensible default, shown selected. Change one only if you know the meeting.</p>
      <ul class="ux-list">${m.questions.map((q, k) => uxQHtml(q, k, ch, p)).join("")}</ul></details>`;
  }
  function uxUserHtml(m, ch) {
    if (m.replyBlocked) return `<div class="banner bad">The chat's reply can't be used yet: ${esc(uxPlain(m.replyReasons.join(" ")))} Send it the fix request with the button at the top of this page.</div>`;
    const st = uxSettle(), nC = m.changes.length, nL = st ? UX11.labelsOf(st.llm).length : 0;
    return `<div class="banner ok">The chat's reply checks out: ${nC} change${nC === 1 ? "" : "s"} to your board.${nL ? ` ${nL} item${nL === 1 ? " is" : "s are"} labeled for follow-up.` : ""} Nothing needs deciding now.</div>
      ${uxLabelsHtml(st)}
      ${uxOverridesHtml(m, ch, "u")}
      <h3>Changes to your board (${nC})</h3><p class="small">Untick Keep to leave one out.</p><ul class="ux-list">${m.changes.map(c => uxChangeHtml(c, ch)).join("")}</ul>
      ${m.openItems.length ? `<h3>Open items (${m.openItems.length})</h3><p class="small">These stay on the board as open items. Nothing to answer here.</p><ul class="ux-list">${m.openItems.map(o => `<li><strong>${esc(UX_FLAG[o.kind] || "Open item")}:</strong> ${esc(uxPlain(o.note))}</li>`).join("")}</ul>` : ""}
      ${m.records.length ? `<p class="small">${m.records.length} note${m.records.length === 1 ? " about the chat's reply is" : "s about the chat's reply are"} kept with the meeting for the reviewer (Reviewer details).</p>` : ""}
      <div class="actions"><button class="btn primary" data-ux-accept>Update the board</button><span class="small">${esc(uxNeedText(m, ch))}</span></div>`;
  }
  function uxDecisionsHtml(m, ch) {
    const placed = m.changes.filter(c => c.blocks.length);
    return `<div class="card"><h3>Placements for this meeting</h3><p class="small" style="margin-top:0">User mode shows the same placements; both views accept the same package. ${esc(uxNeedText(m, ch))}</p>
      ${m.replyBlocked ? `<p class="small">${esc(uxPlain(m.replyReasons.join(" ")))}</p>` : ""}
      ${placed.length ? `<h4>Changes placed by default (${placed.length})</h4><ul class="ux-list">${placed.map(c => uxChangeHtml(c, ch)).join("")}</ul>` : ""}
      ${uxOverridesHtml(m, ch, "r")}
      ${m.replyBlocked ? "" : uxLabelsHtml(uxSettle())}
      ${!placed.length && !m.questions.length ? `<p class="small">Nothing to place.</p>` : ""}</div>`;
  }
  // The full results stay where they are (shown in Reviewer details, hidden in user mode); the user-mode panel is
  // added last and the shared decisions just before Accept.
  function uxDecorate(el) {
    el.classList.remove("ux-decorated");
    if (!state.prepared || state.prepared.kind !== "transcript" || !state.uxModel) return;
    el.classList.add("ux-decorated");
    const user = document.createElement("div"); user.className = "um-only um-result"; user.id = "um-result";
    el.appendChild(user);
    const shared = document.createElement("div"); shared.className = "ux-decisions"; shared.id = "ux-decisions";
    const acc = el.querySelector("[data-accept]"), actions = acc ? acc.closest(".actions") : null;
    if (actions) actions.parentNode.insertBefore(shared, actions); else el.insertBefore(shared, user);
    const card = [...el.querySelectorAll(".card")].find(c => /^Proposed changes/.test(((c.querySelector("h3") || {}).textContent) || ""));
    const ul = card ? card.querySelector("ul.revlist") : null;
    if (ul) [...ul.children].forEach((li, i) => { const box = document.createElement("label"); box.className = "small ux-keep"; box.innerHTML = `<input type="checkbox" data-ux-keep="${i}" checked> Keep`; li.insertBefore(box, li.firstChild); });
    uxRefresh();
  }
  function uxRefresh() {
    const el = $("import-out"), m = state.uxModel, ch = state.uxChoices;
    if (el && m && ch) {
      const u = el.querySelector("#um-result"); if (u) u.innerHTML = uxUserHtml(m, ch);
      const r = el.querySelector("#ux-decisions"); if (r) r.innerHTML = uxDecisionsHtml(m, ch);
      el.querySelectorAll(".revlist [data-ux-keep]").forEach(x => { x.checked = !ch.drop.includes(+x.dataset.uxKeep); });
      const acc = el.querySelector("[data-accept]");
      if (acc && !(state.uxComp && state.uxComp.errors)) acc.disabled = !UX11.readiness(m, ch).ok;
    }
    uxRenderNext();
  }
  $("import-out").addEventListener("change", ev => {
    const t = ev.target, ch = state.uxChoices; if (!ch || !state.uxModel || !t.dataset) return;
    if (t.dataset.uxKeep != null) { const i = +t.dataset.uxKeep; ch.drop = ch.drop.filter(x => x !== i); ch.undate = ch.undate.filter(x => x !== i); if (!t.checked) ch.drop.push(i); uxRefresh(); }
    else if (t.dataset.uxQ) { ch.answers[t.dataset.uxQ] = t.value; uxRefresh(); }
  });
  $("import-out").addEventListener("click", ev => {
    const b = ev.target && ev.target.closest ? ev.target.closest("[data-ux-drop],[data-ux-undate],[data-ux-undo],[data-ux-accept]") : null;
    const ch = state.uxChoices; if (!b || !ch) return;
    if (b.dataset.uxDrop != null) { const i = +b.dataset.uxDrop; ch.undate = ch.undate.filter(x => x !== i); if (!ch.drop.includes(i)) ch.drop.push(i); uxRefresh(); }
    else if (b.dataset.uxUndate != null) { const i = +b.dataset.uxUndate; ch.drop = ch.drop.filter(x => x !== i); if (!ch.undate.includes(i)) ch.undate.push(i); uxRefresh(); }
    else if (b.dataset.uxUndo != null) { const i = +b.dataset.uxUndo; ch.drop = ch.drop.filter(x => x !== i); ch.undate = ch.undate.filter(x => x !== i); uxRefresh(); }
    else if (b.hasAttribute("data-ux-accept")) { const a = $("import-out").querySelector("[data-accept]"); if (a) { a.disabled = false; a.click(); } }
  });

  // D-UX11c: one next action at a time.
  async function uxCopyText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch (e) {}
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) {} ta.remove();
  }
  async function uxCopyChat() {
    if (!state.prepared || !$("chat-text")) return;
    await uxCopyText($("chat-text").value); state.uxCopied = state.prepared.token; state.uxAwaitRepair = false;
    toast("Copied. Paste it into a new chat, then paste the chat's whole reply into the reply box."); uxRenderNext();
  }
  async function uxCopyRepair() {
    const m = state.prepared; if (!m || !state.uxComp) return;
    if (!state.repair || state.repair.token !== m.token) state.repair = { token:m.token, n:0 };
    if (state.repair.n >= 2) return uxRenderNext();
    await uxCopyText(buildRepairPrompt(state.uxComp)); state.repair.n++; state.uxAwaitRepair = true;
    toast(`Fix request copied (${state.repair.n} of 2). Paste it into the same chat, then paste the chat's corrected reply into the reply box.`); uxRenderNext();
  }
  function uxRenderNext() {
    // The reply box is cleared by code after Accept (no input event): measure the next paste from what is there now.
    if ($("llm-in")) uxLastLen = $("llm-in").value.length;
    const el = $("um-next"); if (!el) return;
    if (uxRD()) { el.innerHTML = ""; return; }
    const t = $("transcript").value.trim(), m = state.prepared;
    const comp = state.uxComp && state.compiled ? state.uxComp : null;
    let msg, btn = null, act = null, extra = "";
    if (!state.packages.length) msg = "First load your board: Open files, or Load sample baseline, at the top of the page.";
    else if (!t) { msg = "Paste the meeting transcript into the box below, or open the Teams .docx."; btn = "Open Teams .docx"; act = () => $("t-file").click(); }
    else if (!$("m-date").value) msg = "Set the meeting date below.";
    else if (!m || m.kind !== "transcript" || state.lastNumbered !== t || prepStaleFields()) msg = "Getting the request for the chat ready…";
    else if (state.uxAwaitRepair) { msg = "Paste the chat's corrected reply into the reply box below."; btn = "Go to the reply box"; act = () => $("llm-in").focus(); }
    else if (!comp) {
      if (state.uxCopied !== m.token) { msg = `The request for the chat is ready (${m.segments.length} statements, ${fmtLong(m.date)}). Copy it into a new chat.`; btn = "Copy for the chat"; act = uxCopyChat; }
      else { msg = "Paste the chat's whole reply into the reply box below."; btn = "Go to the reply box"; act = () => $("llm-in").focus(); extra = `<button class="btn" id="um-recopy">Copy the request again</button>`; }
    } else {
      const mod = state.uxModel, rep = buildRepairPrompt(comp), used = state.repair && state.repair.token === m.token ? state.repair.n : 0;
      if (mod && mod.replyBlocked) {
        if (rep && used < 2) { msg = "The chat's reply can't be used yet."; btn = `Copy the fix request (${used + 1} of 2)`; act = uxCopyRepair; }
        else { msg = "The chat's reply can't be used, and both correction rounds are used. Start again in a new chat."; btn = "Copy the request again"; act = uxCopyChat; }
      } else if (rep && used < 2 && !state.uxSkipRepair) {
        msg = `The chat needs one more pass (${used + 1} of 2).`; btn = "Copy the fix request"; act = uxCopyRepair;
        extra = `<button class="btn" id="um-skip">Review the changes instead</button>`;
      } else if (mod) {
        const st = uxSettle(), nL = st ? UX11.labelsOf(st.llm).length : 0;
        msg = `Review the changes below, then update the board.${nL ? ` ${nL} item${nL === 1 ? " is" : "s are"} labeled for follow-up; nothing needs deciding now.` : ""}`;
        btn = "Update the board"; act = () => { const a = $("import-out").querySelector("[data-ux-accept]"); if (a && !a.disabled) a.click(); else if ($("um-result")) $("um-result").scrollIntoView({ block:"start" }); };
      } else msg = "Review the reply below.";
    }
    el.innerHTML = `<p class="um-msg">${esc(msg)}</p>${btn ? `<div class="actions"><button class="btn primary" id="um-primary">${esc(btn)}</button>${extra}</div>` : ""}`;
    if ($("um-primary")) $("um-primary").addEventListener("click", act);
    if ($("um-recopy")) $("um-recopy").addEventListener("click", uxCopyChat);
    if ($("um-skip")) $("um-skip").addEventListener("click", () => { state.uxSkipRepair = true; uxRenderNext(); if ($("um-result")) $("um-result").scrollIntoView({ block:"start" }); });
  }

  // D-UX11b: the meeting goes in in one step (user mode). The offset follows the browser's time zone for the meeting
  // date unless the person picked one; numbering runs once a transcript and a date are present.
  var uxOffsetManual = false, uxAutoT = null, uxLastLen = 0;
  $("m-offset").addEventListener("change", ev => { if (ev.isTrusted) uxOffsetManual = true; });
  function uxAutoOffset() {
    if (uxRD() || uxOffsetManual || !$("m-date").value) return;
    const mins = -new Date($("m-date").value + "T12:00:00").getTimezoneOffset();
    const s = (mins < 0 ? "-" : "+") + String(Math.floor(Math.abs(mins) / 60)).padStart(2, "0") + ":" + String(Math.abs(mins) % 60).padStart(2, "0");
    const sel = $("m-offset"); if ([...sel.options].some(o => o.value === s)) sel.value = s;
  }
  function uxAuto() {
    if (uxRD()) return;
    clearTimeout(uxAutoT);
    uxAutoT = setTimeout(() => {
      const t = $("transcript").value.trim();
      if (t && $("m-date").value && state.packages.length && (!state.prepared || state.prepared.kind !== "transcript" || state.lastNumbered !== t || prepStaleFields())) $("do-segment").click();
      uxRenderNext();
    }, 600);
  }
  function uxAfterDocx() { uxAutoOffset(); uxAuto(); }
  function uxAfterSample() { uxOffsetManual = true; uxAuto(); }
  $("m-date").addEventListener("input", uxAutoOffset); $("m-date").addEventListener("change", uxAutoOffset);
  ["transcript", "m-date", "m-time", "m-offset", "m-title"].forEach(id => { $(id).addEventListener("input", uxAuto); $(id).addEventListener("change", uxAuto); });
  // D-UX11c: validation runs on paste (user mode). A paste shows up as one large input.
  $("llm-in").addEventListener("input", () => {
    const n = $("llm-in").value.length, jump = n - uxLastLen; uxLastLen = n;
    if (!uxRD() && jump > 200) setTimeout(() => $("do-validate").click(), 0);
  });
  $("rd-toggle").addEventListener("change", e => uxSetRD(e.target.checked));
  uxApplyMode();
