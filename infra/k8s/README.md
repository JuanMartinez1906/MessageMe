# MessageMe en Kubernetes (k3d local)

Despliegue de los 12 microservicios + Postgres + MongoDB + Redis + Kafka + LocalStack + frontend en un cluster Kubernetes local con [k3d](https://k3d.io).

## Prerrequisitos

```bash
# Docker Desktop corriendo (mínimo 6 GB RAM en Settings → Resources)
brew install kubectl k3d
```

## 1. Crear el cluster

```bash
k3d cluster create messageme \
  --servers 1 \
  --agents 2 \
  --port "8080:80@loadbalancer"

kubectl get nodes
# Debe mostrar 3 nodos (control-plane + 2 agents) en estado Ready.
```

El flag `--port "8080:80@loadbalancer"` mapea `localhost:8080` del Mac al puerto 80 del ingress de Traefik dentro del cluster — ahí es donde la app va a quedar accesible.

## 2. Construir las imágenes

Los servicios se compilan localmente con docker (no hay registry público). El script lo hace en serie para no quemar la RAM:

```bash
cd MessageMe        # raíz del repo
./infra/build-all-images.sh
```

Demora ~15-25 min la primera vez (12 servicios + frontend, cada uno con `npm install`). Builds posteriores son rápidos por la cache.

Al terminar verás 13 imágenes `messageme/<servicio>:dev`:

```bash
docker images | grep ^messageme/
```

## 3. Importar las imágenes al cluster

k3d corre dentro de Docker pero tiene su propio cache de imágenes (containerd). Hay que "pasarle" las imágenes locales:

```bash
./infra/import-images-to-k3d.sh
```

## 4. Aplicar los manifests

```bash
kubectl apply -f infra/k8s/
```

Esto crea:
- 1 Namespace (`messageme`)
- 1 Secret (JWT y credenciales DB)
- 4 ConfigMaps (config compartida + scripts de init)
- 4 StatefulSets con PVC (postgres, mongo, redis, kafka)
- 1 Deployment de LocalStack
- 6 Jobs one-shot (migrations Prisma + init de Kafka topics + S3 bucket)
- 12 Deployments de microservicios + frontend
- 13 Services
- 1 Ingress

Ver el progreso:

```bash
kubectl get pods -n messageme -w
```

Tarda ~3-5 min hasta que todo esté `Running` y los Jobs `Completed`. Postgres, Mongo y Kafka son los más lentos.

## 5. Probar

```bash
open http://localhost:8080
```

El frontend debe cargar. Registra un usuario, logéate, manda mensajes — igual que con docker-compose pero ahora corriendo en K8s.

Para validar que todo está sano:

```bash
kubectl get pods -n messageme
# Todos en estado Running, los Jobs en Completed.

kubectl logs -n messageme deploy/api-gateway
# Debe mostrar "REST gateway listening on :8080"
```

## Comandos útiles de kubectl

```bash
kubectl get pods -n messageme                  # listar pods
kubectl get pods -n messageme -o wide          # con info de en qué nodo corre cada uno
kubectl describe pod -n messageme <nombre>     # detalle (errores, eventos, condiciones)
kubectl logs -n messageme <nombre>             # logs
kubectl logs -n messageme <nombre> -f          # logs en vivo
kubectl logs -n messageme deploy/api-gateway   # logs del Deployment (cualquier replica)
kubectl exec -it -n messageme <nombre> -- sh   # entrar al pod
kubectl delete pod -n messageme <nombre>       # matar un pod (K8s lo recrea — demo de self-healing)
kubectl get svc -n messageme                   # listar Services (endpoints internos)
kubectl rollout restart deploy/auth-service -n messageme    # reiniciar un servicio
```

Para no escribir `-n messageme` siempre, fija el namespace por defecto:

```bash
kubectl config set-context --current --namespace=messageme
# ahora `kubectl get pods` ya filtra a messageme
```

## Demo de self-healing

```bash
# Mata el pod de auth-service
kubectl delete pod -l app=auth-service

# Mira cómo K8s lo recrea solo en ~10 seg
kubectl get pods -l app=auth-service -w
```

## Limpiar

```bash
# Borra todo el namespace (StatefulSets, PVCs, etc)
kubectl delete namespace messageme

# Borra el cluster k3d completo
k3d cluster delete messageme
```

## Tracing de problemas

| Síntoma | Causa probable | Comando para diagnosticar |
|---------|----------------|---------------------------|
| Pod en `ImagePullBackOff` | la imagen no se importó al cluster | `./infra/import-images-to-k3d.sh` |
| Pod en `CrashLoopBackOff` | el contenedor muere al arrancar | `kubectl logs <pod> --previous` |
| Pod en `Pending` por mucho tiempo | falta espacio o no hay nodo con recursos | `kubectl describe pod <pod>` |
| `connection refused` a postgres/mongo/kafka | el StatefulSet aún no terminó de iniciar | `kubectl get pods -l app=<db>` y esperar a `Running` |
| Frontend abre pero `/api/*` da 502 | api-gateway aún no está `Ready` | `kubectl get pods -l app=api-gateway` |
| Job de migración falla | base de datos aún no responde | `kubectl logs job/<servicio>-service-migrate` |

## Diferencia con docker-compose

| Aspecto | docker-compose | k3d (este setup) |
|---------|----------------|------------------|
| Orquestador | Docker Compose | Kubernetes (k3s) |
| Unidad básica | container | Pod (1 contenedor por pod aquí) |
| Conf. de red | `service_name:port` por DNS de Docker | DNS de K8s (`service.namespace.svc.cluster.local`) |
| Estado | volúmenes Docker | PersistentVolumeClaims (auto-provisionados por k3s `local-path`) |
| Routing externo | port mapping en host | Ingress (Traefik) |
| Self-healing | `restart: unless-stopped` | Deployment ReplicaSet + livenessProbe |
| Escalado | `docker compose up --scale x=3` | `kubectl scale deploy/x --replicas=3` |
| Comando para todo | `docker compose up -d` | `kubectl apply -f infra/k8s/` |

Los manifests de este folder son **idénticos** a lo que aplicarías en EKS o un cluster K8s en EC2s — solo cambia la fase de "construir el cluster".
