#!/usr/bin/env bash
set -euo pipefail
umask 077
mkdir -p .secrets backups
chmod 700 .secrets
chmod 700 backups
command -v age-keygen >/dev/null || { echo "Install age before creating backup keys (sudo apt install age)." >&2; exit 1; }

if [[ ! -f .env ]]; then
  echo "Run scripts/start-9router-bootstrap.sh first to create a persistent 9Router API key secret." >&2
  exit 1
fi
router_key_secret="$(sed -n 's/^NINEROUTER_API_KEY_SECRET=//p' .env | tail -n 1)"
if [[ -z "$router_key_secret" ]]; then
  echo "NINEROUTER_API_KEY_SECRET is missing from .env. Run scripts/start-9router-bootstrap.sh first." >&2
  exit 1
fi

if [[ -e .secrets/app_password || -e .secrets/session_secret || -e .secrets/postgres_password || -e .secrets/ninerouter_api_key || -e .secrets/backup_age_key ]]; then
  echo "Secret files already exist. Back them up before replacing anything." >&2
  exit 1
fi

read -r -s -p "New app sign-in password (12+ characters): " app_password
printf '\n'
if (( ${#app_password} < 12 )); then echo "Password must be at least 12 characters." >&2; exit 1; fi
read -r -s -p "9Router local Endpoint API key (from its dashboard, not a provider API key): " router_key
printf '\n'
read -r -p "Chat model name from 9Router: " chat_model
read -r -p "Embedding model name from 9Router: " embedding_model
if [[ -z "$router_key" || -z "$chat_model" || -z "$embedding_model" ]]; then
  echo "The 9Router Endpoint API key, chat model, and embedding model are required." >&2
  exit 1
fi
if [[ ! "$chat_model" =~ ^[A-Za-z0-9._:/-]+$ || ! "$embedding_model" =~ ^[A-Za-z0-9._:/-]+$ ]]; then
  echo "Model names may contain letters, numbers, dot, underscore, colon, slash, or hyphen." >&2
  exit 1
fi

printf '%s' "$app_password" > .secrets/app_password
openssl rand -hex 32 > .secrets/session_secret
openssl rand -hex 32 > .secrets/postgres_password
age-keygen -o .secrets/backup_age_key >/dev/null 2>&1
printf '%s' "$router_key" > .secrets/ninerouter_api_key
chmod 600 .secrets/*

chmod 600 .env
recipient="$(age-keygen -y .secrets/backup_age_key)"
python3 - "$chat_model" "$embedding_model" "$recipient" <<'PY'
from pathlib import Path
import sys
path = Path('.env')
values = {
    'NINEROUTER_CHAT_MODEL': sys.argv[1],
    'NINEROUTER_EMBEDDING_MODEL': sys.argv[2],
    'BACKUP_AGE_RECIPIENT': sys.argv[3],
}
lines = path.read_text().splitlines()
for key, value in values.items():
    lines = [f'{key}={value}' if line.startswith(f'{key}=') else line for line in lines]
path.write_text('\n'.join(lines) + '\n')
PY
echo "Secrets created in .secrets/. Keep this directory outside backups and Git."
