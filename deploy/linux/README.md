# Oracle deployment and operations

The active Oracle application uses one Uvicorn worker on 127.0.0.1:8001.
Caddy serves https://oracle.gcflowpy.xyz. The sample python-app.service on
127.0.0.1:8000 remains separate.

Read ../../AGENTS.md for mandatory security boundaries. Access to protected
Admin settings, credentials, process environments or credential databases
requires explicit authorization for the current task. Do not use historical
bootstrap credentials or reset the owner account.

## Release workflow

- Compare against /opt/nttotv/current before integrating changes.
- Build the integrated frontend locally; production does not require Node.
- Package explicit source/config/build files only. Exclude runtime data,
  secrets, .env, virtual environments, node_modules, logs and local SSH keys.
- Create /opt/nttotv/releases/<new-release-id> as an immutable release.
- Use the Linux release/install tooling and verify service health before
  moving the current symlink. Keep the previous release for rollback.
- Restart nttotv.service when needed; verify the public hashed frontend asset
  and the behavior changed. Do not overwrite a newer release with an old build.
- Keep /var/lib/nttotv and existing service credentials intact.

Check liveness and readiness separately: /health verifies the application;
 /ready requires Rithmic qualification, subscriptions, snapshots and recovery.
Readiness 503 is not authorization to alter connector settings.

## Safe technical checks

    readlink -f /opt/nttotv/current
    systemctl is-active nttotv.service caddy.service
    curl -fsS https://oracle.gcflowpy.xyz/health
    curl -s -o /dev/null -w '%{http_code}' https://oracle.gcflowpy.xyz/ready

Technical journal/service/network checks are allowed within the task.
Never dump service environments or search logs for credentials. Stop if a
secret appears unexpectedly and do not repeat it in output.

## Execution

Exness is the only order execution path. Keep existing per-user encrypted
credentials and the master execution key outside releases. Amount Risk uses
account currency (USD/USC) and instrument metadata. See ../../EXNESS-EXECUTION.md.
MT5 terminals and Windows relays are not required.

## Cutover and configuration

The files for installation, backup, production activation and rollover are
operational tools, not authorization to run every action. Rithmic configuration
changes require explicit approval for the current task. DNS/public-site
cutover and disabling the sample application also require a user request.
Keep loopback bindings on 8000/8001 and public access limited to 22/80/443.
