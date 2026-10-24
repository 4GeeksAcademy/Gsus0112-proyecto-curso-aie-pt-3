# Progreso del proyecto

## Estado actual

- **Gestor de Incidencias Centralizado:** completado. Incluye modelo `Incident` con restricciones de integridad en `services/api/database.py`, lógica de validación y transformación compartida en `packages/shared/`, script idempotente `scripts/seed_incidents.py`, endpoints REST (`POST /api/incidents`, `GET /api/incidents`, `GET /api/incidents/{id}`, `PATCH /api/incidents/{id}/status`, `GET /api/incidents/summary`) y vistas de registro, listado y resumen en `uis/backoffice/`.
- **Modelos de dominio:** completado. Incluye interfaces TypeScript y funciones de filtrado, ordenamiento, búsqueda, validación y agregación en `src/`.
- **Infraestructura de agentes:** completada. Incluye banco de memoria, instrucciones globales, reglas y un skill de revisión de código.
- **Website público:** primera versión completada con soluciones, cifras de negocio y red de almacenes.
- **Backoffice interno:** primera versión completada con KPIs, estado de almacenes y frentes operativos.

## Próximos pasos

1. Conectar el website público con contenido administrable.
2. Evolucionar el gestor de incidencias con búsqueda semántica mediante embeddings.
3. Implementar servicios backend e integraciones con almacenes y transportistas.

## Decisiones pendientes

- Confirmar el framework definitivo para la evolución del backoffice.
- Definir la estrategia de deployment para interfaces, servicios y agentes.

## Historial de cambios

- **2026-10-23:** integrado el Gestor de Incidencias Centralizado de TrackFlow: lógica compartida en `packages/shared/`, script de seed idempotente `scripts/seed_incidents.py`, endpoints CRUD/ciclo de vida/resumen en `services/api/` y vistas de registro, listado con filtros y panel de resumen en `uis/backoffice/`.
- **2026-09-17:** corregida la navegación por anchors del website y el backoffice, incluido el estado activo del sidebar y el desplazamiento suave.
- **2026-09-17:** renovada por completo la estética del website y el backoffice con utilidades Tailwind, diseño responsive e identidad emerald/slate; corregida la resolución de componentes en Turbopack.
- **2026-09-17:** completado el hito Ingeniería Impulsada por IA; creados el banco de memoria, las reglas, el skill de revisión y las primeras versiones del website y el backoffice.
