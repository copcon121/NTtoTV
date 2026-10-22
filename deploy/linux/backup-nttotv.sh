#!/usr/bin/env bash
set -euo pipefail

data_dir=/var/lib/nttotv
backup_dir="$data_dir/backups"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir/daily" "$backup_dir/weekly"

python_bin=/opt/nttotv/current/backend/.venv/bin/python
backup_py=/opt/nttotv/current/deploy/linux/sqlite-online-backup.py
for name in app.sqlite analyst.sqlite; do
  if [[ -f "$data_dir/$name" ]]; then
    "$python_bin" "$backup_py" "$data_dir/$name" "$backup_dir/daily/${name%.sqlite}-$timestamp.sqlite"
  fi
done

find "$backup_dir/daily" -type f -name '*.sqlite' -mtime +7 -delete
if [[ $(date -u +%u) == 7 ]]; then
  for daily in "$backup_dir/daily"/*-"$timestamp".sqlite; do
    [[ -e "$daily" ]] || continue
    cp --reflink=auto "$daily" "$backup_dir/weekly/$(basename "$daily")"
  done
fi
find "$backup_dir/weekly" -type f -name '*.sqlite' -mtime +28 -delete
