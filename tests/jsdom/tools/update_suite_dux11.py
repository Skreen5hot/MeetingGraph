"""D-UX11 by-design suite update (2026-10-12). Accept now waits for the meeting's decisions (user-mode plan §3 D-UX11d,
§7; both views share one gate). Suites that accept a reply answer each open question first with the choice that keeps
what the chat proposed (accept the reply without the coverage check / keep / defer), which is the pre-D-UX11 behavior.
Class-A blocks are not answered here: where a suite's reply has one, its assertion is updated separately. Exact-count
edits; run once on suite_dux10."""
import sys, re
HELPER = ("// D-UX11 (2026-10-12): Accept waits for the meeting's decisions; answer each as the chat proposed.\n"
  "const UXA = async el => { const doc = el.ownerDocument || el, out = doc.getElementById('import-out');\n"
  "  for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;\n"
  "    const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;\n"
  "    r.checked = true; r.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); }\n"
  "  return el; };\n")
EDITS = [
  ("d.querySelector('#import-out [data-accept]')", "(await UXA(d)).querySelector('#import-out [data-accept]')"),
  ("$('import-out').querySelector('[data-accept]')", "(await UXA($('import-out'))).querySelector('[data-accept]')"),
  ("out.querySelector('[data-accept]')", "(await UXA(out)).querySelector('[data-accept]')"),
]
for p in sys.argv[1:]:
    s = open(p, encoding='utf-8').read()
    if 'const UXA = ' in s: print('already updated', p); continue
    n = 0
    for old, new in EDITS:
        c = s.count(old); n += c; s = s.replace(old, new)
    assert n > 0, f'{p}: no Accept click found'
    s = HELPER + s
    open(p, 'w', encoding='utf-8').write(s); print(f'{p}: {n} Accept reference(s) now answer the decisions first')
