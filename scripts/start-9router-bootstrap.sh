#!/usr/bin/env bash
set -euo pipefail

container_name=personal-ai-ninerouter-bootstrap
volume_name=personal-ai-ninerouter_data
image=decolua/9router:0.5.112

if docker container inspect "$container_name" >/dev/null 2>&1; then
  echo "Bootstrap container already exists: $container_name" >&2
  echo "Configure it, then run: docker rm -f $container_name" >&2
  exit 1
fi

docker volume create "$volume_name" >/dev/null
docker run -d \
  --name "$container_name" \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --publish 127.0.0.1:20128:20128 \
  --volume "$volume_name:/app/data" \
  --env DATA_DIR=/app/data \
  --env PORT=20128 \
  --env HOSTNAME=0.0.0.0 \
  --env NODE_ENV=production \
  --env REQUIRE_API_KEY=true \
  --env ENABLE_REQUEST_LOGS=false \
  "$image"

echo "9Router bootstrap is ready at http://127.0.0.1:20128. Configure it, then remove $container_name before starting Compose."
