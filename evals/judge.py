#!/usr/bin/env python3
"""Offline-friendly fidelity judge helpers.

Online LLM judging can wrap this rubric, but this file intentionally works
without API access so CI can validate report plumbing.
"""

import json
import sys

RUBRIC = {
    "score": "0-5",
    "5": "all technical claims preserved, no harmful omissions, concise",
    "4": "minor wording omissions, still actionable",
    "3": "useful but loses one important caveat or step",
    "2": "ambiguous or incomplete",
    "1": "technically wrong in important way",
    "0": "unusable",
}


def heuristic_score(reference: str, candidate: str) -> dict:
    ref_terms = {t.strip(".,:;`()").lower() for t in reference.split() if len(t) > 4}
    cand = candidate.lower()
    missing = sorted(t for t in ref_terms if t and t not in cand)[:12]
    score = 5 if not missing else 4 if len(missing) <= 2 else 3 if len(missing) <= 5 else 2
    return {
        "score": score,
        "missing_claims": missing,
        "wrong_claims": [],
        "ambiguity": 0 if score >= 4 else 1,
        "verdict": "pass" if score >= 4 else "review",
    }


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"rubric": RUBRIC}, indent=2))
        return
    print(json.dumps(heuristic_score(sys.argv[1], sys.argv[2]), indent=2))


if __name__ == "__main__":
    main()
