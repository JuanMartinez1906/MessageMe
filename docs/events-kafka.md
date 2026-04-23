# Kafka — Flujos de eventos

Mapa de productores, consumidores y flujos críticos. Los schemas están en [../events/](../events/).

## Flujo 1: Envío de mensaje a un canal

```
Cliente A ──WS──▶ ws-gateway ──gRPC──▶ message-service
                                           │
                                           │ (1) persist en MongoDB
                                           │ (2) produce `messages.sent`
                                           ▼
                                         Kafka
                                           │
           ┌───────────────────────────────┼────────────────────────────┐
           ▼                               ▼                            ▼
     ws-gateway                    delivery-service              notification-service
     (push a recipientes)          (inserta filas SENT)          (push notif a offline)
```

1. Cliente A envía mensaje por WebSocket → `ws-gateway`.
2. `ws-gateway` llama por gRPC `message-service.SendMessage`.
3. `message-service` persiste en Mongo y produce `messages.sent` (particionado por `channel_id`).
4. Consumidores paralelos:
   - `ws-gateway` recibe y empuja por WS a cada recipiente online.
   - `delivery-service` crea filas SENT para cada miembro excepto el sender.
   - `notification-service` revisa quién está offline y dispara push.

## Flujo 2: Chulitos (delivery/read)

```
Cliente B (recibe mensaje)
   │
   ▼
ws-gateway ──gRPC──▶ delivery-service.MarkDelivered
                         │
                         ▼ produce `messages.delivered`
                       Kafka ──▶ ws-gateway ──WS──▶ Cliente A (muestra doble chulito)
```

Lo mismo para `messages.read` cuando el usuario abre la conversación.

## Flujo 3: Subida de archivo

```
Cliente ──REST──▶ api-gateway ──gRPC──▶ file-service.CreateUpload
                                            │
                                            ▼ devuelve URL presignada S3
Cliente ──PUT directo a S3──────────────▶ (S3)

Cliente ──REST──▶ api-gateway ──gRPC──▶ file-service.ConfirmUpload
                                            │
                                            ▼ produce `files.uploaded`
                                         Kafka ──▶ media-processor
                                                       │ descarga de S3
                                                       │ Sharp → WebP thumbnail
                                                       │ sube thumbnail a S3
                                                       ▼ produce `media.ready`
                                         Kafka ──▶ ws-gateway (avisa al cliente)
                                                   message-service (actualiza refs si aplica)
```

## Flujo 4: Presencia

```
Cliente conecta WS
   │
   ▼
ws-gateway ──gRPC──▶ presence-service.SetOnline
                         │
                         ▼ SET key en Redis con TTL
                         ▼ produce `user.presence` (compacted topic)
                       Kafka ──▶ ws-gateway ──▶ Clientes que observan a ese user
```

- Topic `user.presence` es **compacted** keyed por `user_id`: solo retiene el último estado.
- `ws-gateway` envía heartbeats periódicos (cada 20s) → `presence-service.Heartbeat` refresca TTL.
- Si el TTL expira (cliente desconectado sin avisar), presence-service emite `online=false`.

## Garantías y trade-offs

| Garantía | Cómo |
|----------|------|
| **Orden dentro de una conversación** | Particionar `messages.sent` por `channel_id`/`conversation_id` |
| **At-least-once delivery** | Default de Kafka; consumidores deben ser idempotentes (usar `event_id` para dedupe) |
| **No perder eventos si message-service cae** | Productor con `acks=all`, outbox pattern dentro de message-service (tabla `outbox` en Mongo) |
| **Fan-out rápido a múltiples consumidores** | Un mismo topic leído por N consumer groups distintos (ws-gateway y delivery-service son consumer groups separados) |
| **Backpressure** | Kafka retiene; los consumidores escalan vía HPA + KEDA con lag del topic como métrica |

## Topics y particionamiento

Ver [../events/README.md](../events/README.md) para la tabla completa (topic, partitions, retention, policy).

## Esquemas

Los JSON Schemas en `events/` sirven para:
1. Validar en el productor antes de publicar (AJV).
2. Validar en tests de integración.
3. Autodocumentar el contrato.
4. En el futuro: integrar con Schema Registry (Confluent) si se necesita Avro/Protobuf binario.
