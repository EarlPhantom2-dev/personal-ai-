#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then echo "Usage: $0 backups/personal-ai-YYYYMMDDTHHMMSSZ.dump.age" >&2; exit 2; fi
backup="$(realpath "$1")"
root="$(realpath backups)"
case "$backup" in "$root"/personal-ai-*.dump.age) ;; *) echo "Choose an encrypted backup file inside ./backups." >&2; exit 2 ;; esac
echo "This will replace the live PostgreSQL data with: $backup"
read -r -p "Type RESTORE to continue: " answer
[[ "$answer" == "RESTORE" ]] || { echo "Restore cancelled."; exit 1; }
temporary="$(mktemp "$root/restore.XXXXXX.dump")"
trap 'rm -f "$temporary"' EXIT
age -d -i .secrets/backup_age_key -o "$temporary" "$backup"
docker compose stop app
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' < "$temporary"
docker compose start app
