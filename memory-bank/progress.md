# Progreso del proyecto

## Estado actual

- **Auditoría y Estandarización de Gestión de Errores (`feature/error-handling-audit`):** completado. Auditoría transversal en las 3 capas (Frontend, Backend y Scripts): eliminada filtración de `RESEND_API_KEY` en `services/api/mailer.py`, sanitizados errores de validación y añadidas capturas `try/except` de ámbito reducido en rutas de FastAPI (`auth.py`, `users.py`, `profiles.py`, `suppliers.py`, `main.py`, `security.py`), añadidos códigos de salida `sys.exit(1)` y validaciones defensivas en `scripts/analyze.py`, `scripts/seed_incidents.py`, `services/api/seed.py` y `skills/data-analysis/scripts/pandas_clean.py`, y estandarizado el patrón de 3 estados (cargando, éxito, error legible sin códigos HTTP crudos + llamada a la acción clara) en `uis/backoffice/` y `uis/talent-pipeline-tracker/`.
- **Gestor de Incidencias Centralizado:** completado. Incluye modelo `Incident` con restricciones de integridad en `services/api/database.py`, lógica de validación y transformación compartida en `packages/shared/`, script idempotente `scripts/seed_incidents.py`, endpoints REST (`POST /api/incidents`, `GET /api/incidents`, `GET /api/incidents/{id}`, `PATCH /api/incidents/{id}/status`, `GET /api/incidents/summary`) y vistas de registro, listado y resumen en `uis/backoffice/`.
- **Modelos de dominio:** completado. Incluye interfaces TypeScript y funciones de filtrado, ordenamiento, búsqueda, validación y agregación en `src/`.
- **Infraestructura de agentes:** completada. Incluye banco de memoria, instrucciones globales, reglas y un skill de revisión de código.
- **Website público:** primera versión completada con soluciones, cifras de negocio y red de almacenes.
- **Backoffice interno:** primera versión completada con KPIs, estado de almacenes y frentes operativos.
- **Autenticación de la API:** completada. JWT con `python-jose`, hash bcrypt con `passlib`, tablas TinyDB `users` y `profiles`, endpoints `/auth`, `/users` y `/profiles`, y rutas de `/api/suppliers` protegidas.
- **Directorio de proveedores:** contrato con `rate_per_shipment`, moneda, zona, email y notas; vista Next.js `/suppliers` autenticada y enlazada desde el menú; seeder ejecutable mediante `uv run seed`.

## Tareas de autenticación y restricción de rutas

- [x] Tablas `users` y `profiles` en TinyDB y modelos Pydantic (`RoleEnum`, `User*`, `Profile*`).
- [x] `security.py`: hash/verificación de contraseñas, `create_access_token` con `exp` y dependencia `get_current_user`.
- [x] `POST /auth/login` y `GET /auth/me`.
- [x] CRUD de `/users` con control owner/admin (403) y emails únicos (409).
- [x] `GET` y `PUT /profiles/me`.
- [x] Registro público forzado a rol `user`; solo un `admin` puede cambiar roles.
- [x] Contraseña limitada a 72 caracteres por la restricción de bcrypt.
- [x] Las 6 rutas de `/api/suppliers` exigen token válido (401 sin él).
- [x] AUTH-03: `POST /auth/forgot-password` (siempre 200, email vía Resend), `POST /auth/reset-password` (JWT de un solo uso mediante `iat` vs `password_changed_at`) y `POST /auth/change-password` (Bearer, 400 si la contraseña actual falla).

## Tareas de autenticación en el frontend (backoffice)

- [x] `src/utils/api.ts`: `fetchWithAuth` con cabecera Bearer y redirección a `/login` ante un 401.
- [x] `src/contexts/AuthContext.tsx`: `AuthProvider` y `useAuth` con `token`, `user`, `isAuthenticated`, `isLoading`, `login`, `logout` y `refreshUser`.
- [x] `AuthProvider` integrado en `app/layout.tsx`.
- [x] Vistas `/login` y `/register` (registro con errores 409/422 por campo y auto-login).
- [x] `src/components/AuthGuard.tsx` protegiendo `/` y `/account/profile`.
- [x] Vista `/account/profile` para editar nombre, teléfono y dirección vía `PUT /profiles/me`.
- [x] AUTH-03: vistas `/forgot-password`, `/reset-password` y `/account/change-password` (con `AuthGuard` y `fetchWithAuth`), y enlace "¿Olvidaste tu contraseña?" en `/login`.

## Próximos pasos

1. Conectar el website público con contenido administrable.
2. Evolucionar el gestor de incidencias con búsqueda semántica mediante embeddings.
3. Implementar servicios backend e integraciones con almacenes y transportistas.
4. Revisar los contactos, zonas y tarifas de demostración de proveedores antes de producción.
5. Crear un seeder para el primer usuario `admin`.

## Decisiones pendientes

- Confirmar el framework definitivo para la evolución del backoffice.
- Definir la estrategia de deployment para interfaces, servicios y agentes.

## Historial de cambios

- **2026-10-26:** completada la auditoría transversal de gestión de errores (`feature/error-handling-audit`) en frontend (`uis/backoffice/`, `uis/talent-pipeline-tracker/`), backend (`services/api/`) y scripts (`scripts/`, `services/api/seed.py`, `skills/data-analysis/scripts/pandas_clean.py`).
- **2026-10-23:** integrado el Gestor de Incidencias Centralizado de TrackFlow: lógica compartida en `packages/shared/`, script de seed idempotente `scripts/seed_incidents.py`, endpoints CRUD/ciclo de vida/resumen en `services/api/` y vistas de registro, listado con filtros y panel de resumen en `uis/backoffice/`.
- **2026-10-22:** AUTH-03: recuperación y cambio de contraseña en la API. Nuevo `mailer.py` con `resend` (`RESEND_API_KEY`), tokens de recuperación con `type=password_reset` y caducidad de 15-60 min rechazados como sesión, campo `password_changed_at` en `users` y cinco pruebas en `test_auth_password.py`.
- **2026-10-22:** corregido el contrato de proveedores y el PATCH de tarifa; añadidos `SUPPLIERS_SEED`, comando `uv run seed` y migración idempotente de registros antiguos. Directorio integrado en Next.js con `AuthGuard`, `fetchWithAuth` para GET/POST/PATCH/DELETE y enlace en el sidebar. Añadidas siete pruebas de regresión con base de datos en memoria.
- **2026-10-17:** implementados los flujos de autenticación del backoffice en Next.js (login, registro, perfil, `AuthGuard` en el dashboard). El website público sigue sin protección.
- **2026-10-15:** implementada la autenticación JWT de la API (usuarios, perfiles, roles), protegidas las rutas de proveedores y corregida la escalada de privilegios en el registro.
- **2026-09-17:** corregida la navegación por anchors del website y el backoffice, incluido el estado activo del sidebar y el desplazamiento suave.
- **2026-09-17:** renovada por completo la estética del website y el backoffice con utilidades Tailwind, diseño responsive e identidad emerald/slate; corregida la resolución de componentes en Turbopack.
- **2026-09-17:** completado el hito Ingeniería Impulsada por IA; creados el banco de memoria, las reglas, el skill de revisión y las primeras versiones del website y el backoffice.
