# Observed ICE session audit

Window: 2026-10-28 19:00 inclusive to 2026-10-29 04:00 exclusive, fixed UTC+7.

- `inputs.json`: the observed compact ICE API snapshot, M1 candle response,
  retrieval times in UTC, exact read-only URLs, window and coverage metadata.
- `audit.json`: descriptive counts and per-order trailing efficiency contexts,
  including the SHA-256 of the exact captured input bytes.
- `audit_session.py`: standard-library-only script; no application imports,
  trading actions, runtime database access, or market-data writes.

Reproduce the saved result offline from the repository root:

```powershell
backend\.venv\Scripts\python.exe analysis\si-2.08-20261029\session-audit\audit_session.py
```

The optional `--capture` argument retrieves a fresh snapshot and overwrites
these derived input/report files. It is not needed to reproduce this capture.

The capture contains 207 detections in the window; 48 have final observed
executed volume >=10 (23 passive BID, 25 passive ASK). Only two of these 48 have
zero observed refills. The M1 input is missing 61 buckets from 01:44 through
02:44 on 29/10 UTC+7. This is an incomplete observed US session.

Final executed quantities, refill counts, ending statuses and post-detection
durations contain hindsight. They were not necessarily known at first
detection. These counts are not a replay of live alerts, an entry-rule backtest,
or evidence of profitability. The default minimum 10 is from source code; the
user's saved profile settings were not read.

Efficiency ratio uses only the 21 consecutive completed M1 closes preceding
each eligible detection: absolute first-to-last change divided by the sum of
20 absolute close changes. Contexts with missing minutes are excluded. The
reported ER cutoffs are exploratory; they are not validated filter defaults.
