# REST API — `api-gateway`

Único punto de entrada REST público. Traduce cada request a una o varias llamadas gRPC a los servicios internos.

Base URL (local): `http://localhost:8080/api`
Base URL (prod): `https://<dominio>/api`

## Autenticación

- Header: `Authorization: Bearer <access_token>`
- Access token JWT (TTL 15 min). Refresh token en body / cookie HTTP-only (TTL 7 días).
- El `api-gateway` valida el token llamando `AuthService.ValidateToken` por gRPC y pasa el `user_id` resuelto a los siguientes servicios.

## Endpoints (MVP)

### Auth
| Método | Ruta | Servicio interno |
|--------|------|-------|
| POST | `/api/auth/register` | `auth-service.Register` |
| POST | `/api/auth/login` | `auth-service.Login` |
| POST | `/api/auth/refresh` | `auth-service.Refresh` |
| POST | `/api/auth/logout` | `auth-service.Logout` |
| GET  | `/api/auth/me` | `auth-service.ValidateToken` + `user-service.GetProfile` |

### Users
| Método | Ruta | Servicio interno |
|--------|------|-------|
| GET | `/api/users/search?q=<query>` | `user-service.Search` |
| GET | `/api/users/:userId` | `user-service.GetProfile` |
| PATCH | `/api/users/me` | `user-service.UpdateProfile` |

### Groups
| Método | Ruta | Servicio interno |
|--------|------|-------|
| POST | `/api/groups` | `group-service.CreateGroup` + `channel-service.CreateChannel` (canal "general") |
| GET | `/api/groups` | `group-service.ListGroupsForUser` |
| GET | `/api/groups/:groupId` | `group-service.GetGroup` |
| PATCH | `/api/groups/:groupId` | `group-service.UpdateGroup` |
| DELETE | `/api/groups/:groupId` | `group-service.DeleteGroup` |
| POST | `/api/groups/:groupId/members` | `group-service.AddMember` |
| DELETE | `/api/groups/:groupId/members/:userId` | `group-service.RemoveMember` |

### Channels
| Método | Ruta | Servicio interno |
|--------|------|-------|
| GET | `/api/groups/:groupId/channels` | `channel-service.ListChannels` |
| POST | `/api/groups/:groupId/channels` | `channel-service.CreateChannel` |
| DELETE | `/api/channels/:channelId` | `channel-service.DeleteChannel` |

### Direct
| Método | Ruta | Servicio interno |
|--------|------|-------|
| POST | `/api/conversations` | `direct-service.GetOrCreateConversation` |
| GET | `/api/conversations` | `direct-service.ListForUser` |
| GET | `/api/conversations/:conversationId` | `direct-service.GetConversation` |

### Messages (historial)
| Método | Ruta | Servicio interno |
|--------|------|-------|
| GET | `/api/channels/:channelId/messages?cursor=...&limit=50` | `message-service.GetHistory` |
| GET | `/api/conversations/:conversationId/messages?...` | `message-service.GetHistory` |

> El envío de mensajes NO va por REST; va por WebSocket → `ws-gateway` → `message-service`. REST solo sirve para historial.

### Files
| Método | Ruta | Servicio interno |
|--------|------|-------|
| POST | `/api/files/uploads` | `file-service.CreateUpload` (devuelve presigned URL) |
| POST | `/api/files/uploads/:fileId/confirm` | `file-service.ConfirmUpload` |
| GET | `/api/files/:fileId/download` | `file-service.GetDownloadUrl` |

### Delivery
| Método | Ruta | Servicio interno |
|--------|------|-------|
| GET | `/api/messages/:messageId/statuses` | `delivery-service.GetStatuses` |
| GET | `/api/me/unread` | `delivery-service.GetUnreadCounts` |

## WebSocket (`ws-gateway`)

Conexión: `wss://<dominio>/ws?token=<access_token>`

Eventos de cliente → servidor:
- `send-message` — datos: `{ clientMessageId, channelId?, conversationId?, type, content, fileId? }`
- `mark-delivered` — `{ messageId }`
- `mark-read` — `{ messageId }`
- `typing` / `stop-typing` — `{ channelId?, conversationId? }`

Eventos de servidor → cliente:
- `message-received` — mensaje nuevo
- `message-delivered` / `message-read` — actualización de chulitos
- `presence` — `{ userId, online, lastSeen }`
- `typing` — otro usuario está escribiendo

## Errores

Respuesta de error estándar:
```json
{ "error": { "code": "FORBIDDEN", "message": "You are not a member of this group." } }
```

Códigos HTTP:
- `400` bad request
- `401` unauthenticated
- `403` not authorized
- `404` not found
- `409` conflict (ej: email ya existe)
- `429` rate limit
- `500` interno
- `503` servicio downstream no disponible
