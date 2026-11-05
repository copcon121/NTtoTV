# Backend Task Scheduler runtime

Run `Register-BackendStartupTask.ps1` from an elevated PowerShell in the
deployment checkout, then `Restart-Backend.ps1`. Registration does not start
or stop an existing backend. It uses the current Windows account (S4U), the
existing `Run-BackendProcess.ps1`, persisted user/provider configuration and
the same data directory. Never copy an older runner over the deployed runner.

`NTtoTV Backend` starts 20 seconds after boot, without requiring a user logon.
The foreground supervisor retries a stopped backend after 10 seconds and
restarts an unhealthy backend after three failed checks, following a 120-second
startup grace period. Task Scheduler retries a failed supervisor every minute;
an additional one-minute trigger recovers an exited task, including a forcibly
terminated supervisor that Windows does not retry. Multiple instances
are ignored and execution has no time limit. Processes are owned by Task
Scheduler, independent of AO.

Existing Start/Stop/Restart scripts control the registered task. Stop also
stops supervision; the one-minute trigger or next boot starts it again.
For extended maintenance, disable `NTtoTV Backend` and stop it, then enable it
and start it when ready. Run registration again to refresh credentials after
changing the Rithmic login.

The registrar saves a machine-DPAPI encrypted Rithmic credential fallback in
`%LOCALAPPDATA%\NTtoTV\backend-task\rithmic.bin`. Only the current account and
SYSTEM have access to that directory. The original user-DPAPI credential is
preferred; the fallback allows unattended boot before the user's master key
is available. No credential values are put in the task, repository or logs.

Runtime files remain under `_run_logs\backend`: `backend-runtime.json` records
the supervisor and listener PIDs; `backend-supervisor.log` records restarts,
health failures and exit codes; stdout/stderr retain one `.previous` copy.
Python fault diagnostics are enabled. No market/trading settings are changed.

Verify using `Get-ScheduledTask -TaskName 'NTtoTV Backend'`, local/public health,
`/api/market-data/status`, process ancestry and job membership. A task-managed
process may itself belong to a Windows job, so check membership in AO's job
specifically rather than assuming that any job implies AO ownership.
