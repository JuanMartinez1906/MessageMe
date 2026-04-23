# gRPC Contracts (proto/)

Contratos Protocol Buffers compartidos entre microservicios. Son la **fuente de verdad** para la comunicación interna (este-oeste / horizontal).

## Archivos

| Archivo | Servicio | Responsabilidad |
|---------|----------|-----------------|
| `common.proto` | — | Tipos compartidos (Role, MessageType, DeliveryStatus, Page, Error) |
| `auth.proto` | auth-service | Register, Login, Refresh, Logout, ValidateToken |
| `user.proto` | user-service | GetProfile(s), Search, UpdateProfile |
| `presence.proto` | presence-service | SetOnline, SetOffline, Heartbeat, GetPresence, Subscribe (stream) |
| `group.proto` | group-service | CRUD grupos + miembros + roles |
| `channel.proto` | channel-service | CRUD canales dentro de un grupo |
| `direct.proto` | direct-service | Conversaciones 1-a-1 |
| `message.proto` | message-service | SendMessage, GetHistory, StreamHistory (stream), Edit, Delete |
| `delivery.proto` | delivery-service | MarkDelivered, MarkRead, GetStatuses, GetUnreadCounts |
| `file.proto` | file-service | CreateUpload (presigned S3 URL), ConfirmUpload, GetDownloadUrl |

Servicios sin `.proto` dedicado (solo consumen/producen):
- **api-gateway**: expone REST, es cliente gRPC de todos los demás.
- **ws-gateway**: cliente gRPC + consumer/producer de Kafka + WS hacia clientes.
- **media-processor**: solo Kafka consumer; no expone gRPC.

## Convenciones

- **Paquetes**: `messageme.<service>` — evita colisiones de nombres.
- **Nombres de servicio**: PascalCase terminando en `Service` (ej: `AuthService`).
- **Nombres de RPC**: verbos imperativos (`SendMessage`, `GetHistory`).
- **Campos**: `snake_case`, siempre con tag explícito.
- **Timestamps**: `google.protobuf.Timestamp`.
- **Enums**: prefijo con el nombre del enum y `UNSPECIFIED = 0` como default.
- **Paginación**: usa `common.Page` + `common.PageInfo` (cursor-based).
- **Scope de mensajes**: un `Message` pertenece a un `channel_id` O a un `conversation_id`, nunca ambos.

## Generación de código

Cada servicio Node.js generará los stubs con `@grpc/proto-loader` (dinámico) o `ts-proto` (estático). A definir en Fase 1.

Comando típico (ts-proto, ejemplo):
```bash
protoc \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./src/generated \
  --ts_proto_opt=outputServices=grpc-js,esModuleInterop=true \
  -I ../proto \
  ../proto/*.proto
```

## Versionado

- Cambios **backwards-compatible** (nuevos campos opcionales, nuevos RPCs): se agregan sin bump.
- Cambios **breaking** (renombrar, cambiar tipos, eliminar campos): crear `v2/` o nuevo package.
- Nunca reutilizar un tag number eliminado.
