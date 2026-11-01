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
| `npm run icons` | regenera los íconos PWA en `public/icons/` |

## Navegación

La app abre directamente en **Estudiar** (`/`). No hay pantalla de inicio con
botones: la navegación vive en tabs con URLs reales, así que back/forward,
deep links y la PWA siguen funcionando.

| tab | URL | contenido |
|---|---|---|
| Estudiar | `/` | tarjeta, métricas, resumen de vuelta |
| Importar | `/import` | pegar/subir CSV o TSV y revisar la vista previa |
| Filtros | `/filters` | lados A/B, categorías, estados y templates |
| Biblioteca | `/library` | buscar, crear, editar, ocultar y exportar tarjetas |

- **Mobile**: barra superior con tema/idioma y tabs fijos abajo (safe-area en
  iOS, targets de al menos 48px).
- **Desktop** (`md`): sidebar fijo a la izquierda y contenido ancho (hasta
  `max-w-5xl`); la tarjeta de estudio mantiene un ancho de lectura cómodo.
- `/study` redirige a `/` para no romper enlaces viejos.

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

Además existe exportación manual CSV/JSON desde la Biblioteca.

## Importación

Pantalla `/import`: se sube un CSV/TSV o se pega el texto.

- **Fila de encabezados**: se usa la **primera fila cuyo primer campo sea un
  marcador de numeración** (`Nº`, `n°`, `n.º`, `Nro`, `No.`, `Número`, `#`).
  Las filas por encima se ignoran. Si no hay marcador, se busca la primera fila
  que parezca un encabezado; como último recurso se usa la fila 1.
- La fila detectada se muestra en la vista previa y se puede **cambiar a mano**
  (1-based) y reanalizar. El commit reutiliza la misma fila.
- Los **nombres de las columnas se toman de esa fila** (no hay nombres fijos):
  el mapeo a los campos de la app se hace por alias ES/EN, sin distinguir
  mayúsculas ni acentos. Si falta una columna requerida, la UI permite
  asignarla a mano.
- La columna de estado de la planilla (`Estado`/`Status`) **se ignora por
  completo**: toda tarjeta nueva entra como `Nueva`, y las existentes conservan
  su estado. `Industry`/`Industria` se aceptan como alias de categoría.
- La vista previa muestra filas válidas, con error y vacías, el detalle de las
  filas problemáticas y (si ya hay datos) cuántas se actualizan, cuántas son
  nuevas y cuántas se conservan. Las filas con error se saltean.
- Reimportar hace merge por la clave normalizada `termEng + termEsp`: actualiza
  categoría, descripción y el texto de los términos, y **conserva** estado,
  oculta, historial y contadores. Las tarjetas que no están en el archivo se
  conservan.

## Estudio

Pantalla `/` (antes `/study`), mobile-first y usable a 360px:

- La tarjeta se voltea tocándola (o con `Espacio`/`Enter`). **Toda** acción de
  estado requiere la tarjeta volteada; si no, se muestra «Girá la tarjeta
  primero». Las flechas mapean `↑` Aprendida (archivar), `↓` Nueva,
  `→` Fácil y `←` Difícil.
- **Gestos**: swipe a la derecha = Fácil, a la izquierda = Difícil, arriba =
  Aprendida, abajo = Nueva. Con la tarjeta sin voltear solo avisan que hay que
  girarla. Ocultar tiene su propio botón.
- **Estado**: la tarjeta muestra categoría/industria y el estado actual. `Fácil`
  y `Difícil` actualizan historial y contadores; `Nueva` y `Aprendida` no.
  `Aprendida` deja de aparecer en el estudio.
- **Repeticiones**: `Nueva` vuelve a aparecer a las 5–10 respuestas (aleatorio)
  en ambos modos. `Difícil` vuelve a las 20–30 respuestas solo en modo
  continuo. Las tarjetas pendientes siempre aparecen antes de terminar la
  vuelta.
- **Modo continuo**: la vuelta no termina hasta que todas las tarjetas queden
  en `Fácil` o `Aprendida`. La cola pendiente se guarda al salir y se retoma al
  volver.
- **Ocultar**: excluye la tarjeta de todos los mazos y templates hasta
  des-ocultarla desde la Biblioteca.
- **Undo**: permanente y multinivel (hasta 20 acciones). Cada cambio de estado
  u ocultar se puede deshacer y vuelve a la tarjeta afectada. Se limpia al
  iniciar una vuelta, repasar o aplicar filtros.
- **Atajos de teclado**: `Espacio`/`Enter` voltear, `→`/`2` Fácil,
  `←`/`1` Difícil, `↑`/`3` Aprendida, `↓`/`4` Nueva, `H` ocultar, `Z` undo. Se
  centralizan en `src/config/keyboard.ts`.
- La sesión se guarda en `session_state` después de cada acción. Al salir no se
  pregunta nada; al volver se ofrece «¿Retomar la sesión actual?». Si se elige
  empezar de cero, se conservan estado, historial y contadores por tarjeta.
- Al terminar una vuelta estándar se muestra un modal con estadísticas y
  checkboxes `Nueva`/`Difícil`/`Fácil` (por defecto Nueva + Difícil) para
  `Empezar` un repaso o `Terminar`. En modo continuo se muestra el resumen con
  `Terminar` y `Nueva vuelta`. Se muestran `Aprendidas: N` durante la vuelta.

## Filtros y templates

Pantalla `/filters`:

- **Lados A/B**: cada lado combina uno o más de `Término inglés`,
  `Término español`, `Descripción`. Un click en el lado opuesto **mueve** el
  campo (sin desmarcar primero); un click en el lado marcado lo quita. Ambos
  lados necesitan al menos un campo.
- **Categorías**: se listan dinámicamente desde las tarjetas, con checkboxes y
  acciones `Todas` / `Ninguna`. `Todas` es dinámico (las categorías nuevas
  entran solas); `Ninguna` deja el mazo vacío.
- **Estados**: checkboxes `Nueva / Fácil / Difícil / Aprendida`, con acciones
  `Todas` / `Ninguna`. El default es `Nueva / Fácil / Difícil` (Aprendida es el
  archivo y queda fuera salvo que se marque). Sin estados el mazo queda vacío
  (es una configuración válida).
- **Modo continuo**: se guarda con la config y con los templates. Si hay una
  vuelta en curso, aplicar filtros pide confirmación y empieza de cero.
- **Aplicar**: guarda la config en la sesión y arranca una vuelta nueva con el
  mazo recalculado.
- **Templates**: guardan lados, categorías, estados y modo continuo bajo un
  nombre único (máx. 80). Acciones: guardar la config actual, aplicar, renombrar,
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

## Biblioteca

Pantalla `/library`:

- **Lista** con búsqueda sin distinguir mayúsculas ni acentos sobre término
  inglés, término español, categoría y descripción, y filtros por categoría,
  estado y visibilidad (`Todas / Visibles / Ocultas`). El filtrado se resuelve
  en el servidor con la misma lógica pura que cubren los tests. En desktop las
  tarjetas se muestran en dos columnas.
- **Alta manual** con término inglés y español obligatorios, categoría libre,
  estado y descripción. El par de términos normalizado es único.
- **Edición** de todos los campos sin reimportar; conserva estado, historial y
  contadores. **Borrado** con confirmación.
- **Ocultas**: se listan con el filtro `Ocultas` y se restauran con `Mostrar`;
  mientras están ocultas siguen excluidas de los mazos.
- **Exportar** todo como CSV (UTF-8 con BOM para planillas) o JSON
  (`{ version, exportedAt, cards }`). Incluye ocultas, historial y contadores;
  es independiente de la base y sirve como backup.

API:

- `GET/POST /api/cards`: listado filtrado / alta manual.
- `PATCH/DELETE /api/cards/:id`: edición parcial (contenido y `hidden`) /
  borrado.
- `GET /api/export?format=csv|json`: backup completo.

## Temas, idioma y accesibilidad

- **Tema oscuro por defecto** y tema claro, con toggle accesible en la barra
  superior (mobile) y en el sidebar (desktop). Los colores son variables CSS
  (`src/app/globals.css`) y el tema elegido se aplica en el servidor
  (`<html data-theme>`), así que no hay flash al cargar.
- **Idioma ES/EN** para toda la interfaz, con selector junto al de tema. El
  diccionario tipado vive en `lib/i18n/dictionary.ts`: español es la fuente y
  inglés debe cubrir las mismas claves (lo verifica un test). El idioma se
  renderiza en el servidor (`<html lang>`).
- Tema e idioma se guardan en `settings` vía `PUT /api/settings`; cambiarlos no
  pierde la vuelta en curso.
- **Accesibilidad**: foco visible en todos los controles, contraste AA, estados
  con ícono además de color (`✓` / `✕` / `🙈`), targets táctiles de al menos
  48px, `prefers-reduced-motion` respetado y safe-area en iOS. Lighthouse da
  100 en accesibilidad, best practices y SEO en las pantallas principales.

## PWA

- `public/manifest.webmanifest`: nombre, `display: standalone`, `start_url`,
  colores de tema y cuatro íconos (192 y 512, `any` + `maskable`).
- `public/sw.js` cachea el app shell (`/`, `/import`, `/filters`, `/library`,
  manifest e íconos). Las navegaciones usan network-first y los assets
  estáticos cache-first; `/api/` nunca se sirve desde caché, así que los datos
  siempre están frescos. No hay modo offline completo en v1.
- El service worker se registra **solo en producción** (no interfiere con el
  hot reload en desarrollo).
- Los íconos se generan sin dependencias con `npm run icons`
  (`scripts/generate-icons.mjs`).
- **Instalación**: `localhost` es contexto seguro, así que la PWA se puede
  instalar desde Chrome/Edge en desktop y desde Android con `localhost` (vía
  `adb reverse`). **Desde el celular por IP de la red local (http) no se puede
  instalar** hasta tener HTTPS. Mientras tanto se puede usar desde el navegador.
  El deploy con HTTPS está planificado como prioridad de la v2.

## Variables de entorno

| variable | default | descripción |
|---|---|---|
| `DATABASE_PATH` | `./data/app.db` | ruta al archivo SQLite (en Docker: `/app/data/app.db`) |
| `BASE_URL` | `http://localhost:3000` | URL pública de la app (v2: OAuth) |
| `APP_PORT` | `3000` | puerto del host para `docker compose` |

## Estructura

```
src/app/            rutas y UI (App Router)
src/app/(app)/      layout persistente con tabs/sidebar y pantallas
src/app/api/        route handlers REST
src/components/     componentes de UI (shell de navegación, tarjeta de estudio,
                    resumen, controles de tema/idioma, registro del service worker)
src/config/         configuración centralizada (atajos de teclado)
src/db/             schema Drizzle, cliente SQLite, migraciones y bootstrap
src/server/         servicios de servidor (importación, estudio, templates,
                    biblioteca, settings)
drizzle/            migraciones SQL versionadas
lib/                lógica de dominio pura (sin React ni DB) + tests
  i18n/             diccionario tipado ES/EN e interpolación
  import/           parser CSV/TSV, fila de encabezados, preview y merge
  library/          validación de tarjetas, filtros y export CSV/JSON
  study/            mazo, vuelta ponderada, historial, undo, resumen y config
  templates/        validación de configs y nombres de templates
scripts/            utilidades (migrate manual, generador de íconos PWA)
public/             manifest, service worker e íconos PWA
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
- [x] **Fase 6** — Biblioteca (alta/edición/borrado, ocultas, export CSV/JSON).
- [x] **Fase 7** — Pulido: temas oscuro/claro, i18n ES/EN, PWA instalable
      (manifest + service worker), accesibilidad AA y revisión final.
- [x] **Fase 8** — Navegación por tabs (bottom en mobile, sidebar en desktop) y
      detección de la fila de encabezados por el marcador `Nº`.
