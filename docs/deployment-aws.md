# MessageMe — Despliegue en AWS (paso a paso)

Guía para desplegar los 12 microservicios MessageMe en AWS Academy siguiendo el patrón del laboratorio del curso (VPC multi-AZ + bastion host + ALB + Auto Scaling Group).

Arquitectura final:

```
Internet ──▶ ALB (elb-messageme) ──▶ EC2 app (nginx → docker-compose con 12 servicios + PG + Mongo + Redis + Kafka)
                                     ▲
                                     │ administración SSH
                                     └── Bastion Host (subnet pública)
```

Una sola instancia EC2 sirve todo (app + datos). La ASG la reemplaza si muere (self-healing en cualquiera de dos AZs).

---

## 0. Antes de empezar — checklist

- [ ] Cuenta de AWS Academy / Learner Lab activa con al menos $50 de crédito disponible.
- [ ] Región: siempre trabajar en **us-east-1 (N. Virginia)**. Es la única que típicamente permite Academy.
- [ ] Repo de MessageMe **público en GitHub**: https://github.com/JuanMartinez1906/MessageMe.git
- [ ] **Push de todos los cambios locales** antes de empezar (los microservicios, `infra/nginx.conf`, `infra/systemd/messageme.service`, las ediciones del frontend). Si no, la golden EC2 clonará la versión vieja (monolito) y nada va a funcionar. Verifica con `git status` y `git log origin/main..HEAD` — debe decir "nothing to commit" y no debe haber commits pendientes de push.
- [ ] Archivo `.env` de producción listo con secretos fuertes (pasos más abajo).
- [ ] Navegador con dos pestañas: la consola AWS y este documento.

**Nomenclatura que vamos a usar** (copia y pega estos nombres tal cual para no confundirte):

| Recurso | Nombre |
|---------|--------|
| VPC | `MessageMe` |
| Bastion | `i-BastionHost` |
| Golden EC2 | `i-App-base` |
| AMI | `ami-MessageMe` |
| Target Group | `tg-messageme` |
| ALB | `elb-messageme` |
| Launch Template | `lt-messageme` |
| ASG | `asg-messageme` |
| SG del bastion | `SG-BastionHost` |
| SG del ALB | `SG-ALB` |
| SG de la app | `SG-App` |

---

## 1. Iniciar el Learner Lab y entrar a la consola

1. Abre AWS Academy → tu curso → **Modules → Learner Lab**.
2. Click en **Start Lab** (espera que la luz pase de roja a verde, ~1 min).
3. Click en **AWS Details** → copia el botón **AWS** (se abre la consola en una pestaña nueva).
4. Arriba a la derecha de la consola, verifica que dice **N. Virginia** (us-east-1). Si no, cámbiala.

> Si la sesión se caduca (4h máx), todos los recursos **siguen corriendo** pero tienes que hacer **Start Lab** de nuevo para volver a entrar a la consola. No tienes que volver a crear nada.

---

## 2. Bajar la llave SSH (vockey) al computador

AWS Academy te da una llave ya creada llamada `vockey`.

1. En el Learner Lab, click en **AWS Details** → **SSH Key** → **Show** → **Download PEM**.
2. Guarda el archivo en `~/Downloads/labsuser.pem` (o el nombre que descargue).
3. En la terminal de tu Mac:
   ```bash
   mv ~/Downloads/labsuser.pem ~/.ssh/messageme-key.pem
   chmod 400 ~/.ssh/messageme-key.pem
   ssh-add --apple-use-keychain ~/.ssh/messageme-key.pem    # macOS Sonoma+
   # si falla, prueba: ssh-add ~/.ssh/messageme-key.pem
   ```

> Esta llave caduca cada vez que reinicies el lab. Si vuelves mañana, **vuelves a bajar** la misma opción (tendrá el mismo nombre `vockey` pero contenido nuevo). Esto afecta el SSH, **no** afecta que las EC2 sigan corriendo.

---

## 3. Crear la VPC

1. En la consola, busca **VPC** en la barra de arriba.
2. Click en **Your VPCs** (panel izquierdo) → **Create VPC**.
3. Arriba, selecciona **VPC and more** (no "VPC only").
4. Configura exactamente estos valores:

| Campo | Valor |
|-------|-------|
| Auto-generate name tag | `MessageMe` |
| IPv4 CIDR block | `172.16.0.0/16` |
| IPv6 CIDR block | No IPv6 CIDR block |
| Tenancy | Default |
| Number of Availability Zones (AZs) | `2` |
| **Customize AZs**: First AZ | us-east-1a |
| **Customize AZs**: Second AZ | us-east-1b |
| Number of public subnets | `2` |
| Number of private subnets | `2` (el PDF hace 4, nosotros solo 2 porque app y data van juntas) |
| **Customize subnets CIDR blocks** | |
| Public subnet CIDR block in us-east-1a | `172.16.1.0/24` |
| Public subnet CIDR block in us-east-1b | `172.16.4.0/24` |
| Private subnet CIDR block in us-east-1a | `172.16.2.0/24` |
| Private subnet CIDR block in us-east-1b | `172.16.5.0/24` |
| NAT gateways | **1 per AZ** |
| VPC endpoints | **None** |
| DNS options | dejar default (both enabled) |

5. Click **Create VPC**.
6. Espera ~2-3 min a que diga "success" para las 4 subnets, 2 NAT gateways e IGW.

> **Importante**: cada NAT Gateway cuesta ~$0.045/hora. Con 2 corriendo 24/7 son ~$65/mes. El Learner Lab de Academy te cobra de los $100 de crédito, así que si no vas a usar la infra durante el día, apaga las EC2 (no la VPC — los NAT siguen costando). Para la defensa, préndelas unas horas antes.

---

## 4. Security Groups

Necesitas 3 reglas de firewall (security groups):

### 4.1 SG-BastionHost (puerta SSH desde Internet)

1. VPC (menú izquierdo) → **Security Groups** → **Create security group**.
2. Configuración:
   - **Security group name**: `SG-BastionHost`
   - **Description**: `Allow SSH from Internet`
   - **VPC**: selecciona `MessageMe-vpc`
3. **Inbound rules** → **Add rule**:
   - Type: `SSH`
   - Source: `Anywhere-IPv4` (0.0.0.0/0)
4. Outbound rules: déjalas como están (all traffic).
5. Click **Create security group**.

### 4.2 SG-ALB (puerto 80 desde Internet al balanceador)

1. **Create security group**.
2. Configuración:
   - Name: `SG-ALB`
   - Description: `Allow HTTP from Internet to ALB`
   - VPC: `MessageMe-vpc`
3. Inbound rules → **Add rule**:
   - Type: `HTTP`
   - Source: `Anywhere-IPv4`
4. Click **Create security group**.

### 4.3 SG-App (puerto 80 desde el ALB, SSH desde el bastion)

1. **Create security group**.
2. Configuración:
   - Name: `SG-App`
   - Description: `Allow HTTP from ALB and SSH from Bastion`
   - VPC: `MessageMe-vpc`
3. Inbound rules → **Add rule** (×2):
   - **Regla 1**: Type `HTTP`, Source → **Custom**, en el cuadrito escribe `SG-ALB` y selecciona el que aparece en el dropdown (va a autocompletar al ID `sg-xxxxx`).
   - **Regla 2**: Type `SSH`, Source → **Custom**, busca y selecciona `SG-BastionHost`.
4. Click **Create security group**.

> **Referenciar un SG en lugar de una IP** es más seguro y se auto-actualiza cuando el otro SG cambia. Es lo que hace el laboratorio del PDF.

---

## 5. Lanzar el Bastion Host

1. Busca **EC2** en la barra superior.
2. **Instances** (panel izquierdo) → **Launch instances**.
3. Configuración:

| Campo | Valor |
|-------|-------|
| Name | `i-BastionHost` |
| AMI | **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** (free tier eligible) |
| Instance type | `t2.micro` |
| Key pair (login) | `vockey` (la que Academy te da) |
| **Network settings → Edit** | |
| VPC | `MessageMe-vpc` |
| Subnet | `MessageMe-subnet-public1-us-east-1a` |
| Auto-assign public IP | **Enable** |
| Firewall → Select existing security group | `SG-BastionHost` |
| **Configure storage** | 8 GB gp3 |

4. Click **Launch instance**.
5. Espera a que en **Instances** el bastion pase a **Running** + **2/2 checks passed** (~1 min).
6. Copia su **Public IPv4 address** (columna de la tabla). La necesitarás en el próximo paso.

---

## 6. Probar SSH al bastion

Desde tu laptop:

```bash
ssh -A ubuntu@<bastion-public-ip>
# ejemplo: ssh -A ubuntu@54.123.45.67
```

- La bandera `-A` habilita **SSH agent forwarding** (necesario para saltar del bastion a la EC2 privada sin copiar la llave).
- La primera vez pregunta "Are you sure you want to continue connecting?" → escribe `yes` → enter.
- Si entras y ves un prompt `ubuntu@ip-172-16-1-xxx:~$`, todo bien.

**Sale del bastion** con `exit` o `Ctrl+D`. Volveremos después.

---

## 7. Lanzar la Golden EC2 (i-App-base)

Ésta es la instancia donde vas a instalar todo una sola vez, luego la convertimos en AMI para que la ASG la reproduzca.

1. EC2 → **Launch instances**.
2. Configuración:

| Campo | Valor |
|-------|-------|
| Name | `i-App-base` |
| AMI | Ubuntu Server 22.04 LTS |
| Instance type | **t3.medium** (2 vCPU, 4 GB RAM — lo mínimo para docker-compose entero). Si Academy no lo permite, intenta `t3.small` pero vas a tener OOM en Kafka. |
| Key pair | `vockey` |
| **Network settings → Edit** | |
| VPC | `MessageMe-vpc` |
| Subnet | `MessageMe-subnet-private1-us-east-1a` |
| Auto-assign public IP | **Disable** |
| Firewall → Select existing security group | `SG-App` |
| **Configure storage** | **20 GB gp3** (8 GB es muy poco con las imágenes de Kafka/Mongo/Postgres) |

3. Click **Launch instance**.
4. Espera **Running** + **2/2 checks passed**.
5. Copia su **Private IPv4 address** (empieza por 172.16.2.*). La necesitas en el próximo paso.

---

## 8. Conectarse a la Golden desde tu laptop (por el bastion)

Dos ssh encadenados:

```bash
# 1. al bastion (igual que el paso 6)
ssh -A ubuntu@<bastion-public-ip>

# 2. ya dentro del bastion, saltas a la golden
ssh ubuntu@<app-private-ip>
# ejemplo: ssh ubuntu@172.16.2.100
```

Si ves `ubuntu@ip-172-16-2-xxx:~$`, estás dentro de la golden. Todo lo que sigue se ejecuta **dentro de esta sesión**.

---

## 9. Aprovisionar la Golden EC2

Copia y pega estos bloques en orden dentro de la sesión SSH de la golden.

### 9.1 Paquetes base

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nginx
```

### 9.2 Docker + Docker Compose

```bash
# Docker oficial
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# permitir a ubuntu usar docker sin sudo
sudo usermod -aG docker ubuntu

# recargar grupos para la sesión actual
exec sudo -u ubuntu -i
```

> El `exec sudo -u ubuntu -i` te re-loguea como `ubuntu` con el grupo `docker` activo. Tu prompt sigue viéndose igual.

### 9.3 Node.js (para compilar el frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # debería decir v20.x
```

### 9.4 Clonar el repo y compilar el frontend

```bash
cd ~
git clone https://github.com/JuanMartinez1906/MessageMe.git
cd MessageMe/frontend
npm install
npm run build
sudo mkdir -p /var/www/messageme
sudo cp -r dist/* /var/www/messageme/
cd ..
```

### 9.5 Configurar nginx

```bash
sudo cp infra/nginx.conf /etc/nginx/sites-available/messageme
sudo ln -sf /etc/nginx/sites-available/messageme /etc/nginx/sites-enabled/messageme
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # debe decir "syntax is ok" y "test is successful"
sudo systemctl reload nginx
```

### 9.6 Subir el .env de producción

En tu laptop (en otra terminal, **no** dentro de la golden):

```bash
# 1. Crea localmente el archivo de secretos
cp ~/Desktop/Universidad/T.Telematica/MessageMe/infra/.env.example \
   ~/Desktop/Universidad/T.Telematica/MessageMe/infra/.env.production

# 2. Ábrelo y reemplaza los secretos (JWT_SECRET, JWT_REFRESH_SECRET, passwords):
nano ~/Desktop/Universidad/T.Telematica/MessageMe/infra/.env.production
# Para generar secretos fuertes:
openssl rand -hex 32    # úsalo como JWT_SECRET
openssl rand -hex 32    # úsalo como JWT_REFRESH_SECRET

# 3. Súbelo al bastion y del bastion a la golden vía scp (agent forwarding):
scp -o ProxyCommand="ssh -A -W %h:%p ubuntu@<bastion-public-ip>" \
    ~/Desktop/Universidad/T.Telematica/MessageMe/infra/.env.production \
    ubuntu@<app-private-ip>:/home/ubuntu/MessageMe/infra/.env
```

> Nota el destino: `.env` (sin `.production`). docker-compose lee `.env` por defecto.

Verifica en la golden:

```bash
ls -la ~/MessageMe/infra/.env
cat ~/MessageMe/infra/.env | head -5
```

### 9.7 Levantar docker-compose

De vuelta en la sesión SSH de la golden:

```bash
cd ~/MessageMe/infra
docker compose pull
docker compose up -d
```

Espera ~2-3 minutos a que todo levante. Verifica:

```bash
docker compose ps
```

Deberías ver ~21 servicios en estado `running` o `healthy`. Si alguno aparece como `unhealthy`, mira sus logs:

```bash
docker compose logs <nombre-servicio>
```

### 9.8 Instalar el servicio systemd

Para que docker-compose arranque solo cuando la EC2 reinicia (lo cual pasa cuando la ASG lanza una nueva desde la AMI):

```bash
sudo cp ~/MessageMe/infra/systemd/messageme.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable messageme.service
```

### 9.9 Verificar desde dentro

```bash
curl http://localhost/health.html          # → ok
curl http://localhost/                     # → HTML del frontend
curl -X POST http://localhost/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.com","username":"smoke","password":"Password1!","displayName":"smoke"}'
# → {"user":{...},"accessToken":"...","refreshToken":"..."}
```

Si todos los comandos funcionan, **la golden está lista**. Sal con `exit` dos veces (una sale de la golden, otra del bastion).

---

## 10. Crear la AMI desde la Golden

1. EC2 → **Instances** → selecciona `i-App-base` (deja la casilla marcada).
2. Click en **Actions → Image and templates → Create image**.
3. Configuración:
   - **Image name**: `ami-MessageMe`
   - **Image description**: `MessageMe microservices + nginx + docker-compose`
   - **No reboot**: **déjalo desmarcado** (queremos un reinicio limpio para congelar bien los volúmenes de Postgres/Mongo/Kafka).
4. Click **Create image**.
5. Menu izquierdo → **Images → AMIs**. Espera ~5-10 min hasta que `Status = Available`.

---

## 11. Crear el Target Group

1. EC2 → **Load Balancing → Target Groups** (menú izquierdo) → **Create target group**.
2. Configuración:

| Campo | Valor |
|-------|-------|
| Choose a target type | **Instances** |
| Target group name | `tg-messageme` |
| Protocol : Port | HTTP : 80 |
| IP address type | IPv4 |
| VPC | `MessageMe-vpc` |
| Protocol version | HTTP1 |
| **Health checks** | |
| Health check protocol | HTTP |
| Health check path | `/health.html` |
| **Advanced health check settings** (expandir) | |
| Healthy threshold | 2 |
| Interval | 10 seconds |
| Success codes | `200` |

3. Click **Next**.
4. **Register targets**: **no agregues ninguna todavía** (la ASG las va a registrar sola). Click **Create target group**.
5. Una vez creado, abre el target group → pestaña **Attributes** → **Edit**:
   - Busca **Stickiness** → **Enable**
   - Stickiness type: **Application-based cookie**
   - Cookie name: `AWSALB`
   - Stickiness duration: 1 hour
   - Save

---

## 12. Crear el ALB (Application Load Balancer)

1. EC2 → **Load Balancing → Load Balancers** → **Create load balancer**.
2. Elige **Application Load Balancer** → **Create**.
3. Configuración:

| Sección | Campo | Valor |
|---------|-------|-------|
| Basic | Load balancer name | `elb-messageme` |
| Basic | Scheme | **Internet-facing** |
| Basic | IP address type | IPv4 |
| Network mapping | VPC | `MessageMe-vpc` |
| Network mapping | Mappings | Marca **us-east-1a** → `MessageMe-subnet-public1-us-east-1a`; **us-east-1b** → `MessageMe-subnet-public2-us-east-1b` |
| Security groups | | **Quita el default** y selecciona `SG-ALB` |
| Listeners | Listener 1 | Protocol `HTTP`, Port `80`, **Default action → Forward to → `tg-messageme`** |

4. Click **Create load balancer**.
5. En la tabla, copia el **DNS name** del ALB (algo como `elb-messageme-12345.us-east-1.elb.amazonaws.com`). **Guárdalo** — es tu URL pública.

---

## 13. Crear el Launch Template

1. EC2 → **Launch Templates** (menú izquierdo) → **Create launch template**.
2. Configuración:

| Campo | Valor |
|-------|-------|
| Launch template name | `lt-messageme` |
| Template version description | `messageme app EC2 template` |
| Auto Scaling guidance | **Marca la casilla** "Provide guidance to help me set up a template that I can use with EC2 Auto Scaling" |
| **Launch template contents** | |
| AMI | **My AMIs → Owned by me → `ami-MessageMe`** |
| Instance type | `t3.medium` |
| Key pair (login) | `vockey` |
| **Network settings** | |
| Subnet | **Don't include in launch template** (la ASG elige) |
| Security groups | Select existing security group → `SG-App` |
| **Storage (volumes)** | | (ya viene de la AMI, déjalo como está) |
| Resource tags (opcional) | Key `Name`, Value `i-App` |
| Advanced → Instance profile | **LabInstanceProfile** (si aparece) |

3. Click **Create launch template**.

---

## 14. Crear el Auto Scaling Group

1. EC2 → **Auto Scaling Groups** → **Create Auto Scaling group**.
2. **Paso 1 — Launch template**:
   - Name: `asg-messageme`
   - Launch template: `lt-messageme` (Version: Default)
   - **Next**

3. **Paso 2 — Instance launch options**:
   - VPC: `MessageMe-vpc`
   - Availability Zones and subnets: selecciona **las dos privadas** (`MessageMe-subnet-private1-us-east-1a` y `MessageMe-subnet-private2-us-east-1b`)
   - **Next**

4. **Paso 3 — Integrate with other services**:
   - Load balancing → **Attach to an existing load balancer**
   - **Choose from your load balancer target groups**
   - Target groups: `tg-messageme`
   - **Turn on Elastic Load Balancing health checks**
   - **Health check grace period**: `300` segundos (5 min — docker-compose + Kafka tarda)
   - Monitoring: marca **Enable group metrics collection within CloudWatch**
   - **Next**

5. **Paso 4 — Group size and scaling**:
   - **Desired capacity**: `1`
   - **Min desired capacity**: `1`
   - **Max desired capacity**: `1`
   - Scaling policies: **None** (igual que el laboratorio)
   - **Next → Next → Next**

6. **Paso 7 — Add tags**:
   - Key: `Name`, Value: `asg-MessageMe`
   - **Next**

7. **Review** → **Create Auto Scaling group**.

> **Nota sobre escalado**: dejamos `min=max=1` porque los datos (PG, Mongo, Redis, Kafka) viven dentro de la misma EC2. Si ASG lanzara 2 instancias, cada una tendría su propia base y los usuarios en una no verían a los usuarios en la otra. Con `1`, la ASG solo hace self-healing (si la EC2 muere, la reemplaza).

---

## 15. Probar el despliegue

1. Ve a EC2 → **Instances**. Vas a ver que la ASG lanzó una nueva EC2 automáticamente (tiene un Name tag `asg-MessageMe` o similar).
2. Espera ~5 minutos a que pase **2/2 checks**.
3. EC2 → **Target Groups → tg-messageme → Targets**. La nueva EC2 debe aparecer con estado **healthy** (también tarda unos minutos, es normal que primero diga `initial` o `unhealthy`).

Una vez healthy:

4. Abre en el navegador el **DNS name del ALB** que copiaste en el paso 12:
   ```
   http://elb-messageme-xxxxxxx.us-east-1.elb.amazonaws.com/
   ```
5. Debería aparecer la pantalla de login de MessageMe.
6. Registra un usuario, logéate, crea una conversación directa, manda mensajes. Si todo anda, has terminado.

**Apagar la golden** (ya no se usa): EC2 → Instances → `i-App-base` → Actions → Instance state → **Terminate instance**. Eso evita pagar por 2 instancias en paralelo.

---

## 16. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Target group dice "unhealthy" después de 10 min | Docker-compose aún no terminó de levantar | Entra por SSH (bastion → EC2 de la ASG) y corre `docker compose -f ~/MessageMe/infra/docker-compose.yml ps`. Si algo está `unhealthy`, mira los logs |
| EC2 se queda "pending" mucho tiempo | Límite de Academy | El laboratorio a veces limita a 9 vCPUs totales. Apaga otras instancias |
| `connection timed out` al abrir el ALB | SG del ALB no tiene HTTP:80 de Internet, o el ALB quedó en subnets privadas | Revisa SG-ALB y el Mappings del ALB (deben ser las **públicas**) |
| El frontend carga pero `/api/*` devuelve 502 | nginx no está corriendo o docker-compose no levantó | SSH a la EC2: `sudo systemctl status nginx` y `docker compose ps` |
| Socket.io no conecta, queda en "polling" | Falta el listener HTTP en el ALB o falta `location /socket.io/` en nginx | Revisa que el listener del ALB sea HTTP:80 y que el nginx.conf en la EC2 tenga el bloque socket.io |
| Al reiniciar la EC2, docker-compose no arranca | El systemd unit no se instaló | SSH, `sudo systemctl status messageme.service`. Si no existe, vuelve al paso 9.8 |

---

## 17. Cleanup al final del semestre

Para no gastar más crédito:

1. EC2 → Auto Scaling Groups → selecciona `asg-messageme` → **Delete** (esto termina la EC2 también).
2. EC2 → Load Balancers → selecciona `elb-messageme` → **Delete**.
3. EC2 → Target Groups → selecciona `tg-messageme` → **Delete**.
4. EC2 → Launch Templates → **Delete** `lt-messageme`.
5. EC2 → AMIs → selecciona `ami-MessageMe` → **Deregister AMI**.
6. EC2 → Snapshots → borra el snapshot asociado a la AMI.
7. EC2 → Instances → termina `i-BastionHost` si sigue corriendo.
8. VPC → Your VPCs → selecciona `MessageMe-vpc` → **Delete VPC** (borra subnets, IGW, NAT GWs, route tables todo junto).

> Los NAT Gateways son lo más caro. Si el lab acaba hoy, al menos termina los NAT GWs (VPC → NAT Gateways → Delete NAT gateway) aunque dejes el resto.

---

## 18. Re-arrancar en sesiones futuras

El Learner Lab se reinicia cada 4h. Si las EC2s se apagaron porque tu tiempo expiró:

1. **Start Lab** en Academy.
2. Re-descarga la llave (paso 2) — igual la que ya tenías seguirá funcionando.
3. EC2 → Instances → selecciona las que quieras prender → **Instance state → Start**.
4. Espera ~5 min a que nginx y docker-compose arranquen (gracias a systemd del paso 9.8 arrancan solos).
5. Prueba otra vez el DNS del ALB.

Si por alguna razón se terminó (no solo apagó) la EC2 de la ASG, no te preocupes: la ASG lanzará una nueva automáticamente desde la AMI.
