#!/usr/bin/env python3
"""
Per-rule outcome attribution, read from the persisted action log.
Read-only. Touches nothing the autonomy loop uses.

Only meaningful for entries after 29 Jul 2026 08:36 UTC — before that every
attempt was logged as 'executed' regardless of outcome, so earlier rows cannot
distinguish a filled order from a 500 error.

    python3 rule_outcomes.py [--db actions.db] [--since ISO8601]
"""
import argparse, json, sqlite3, sys
from collections import defaultdict

CUTOVER = "2026-07-29T08:36:00Z"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="actions.db")
    ap.add_argument("--since", default=CUTOVER)
    args = ap.parse_args()
    try:
        con = sqlite3.connect("file:%s?mode=ro" % args.db, uri=True)
    except sqlite3.Error as e:
        sys.exit("cannot open %s: %s" % (args.db, e))
    rows = con.execute("SELECT ts, data FROM actions ORDER BY id").fetchall()
    con.close()

    stats = defaultdict(lambda: {"executed": 0, "failed": 0, "skipped": 0, "legacy": 0})
    reasons = defaultdict(lambda: defaultdict(int))
    noise = defaultdict(int)
    total = considered = 0
    first_ts = last_ts = None

    for ts, data in rows:
        total += 1
        try:
            e = json.loads(data)
        except Exception:
            continue
        ev = e.get("event")
        if ev not in ("executed", "failed", "skipped"):
            noise[ev] += 1
            continue
        if ts < args.since:
            continue
        considered += 1
        first_ts = first_ts or ts
        last_ts = ts
        d = e.get("decision") or {}
        rule = d.get("objective") or d.get("actionType") or "unknown"
        if "outcome" not in e:
            stats[rule]["legacy"] += 1
            continue
        stats[rule][ev] += 1
        if ev == "failed":
            reasons[rule][e.get("failureReason") or "unknown"] += 1
        elif ev == "skipped":
            reasons[rule][e.get("skipReason") or "unknown"] += 1

    print("rows in log      : %d" % total)
    print("decision entries : %d (since %s)" % (considered, args.since))
    if first_ts:
        print("window           : %s -> %s" % (first_ts, last_ts))
    if noise:
        print("non-decision     : %s" % dict(noise))
    print()
    if not stats:
        print("No attributable decisions yet. Expected until the log accumulates.")
        return
    print("%-24s %7s %7s %7s %7s   %s" % ("RULE","OK","FAIL","SKIP","RATE","TOP REASON"))
    print("-" * 86)
    for rule in sorted(stats, key=lambda r: -(stats[r]["executed"] + stats[r]["failed"])):
        s = stats[rule]
        att = s["executed"] + s["failed"]
        rate = ("%.0f%%" % (100.0 * s["executed"] / att)) if att else "-"
        top = ""
        if reasons[rule]:
            k, v = max(reasons[rule].items(), key=lambda kv: kv[1])
            top = "%s (%d)" % (k[:40], v)
        print("%-24s %7d %7d %7d %7s   %s" % (rule, s["executed"], s["failed"], s["skipped"], rate, top))
        if s["legacy"]:
            print("%-24s   %d pre-fix entries excluded (no outcome field)" % ("", s["legacy"]))
    print()
    ok = sum(s["executed"] for s in stats.values())
    bad = sum(s["failed"] for s in stats.values())
    if ok + bad:
        print("overall success rate: %.0f%% (%d of %d attempts)" % (100.0*ok/(ok+bad), ok, ok+bad))
    print()
    print("CAUTION: a rule's rate is only meaningful once it has a couple of dozen")
    print("attempts. Do not retune anything off single-digit samples.")

if __name__ == "__main__":
    main()
