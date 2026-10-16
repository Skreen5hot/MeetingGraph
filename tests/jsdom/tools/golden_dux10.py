"""D-UX10 revision of the Atlas golden reply. Input: the D-UX9 golden (reconstructed); output: the revised golden.
Every change answers a D-UX10 rule; none changes what the testers' EX rows ask for.
Usage: python3 golden_dux10.py <in.json> <out.json>"""
import json, sys
g = json.load(open(sys.argv[1]))
ops = g["ops"]
def find(**kw):
    hit = [o for o in ops if all(o.get(k) == v for k, v in kw.items())]
    assert len(hit) == 1, (kw, len(hit)); return hit[0]

# R09 / TASK-NO-ACCEPTANCE: an unowned tasking quotes the ask itself (S010 "Please make sure ...").
n2 = find(ref="NEW-2")
n2["src"][0] = {"seg": "S010", "quote": "Please make sure the host team confirms the surface is suitable and identifies another location if it is not."}

# D-UX10c / R16 (Oct 9 precedent): separate deliverables are separate taskings, even in one sentence.
deck = find(ref="NEW-3")
deck.update(label="Send the site-information slide deck to the group",
            src=[{"seg": "S012", "quote": "This morning I will send the group the site-information slide deck"}])
notes = {"op": "NewTasking", "ref": "NEW-4", "project": "P1", "label": "Send the notes from yesterday's coordination session to the group",
         "assignee": "morgan-reyes", "dueDate": "2026-10-09", "duePhrase": "this morning",
         "src": [{"seg": "S012", "quote": "the notes from yesterday's coordination session"}]}
conf = find(ref="NEW-5")
conf["ref"] = "NEW-7"
tr = find(ref="NEW-4")
tr.update(ref="NEW-5", label="Send today's transcript to the distribution list",
          src=[{"seg": "S013", "quote": "I will also send today's transcript"}])
summ = {"op": "NewTasking", "ref": "NEW-6", "project": "P1", "label": "Send the related coordination summaries to the distribution list",
        "assignee": "morgan-reyes", "dueDate": "2026-10-09", "duePhrase": "today",
        "src": [{"seg": "S013", "quote": "the related coordination summaries to the distribution list today"}]}
i = ops.index(deck); ops.insert(i + 1, notes)
i = ops.index(tr); ops.insert(i + 1, summ)

# CONTINGENCY-DROPPED: the working approach keeps the speaker's "if needed".
wa = find(op="ProgressNote", tasking="AI-8", text="Working approach described (not an accepted decision): mobile unit provides power, workspace, connectivity, and elevated placement; final flight plan pending.")
wa["text"] = "Working approach described (not an accepted decision): mobile unit provides power, workspace, connectivity, and elevated placement if needed; final flight plan pending."

# Segments table follows the refs.
seg = {s["seg"]: s for s in g["segments"]}
seg["S012"]["dispositions"] = [{"kind": "commitment", "about": ["NEW-3", "NEW-4"]}]
seg["S013"]["dispositions"] = [{"kind": "commitment", "about": ["NEW-5", "NEW-6"]}]
seg["S017"]["dispositions"] = [{"kind": "status_update", "about": ["AI-9"]}, {"kind": "commitment", "about": ["NEW-7"]}]
seg["S018"]["dispositions"] = [{"kind": "commitment", "about": ["NEW-7"]}]

# R01 / COV-UNRESOLVED: the possible match on AI-7 is decided, with its reason (testers' EX-14: AI-7 untouched).
reg = {r["id"]: r for r in g["register"]}
reg["AI-7"].clear(); reg["AI-7"].update({"id": "AI-7", "coverage": "not_discussed", "segs": [],
    "note": "S002 is about sensor placement for the integration options on AI-8; nothing was reported on evaluating the alternate configuration."})

# D-UX10a: one newVsExisting row per NewTasking.
g["selfReview"] = {"newVsExisting": [
  {"ref": "NEW-1", "nearest": "AI-5", "whyNew": "Checking that the vehicle entrance fits the mobile unit is its own verification; AI-5 is the liaison coordination for entry and parking."},
  {"ref": "NEW-2", "nearest": "AI-5", "whyNew": "The parking-surface check and its fallback location are a separate verification asked of the host team, not Morgan's liaison coordination."},
  {"ref": "NEW-3", "nearest": None, "whyNew": "No register item covers distributing the site-information slide deck; it is a new deliverable promised this morning."},
  {"ref": "NEW-4", "nearest": None, "whyNew": "No register item covers sending the notes from the earlier coordination session; it is a new deliverable promised this morning."},
  {"ref": "NEW-5", "nearest": None, "whyNew": "No register item covers distributing the meeting transcript; it is a new deliverable promised for today."},
  {"ref": "NEW-6", "nearest": None, "whyNew": "No register item covers distributing the coordination summaries; they are a separate deliverable promised for today."},
  {"ref": "NEW-7", "nearest": "AI-9", "whyNew": "Alex committed to confirm receipt himself; AI-9 is Morgan's invitation update, which completes when the invitations are sent."}
]}
json.dump(g, open(sys.argv[2], "w"), indent=1)
print("golden D-UX10:", len(ops), "ops,", len(g["flags"]), "flags,", len(g["selfReview"]["newVsExisting"]), "selfReview rows")
