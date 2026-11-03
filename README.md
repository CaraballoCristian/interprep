# Interprep

Entrenador de terminología para intérpretes — **Modo Repetición Intensivo**.
Ahora es una PWA **multiusuario**: cada persona inicia sesión con Google y ve
solamente sus mazos, tarjetas, plantillas, ajustes y progreso.

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- SQLite + better-sqlite3 + Drizzle ORM
- Better Auth con Google OAuth
- Un solo contenedor Docker; no hace falta una base de datos aparte
- PWA instalable en Android y escritorio, **solo online** (no hay estudio offline)

## Multiusuario y seguridad

- La sesión se valida contra la base de datos en cada request autenticado.
- Todas las consultas y mutaciones reciben un `userId` explícito; no hay datos
  compartidos entre cuentas.
- Al registrarse, cada cuenta recibe su propio mazo `General`, su plantilla
  `Eng → Esp` y sus ajustes.
- `ALLOWED_EMAILS` es opcional:
  - vacío: cualquier cuenta de Google puede registrarse;
  - con valores: solo esos correos pueden entrar o registrarse.
- Las cookies son `httpOnly`, `SameSite=Lax` y se marcan `Secure`
  automáticamente cuando `BETTER_AUTH_URL` usa `https://`.
- El service worker cachea únicamente assets estáticos. Nunca cachea HTML
  autenticado, `/api/` ni respuestas con datos de usuario.
- Corré una sola réplica del contenedor: SQLite no está pensado para varias
  instancias escribiendo el mismo archivo.

## Requisitos

- Node.js 22+
- npm
- Docker (para el despliegue)
- Una cuenta de Google Cloud para crear credenciales OAuth

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

La app queda en <http://localhost:3000>. En el primer arranque se aplican las
migraciones y se crea la base si no existe.

### Crear credenciales de Google

1. Entrá a <https://console.cloud.google.com/apis/credentials>.
2. Creá un **OAuth client ID** de tipo *Web application*.
3. Agregá los redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://TU-DOMINIO/api/auth/callback/google`
4. Copiá `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` al `.env`.

### Variables de entorno

| variable | obligatoria | descripción |
|---|---|---|
| `DATABASE_PATH` | sí | Ruta del archivo SQLite. En Docker: `/app/data/app.db`. |
| `BETTER_AUTH_URL` | sí | URL pública exacta, sin barra final. Ej. `https://interprep.example.com`. |
| `BETTER_AUTH_SECRET` | sí | Secreto aleatorio de 32+ caracteres. Generá uno con `openssl rand -base64 32`. |
| `GOOGLE_CLIENT_ID` | sí | Client ID de Google OAuth. |
| `GOOGLE_CLIENT_SECRET` | sí | Client secret de Google OAuth. |
| `ALLOWED_EMAILS` | no | Lista separada por comas. Vacío = registro abierto. |
| `APP_PORT` | no | Puerto del host para `docker-compose.yml` (default `3000`). |

En producción, si falta una variable obligatoria o el secreto es demasiado
corto, el servidor falla al arrancar con un mensaje claro.

## Docker (local)

```bash
cp .env.example .env
# completá BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
docker compose up -d --build
```

- La app queda en <http://localhost:3000>.
- La base vive en `./data/app.db` (bind mount), así que recrear el contenedor
  no pierde datos.
- Las migraciones corren solas al arrancar.
- Healthcheck contra `/api/health`.
- Si el puerto 3000 está ocupado: `APP_PORT=3100 docker compose up -d --build`.

## Despliegue en Dokploy

El archivo pensado para Dokploy es **`docker-compose.dokploy.yml`**. No tiene
`ports` porque Dokploy enruta el dominio al puerto interno `3000`, y usa un
volumen nombrado (`interprep_data`) para que funcionen los backups de volumen.

1. Creá el servicio en Dokploy apuntando al repositorio.
2. Elegí `docker-compose.dokploy.yml` como Compose path.
3. En la pestaña **Environment**, cargá:
   ```env
   BETTER_AUTH_URL=https://TU-DOMINIO
   BETTER_AUTH_SECRET=<secreto-de-32+-caracteres>
   GOOGLE_CLIENT_ID=<client-id>
   GOOGLE_CLIENT_SECRET=<client-secret>
   ALLOWED_EMAILS=
   ```
4. Configurá el dominio en Dokploy y dejá que emita el certificado TLS.
5. En Google Cloud agregá `https://TU-DOMINIO/api/auth/callback/google`.
6. Desplegá y verificá `https://TU-DOMINIO/api/health`.

Notas:

- No agregues `ports` en Dokploy; el proxy interno se encarga.
- No escales a más de una réplica.
- Activá los backups del volumen `interprep_data` desde Dokploy.
- La primera vez la base arranca **vacía**: no se importan las 1000+ tarjetas
  del `data/app.db` local. Cada usuario empieza con su mazo `General` vacío.

### Migrar datos locales (opcional, manual)

La migración es aditiva: agrega `user_id` como columna nullable y las tablas de
Better Auth. Las filas viejas quedan con `user_id = NULL` y no son visibles para
ninguna cuenta. La app **no** reclama esos datos automáticamente.

Si en algún momento querés conservar tarjetas locales, exportalas desde la app
vieja y volvelas a importar con la cuenta nueva usando **Importar**. No copies
`data/app.db` a producción salvo que sepas exactamente lo que estás haciendo.

## Scripts

| comando | descripción |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm start` | servidor de producción (requiere build) |
| `npm test` | tests de `/lib` y `tests/` con Vitest |
| `npm run typecheck` | chequeo de tipos |
| `npm run db:generate` | genera una migración desde el schema Drizzle |
| `npm run db:migrate` | aplica migraciones manualmente |
| `npm run icons` | regenera los íconos PWA |

`npm start` sirve para probar el build localmente. Next avisa que el modo
`standalone` está pensado para el contenedor; la ruta de producción real es
`docker compose` o la imagen desplegada en Dokploy.

## Navegación

| tab | URL | contenido |
|---|---|---|
| Estudiar | `/` | tarjeta, métricas, resumen de vuelta |
| Importar | `/import` | pegar/subir CSV o TSV y revisar la vista previa |
| Filtros | `/filters` | lados A/B, categorías, estados, mazos y plantillas |
| Biblioteca | `/library` | buscar, crear, editar, ocultar y exportar tarjetas |

`/study` redirige a `/`. Sin sesión, cualquier ruta protegida redirige a
`/login`; las APIs responden `401`/`403`.
