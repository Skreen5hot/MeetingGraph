"""Shared Playwright driver for the MeetingGraph workbench (headless Chromium; Edge is Chromium too)."""
import json, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT = open(os.path.join(HERE, 'transcript_difficult.txt'), encoding='utf-8').read()
FLAWED = json.load(open(os.path.join(HERE, 'flawed_difficult.json'), encoding='utf-8'))


class WB:
    def __init__(self, path, pw, reviewer_details=True):
        self.b = pw.chromium.launch()
        self.pg = self.b.new_page(viewport={'width': 1280, 'height': 900})
        self.errors = []
        self.pg.on('pageerror', lambda e: self.errors.append(str(e)))
        self.pg.on('console', lambda m: m.type == 'error' and self.errors.append(m.text))
        self.pg.on('dialog', lambda d: d.accept())
        self.downloads = []
        self.pg.on('download', lambda d: self.downloads.append(d))
        self.pg.goto('file://' + os.path.abspath(path))
        self.pg.wait_for_timeout(400)
        # D-UX11 (2026-10-12): user mode is the default; these suites run in Reviewer details, as the testers do.
        self.reviewer_details(reviewer_details)

    def reviewer_details(self, on=True):
        self.js("on => { if (window.MKG_setReviewerDetails) window.MKG_setReviewerDetails(on); }", on)

    def close(self):
        self.b.close()

    def js(self, expr, arg=None):
        return self.pg.evaluate(expr, arg)

    def last_download_text(self):
        self.pg.wait_for_timeout(300)
        return open(self.downloads[-1].path(), encoding='utf-8').read() if self.downloads else ''

    def click(self, id_):
        self.js("id => document.getElementById(id).click()", id_)

    def load_sample(self):
        self.click('load-sample'); self.pg.wait_for_timeout(500)

    def prepare(self, transcript, date='2026-10-01', time='10:00', offset='-04:00', title='Weekly board walk'):
        self.js("""([t, d, tm, off, ti]) => { const $ = id => document.getElementById(id);
            $('m-date').value = d; $('m-time').value = tm; $('m-title').value = ti;
            const sel = $('m-offset'); if ([...sel.options].some(o => o.value === off)) sel.value = off;
            $('transcript').value = t; }""", [transcript, date, time, offset, title])
        self.click('do-segment'); self.pg.wait_for_timeout(600)
        chat = self.js("document.getElementById('chat-text').value")
        token = chat.split('\n')[0].split(': ', 1)[1].strip()
        return token, chat

    def answer_as_proposed(self):
        # D-UX11: Accept waits for the meeting's decisions; answer each with the choice that keeps what the chat proposed.
        self.js("""() => { const out = document.getElementById('import-out');
            for (let k = 0; k < 60; k++) { const q = [...out.querySelectorAll('#ux-decisions .ux-q')].find(li => !li.querySelector('input:checked')); if (!q) break;
              const r = [...q.querySelectorAll('input[type=radio]')].find(x => ['accept', 'keep', 'defer'].includes(x.value)); if (!r) break;
              r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } }""")

    def validate(self, reply):
        self.js("t => { document.getElementById('llm-in').value = t; }", json.dumps(reply))
        self.click('do-validate'); self.pg.wait_for_timeout(600)
        return self.js("document.getElementById('import-out').innerText")


def run(path, fn):
    with sync_playwright() as pw:
        w = WB(path, pw)
        try:
            return fn(w)
        finally:
            w.close()
