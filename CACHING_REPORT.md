# Informe Técnico de Optimización de Rendimiento: Caching (`CACHING_REPORT.md`)

**Proyecto:** TrackFlow Monorepo (`services/api` + `uis/backoffice`)  
**Rama:** `feature/caching-optimisation`  
**Alcance:** Telemetría de latencia HTTP, seeder de carga realista, caching en proceso con expiración TTL e invalidación activa en FastAPI, y carga diferida (`next/dynamic`) + memoización selectiva (`useMemo`) en Next.js.

---

## 1. Metodología Basada en Evidencia: Middleware de Timing y Carga Realista

### 1.1. Instrumentación de telemetría (`TimingMiddleware`)
Antes de introducir cualquier capa de caché, se instrumentó `services/api/main.py` con `TimingMiddleware` (implementado como middleware ASGI puro libre de dependencias externas) que mide con `time.perf_counter()` cada petición entrante, emite una traza estructurada en el logger `api.timing` e inyecta la cabecera `X-Response-Time-Ms`:

```text
api.timing | GET /api/incidents/summary → 200 | 28.3ms
api.timing | GET /api/incidents/summary → 200 | 0.3ms
api.timing | GET /inventory/products → 200 | 46.0ms
api.timing | GET /inventory/products → 200 | 0.8ms
api.timing | GET /inventory/orders → 200 | 1354.6ms
api.timing | GET /inventory/orders → 200 | 101.0ms
```

### 1.2. Aumento de volumen con datos realistas (`services/api/seed_benchmark.py`)
Con los datos semilla mínimos de demostración, casi toda la API respondía por debajo de `30 ms`, ocultando los verdaderos cuellos de botella de agregación SQL, `JOIN`s y serialización. Se construyó `services/api/seed_benchmark.py` para poblar bases aisladas con datos logísticos coherentes de dominio (12 marcas cliente, códigos SKU por sede `LA`/`ZGZ`, referencias `PO-2026-*`, números de seguimiento UPS/FedEx/SEUR/MRW/DHL y descripciones operativas reales):

| Tabla / Almacén | Volumen Inicial (Demo) | Volumen Realista (`seed_benchmark.py`) | Factor de Escala |
|---|---:|---:|---:|
| `sku` (SQLModel) | 6 filas | **300 filas** | 50× |
| `stockentry` (SQLModel) | 6 filas | **8,000 filas** | 1,333× |
| `stockexit` (SQLModel) | 6 filas | **12,000 filas** | 2,000× |
| **Total movimientos inventario** | **12 filas** | **20,000 filas** | **1,667×** |
| `incidents` (SQLite) | 10 filas | **5,000 filas** | 500× |
| `suppliers` (TinyDB) | 8 documentos | **250 documentos** | 31× |

### 1.3. Resultados Medidos: Antes vs. Después del Seed y del Caching

| Endpoint Evaluado | Latencia Demo (Sin carga) | Carga Realista — Cold MISS (Antes de caché) | Carga Realista — Warm HIT (Con caché TTL) | Reducción de Latencia (Aceleración) | Tamaño Payload |
|---|---:|---:|---:|---:|---:|
| `GET /api/incidents/summary` | 60.53 ms | **28.30 ms** | **0.29 ms** | **-99.0 % (97.6×)** | 0.39 KB |
| `GET /inventory/products` | 28.04 ms | **45.73 ms** | **1.12 ms** | **-97.6 % (40.8×)** | 50.7 KB |
| `GET /inventory/products?warehouse=LA` | 8.32 ms | **33.87 ms** | **0.93 ms** | **-97.3 % (36.4×)** | 25.1 KB |
| `GET /inventory/orders` | 9.21 ms | **1,351.24 ms** 🐢 | **116.08 ms** | **-91.4 % (11.6×)** | 6.49 MB |
| `GET /inventory/orders?warehouse=ZGZ` | 9.28 ms | **626.44 ms** 🐢 | **57.76 ms** | **-90.8 % (10.8×)** | 3.26 MB |

> **Hallazgo técnico clave durante el perfilado:** En la primera iteración de `TTLCache`, clonar con `copy.deepcopy` los 20,000 objetos `StockOrderResponse` añadía ~430 ms de sobrecarga en Python puro en cada *hit*. Al declarar `SKUListItem`, `SKUSummary` y `StockOrderResponse` como modelos inmutables (`ConfigDict(frozen=True)`) y aplicar copia superficial segura (`list(value)`) sobre colecciones de modelos congelados en `services/api/cache.py`, el tiempo en caché caliente de `GET /inventory/orders` bajó de `549 ms` a **`116 ms`** (donde ~105 ms corresponden exclusivamente al codificador JSON HTTP de 6.5 MB).

---

## 2. Decisiones en el Frontend (`uis/backoffice`)

### 2.1. Componentes diferidos mediante Lazy Loading (`next/dynamic`)

Se identificaron e implementaron **tres módulos cliente pesados** cuya descarga y parseo inicial no son necesarios para el *First Contentful Paint* ni para la lectura inmediata de KPIs del Centro de Control:

1. **`IncidentsAnalysis` en `uis/backoffice/app/page.tsx` (`258 líneas`):**
   - **Por qué está justificado diferirlo:** Se ubica al final absoluto del Dashboard principal (`/`), muy por debajo del viewport inicial (tras `KpiGrid`, `CentralizedIncidentManager`, `WarehouseHealth` y `OperationsPanel`). Contiene manejadores de *drag & drop*, referencias a archivos locales, construcción de `FormData` y tablas de validación por lotes CSV que solo se utilizan puntualmente en auditorías de calidad. Se envuelve con `next/dynamic` y un esqueleto accesible (`aria-busy="true"`).
2. **`IncidentRegistrationForm` en `uis/backoffice/src/components/CentralizedIncidentManager.tsx` (`463 líneas`):**
   - **Por qué está justificado diferirlo:** El gestor centralizado posee cuatro modos de visualización (`Vista completa`, `Formulario de registro`, `Panel de listado`, `Panel de resumen`). El formulario encapsula reglas extensas de validación cliente, contadores de longitud y selectores condicionales por origen/sede que no bloquean la visualización del resumen ejecutivo (`IncidentSummaryPanel`).
3. **`IncidentListPanel` en `uis/backoffice/src/components/CentralizedIncidentManager.tsx` (`518 líneas`):**
   - **Por qué está justificado diferirlo:** Es el módulo interactivo más denso del panel (filtros combinados, búsqueda multi-token, transiciones optimistas de estado con *rollback* en caso de error). Separarlo en su propio *chunk* dinámico desacopla casi **1,000 líneas** de lógica interactiva del bundle crítico inicial de la ruta `/`.

### 2.2. Cálculos costosos optimizados con `useMemo`

Siguiendo la regla de evitar memoización prematura en operaciones triviales, se aplicó `useMemo` únicamente donde existen recorridos O(N) u ordenaciones O(N log N) sobre colecciones que conviven con estados de UI de alta frecuencia:

1. **Filtrado multi-token, ordenación por criticidad operativa y conteo de estados en `IncidentListPanel.tsx`:**
   - **Cálculo memoizado:** Tokenización de `searchQuery`, filtrado insensible a mayúsculas sobre 6 atributos concatenados (`#id`, `title`, `description`, etiqueta de `category`, `branch`, `origin`), ordenación multicriterio O(N log N) priorizando incidencias abiertas/en curso (`open` → `in_progress` → `resolved` → `discarded`) y cálculo de contadores `activeCount` / `terminalCount`.
   - **Array de dependencias exacto:** `[incidents, searchQuery]`.
   - **Beneficio real:** En `IncidentListPanel`, cada cambio de estado en fila dispara dos re-renders por actualización de `updatingIds` (spinner optimista) más dos re-renders por apertura/cierre del banner `statusFeedback`. Con 500–5,000 incidencias cargadas, `useMemo` evita ejecutar miles de comparaciones de cadenas y `Array.prototype.sort` en cada clic de estado.
2. **Métricas agregadas multimoneda y facetas en `uis/backoffice/app/suppliers/page.tsx` (`directoryStats`):**
   - **Cálculo memoizado:** Recorrido O(N × C) sobre el directorio de proveedores (250+ registros bajo carga realista) acumulando activos vs. suspendidos, conjuntos únicos (`Set`) de países y categorías anidadas, y tarifa media ponderada por divisa (`EUR`, `USD`).
   - **Array de dependencias exacto:** `[suppliers]`.
   - **Beneficio real:** Cuando el operador edita una tarifa en línea o envía el formulario superior, los estados `saving`, `error` y `success` cambian repetidamente sin alterar `suppliers`; el resumen del directorio se reutiliza en O(1) sin re-escanear los 250 objetos.
3. **Ordenación descendente de motivos de rechazo CSV en `IncidentsAnalysis.tsx` (`sortedInvalidReasons`):**
   - **Cálculo memoizado:** `Object.entries(results?.invalid_reasons ?? {}).sort((a, b) => b[1] - a[1])` con dependencia `[results?.invalid_reasons]`, evitando recrear y ordenar el arreglo durante eventos continuos de arrastre (`isDragging` en `onDragOver` / `onDragLeave`).

---

## 3. Evaluación Completa de los 31 Endpoints del Backend y Decisiones de Caching

Cada uno de los 31 endpoints de `services/api` se evaluó en los tres ejes técnicos (**Coste**, **Frecuencia de llamada** y **Estabilidad / frecuencia de mutación**):

| # | Método y Ruta | (a) Coste de Operación | (b) Frecuencia de Llamada | (c) Cambio de Datos Subyacentes | Decisión |
|---|---|---|---:|---|---|
| 1 | `POST /users` | Alto (bcrypt ~180 ms + 2 inserts) | Baja | Escritura inmediata | ❌ Escritura |
| 2 | `POST /auth/login` | Alto (bcrypt verify ~180 ms) | Media | Credenciales por intento | ❌ Seguridad / Auth |
| 3 | `GET /auth/me` | Bajo (<1.5 ms, doc_id lookup TinyDB) | Alta | Baja (por usuario) | ❌ Dato privado de sesión |
| 4 | `POST /auth/forgot-password` | Bajo + tarea background email | Baja | Emisión de token único | ❌ Escritura / Seguridad |
| 5 | `POST /auth/reset-password` | Alto (bcrypt + invalidación token) | Baja | Escritura de credencial | ❌ Escritura / Seguridad |
| 6 | `POST /auth/change-password` | Alto (2× bcrypt) | Muy baja | Escritura de credencial | ❌ Escritura / Seguridad |
| 7 | `GET /users` | Bajo (lectura tabla corta usuarios) | Baja | Baja | ❌ Dato sensible / baja frec. |
| 8 | `GET /users/{id}` | Muy bajo (lookup doc_id O(1)) | Baja | Baja | ❌ Dato sensible / O(1) |
| 9 | `PUT /users/{id}` | Bajo | Baja | Escritura inmediata | ❌ Escritura |
| 10 | `DELETE /users/{id}` | Bajo | Muy baja | Borrado en cascada | ❌ Escritura |
| 11 | `GET /profiles/me` | Muy bajo (<1 ms en TinyDB) | Media | Baja (por usuario) | ❌ Dato privado de usuario |
| 12 | `PUT /profiles/me` | Bajo | Baja | Escritura inmediata | ❌ Escritura |
| 13 | `GET /api/suppliers` | Bajo-Medio (~3 ms con 250 docs en RAM) | Media | Baja | ❌ Coste en RAM ya <3 ms |
| 14 | `POST /api/suppliers` | Bajo | Baja | Escritura | ❌ Escritura |
| 15 | `GET /api/suppliers/{id}` | Muy bajo (O(1) doc_id) | Baja | Baja | ❌ Coste trivial (<1 ms) |
| 16 | `PATCH /api/suppliers/{id}/rate` | Bajo | Baja | Escritura | ❌ Escritura |
| 17 | `PATCH /api/suppliers/{id}/status` | Bajo | Baja | Escritura | ❌ Escritura |
| 18 | `DELETE /api/suppliers/{id}` | Bajo | Muy baja | Escritura | ❌ Escritura |
| 19 | **`GET /inventory/products`** | **Alto** (3 queries SQL + 2 `GROUP BY SUM` sobre 20k filas: ~46 ms) | **Muy alta** (catálogo + formularios entrada/salida + filtro sede) | **Moderada-Baja** (cambia solo al registrar órdenes o SKUs) | ✅ **Cacheado (TTL 45s)** |
| 20 | `POST /inventory/products` | Bajo | Baja | Escritura (invalida `inventory:*`) | ❌ Escritura (Invalidador) |
| 21 | `GET /inventory/products/{id}` | Medio (stock puntual de 1 SKU) | Media (pre-validación de salida) | Crítica en despacho | ❌ Exige stock en vivo |
| 22 | `POST /inventory/orders/inbound` | Medio | Media | Escritura (invalida `inventory:*`) | ❌ Escritura (Invalidador) |
| 23 | `POST /inventory/orders/outbound` | Medio (valida stock + inserta) | Media | Escritura (invalida `inventory:*`) | ❌ Escritura (Invalidador) |
| 24 | **`GET /inventory/orders`** | **Muy alto** (2 `JOIN`s sobre 20k filas + ordenación Python: **1,351 ms**) | **Alta** (historial auditable y filtro por almacén) | **Moderada** (solo cambia en nuevas entradas/salidas) | ✅ **Cacheado (TTL 30s)** |
| 25 | **`GET /api/incidents/summary`** | **Alto** (scan completo SQLite 5k filas + agregación Python: ~28–60 ms) | **Muy alta** (Dashboard `/`, `/incidents`, `/incidents/summary`) | **Moderada** (cambia al crear o transicionar incidencias) | ✅ **Cacheado (TTL 30s)** |
| 26 | `GET /api/incidents` | Medio (4 combinaciones abiertas de filtros + trabajo instantáneo) | Alta | Alta interactividad de estado | ❌ Cola de trabajo vivo |
| 27 | `POST /api/incidents` | Bajo | Media | Escritura (invalida `incidents:*`) | ❌ Escritura (Invalidador) |
| 28 | `GET /api/incidents/{id}` | Muy bajo (`WHERE id = ?` PK indexada <1 ms) | Baja | Moderada | ❌ Lookup PK trivial |
| 29 | `PATCH /api/incidents/{id}/status` | Bajo | Media | Escritura (invalida `incidents:*`) | ❌ Escritura (Invalidador) |
| 30 | `POST /api/incidents/analyze` | Alto (parseo CSV subido por usuario) | Baja | Entrada única por archivo | ❌ Mutación por upload |
| 31 | `GET /api/incidents/results/export` | Medio (`StreamingResponse` CSV) | Baja | Depende de `last_analysis` | ❌ Descarga puntual stream |

### 3.1. Detalle de Implementación en los Endpoints Cacheados (`services/api/cache.py`)

1. **`GET /api/incidents/summary`**
   - **Clave de caché:** `"incidents:summary"` (datos agregados operativos globales, sin ningún campo privado ni de sesión).
   - **Coste evitado:** Escaneo completo `SELECT status, category, origin, branch FROM incidents` y bucle Python sobre 5,000+ filas (de **28.30 ms → 0.29 ms**).
   - **Frecuencia estimada:** 30–80 peticiones/minuto entre operadores con el Centro de Control abierto.
   - **TTL elegido:** **`30 segundos`** (`INCIDENTS_SUMMARY_TTL_SECONDS = 30.0`).
   - **Estrategia de invalidación:** `app_cache.invalidate_prefix("incidents:")` ejecutado síncronamente al completar `POST /api/incidents` (`create_incident`) y `PATCH /api/incidents/{incident_id}/status` (`update_incident_status`).

2. **`GET /inventory/products`**
   - **Clave de caché:** `f"inventory:products:{warehouse or 'ALL'}"` (3 claves acotadas: `ALL`, `LA`, `ZGZ`).
   - **Coste evitado:** Tres consultas SQL por petición incluyendo dos sumatorios agrupados (`SUM(quantity) GROUP BY sku_id, warehouse`) sobre 20,000 registros de `stockentry` y `stockexit` (de **45.73 ms → 1.12 ms**).
   - **Frecuencia estimada:** 40–100 peticiones/minuto (se invoca al abrir el catálogo, al cambiar el selector de almacén y al montar los formularios de entrada y salida).
   - **TTL elegido:** **`45 segundos`** (`INVENTORY_PRODUCTS_TTL_SECONDS = 45.0`).
   - **Estrategia de invalidación:** `app_cache.invalidate_prefix("inventory:")` ejecutado tras `commit()` en `POST /inventory/products`, `POST /inventory/orders/inbound`, `POST /inventory/orders/outbound` y `seed_inventory()`.

3. **`GET /inventory/orders`**
   - **Clave de caché:** `f"inventory:orders:{warehouse or 'ALL'}"` (`ALL`, `LA`, `ZGZ`).
   - **Coste evitado:** Dos `JOIN`s relacionales completos (`StockEntry ⋈ SKU` y `StockExit ⋈ SKU`), construcción de 20,000 instancias `StockOrderResponse` y ordenación en memoria por timestamp UTC (de **1,351.24 ms → 116.08 ms** en global, y de **626.44 ms → 57.76 ms** por almacén).
   - **Frecuencia estimada:** 15–40 peticiones/minuto en auditorías operativas de muelle.
   - **TTL elegido:** **`30 segundos`** (`INVENTORY_ORDERS_TTL_SECONDS = 30.0`).
   - **Estrategia de invalidación:** Comparte el prefijo `"inventory:"`, limpiándose de inmediato ante cualquier alta de SKU, recepción o salida de mercancía.

---

## 4. Intercambios Reconocidos: Frescura de Datos vs. Rendimiento

Toda caché introduce una ventana acotada de consistencia eventual:

- **Por qué `45 segundos` en `GET /inventory/products` y `30 segundos` en `GET /inventory/orders` e `incidents/summary` son aceptables:**
  - En un despliegue de un único proceso FastAPI, nuestra **invalidación activa en escritura (`invalidate_prefix`)** purga la caché en el mismo milisegundo en que se confirma cualquier `POST` o `PATCH`, ofreciendo lectura inmediatamente consistente a través de la API.
  - Sin embargo, cuando la API escala horizontalmente a múltiples *workers* de Uvicorn/Gunicorn (donde cada proceso mantiene su propio `TTLCache` en RAM) o si un proceso externo (como un script batch de sincronización sobre Supabase) inserta movimientos directamente en PostgreSQL, un *worker* distinto podría servir datos con hasta **30–45 segundos de antigüedad** antes de que venza el TTL.
  - Para la **tabla general del catálogo** (`GET /inventory/products`), el **historial de solo lectura** (`GET /inventory/orders`) y los **KPIs ejecutivos** (`GET /api/incidents/summary`), una desactualización máxima de 30–45 segundos entre *workers* es operativamente inocua frente a ahorrar más de **1.2 segundos de bloqueo de base de datos por petición**. Un TTL mayor (p. ej. 10 minutos) confundiría a los coordinadores de almacén tras una recepción masiva; un TTL menor (p. ej. 2 segundos) reduciría drásticamente el ratio de aciertos (*hit rate*) bajo tráfico real.

---

## 5. Qué NO se Cacheó y Por Qué

1. **`GET /inventory/products/{id}` (Descartado deliberadamente por requisito de consistencia estricta):**
   - Aunque pertenece al dominio de inventario, este endpoint es invocado reactivamente por `OutboundOrderForm` (`uis/backoffice/app/inventory/orders/outbound/page.tsx`) en el instante exacto en que un operario selecciona un SKU para despachar mercancía, con el fin de validar cuántas unidades físicas quedan disponibles antes de enviar el formulario. Si devolviéramos un stock cacheado desactualizado desde otro *worker*, la UI permitiría solicitar unidades ya despachadas que luego fallarían con `HTTP 400 Insufficient stock`. Además, al filtrar por clave primaria (`WHERE sku_id = :id`), su coste SQL individual es bajo (~3–5 ms), por lo que priorizamos **consistencia estricta al 100 %** sobre caché.

2. **`GET /auth/me`, `GET /profiles/me` y `GET /users` (Descartados por seguridad de datos de sesión y coste O(1)):**
   - Cachear `/auth/me` o `/profiles/me` sin aislar criptográficamente la clave por usuario autenticado provocaría una **fuga crítica de datos personales entre sesiones**. Incluso acotando la clave por `user_id`, TinyDB ya mantiene la tabla en memoria y resuelve `doc_id` en **< 1.2 ms**, por lo que almacenar copias adicionales en caché aumentaría la huella de memoria y el riesgo de desincronización tras cambios de rol o perfil sin ganancia perceptible de latencia.

3. **`GET /api/incidents` (Listado operativo interactivo con múltiples filtros):**
   - A diferencia de `/api/incidents/summary` (que devuelve un único payload agregado de 391 bytes para todos los operadores), el listado `/api/incidents` recibe combinaciones abiertas de 4 filtros (`status`, `origin`, `branch`, `category`) y alimenta la cola de trabajo en vivo donde los agentes cambian estados constantemente; cachearlo fragmentaría las claves con bajo *hit rate* y aumentaría el riesgo de colisiones de transición de estado entre operadores en distintos *workers*.
