# MessageMe

Aplicación de mensajería en tiempo real estilo WhatsApp / Discord. Grupos, canales, mensajes directos, estados de entrega (✓✓), subida de archivos y presencia online.

Proyecto académico ST0263 Tópicos Especiales en Telemática — implementación **distribuida en microservicios** (12 servicios MVP) que corre localmente vía Docker Compose.

## Stack

| Capa | Tecnología |
|------|-----------|
| Gateway REST | Node.js + Express (`api-gateway`) |
| Gateway WebSocket | Node.js + Socket.io (`ws-gateway`) |
| Servicios internos | Node.js + TypeScript + gRPC |
| Mensajería asíncrona | Apache Kafka (KRaft, sin Zookeeper) |
| Datos relacionales | PostgreSQL (DB-per-service) |
| Mensajes | MongoDB |
| Estado efímero | Redis |
| Archivos | S3 (AWS, opcional) |
| Frontend | React 18 + Vite + Tailwind + Zustand |

## Arquitectura

Tres ejes de comunicación:

- **REST (vertical, norte-sur)** — cliente ↔ `api-gateway`.
- **gRPC (horizontal, este-oeste)** — servicio ↔ servicio, contratos en [proto/](proto/).
- **Kafka (asíncrono)** — eventos desacoplados, schemas en [events/](events/).

Diagrama y detalles completos en [docs/architecture.md](docs/architecture.md), endpoints REST en [docs/api-rest.md](docs/api-rest.md), flujos Kafka en [docs/events-kafka.md](docs/events-kafka.md).

## Servicios (12 MVP)

| Servicio | Responsabilidad | Datos |
|----------|-----------------|-------|
| [api-gateway](services/api-gateway/) | Punto REST público, valida JWT, rutea a gRPC | — |
| [ws-gateway](services/ws-gateway/) | Conexiones Socket.io, producer/consumer Kafka | — |
| [auth-service](services/auth-service/) | Registro, login, refresh, `ValidateToken` | PostgreSQL |
| [user-service](services/user-service/) | Perfiles, búsqueda | PostgreSQL |
| [presence-service](services/presence-service/) | Online/offline, heartbeats | Redis |
| [group-service](services/group-service/) | Grupos, miembros, roles | PostgreSQL |
| [channel-service](services/channel-service/) | Canales dentro de grupos | PostgreSQL |
| [direct-service](services/direct-service/) | Conversaciones 1-a-1 | PostgreSQL |
| [message-service](services/message-service/) | Persistencia de mensajes, historial | MongoDB |
| [delivery-service](services/delivery-service/) | Estados SENT/DELIVERED/READ | Redis + MongoDB |
| [file-service](services/file-service/) | URLs presignadas S3 | PostgreSQL + S3 |
| [media-processor](services/media-processor/) | Genera WebP thumbnails (Kafka consumer) | S3 |

## Cómo correr todo

### 1. Levantar la infra + los 12 microservicios

```bash
cd infra
cp .env.example .env
docker compose up -d
docker compose ps          # esperar a que todo esté "healthy"
```

Kafka UI disponible en http://localhost:8085 para inspeccionar topics.

Puertos expuestos:
- `api-gateway` → http://localhost:8080
- `ws-gateway` → http://localhost:8081
- Postgres → `localhost:5432` (una DB por servicio)
- MongoDB → `localhost:27017`
- Redis → `localhost:6379`

### 2. Correr el frontend

```bash
cd frontend
cp .env.example .env       # apunta a localhost:8080 y localhost:8081
npm install
npm run dev                # http://localhost:5173
```

Registra dos usuarios en ventanas privadas distintas, abre conversación directa entre ellos y prueba el envío de mensajes con ✓✓.

### 3. Pruebas automatizadas

E2E completo (REST → gRPC → Kafka → WebSocket):

```bash
cd tests
npm install
npm run e2e                # o npm run e2e:verbose
```

Load test (k6 sobre el path REST):

```bash
npm run load               # requiere k6 instalado: brew install k6
```

Detalles en [tests/README.md](tests/README.md).

## Estructura del repo

```
MessageMe/
├── proto/          # Contratos gRPC (.proto) — 9 servicios + tipos comunes
├── events/         # JSON schemas de eventos Kafka (envelope + 8 topics)
├── services/       # Los 12 microservicios MVP
├── shared/         # Librería común: logger, proto-loader, envelope Kafka, ids
├── frontend/       # Cliente React
├── infra/          # docker-compose, scripts de bootstrap, Dockerfile base
├── tests/          # E2E (tsx) + load (k6)
└── docs/           # architecture, api-rest, events-kafka
```

## Convenciones

- **REST solo en `api-gateway`**, los demás servicios solo hablan gRPC.
- **Mensajes siempre por WebSocket**; REST solo para historial paginado.
- **DB-per-service**: ningún servicio lee tablas de otro. Cross-service se hace por gRPC o Kafka.
- **Eventos Kafka**: nombres en pasado (`messages.sent`), particionados por el id que debe preservar orden (`conversation_id` / `channel_id`), consumers idempotentes por `event_id`.
- **Idioma**: código y comentarios en inglés, docs en español.
