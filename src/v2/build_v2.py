"""Build dist/MeetingGraph2.html (v2, plan §10) from src/v2/page/app.html (v1's screens, §10.22) and the modules in src/v2/modules.
The modules go in verbatim, in dependency order. The output is written with LF line endings on every platform, so the
build is byte for byte the same on Windows and elsewhere. Usage: python3 src/v2/build_v2.py"""
import hashlib, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ORDER = ['transcript.js', 'request.js', 'reply.js', 'store.js', 'dates.js', 'people.js', 'attendance.js', 'export.js', 'interventions.js', 'review.js', 'email.js', 'summary.js', 'seed.js']


def build():
    page = open(os.path.join(HERE, 'page', 'app.html'), encoding='utf-8', newline='').read()
    assert page.count('/*@MODULES@*/') == 1
    mods = '\n'.join(open(os.path.join(HERE, 'modules', m), encoding='utf-8', newline='').read() for m in ORDER)
    out = page.replace('/*@MODULES@*/', mods).replace('\r\n', '\n')
    dest = os.path.join(ROOT, 'dist', 'MeetingGraph2.html')
    open(dest, 'wb').write(out.encode('utf-8'))
    print('dist/MeetingGraph2.html sha256', hashlib.sha256(out.encode('utf-8')).hexdigest()[:8])


if __name__ == '__main__':
    build()
