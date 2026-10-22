#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 || $# -ne 2 ]]; then
  echo "usage: sudo $0 WIRE_SYMBOL 'PHYSICAL CONTRACT'" >&2
  exit 2
fi
wire=$1
physical=$2
[[ $wire =~ ^GC[A-Z][0-9]$ ]] || { echo "invalid wire symbol" >&2; exit 2; }
[[ $physical =~ ^GC\ [0-9]{2}-[0-9]{2}$ ]] || { echo "invalid physical contract" >&2; exit 2; }

env_file=/etc/nttotv/nttotv.env
test -f "$env_file"
/opt/nttotv/current/deploy/linux/backup-nttotv.sh

config_file=/var/lib/nttotv/config/rithmic.json
install -d -o nttotv -g nttotv -m 0750 /var/lib/nttotv/config
config_backup=$(mktemp /var/lib/nttotv/config/rithmic.json.rollback.XXXXXX)
if [[ -f "$config_file" ]]; then
  cp "$config_file" "$config_backup"
else
  rm -f "$config_backup"
  config_backup=""
fi
backup_env=$(mktemp /etc/nttotv/nttotv.env.rollback.XXXXXX)
cp "$env_file" "$backup_env"

rollback_on_error() {
  status=$?
  if [[ $status -ne 0 ]]; then
    echo "rollover failed; restoring prior configuration" >&2
    cp -f "$backup_env" "$env_file"
    if [[ -n "$config_backup" ]]; then
      cp -f "$config_backup" "$config_file"
      chown nttotv:nttotv "$config_file"
      chmod 0600 "$config_file"
    else
      rm -f "$config_file"
    fi
    systemctl restart nttotv.service || true
  fi
  rm -f "$backup_env"
  [[ -z "$config_backup" ]] || rm -f "$config_backup"
  exit "$status"
}
trap rollback_on_error EXIT

systemctl stop nttotv.service

credential_args=()
if [[ -f /etc/nttotv/credentials/rithmic-password ]]; then
  credential_args=(-p LoadCredential=rithmic_password:/etc/nttotv/credentials/rithmic-password)
fi
systemd-run --wait --pipe --collect \
  -p User=nttotv -p Group=nttotv \
  -p EnvironmentFile="$env_file" \
  "${credential_args[@]}" \
  -p WorkingDirectory=/opt/nttotv/current/backend \
  -E "NTTOTV_RITHMIC_SYMBOL=$wire" \
  -E "NTTOTV_RITHMIC_CONTRACT=$physical" \
  /bin/sh -c 'export NTTOTV_RITHMIC_PASSWORD_FILE="$CREDENTIALS_DIRECTORY/rithmic_password"; exec .venv/bin/python scripts/rithmic_seed_history.py --wire "$NTTOTV_RITHMIC_SYMBOL" --physical "$NTTOTV_RITHMIC_CONTRACT"'

systemd-run --wait --pipe --collect \
  -p User=nttotv -p Group=nttotv \
  -p EnvironmentFile="$env_file" \
  -p WorkingDirectory=/opt/nttotv/current/backend \
  /opt/nttotv/current/backend/.venv/bin/python \
  scripts/rithmic_set_contract.py --wire "$wire" --physical "$physical"

tmp=$(mktemp /etc/nttotv/nttotv.env.new.XXXXXX)
awk -v wire="$wire" -v physical="$physical" '
  BEGIN { saw_wire=0; saw_physical=0 }
  /^NTTOTV_RITHMIC_SYMBOL=/ { print "NTTOTV_RITHMIC_SYMBOL=" wire; saw_wire=1; next }
  /^NTTOTV_RITHMIC_CONTRACT=/ { print "NTTOTV_RITHMIC_CONTRACT=" physical; saw_physical=1; next }
  { print }
  END {
    if (!saw_wire) print "NTTOTV_RITHMIC_SYMBOL=" wire
    if (!saw_physical) print "NTTOTV_RITHMIC_CONTRACT=" physical
  }
' "$env_file" >"$tmp"
chown root:nttotv "$tmp"
chmod 0640 "$tmp"
mv -f "$tmp" "$env_file"
systemctl restart nttotv.service

for _ in $(seq 1 180); do
  if curl -fsS http://127.0.0.1:8001/api/ready >/dev/null; then
    trap - EXIT
    rm -f "$backup_env"
    [[ -z "$config_backup" ]] || rm -f "$config_backup"
    echo "rollover ready: $wire / $physical"
    exit 0
  fi
  sleep 1
done

echo "rollover failed readiness" >&2
exit 1
