"""Rebuild the Atlas and Teams-header fixtures from the build record in chat fd770baf
(turns 118, 141, 149, 151). Each step replays the exact edit made there, in order.
Usage: python3 reconstruct_fixtures.py <out_dir>"""
import json, os, sys, io, zipfile
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
P = lambda n: os.path.join(out, n)

# ---- turn 141: transcript (Teams Recording format, 27m 24s header) ----
TRANSCRIPT = """Atlas Weekly Coordination-20261009_140000UTC-Meeting Recording
October 9, 2026, 2:00PM
27m 24s
Morgan Reyes started transcription
[00:03:10] Taylor Brooks: We have a few additional program observers who may attend the exercise. The list could still change. I sent the names I have to Jordan, who is tracking the guest process.
[00:04:22] Casey Lin: For the equipment, we can place the sensors on the mobile unit mast or on ground stands. The final choice depends on the flight plan, available mounting hardware, and wind conditions. We have not selected a configuration.
[00:07:05] Morgan Reyes: The schedule changed. What had been discussed as October 20 through October 30 is now expected to run October 20 through October 24. We still need to determine who must arrive early and who can travel later.
[00:09:14] Riley Novak: The mobile unit will arrive around October 18 or 19. We would prefer to park it at the host site before the first operational day.
[00:10:01] Morgan Reyes: I will coordinate with the host liaison so the mobile unit can enter the site, park in the intended area, and begin setup before the exercise starts.
[00:10:46] Riley Novak: Please provide Alex and me with a direct site point of contact before we arrive.
[00:10:58] Morgan Reyes: Yes, I will get you a direct point of contact.
[00:11:21] Riley Novak: We also need to confirm that the designated vehicle entrance can accommodate the mobile unit.
[00:11:35] Morgan Reyes: Agreed. I will verify the designated entrance is suitable for the vehicle.
[00:12:04] Riley Novak: The proposed parking area may not support the vehicle's weight. Please make sure the host team confirms the surface is suitable and identifies another location if it is not.
[00:12:22] Casey Lin: That needs verification. The current area may work, but we need confirmation before arrival.
[00:13:10] Morgan Reyes: This morning I will send the group the site-information slide deck and the notes from yesterday's coordination session.
[00:14:05] Morgan Reyes: I will also send today's transcript and the related coordination summaries to the distribution list today.
[00:15:32] Casey Lin: The current plan is for the mobile unit to provide power, workspace, connectivity, and elevated placement if needed. That is our working approach, but we still need the final flight plan.
[00:18:11] Taylor Brooks: For the observer group, we are developing a separate schedule so people can choose which day to attend. The final list has not been established.
[00:20:06] Casey Lin: Morgan, can you update the recurring meeting invitations for Alex, Drew, Sam, and Priya?
[00:20:14] Morgan Reyes: I updated Alex and Drew just now. Alex, let me know if you receive it. I still need to add Sam and Priya.
[00:21:33] Alex Kim: I will confirm receipt after the meeting.
[00:23:50] Morgan Reyes: No other updates from me.
"""
open(P('mkg-transcript-atlas-2026-10-09.txt'), 'w', encoding='utf-8').write(TRANSCRIPT)

# ---- turn 141: attendance export (40m 06s, the deliberate conflict) ----
T = '\t'
ATT = '\n'.join([
 '1. Summary',
 'Meeting title' + T + 'Atlas Weekly Coordination',
 'Attended participants' + T + '5',
 'Start time' + T + '10/9/26, 2:00:12 PM',
 'End time' + T + '10/9/26, 2:40:18 PM',
 'Meeting duration' + T + '40m 06s',
 '',
 '2. Participants',
 T.join(['Name','First Join','Last Leave','In-Meeting Duration','Email','Participant ID (UPN)','Role']),
 T.join(['Morgan Reyes','10/9/26, 2:00:12 PM','10/9/26, 2:40:15 PM','40m 3s','mreyes@example.gov','mreyes@example.gov','Organizer']),
 T.join(['Taylor Brooks','10/9/26, 2:00:40 PM','10/9/26, 2:40:10 PM','39m 30s','tbrooks@example.gov','tbrooks@example.gov','Presenter']),
 T.join(['Casey Lin','10/9/26, 2:01:05 PM','10/9/26, 2:40:08 PM','39m 3s','clin@example.gov','clin@example.gov','Presenter']),
 T.join(['Riley Novak','10/9/26, 2:01:33 PM','10/9/26, 2:39:54 PM','38m 21s','rnovak@example.gov','rnovak@example.gov','Presenter']),
 T.join(['Alex Kim','10/9/26, 2:02:01 PM','10/9/26, 2:39:47 PM','37m 46s','akim@example.gov','akim@example.gov','Attendee']),
 ''])
open(P('mkg-attendance-atlas.csv'), 'w', encoding='utf-8').write(ATT)

# ---- turn 141: golden reply v1 (11 ops + 3 flags) ----
g = {
  "context": "MKG1_TOKEN_PLACEHOLDER",
  "ops": [
    { "op": "ProgressNote", "tasking": "AI-5", "text": "Morgan will coordinate with the host liaison for site entry, parking in the intended area, and setup before the exercise starts.", "src": [{ "seg": "S005", "quote": "I will coordinate with the host liaison" }] },
    { "op": "Reassign", "tasking": "AI-6", "to": "morgan-reyes", "src": [{ "seg": "S006", "quote": "provide Alex and me with a direct site point of contact" }, { "seg": "S007", "quote": "I will get you a direct point of contact" }] },
    { "op": "NewTasking", "ref": "NEW-1", "project": "P1", "label": "Verify the designated vehicle entrance can accommodate the mobile unit", "assignee": "morgan-reyes", "src": [{ "seg": "S008", "quote": "designated vehicle entrance can accommodate" }, { "seg": "S009", "quote": "I will verify the designated entrance" }] },
    { "op": "NewTasking", "ref": "NEW-2", "project": "P1", "label": "Confirm parking-area surface suitability and identify an alternate location if needed", "src": [{ "seg": "S010", "quote": "confirms the surface is suitable and identifies another location" }, { "seg": "S011", "quote": "we need confirmation before arrival" }] },
    { "op": "NewTasking", "ref": "NEW-3", "project": "P1", "label": "Send the site-information slide deck and prior coordination-session notes to the group", "assignee": "morgan-reyes", "dueDate": "2026-10-09", "duePhrase": "this morning", "src": [{ "seg": "S012", "quote": "I will send the group the site-information slide deck" }] },
    { "op": "NewTasking", "ref": "NEW-4", "project": "P1", "label": "Send today's transcript and coordination summaries to the distribution list", "assignee": "morgan-reyes", "dueDate": "2026-10-09", "duePhrase": "today", "src": [{ "seg": "S013", "quote": "to the distribution list today" }] },
    { "op": "NewTasking", "ref": "NEW-5", "project": "P1", "label": "Confirm receipt of the updated meeting invitation", "assignee": "alex-kim", "src": [{ "seg": "S017", "quote": "let me know if you receive it" }, { "seg": "S018", "quote": "I will confirm receipt after the meeting" }] },
    { "op": "ProgressNote", "tasking": "AI-1", "text": "Event window narrowed to 2026-10-20 through 2026-10-24 (previously through October 30); early-arrival versus later-travel determination still open.", "src": [{ "seg": "S003", "quote": "now expected to run October 20 through October 24" }] },
    { "op": "ProgressNote", "tasking": "AI-8", "text": "Sensor placement undecided: mobile-unit mast versus ground stands; depends on flight plan, mounting hardware, and wind conditions.", "src": [{ "seg": "S002", "quote": "depends on the flight plan, available mounting hardware, and wind conditions" }] },
    { "op": "ProgressNote", "tasking": "AI-8", "text": "Working approach described (not an accepted decision): mobile unit provides power, workspace, connectivity, and elevated placement; final flight plan pending.", "src": [{ "seg": "S014", "quote": "That is our working approach, but we still need the final flight plan" }] },
    { "op": "ProgressNote", "tasking": "AI-9", "text": "Invitation updates initiated for Alex and Drew (delivery unconfirmed); Sam and Priya still to be added.", "src": [{ "seg": "S016", "quote": "update the recurring meeting invitations for Alex, Drew, Sam, and Priya" }, { "seg": "S017", "quote": "I updated Alex and Drew just now" }] }
  ],
  "flags": [
    { "kind": "ownership", "about": None, "seg": "S010", "note": "Parking-area verification has no accepted owner; the host team (via Morgan) is the likely owner but no one accepted it in the meeting." },
    { "kind": "open_question", "about": None, "seg": "S015", "note": "Observer attendance list remains fluid; a separate day-choice schedule is in development and the final list is not established." },
    { "kind": "open_question", "about": "AI-1", "seg": "S003", "note": "Who must arrive early versus travel later for the October 20-24 window is undetermined." }
  ]
}

# ---- turn 149 (D-UX9): register table (segments table is replaced in turn 151) ----
g["segments"] = []
g["register"] = [
  {"id":"AI-1","coverage":"updated","segs":["S003"]},
  {"id":"AI-2","coverage":"not_discussed","segs":[]},
  {"id":"AI-3","coverage":"not_discussed","segs":[]},
  {"id":"AI-4","coverage":"not_discussed","segs":[]},
  {"id":"AI-5","coverage":"updated","segs":["S005"]},
  {"id":"AI-6","coverage":"updated","segs":["S006","S007"]},
  {"id":"AI-7","coverage":"possible_match_requires_review","segs":["S002"],"note":"The S002 equipment-configuration discussion may bear on this item; needs a human call."},
  {"id":"AI-8","coverage":"updated","segs":["S002","S014"]},
  {"id":"AI-9","coverage":"updated","segs":["S016","S017"]},
  {"id":"AI-10","coverage":"not_discussed","segs":[]}
]
# ---- turn 151 (ratified schema): multi-disposition segments, coveredProjects, flag arrays ----
g["coveredProjects"] = ["P1"]
g["segments"] = [
  {"seg":"S001","dispositions":[{"kind":"open_question","about":[],"note":"Observer-list fluidity; evidence also cited by the observers open_question flag."}]},
  {"seg":"S002","dispositions":[{"kind":"discussion_of_register_item","about":["AI-8"]}]},
  {"seg":"S003","dispositions":[{"kind":"discussion_of_register_item","about":["AI-1"]},{"kind":"open_question","about":["AI-1"],"note":"Early-arrival vs later-travel undetermined; carried by the open_question flag."}]},
  {"seg":"S004","dispositions":[{"kind":"context_only"}]},
  {"seg":"S005","dispositions":[{"kind":"commitment","about":["AI-5"]}]},
  {"seg":"S006","dispositions":[{"kind":"commitment","about":["AI-6"]}]},
  {"seg":"S007","dispositions":[{"kind":"commitment","about":["AI-6"]}]},
  {"seg":"S008","dispositions":[{"kind":"commitment","about":["NEW-1"]}]},
  {"seg":"S009","dispositions":[{"kind":"commitment","about":["NEW-1"]}]},
  {"seg":"S010","dispositions":[{"kind":"commitment","about":["NEW-2"]}]},
  {"seg":"S011","dispositions":[{"kind":"commitment","about":["NEW-2"]}]},
  {"seg":"S012","dispositions":[{"kind":"commitment","about":["NEW-3"]}]},
  {"seg":"S013","dispositions":[{"kind":"commitment","about":["NEW-4"]}]},
  {"seg":"S014","dispositions":[{"kind":"discussion_of_register_item","about":["AI-8"]}]},
  {"seg":"S015","dispositions":[{"kind":"open_question","about":[]}]},
  {"seg":"S016","dispositions":[{"kind":"commitment","about":["AI-9"]}]},
  {"seg":"S017","dispositions":[{"kind":"status_update","about":["AI-9"]},{"kind":"commitment","about":["NEW-5"]}]},
  {"seg":"S018","dispositions":[{"kind":"commitment","about":["NEW-5"]}]},
  {"seg":"S019","dispositions":[{"kind":"administrative"}]}
]
g["flags"][1]["src"] = ["S015","S001"]; g["flags"][1].pop("seg", None)
g["flags"][2]["about"] = ["AI-1"]
json.dump(g, open(P('mkg-golden-reply-atlas.json'), 'w'), indent=1)

# ---- turn 149: flawed reply (legacy segment shape = backward-compat), then the S014 edit ----
flawed = {
  "context": "MKG1_TOKEN_PLACEHOLDER",
  "ops": [
    {"op":"ProgressNote","tasking":"AI-5","text":"Morgan began coordinating with the host liaison.","src":[{"seg":"S005","quote":"I will coordinate with the host liaison"}]},
    {"op":"ProgressNote","tasking":"AI-5","text":"Event window narrowed to October 20-24.","src":[{"seg":"S003","quote":"now expected to run October 20 through October 24"}]},
    {"op":"NewTasking","ref":"NEW-4","project":"P1","label":"Send today's transcript and coordination summaries to the distribution list","assignee":"morgan-reyes","dueDate":"2026-10-09","duePhrase":"now","src":[{"seg":"S013","quote":"to the distribution list today"}]},
    {"op":"NewTasking","ref":"NEW-9","project":"P1","label":"Update the recurring meeting invitations for the named recipients","assignee":"morgan-reyes","src":[{"seg":"S016","quote":"update the recurring meeting invitations"},{"seg":"S017","quote":"let me know if you receive it"}]},
    {"op":"Status","tasking":"NEW-9","status":"completed","src":[{"seg":"S017","quote":"I updated Alex and Drew just now"}]}
  ],
  "flags": [],
  "segments": [
    {"seg":"S001","kind":"context_only"},{"seg":"S002","kind":"context_only"},
    {"seg":"S003","kind":"discussion_of_register_item","about":"AI-1"},
    {"seg":"S004","kind":"uncertain_requires_review","note":""},
    {"seg":"S005","kind":"commitment","about":"AI-5"},
    {"seg":"S006","kind":"context_only"},{"seg":"S007","kind":"context_only"},
    {"seg":"S008","kind":"commitment","about":None},
    {"seg":"S009","kind":"context_only"},
    {"seg":"S010","kind":"commitment","about":None},
    {"seg":"S011","kind":"context_only"},{"seg":"S012","kind":"context_only"},
    {"seg":"S013","kind":"commitment","about":"NEW-4"},
    {"seg":"S014","kind":"context_only"},{"seg":"S015","kind":"context_only"},
    {"seg":"S016","kind":"commitment","about":"NEW-9"},
    {"seg":"S017","kind":"status_update","about":"NEW-9"},
    {"seg":"S018","kind":"context_only"}
  ],
  "register": [
    {"id":"AI-1","coverage":"updated","segs":["S003"]},
    {"id":"AI-2","coverage":"not_discussed","segs":[]},
    {"id":"AI-3","coverage":"not_discussed","segs":[]},
    {"id":"AI-4","coverage":"not_discussed","segs":[]},
    {"id":"AI-5","coverage":"updated","segs":["S005"]},
    {"id":"AI-6","coverage":"updated","segs":["S006"]},
    {"id":"AI-7","coverage":"not_discussed","segs":[]},
    {"id":"AI-8","coverage":"not_discussed","segs":[]},
    {"id":"AI-9","coverage":"updated","segs":["S016"]}
  ]
}
for e in flawed['segments']:
    if e['seg'] == 'S014': e.update({'kind':'discussion_of_register_item','about':'AI-8'})
json.dump(flawed, open(P('mkg-flawed-reply-atlas.json'), 'w'), indent=1)

# ---- turn 118: teams-header.docx (Teams header paragraphs) ----
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def p(x): return f'<w:p><w:r><w:t xml:space="preserve">{x}</w:t></w:r></w:p>'
body = ''.join([
 p('Dashboard migration sync-20261013_140007-Meeting Transcript'),
 p('October 13, 2026, 2:00PM'),
 p('18m 42s'),
 p(''),
 p('Nguyen, Linh started transcription'),
 p('Nguyen, Linh 0 minutes 6 seconds'),
 p('Thanks for making time, this one is just the dashboard migration.'),
 p('Brooks, Dana 0 minutes 48 seconds'),
 p('Good. Status on the enrollment report?'),
])
xml = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{W}"><w:body>{body}</w:body></w:document>'
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', '<Types/>')
    z.writestr('word/document.xml', xml)
open(P('teams-header.docx'), 'wb').write(buf.getvalue())
print('reconstructed:', ', '.join(sorted(os.listdir(out))))
