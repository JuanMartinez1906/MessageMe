# MessageMe

Aplicación de mensajería en tiempo real estilo WhatsApp. Grupos, canales, mensajes con estados de entrega (✓✓), subida de archivos e indicadores de presencia online.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20, Express, TypeScript, Socket.io |
| Base de datos | PostgreSQL + Prisma ORM |
| Auth | JWT (access 15min + refresh 7d) |
| Archivos | Multer + Sharp (WebP) |
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Query |

---

## Requisitos previos

- Node.js >= 20
- PostgreSQL >= 14 corriendo localmente
- npm >= 9

---

## Desarrollo local

### 1. Clonar y configurar entorno

```bash
git clone <repo-url>
cd MessageMe

# Instalar todas las dependencias
npm run install:all

# Configurar variables de entorno del backend
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales
```

### 2. Crear la base de datos

```bash
createdb messageme
cd backend && npx prisma db push && cd ..
```

### 3. Levantar en desarrollo

```bash
npm run dev
```

Esto levanta backend en `http://localhost:3000` y frontend en `http://localhost:5173` simultáneamente.

---

## Variables de entorno

Archivo: `backend/.env`

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://user:pass@localhost:5432/messageme` |
| `JWT_SECRET` | Secreto para access tokens (15 min) | `cadena-aleatoria-larga` |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens (7 días) | `otra-cadena-aleatoria` |
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `FRONTEND_URL` | Origen permitido por CORS | `http://localhost:5173` |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo en bytes | `10485760` (10 MB) |
| `UPLOADS_DIR` | Carpeta de uploads | `./uploads` |

---

## Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro con email, username, displayName, password |
| POST | `/api/auth/login` | Login → access + refresh token |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Marcar offline |
| GET | `/api/auth/me` | Perfil del usuario autenticado |

### Grupos y canales
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/groups` | Crear grupo (crea canal `general` automáticamente) |
| GET | `/api/groups` | Mis grupos |
| GET | `/api/groups/:id` | Detalle del grupo |
| POST | `/api/groups/:id/members` | Agregar miembro (solo ADMIN) |
| DELETE | `/api/groups/:id/members/:userId` | Eliminar miembro (solo ADMIN) |
| POST | `/api/groups/:id/channels` | Crear canal (solo ADMIN) |
| GET | `/api/groups/:id/channels` | Canales del grupo |
| DELETE | `/api/groups/:id/channels/:channelId` | Eliminar canal (solo ADMIN) |

### Mensajería
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/channels/:id/messages` | Historial (cursor pagination) |
| DELETE | `/api/channels/:id/messages/:msgId` | Eliminar mensaje |
| POST | `/api/upload` | Subir archivo/imagen |

### Socket.io — eventos del cliente
| Evento | Payload | Descripción |
|--------|---------|-------------|
| `join-channel` | `{ channelId }` | Unirse a canal |
| `leave-channel` | `{ channelId }` | Salir de canal |
| `send-message` | `{ channelId, content, type, fileUrl?, thumbnailUrl? }` | Enviar mensaje |
| `message-delivered` | `{ messageId }` | Marcar como entregado |
| `message-read` | `{ messageId }` | Marcar como leído |
| `user-typing` | `{ channelId }` | Indicador de escritura |
| `user-stop-typing` | `{ channelId }` | Detener indicador |

### Socket.io — eventos del servidor
| Evento | Descripción |
|--------|-------------|
| `new-message` | Nuevo mensaje en el canal |
| `message-status-updated` | Estado ✓✓ actualizado |
| `user-typing` / `user-stop-typing` | Indicador de escritura |
| `user-online` / `user-offline` | Presencia en tiempo real |

---

## Despliegue en AWS EC2

### Requisitos en la instancia

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# PM2
sudo npm install -g pm2
```

### Pasos de despliegue

```bash
# 1. Clonar repo
git clone <repo-url> && cd MessageMe

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
nano backend/.env   # completar con valores de producción

# 3. Crear base de datos
sudo -u postgres createdb messageme

# 4. Ejecutar deploy
chmod +x deploy.sh && ./deploy.sh

# 5. Configurar PM2 para iniciar con el sistema
pm2 startup && pm2 save
```

### Nginx (proxy inverso recomendado)

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Variables de producción clave

```env
NODE_ENV=production
FRONTEND_URL=https://tu-dominio.com
DATABASE_URL=postgresql://user:password@localhost:5432/messageme
JWT_SECRET=<cadena-aleatoria-64-chars>
JWT_REFRESH_SECRET=<cadena-aleatoria-64-chars>
```
