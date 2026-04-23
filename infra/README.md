# infra/ — Desarrollo local

Todo lo necesario para levantar las dependencias de los microservicios localmente.

## Arrancar

```bash
cd infra
cp .env.example .env          # opcional: ajustar si cambias puertos
docker compose up -d
```

Espera a que todos los servicios estén `healthy`:

```bash
docker compose ps
```

El contenedor `kafka-init` es one-shot: crea los topics y termina. Si lo ves en estado `Exited (0)` es correcto.

## Servicios disponibles

| Servicio | Host URL | En red docker | Notas |
|----------|----------|---------------|-------|
| PostgreSQL | `localhost:5432` | `postgres:5432` | User: `messageme` / Pass: `messageme`. Bases ya creadas. |
| MongoDB | `localhost:27017` | `mongo:27017` | ReplicaSet `rs0` auto-iniciado. |
| Redis | `localhost:6379` | `redis:6379` | AOF persistente. |
| Kafka | `localhost:9092` | `kafka:29092` | KRaft mode (sin Zookeeper). |
| Kafka UI | http://localhost:8085 | — | Dashboard web para inspeccionar topics. |

## Verificar que todo funciona

```bash
# PostgreSQL: listar DBs
docker compose exec postgres psql -U messageme -c "\l"

# Mongo: ver estado del replica set
docker compose exec mongo mongosh --eval "rs.status().ok"

# Redis: ping
docker compose exec redis redis-cli ping

# Kafka: listar topics
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Abrir Kafka UI
open http://localhost:8085
```

## Archivos

- `docker-compose.yml` — orquestación local.
- `scripts/postgres-init.sql` — crea una DB por servicio (auth, user, group, channel, direct, file, audit).
- `scripts/kafka-topics.sh` — crea los topics de Kafka (idempotente).
- `Dockerfile.node-base` — imagen base para microservicios Node.js (Fase 1+).
- `.env.example` — plantilla de variables de entorno.

## Reset total

```bash
docker compose down -v   # detiene y BORRA volúmenes (pierdes datos)
docker compose up -d
```

## Siguiente paso

Fase 1: extraer `auth-service` y `user-service` del monolito y engancharlos a estas dependencias.
