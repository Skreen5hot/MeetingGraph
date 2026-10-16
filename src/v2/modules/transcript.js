/* MeetingGraph v2 — transcript: the Teams header, statement numbering and the MEETING block (plan §10.6 step 1).
   parseTeamsHeader and segmentTranscript are copied from v1 (src/base/MeetingGraph.orig.html), so the statements are
   numbered exactly as in the tested requests. The .docx reader stays in the page: it needs the browser's DOMParser. */
(function (root) {
'use strict';
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n, w = 3) => String(n).padStart(w, '0');
const weekday = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

function parseTeamsHeader(text) {
  const lines = String(text).split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 8);
  let title = null, date = null, time = null, dur = null;
  for (const ln of lines) {
    let md = ln.match(/^((?:\d+h )?\d+m \d+s)$/);
    if (md && !dur) { dur = md[1]; continue; }
    let m = ln.match(/^(.*)-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:[A-Z]{1,5})?-Meeting (?:Transcript|Recording)$/i);
    if (m) {
      title = m[1].trim() || title;
      date = `${m[2]}-${m[3]}-${m[4]}`;
      time = `${m[5]}:${m[6]}`;
      continue;
    }
    m = ln.match(/^([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4}),? +(\d{1,2}):(\d{2})(?::\d{2})? ?([AP])\.?M\.?$/i);
    if (m && !date) {
      const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
      if (mo) {
        let h = parseInt(m[4], 10);
        const ap = m[6].toUpperCase();
        if (ap === 'P' && h !== 12) h += 12;
        if (ap === 'A' && h === 12) h = 0;
        date = `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
        time = `${String(h).padStart(2, '0')}:${m[5]}`;
      }
    }
  }
  return date ? { title, date, time, dur } : null;
}

function segmentTranscript(text) {
  const segs = [];
  const re1 = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:\[\]]{1,60}?):\s+(.*)$/; // [time] Name: text
  const re2 = /^\s*([A-Z][^:]{0,50}?):\s+(.*)$/;                                     // Name: text
  const reTeams = /^\s*(\S.{0,59}?)(?:[ \t]{2,}|\t)(\d{1,2}:\d{2}(?::\d{2})?)\s*$/; // Name   1:00:21
  const reWords = /^\s*(\S.{0,59}?)\s+(?:(\d+)\s+hours?\s+)?(?:(\d+)\s+minutes?\s+)?(\d+)\s+seconds?\s*$/i; // Name 0 minutes 3 seconds
  const nameLike = x => { const tk = x.trim().split(/\s+/); return tk.length <= 5 && tk.every(t => /^[("“]?[A-ZÀ-Þ]/.test(t)); };
  const norm = t => t.split(':').length === 2 ? '00:' + t.padStart(5, '0') : t.padStart(8, '0');
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!segs.length) {
      const t0 = line.trim();
      if (/-Meeting (Transcript|Recording)$/i.test(t0)) continue;
      if (/^[A-Za-z]{3,9}\.? \d{1,2}, \d{4},? +\d{1,2}:\d{2}(:\d{2})? ?[AP]\.?M\.?$/i.test(t0)) continue;
      if (/^(\d+h )?\d+m \d+s$/.test(t0)) continue;
      if (/ started transcription$/i.test(t0)) continue;
    }
    let m;
    if ((m = reTeams.exec(line)) && !/\d/.test(m[1])) { segs.push({ t: norm(m[2]), speakerName: m[1].trim(), text: '' }); continue; }
    if ((m = reWords.exec(line)) && nameLike(m[1])) { segs.push({ t: `${pad(+(m[2] || 0), 2)}:${pad(+(m[3] || 0), 2)}:${pad(+m[4], 2)}`, speakerName: m[1].trim(), text: '' }); continue; }
    const last = segs[segs.length - 1];
    if (last && last.text === '' && last.t !== null) { last.text = line.trim(); continue; }
    if ((m = re1.exec(line))) { segs.push({ t: norm(m[1]), speakerName: m[2].trim(), text: m[3].trim() }); continue; }
    if ((m = re2.exec(line))) { segs.push({ t: null, speakerName: m[1].trim(), text: m[2].trim() }); continue; }
    if (segs.length) last.text = (last.text + ' ' + line.trim()).trim();
    else segs.push({ t: null, speakerName: 'Unknown', text: line.trim() });
  }
  return segs.filter(x => x.text && !(x.speakerName === 'Unknown' && /^(transcript|transcription (started|stopped)\.?)$/i.test(x.text.trim())))
    .map((x, i) => ({ id: 'S' + pad(i + 1), ...x }));
}

// The MEETING block, exactly as v1 writes it into the request ("=== MEETING ===" and what follows).
function meetingBlock(date, title, segments) {
  return `=== MEETING ===\nMEETING: ${date} (${weekday(date)}), ${title}\nSEGMENTS:\n` +
    segments.map(s => `${s.id}${s.t ? ' [' + s.t + ']' : ''} ${s.speakerName}: ${s.text}`).join('\n');
}

// The meeting ID, as v1: the UTC start, e.g. 20261019T140000Z.
function meetingId(date, time, offset) {
  const at = `${date}T${time.length === 5 ? time + ':00' : time}${offset}`;
  return new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

const api = { parseTeamsHeader, segmentTranscript, meetingBlock, meetingId, weekday };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_transcript = api;
})(this);
