# MessageMe — Contexto para Claude Code

App de mensajería en tiempo real estilo WhatsApp / Discord. Proyecto académico ST0263 Tópicos Especiales en Telemática (2026-1).

Implementación distribuida en **12 microservicios MVP** que corren localmente vía `docker compose -f infra/docker-compose.yml up`.

## Arquitectura

**Tres ejes de comunicación:**
- **REST = vertical (norte-sur)** — cliente externo → `api-gateway` (único punto REST público).
- **gRPC = horizontal (este-oeste)** — microservicio ↔ microservicio, contratos en `.proto`.
- **Kafka = asíncrono** — eventos desacoplados, fan-out a múltiples consumidores.

**Decisiones tomadas** (no re-preguntar):
- MOM: **Kafka** (KRaft, sin Zookeeper)
- Coordinación: **Kubernetes nativo** (diseño) / **docker-compose** (ejecución local)
- Granularidad: **20 servicios diseñados, 12 MVP implementables**
- Datos: **Mix heterogéneo** — PostgreSQL (relacional) + MongoDB (mensajes, sharded) + Redis (presencia/typing) + S3 (archivos)

**12 servicios MVP**:
1. `api-gateway` — REST público → gRPC interno
2. `ws-gateway` — WebSocket clientes + Kafka producer/consumer
3. `auth-service` — register/login/JWT → PostgreSQL
4. `user-service` — perfiles, búsqueda → PostgreSQL
5. `presence-service` — online/offline, heartbeats → Redis
6. `group-service` — grupos + miembros + roles → PostgreSQL
7. `channel-service` — canales dentro de grupos → PostgreSQL
8. `direct-service` — conversaciones 1-a-1 → PostgreSQL
9. `message-service` — persistencia de mensajes → MongoDB (sharded por channelId/conversationId)
10. `delivery-service` — estados SENT/DELIVERED/READ → Redis + MongoDB
11. `file-service` — URLs presignadas S3 → PostgreSQL + S3
12. `media-processor` — Kafka consumer → Sharp WebP thumbnails → S3

**Otros 8 (diseñados, no implementados)**: contact, typing, notification, search, audit, moderation, logs-aggregator, metrics.

Diagrama completo y flujos en [docs/architecture.md](docs/architecture.md) y [docs/events-kafka.md](docs/events-kafka.md).

## Estructura del monorepo

```
MessageMe/
├── frontend/             # React 18 + Vite + Tailwind + Zustand (cliente)
├── proto/                # Contratos gRPC (.proto) — 9 servicios + common
├── events/               # JSON schemas eventos Kafka (envelope + 8 topics)
├── services/             # 12 microservicios MVP
├── shared/               # Librería compartida: logger (pino), proto-loader, envelope Kafka (builder + parser ajv), ids
├── infra/
│   ├── docker-compose.yml # Postgres + Mongo + Redis + Kafka (KRaft) + Kafka UI + los 12 servicios
│   ├── scripts/          # postgres-init.sql, kafka-topics.sh
│   ├── Dockerfile.node-base # imagen base Node.js
│   └── .env.example      # variables dev
├── tests/                # E2E (tsx) + load (k6)
├── docs/                 # architecture.md, api-rest.md, events-kafka.md
└── .claude/plans/        # plan maestro aprobado
```

## Cómo levantar todo

```bash
# Infra + servicios
cd infra
cp .env.example .env
docker compose up -d
docker compose ps              # esperar a que todo esté healthy
open http://localhost:8085     # Kafka UI

# Frontend
cd ../frontend
cp .env.example .env           # apunta a localhost:8080 + :8081
npm install && npm run dev     # http://localhost:5173

# Tests E2E
cd ../tests
npm install && npm run e2e
```

Bases de datos creadas automáticamente (una por servicio): `messageme_auth`, `messageme_user`, `messageme_group`, `messageme_channel`, `messageme_direct`, `messageme_file`, `messageme_audit`.

Topics Kafka creados automáticamente: `messages.sent`, `messages.delivered`, `messages.read`, `files.uploaded`, `media.ready`, `user.presence` (compacted), `group.member_changed`, `audit.events`.

## Convenciones

- **Idioma**: respuestas al usuario en español, código y comentarios en inglés.
- **Git**: **NO** agregar `Co-Authored-By: Claude` en commits (preferencia del usuario).
- **Commits**: mensajes concisos.
- **REST solo en `api-gateway`**; demás servicios solo hablan gRPC.
- **Mensajes siempre por WebSocket** (no REST); REST solo para historial paginado.
- **Scope de un mensaje**: pertenece a `channel_id` XOR `conversation_id`, nunca ambos.
- **Eventos Kafka**: nombres en pasado (`messages.sent`), particionar por el id lógico que debe preservar orden (`channel_id`/`conversation_id`), consumers idempotentes por `event_id`.
- **DB-per-service**: ningún servicio lee tablas de otro — cross-service se hace por gRPC o Kafka.

## Uso de IA (código de ética del proyecto)

El PDF del proyecto requiere declarar explícitamente qué partes usan IA. **NO se puede usar IA para el núcleo de aprendizaje** (diseño arquitectónico, decisiones clave de sistemas distribuidos, implementación de los mecanismos de comunicación). **Sí se puede usar** para aspectos operativos: scaffolding, Dockerfiles, configuración, traducciones de esquema, generación de stubs gRPC, documentación.
