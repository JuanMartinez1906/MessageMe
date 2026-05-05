#!/bin/bash
# Builds the 12 microservice images + the frontend, in series so a 16 GB
# Mac doesn't OOM. Tags everything as messageme/<service>:dev.
#
# Run from the repo root:
#   ./infra/build-all-images.sh

set -euo pipefail

# Resolve repo root regardless of where the script is invoked from.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICES=(
  api-gateway
  auth-service
  user-service
  group-service
  channel-service
  direct-service
  message-service
  delivery-service
  presence-service
  file-service
  media-processor
  ws-gateway
)

for svc in "${SERVICES[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "▶ Building messageme/$svc:dev"
  echo "════════════════════════════════════════════════════════════"
  docker build \
    -f "services/$svc/Dockerfile" \
    -t "messageme/$svc:dev" \
    .
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "▶ Building messageme/frontend:dev"
echo "════════════════════════════════════════════════════════════"
docker build \
  -f frontend/Dockerfile \
  -t messageme/frontend:dev \
  frontend

echo ""
echo "✓ All images built."
docker images | grep -E "^messageme/" | sort
