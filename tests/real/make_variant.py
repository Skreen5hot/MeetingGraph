"""Make a test variant of a request the page wrote (plan §10.15). One change per variant, so a result can be traced to it.
  G  drops "fewer, clearer items are better" (the recall test on the first real meeting; failed, plan §10.15)
  I  two edits aimed at the two items the runs dropped (plan §10.16): a recommendation the group accepts is a decision,
     and dates, travel and schedules are kept, not left out as housekeeping
The context token is left as it is (it depends only on the meeting and the open threads), so the page still accepts the
reply: paste the variant into a new chat, then paste its reply into the page as usual.
Usage: python3 make_variant.py G request.txt [out.txt]     (request.txt: the page's request, copied into a file)
       python3 make_variant.py --selftest"""
import os, sys

VARIANTS = {
    'G': [("; fewer, clearer items are better.", ".")],
    'I': [('''("let's do", "we're going with", "that's the decision"). Options discussed''',
           '''("let's do", "we're going with", "that's the decision"), including a recommendation the group accepts ("that works", "let's go with that"). Options discussed'''),
          ('technical difficulties and arranging this meeting itself.',
           'technical difficulties and arranging this meeting itself, but keep what affects the work: dates, travel and schedule changes or confirmations are updates.')],
}


def make(variant, text):
    """The request with the variant's change, or ValueError if the text is not a request the change fits."""
    out = text
    for old, new in VARIANTS[variant]:
        n = out.count(old)
        if n != 1: raise ValueError(f'variant {variant}: expected the phrase {old!r} once, found it {n} times; is this a request from the page?')
        out = out.replace(old, new)
    return out


def selftest():
    here = os.path.dirname(os.path.abspath(__file__))
    kit = os.path.join(here, '..', 'v2-feasibility')
    ok = []
    def check(name, cond):
        ok.append(cond); print(('OK   ' if cond else 'FAIL ') + name)
    for f, cap in (('request-D-lines.txt', 'At most 40 items.'), ('request-F-followup.txt', 'At most 60 items.')):
        src = open(os.path.join(kit, f), encoding='utf-8').read()
        g = make('G', src)
        check(f'G on {f}: the phrase is gone and the cap stays ("{cap}")', 'fewer, clearer' not in g and cap in g)
        check(f'G on {f}: only that phrase changed (same length less 33 characters, same token line)',
              len(src) - len(g) == len('; fewer, clearer items are better') and src.splitlines()[0] == g.splitlines()[0])
    for f in ('request-D-lines.txt', 'request-F-followup.txt'):
        src = open(os.path.join(kit, f), encoding='utf-8').read()
        i = make('I', src)
        check(f'I on {f}: both edits made, the token line unchanged, and "fewer, clearer" kept',
              'including a recommendation the group accepts' in i and 'dates, travel and schedule changes or confirmations are updates' in i
              and src.splitlines()[0] == i.splitlines()[0] and 'fewer, clearer items are better' in i)
    try: make('G', 'not a request'); check('a text that is not a request is refused, with a plain message', False)
    except ValueError: check('a text that is not a request is refused, with a plain message', True)
    print(f'{sum(ok)}/{len(ok)} make_variant checks ' + ('ALL GREEN' if all(ok) else 'FAILED'))
    return all(ok)


if __name__ == '__main__':
    if '--selftest' in sys.argv: sys.exit(0 if selftest() else 1)
    if len(sys.argv) < 3 or sys.argv[1] not in VARIANTS: sys.exit(__doc__)
    text = open(sys.argv[2], encoding='utf-8').read()
    try: out = make(sys.argv[1], text)
    except ValueError as e: sys.exit(str(e))
    dest = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(sys.argv[2])[0] + f'-{sys.argv[1]}.txt'
    open(dest, 'w', encoding='utf-8', newline='\n').write(out)
    print('wrote', dest)
