# Market Profile LLM planner

The `/mp` panel creates Vietnamese daily/session plans and automatically arms
price-touch alerts chosen by the LLM. It does not classify the market with a
separate strategy state machine or place orders.

Sign in on `/mp` using the existing chart account, then enable **Bật plan +
alert**. The planner uses that user's profile (`profile_id = user.id`), including
its existing Telegram configuration. Configure Telegram in the main chart's
Alerts panel if the MP panel reports that it is unavailable.

## Schedule and reports

The backend owns three durable request slots in fixed UTC+7: Asia 07:00-12:00,
Europe 12:30-22:00, US 20:00-04:00 the next day. It reads at 07:00, 12:30 and
20:00. EU and US overlap from 20:00 to 22:00; US owns the later read. The
exchange GC daily profile calendar retains DST. Planner run IDs include
`utc7-v2` so old schedule reports remain readable without blocking the new slots.
The first available slot creates the daily plan and that session's plan in one
request. Later slots create one session plan. A late start creates only the
current slot and labels the actual snapshot time. Reloading the page never
invokes the LLM.

After a completed session read, **Doc lai phien hien tai** explicitly queues a
new session plan using the latest available snapshot. It leaves the daily
context and previous session revisions in history. The UI shows the new context
time and switches to the current session tab. While queued/running, the button
is disabled. The request returns immediately and the durable worker processes it.
Stale tabs and simultaneous clicks queue at most one read of the same revision.

Inputs include five completed TPO/volume profiles, the developing profile,
twenty closed daily candles where available, observed session ranges/initial
balances, level tests, and prior plans. Each session receives the previous
trading day's same-session close. Asia also receives the previous US session's
Volume VA/POC and distributions, with opening/current location relative to that
VA. The close is the last M1 bar at the session boundary, not settlement; a
missing final minute is disclosed and never silently treated as a valid close.
The Asian rotation idea is a user-supplied working hypothesis, not a proven
edge or an instruction to fade a breakout. Volume VA remains primary. Both volume
at price and TPO are reconstructed from M1 candles, not raw tick ladders. Missing
coverage is disclosed. The economic-event calendar and options are not connected.

Reports target 80-140 Vietnamese words excluding alert explanations. The daily
plan provides context and has no alerts. A session selects zero to two decision
zones, ranked by evidence/confluence, using one existing catalog level per zone.
It must not fill a quota or invent numerical probabilities. Unknown or duplicate
references and malformed responses are rejected before alert creation. Reports,
input snapshots, durable request claims and profile alert links are stored in
new `mp_*` tables in `analyst.sqlite` using its existing single writer.

## Alerts

Managed alert IDs start with `mp_`; definitions live in the existing alert store.
Only the current session's latest valid plan owns alerting, so a profile has at
most two planner observation levels. Fired alerts disappear from the chart,
alert list, and history; websocket/Telegram/push notifications still deliver
once. A hidden disabled record prevents refreshes and restarts from recreating
consumed alerts. Removed alerts cannot be rearmed.

At each new session, all previous-session alerts and their history are removed
before requesting the new plan, including when fresh data is missing or the
new read fails. EU prose stays readable until 22:00, but its alerts end at the
20:00 US handoff. The price engine enforces expiry while the scheduler is busy.
Cleanup includes paused profiles and legacy fired/deleted alerts. Disabling
the planner pauses current armed alerts. Manual alerts and their history are
preserved. An open chart reconciles managed alerts every five seconds.

Telegram delivery for MP alerts always runs on the backend, including with an
open browser; frontend handlers do not send them again. The MP panel receives
toast/sound events over the existing same-origin chart socket. Its alert-only
socket does not suppress the legacy backend fallback for manual alerts.

## Configuration and endpoints

`NTTOTV_MP_PLANNER_ENABLED=1` starts the service; per-profile subscriptions are
off until enabled in the panel. `scripts/Run-BackendProcess.ps1` enables the
service and loads the Analyst API key, base URL, model, and reasoning settings
from the Windows user's persistent environment, overriding stale inherited
`NTTOTV_*` values in an already-open terminal or IDE.
Credentials are never included in reports or logs.

The local 9router endpoint is `http://127.0.0.1:20128/v1`; the model remains
`cx/gpt-6.1-sol` unless overridden. Its API key is stored in the Windows User
environment (`NTTOTV_OPENAI_API_KEY`), never in this repository.
`NTTOTV_LLM_REASONING_EFFORT=xhigh` selects Extra High reasoning. The planner
allows 300 seconds and 24,000 total output/reasoning tokens per request while
instructing the model to keep the visible report short. The model/effort used
are recorded on each plan and shown in the panel.

The Windows MP planner can instead use the local muse2api gateway. Start
`muse2api`, import a real muse.ai account, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Set-MpLlmProvider.ps1 -Provider muse -Restart
```

This stores `NTTOTV_MP_LLM_PROVIDER=muse`, `NTTOTV_MP_LLM_BASE_URL`,
`NTTOTV_MP_LLM_MODEL=muse-chat`, and `NTTOTV_MP_LLM_API_KEY` in the Windows User
environment. The key is read from the sibling `muse2api\data\api_key` file;
`-MuseKeyFile` and `-MuseBaseUrl` can override those installation locations.
The other analysts retain their existing OpenAI/9router configuration.

Muse requests use `/v1/chat/completions` with the full plan schema and snapshot
in a single prompt because the gateway does not enforce Structured Outputs.
The backend still validates scopes, narrative text, alert limits and catalog
references before saving a plan or creating alerts. A complete JSON code fence
is accepted; prose and invalid JSON are rejected. Muse controls its underlying
model and reasoning; OpenAI model-name aliases do not select that actual model.
Keep muse2api running for scheduled plans. There is no automatic provider
fallback or retry that could duplicate a request after a timeout.

For a real-account verification without saving chart plans or arming alerts,
run `python -m scripts.verify_mp_muse` from `backend` with its virtual
environment. This reads public chart history, makes one Muse request, validates
the result, and writes a preview under `_run_logs/mp-muse/`.

To switch MP back to the preserved OpenAI/9router settings:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Set-MpLlmProvider.ps1 -Provider openai -Restart
```

An ambiguous provider timeout or backend interruption keeps the slot claimed;
it is not automatically retried. The **Thử lại phiên này** button explicitly
queues one retry of a failed slot; switching the planner off and back on does
the same. Completed/running slots remain protected from duplicate requests.
Reports from earlier slots retain their original expiry. A provider failure
never creates fresh alerts. Failed slots remain retryable after a restart.

If a manual reread fails within the same session, its previous valid plan and
alerts remain active until session handoff/expiry. A successful reread supersedes the previous session
revision. Same-session alerts at the same price retain their armed, fired,
disabled or deleted state; rereading alone never rearms them. New selected
prices use the normal alert registration path and obsolete levels are removed.

- `GET /api/mp/sessions?count=5`: public GC day boundaries, also used by the chart.
- `GET /api/mp/plans[?dayStart=...]`: authenticated reports, settings and alert state.
- `PUT /api/mp/settings`: authenticated `{ "enabled": true|false }` for the user's profile.
- `POST /api/mp/plans/run`: authenticated, idempotent catch-up for the current slot.
- `POST /api/mp/plans/refresh`: authenticated `{ "expectedRunId": "..." }`, queues
  an explicit reread of the currently completed revision; returns status 202.
- `PATCH /api/mp/alerts/{id}`: authenticated `{ "enabled": true|false }` for an owned MP alert.

Deployment: build `frontend/dist`, restart through `scripts/Restart-Backend.ps1`,
then check health, `/api/mp/sessions`, authentication on `/api/mp/plans`, and the
public HTML asset hash. Caddy does not need a restart for these changes.
