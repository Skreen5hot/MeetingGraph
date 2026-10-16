"""Build archive/v1/MeetingGraph.html (v1, frozen) from the original workbench and the ports, in order, and then
dist/MeetingGraph2.html (v2, docs/mkg-v2-plan.md §10) from src/v2.
Usage: python3 build.py            (writes both; v1 intermediates go to build/)
Each port asserts the exact count of every replacement and writes nothing if one fails."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
P, M, U = (os.path.join(ROOT, 'src', d) for d in ('ports', 'modules', 'ui'))
B = os.path.join(ROOT, 'build'); os.makedirs(B, exist_ok=True)
steps = [
    ('port_dux10.py', os.path.join(ROOT, 'src', 'base', 'MeetingGraph.orig.html'), os.path.join(B, 'MeetingGraph.dux10.html'), []),
    ('port_dux11.py', os.path.join(B, 'MeetingGraph.dux10.html'), os.path.join(B, 'MeetingGraph.dux11.html'), [os.path.join(U, 'ux11-ui.js')]),
    ('port_dux12.py', os.path.join(B, 'MeetingGraph.dux11.html'), os.path.join(B, 'MeetingGraph.dux12.html'), [os.path.join(U, 'res-ui.js')]),
    ('port_dux13.py', os.path.join(B, 'MeetingGraph.dux12.html'), os.path.join(ROOT, 'archive', 'v1', 'MeetingGraph.html'), [os.path.join(U, 'oi-ui.js')]),
]
for port, src, out, extra in steps:
    r = subprocess.run([sys.executable, '-I', os.path.join(P, port), src, out, M, *extra])
    if r.returncode: sys.exit(f'{port} failed')
import hashlib
print('archive/v1/MeetingGraph.html sha256', hashlib.sha256(open(os.path.join(ROOT, 'archive', 'v1', 'MeetingGraph.html'), 'rb').read()).hexdigest()[:8])
sys.path.insert(0, os.path.join(ROOT, 'src', 'v2'))
import build_v2
build_v2.build()
