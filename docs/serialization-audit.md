# Auditoría de Serialización del Backend — TrackFlow API (`services/api`)

**Aplicación auditada:** `services.api.main:app` (FastAPI + SQLModel ORM + TinyDB + SQLite)  
**Rama:** `feature/serialization-audit`  
**Total de endpoints auditados:** 31 rutas registradas en OpenAPI (`/docs`)  
**Estado general tras implementación:** ✅ **31 / 31 endpoints serializados explícitamente**

---

## 1. Resumen Ejecutivo y Metodología

Esta auditoría evalúa y estandariza la superficie completa de la API de TrackFlow bajo tres preguntas rectoras por ruta:
1. **¿Qué recibe?** — Separación estricta entre esquemas de entrada (`*Create`, `*Update`, `*Request`) y esquemas de respuesta, bloqueando campos internos o de solo lectura (`extra="forbid"`).
2. **¿Qué devolvía originalmente?** — Verificación de `response_model` explícito en el decorador de ruta frente a retornos sin tipar (`dict`, `Any`) o acoplados a estructuras internas de base de datos (`ProfileDB`, mapas crudos, claves foráneas duplicadas).
3. **¿Qué necesita realmente el consumidor?** — Contraste directo contra los componentes reales de `uis/backoffice` (`AuthContext.tsx`, `RegisterPage`, `ProfilePage`, `SupplierDirectory`, `InventoryProductsPage`, `OutboundOrderForm`, `InventoryOrdersHistoryPage`, `IncidentListPanel`, `IncidentsAnalysis`) para eliminar *over-fetching* en listados, proteger credenciales/emails en flujos públicos de autenticación y explicitar las decisiones sobre relaciones anidadas.

### Evolución del Estado de Serialización

| Clasificación | Fase 1 (Estado Original) | Fase 3 (Estado Final) |
|---|:---:|:---:|
| ✅ **Serializado** (`response_model` explícito y proyección ajustada al consumidor) | 8 | **31** |
| ⚠️ **Parcialmente serializado** (sobreexposición, acoplamiento o falta de proyección de listado) | 11 | **0** |
| ❌ **Sin serializar** (`dict` / `Any` sin `response_model` declarado) | 12 | **0** |

---

## 2. Inventario Completo de Endpoints: Estado Original, Cambios Aplicados y Estado Final

Siguiendo la prioridad de seguridad recomendada, la auditoría comienza por los flujos de **Autenticación y Registro**.

### 2.1. Autenticación y Registro Público (`/auth` y `POST /users`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 1 | `POST` | `/users` | Registro público de cuenta e inicialización de perfil | ⚠️ Parcialmente serializado (`UserResponse` reenviaba `email`) | `UserCreate` (`extra="forbid"`) → `UserRegistrationResponse` | ✅ |
| 2 | `POST` | `/auth/login` | Inicio de sesión OAuth2 y emisión de JWT | ❌ Sin serializar (`dict[str, str]`) | `OAuth2PasswordRequestForm` → `TokenResponse` | ✅ |
| 3 | `GET` | `/auth/me` | Identidad y datos de perfil del usuario autenticado | ❌ Sin serializar (`dict[str, Any]`) | *(Bearer JWT)* → `CurrentUserResponse` | ✅ |
| 4 | `POST` | `/auth/forgot-password` | Solicitud pública de recuperación de contraseña | ❌ Sin serializar (`dict[str, str]`) | `ForgotPasswordRequest` (`extra="forbid"`) → `MessageResponse` | ✅ |
| 5 | `POST` | `/auth/reset-password` | Restablecimiento público de contraseña con token de 1 uso | ❌ Sin serializar (`dict[str, str]`) | `ResetPasswordRequest` (`extra="forbid"`) → `MessageResponse` | ✅ |
| 6 | `POST` | `/auth/change-password` | Cambio autenticado de contraseña verificando la actual | ❌ Sin serializar (`dict[str, str]`) | `ChangePasswordRequest` (`extra="forbid"`) → `MessageResponse` | ✅ |

#### Cambios aplicados y listas de campos objetivo — Autenticación y Registro
- **`POST /users` (⚠️ → ✅ `UserRegistrationResponse`):**
  - *Problema original y motivo:* Reutilizaba `UserResponse` y reenviaba `email` en el cuerpo de una ruta de registro no autenticada. El consumidor (`uis/backoffice/app/register/page.tsx`) ya posee el `email` enviado en la petición y solo verifica el `201 Created`.
  - *Cambios aplicados:* Se creó `UserRegistrationResponse` excluyendo `email` y cualquier campo sensible, y se añadió `ConfigDict(extra="forbid")` en `UserCreate` (conservando la defensa de servidor que fuerza `role="user"` ante intentos de escalada).
  - *Lista objetivo de salida (`UserRegistrationResponse`):* `["id", "is_active", "role", "created_at"]` (**nunca devuelve `email`, `hashed_password`, `password_changed_at` ni `uuid`**).
- **`POST /auth/login` (❌ → ✅ `TokenResponse`):**
  - *Cambios aplicados:* Se declaró `response_model=TokenResponse` en el decorador de ruta.
  - *Lista objetivo de salida (`TokenResponse`):* `["access_token", "token_type"]` (**sin `email` ni credenciales**).
- **`GET /auth/me` (❌ → ✅ `CurrentUserResponse`):**
  - *Decisión explícita sobre relación y `email`:* Proyección plana combinando cuenta (`users`) y perfil (`profiles`) en un único esquema tipado. Aquí **sí se devuelve `email`** del propio usuario autenticado porque `AuthContext.tsx` y `app/account/profile/page.tsx` dependen de él para hidratar la sesión y renderizar la vista de perfil. Se excluyen `id`, `user_id`, `hashed_password`, `password_changed_at` y `uuid`.
  - *Lista objetivo de salida (`CurrentUserResponse`):* `["email", "role", "name", "phone", "address"]`.
- **`POST /auth/forgot-password`, `POST /auth/reset-password` y `POST /auth/change-password` (❌ → ✅ `MessageResponse`):**
  - *Cambios aplicados:* Se declaró `response_model=MessageResponse` en las tres rutas y se endurecieron `ForgotPasswordRequest`, `ResetPasswordRequest` y `ChangePasswordRequest` con `extra="forbid"`.
  - *Lista objetivo de salida (`MessageResponse`):* `["detail"]` (**sin `email`, sin `hashed_password` y sin exponer jamás el token de recuperación**).

---

### 2.2. Administración de Usuarios (`/users`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 7 | `GET` | `/users` | Listado autenticado de cuentas de usuario | ⚠️ Parcialmente serializado (reutilizaba `UserResponse` de detalle) | *(Bearer JWT)* → `list[UserListItem]` | ✅ |
| 8 | `GET` | `/users/{id}` | Detalle de una cuenta de usuario por ID | ✅ Ya serializado | *(Bearer JWT)* → `UserResponse` | ✅ |
| 9 | `PUT` | `/users/{id}` | Actualización de `email` propio o `role` (solo admin) | ⚠️ Parcialmente serializado (`UserUpdate` sin validación de patrón ni `extra="forbid"`) | `UserUpdate` (`extra="forbid"`) → `UserResponse` | ✅ |
| 10 | `DELETE` | `/users/{id}` | Baja de usuario y borrado en cascada de su perfil | ✅ Ya serializado (`204 No Content`) | *(Bearer JWT)* → `response_model=None` (`204`) | ✅ |

#### Cambios aplicados y listas de campos objetivo — Usuarios
- **`GET /users` (⚠️ → ✅ `list[UserListItem]`):**
  - *Problema original y mejora:* Antes reutilizaba `UserResponse` devolviendo el timestamp de auditoría `created_at` en cada fila. Se creó `UserListItem` ligero para listados y además se desacopló `UserDB` de `UserResponse` en `models.py`.
  - *Lista objetivo de salida (`UserListItem`):* `["id", "email", "is_active", "role"]`.
- **`GET /users/{id}` y `PUT /users/{id}` (✅ `UserResponse`):**
  - *Cambios aplicados:* Se endureció `UserUpdate` con validación regex de `email` y `ConfigDict(extra="forbid")` para rechazar intentos de enviar `hashed_password`, `is_active` o `id`.
  - *Lista objetivo de salida (`UserResponse`):* `["id", "email", "is_active", "role", "created_at"]`.
- **`DELETE /users/{id}` (✅):** Declarado explícitamente con `status_code=204, response_model=None` (sin cuerpo de respuesta).

---

### 2.3. Perfiles de Usuario (`/profiles`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 11 | `GET` | `/profiles/me` | Lectura de datos de contacto del propio usuario | ⚠️ Parcialmente serializado (`ProfileDB` exponía `id` y FK `user_id`) | *(Bearer JWT)* → `ProfileResponse` | ✅ |
| 12 | `PUT` | `/profiles/me` | Edición parcial de nombre, teléfono y dirección propios | ⚠️ Parcialmente serializado (`ProfileDB` y `ProfileUpdate` sin `extra="forbid"`) | `ProfileUpdate` (`extra="forbid"`) → `ProfileResponse` | ✅ |

#### Cambios aplicados y listas de campos objetivo — Perfiles
- **`GET /profiles/me` y `PUT /profiles/me` (⚠️ → ✅ `ProfileResponse`):**
  - *Problema original y mejora:* Ambos usaban directamente el modelo interno `ProfileDB`, exponiendo el `id` documental de TinyDB y la clave foránea interna en bruto `user_id`. Se creó `ProfileResponse` con únicamente los datos de contacto consumidos por `ProfilePage`, y se añadió `extra="forbid"` a `ProfileUpdate` (rechazando con `422` cualquier intento de reasignar `user_id`).
  - *Lista objetivo de salida (`ProfileResponse`):* `["name", "phone", "address"]`.

---

### 2.4. Directorio de Proveedores (`/api/suppliers`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 13 | `GET` | `/api/suppliers` | Listado filtrable por país y categoría | ⚠️ Parcialmente serializado (reutilizaba `SupplierResponse` con `updated_at`) | *(Query + JWT)* → `list[SupplierListItem]` | ✅ |
| 14 | `POST` | `/api/suppliers` | Alta de proveedor logístico | ⚠️ Parcialmente serializado (`SupplierResponse` heredaba de `SupplierCreate`) | `SupplierCreate` → `SupplierResponse` | ✅ |
| 15 | `GET` | `/api/suppliers/{id}` | Detalle individual de proveedor | ✅ Ya serializado | *(Bearer JWT)* → `SupplierResponse` | ✅ |
| 16 | `PATCH` | `/api/suppliers/{id}/rate` | Actualización de tarifa por envío | ✅ Ya serializado | `SupplierRateUpdate` (`extra="forbid"`) → `SupplierResponse` | ✅ |
| 17 | `PATCH` | `/api/suppliers/{id}/status` | Activación o suspensión de proveedor | ✅ Ya serializado | `SupplierStatusUpdate` (`extra="forbid"`) → `SupplierResponse` | ✅ |
| 18 | `DELETE` | `/api/suppliers/{id}` | Eliminación de proveedor | ✅ Ya serializado (`204 No Content`) | *(Bearer JWT)* → `response_model=None` (`204`) | ✅ |

#### Cambios aplicados y listas de campos objetivo — Proveedores
- **`GET /api/suppliers` (⚠️ → ✅ `list[SupplierListItem]`):**
  - *Problema original y mejora:* La tabla de `uis/backoffice/app/suppliers/page.tsx` utiliza exactamente 10 columnas operativas y nunca consume `updated_at`. Se creó `SupplierListItem` omitiendo `updated_at`, y se desacopló `SupplierResponse` para que no herede del esquema de escritura `SupplierCreate`.
  - *Lista objetivo de salida (`SupplierListItem`):* `["id", "name", "country", "categories", "rate_per_shipment", "currency", "service_zone", "contact_email", "notes", "status"]`.
  - *Lista objetivo de detalle/escritura (`SupplierResponse`):* los 10 atributos anteriores + `"updated_at"`.

---

### 2.5. Gestión Centralizada de Inventario ORM (`/inventory`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 19 | `GET` | `/inventory/products` | Catálogo de SKUs con stock neto por sede | ⚠️ Parcialmente serializado (incluía mapa `stock_by_warehouse` en cada fila) | *(Query)* → `list[SKUListItem]` | ✅ |
| 20 | `POST` | `/inventory/products` | Registro de nuevo SKU (stock inicial 0) | ✅ Ya serializado | `SKUCreate` (`extra="forbid"`) → `SKUResponse` | ✅ |
| 21 | `GET` | `/inventory/products/{id}` | Detalle de SKU y desglose multi-almacén | ✅ Ya serializado | *(Path ID)* → `SKUResponse` | ✅ |
| 22 | `POST` | `/inventory/orders/inbound` | Registro de recepción `StockEntry` | ⚠️ Parcialmente serializado (`StockEntryCreate` sin `extra="forbid"`) | `StockEntryCreate` (`extra="forbid"`) → `StockEntryResponse` | ✅ |
| 23 | `POST` | `/inventory/orders/outbound` | Registro de salida `StockExit` validando stock | ⚠️ Parcialmente serializado (`StockExitCreate` sin `extra="forbid"`) | `StockExitCreate` (`extra="forbid"`) → `StockExitResponse` | ✅ |
| 24 | `GET` | `/inventory/orders` | Historial consolidado de entradas y salidas | ⚠️ Parcialmente serializado (exponía FK `sku_id` duplicada junto a `sku` anidado) | *(Query)* → `list[StockOrderResponse]` | ✅ |

#### Cambios aplicados y decisiones sobre relaciones — Inventario (`SQLModel`)
- **Cero objetos ORM en crudo:** Todos los modelos de `schemas.py` heredan exclusivamente de `pydantic.BaseModel` (nunca `SQLModel`), impidiendo exponer relaciones ORM `entries` / `exits` o estado interno de sesión.
- **`GET /inventory/products` (⚠️ → ✅ `list[SKUListItem]`):**
  - *Mejora:* Proyección plana `SKUListItem` (`["id", "name", "sku", "client_name", "category", "warehouse", "current_stock"]`) sin el diccionario anidado `stock_by_warehouse`, que queda reservado para `GET /inventory/products/{id}` y `POST /inventory/products` (`SKUResponse`).
- **`POST /inventory/orders/inbound` y `POST /inventory/orders/outbound` (⚠️ → ✅):**
  - *Mejora en entrada:* Se añadió `ConfigDict(extra="forbid")` en `StockEntryCreate` y `StockExitCreate`, rechazando con `422` intentos de suplantar `user_uuid`, `id` o `created_at`.
  - *Decisión sobre relación:* En la respuesta de alta de movimiento (`StockEntryResponse` / `StockExitResponse`) se devuelve **solo el ID relacionado (`sku_id`)** sin anidar `SKU`, ya que el formulario cliente ya dispone del producto seleccionado.
- **`GET /inventory/orders` (⚠️ → ✅ `list[StockOrderResponse]`):**
  - *Decisión sobre relación `SKU`:* `InventoryOrdersHistoryPage` busca y muestra nombre, código, marca cliente y categoría del producto en cada fila (obtenidos con `JOIN` SQL en O(1) consultas). Se devuelve la **proyección anidada ligera `sku: SKUSummary`** (`["id", "name", "sku", "client_name", "category"]`), **eliminando la clave foránea en bruto duplicada `sku_id`** en la raíz de `StockOrderResponse` y suprimiendo `sku.warehouse` (redundante con `order.warehouse`).
  - *Decisión sobre `user_uuid`:* Se mantiene explícitamente en `StockOrderResponse`, `StockEntryResponse` y `StockExitResponse` porque es el identificador público de auditoría operativa entre TinyDB y PostgreSQL exigido por `InventoryOrdersHistoryPage` (columna *"Creado por (`user_uuid`)"*).
  - *Lista objetivo de salida (`StockOrderResponse`):* `["id", "order_type", "sku", "quantity", "warehouse", "reference", "exit_type", "tracking_number", "created_at", "user_uuid"]`.

---

### 2.6. Gestor Centralizado y Analizador de Incidencias (`/api/incidents`)

| # | Método | Ruta | Propósito | Estado Original | Esquemas Finales (Entrada → `response_model`) | Estado Final |
|---|:---:|---|---|:---:|---|:---:|
| 25 | `GET` | `/api/incidents/summary` | Conteos agregados por estado, categoría, origen y sede | ❌ Sin serializar (`Any`) | *(Sin body)* → `IncidentsSummaryResponse` | ✅ |
| 26 | `GET` | `/api/incidents` | Listado filtrable de incidencias operativas | ❌ Sin serializar (`Any`, incluía `updated_at`) | *(Query)* → `list[IncidentListItem]` | ✅ |
| 27 | `POST` | `/api/incidents` | Registro de nueva incidencia operativa | ❌ Sin serializar (`Request` crudo → `Any`) | `IncidentCreateRequest` (`extra="forbid"`) → `IncidentDetailResponse` | ✅ |
| 28 | `GET` | `/api/incidents/{incident_id}` | Detalle completo de una incidencia por ID | ❌ Sin serializar (`Any`) | *(Path ID)* → `IncidentDetailResponse` | ✅ |
| 29 | `PATCH` | `/api/incidents/{incident_id}/status` | Transición validada de estado de una incidencia | ❌ Sin serializar (`Request` crudo → `Any`) | `IncidentStatusUpdateRequest` (`extra="forbid"`) → `IncidentDetailResponse` | ✅ |
| 30 | `POST` | `/api/incidents/analyze` | Análisis de calidad por lotes sobre archivo CSV | ❌ Sin serializar (`dict[str, Any]`, 4 mapas internos extra) | `UploadFile (.csv)` → `IncidentAnalysisResponse` | ✅ |
| 31 | `GET` | `/api/incidents/results/export` | Descarga de resultados del último análisis en CSV | ✅ Ya serializado (`StreamingResponse`) | *(Sin body)* → `response_model=None` (`text/csv`) | ✅ |

#### Cambios aplicados y listas de campos objetivo — Incidencias
- **`GET /api/incidents/summary` (❌ → ✅ `IncidentsSummaryResponse`):**
  - *Lista objetivo de salida:* `["total", "by_status", "by_category", "by_origin", "by_branch"]`.
- **`GET /api/incidents` (❌ → ✅ `list[IncidentListItem]`):**
  - *Mejora:* Proyección ligera ajustada a `IncidentListPanel.tsx`, eliminando `updated_at` y garantizando que la columna interna `source_ref` de SQLite jamás salga en la respuesta.
  - *Lista objetivo de salida (`IncidentListItem`):* `["id", "title", "description", "category", "status", "origin", "branch", "created_at"]`.
- **`POST /api/incidents`, `GET /api/incidents/{incident_id}` y `PATCH /api/incidents/{incident_id}/status` (❌ → ✅ `IncidentDetailResponse`):**
  - *Mejora:* Se definieron los esquemas de escritura `IncidentCreateRequest` (`title`, `description`, `category`, `origin`, `branch`, `status`, con `extra="forbid"` que rechaza `id`, `created_at`, `updated_at`, `source_ref`) e `IncidentStatusUpdateRequest` (`status`, con `extra="forbid"`), separados del esquema de salida `IncidentDetailResponse`.
  - *Lista objetivo de salida (`IncidentDetailResponse`):* `["id", "title", "description", "category", "status", "origin", "branch", "created_at", "updated_at"]`.
- **`POST /api/incidents/analyze` (❌ → ✅ `IncidentAnalysisResponse`):**
  - *Eliminación de over-fetching:* El servidor conserva el resultado completo en `last_analysis` para `GET /api/incidents/results/export`, pero serializa al cliente únicamente las 5 métricas consumidas por `IncidentsAnalysis.tsx`, eliminando `categories`, `statuses`, `countries` y `satisfaction_scores` del cuerpo JSON.
  - *Lista objetivo de salida (`IncidentAnalysisResponse`):* `["total_records", "valid_records", "invalid_records", "invalid_reasons", "average_satisfaction"]`.

---

## 3. Verificación (Fase 3): Tests y Comprobación de Contratos en `/docs`

1. **Suite automatizada del Backend (`pytest`):**
   - **78 / 78 tests en verde** (74 pruebas existentes de regresión + 4 suites nuevas de auditoría en `tests/test_serialization_audit.py` que inspeccionan el árbol completo de `app.openapi()` y validan peticiones ASGI extremo a extremo).
2. **Suite automatizada y tipado del Frontend (`uis/backoffice`):**
   - **34 / 34 tests unitarios Jest en verde** y `npx tsc --noEmit` sin errores tras alinear las interfaces opcionales de cliente (`inventory.ts`, `incidents.ts`).
3. **Verificación de documentación interactiva (`/docs` y esquemas OpenAPI):**
   - `GET /docs` responde `200 OK` cargando `SwaggerUIBundle` con los 31 endpoints documentados sin ningún retorno libre `Any` / `object` genérico.
   - Endpoints verificados extremo a extremo contra sus esquemas de `/docs`:
     - **`POST /users`:** Devuelve exactamente `{"id", "is_active", "role", "created_at"}` (`UserRegistrationResponse`, sin `email` ni `hashed_password`) y rechaza `hashed_password` en entrada con `422`.
     - **`GET /profiles/me` y `PUT /profiles/me`:** Devuelven exactamente `{"name", "phone", "address"}` (`ProfileResponse`, sin `id` ni `user_id`) y rechazan `user_id` en entrada con `422`.
     - **`GET /inventory/products` vs `GET /inventory/orders`:** `/inventory/products` devuelve filas planas `SKUListItem` sin `stock_by_warehouse`, y `/inventory/orders` devuelve `StockOrderResponse` con `sku` proyectado (`SKUSummary`) sin duplicar la FK `sku_id`.
     - **`GET /api/incidents` y `POST /api/incidents/analyze`:** `/api/incidents` devuelve `IncidentListItem` sin `updated_at` ni `source_ref`, y `/api/incidents/analyze` devuelve exactamente los 5 campos de `IncidentAnalysisResponse`.
