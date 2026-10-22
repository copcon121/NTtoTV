# Oracle deployment

The production process is one Uvicorn worker on `127.0.0.1:8001`. The sample
`python-app.service` can remain on `127.0.0.1:8000` while staging.

Required one-time configuration:

1. Copy `nttotv.env.example` to `/etc/nttotv/nttotv.env` and keep the file
   `0640 root:nttotv`. It is a fallback; the owner GUI is authoritative after
   the first save.
2. A bootstrap password may be placed in
   `/etc/nttotv/credentials/rithmic-password` with mode `0600 root:root`.
   Passwords saved in the GUI are kept separately under `/var/lib/nttotv`.
3. Install the unit files, backup timer and the Caddy site.
4. Run `install-release.sh /opt/nttotv/releases/<release-id>`.
5. Keep `Caddyfile.staging-https` active until `/api/ready` returns 200. After DNS
   points at Oracle, run `preflight-production.sh`, then
   `activate-production.sh --confirm`. The activation script installs the TLS
   site and disables the sample app only after preflight succeeds.

## Owner GUI

The owner console is available directly at
`https://oracle.gcflowpy.xyz/admin`. The encrypted SSH tunnel at
`http://127.0.0.1:8088/admin` remains available as an operational fallback.
Bootstrap login is `admin` / `lktoday123`; the first login forces a
password change before admin configuration is available. Every Rithmic
field has an in-page tooltip. The page can save configuration, test Ticker +
History Plant login, connect, and disconnect the runtime.

The GUI stores non-secret settings at
`/var/lib/nttotv/config/rithmic.json` and the password separately at
`/var/lib/nttotv/secrets/rithmic-password`; both are owned by the dedicated
service user with mode `0600`. The password is never returned by the API. An
empty password field preserves the currently stored password. The original
systemd credential is used only until a password is saved through the GUI.

While Rithmic entitlement is pending, all application/deployment work can be
completed with the connector disconnected. Once approved, use **Save &
connect**. Production readiness additionally requires History Plant sync plus
L1/L2/MBO subscription and a complete MBO snapshot.

The optional command-line entitlement probe is:

```bash
sudo systemd-run --wait --pipe --collect \
  -p User=nttotv -p Group=nttotv \
  -p EnvironmentFile=/etc/nttotv/nttotv.env \
  -p LoadCredential=rithmic_password:/etc/nttotv/credentials/rithmic-password \
  -p WorkingDirectory=/opt/nttotv/current/backend \
  /bin/sh -c 'export NTTOTV_RITHMIC_PASSWORD_FILE="$CREDENTIALS_DIRECTORY/rithmic_password"; exec .venv/bin/python scripts/rithmic_direct_probe.py plants'
```

## Rollover and production switch

Manual rollover seeds History Plant first, updates both the GUI config and env
fallback atomically, restarts the service, and rolls configuration back if
readiness is not restored:

```bash
sudo /opt/nttotv/current/deploy/linux/rollover-contract.sh GCG7 'GC 02-27'
```

Production activation and rollback:

```bash
sudo /opt/nttotv/current/deploy/linux/preflight-production.sh
sudo /opt/nttotv/current/deploy/linux/activate-production.sh --confirm
sudo /opt/nttotv/current/deploy/linux/rollback-staging.sh
```
