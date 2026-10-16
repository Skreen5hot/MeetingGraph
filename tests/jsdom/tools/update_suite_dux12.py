"""D-UX12 email changes (Aaron's review, 2026-10-13), by design: open questions name the task instead of a bare code,
"Ownership open" reads "No owner yet", and the conclusion gives a count instead of repeating the new-actions table.
Usage: python3 update_suite_dux12.py <suite dir>. Every edit asserts its exact match count."""
import sys, os
D = sys.argv[1]
def edit(f, a, b):
    p = os.path.join(D, f); s = open(p, encoding='utf-8').read()
    assert s.count(a) == 1, (f, a[:70], s.count(a)); open(p, 'w', encoding='utf-8').write(s.replace(a, b))
edit('t21test.js', r"/Ownership open \(AI-203\)/.test(T)", r"/No owner yet \(AI-203 /.test(T)")
edit('msumtest.js', r"/Next steps include AI-404/.test(T), /register has been updated/.test(T)", r"/new actions? came out of this meeting/.test(T), /project board has been updated/.test(T)")
edit('msumtest.js', r"/Overdue item \(AI-303\)/.test(T)", r"/Overdue item \(AI-303 /.test(T)")
print('updated')

# Testers' review (2026-10-13), Aaron's ruling: the meeting email opens on the recipient copy. Suites that check the
# reviewer copy switch it on first; t25 checks the new default.
RD = "if($('msum-trace')&&!$('msum-trace').checked){$('msum-trace').checked=true;$('msum-trace').dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(100);}"
edit('t21test.js', "  $('meeting-report').click(); await sleep(200);", "  $('meeting-report').click(); await sleep(200); " + RD)
edit('t23test.js', "  $('meeting-report').click(); await sleep(250);", "  $('meeting-report').click(); await sleep(250); " + RD)
edit('t25test.js', "  console.log('EMAIL-08 ON: toggle present and checked by default:', !!$('msum-trace') && $('msum-trace').checked);",
     "  console.log('EMAIL-08 toggle present and OFF by default (recipient copy first, Aaron 2026-10-13):', !!$('msum-trace') && !$('msum-trace').checked);\n  " + RD + " T=$('msum-preview').textContent;")
edit('msumtest.js', r"/project board has been updated/.test(T)", r"/board has been updated with the accepted actions and task updates/.test(T)")
print('updated (testers)')
