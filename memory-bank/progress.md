# Progreso del proyecto

## Estado actual

- **Modelos de dominio:** completado. Incluye interfaces TypeScript y funciones de filtrado, ordenamiento, búsqueda, validación y agregación en `src/`.
- **Infraestructura de agentes:** completada. Incluye banco de memoria, instrucciones globales, reglas y un skill de revisión de código.
- **Website público:** primera versión completada con soluciones, cifras de negocio y red de almacenes.
- **Backoffice interno:** primera versión completada con KPIs, estado de almacenes y frentes operativos.
- **Autenticación de la API:** completada. JWT con `python-jose`, hash bcrypt con `passlib`, tablas TinyDB `users` y `profiles`, endpoints `/auth`, `/users` y `/profiles`, y rutas de `/api/suppliers` protegidas.

## Tareas de autenticación y restricción de rutas

- [x] Tablas `users` y `profiles` en TinyDB y modelos Pydantic (`RoleEnum`, `User*`, `Profile*`).
- [x] `security.py`: hash/verificación de contraseñas, `create_access_token` con `exp` y dependencia `get_current_user`.
- [x] `POST /auth/login` y `GET /auth/me`.
- [x] CRUD de `/users` con control owner/admin (403) y emails únicos (409).
- [x] `GET` y `PUT /profiles/me`.
- [x] Registro público forzado a rol `user`; solo un `admin` puede cambiar roles.
- [x] Contraseña limitada a 72 caracteres por la restricción de bcrypt.
- [x] Las 6 rutas de `/api/suppliers` exigen token válido (401 sin él).

## Tareas de autenticación en el frontend (backoffice)

- [x] `src/utils/api.ts`: `fetchWithAuth` con cabecera Bearer y redirección a `/login` ante un 401.
- [x] `src/contexts/AuthContext.tsx`: `AuthProvider` y `useAuth` con `token`, `user`, `isAuthenticated`, `isLoading`, `login`, `logout` y `refreshUser`.
- [x] `AuthProvider` integrado en `app/layout.tsx`.
- [x] Vistas `/login` y `/register` (registro con errores 409/422 por campo y auto-login).
- [x] `src/components/AuthGuard.tsx` protegiendo `/` y `/account/profile`.
- [x] Vista `/account/profile` para editar nombre, teléfono y dirección vía `PUT /profiles/me`.

## Próximos pasos

1. Conectar el website público con contenido administrable.
2. Conectar el backoffice con datos operativos en tiempo real.
3. Implementar servicios backend e integraciones con almacenes y transportistas.
4. Enviar el token JWT desde `uis/backoffice/suppliers/index.html` (actualmente recibe 401).
5. Crear un seeder para el primer usuario `admin`.

## Decisiones pendientes

- Confirmar el framework definitivo para la evolución del backoffice.
- Definir la estrategia de deployment para interfaces, servicios y agentes.

## Historial de cambios

- **2026-10-17:** implementados los flujos de autenticación del backoffice en Next.js (login, registro, perfil, `AuthGuard` en el dashboard). El website público sigue sin protección.
- **2026-10-15:** implementada la autenticación JWT de la API (usuarios, perfiles, roles), protegidas las rutas de proveedores y corregida la escalada de privilegios en el registro.
- **2026-09-17:** corregida la navegación por anchors del website y el backoffice, incluido el estado activo del sidebar y el desplazamiento suave.
- **2026-09-17:** renovada por completo la estética del website y el backoffice con utilidades Tailwind, diseño responsive e identidad emerald/slate; corregida la resolución de componentes en Turbopack.
- **2026-09-17:** completado el hito Ingeniería Impulsada por IA; creados el banco de memoria, las reglas, el skill de revisión y las primeras versiones del website y el backoffice.
