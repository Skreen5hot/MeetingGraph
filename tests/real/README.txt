Testing a request variant on a real meeting, without sharing its content (plan §10.15)
=======================================================================================

Everything from the real meeting stays in tests/real/local/, which git ignores. Only the scorer's output (counts and
statement numbers) leaves your machine.

1. In MeetingGraph2.html, open the real meeting and number the statements. Copy the request into
   tests/real/local/request.txt.
2. Make the variant:
       python3 tests/real/make_variant.py G tests/real/local/request.txt
   This writes tests/real/local/request-G.txt. It changes one phrase and nothing else; the token is unchanged, so the
   page accepts the replies.
3. Send request-G.txt to three fresh chats, answering nothing. Save each whole reply as tests/real/local/G1.txt,
   G2.txt and G3.txt. Save the two earlier replies too, if you have them, as D1.txt and D2.txt.
4. Write tests/real/local/key.txt: the statement numbers of the meeting's important items, one or more per line
   (S048, S091, S108, the important ones both runs found, and anything both runs missed). Anything after # is a
   private note and is ignored.
5. Score them all:
       python3 tests/real/score_real.py tests/real/local/key.txt tests/real/local/D1.txt tests/real/local/D2.txt tests/real/local/G1.txt tests/real/local/G2.txt tests/real/local/G3.txt
   Send the output. It holds counts and statement numbers only.
6. Paste each G reply into the page and read its items. Count any item that shows an earlier version of something the
   meeting later changed (it must be zero), and any you'd delete as noise.
