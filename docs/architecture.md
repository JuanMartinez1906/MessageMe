# MessageMe — Arquitectura de Microservicios

Este documento describe la arquitectura distribuida de MessageMe: 12 microservicios MVP que se coordinan vía REST (externo), gRPC (interno) y Kafka (eventos asincrónicos).

## Diagrama lógico

```
                       ┌──────────────┐
                       │  Frontend    │ (React)
                       │ (Web client) │
                       └──────┬───────┘
                              │ HTTPS REST (vertical, norte-sur)
                              │ + WebSocket
                   ┌──────────┴────────────┐
                   │                       │
            ┌──────▼──────┐         ┌──────▼──────┐
            │ api-gateway │         │ ws-gateway  │
            └──────┬──────┘         └──────┬──────┘
                   │ gRPC (horizontal, este-oeste)
                   │        + Kafka (async events)
   ┌───────────────┼────────────────────────────────────┐
   │               │                                    │
   ▼               ▼                                    ▼
┌──────┐   ┌───────────┐    ┌─────────┐    ┌──────────┐  ┌──────────┐
│ auth │   │ user      │    │ group   │    │ channel  │  │ direct   │
└──┬───┘   └─────┬─────┘    └────┬────┘    └────┬─────┘  └────┬─────┘
   │ PG          │ PG            │ PG           │ PG          │ PG
   ▼             ▼               ▼              ▼             ▼
 (DB-per-service → esquemas aislados, un Postgres local o RDS Multi-AZ en prod)

      ┌──────────────┐     ┌────────────┐     ┌────────────┐
      │ message      │     │ delivery   │     │ presence   │
      └──────┬───────┘     └─────┬──────┘     └─────┬──────┘
             │ Mongo              │ Mongo+Redis      │ Redis
             ▼                    ▼                  ▼

      ┌──────────────┐     ┌────────────────────┐
      │ file-service │◀───▶│  media-processor   │
      └──────┬───────┘     └────────────────────┘
             ▼                    ▼
           S3 (archivos originales + thumbnails WebP)

              Kafka topics (eventos asincrónicos)
 ──────────────────────────────────────────────────────────────
  messages.sent / messages.delivered / messages.read
  files.uploaded / media.ready
  user.presence / group.member_changed / audit.events
```

## Ejes de comunicación

| Eje | Transporte | Uso |
|-----|-----------|-----|
| **Vertical (norte-sur)** | REST sobre HTTP | Cliente externo ↔ api-gateway |
| **Vertical (norte-sur)** | WebSocket | Cliente externo ↔ ws-gateway (tiempo real) |
| **Horizontal (este-oeste) síncrono** | gRPC | Microservicio ↔ microservicio (consultas, validación JWT, lookup de perfiles) |
| **Horizontal asíncrono** | Kafka | Eventos desacoplados (mensaje enviado → fan-out a múltiples consumidores) |

### Cuándo usar cada uno

- **REST** — cuando el cliente externo lo necesita (navegador, app móvil). Solo lo expone el `api-gateway`.
- **gRPC** — entre servicios internos, cuando se necesita respuesta inmediata (ej: `api-gateway` pregunta a `auth-service` si un token es válido). Ventajas: contratos fuertes, streaming nativo, binario compacto.
- **Kafka** — cuando el productor no necesita esperar al consumidor y pueden haber N consumidores del mismo evento. Ej: `message-service` guarda un mensaje y publica `messages.sent`; lo consumen `ws-gateway` (push), `delivery-service` (estados), `notification-service` (push notif), `search-service` (indexado). Si uno falla, los demás no se ven afectados.

## Datos distribuidos

| Motor | Servicios | Razón |
|-------|-----------|-------|
| **PostgreSQL** | auth, user, group, channel, direct, file, audit | Datos relacionales con ACID, baja tasa de escritura |
| **MongoDB** (sharded) | message, delivery | Alto volumen de escritura, schema flexible por tipo de mensaje, particionado por `channelId`/`conversationId` |
| **Redis** (cluster) | presence, typing, cache de sesiones, rate limit | Estructura clave-valor efímera, sub-ms |
| **S3** | file, media-processor | Blob storage durable, URLs firmadas |
| **Elasticsearch** (opcional) | search | Full-text sobre mensajes |

**DB-per-service**: cada microservicio tiene su propia base de datos (o su propio schema), nadie consulta tablas ajenas directamente. Para datos que necesita otro servicio, se pide por gRPC o se consume un evento Kafka.

**Saga / compensación**: operaciones que cruzan servicios (ej: crear grupo + su canal "general") se modelan como sagas coordinadas con eventos Kafka. No usamos 2PC.

## Coordinación (Kubernetes nativo)

- **Service discovery**: DNS de K8s (`auth-service.domain.svc.cluster.local`).
- **Configuración**: `ConfigMap` por servicio.
- **Secretos**: `Secret` + AWS Secrets Manager vía External Secrets Operator.
- **Health checks**: `readinessProbe` y `livenessProbe` HTTP en cada pod.
- **Escalado**: `HorizontalPodAutoscaler` por CPU/memoria; opcionalmente KEDA por lag de Kafka.
- **Alta disponibilidad**: mínimo 2 réplicas + `PodDisruptionBudget`.

## Ejecución

Los 12 servicios MVP están implementados en [../services/](../services/) y se ejecutan juntos con `docker compose -f infra/docker-compose.yml up`. No hay despliegue productivo en la nube — el entregable corre localmente y se valida con los tests E2E en [../tests/](../tests/).

Ver [../.claude/plans/bueno-esta-aplicaci-n-est-shiny-pillow.md](../.claude/plans/bueno-esta-aplicaci-n-est-shiny-pillow.md) para el plan maestro original.
