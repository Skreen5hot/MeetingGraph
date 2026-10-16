"""Knockouts for t37: each mutation of the build must make the named checks fail."""
import subprocess, sys, os, re
SRC = sys.argv[1]; s = open(SRC, encoding='utf-8').read()
K = [
  ('stale check off', 'const st = RES.stale(resPending, resAll());', 'const st = [];', ['t37.40']),
  ('validator refusals ignored at Add', 'if (!dry.errors) return null;', 'return null;', ['t37.12']),
  ('old-meeting NEW-ref match off', 'for (const sg of segs) { const hits', 'for (const sg of []) { const hits', ['t37.01']),
  ('identity checks off', 'const m = RES.checkPerson({ ...st, note }, resPeople()); if (m) return p + m;', 'const m = null;', ['t37.08', 't37.09', 't37.10']),
  ('resolved items stay in open views', '      if (it.status === "resolved") {', '      if (false) {', ['t37.29', 't37.30']),
  ('conflicts read as last-save-wins', "const current = heads.length === 1 ? heads[0] : null;\n    out[k] = { key: k, all: rs, heads, current, conflict: heads.length > 1,\n      status: heads.length > 1 ? 'conflict' :", "const current = heads[heads.length - 1] || null;\n    out[k] = { key: k, all: rs, heads, current, conflict: heads.length > 1,\n      status: false ? 'conflict' :", ['t37.44']),
  ('re-import uses a quote key', "return seg ? `${meetingId}|${seg}|${kind}|${target}`", "return false ? ``", ['t37.23']),
  ('same-moment file replaces the earlier one', 'if (existing.meeting.resolutions || p.meeting.resolutions) {', 'if (false) {', ['t37.48']),
  ('origin hidden (back to "Meeting")', 'return `${from} \\u2014 no project or task named`;', 'return "Meeting";', ['t37.60']),
  ('match offered when no name', "if (kind === 'ambiguous_reference') return topic && !topic.person && !topic.known ? 'answer' : 'match_person';", "if (kind === 'ambiguous_reference') return 'match_person';", ['t37.62']),
  ('a decision after attaching does not replace it', 'supersedes:follows.map(r => r.id)', 'supersedes:sup.map(r => r.id)', ['t37.67']),
  ('person topic not read', 'const off = cands.find(n => n.includes(" ") && !findParty(S, n))', 'const off = cands.find(n => false)', ['t37.70']),
  ('step references not written out', 'st[f] = f === "task" ? src.code : src.partyId;', 'st[f] = st[f];', ['t37.80']),
  ('a refused step does not refuse the decision', 'const m = RES.checkPerson({ ...st, note }, resPeople()); if (m) return p + m;', 'const m = RES.checkPerson({ ...st, note }, resPeople()); if (m) {}', ['t37.76']),
  ('attendees not matched by email', 'if (e) { const hit = Object.values(S.parties).find(p => (p.emails || []).includes(e)); if (hit) return hit.id; }', '', ['t37.103']),
  ('attendee key ignores email', "const id = a && a.email ? String(a.email).trim().toLowerCase() : 'n:' + norm(a && a.name);", "const id = 'n:' + norm(a && a.name);", ['t37.95']),
  ('no attendee hint for a first name', 'if (it.refName && !it.refName.includes(" ")) {', 'if (false) {', ['t37.92']),
  ('project does not limit tasks', '&& (!proj || t.project === proj))', ')', ['t37.110']),
  ('picking a task does not set its project', 'if (t.dataset.f === "task" && tt) st.project = tt.project;', '', ['t37.112']),
  ('§16.15 evidence open by default', '<details class="lbl-ev">', '<details class="lbl-ev" open>', ['t37.120']),
  ('§16.15 date labels get Set date', "if (kind === 'possible_status_change') return 'confirm_status';", "if (kind === 'possible_status_change') return 'confirm_status'; if (kind === 'implied_change') return 'set_date';", ['t37.121']),
  ('§16.15 Answer guesses Date', 'if (action === "answer") return resAnswerForm(it, "text", false, null, []);', 'if (action === "answer") return resAnswerForm(it, "date", false, null, []);', ['t37.122']),
  ('§16.15 a range becomes a deadline', 'box.disabled = !!why; if (why) box.checked = false;', 'box.disabled = false;', ['t37.124']),
  ('§16.15 More resolves', 'RES.primaryFor(it.kind, it.topic) === action ? "settle" : "open"', '"settle"', ['t37.82']),
  ('§16.15 changes pre-ticked', '<input type="checkbox" data-also="${k}">', '<input type="checkbox" data-also="${k}" checked>', ['t37.123']),
  ('§16.15 kept-open answer may change records', 'if (keep && ticked.length) return err(', 'if (false) return err(', ['t37.135']),
  ('§16.15 no extra steps', 'if (t.hasAttribute("data-res-addstep") && t.value) {', 'if (false) {', ['t37.136']),
  ('form fields unreadable in dark mode', '.res-f input:not([type=checkbox]):not([type=radio]),.res-f select,.res-f textarea,#res-tray input{background:var(--surface);color:var(--ink);', '.res-f input:not([type=checkbox]):not([type=radio]),.res-f select,.res-f textarea,#res-tray input{background:#fff;', ['t37.137']),
]
# The section holding each knockout's named check, so the run reaches it.
SECTION = {'stale check off': 'b', 'validator refusals ignored at Add': 'a', 'old-meeting NEW-ref match off': 'a', 'identity checks off': 'a',
  'resolved items stay in open views': 'a', 'conflicts read as last-save-wins': 'b', 'person topic not read': 'e', 'a refused step does not refuse the decision': 'e',
  '§16.15 date labels get Set date': 'ah', '§16.15 Answer guesses Date': 'h', '§16.15 a range becomes a deadline': 'h', '§16.15 More resolves': 'e', '§16.15 no extra steps': 'e', 'form fields unreadable in dark mode': 'h'}
bad = 0
if os.environ.get('KN'): K = [k for k in K if any(x in k[0] for x in os.environ['KN'].split('|'))]
for name, old, new, expect in K:
    n = s.count(old)
    if n != 1: print('SETUP', name, n); bad += 1; continue
    p = f'/tmp/claude-0/sp/knock.html'; open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    env = dict(os.environ, T37_ONLY=SECTION.get(name, ''))
    out = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 't37_phase2.py'), p], capture_output=True, text=True, timeout=1200, env=env).stdout
    failed = set(re.findall(r'^FAIL (t37\.\d+)', out, re.M)) | ({'crash'} if 'passed' not in out.splitlines()[-1] or re.search(r'^FAIL t37[a-h] section crashed', out, re.M) else set())
    # A knockout counts only when its named check fails (a crash alone is not enough).
    ok = all(e in failed for e in expect)
    crash = re.findall(r'^FAIL (t37[a-h] section crashed.*)$', out, re.M)
    print(('KILLED ' if ok else 'SURVIVED ') + name + f'  (failed: {sorted(failed)})' + (f'  [{crash[0][:160]}]' if crash and not ok else ''))
    bad += not ok
print('all knockouts killed' if not bad else f'{bad} knockout(s) survived'); sys.exit(1 if bad else 0)
