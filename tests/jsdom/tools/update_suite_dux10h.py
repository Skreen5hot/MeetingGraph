"""D-UX10h by-design assertion change (2026-10-12): rule 2 now says a commitment "with the same completion condition as"
an existing ACTIVE tasking is an update (the testers' ratified wording replaced "whose subject matches"). F22's intent,
that rule 2 covers all four active statuses, is unchanged. Exact-count edit; run once on suite_dux10."""
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
ESC = chr(92) + "u2014"  # the six characters backslash-u-2-0-1-4, as written in the JS regex
old = r"/matches an existing ACTIVE tasking " + ESC + r" open, open \(unreported\), in_progress, or blocked " + ESC + r" is an UPDATE/"
new = r"/with the same completion condition as an existing ACTIVE tasking " + ESC + r" open, open \(unreported\), in_progress, or blocked " + ESC + r" is an UPDATE/"
assert s.count(old) == 1, s.count(old)
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
print('F22 updated')
