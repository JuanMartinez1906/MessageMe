#!/bin/bash
# Creates the Kafka topics MessageMe relies on.
# Idempotent: `--if-not-exists` skips topics that already exist.
# Runs as a one-shot container (`kafka-init`) after `kafka` is healthy.

set -euo pipefail

BROKER="kafka:29092"

create() {
  local name="$1"
  local partitions="$2"
  local retention_ms="$3"
  local cleanup_policy="${4:-delete}"

  echo "==> Creating topic: $name (partitions=$partitions, retention=${retention_ms}ms, policy=$cleanup_policy)"
  kafka-topics --bootstrap-server "$BROKER" \
    --create --if-not-exists \
    --topic "$name" \
    --partitions "$partitions" \
    --replication-factor 1 \
    --config "retention.ms=$retention_ms" \
    --config "cleanup.policy=$cleanup_policy"
}

# 7 days = 604800000 ms
# 3 days = 259200000 ms
# 1 day  = 86400000  ms
# 30 days = 2592000000 ms
# 1 hour = 3600000 ms

create "messages.sent"         6 604800000
create "messages.delivered"    3 259200000
create "messages.read"         3 259200000
create "files.uploaded"        3 86400000
create "media.ready"           3 86400000
create "user.presence"         3 3600000  compact
create "group.member_changed"  3 604800000
create "audit.events"          3 2592000000

echo "==> Topics ready:"
kafka-topics --bootstrap-server "$BROKER" --list
