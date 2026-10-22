# TrackFlow Backoffice

Centro de control interno para consultar la red, los sistemas de almacén y las prioridades operativas de TrackFlow.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`. Usa otro puerto con `npm run dev -- --port 3001` cuando el website ya esté activo.

## Directorio de proveedores

El menú incluye **Directorio de Proveedores** en `/suppliers`. Requiere iniciar sesión
o registrarse en `/register`. Todas las operaciones usan `fetchWithAuth` y el token
de la sesión. La antigua vista `suppliers/index.html` redirige a `/suppliers` en el
servidor Next.js; ya no se ejecuta como aplicación independiente.

Desde la raíz del repositorio, prepara y arranca el backend:

```bash
uv run seed
uv run uvicorn services.api.main:app --reload --port 8000
```

El seeder inserta ocho transportistas si la tabla está vacía. Las tarifas, los
contactos y los transportistas locales son datos de demostración. Si existen
proveedores con `rate`, los migra a `rate_per_shipment` sin eliminar registros;
los contactos y zonas añadidos por defecto deben revisarse antes de producción.
Las siguientes ejecuciones no duplican datos. `TRACKFLOW_DB_PATH` permite usar
una base de datos alternativa. `NEXT_PUBLIC_API_URL` configura el origen de la API
en el frontend (sin el sufijo `/api`).

Pruebas del backend desde la raíz:

```bash
uv run python -m unittest services.api.test_suppliers -v
```

## Validación

```bash
npm run typecheck
npm run build
```
