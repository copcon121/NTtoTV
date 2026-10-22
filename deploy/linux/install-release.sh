#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "run as root" >&2
  exit 2
fi
if [[ $# -ne 1 ]]; then
  echo "usage: $0 /opt/nttotv/releases/<release-id>" >&2
  exit 2
fi

release_dir=$(realpath "$1")
case "$release_dir" in
  /opt/nttotv/releases/*) ;;
  *) echo "release must be below /opt/nttotv/releases" >&2; exit 2 ;;
esac
test -f "$release_dir/backend/requirements.txt"
test -f "$release_dir/frontend/dist/index.html"
test -f "$release_dir/RProtocolAPI.zip"

getent group nttotv >/dev/null || groupadd --system nttotv
id nttotv >/dev/null 2>&1 || useradd --system --gid nttotv --home-dir /var/lib/nttotv --shell /usr/sbin/nologin nttotv
install -d -o nttotv -g nttotv -m 0750 /var/lib/nttotv /var/lib/nttotv/backups
install -d -o root -g nttotv -m 0750 /etc/nttotv /etc/nttotv/credentials

/opt/python311/bin/python3.11 -m venv "$release_dir/backend/.venv"
requirements_file="$release_dir/backend/requirements.txt"
if [[ -f "$release_dir/backend/requirements-linux-arm64.lock" ]]; then
  requirements_file="$release_dir/backend/requirements-linux-arm64.lock"
fi
"$release_dir/backend/.venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir -r "$requirements_file"
chown -R root:nttotv "$release_dir"
find "$release_dir" -type d -exec chmod 0750 {} +
find "$release_dir" -type f -exec chmod 0640 {} +
find "$release_dir/deploy/linux" -type f -name '*.sh' -exec chmod 0750 {} +
find "$release_dir/backend/.venv/bin" -type f -exec chmod 0750 {} +
if id caddy >/dev/null 2>&1; then
  usermod -a -G nttotv caddy
fi

ln -sfn "$release_dir" /opt/nttotv/current.new
mv -Tf /opt/nttotv/current.new /opt/nttotv/current
systemctl daemon-reload
systemctl restart nttotv.service
