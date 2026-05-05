#!/bin/bash
# Imports the 13 messageme/* local Docker images into the k3d cluster's
# containerd cache so pods with `imagePullPolicy: IfNotPresent` find them
# without a registry.
#
# Run after build-all-images.sh:
#   ./infra/import-images-to-k3d.sh

set -euo pipefail

CLUSTER="${1:-messageme}"

IMAGES=(
  messageme/api-gateway:dev
  messageme/auth-service:dev
  messageme/user-service:dev
  messageme/group-service:dev
  messageme/channel-service:dev
  messageme/direct-service:dev
  messageme/message-service:dev
  messageme/delivery-service:dev
  messageme/presence-service:dev
  messageme/file-service:dev
  messageme/media-processor:dev
  messageme/ws-gateway:dev
  messageme/frontend:dev
)

echo "▶ Importing ${#IMAGES[@]} images into k3d cluster '$CLUSTER'..."
k3d image import "${IMAGES[@]}" -c "$CLUSTER"
echo "✓ All images available inside the cluster."
