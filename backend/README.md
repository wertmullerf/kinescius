# Kinesius - Backend

API REST con Express + TypeScript + Prisma + PostgreSQL.

---

## Requisitos previos

- Node.js 20+
- Docker y Docker Compose

---

## Inicialización del proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` si se quieren cambiar credenciales. Por defecto:

```env
POSTGRES_USER=kinesius_user
POSTGRES_PASSWORD=kinesius_password
POSTGRES_DB=kinesius_db
DATABASE_URL="postgresql://kinesius_user:kinesius_password@localhost:5432/kinesius_db"
PORT=3000
JWT_SECRET=cambia_esto_por_un_secreto_seguro
JWT_EXPIRES_IN=8h
```

> **Importante:** `JWT_SECRET` debe cambiarse por un valor seguro antes de ir a producción.

### 3. Levantar la base de datos con Docker

Desde la raíz del repositorio (`kinescius-proyecto/`):

```bash
docker compose up -d postgres
```

Esto levanta PostgreSQL en `localhost:5432` y persiste los datos en un volumen Docker.

### 4. Correr las migraciones

```bash
npm run db:migrate
```

### 5. Cargar datos de prueba (seed)

```bash
npm run db:seed
```

O usando Docker (corre el seed en un contenedor, útil en CI):

```bash
docker compose up seed
```

### 6. Iniciar el servidor en desarrollo

```bash
npm run dev
```

El servidor queda disponible en `http://localhost:3000`.

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en desarrollo con hot-reload (nodemon) |
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm start` | Ejecutar build compilado |
| `npm run db:migrate` | Aplicar migraciones de Prisma |
| `npm run db:seed` | Cargar datos de prueba |
| `npm run db:studio` | Abrir Prisma Studio (explorador visual de BD) |

---

## Docker

El `docker-compose.yml` está en la raíz del repositorio (`kinescius-proyecto/`).

```bash
# Levantar solo la base de datos
docker compose up -d postgres

# Levantar la BD y correr el seed de una vez
docker compose up -d postgres && docker compose up seed

# Detener todo
docker compose down

# Detener y borrar el volumen (borra todos los datos)
docker compose down -v
```

---

## Usuarios de prueba

Luego de correr el seed, los siguientes usuarios están disponibles:

| Rol | Email | Password | Detalle |
|---|---|---|---|
| ADMIN | `laura@kinesius.com` | `admin1234` | Administrador del sistema |
| PROFESOR | `profesor@kinesius.com` | `profesor1234` | Cuenta compartida para registrar asistencia |
| CLIENTE | `carlos@mail.com` | `cliente1234` | Abonado |
| CLIENTE | `ana@mail.com` | `cliente1234` | Abonado |
| CLIENTE | `lucas@mail.com` | `cliente1234` | No abonado |
| CLIENTE | `sofia@mail.com` | `cliente1234` | No abonado |

