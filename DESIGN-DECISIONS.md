# Design decisions

Suggestions we discussed and explicitly decided against, with the reason. The
goal is to stop future sessions from re-litigating things we've already
thought through, and to capture the trade-off clearly enough that if the
context changes we can revisit deliberately.

Format per entry: a short title, what was suggested, what was decided, and
**why** — that's the load-bearing part. The Playbook documents what the app
**is**; this file documents what we chose **not** to build, and on what
grounds.

---

## Reverse cards as a per-session toggle instead of separate rows

**Suggested.** Store one Card per pair, drop the auto-generated reverse
sibling, and add an "include reversed cards this practice?" toggle during
study setup. Reasoning was that materialising the reverse doubles the row
count and feels space-inefficient.

**Decided.** Keep reverses as separate Card rows with their own FSRS state
and `generatedFromCardId` linkage.

**Reason.** A reverse card is a different memory unit. A student can know
"café → coffee" comfortably while struggling with "coffee → café"; FSRS
schedules the harder direction more aggressively only if it has independent
state per direction. A shared schedule would force both directions to move
together — which is precisely the failure mode auto-reverse is designed to
avoid.

The storage cost is small in practice: each extra row is ~200 bytes of
text + ~50 bytes of FSRS state, and media isn't duplicated (reverse cards
reference the same hash in the `media` table). 1,000 paired Basic cards
add roughly 200 KB of "duplicate" state — negligible on the devices we
care about.

The user-facing symptom that prompted this conversation — pairs landing
adjacent in the queue, giving a free hint — was actually an ordering
problem. Fixed by shuffling the standard-session queue within each bucket
(commit `3623031`).

If the storage cost ever becomes meaningful at scale, the migration path
is a hybrid card with two `fsrs` fields and a "side" hint at review time.
Not free — every render / save path branches on side — but doable.
