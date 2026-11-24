#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "run as root" >&2
  exit 2
fi

staging_config=/opt/nttotv/current/deploy/caddy/Caddyfile.staging-https
if [[ ! -f ${staging_config} ]]; then
  staging_config=/opt/nttotv/current/deploy/caddy/Caddyfile.staging
fi

install -o root -g root -m 0644 "${staging_config}" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now python-app.service
systemctl reload caddy
echo "staging Caddy config restored from ${staging_config}; sample python-app is running"
