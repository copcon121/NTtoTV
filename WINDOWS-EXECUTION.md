# Oracle chart with Windows MT5 execution

Market data remains Rithmic on Oracle. Optional execution and the two existing
user profiles remain authoritative on Windows. Oracle relays only the approved
MT5/order/trailing APIs, user profile, and Windows profile authentication.

| Windows profile | Reserved terminal |
| --- | --- |
| hieu | `C:\Program Files\MetaTrader 5\terminal64.exe` |
| Hai | `C:\MT5Hai\terminal64.exe` |

Sign in on `https://oracle.gcflowpy.xyz/` with the existing Windows profile
username/password. The Windows session uses a separate HttpOnly, Secure cookie
on Oracle; broker passwords and account mappings stay on Windows. The Account
dialog lists only that user's terminal. Oracle's local owner/Admin login and
Rithmic settings are separate and stay local.

The order interface matches Windows for BUY/SELL, chart Limit orders, Lots/Risk
sizing, SL/TP, 50% at 1R, break-even, close/partial close/cancel and SuperTrend
trailing. Auto L/S controls, state and frontend API calls are removed on Oracle;
the remaining Windows order interface is preserved. Execution/trailing
uses Windows backend data; Oracle chart/market data continues to use Rithmic.
Order updates arrive through authenticated polling rather than Oracle's chart
WebSocket. Keep Windows, its backend on port 8000, and both MT5 terminals running.

## Private channel

From the Windows live repository, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Start-OracleMt5Tunnel.ps1
```

This installs the `NTtoTV Oracle MT5 private tunnel` scheduled task (startup,
S4U under the current Windows user), starts it now, and reconnects SSH on failure.
It uses the existing pinned SSH config in the Linux repository. SSH is outbound
from Windows; `127.0.0.1:18080` on Oracle forwards to `127.0.0.1:8000` on Windows.
No new public port or Windows inbound rule is required. Supervisor logs are in
`%LOCALAPPDATA%\NTtoTV\oracle-mt5-tunnel` and contain no application credentials.

Enable the optional relay on Oracle by installing
`deploy/systemd/nttotv-windows-execution.conf` as
`/etc/systemd/system/nttotv.service.d/30-windows-execution.conf`, then reload
systemd and restart nttotv. The immutable release installer performs the reload
and restart as part of activation. Do not change the protected runtime env file.

Check `/api/execution`, Windows health through the private listener, public
Oracle health, and `ss -lnt` to verify the tunnel is bound only to loopback.
An unauthenticated `/api/mt5/account` must return 401.

The relay never retries a trading mutation automatically. A timeout returns
`EXECUTION_UNCERTAIN`: inspect open positions/orders before submitting another
request. Existing Windows order idempotency keys pass through unchanged.
Windows being offline does not interrupt Oracle's public chart data APIs.

To disable the relay, remove only the optional systemd drop-in and reload/restart
nttotv. The default application remains market-data-only. Stop the Windows task
with `scripts\Stop-OracleMt5Tunnel.ps1`; `-Unregister` removes its startup task.
