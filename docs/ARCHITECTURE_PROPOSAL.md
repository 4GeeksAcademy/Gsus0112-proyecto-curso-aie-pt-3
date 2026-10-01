# Propuesta de Arquitectura Backend para TrackFlow

## 1. Patrón Arquitectónico y Justificación

Para el backend de TrackFlow propongo una **Arquitectura Monolítica Modular (Modular Monolith) basada en capas con FastAPI**. La aplicación se despliega inicialmente como una unidad operativa, pero sus módulos internos tienen límites de dominio explícitos, contratos claros y responsabilidades separadas.

Esta decisión encaja con la operación de TrackFlow:

- **Alta transaccionalidad en almacenes:** los movimientos de recepción, reserva, picking, ajuste y expedición deben mantener la consistencia del inventario por SKU, almacén y ubicación.
- **Control de existencias:** Los Ángeles y Zaragoza necesitan una visión unificada del stock disponible, comprometido, dañado y en tránsito, aunque hoy utilicen SGA diferentes.
- **Tracking de despachos en tiempo real:** cada envío cambia de estado durante la preparación, recogida, tránsito, intento de entrega y entrega final; esos eventos deben estar disponibles para operaciones, clientes y atención al cliente.
- **Integración con carriers:** UPS, FedEx, MRW, SEUR y otros transportistas exponen APIs, estados, credenciales y formatos distintos que TrackFlow debe normalizar.
- **Logística inversa:** las devoluciones conectan la autorización, la etiqueta de retorno, la recogida, la inspección y la reincorporación o baja del inventario.

Las capas separan el transporte HTTP de la lógica de negocio y de la persistencia:

```text
Routers FastAPI (HTTP) -> Services (casos de uso) -> Repositories/Models (datos)
                                      |
                         Integraciones y eventos de dominio
```

El monolito modular es superior a un monolito tradicional desestructurado porque concentra el despliegue sin concentrar las responsabilidades: cada dominio tiene sus propios routers, esquemas, servicios y modelos, y las dependencias entre módulos se revisan de forma explícita. También es más adecuado que adoptar microservicios prematuros: evita la complejidad inicial de múltiples despliegues, redes, colas, observabilidad, consistencia distribuida y contratos versionados mientras el equipo todavía está unificando dos almacenes, un ERP legacy y ocho integraciones de transportistas.

La modularidad deja abierta una evolución posterior. Si el volumen, la autonomía de un equipo o los requisitos de disponibilidad lo justifican, `shipments` o `carriers` podrán extraerse como servicios independientes porque ya tendrán límites y contratos definidos. Hasta entonces, una transacción de negocio puede mantener consistencia sin coordinar varios servicios remotos.

## 2. Estructura de Carpetas y Módulos

El backend vive dentro del monorepo en `services/api/app/`. La organización es **feature-based**: los archivos relacionados con un contexto logístico permanecen juntos, en lugar de distribuirse en carpetas globales de routers, modelos y esquemas.

```text
Gsus0112-proyecto-curso-aie-pt-3/
├── services/
│   └── api/
│       ├── app/
│       │   ├── main.py                 # Creación y registro de FastAPI
│       │   ├── core/                   # Configuración, seguridad y observabilidad
│       │   ├── api/
│       │   │   └── v1/
│       │   │       └── router.py       # Agregador de routers versionados
│       │   └── domains/
│       │       ├── inventory/
│       │       │   ├── router.py
│       │       │   ├── schemas.py
│       │       │   ├── service.py
│       │       │   └── models.py
│       │       ├── shipments/
│       │       │   ├── router.py
│       │       │   ├── schemas.py
│       │       │   ├── service.py
│       │       │   └── models.py
│       │       ├── carriers/
│       │       │   ├── router.py
│       │       │   ├── schemas.py
│       │       │   ├── service.py
│       │       │   └── integrations/   # Adaptadores UPS, FedEx, MRW, SEUR...
│       │       ├── returns/
│       │       │   ├── router.py
│       │       │   ├── schemas.py
│       │       │   ├── service.py
│       │       │   └── models.py
│       │       └── webhooks/
│       │           ├── router.py       # Entrada de eventos externos
│       │           ├── schemas.py
│       │           └── service.py
│       ├── requirements.txt
│       └── .env                        # Solo entorno local; no se versiona
├── uis/                                # Frontends desacoplados
├── agents/                             # Agentes de IA
├── skills/                             # Capacidades reutilizables
└── docs/
```

Los cuatro dominios logísticos representan etapas distintas del ciclo operativo:

- **`inventory/`:** stock por almacén, SKU y ubicación; recepciones, reservas, movimientos, ajustes y disponibilidad. Es la fuente de verdad para saber qué puede prepararse y qué debe bloquearse.
- **`shipments/`:** creación y ciclo de vida de los despachos; paquetes, pedidos, etiquetas, estados de tracking y pruebas de entrega. Orquesta el movimiento desde la preparación del almacén hasta la entrega final.
- **`carriers/`:** catálogo, capacidades y rendimiento de transportistas, además de la normalización de sus APIs. Encapsula la selección de carrier, tarifas, etiquetas y consultas de tracking sin contaminar los demás dominios con formatos externos.
- **`returns/`:** autorización y recepción de devoluciones, etiquetas de retorno, inspección, resolución y destino del artículo. Coordina con `shipments` para la recogida y con `inventory` para reacondicionar, devolver a stock o dar de baja.

El módulo **`webhooks/`** recibe notificaciones firmadas de carriers y otros sistemas externos, valida su autenticidad y transforma los eventos a comandos o eventos internos. No sustituye a los cuatro dominios de negocio; sirve como frontera de entrada para que un callback externo no acople su formato directamente a la lógica interna.

## 3. Organización de Endpoints y Routers (FastAPI)

Cada dominio expone un `APIRouter` propio. El router define el contrato HTTP, pero no decide reglas de inventario, transiciones de envío ni políticas de devolución.

Ejemplos de endpoints:

```text
GET    /api/v1/inventory/{warehouse_id}/stock/{sku}
POST   /api/v1/inventory/{warehouse_id}/reservations
POST   /api/v1/shipments
GET    /api/v1/shipments/{shipment_id}
GET    /api/v1/shipments/{shipment_id}/tracking
GET    /api/v1/carriers
POST   /api/v1/carriers/quote
POST   /api/v1/returns
POST   /api/v1/returns/{return_id}/inspection
```

En cada `router.py`, FastAPI valida parámetros y cuerpos con esquemas Pydantic definidos en `schemas.py`. Después delega el caso de uso a `service.py`, traduce el resultado a un esquema de respuesta y comunica errores HTTP previsibles. La lógica de negocio y las transacciones no deben vivir en la función del endpoint.

Un ejemplo conceptual del límite del router es:

```python
@router.post("/{warehouse_id}/reservations", response_model=ReservationResponse)
def reserve_stock(
    warehouse_id: str,
    request: ReservationRequest,
    service: InventoryService = Depends(get_inventory_service),
) -> ReservationResponse:
    return service.reserve_stock(warehouse_id, request)
```

El agregador `app/api/v1/router.py` reúne los módulos sin duplicar prefijos ni lógica:

```python
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["Shipments"])
api_router.include_router(carriers.router, prefix="/carriers", tags=["Carriers"])
api_router.include_router(returns.router, prefix="/returns", tags=["Returns"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
```

Finalmente, `app/main.py` crea la aplicación, configura middleware transversal como CORS, logging y manejo de errores, e incluye una sola vez el router maestro:

```python
app = FastAPI(title="TrackFlow API")
app.add_middleware(CORSMiddleware, ...)
app.include_router(api_router)
```

Así se conserva una API versionada y un punto de entrada limpio, mientras cada equipo puede evolucionar su dominio sin convertir `main.py` en un registro de detalles operativos.

## 4. Investigación e Influencia de Estructuras Estándar en FastAPI

FastAPI no impone una estructura de proyecto única. Las plantillas habituales suelen agrupar por tipo técnico: todos los routers, todos los modelos y todos los esquemas en carpetas separadas. Ese enfoque puede ser sencillo al inicio, pero obliga a recorrer varias ubicaciones para entender una operación completa, por ejemplo reservar stock y generar un despacho.

La propuesta adopta una estructura **feature-based** inspirada en límites de contexto de DDD. Cada dominio contiene su router, esquemas, servicios y modelos, reduciendo el coste cognitivo y el riesgo de cambios accidentales en otros flujos. La separación por capas sigue existiendo dentro de cada feature: agrupar por dominio no significa mezclar HTTP, negocio y persistencia.

La alternativa **layer-based** sigue siendo útil para piezas verdaderamente transversales, como `core/`, autenticación, configuración, telemetría y utilidades compartidas. No se usará como criterio para repartir los dominios logísticos, porque diluiría los límites entre inventario, despachos, carriers y devoluciones.

## 5. Coexistencia Frontend y Backend como Sistemas Separados

Las interfaces de `uis/` y la API de FastAPI se despliegan y versionan como sistemas desacoplados. El frontend consume contratos HTTP versionados y no importa modelos ni lógica Python del backend.

- **Variables de entorno:** cada frontend usa, por ejemplo, `NEXT_PUBLIC_API_URL` para resolver la URL de la API. Desarrollo, staging y producción pueden apuntar a hosts distintos sin hardcodear direcciones en el código.
- **CORS explícito:** `CORSMiddleware` en `main.py` permite únicamente los orígenes configurados para las interfaces de TrackFlow. No se debe usar `allow_origins=["*"]` en producción, especialmente si existen credenciales o cookies.
- **Contratos estables:** los esquemas Pydantic definen respuestas consistentes para stock, tracking y devoluciones. Los cambios incompatibles se publican bajo una nueva versión de API.
- **Configuración segura:** credenciales de base de datos, carriers y webhooks llegan mediante variables de entorno o un gestor de secretos; nunca se incluyen en el repositorio.

## 6. Riesgos y Puntos de Atención

- **Lógica de negocio en routers:** insertar cálculos de disponibilidad, transiciones de tracking o consultas directas a la base de datos en `router.py` produce endpoints difíciles de probar y reutilizar. Los routers deben delegar en `service.py`.
- **Dependencias circulares entre dominios:** `shipments` puede necesitar una operación explícita de reserva de `inventory`, pero los módulos no deben importarse mutuamente de forma arbitraria. Deben usarse servicios bien definidos, contratos compartidos mínimos o eventos de dominio.
- **Acoplamiento con APIs de carriers:** UPS, FedEx, MRW y SEUR tienen estados, errores, autenticación y formatos diferentes. Los adaptadores deben vivir en `carriers/integrations/`, y el resto de TrackFlow debe trabajar con un modelo normalizado. También deben existir timeouts, reintentos controlados, circuit breakers, idempotencia y trazabilidad.
- **Consistencia del inventario:** las reservas y movimientos deben ser transaccionales e idempotentes para evitar sobreventa, especialmente cuando llegan reintentos de webhooks o procesos concurrentes de almacén.
- **Eventos duplicados o fuera de orden:** los cambios de tracking y las notificaciones de retorno deben validar firma, conservar un identificador idempotente y gestionar estados que lleguen tarde sin corromper el ciclo operativo.
- **CORS y secretos mal configurados:** permitir cualquier origen o almacenar credenciales en `.env` versionado puede exponer operaciones y datos de clientes. La configuración debe variar por entorno y auditarse.
- **Monolito sin límites:** un monolito modular solo aporta valor si se respetan los límites de `inventory`, `shipments`, `carriers` y `returns`. Las dependencias globales y los accesos directos a tablas ajenas recrearían un monolito desestructurado.
