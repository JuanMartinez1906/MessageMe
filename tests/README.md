# MessageMe — Tests

Dos niveles de pruebas contra el stack de microservicios:

1. **`e2e/messaging-flow.ts`** — integración end-to-end que toca api-gateway, auth,
   user, direct, message, delivery, ws-gateway y Kafka en un solo flujo.
2. **`load/k6-messaging.js`** — carga sobre el camino REST (auth + user +
   direct-service) con métricas de latencia por endpoint.

No hay unit tests por servicio — el E2E ejercita la integración real, que es lo
que importa para un MVP académico. Si después se requiere cobertura por
servicio, se agrega como trabajo futuro.

## Prerequisitos

```bash
# Desde la raíz del repo
cd infra
cp .env.example .env
docker compose up -d
docker compose ps   # esperar "healthy" en todos
```

Instala dependencias de tests (se necesitan para el E2E):

```bash
cd tests
npm install
```

Para el load test necesitas k6:

```bash
brew install k6
```

## E2E

```bash
cd tests
npm run e2e            # normal
npm run e2e:verbose    # con logs intermedios (LOG=1)
```

Salida esperada:

```
→ registering alice_xxxx + bob_xxxx
→ creating DM conversation
→ both join conversation room
→ alice sends TEXT message
✓ bob received message <id>
→ bob emits message-delivered
✓ alice received message-delivered for <id>
→ cleanup

E2E PASSED
```

Exit code `0` en éxito, `1` en falla. El script imprime qué paso falló y su
stack trace.

Flujo validado:

1. `POST /api/auth/register` x2 (api-gateway → auth-service gRPC)
2. Socket.io connect x2 con JWT en handshake (ws-gateway valida contra auth-service)
3. `POST /api/conversations` (api-gateway → direct-service gRPC)
4. `join-conversation` x2 (ws-gateway)
5. `send-message` (ws-gateway → message-service gRPC → MongoDB → Kafka
   `messages.sent` → ws-gateway consumer → push a ambos participantes)
6. `message-delivered` (ws-gateway → delivery-service gRPC → Redis +
   Mongo → Kafka `messages.delivered` → ws-gateway consumer → push al sender)

## Load test

```bash
cd tests
npm run load
# o directo:
k6 run load/k6-messaging.js
```

Variables opcionales:

- `API_URL` — default `http://localhost:8080/api`.

Perfil de carga (configurable en `options.scenarios.steady` del script):

| Etapa | Duración | VUs |
|-------|----------|-----|
| ramp-up | 15s | 0 → 10 |
| ramp-up | 30s | 10 → 25 |
| ramp-up | 30s | 25 → 50 |
| ramp-down | 15s | 50 → 0 |

Cada VU: login → `GET /users/me` → `GET /conversations` → sleep 0.5–2s.

Thresholds (falla el run si no se cumplen):

- `http_req_failed < 2%`
- `http_req_duration p(95) < 800ms`
- `login_duration p(95) < 600ms`
- `me_duration p(95) < 400ms`
- `conversations_duration p(95) < 500ms`

El summary final de k6 muestra métricas por endpoint (`login_duration`,
`me_duration`, `conversations_duration`) gracias a los `Trend` custom.

## Qué NO prueba este stack

- **WS throughput bajo carga** — k6 no habla socket.io nativamente. El E2E
  valida la correctitud del path WS; si se necesita load sobre WS, usar
  `xk6-socketio` o un script node custom con N clientes `socket.io-client`.
- **Particionamiento Kafka** — la verificación de orden por `conversation_id`
  se asume por configuración (partitioning key), no se prueba explícitamente.
- **Recuperación ante caída de servicios** — tests de chaos no están en
  este entregable.
