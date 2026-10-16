"""Copy the MeetingGraph suite and apply the D-UX10 by-design assertion changes (every edit asserts its exact count).
Usage: python3 update_suite_dux10.py <suite_in_dir> <suite_out_dir>"""
import os, shutil, sys
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in os.listdir(src):
    if f.endswith('.js') or f in ('README-tests.md', 'package.json'):
        shutil.copy(os.path.join(src, f), os.path.join(dst, f))
def patch(name, pairs):
    p = os.path.join(dst, name); s = open(p, encoding='utf-8').read()
    for old, new in pairs:
        n = s.count(old); assert n == 1, (name, n, old[:80]); s = s.replace(old, new)
    open(p, 'w', encoding='utf-8').write(s)

# t21: D-UX10c replaced rule 4's decomposition sentence with the completion-condition test.
patch('t21test.js', [(
 """console.log('1. prompt: commitment language + decomposition:', /The speaker of "I will" is the owner/.test(chat), /emit each as its own NewTasking, never one broad task/.test(chat));""",
 """console.log('1. prompt: commitment language + completion-condition test (D-UX10c):', /The speaker of "I will" is the owner/.test(chat), /One tasking per completion condition, judged by how the work gets done/.test(chat) && !/emit each as its own NewTasking, never one broad task/.test(chat));""")])

# t26: "one per LABEL" is gone with that sentence; MATCH-02 ("verb and verb" label) is retired by D-UX10c.
patch('t26test.js', [(
 """console.log('2. prompt: one condition per label + structured open verification:', /one per LABEL/.test(chat), /names BOTH the verification and its contingency/.test(chat));""",
 """console.log('2. prompt: completion-condition test (D-UX10c) + structured open verification:', /Separate deliverables or separate deadlines are separate taskings/.test(chat) && !/one per LABEL/.test(chat), /names BOTH the verification and its contingency/.test(chat));"""),
 ("""  // MATCH-02: compound label warns; contingency form does not""",
  """  // MATCH-02 retired by D-UX10c (2026-10-11): the "verb and verb" warning also caught single completion conditions
  // ("verify the route and confirm which to use"). DELIVERABLES-MERGED / TIMING-MERGED replace it (t31, t34)."""),
 ("""  console.log('MATCH-02 compound label warns:', /two completion conditions means two taskings \\(rule 4\\)/.test(T));""",
  """  console.log('MATCH-02 retired (D-UX10c), no "and" warning:', !/two completion conditions means two taskings/.test(T));""")])

# t27: under D-UX10 the golden decides AI-7 (not_discussed with a reason) and carries selfReview; advisory
# D-UX10 findings appear on the Coverage card as info and are stored with their codes.
patch('t27test.js', [(
 """  console.log('4. the one designed info finding (AI-7 possible match, with its note):', infos.length===1, infos.some(x=>/Possible task match — review required: AI-7/.test(x.textContent) && /needs a human call/.test(x.textContent)));""",
 """  console.log('3b. golden: no repair round (zero repair-required findings, selfReview present):', !out.querySelector('#repair-card'), !/SELF-REVIEW-MISSING/.test(card.textContent));
  const infoCodes=infos.map(x=>(x.closest('li')||{dataset:{}}).dataset.code||'-').sort().join(',');
  console.log('4. designed info findings: AI-7 decided with its reason (D-UX10) + three advisories:', infos.some(x=>/AI-7 .*marked not discussed with a reason/.test(x.textContent) && /nothing was reported on evaluating the alternate configuration/.test(x.textContent)), infoCodes==='-,MATCH-SCOPE-MISFIT,NEW-DUPLICATE,QUOTE-TRUNCATED');"""),
 ("""cv.findings.length===1 && cv.findings[0].resolution==='deferred');""",
  """cv.findings.length===4 && cv.findings.filter(f=>f.resolution==='deferred').length===1, !!cv && cv.findings.some(f=>f.code==='QUOTE-TRUNCATED' && f.repair===false));""")])
print('suite updated in', dst)
