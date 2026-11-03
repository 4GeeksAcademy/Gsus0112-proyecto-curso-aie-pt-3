# TrackFlow API (`services/api`)

Servicio FastAPI de TrackFlow con **arquitectura de doble base de datos**:

1. **TinyDB (`services/api/db.json`)**: almacén documental local para autenticación JWT (`/auth`, `/users`, `/profiles`) y directorio de proveedores (`/api/suppliers`).
2. **Supabase PostgreSQL + SQLModel ORM (`DATABASE_URL` en `.env`)**: almacén relacional en la nube para gestión centralizada de inventario (`/inventory`: tablas `sku`, `stockentry` y `stockexit`).

---

## Configuración de Entorno (`.env`)

Crea un archivo `.env` en la raíz del repositorio a partir de `.env.example` (excluido por `.gitignore`). En el panel de Supabase (**Connect → Direct → Transaction pooler → URI**, puerto `6543`), copia la cadena de conexión:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
SECRET_KEY=tu-clave-secreta-local
```

Al iniciar FastAPI (`lifespan`), se ejecuta `SQLModel.metadata.create_all(engine)` para inicializar automáticamente las tablas en Supabase. Cada petición recibe su propia sesión transaccional mediante `Depends(get_db)` (sin sesiones globales).

---

## Estructura de Inventario

- `services/api/database.py`: inicialización de TinyDB + motor SQLModel (`engine`) + dependencia `get_db`.
- `services/api/models.py`: modelos ORM `SKU`, `StockEntry` y `StockExit` (`SQLModel, table=True`, sin importar `sqlalchemy` directamente y sin tabla `User` en Supabase).
- `services/api/schemas.py`: schemas Pydantic independientes (`SKUCreate`, `SKUResponse`, `StockEntryCreate`, `StockEntryResponse`, `StockExitCreate`, `StockExitResponse`, `StockOrderResponse`).
- `services/api/routers/inventory.py`: `APIRouter(prefix="/inventory")`.
- `services/api/seed_inventory.py`: datos semilla idempotentes según `trackflow-BRIEFING.es.md`.

---

## Endpoints de `/inventory`

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| `GET` | `/inventory/products` | Pública (soporta `?warehouse=LA\|ZGZ`) | Lista todos los `SKU` con `current_stock` calculado en consultas agregadas O(1) (sin N+1). |
| `POST` | `/inventory/products` | Bearer JWT (TinyDB) | Registra un nuevo `SKU` (inicia con `current_stock = 0`; rechaza `current_stock` en el payload). |
| `GET` | `/inventory/products/{id}` | Pública | Obtiene el detalle de un `SKU` con su `current_stock` actual. |
| `POST` | `/inventory/orders/inbound` | Bearer JWT (TinyDB) | Registra un `StockEntry` guardando `user_uuid` del usuario autenticado en TinyDB. |
| `POST` | `/inventory/orders/outbound` | Bearer JWT (TinyDB) | Registra un `StockExit` tras validar disponibilidad en ese `warehouse` y reglas de `tracking_number`. |
| `GET` | `/inventory/orders` | Pública (soporta `?warehouse=LA\|ZGZ`) | Lista entradas y salidas precargando datos del `SKU` con `JOIN` en SQL (sin N+1) y `user_uuid`. |

---

## Decisión Documentada — Regla 6 (Stock por SKU y Almacén)

Siguiendo `trackflow-BRIEFING.es.md` (Reglas 5 y 6):

- **Aislamiento por almacén (`LA` vs `ZGZ`)**: el stock **nunca se agrega globalmente** entre Los Ángeles y Zaragoza. Tanto las validaciones de salida (`POST /inventory/orders/outbound`) como el cálculo de stock filtran siempre por `(sku_id, warehouse)`.
- **Representación en `GET /inventory/products` y `GET /inventory/products/{id}`**:
  - `current_stock` devuelve estrictamente `SUMA(StockEntry.quantity) - SUMA(StockExit.quantity)` filtrada por el `warehouse` asignado al `SKU`.
  - Adicionalmente, `SKUResponse` expone `stock_by_warehouse` (`{"LA": <int>, "ZGZ": <int>}`) con el desglose explícito por ubicación para ese `sku_id`.

---

## Ejecución y Semillas

```powershell
# Sembrar los 6 SKUs, entradas y salidas iniciales en Supabase
.\.venv\Scripts\python.exe -m services.api.seed_inventory

# Levantar la API en desarrollo
.\.venv\Scripts\uvicorn.exe services.api.main:app --reload
```
