"""Draft the PM's meeting email from a slim reply (docs/mkg-v2-plan.md §5.3), in the PM's own format: the v1 email's
seven sections, and the leadership email in the PM's own format, both unchanged: v2 changes the import, not the reports.
Only items whose source checks (verified or near) are used; the rest are listed at the end under "To check".
This is a mock-up for the desirability check, not product code.
Usage: python3 render_reports.py golden-reply.json        (or a run: runs/B2.txt)
Writes <name>.team-email.txt and <name>.leadership.txt next to the input."""
import os, sys
import check_reply as cr

TITLE, DATE, PROJECT = 'Harbor Point reopening kickoff', 'Monday, Oct 19, 2026', 'Harbor Point reopening'
name = lambda who: ' '.join(reversed(who.split(', '))) if who else None


def timing(it): return f'Timing: “{it["due"]}”.' if it.get('due') else 'No due date stated.'


def render(path):
    segs, K, tokA, tokB = cr.setup()
    reply = cr.extract(open(path, encoding='utf-8').read())
    items, _ = cr.to_items(reply)
    ok, check = [], []
    for it in items:
        st, _ = cr.verify(it, segs)
        (ok if st in ('verified', 'near') else check).append(it)
    of = lambda kind: [i for i in ok if i['kind'] == kind]
    # New actions get board IDs on accept; the draft numbers them in meeting order.
    actions = sorted(of('commitment'), key=lambda i: cr.segnum(i['seg']) if i.get('seg') in segs else 0)
    for n, a in enumerate(actions): a['id'] = f'AI-{101 + n}'
    owners = {}
    for a in actions:
        if a.get('who'): owners.setdefault(name(a['who']), []).append(a['id'])
    unowned = [a for a in actions if not a.get('who')]

    took = '; '.join(f'{p} took on {len(ids)} new action{"s" if len(ids) > 1 else ""} ({", ".join(ids)})' for p, ids in owners.items())
    summary = [f'The {TITLE} on {DATE} convened. On {PROJECT}: {took}.']
    if unowned: summary.append(' '.join(f'“{a["what"]}” ({a["id"]}) has no owner yet.' for a in unowned))
    if of('decision'): summary.append('Decided: ' + '; '.join(d['what'] for d in of('decision')) + '.')
    if of('update'): summary.append('Also reported: ' + '; '.join(u['what'] for u in of('update')) + '.')
    if of('question'): summary.append('Still open: ' + '; '.join(q['what'] for q in of('question')) + '.')
    nxt = [a for a in actions if a.get('importance') == 'high']
    if nxt: summary.append('Next up: ' + '; '.join(f'“{a["what"]}” ({a["id"]}), {name(a.get("who")) or "no owner"}, “{a["due"]}”' if a.get('due')
                                                 else f'“{a["what"]}” ({a["id"]}), {name(a.get("who")) or "no owner"}' for a in nxt) + '.')

    out = ['1. Meeting Overview', '', f'Meeting Name: {TITLE}', '', f'Date: {DATE}', '', f'Projects covered: {PROJECT}', '',
           '2. Executive Summary', '', ' '.join(summary), '', '3. New actions from this meeting', '', 'Effort\tDetail']
    for a in actions:
        owner = f'Owner: {name(a["who"])}.' if a.get('who') else 'Owner: none named — unassigned.'
        out.append(f'{a["id"]} {a["what"]}\t{owner} Status: Open. {timing(a)}')
    out += ['', '4. Existing items updated or referenced this meeting', '',
            'None: this is the first meeting, so the board had no existing items to update.', '',
            '5. Existing open items not discussed', '', 'None: this is the first meeting.', '',
            '6. Risks, dependencies and open questions', '']
    for r in of('risk'): out += [f'Risk: {r["what"]}', '']
    for q in of('question'): out += [f'Open question: {q["what"]}', '']
    nq, nr = len(of('question')), len(of('risk'))
    out += ['7. Conclusion', '', f'{len(actions)} new actions came out of this meeting' +
            (f'; {len(unowned)} still need{"s" if len(unowned) == 1 else ""} an owner' if unowned else '') +
            f'. The board has been updated with the accepted actions. {nq} open questions and {nr} risks remain visible for follow-up.']
    # The leadership email (the PM's format) is built from the board after this meeting. On a seed meeting the board is
    # this meeting's actions, so nothing is overdue, waiting or undiscussed yet.
    P, who = PROJECT, lambda a: name(a.get('who')) or 'Unassigned'
    lead = ['Team,', '', ' '.join(summary), '',
            f'{P}: ' + ', and '.join(f'new work: “{a["what"]}” ({who(a)})' for a in actions) + '.', 'Key developments:', '']
    lead += [f'{P}: {u["what"]}' for u in of('update')]
    lead += [f'{P}: {a["what"]}: no one in the meeting took it on yet.' for a in unowned]
    lead += ['', 'Decisions', ''] + ([f'{P}: {d["what"]}' for d in of('decision')] or ['None this week.'])
    lead += ['', 'Management attention/risks', '']
    lead += [f'{P}: {r["what"]}' for r in of('risk')]
    lead += [f'{P}: {a["id"]} “{a["what"]}” has no accountable owner' for a in unowned]
    lead += ['', 'Near-term next steps', '']
    lead += [f'{P}: {a["due"]}: “{a["what"]}” ({who(a)})' for a in actions if a.get('due')]
    lead += [f'{P}: new: “{a["what"]}” ({who(a)})' for a in actions if not a.get('due')]
    lead += ['', 'Project task status and accountable owners', '', 'Project\tCurrent/Overdue work\tStatus\tOwner']
    lead += [f'{P}\t{a["id"]} {a["what"]}\tOpen' + (f', due “{a["due"]}”' if a.get('due') else '') + f'\t{who(a)}' for a in actions]
    tail = []
    if check:
        tail = ['', '---', 'To check before sending (their source could not be confirmed in the transcript):'] + \
               [f'- {i.get("seg")} {i["kind"]}: {i.get("what")}' for i in check]
    base = os.path.splitext(path)[0]
    for suffix, lines in (('.team-email.txt', out), ('.leadership.txt', lead)):
        open(base + suffix, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines + tail) + '\n')
        print('wrote', base + suffix)


if __name__ == '__main__':
    for p in sys.argv[1:]: render(p)
