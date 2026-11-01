# SPEC: Interpreter Terminology Trainer (Tool 1: Modo Repetición Intensivo)

## 0. Instrucciones para el agente (opencode)

- Trabajá **por fases** (sección 11). Al terminar cada fase: que compile, que los tests pasen, commit con mensaje claro, y recién ahí seguí.
- **No inventes comportamiento.** Si algo es ambiguo o falta definir, preguntá antes de implementar.
- Separá la **lógica de dominio** (armado de vueltas, importador, historial, undo) en funciones puras en `/lib`, sin dependencias de React ni de la DB, y cubrila con tests unitarios (Vitest).
- Los criterios de aceptación (✔) de cada feature son la definición de "terminado".
- Idioma del código y commits: inglés. Idioma de la UI: ES/EN (ver 8).

---

## 1. Visión y contexto

App web para estudiar terminología específica de interpretación (Insurance, 911, Court, Medical, Utilities, etc.), usada por una sola persona (el dueño), principalmente desde el celular.

- **Sin repetición espaciada** ni "volvé mañana". El usuario controla el ritmo al 100% y puede ciclar indefinidamente.
- **Mobile first**: se diseña primero para ~360px de ancho y uso con una mano; desktop es la adaptación.
- **Un solo usuario** en v1: sin login. Dejar el diseño de DB y la capa de acceso a datos preparados para agregar `userId` más adelante, pero **no implementarlo**.
- **PWA local**: se instala y se abre con un ícono. Deploy a un servidor queda para más adelante.

---

## 2. Stack (decidido)

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Front y API (route handlers) en un solo proyecto. `output: "standalone"` para Docker.
- **SQLite** con **better-sqlite3** + **Drizzle ORM** (migraciones versionadas). Archivo en `/app/data/app.db`.
- **Zod** para validar el input de la API.
- **@use-gesture/react + motion (framer-motion)** para swipe y animaciones.
- **PapaParse** para CSV/TSV.
- **i18n**: diccionario tipado propio (es/en) con un context, sin librerías pesadas.
- **PWA**: `manifest.webmanifest` + service worker propio mínimo (o Serwist si simplifica).
- **Tests**: Vitest para `/lib`.
- **Docker**: Dockerfile multi-stage (usar una imagen que compile bien `better-sqlite3`, por ejemplo `node:22-bookworm-slim`) + `docker-compose.yml`.

### Docker / ejecución local

- `docker-compose.yml` con: puerto 3000, volumen `./data:/app/data` (persistencia del `.db`), `restart: unless-stopped`.
- Las migraciones corren automáticamente al arrancar.
- README con: cómo levantar (`docker compose up -d --build`), cómo instalar la PWA, cómo hacer backup.

✔ `docker compose up -d --build` deja la app en `http://localhost:3000`.
✔ Si se recrea el contenedor, los datos siguen ahí.

---

## 3. Modelo de datos

### `cards`
| campo | tipo | notas |
|---|---|---|
| id | text (uuid) | PK |
| category | text | viene de la columna del Sheet; texto libre |
| termEng | text | requerido |
| termEsp | text | requerido |
| description | text | puede ser vacío |
| status | enum | `new` \| `easy` \| `hard` \| `learned` (default `new`) |
| hidden | boolean | **ortogonal al estado**; default false |
| history | json | **últimos 10** resultados: array de `"s"` \| `"f"` (el más reciente al final) |
| totalSuccess | integer | contador acumulado |
| totalFail | integer | contador acumulado |
| createdAt / updatedAt | text ISO | |

Índice único lógico de matching: `normalize(termEng) + normalize(termEsp)` (trim, minúsculas, sin acentos, espacios colapsados).

### `templates`
| campo | tipo | notas |
|---|---|---|
| id | text (uuid) | |
| name | text | libre, único |
| sideA | json | array no vacío de `"termEng"` \| `"termEsp"` \| `"description"` |
| sideB | json | array no vacío, sin solapar con sideA |
| categories | json \| null | `null` = todas |
| statuses | json | subset de `new/easy/hard/learned`; default `new/easy/hard` |
| continuous | boolean | la vuelta no termina hasta que todo quede `easy` o `learned`; default false |
| createdAt / updatedAt | text ISO | |

### `settings` (clave/valor, un solo registro lógico)
`theme` (`dark`|`light`, default `dark`), `language` (`es`|`en`), `lastTemplateId`.

### `session_state` (un solo registro)
Estado de la vuelta en curso, serializado: config activa (lados, categorías, estados, modo continuo), cola de tarjetas, repeticiones pendientes (`new` 5–10 respuestas; `hard` 20–30 en continuo), respuestas y estado final por tarjeta, contadores de la sesión, si la tarjeta está volteada, pila de undo (máx. 20) y si corresponde ofrecer retomar la sesión. Se guarda tras cada acción.

---

## 4. Importación (solo primera vez)

No hay "sincronización" con el Sheet ni modal de sync. Existe una pantalla de **Importar** (CSV/TSV subido o pegado).

1. **Detección de encabezados**: mapear por **nombre de columna**, no por posición. Aliases (sin distinguir mayúsculas ni acentos):
   - categoría: `categoría`, `category`, `industria`, `industry`
   - inglés: `inglés`, `ingles`, `english`, `term eng`, `término inglés`
   - español: `español`, `espanol`, `spanish`, `term esp`, `término español`
   - descripción: `descripción`, `description`
2. Si algún encabezado requerido no se reconoce: mostrar un **selector por columna** para asignarlo manualmente.
3. **Estado**: la columna `estado`/`status` del Sheet **se ignora**. Toda tarjeta nueva entra como `new`; las existentes conservan su estado.
4. **Vista previa** antes de confirmar: primeras filas ya interpretadas, conteo de filas válidas / con error / vacías, y detalle de las filas con problema (campo requerido vacío). Las filas con error se **saltean** (no bloquean el import).
5. **Reimportar**: si ya hay datos, se puede importar de nuevo con una advertencia clara. Para cada fila:
   - **Coincide** (por la clave normalizada de `termEng + termEsp`) → se actualizan `category` y `description` (y el texto de los términos); se **conservan** `status`, `hidden`, `history` y contadores.
   - **No coincide** → se inserta como tarjeta nueva con estado `new`.
   - Tarjetas que existen en la app pero **no vienen** en el archivo → **se conservan** (no se borran).
6. La vista previa del reimport muestra cuántas se actualizan, cuántas son nuevas y cuántas se conservan sin cambios.

✔ Un CSV con columnas en otro orden o con una columna extra se importa bien.
✔ "nueva", "New" y "Nueva" se interpretan igual.
✔ Reimportar el mismo archivo no cambia estados ni historiales.
✔ Las filas con error se listan y no frenan el import.

---

## 5. Motor de estudio

### 5.1 Lados A / B
- Cada lado combina uno o más campos entre `Término Inglés`, `Término Español`, `Descripción`.
- **Exclusión mutua**: un campo marcado en A queda deshabilitado en B y viceversa.
- Ambos lados deben tener al menos un campo.
- Cada tarjeta se muestra **primero solo con el lado A**. Al hacer **click (desktop) o tocar (mobile)** la tarjeta, se revela el **lado B** (volteo con animación; el lado B reemplaza al A). Otro tap vuelve al lado A. En desktop, `Espacio`/`Enter` hace lo mismo.
- Mientras se ve solo el lado A, el contenido del lado B **no** debe estar visible ni accesible en pantalla.

✔ Al aparecer una tarjeta nueva siempre se ve el lado A.
✔ Un tap/click muestra el lado B; otro vuelve al A.

### 5.2 Mazo
Una tarjeta entra al mazo si cumple **todo**: `hidden = false`, su `status` está en los estados seleccionados, su `category` está en las categorías seleccionadas (o "todas").

### 5.3 Vuelta (round)
- **Vuelta estándar**: recorre todas las tarjetas del mazo una vez. `Nueva` se reprograma a las 5–10 respuestas; `Difícil` no se repite.
- **Modo continuo**: la vuelta no termina hasta que **todas** las tarjetas del mazo queden en `Fácil` o `Aprendida`. `Nueva` se reprograma a las 5–10 respuestas y `Difícil` a las 20–30.
- Las repeticiones pendientes siempre se muestran antes de que la vuelta pueda terminar.
- Al terminar la vuelta se muestra el **modal de resumen** (ver 5.7).
- Cambiar filtros, categorías, estados o template a mitad de vuelta **inicia una vuelta nueva** con el mazo recalculado.

### 5.4 Orden dentro de la vuelta
Orden **aleatorio ponderado**, calculado al inicio de la vuelta:
- `peso = 1 + (cantidad de "f" en el history de las últimas 10)`.
- Algoritmo sugerido (Efraimidis–Spirakis): para cada tarjeta `clave = random()^(1/peso)`; ordenar por clave descendente.
- El orden inicial queda fijo durante la vuelta (y se guarda en `session_state`). Las repeticiones se insertan dinámicamente según su demora.

✔ Tests: la cola inicial no tiene ids repetidos y están todos los del mazo.
✔ Tests: con muchas simulaciones, las tarjetas de mayor peso aparecen en promedio antes.

### 5.5 Evaluación
- **Fácil** / **Difícil**: se agrega `"s"`/`"f"` al `history` (si pasa de 10, se descarta el más antiguo), se incrementa el contador total correspondiente y se pasa a la siguiente tarjeta. `Nueva` y `Aprendida` no tocan history ni contadores.
- Las acciones de estado se registran **solo** con la tarjeta volteada; si no, se muestra «Girá la tarjeta primero».
- La tarjeta muestra el historial visual (ej. `✓ ✓ ✕ ✓`) con **íconos**, no solo color, y también categoría/industria y estado actual.

### 5.6 Estado, ocultar y Undo
- **Cambio de estado**: flechas en la tarjeta (`↑` Aprendida, `↓` Nueva, `→` Fácil, `←` Difícil) más swipe en la misma dirección. Se persiste **inmediatamente**, sin modales. El estado **nunca** cambia solo ni se sugiere.
- `Aprendida` es el estado de archivo: deja de aparecer en el estudio salvo que se seleccione explícitamente en los filtros.
- En modo continuo, si el nuevo estado queda fuera del filtro activo, la tarjeta sale del mazo restante.
- **Ocultar** (`hidden = true`): excluye la tarjeta de **todos** los mazos y templates presentes y futuros, hasta que se des-oculte desde la Biblioteca (ver 7). Es independiente del estado.
- **Undo**: permanente y multinivel (máx. 20 acciones). Revierte la última acción (estado u ocultar), restaura history/contadores/estado y vuelve a la tarjeta afectada, aunque haya salido por filtros. Se limpia al iniciar vuelta, repasar o aplicar filtros.

✔ Ocultar una tarjeta en un template la oculta en todos los demás.
✔ Undo de un cambio de estado restaura history, contadores, estado y la tarjeta actual.
✔ Cambiar estado no abre ningún modal.

### 5.7 Pantalla de resumen (fin de vuelta / mazo vacío)
- **Fin de vuelta estándar**: modal con tarjetas vistas, aciertos, fallos, % de acierto y conteo final por estado. Checkboxes `Nueva`/`Difícil`/`Fácil` (default: Nueva + Difícil) con `Empezar` para repasar esos estados de la vuelta recién terminada, y `Terminar` para cerrar la sesión e ir a la Biblioteca.
- **Fin de vuelta continua**: modal con las mismas estadísticas y `Terminar` (más `Nueva vuelta`).
- **Mazo vacío** (los filtros no devuelven tarjetas): mensaje claro y acceso directo a los filtros.

### 5.8 Métricas de sesión
Visibles durante el estudio: progreso (`vistas / total`), aciertos, fallos, `Aprendidas: N` y % de acierto de la vuelta actual.

### 5.9 Persistencia de la sesión
Al salir no se pregunta nada: la sesión se conserva. Al volver se pregunta **«¿Retomar la sesión actual?»**. Si se elige empezar de cero, se conservan estado, historial y contadores por tarjeta; la cola pendiente de `Nueva`/`Difícil` se descarta con la vuelta.

---

## 6. Filtros y Templates

### Filtros
- **Categorías**: desplegable con checkboxes (multiselección). Default: "Todas". Incluir "Seleccionar todas / ninguna". Las categorías se listan dinámicamente a partir de las tarjetas.
- **Estados**: checkboxes `Nueva` / `Fácil` / `Difícil` / `Aprendida`, con `Todas` / `Ninguna`. Default: `Nueva` / `Fácil` / `Difícil`.
- **Modo continuo**: checkbox que se guarda con la config y con los templates.
- Si hay una vuelta en curso, aplicar filtros pide confirmación.

### Templates
- Un template guarda: **lado A, lado B, categorías, estados y modo continuo**, bajo un nombre libre (ej. "spa first_1", "banana").
- Acciones: guardar el config actual como template, aplicar, renombrar, sobrescribir y borrar.
- **Al aplicar un template se carga toda la config de una y se inicia una vuelta nueva.**
- Al abrir la app se carga automáticamente el **último template usado** (o la config de la sesión guardada, si hay una vuelta en curso).
- Primer uso: existe un template por defecto `Eng → Esp` (A: Término Inglés; B: Término Español + Descripción).

✔ Crear "banana", cerrar la app, reabrir y volver a elegirlo restaura lados, categorías y estados exactos.
✔ Un campo no puede estar en A y B a la vez (no se puede guardar un template inválido).

---

## 7. Biblioteca (gestión de tarjetas)

Pantalla separada, accesible desde el menú:
- Lista con búsqueda y filtros (categoría, estado, ocultas).
- **Alta manual** de tarjeta, **edición** (todos los campos) y **borrado** con confirmación.
- Vista de **ocultas** con acción para **des-ocultar**.
- **Exportar** todo (CSV y JSON) como backup. Es independiente de la DB.

✔ Corregir un typo no requiere reimportar.
✔ Una tarjeta oculta se puede recuperar desde la Biblioteca.

---

## 8. UI/UX

### Mobile first
- Layout pensado para 360–430px; la tarjeta ocupa la mayor parte del viewport. Respetar `safe-area-inset`. Áreas táctiles ≥ 48px.
- **Texto grande y legible**; si la descripción es larga, la tarjeta hace **scroll interno** sin romper el layout.
- Prioridad de reach con el pulgar: acciones principales abajo.

### Gestos (mobile)
- **Tap** en la tarjeta → voltear.
- **Swipe derecha** → `Fácil`. **Swipe izquierda** → `Difícil`. **Swipe arriba** → `Aprendida`. **Swipe abajo** → `Nueva`. Solo con la tarjeta volteada; si no, avisan que hay que girarla.
- **Ocultar** tiene un botón propio.
- Feedback durante el gesto: la tarjeta se inclina y aparece un overlay con **ícono + color** (→ Fácil, ← Difícil, ↑ Aprendida, ↓ Nueva). Umbral de activación para evitar disparos accidentales; si no se supera, la tarjeta vuelve a su lugar.
- **Botones visibles** (D-pad de 4 flechas) como alternativa a los gestos (no depender solo del swipe).
- Respetar `prefers-reduced-motion`.

### Atajos de teclado (desktop)
| tecla | acción |
|---|---|
| `Espacio` / `Enter` | voltear |
| `→` o `2` | Fácil |
| `←` o `1` | Difícil |
| `↑` o `3` | Aprendida |
| `↓` o `4` | Nueva |
| `H` | ocultar |
| `Z` | undo |

(Fáciles de cambiar: centralizarlos en un único archivo de config.)

### Temas y accesibilidad
- **Modo oscuro por defecto** (fondo muy oscuro, ej. `#0f172a`/`#121212`, contrastes suaves) y **modo claro**; toggle accesible. Colores como variables CSS.
- **Daltonismo**: todo estado o acción tiene ícono además de color (✓ / ✕ / ocultar). Contraste AA como mínimo.

### i18n
- Selector **ES / EN** en el header para **todos** los textos de la interfaz. Se persiste en `settings`.

✔ Toda la app es usable con una mano en 360px.
✔ Cambiar de idioma/tema no pierde la vuelta en curso.

---

## 9. PWA

- `manifest.webmanifest`: nombre, `display: standalone`, `start_url`, colores de tema, íconos 192 y 512 (incluir **maskable**).
- Service worker que cachea el **app shell** (la app abre y se ve instantáneo). Los datos siempre vienen de la API; v1 **no** requiere modo offline completo.
- Instalable desde Chrome/Edge en desktop y Android (ícono en el escritorio o pantalla de inicio, abre sin barra del navegador).
- Documentar en el README la nota sobre HTTPS: `localhost` es contexto seguro y permite instalar; **desde el celular por IP de la red local (http) no se podrá instalar como PWA** hasta tener HTTPS (deploy, o un túnel/mkcert). Mientras tanto se puede usar igual desde el navegador. El deploy con HTTPS está planificado como prioridad en la **v2 (sección 13)**.

✔ La app se instala desde `localhost` y abre en ventana propia.
✔ Lighthouse detecta la PWA como instalable.

---

## 10. API (guía)

Route handlers REST, validados con Zod, sobre una **capa de repositorio** (para poder cambiar la DB o agregar `userId` después):

- `GET/POST /api/study`: vista de la vuelta actual y acciones (`flip`, `status`, `hide`, `undo`, `new-round`, `review`, `resume`, `reset`, `finish`, `leave`)
- `GET/POST /api/cards`, `PATCH/DELETE /api/cards/:id`
- `POST /api/import/preview`, `POST /api/import/commit`
- `GET /api/export?format=csv|json`
- `GET/POST /api/templates`, `PATCH/DELETE /api/templates/:id`, `POST /api/templates/:id/apply`
- `GET/PUT /api/settings`, `GET/PUT /api/session`

---

## 11. Fases de desarrollo

1. **Base**: scaffold Next.js + Tailwind, Drizzle + SQLite + migraciones, Docker/compose, README inicial.
2. **Importador**: parser, detección de encabezados, normalización, vista previa, import y reimport. Tests.
3. **Dominio de estudio** (`/lib`): armado de mazo, vuelta ponderada, historial, undo, resumen. Tests.
4. **UI de estudio mobile-first**: tarjeta, volteo, gestos, botones, atajos, métricas, pantalla de resumen, undo.
5. **Filtros y templates**, persistencia de sesión.
6. **Biblioteca**: alta/edición/borrado, ocultas, exportar.
7. **Pulido**: temas, i18n ES/EN, PWA, accesibilidad, revisión final contra los criterios de aceptación.

---

## 12. Fuera de alcance (v1)

Autenticación y multiusuario (ver v2, sección 13), deploy a producción (ver v2), repetición espaciada, sugerencias automáticas de cambio de estado, sincronización bidireccional con Google Sheets, modo offline completo con datos.

### Preparación para v2 que SÍ va en v1 (barato, evita retrabajo)
- Toda la configuración por **variables de entorno** (`DATABASE_PATH`, `BASE_URL`, etc.), sin rutas ni URLs hardcodeadas. El front usa URLs **relativas** para la API.
- Endpoint `GET /api/health` (devuelve 200 si la app y la DB responden).
- Acceso a datos **solo** a través de la capa de repositorio (sin queries sueltas en route handlers), para poder inyectar el `userId` en un solo lugar después.

---

## 13. v2: Deploy + OAuth (prioridad alta)

**Motivo:** el uso principal es desde el celular, y la PWA solo se instala desde mobile con **HTTPS**. Por eso el deploy se hace lo antes posible, apenas la v1 esté estable.

### 13.1 Deploy
- Servidor con **HTTPS** y dominio (o subdominio) propio. Con HTTPS la PWA pasa a ser instalable desde el celular.
- **SQLite se mantiene**, lo que obliga a: **una sola instancia** de la app y **disco persistente** montado (el `.db` no puede vivir en un filesystem efímero). Opciones a evaluar (decisión pendiente): VPS propio con Docker + reverse proxy (Caddy/Traefik, HTTPS automático), o una plataforma con volúmenes persistentes (Fly.io, Railway, etc.).
- Reutilizar el mismo `Dockerfile`/`docker-compose.yml` de v1.
- **Backups automáticos** de la DB (copia programada del archivo con `sqlite3 .backup`, o Litestream hacia almacenamiento externo), más el export CSV/JSON manual que ya existe.
- Variables de entorno de producción documentadas en el README (`BASE_URL`, secretos de OAuth, secreto de sesión).

### 13.2 Autenticación (OAuth)
- Login con **OAuth 2.0 / OIDC**. Proveedor por defecto: **Google** (a confirmar por el dueño). Implementar con **Auth.js (NextAuth)** o equivalente, con sesiones persistidas en la misma SQLite.
- **Acceso restringido** por allowlist de emails (variable de entorno), de modo que aunque la app sea pública solo entren cuentas autorizadas. Por defecto, solo el dueño.
- Todas las rutas de la API y las páginas requieren sesión, excepto `/api/health` y el login.
- Sesión larga (el uso es diario desde el celular); cierre de sesión disponible en el menú.

### 13.3 Cambios de datos (multiusuario)
- Agregar `userId` a `cards`, `templates`, `settings` y `session_state`, con índices por usuario. Cada usuario tiene su propio mazo, templates, ocultas y progreso.
- La clave de matching del importador pasa a ser única **por usuario**.
- **Migración:** los datos existentes de v1 (sin usuario) se asignan al primer usuario que inicie sesión (el dueño) en el primer arranque de v2, sin pérdida de historial, estados ni templates.
- El repositorio filtra **siempre** por el `userId` de la sesión; ninguna consulta puede devolver datos de otro usuario.

### 13.4 Criterios de aceptación v2
✔ La app corre en un dominio con HTTPS y se **instala como PWA desde el celular**.
✔ Sin sesión no se puede acceder a ninguna ruta de datos.
✔ Un email fuera de la allowlist no puede entrar.
✔ Los datos de v1 aparecen intactos para el dueño tras la migración.
✔ Reiniciar o redeployar el servicio no pierde datos, y existe un backup restaurable probado.
✔ Tests de repositorio verifican el aislamiento entre dos usuarios.

### 13.5 Fases v2
1. Migración a multiusuario en la capa de datos (`userId`) con tests de aislamiento.
2. Auth.js + OAuth + allowlist + protección de rutas.
3. Deploy (HTTPS, volumen persistente, variables de entorno) y backups.
4. Verificación de la PWA instalada en el celular y ajustes finales.
