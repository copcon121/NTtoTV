#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 || ${1:-} != --confirm ]]; then
  echo "usage: sudo $0 --confirm" >&2
  exit 2
fi

/opt/nttotv/current/deploy/linux/preflight-production.sh

source_file=/opt/nttotv/current/deploy/caddy/Caddyfile.production
target_file=/etc/caddy/Caddyfile
backup_file=/etc/caddy/Caddyfile.pre-nttotv
cp -f "$target_file" "$backup_file"

restore() {
  status=$?
  if [[ $status -ne 0 ]]; then
    echo "production activation failed; restoring staging Caddy config" >&2
    cp -f "$backup_file" "$target_file"
    caddy validate --config "$target_file" || true
    systemctl reload caddy || true
    systemctl enable --now python-app.service || true
  fi
  exit "$status"
}
trap restore EXIT

install -o root -g root -m 0644 "$source_file" "$target_file"
caddy validate --config "$target_file"
systemctl reload caddy
systemctl disable --now python-app.service

trap - EXIT
echo "NTtoTV production Caddy config active; sample python-app is disabled"
