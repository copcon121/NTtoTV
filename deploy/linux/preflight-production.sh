#!/usr/bin/env bash
set -euo pipefail

base=http://127.0.0.1:8001
curl -fsS "$base/api/health" >/dev/null
curl -fsS "$base/api/ready" >/dev/null

for removed in /ws/nt /ws/bookmap /ws/nt-capture /api/nt/native-bar /api/mt5/status; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$base$removed")
  if [[ $code != 404 ]]; then
    echo "removed route is unexpectedly reachable: $removed ($code)" >&2
    exit 1
  fi
done

# Direct execution can be enabled, but its account/order state must require auth.
for private in /api/execution/account /api/orders; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$base$private")
  if [[ $code != 401 && $code != 404 ]]; then
    echo "execution route is not protected: $private ($code)" >&2
    exit 1
  fi
done

test -s /opt/nttotv/current/frontend/dist/index.html
caddy validate --config /opt/nttotv/current/deploy/caddy/Caddyfile.production
echo "production preflight passed"
