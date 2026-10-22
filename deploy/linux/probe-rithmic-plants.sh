#!/usr/bin/env bash
set -euo pipefail

: "${CREDENTIALS_DIRECTORY:?systemd credential directory is required}"
export NTTOTV_RITHMIC_PASSWORD_FILE="$CREDENTIALS_DIRECTORY/rithmic_password"
exec /opt/nttotv/current/backend/.venv/bin/python \
  /opt/nttotv/current/backend/scripts/rithmic_direct_probe.py \
  --archive /opt/nttotv/current/RProtocolAPI.zip \
  --timeout 20 \
  plants
