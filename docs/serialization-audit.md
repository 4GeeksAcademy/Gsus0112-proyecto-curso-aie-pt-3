# Auditoría de Serialización del Backend — TrackFlow API (`services/api`)

**Aplicación auditada:** `services.api.main:app` (FastAPI + SQLModel ORM + TinyDB + SQLite)  
**Rama:** `feature/serialization-audit`  
**Total de endpoints auditados:** 31 rutas registradas en OpenAPI  

---

## 1. Resumen Ejecutivo y Metodología

Esta auditoría evalúa la superficie completa de la API de TrackFlow bajo tres preguntas rectoras por ruta:
1. **¿Qué recibe?** — Separación estricta entre esquemas de entrada (`*Create`, `*Update`, `*Request`) y esquemas de respuesta, bloqueando campos internos o de solo lectura (`extra="forbid"` donde aplica).
2. **¿Qué está devolviendo hoy?** — Verificación de `response_model` explícito en el decorador de ruta frente a retornos sin tipar (`dict`, `Any`) o acoplados a estructuras internas de base de datos (`ProfileDB`, tuplas/mapas crudos, claves foráneas duplicadas).
3. **¿Qué necesita realmente el consumidor?** — Contraste directo contra los componentes reales de `uis/backoffice` (`AuthContext.tsx`, `RegisterPage`, `ProfilePage`, `SupplierDirectory`, `InventoryProductsPage`, `OutboundOrderForm`, `InventoryOrdersHistoryPage`, `IncidentListPanel`, `IncidentsAnalysis`) para eliminar *over-fetching* en listados, proteger credenciales/emails en flujos públicos de autenticación y explicitar las decisiones sobre relaciones anidadas.

### Clasificación Inicial Encontrada (Fase 1)
- **✅ Ya serializados inicialmente:** 8 endpoints (esquema adecuado o `204 No Content` / stream `text/csv`).
- **⚠️ Parcialmente serializados:** 11 endpoints (`response_model` reutilizado entre detalle y listado, exposición de `email` en registro público, exposición de `ProfileDB` con FK `user_id`, FK `sku_id` duplicada junto a objeto anidado, o esquemas de entrada sin bloqueo de campos extra).
- **❌ Sin serializar:** 12 endpoints (5 rutas de `/auth/*` y 6 rutas JSON de `/api/incidents*` sin `response_model` declarado, devolviendo `dict` o `Any` en crudo; más 1 endpoint de análisis devolviendo mapas internos no consumidos).

*(Nota: En la Fase 3 se añadirá la columna de Estado Final tras completar e inspeccionar la implementación).*

---

## 2. Matriz Completa de Endpoints y Diagnóstico Inicial

Siguiendo la recomendación de seguridad del briefing, la auditoría comienza por los flujos de **Autenticación y Registro**.

### 2.1. Autenticación y Registro Público (`/auth` y `POST /users`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original (`response_model` / retorno) | Estado Original |
|---|:---:|---|---|---|---|---|
| 1 | `POST` | `/users` | Registro público de usuario e inicialización de perfil | `uis/backoffice/app/register/page.tsx` | `response_model=UserResponse` (`id`, `email`, `is_active`, `role`, `created_at`) | ⚠️ Parcialmente serializado |
| 2 | `POST` | `/auth/login` | Inicio de sesión OAuth2 y emisión de JWT | `AuthContext.tsx` (`login`) | Sin `response_model`; devuelve `dict[str, str]` | ❌ Sin serializar |
| 3 | `GET` | `/auth/me` | Identidad y datos de perfil del usuario autenticado | `AuthContext.tsx` y `ProfilePage` | Sin `response_model`; devuelve `dict[str, Any]` | ❌ Sin serializar |
| 4 | `POST` | `/auth/forgot-password` | Solicitud pública de recuperación de contraseña | `app/forgot-password/page.tsx` | Sin `response_model`; devuelve `dict[str, str]` | ❌ Sin serializar |
| 5 | `POST` | `/auth/reset-password` | Restablecimiento público de contraseña con token de 1 uso | `app/reset-password/page.tsx` | Sin `response_model`; devuelve `dict[str, str]` | ❌ Sin serializar |
| 6 | `POST` | `/auth/change-password` | Cambio autenticado de contraseña verificando la actual | `app/account/change-password/page.tsx` | Sin `response_model`; devuelve `dict[str, str]` | ❌ Sin serializar |

#### Notas técnicas y payloads objetivo — Autenticación y Registro
- **`POST /users` (⚠️ → Mejora de privacidad y contrato de registro):**
  - *Por qué requiere cambio:* Es un flujo de registro público no autenticado que actualmente reutiliza `UserResponse` y **reenvía `email` en el cuerpo de la respuesta**. El cliente (`RegisterPage`) ya posee el email introducido en el formulario y solo verifica el código `201` antes de autenticar. Además, `UserCreate` no aplicaba `extra="forbid"`, dejando pasar silenciosamente atributos ajenos al contrato de alta.
  - *Esquema de entrada objetivo (`UserCreate` con `extra="forbid"`):* `email`, `password`, `role` (ignorado y forzado siempre a `"user"` en servidor para impedir escalada de privilegios), `name`, `phone`, `address`.
  - *Esquema y lista de campos de salida objetivo (`UserRegistrationResponse`):* `id: int`, `role: RoleEnum`, `is_active: bool`, `created_at: str` (**sin `email`, sin `hashed_password`, sin `password_changed_at`, sin `uuid`**).
- **`POST /auth/login` (❌ → Esquema explícito `TokenResponse`):**
  - *Por qué requiere cambio:* Carecía de `response_model`, apareciendo en OpenAPI `/docs` como `object` libre sin contrato verificable.
  - *Entrada:* `OAuth2PasswordRequestForm` (`username`, `password`).
  - *Salida objetivo (`TokenResponse`):* `access_token: str`, `token_type: Literal["bearer"]` (**sin `email` ni credenciales**).
- **`GET /auth/me` (❌ → Esquema explícito `CurrentUserResponse`):**
  - *Por qué requiere cambio:* Devolvía un `dict[str, Any]` manual combinando `users` y `profiles` sin validación de salida.
  - *Decisión sobre relación y `email`:* Se proyecta de forma **plana** la unión de cuenta + perfil porque `AuthContext.tsx` y `ProfilePage` leen exactamente estos 5 atributos en cada carga de sesión. Aquí **sí se expone `email`** al tratarse del propio usuario autenticado consultando su sesión (`Depends(get_current_user)`). Se excluyen explícitamente `id`, `user_id`, `hashed_password`, `password_changed_at` y `uuid`.
  - *Salida objetivo (`CurrentUserResponse`):* `email: str`, `role: RoleEnum`, `name: str`, `phone: str`, `address: str`.
- **`POST /auth/forgot-password`, `POST /auth/reset-password` y `POST /auth/change-password` (❌ → Esquema explícito `MessageResponse`):**
  - *Por qué requieren cambio:* Ninguno declaraba `response_model` en el decorador y sus esquemas de entrada (`ForgotPasswordRequest`, `ResetPasswordRequest`, `ChangePasswordRequest`) carecían de `extra="forbid"`.
  - *Entradas endurecidas (`extra="forbid"`):*
    - `ForgotPasswordRequest`: `email`.
    - `ResetPasswordRequest`: `token`, `new_password`.
    - `ChangePasswordRequest`: `current_password`, `new_password`.
  - *Salida objetivo (`MessageResponse`):* `detail: str` (**nunca expone `email`, `hashed_password` ni tokens internos de recuperación**; además mantiene idéntico payload anti-enumeración en `forgot-password`).

---

### 2.2. Administración de Usuarios (`/users`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original | Estado Original |
|---|:---:|---|---|---|---|---|
| 7 | `GET` | `/users` | Listado autenticado de cuentas de usuario | Administración interna / clientes API | `response_model=list[UserResponse]` (reutiliza esquema de detalle) | ⚠️ Parcialmente serializado |
| 8 | `GET` | `/users/{id}` | Detalle de una cuenta de usuario por ID | Administración interna / clientes API | `response_model=UserResponse` | ✅ Ya serializado |
| 9 | `PUT` | `/users/{id}` | Actualización de `email` propio o `role` (solo admin) | Administración interna / clientes API | `response_model=UserResponse`; entrada `UserUpdate` laxa | ⚠️ Parcialmente serializado |
| 10 | `DELETE` | `/users/{id}` | Baja de usuario y borrado en cascada de su perfil | Administración interna | `204 No Content` (`Response`) | ✅ Ya serializado |

#### Notas técnicas y payloads objetivo — Usuarios
- **`GET /users` (⚠️ → Esquema dedicado de listado `UserListItem`):**
  - *Por qué requiere cambio:* Reutilizaba `UserResponse` de detalle, arrastrando el campo de auditoría `created_at` en cada elemento del listado.
  - *Salida objetivo (`list[UserListItem]`):* `id: int`, `email: str`, `role: RoleEnum`, `is_active: bool` (omite `created_at` además de `hashed_password`, `password_changed_at` y `uuid`).
- **`GET /users/{id}` (✅):** Mantiene `UserResponse` (`id`, `email`, `is_active`, `role`, `created_at`), desacoplado de `UserDB` para que los campos sensibles de TinyDB jamás salgan de la capa interna.
- **`PUT /users/{id}` (⚠️ → Endurecimiento de entrada `UserUpdate`):**
  - *Por qué requiere cambio:* `UserUpdate` no validaba formato de `email` ni rechazaba atributos prohibidos (`hashed_password`, `is_active`, `id`, `created_at`) mediante `extra="forbid"`.
  - *Entrada objetivo (`UserUpdate` con `extra="forbid"`):* `email: str | None` (con validación de patrón), `role: RoleEnum | None`.
  - *Salida objetivo (`UserResponse`):* `id`, `email`, `is_active`, `role`, `created_at`.
- **`DELETE /users/{id}` (✅):** Se explicita `response_model=None` junto a `status_code=204` conforme al contrato de FastAPI para respuestas sin cuerpo.

---

### 2.3. Perfiles de Usuario (`/profiles`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original | Estado Original |
|---|:---:|---|---|---|---|---|
| 11 | `GET` | `/profiles/me` | Lectura de datos de contacto del propio usuario | `app/account/profile/page.tsx` | `response_model=ProfileDB` (expone `id` y FK `user_id`) | ⚠️ Parcialmente serializado |
| 12 | `PUT` | `/profiles/me` | Edición parcial de nombre, teléfono y dirección propios | `app/account/profile/page.tsx` | `response_model=ProfileDB`; entrada `ProfileUpdate` sin `extra="forbid"` | ⚠️ Parcialmente serializado |

#### Notas técnicas y payloads objetivo — Perfiles
- **`GET /profiles/me` y `PUT /profiles/me` (⚠️ → Eliminación de `ProfileDB` como respuesta y ocultación de FK `user_id`):**
  - *Por qué requieren cambio:* Ambos endpoints exponían directamente el modelo interno de almacenamiento `ProfileDB`, filtrando el `id` documental de TinyDB y la **clave foránea interna en bruto `user_id`**. En una ruta `/me` acotada al token del llamante, `ProfilePage` únicamente utiliza `name`, `phone` y `address`.
  - *Entrada objetivo en `PUT /profiles/me` (`ProfileUpdate` con `extra="forbid"`):* `name: str | None`, `phone: str | None`, `address: str | None` (impide inyectar `id` o reasignar `user_id`).
  - *Salida objetivo (`ProfileResponse`):* `name: str`, `phone: str`, `address: str` (**sin `id` ni `user_id`**).

---

### 2.4. Directorio de Proveedores (`/api/suppliers`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original | Estado Original |
|---|:---:|---|---|---|---|---|
| 13 | `GET` | `/api/suppliers` | Listado filtrable por país y categoría | `app/suppliers/page.tsx` (`SupplierDirectory`) | `response_model=list[SupplierResponse]` (incluye `updated_at`) | ⚠️ Parcialmente serializado |
| 14 | `POST` | `/api/suppliers` | Alta de proveedor logístico | `app/suppliers/page.tsx` | `response_model=SupplierResponse` (`SupplierResponse` heredaba de `SupplierCreate`) | ⚠️ Parcialmente serializado |
| 15 | `GET` | `/api/suppliers/{id}` | Detalle individual de proveedor | Clientes API / detalle | `response_model=SupplierResponse` | ✅ Ya serializado |
| 16 | `PATCH` | `/api/suppliers/{id}/rate` | Actualización de tarifa por envío | `app/suppliers/page.tsx` | `response_model=SupplierResponse`; entrada `SupplierRateUpdate` | ✅ Ya serializado |
| 17 | `PATCH` | `/api/suppliers/{id}/status` | Activación o suspensión de proveedor | `app/suppliers/page.tsx` | `response_model=SupplierResponse`; entrada `SupplierStatusUpdate` | ✅ Ya serializado |
| 18 | `DELETE` | `/api/suppliers/{id}` | Eliminación de proveedor | `app/suppliers/page.tsx` | `204 No Content` (`Response`) | ✅ Ya serializado |

#### Notas técnicas y payloads objetivo — Proveedores
- **`GET /api/suppliers` (⚠️ → Esquema ligero `SupplierListItem`):**
  - *Por qué requiere cambio:* La tabla del backoffice (`uis/backoffice/app/suppliers/page.tsx`, tipo `Supplier`) renderiza exactamente 10 campos operativos y **jamás lee `updated_at`**, que se estaba serializando innecesariamente en cada fila del directorio.
  - *Salida objetivo (`list[SupplierListItem]`):* `id`, `name`, `country`, `categories`, `rate_per_shipment`, `currency`, `service_zone`, `contact_email`, `notes`, `status` (**sin `updated_at`**).
- **`POST /api/suppliers`, `GET /api/suppliers/{id}`, `PATCH .../rate`, `PATCH .../status`:**
  - *Separación entrada/salida:* Anteriormente `class SupplierResponse(SupplierCreate)` acoplaba el esquema de salida como subclase directa del esquema de creación. Se desacopla `SupplierResponse` con campos explícitos (`id`, `name`, `country`, `categories`, `rate_per_shipment`, `currency`, `service_zone`, `contact_email`, `notes`, `status`, `updated_at`), y se añade `extra="forbid"` en `SupplierRateUpdate` y `SupplierStatusUpdate`.
- **`DELETE /api/suppliers/{id}` (✅):** Se explicita `response_model=None` con `status_code=204`.

---

### 2.5. Gestión Centralizada de Inventario ORM (`/inventory`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original | Estado Original |
|---|:---:|---|---|---|---|---|
| 19 | `GET` | `/inventory/products` | Catálogo de SKUs con stock neto por sede | `InventoryProductsPage` y selector inicial | `response_model=list[SKUResponse]` (anida `stock_by_warehouse` en cada fila) | ⚠️ Parcialmente serializado |
| 20 | `POST` | `/inventory/products` | Registro de nuevo SKU (stock inicial 0) | `InventoryProductsPage` | `response_model=SKUResponse`; entrada `SKUCreate` (`extra="forbid"`) | ✅ Ya serializado |
| 21 | `GET` | `/inventory/products/{id}` | Detalle de SKU y desglose multi-almacén | `OutboundOrderForm` (`fetchInventoryProductById`) | `response_model=SKUResponse` | ✅ Ya serializado |
| 22 | `POST` | `/inventory/orders/inbound` | Registro de recepción `StockEntry` | `InboundOrderPage` | `response_model=StockEntryResponse`; entrada `StockEntryCreate` sin `extra="forbid"` | ⚠️ Parcialmente serializado |
| 23 | `POST` | `/inventory/orders/outbound` | Registro de salida `StockExit` validando stock | `OutboundOrderForm` | `response_model=StockExitResponse`; entrada `StockExitCreate` sin `extra="forbid"` | ⚠️ Parcialmente serializado |
| 24 | `GET` | `/inventory/orders` | Historial consolidado de entradas y salidas | `InventoryOrdersHistoryPage` | `response_model=list[StockOrderResponse]` (expone FK `sku_id` junto a `sku` anidado) | ⚠️ Parcialmente serializado |

#### Notas técnicas, relaciones y payloads objetivo — Inventario (`SQLModel`)
- **Garantía Cero ORM en Crudo:** Ninguna ruta devuelve instancias `SQLModel` (`SKU`, `StockEntry`, `StockExit`); todas proyectan a modelos Pydantic puros independientes (`schemas.py`), evitando exponer relaciones perezosas `entries` / `exits` o metadatos de SQLAlchemy.
- **`GET /inventory/products` (⚠️ → Esquema plano de listado `SKUListItem`):**
  - *Por qué requiere cambio:* El catálogo `InventoryProductsPage` solo consume los campos planos del SKU y su `current_stock`. El mapa anidado `stock_by_warehouse` (`{"LA": int, "ZGZ": int}`) únicamente lo utiliza la vista de salida al consultar el detalle individual `GET /inventory/products/{id}` (`fetchInventoryProductById`).
  - *Salida objetivo (`list[SKUListItem]`):* `id`, `name`, `sku`, `client_name`, `category`, `warehouse`, `current_stock` (**sin el objeto anidado `stock_by_warehouse`**).
- **`POST /inventory/orders/inbound` y `POST /inventory/orders/outbound` (⚠️ → Entradas estrictas y decisión de relación):**
  - *Entradas endurecidas (`extra="forbid"`):* `StockEntryCreate` y `StockExitCreate` bloquean la inyección de `id`, `created_at` o `user_uuid` desde el cliente (el servidor resuelve `user_uuid` exclusivamente desde el JWT autenticado).
  - *Decisión explícita sobre la relación con `SKU` en confirmaciones de escritura:* En `StockEntryResponse` y `StockExitResponse` se devuelve **únicamente el ID relacionado (`sku_id`)** sin anidar el objeto `SKU` completo, dado que el formulario emisor ya tiene seleccionado el producto en memoria y solo requiere confirmar el folio creado (`id`, `sku_id`, `quantity`, `warehouse`, `reference` / `exit_type` + `tracking_number`, `created_at`, `user_uuid`).
- **`GET /inventory/orders` (⚠️ → Limpieza de FK en bruto duplicada y recorte de relación anidada):**
  - *Por qué requiere cambio:* `StockOrderResponse` devolvía **al mismo tiempo** la clave foránea en bruto `sku_id` y el subobjeto `sku: SKUSummary`, además de repetir `warehouse` dentro de `SKUSummary` cuando cada movimiento ya posee su propio `warehouse`.
  - *Decisión explícita sobre relaciones en `GET /inventory/orders`:*
    1. **Relación `SKU` → Proyección anidada ligera (`SKUSummary`) sin FK duplicada:** `InventoryOrdersHistoryPage` busca y renderiza `order.sku.name`, `order.sku.sku`, `order.sku.client_name` y `order.sku.category` (precargados en SQL con un único `JOIN` sin N+1). Por ello se conserva `sku: SKUSummary` reducido a esos 5 atributos (`id`, `name`, `sku`, `client_name`, `category`), **eliminando la FK redundante `sku_id` en la raíz** y eliminando `sku.warehouse`.
    2. **Atributo `user_uuid` → Conservado intencionalmente:** En la arquitectura de doble base de datos de TrackFlow (TinyDB + PostgreSQL), `InventoryOrdersHistoryPage` renderiza una columna dedicada de auditoría operativa (`Creado por (user_uuid)`) y permite filtrar por ella; no es un secreto ni credencial, sino el identificador público de trazabilidad logística requerido por el dominio.
  - *Salida objetivo (`list[StockOrderResponse]`):* `id`, `order_type`, `sku` (`id`, `name`, `sku`, `client_name`, `category`), `quantity`, `warehouse`, `reference`, `exit_type`, `tracking_number`, `created_at`, `user_uuid`.

---

### 2.6. Gestor Centralizado y Analizador de Incidencias (`/api/incidents`)

| # | Método | Ruta | Propósito | Consumidor Principal | Comportamiento Original | Estado Original |
|---|:---:|---|---|---|---|---|
| 25 | `GET` | `/api/incidents/summary` | Conteos agregados por estado, categoría, origen y sede | `IncidentSummaryPanel.tsx` | Sin `response_model` (`-> Any`); devuelve `dict` libre | ❌ Sin serializar |
| 26 | `GET` | `/api/incidents` | Listado filtrable de incidencias operativas | `IncidentListPanel.tsx` | Sin `response_model` (`-> Any`); vuelca `to_dict()` completo con `updated_at` | ❌ Sin serializar |
| 27 | `POST` | `/api/incidents` | Registro de nueva incidencia operativa | `IncidentRegistrationForm.tsx` | Sin esquema de entrada (`Request` crudo) ni `response_model` (`-> Any`) | ❌ Sin serializar |
| 28 | `GET` | `/api/incidents/{incident_id}` | Detalle completo de una incidencia por ID | `fetchIncidentById` / clientes API | Sin `response_model` (`-> Any`); devuelve `to_dict()` | ❌ Sin serializar |
| 29 | `PATCH` | `/api/incidents/{incident_id}/status` | Transición validada de estado de una incidencia | `IncidentListPanel.tsx` | Sin esquema de entrada (`Request` crudo) ni `response_model` (`-> Any`) | ❌ Sin serializar |
| 30 | `POST` | `/api/incidents/analyze` | Análisis de calidad por lotes sobre archivo CSV | `IncidentsAnalysis.tsx` | Sin `response_model` (`dict[str, Any]`); devuelve 4 mapas internos no usados | ❌ Sin serializar |
| 31 | `GET` | `/api/incidents/results/export` | Descarga de resultados del último análisis en CSV | `IncidentsAnalysis.tsx` (enlace descarga) | `StreamingResponse` (`text/csv; charset=utf-8`), `response_model=None` | ✅ Ya serializado |

#### Notas técnicas y payloads objetivo — Incidencias
- **`GET /api/incidents/summary` (❌ → `IncidentsSummaryResponse`):**
  - *Salida objetivo:* `total: int`, `by_status: dict[IncidentStatusLiteral, int]`, `by_category: dict[IncidentCategoryLiteral, int]`, `by_origin: dict[IncidentOriginLiteral, int]`, `by_branch: dict[IncidentBranchLiteral, int]`.
- **`GET /api/incidents` (❌ → Esquema ligero de listado `IncidentListItem`):**
  - *Por qué requiere cambio:* Además de carecer de `response_model`, volcaba `updated_at` en cada fila cuando `IncidentListPanel.tsx` únicamente renderiza `id`, `created_at`, `title`, `description`, `category`, `origin`, `branch` y `status`. Asimismo garantiza por contrato que la columna interna de deduplicación `source_ref` de SQLite jamás se exponga.
  - *Salida objetivo (`list[IncidentListItem]`):* `id`, `title`, `description`, `category`, `status`, `origin`, `branch`, `created_at` (**sin `updated_at` ni `source_ref`**).
- **`POST /api/incidents` y `PATCH /api/incidents/{incident_id}/status` (❌ → Esquemas separados de entrada y salida):**
  - *Por qué requieren cambio:* Leían `await request.json()` directamente sin declarar modelos de entrada en la firma ni `response_model` en el decorador, dejando `/docs` ciego sobre los campos aceptados y devueltos.
  - *Entradas objetivo (`extra="forbid"`):*
    - `IncidentCreateRequest`: `title`, `description`, `category`, `origin`, `branch`, `status` (opcional, por defecto `"open"`; bloquea `id`, `created_at`, `updated_at`, `source_ref`).
    - `IncidentStatusUpdateRequest`: `status` (único campo escribible en transición de estado).
  - *Salida objetivo (`IncidentDetailResponse`, compartida con `GET /api/incidents/{incident_id}`):* `id`, `title`, `description`, `category`, `status`, `origin`, `branch`, `created_at`, `updated_at` (sin `source_ref`).
- **`POST /api/incidents/analyze` (❌ → Recorte de over-fetching con `IncidentAnalysisResponse`):**
  - *Por qué requiere cambio:* `process_csv_data()` genera un diccionario interno de 9 claves para alimentar la exportación CSV posterior en `last_analysis`, pero el endpoint devolvía las 9 claves directamente al navegador. El componente `IncidentsAnalysis.tsx` únicamente consume 5 métricas y descarta `categories`, `statuses`, `countries` y `satisfaction_scores`.
  - *Salida objetivo (`IncidentAnalysisResponse`):* `total_records: int`, `valid_records: int`, `invalid_records: int`, `invalid_reasons: dict[str, int]`, `average_satisfaction: float | None`.
- **`GET /api/incidents/results/export` (✅):** Mantiene `response_model=None` y `response_class=StreamingResponse` con documentación explícita `text/csv` en OpenAPI.
