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
current slot and labels the actual snapshot time. Refresh never invokes the LLM.

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
Only the latest valid session plan owns alerting, so a profile has at most two
planner observation levels. Earlier plans remain readable during overlapping
sessions. If the new read fails, the previous valid session's alerts continue
until their original expiry. Identical active levels can be shared at handoff. Each
fires once, with the event and disarming committed together. Reconciliation
does not rearm fired alerts. The user can explicitly rearm an unexpired alert.

Session alerts expire at their own session's end or are superseded by the next
valid session plan. Old schedule alerts are disabled while retaining history.
The price engine enforces
expiry even if the scheduler is busy. Disabling the planner pauses its armed
alerts without modifying manual alerts or deleting event history.

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

An ambiguous provider timeout or backend interruption keeps the slot claimed;
it is not automatically retried. The **Thử lại phiên này** button explicitly
queues one retry of a failed slot; switching the planner off and back on does
the same. Completed/running slots remain protected from duplicate requests.
Reports from earlier slots retain their original expiry. A provider failure
never creates fresh alerts. Failed slots remain retryable after a restart.

- `GET /api/mp/sessions?count=5`: public GC day boundaries, also used by the chart.
- `GET /api/mp/plans[?dayStart=...]`: authenticated reports, settings and alert state.
- `PUT /api/mp/settings`: authenticated `{ "enabled": true|false }` for the user's profile.
- `POST /api/mp/plans/run`: authenticated, idempotent catch-up for the current slot.
- `PATCH /api/mp/alerts/{id}`: authenticated `{ "enabled": true|false }` for an owned MP alert.

Deployment: build `frontend/dist`, restart through `scripts/Restart-Backend.ps1`,
then check health, `/api/mp/sessions`, authentication on `/api/mp/plans`, and the
public HTML asset hash. Caddy does not need a restart for these changes.
