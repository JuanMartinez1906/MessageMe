# Kafka Event Contracts (events/)

Esquemas JSON de los eventos asincrónicos que fluyen por Kafka. Son el contrato entre **productores** y **consumidores**.

## Sobre de evento (envelope)

Todos los eventos comparten un envelope común (`_envelope.schema.json`) con:

- `event_id` (UUID v4): id único del evento (para dedupe en consumers idempotentes).
- `event_type` (string): nombre del topic (`messages.sent`, `files.uploaded`, etc).
- `event_version` (int): versión del esquema. Incrementa en cambios breaking.
- `occurred_at` (ISO 8601 UTC): timestamp del evento.
- `producer` (string): nombre del servicio que lo produjo.
- `trace_id` (string, opcional): para correlation/tracing.
- `payload` (object): datos específicos del evento (schema por topic).

## Topics

| Topic | Producer | Consumers | Particionado por | Retention |
|-------|----------|-----------|------------------|-----------|
| `messages.sent` | message-service | ws-gateway, delivery-service, search-service (opcional), notification-service | `channel_id` o `conversation_id` | 7 días |
| `messages.delivered` | delivery-service | ws-gateway | `message_id` | 3 días |
| `messages.read` | delivery-service | ws-gateway | `message_id` | 3 días |
| `files.uploaded` | file-service | media-processor | `file_id` | 1 día |
| `media.ready` | media-processor | ws-gateway, message-service | `file_id` | 1 día |
| `user.presence` | presence-service | ws-gateway | `user_id` | 1 hora (compacted) |
| `group.member_changed` | group-service | notification-service, ws-gateway | `group_id` | 7 días |
| `audit.events` | cualquiera | audit-service | random | 30 días |

## Convenciones

- Topics en **lowercase** con `.` como separador.
- Nombres en pasado (`messages.sent`, no `send.message`) — un evento es algo que **ya ocurrió**.
- Una key de partición consistente por topic para preservar orden dentro del grupo lógico (ej: mensajes del mismo canal siempre van a la misma partición → orden preservado).
- Consumers deben ser **idempotentes** (usar `event_id` o claves naturales).
- Cambios breaking en un payload → nuevo topic `v2` (ej: `messages.sent.v2`), nunca cambiar el existente.

## Validación

Cada servicio valida los eventos que produce contra estos schemas (AJV en Node.js). CI corre validación cruzada para detectar drift.
