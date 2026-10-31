# Interprep

Entrenador de terminología para intérpretes — **Modo Repetición Intensivo**.
App web mobile-first, de un solo usuario, para practicar vocabulario por
categorías (Insurance, 911, Court, Medical, Utilities, etc.) en vueltas
ilimitadas, sin repetición espaciada.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite + better-sqlite3 + Drizzle ORM (migraciones versionadas)
- Zod para validar la API
- Vitest para la lógica de dominio (`/lib`)
- Docker multi-stage con `output: "standalone"`

## Requisitos

- Node.js 22+
- npm
- Docker (opcional, para correr en contenedor)

## Desarrollo local

```bash
npm install
cp .env.example .env      # opcional: ajustar DATABASE_PATH
npm run dev
```

La app queda en <http://localhost:3000>. Al arrancar, el servidor aplica las
migraciones pendientes y siembra los datos de primer uso (settings + template
por defecto `Eng → Esp`) automáticamente.

### Scripts

| comando | descripción |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm start` | servidor de producción (requiere build) |
| `npm test` | tests de `/lib` con Vitest |
| `npm run typecheck` | chequeo de tipos |
| `npm run db:generate` | genera una migración a partir del schema Drizzle |
| `npm run db:migrate` | aplica migraciones manualmente |

## Docker

```bash
docker compose up -d --build
```

La app queda en <http://localhost:3000>.

- El archivo SQLite vive en `./data/app.db` (bind mount a `/app/data`), así que
  **recrear el contenedor no pierde datos**.
- Las migraciones corren solas al arrancar.
- `restart: unless-stopped` + healthcheck contra `/api/health`.
- Si el puerto 3000 está ocupado, se puede cambiar el puerto del host:
  `APP_PORT=3100 docker compose up -d --build`.

### Backup

Con la app detenida o en marcha, copiar el archivo:

```bash
# Windows (PowerShell)
Copy-Item .\data\app.db .\data\backup-app.db

# Linux / macOS
cp data/app.db data/backup-app.db
```

SQLite está en modo WAL, por lo que también conviene copiar `app.db-wal` y
`app.db-shm` si la app está corriendo. Alternativa segura:

```bash
docker compose exec app node -e "require('better-sqlite3')('/app/data/app.db').backup('/app/data/backup.db')"
```

Además existe exportación manual CSV/JSON desde la Biblioteca (fase 6).

## Importación

Pantalla `/import`: se sube un CSV/TSV o se pega el texto.

- Las columnas se detectan **por nombre** (no por posición), con alias ES/EN y
  sin distinguir mayúsculas ni acentos. Si falta una columna requerida, la UI
  permite asignarla a mano.
- Estados: `Nueva/Nuevo/New` → `new`, `Aprendiendo/Learning` → `learning`,
  `Aprendida/Aprendido/Learned` → `learned`, vacío → `new`.
- La vista previa muestra filas válidas, con error y vacías, el detalle de las
  filas problemáticas y (si ya hay datos) cuántas se actualizan, cuántas son
  nuevas y cuántas se conservan. Las filas con error se saltean.
- Reimportar hace merge por la clave normalizada `termEng + termEsp`: actualiza
  categoría, descripción y el texto de los términos, y **conserva** estado,
  oculta, historial y contadores. Las tarjetas que no están en el archivo se
  conservan.

## Estudio

Pantalla `/study`, mobile-first y usable a 360px:

- La tarjeta se voltea tocándola (o con `Espacio`/`Enter`). Los resultados
  (`Acierto`/`Fallo`) solo se registran con la tarjeta volteada.
- **Gestos**: swipe a la derecha = acierto, a la izquierda = fallo (solo con la
  tarjeta volteada), swipe hacia arriba = ocultar. Los botones visibles hacen
  lo mismo, sin depender del gesto.
- **Estado manual**: selector `Nueva / Aprendiendo / Aprendida` dentro de la
  tarjeta. Se persiste al instante. Si el estado elegido queda fuera del filtro
  activo, la tarjeta sale de la vuelta restante (con Undo disponible).
- **Ocultar**: excluye la tarjeta de todos los mazos y templates hasta
  des-ocultarla desde la Biblioteca.
- **Undo**: botón visible ~8 s para revertir la última acción (resultado,
  cambio de estado u ocultar). Restaura historial, contadores, estado, la
  vuelta y la tarjeta actual, aunque la tarjeta haya salido por filtros.
- **Atajos de teclado**: `Espacio`/`Enter` voltear, `→`/`2` acierto,
  `←`/`1` fallo, `H`/`↑` ocultar, `Z` undo. Se centralizan en
  `src/config/keyboard.ts`.
- La sesión se guarda en `session_state` después de cada acción: al reabrir se
  retoma con la misma config, orden, tarjeta, lado (volteada o no) y
  contadores.
- Al terminar la vuelta se muestra el resumen (vistas, aciertos, fallos y %)
  con `Nueva vuelta`, `Repasar solo las falladas` (si hubo fallos) y el acceso
  a filtros/templates.

## Filtros y templates

Pantalla `/filters`, accesible desde el inicio, el resumen de vuelta y el
estado de mazo vacío:

- **Lados A/B**: cada lado combina uno o más de `Término inglés`,
  `Término español`, `Descripción`. Un campo marcado en A se deshabilita en B y
  viceversa; ambos lados necesitan al menos un campo.
- **Categorías**: se listan dinámicamente desde las tarjetas, con checkboxes y
  acciones `Todas` / `Ninguna`. `Todas` es dinámico (las categorías nuevas
  entran solas); `Ninguna` deja el mazo vacío.
- **Estados**: checkboxes `Nueva / Aprendiendo / Aprendida`. Sin estados el
  mazo queda vacío (es una configuración válida).
- **Aplicar**: guarda la config en la sesión y arranca una vuelta nueva con el
  mazo recalculado. Cambiar filtros a mitad de vuelta empieza de cero.
- **Templates**: guardan lados, categorías y estados bajo un nombre único
  (máx. 80). Acciones: guardar la config actual, aplicar, renombrar,
  sobrescribir y borrar. Guardar, renombrar y sobrescribir **no** aplican el
  template ni tocan la vuelta en curso; aplicar sí inicia una vuelta nueva y
  recuerda el template como último usado.
- Al abrir la app se retoma la sesión guardada si hay una vuelta en curso; si
  no, se carga el último template usado. En el primer uso existe `Eng → Esp`
  (A: inglés; B: español + descripción).
- Borrar el template aplicado lo desvincula de la sesión sin cambiar la config
  ni la vuelta.

API:

- `GET/PUT /api/session`: config actual + opciones de filtros / aplicar una
  config manual.
- `GET/POST /api/templates`, `PATCH/DELETE /api/templates/:id`,
  `POST /api/templates/:id/apply`.

## PWA

- El `manifest.webmanifest` y el service worker se agregan en la fase 7.
- `localhost` es contexto seguro: la PWA se puede instalar desde Chrome/Edge en
  desktop y desde Android con `localhost` (vía `adb reverse`).
- **Desde el celular por IP de la red local (http) no se puede instalar** hasta
  tener HTTPS. Mientras tanto se puede usar desde el navegador. El deploy con
  HTTPS está planificado como prioridad de la v2.

## Variables de entorno

| variable | default | descripción |
|---|---|---|
| `DATABASE_PATH` | `./data/app.db` | ruta al archivo SQLite (en Docker: `/app/data/app.db`) |
| `BASE_URL` | `http://localhost:3000` | URL pública de la app (v2: OAuth) |
| `APP_PORT` | `3000` | puerto del host para `docker compose` |

## Estructura

```
src/app/            rutas y UI (App Router)
src/app/api/        route handlers REST
src/components/     componentes de UI (tarjeta de estudio, resumen)
src/config/         configuración centralizada (atajos de teclado)
src/db/             schema Drizzle, cliente SQLite, migraciones y bootstrap
src/server/         servicios de servidor (importación, estudio, templates)
drizzle/            migraciones SQL versionadas
lib/                lógica de dominio pura (sin React ni DB) + tests
  import/           parser CSV/TSV, encabezados, preview y merge
  study/            mazo, vuelta ponderada, historial, undo y resumen
  templates/        validación de configs y nombres de templates
scripts/            utilidades (migrate manual)
```

Reglas del proyecto:

- La lógica de dominio vive en `/lib` como funciones puras y se testea con
  Vitest.
- El acceso a datos pasa **siempre** por la capa de repositorio; los route
  handlers no ejecutan queries sueltas.
- La UI está en ES/EN; el código y los commits en inglés.

## Estado por fases

- [x] **Fase 1** — Base: Next.js + Tailwind, Drizzle + SQLite + migraciones,
      Docker/compose, README.
- [x] **Fase 2** — Importador CSV/TSV (parser, encabezados, preview, reimport).
- [x] **Fase 3** — Dominio de estudio en `/lib` (mazo, vuelta ponderada,
      historial, undo, resumen).
- [x] **Fase 4** — UI de estudio mobile-first (tarjeta, volteo, gestos,
      botones, atajos, métricas, resumen, undo, sesión persistida).
- [x] **Fase 5** — Filtros y templates (lados A/B, categorías dinámicas,
      estados, CRUD de templates, aplicar e iniciar vuelta, persistencia).
- [ ] **Fase 6** — Biblioteca (alta/edición/borrado, ocultas, exportar).
- [ ] **Fase 7** — Pulido: temas, i18n, PWA, accesibilidad.
