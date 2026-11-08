#!/bin/bash
set -euo pipefail
export PGPASSWORD="$(cat "$PGPASSWORD_FILE")"
retention="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p /backups
while :; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="/backups/personal-ai-$stamp.dump.age"
  temporary="/backups/.personal-ai-$stamp.dump.age.partial"
  if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]] && \
     pg_dump --format=custom --no-owner | age -r "$BACKUP_AGE_RECIPIENT" > "$temporary"; then
    chmod 600 "$temporary"
    mv "$temporary" "$file"
    find /backups -type f -name 'personal-ai-*.dump.age' -mtime "+$retention" -delete
  else
    rm -f "$temporary"
    echo "Database backup failed" >&2
  fi
  sleep 86400
done
