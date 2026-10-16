  /* ---------------- §16.16 Open items answered in meetings (ratified for build 2026-10-14) ----------------
     The request lists the board's open items; the import review shows the meeting's answers to them as proposed
     closures. A reviewer ticks "Close this item" to close one (Aaron's condition 1); unticked, or partial, the item
     stays open and shows the answer. Closing and the meeting's own changes are separate. */
  function oiOpenList(S, meetingAt, excludeId) {
    const its = resItems(S, { meeting:{ meetingAt }, excludeId }).filter(it => it.status !== "resolved");
    return OI.listFor(its, { fmtDate });
  }
  const oiSpeaker = id => (((state.prepared && state.prepared.segments) || []).find(x => x.id === id) || {}).speakerName || "";
  function oiReviewHtml(p) {
    const o = state.oi; if (!o || (!o.kept.length && !o.dropped.length)) return "";
    const li = a => `<li class="oi-ans"><div class="oi-qtext"><span class="res-k">Open item</span> ${esc(a.question)}</div>
      <div>Proposed answer: <b>${esc(a.answer)}</b>${a.status === "partial" ? ` <span class="pill">partial</span>` : ""}</div>
      <blockquote class="lbl-q">“${esc(a.quote)}”<div class="sub">${esc(oiSpeaker(a.seg))} (${esc(a.seg)})</div></blockquote>
      ${a.status === "answered"
        ? `<label class="chk"><input type="checkbox" data-oi-close="${esc(a.item)}"${o.close.has(a.item) ? " checked" : ""}> Close this item</label><div class="sub">Tick only if these words really answer the question. Unticked, the item stays open and shows this answer.</div>`
        : `<div class="sub">Partly answered: the item stays open and shows this answer on the board.</div>`}</li>`;
    return `<div class="card oi-review" data-oi-view="${p}"><h3>Answers to open items (${o.kept.length})</h3>
      <p class="small">The meeting answered these open items from earlier meetings. Closing one is your decision: the chat's link is only a proposal. The meeting's changes are kept or left out separately.</p>
      ${o.kept.length ? `<ul class="ux-list">${o.kept.map(li).join("")}</ul>` : ""}
      ${o.close.size ? `<label class="oi-namel">Your name (recorded as confirming ${o.close.size === 1 ? "this closure" : `these ${o.close.size} closures`}) <input class="oi-name" value="${esc(o.name || "")}"></label>` : ""}
      ${o.dropped.length ? `<details class="oi-dropped"><summary>Answers not used (${o.dropped.length})</summary><ul class="ux-list">${o.dropped.map(d => `<li>${esc(d.question || d.item)}${d.answer ? `: ${esc(d.answer)}` : ""} <span class="sub">Not used: ${esc(d.why)}. The item stays open.</span></li>`).join("")}</ul></details>` : ""}</div>`;
  }
  // The reply's answers, checked against the open items the request sent (state.prepared.openItems).
  function oiOnValidated(llm) {
    const m = state.prepared;
    if (!m || m.kind !== "transcript" || !(m.openItems || []).length || !llm || !Array.isArray(llm.answers) || !llm.answers.length) { state.oi = null; return; }
    const S = foldPackages(state.packages.filter(p => p.meeting.id !== utcKey(m.meetingAt)));
    let nm = ""; try { nm = localStorage.getItem(RES_NAME) || ""; } catch (e) {}
    const prev = state.oi && state.oi.token === m.token ? state.oi : null;
    const r = OI.check(llm, { list:m.openItems, segments:m.segments, people:Object.keys(S.parties) });
    state.oi = { ...r, token:m.token, name:prev ? prev.name : nm, close:new Set(prev ? [...prev.close].filter(k => r.kept.some(a => a.item === k && a.status === "answered")) : []) };
  }
  // The package's record of the answers: every kept answer, and for a closed one who confirmed it and when.
  function oiPackageAnswers() {
    const o = state.oi; if (!o || !o.kept.length) return { answers:null };
    const nm = String(o.name || "").trim();
    if (o.close.size && !nm) return { error:"Enter your name under Answers to open items: closing an item is recorded in your name." };
    if (nm) try { localStorage.setItem(RES_NAME, nm); } catch (e) {}
    const at = new Date().toISOString();
    const heads = key => { const it = state.boardLabels && state.boardLabels.byKey[key]; return it && it.res ? it.res.heads.map(r => r.id) : []; };
    return { answers:o.kept.map(a => { const closed = a.status === "answered" && o.close.has(a.item);
      return { item:a.item, seg:a.seg, quote:a.quote, speaker:oiSpeaker(a.seg), answer:a.answer, status:a.status, question:a.question, needed:a.needed,
        qkind:a.qkind, target:a.target, ...(a.match ? { match:a.match } : {}), closed,
        ...(closed ? { confirmedBy:nm, confirmedAt:at, supersedes:heads(a.item) } : {}) }; }) };
  }
  document.addEventListener("change", ev => {
    const t = ev.target; if (!t || !t.dataset || t.dataset.oiClose == null || !state.oi) return;
    if (t.checked) state.oi.close.add(t.dataset.oiClose); else state.oi.close.delete(t.dataset.oiClose);
    uxRefresh();
  });
  document.addEventListener("input", ev => {
    const t = ev.target; if (!t || !t.classList || !t.classList.contains("oi-name") || !state.oi) return;
    state.oi.name = t.value;
    document.querySelectorAll(".oi-name").forEach(x => { if (x !== t) x.value = t.value; });
  });
  window.MKG_oi = () => state.oi;
