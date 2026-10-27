# Plan y Documentación de Pruebas (`TESTING.md`)

Este documento describe el plan de pruebas unitarias, la estrategia de diseño enfocada en **lógica de negocio** (evitando probar la serialización HTTP o los internos del framework), las instrucciones de ejecución y los resultados de cobertura para los tickets:

- **AUTH-088 (Prioridad Alta)**: Cobertura de pruebas unitarias para todos los endpoints y utilidades de la API de autenticación (`FastAPI` + `pytest` y `TypeScript` + `Jest`).
- **API-042 (Extra — Backlog)**: Pruebas unitarias para los endpoints del backoffice (`users`, `profiles`, `suppliers`, `incidents`).
- **FE-019 (Extra — Backlog)**: Pruebas unitarias con `Jest` para las funciones de utilidad y helpers del frontend (`Next.js / TypeScript`).

---

## 🚀 Cómo ejecutar las pruebas

### 1. Backend (Python / FastAPI con `pytest`)

Desde la raíz del proyecto, ejecuta:

```bash
# Instalar/sincronizar dependencias (incluyendo el grupo dev)
uv sync --dev

# Ejecutar toda la batería de pruebas unitarias
uv run pytest

# Ejecutar las pruebas verificando el reporte de cobertura
uv run pytest --cov --cov-report=term-missing
```

### 2. Frontend y Utilidades TypeScript (`Jest`)

Para ejecutar la batería de `Jest` del proyecto frontend (`uis/backoffice`) de forma independiente:

```bash
cd uis/backoffice
npx jest --coverage
```

---

## 🧠 Principios del Plan de Pruebas

1. **Enfoque en decisiones de negocio, no en el framework**:
   Cada prueba invoca directamente las funciones de endpoint y utilidades de dominio para verificar lo que la aplicación **decide** y los **efectos de estado** que produce (p. ej., si la contraseña se almacena con hash `bcrypt` y nunca en texto plano, si el rol público se fuerza a `user` aunque se envíe `admin`, si un token de recuperación queda invalidado tras su primer uso, o si un token expirado o de tipo incorrecto es rechazado), sin probar la serialización HTTP de FastAPI.
2. **Aislamiento total**:
   Las pruebas de FastAPI utilizan instancias en memoria de `TinyDB` (`MemoryStorage`), bases de datos `SQLite` temporales por test y mocks para el envío de correos (`send_password_reset_email`), garantizando que las pruebas sean deterministas, rápidas y sin efectos secundarios sobre archivos reales.
3. **Estructura de tres niveles por endpoint**:
   Cada endpoint cuenta como mínimo con:
   - **Camino feliz (*Happy Path*)**: Entrada válida y verificación del cambio de estado o decisión esperada.
   - **Caso límite (*Edge Case*)**: Entradas en la frontera del dominio (contraseñas de 1 y 72 caracteres, emails duplicados, perfiles vacíos, tokens reutilizados en el mismo segundo, usuarios inactivos).
   - **Modo de fallo (*Failure Mode*)**: Credenciales inválidas, tokens expirados o manipulados, escalada de privilegios no autorizada, fallos de almacenamiento (`OSError`).

---

## 📋 Plan de Pruebas Detallado (Definido antes de la implementación)

### Suite 1: Autenticación y Seguridad (`AUTH-088`)

| Módulo de Prueba | Endpoint / Unidad | Camino Feliz (*Happy Path*) | Casos Límite (*Edge Cases*) | Modos de Fallo (*Failure Modes*) |
| :--- | :--- | :--- | :--- | :--- |
| `tests/test_register.py` | `POST /users` (`create_user`) | Registra un usuario nuevo, genera hash `bcrypt` distinto de la contraseña en claro, asigna `is_active=True` y crea su documento en `profiles`. | 1. Intento de escalada de rol en registro público (`role="admin"` se fuerza a `"user"`).<br>2. Campos opcionales (`name`, `phone`, `address`) omitidos o `None` se normalizan a `""`.<br>3. Contraseña en el límite exacto de `bcrypt` (72 caracteres).<br>4. Email duplicado devuelve conflicto `409` sin duplicar registros. | 1. Contraseña vacía (`""`) o mayor a 72 caracteres es rechazada.<br>2. Email vacío o con formato inválido es rechazado.<br>3. Fallo de I/O (`OSError`) al consultar o insertar en `TinyDB` devuelve `500`. |
| `tests/test_login.py` | `POST /auth/login` (`login`) | Autentica credenciales válidas y emite un JWT cuyo claim `sub` corresponde al `doc_id` del usuario. | 1. Usuario existente pero desactivado (`is_active=False`) es rechazado aunque la contraseña sea correcta.<br>2. Registro de usuario sin campo `hashed_password` en base de datos no lanza excepción no controlada y rechaza el acceso (`401`). | 1. Contraseña incorrecta para un usuario válido (`401`).<br>2. Email no registrado devuelve exactamente el mismo mensaje (`401`) para evitar enumeración de usuarios.<br>3. Error de lectura en base de datos (`OSError`) devuelve `500`. |
| `tests/test_token.py` | `security.py` (`create_access_token`, `create_password_reset_token`, `decode_password_reset_token`, `get_current_user`, `_parse_int_env`) | Genera y valida tokens de sesión y de recuperación; `get_current_user` resuelve el `UserDB` activo a partir del JWT. | 1. Aislamiento de tipos de token: un token de reset (`type="password_reset"`) es rechazado por `get_current_user`, y un token de sesión es rechazado por `decode_password_reset_token`.<br>2. Clamping de `RESET_TOKEN_EXPIRE_MINUTES` entre 15 y 60 minutos y fallback ante variables de entorno no numéricas. | 1. Token de acceso expirado (`exp` en el pasado) es rechazado con `401`.<br>2. Token de reset expirado devuelve `None`.<br>3. Token firmado con otra clave secreta, corrupto o sin `sub` numérico es rechazado.<br>4. Usuario eliminado o desactivado tras emitirse el token es rechazado con `401`. |
| `tests/test_me.py` | `GET /auth/me` (`read_me`) | Devuelve los datos combinados de cuenta (`email`, `role`) y perfil (`name`, `phone`, `address`) del usuario autenticado. | Usuario válido cuyo documento en `profiles` no existe devuelve campos de perfil vacíos (`""`) sin fallar. | 1. Token inválido o expirado en dependencia `get_current_user` (`401`).<br>2. Token de recuperación de contraseña usado como token de sesión (`401`).<br>3. Fallo de lectura en `profiles` (`OSError`) devuelve `500`. |
| `tests/test_forgot_password.py` | `POST /auth/forgot-password` (`forgot_password`) | Genera un token de recuperación válido para un usuario activo y encola la tarea en segundo plano `send_password_reset_email`. | 1. Prevención de enumeración: un email no registrado devuelve el mismo mensaje pero **no** encola ningún correo.<br>2. Usuario con `is_active=False` no dispara envío de correo. | 1. Email vacío o que supera 254 caracteres es rechazado.<br>2. Fallo de lectura en `TinyDB` (`OSError`) se absorbe de forma segura sin revelar el error ni enviar correo. |
| `tests/test_reset_password.py` | `POST /auth/reset-password` (`reset_password`) | Restablece la contraseña con un token válido, actualiza el hash `bcrypt` y registra `password_changed_at`. | 1. Token de un solo uso estricto: reutilizar el mismo token inmediatamente (incluso dentro del mismo segundo) es rechazado con `400`.<br>2. Contraseña nueva en los límites de longitud (1 y 72 caracteres). | 1. Token expirado, malformado o de tipo sesión (`400`).<br>2. Usuario eliminado o desactivado después de emitirse el token (`400`).<br>3. `password_changed_at` corrupto en base de datos (`400`).<br>4. Fallo de lectura/escritura en `TinyDB` (`OSError`) devuelve `500`. |
| `tests/test_change_password.py` | `POST /auth/change-password` (`change_password`) | Verifica la contraseña actual, actualiza el hash `bcrypt` y deja invalidados los tokens de reset emitidos previamente. | Actualizar a una contraseña en la frontera de longitud (1 carácter o 72 caracteres). | 1. Contraseña actual incorrecta devuelve `400` y mantiene el hash original intacto.<br>2. Contraseña nueva vacía o mayor de 72 caracteres es rechazada.<br>3. Error de escritura en base de datos (`OSError`) devuelve `500`. |

---

### Suite 2 (Extra — `API-042`): Endpoints del Backoffice

| Módulo de Prueba | Grupo de Endpoints | Camino Feliz (*Happy Path*) | Casos Límite (*Edge Cases*) | Modos de Fallo (*Failure Modes*) |
| :--- | :--- | :--- | :--- | :--- |
| `tests/test_users.py` | `/users` (`GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`) | Listar usuarios, obtener detalle, actualizar email propio, cambio de rol por un `admin` y eliminación con borrado en cascada del perfil. | 1. Actualizar usuario con su mismo email actual no dispara falso conflicto `409`.<br>2. Payload de actualización vacío (`{}`) mantiene los datos sin errores.<br>3. Un `admin` puede actualizar o eliminar la cuenta de otro usuario. | 1. Usuario no propietario ni `admin` intenta modificar o borrar otra cuenta (`403`).<br>2. Usuario estándar intenta escalar su propio `role` a `admin` (`403`).<br>3. Actualizar email a uno ya ocupado por otro usuario (`409`).<br>4. Usuario inexistente (`404`) y fallos `OSError` (`500`). |
| `tests/test_profiles.py` | `/profiles/me` (`GET`, `PUT`) | Lectura y actualización parcial o total del perfil del usuario autenticado. | Actualización parcial (solo `phone`) conserva intactos `name` y `address`. | 1. Perfil no encontrado en la tabla `profiles` (`404`).<br>2. Error de I/O (`OSError`) al leer o actualizar (`500`). |
| `tests/test_suppliers.py` | `/api/suppliers` (`POST`, `GET`, `GET /{id}`, `PATCH /{id}/rate`, `PATCH /{id}/status`, `DELETE /{id}`) | Creación, consulta por ID, filtrado por país/categoría, cambio de tarifa y estado, y borrado de proveedores. | Filtro combinado (`country` + `category`) y filtro sin coincidencias (`[]`). | 1. Tarifas menores o iguales a cero (`0`, `-1`) y emails inválidos rechazados.<br>2. Proveedor inexistente en `GET`, `PATCH` o `DELETE` (`404`).<br>3. Fallo `OSError` (`500`). |
| `tests/test_incidents.py` | `/api/incidents` (`POST`, `GET`, `GET /summary`, `GET /{id}`, `PATCH /{id}/status`, `POST /analyze`, `GET /results/export`) | Creación normalizada, listado con filtros, cálculo de resumen agregado, transición válida de estado (`open -> in_progress -> resolved`) y análisis/exportación CSV. | 1. Filtros con espacios o vacíos se ignoran limpiamente.<br>2. Títulos y descripciones con espacios laterales se recortan (`strip`). | 1. Transición de estado inválida desde estados finales (`resolved` o `discarded`) devuelve `400`.<br>2. Filtros fuera de catálogo devuelven `400` con el campo afectado.<br>3. Archivo no `.csv` o vacío en `/analyze` (`400`) y exportación sin análisis previo (`404`). |

---

### Suite 3 (`AUTH-088` TS + Extra `FE-019`): Funciones de Utilidad del Frontend y TypeScript (`Jest`)

| Archivo de Prueba | Funciones Probadas | Camino Feliz (*Happy Path*) | Casos Límite (*Edge Cases*) | Modos de Fallo (*Failure Modes*) |
| :--- | :--- | :--- | :--- | :--- |
| `uis/backoffice/__tests__/api.test.ts` | `getToken`, `setToken`, `clearToken`, `resolveApiBaseUrl`, `fetchWithAuth` | Almacena, recupera y elimina el JWT en `localStorage`; `fetchWithAuth` inyecta `Authorization: Bearer <token>` y devuelve la respuesta. | 1. `resolveApiBaseUrl` elimina la barra final (`/`) en `NEXT_PUBLIC_API_URL` y transforma dominios `.app.github.dev` al puerto `-8000`.<br>2. Operación segura en SSR (`window === undefined`).<br>3. Si `401` ocurre estando ya en `/login`, limpia el token pero evita bucle de redirección. | 1. `localStorage` bloqueado (`QuotaExceededError` / `SecurityError`) no rompe la ejecución.<br>2. Respuesta `401` limpia el token y redirige a `/login`.<br>3. Error de red se traduce en mensaje legible; `AbortError` se relanza intacto. |
| `uis/backoffice/__tests__/authValidators.test.ts` | `validateRegistrationForm`, `buildRegistrationPayload`, `isFieldName`, `parseApiError` | Valida formularios de registro correctos, normaliza campos opcionales vacíos a `null` y mapea respuestas de error de la API. | 1. Contraseña en el límite exacto de 72 caracteres es aceptada.<br>2. Espacios laterales en `email` y campos opcionales se recortan.<br>3. Error `409` se asigna específicamente al campo `email`. | 1. Email vacío o solo espacios, contraseña vacía o de 73+ caracteres producen errores por campo.<br>2. Respuesta `422` de FastAPI mapea cada `loc` a su campo o al mensaje general.<br>3. Errores `500` o JSON inválido devuelven mensaje seguro de fallback. |
| `uis/backoffice/__tests__/formattersAndIncidents.test.ts` | `formatDate`, `getStatusBadgeClasses`, `extractFriendlyError`, `fetchIncidents`, `createIncidentRequest`, `updateIncidentStatusRequest` | Formatea fechas ISO a formato local (`es-ES`), asigna clases semánticas por estado y gestiona peticiones/errores del servicio de incidencias. | 1. Cadena vacía en `formatDate` devuelve `'—'`.<br>2. `extractFriendlyError` recorta espacios en `message`/`detail` para errores 4xx. | 1. Fecha inválida devuelve el string original sin lanzar excepción.<br>2. Errores `404`, `500` y fallos de red en `incidentsApi` lanzan `ApiValidationError` con mensaje de negocio apropiado. |

---

## 🤖 Flujo de Trabajo Asistido por IA: Casos Identificados y Bugs Corregidos

Durante el análisis de la lógica de `services/api/routes/auth.py`, `services/api/security.py` y `services/api/models.py` junto al agente de IA para diseñar casos límite, se identificaron y corrigieron **3 bugs reales de lógica de negocio**:

### Bug 1: Usuarios desactivados (`is_active=False`) podían iniciar sesión y usar tokens activos
- **Detección**: Mientras que `POST /auth/forgot-password` y `POST /auth/reset-password` verificaban `user.get("is_active", True)`, tanto `POST /auth/login` como `get_current_user` omitían esta comprobación. Un usuario suspendido (`is_active=False`) podía obtener un JWT nuevo o seguir operando en endpoints protegidos (`/auth/me`, `/auth/change-password`, `/users`).
- **Corrección**: Se añadió la validación `not user.get("is_active", True)` en `login()` (`services/api/routes/auth.py`) y `not record.get("is_active", True)` en `get_current_user()` (`services/api/security.py`), rechazando el acceso con `401 Unauthorized`.
- **Tests que lo cubren**: `test_login_rejects_inactive_user_even_with_valid_password` (`tests/test_login.py`) y `test_get_current_user_rejects_deleted_or_deactivated_user` (`tests/test_token.py`).

### Bug 2: Truncado de sub-segundos en `iat` permitía reutilizar tokens de reset bajo el mismo segundo
- **Detección**: En `create_password_reset_token`, `python-jose` serializaba `"iat": datetime.now(timezone.utc)` truncando los microsegundos a un entero, mientras que `_set_password` guardaba `password_changed_at` con precisión de microsegundos (`isoformat()`) y `reset_password` comprobaba `if issued_at < changed_ts:`. Si el cambio de contraseña y la emisión/reutilización ocurrían en el mismo instante (`issued_at == changed_ts`), la condición estricta `<` no invalidaba el token ya usado.
- **Corrección**: Se añadió precisión de timestamp en `iat_ts` (`services/api/security.py`) y se actualizó la validación a `if issued_at <= changed_ts:` en `reset_password()` (`services/api/routes/auth.py`), garantizando que cualquier token emitido antes o en el mismo instante del último cambio de contraseña quede estrictamente invalidado tras su primer uso.
- **Tests que lo cubren**: `test_reset_password_token_cannot_be_reused_even_at_same_timestamp` (`tests/test_reset_password.py`).

### Bug 3: Registro de usuarios aceptaba contraseñas vacías (`""`) y emails sin formato válido
- **Detección**: A diferencia de `ResetPasswordRequest` y `ChangePasswordRequest` (que definían `min_length=1, max_length=72`), el modelo `UserCreate` solo definía `max_length=72` para `password` y `str` sin restricciones para `email`, permitiendo registrar usuarios con contraseña vacía `""` o email en blanco.
- **Corrección**: Se añadieron las restricciones de dominio en `services/api/models.py` (`min_length=1, max_length=72` en contraseñas y patrón de email válido en `UserCreate` y `ForgotPasswordRequest`).
- **Tests que lo cubren**: `test_register_rejects_empty_password` y `test_register_rejects_invalid_email_format` (`tests/test_register.py`).

---

## 📊 Resultados de Cobertura Verificados

### 1. Backend (`uv run pytest --cov --cov-report=term-missing`)

```text
Name                                Stmts   Miss  Cover
-------------------------------------------------------
services\api\database.py              151     27    82%
services\api\main.py                  169     41    76%
services\api\models.py                 47      0   100%
services\api\routes\auth.py            73      0   100%
services\api\routes\profiles.py        24      0   100%
services\api\routes\suppliers.py       70      0   100%
services\api\routes\users.py           81      6    93%
services\api\security.py               63      0   100%
-------------------------------------------------------
TOTAL (API)                           774    161    79%
```

- **Módulo de autenticación (`routes/auth.py`, `security.py`, `models.py`)**: **100% de cobertura** (requisito mínimo: 70%).
- **Módulos de backoffice (`routes/users.py`, `routes/profiles.py`, `routes/suppliers.py`, `main.py`, `database.py`)**: **76% – 100% de cobertura** (requisito extra `API-042`: 60%).

### 2. Frontend / TypeScript (`cd uis/backoffice && npx jest --coverage`)

```text
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   83.82 |    82.39 |     100 |   83.33 |
 services           |   71.55 |       72 |     100 |   70.53 |
  incidentsApi.ts   |   71.55 |       72 |     100 |   70.53 |
 utils              |     100 |    88.04 |     100 |     100 |
  api.ts            |     100 |      100 |     100 |     100 |
  authValidators.ts |     100 |    81.35 |     100 |     100 |
  formatters.ts     |     100 |      100 |     100 |     100 |
```

- **3 suites pasadas (22 pruebas en total)** con **100% de cobertura de líneas y funciones** en todas las utilidades de autenticación y formateo (`api.ts`, `authValidators.ts`, `formatters.ts`).
