# Propuesta de Arquitectura Backend para TrackFlow

## 1. Patrón Arquitectónico y Justificación

Para el backend de TrackFlow propongo una **arquitectura en capas dentro de un monolito modular por dominio, implementada con FastAPI**. La aplicación se despliega como una unidad, mientras cada dominio conserva routers, esquemas, servicios y modelos con responsabilidades y contratos explícitos. Las capas separan la entrada HTTP, los casos de uso, el acceso a datos y las integraciones externas.

La elección responde a restricciones operativas concretas:

- **Equipo técnico de siete personas y despliegues de una a dos semanas:** mantener una unidad desplegable evita repartir a un equipo pequeño entre varios servicios y procesos operativos. Los límites por dominio permiten localizar cambios sin convertir la aplicación en un bloque indistinto.
- **Dos almacenes con sistemas diferentes:** Los Ángeles usa software comercial y Zaragoza una hoja de cálculo avanzada. El dominio de inventario necesita adaptar ambas fuentes y ofrecer una vista común sin que sus formatos contaminen los casos de uso.
- **Ocho carriers en dos países:** sus APIs, estados y condiciones distintas requieren adaptadores aislados y una representación común para selección y seguimiento de envíos.
- **Devoluciones del 18 % al 25 % del volumen:** la autorización, la recogida, la inspección y la decisión sobre el producto forman un flujo suficientemente relevante para tener un dominio propio y contratos claros con envíos e inventario.
- **Operación 24/7:** el tracking y la disponibilidad operativa no pueden depender de coordinar múltiples despliegues y comunicaciones entre servicios para cada operación. La unidad inicial reduce esos puntos de fallo y mantiene las transacciones de negocio dentro del mismo sistema.

Un monolito modular evita tanto la dispersión de responsabilidades de un monolito desestructurado como el coste operativo de microservicios prematuros. La modularidad establece límites que permiten reevaluar una extracción futura de dominios si cambian el volumen, la autonomía de los equipos o los requisitos de disponibilidad.

## 2. Estructura de Carpetas y Módulos

El backend se ubica en `services/api/app/` y se organiza por **dominio**, no por tipo técnico. Cada dominio agrupa su router, esquemas, servicios y modelos; dentro de sus servicios, las responsabilidades de HTTP, negocio y persistencia siguen separadas. `core/` contiene las capacidades transversales, y `api/v1/` reúne los routers versionados.

La estructura propuesta mantiene juntos los componentes de cada dominio y sus integraciones específicas:

```text
services/api/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── v1.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── logging.py
│   │   └── security.py
│   └── domains/
│       ├── inventory/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   ├── repository.py
│       │   └── adapters/
│       ├── shipments/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   └── repository.py
│       ├── carriers/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   ├── repository.py
│       │   └── adapters/
│       ├── returns/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   └── repository.py
│       ├── clients/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   └── repository.py
│       ├── tracking/
│       │   ├── router.py
│       │   ├── schemas.py
│       │   ├── models.py
│       │   ├── service.py
│       │   └── repository.py
│       └── analytics/
│           ├── router.py
│           ├── schemas.py
│           ├── models.py
│           ├── service.py
│           └── repository.py
└── tests/
```

| Dominio | Responsabilidad | Integraciones y límites |
|---|---|---|
| `inventory/` | Stock por SKU, almacén y ubicación; recepciones, reservas, movimientos, ajustes y disponibilidad. | Sus adaptadores de WMS permanecen dentro del dominio y convierten las dos fuentes de almacén a un modelo de inventario común. |
| `shipments/` | Creación y ciclo de vida del envío, paquetes, preparación, expedición y prueba de entrega. | Coordina con inventario para reservar unidades y con carriers para despachar, sin asumir sus formatos externos. |
| `carriers/` | Catálogo, recomendación, tarifas y rendimiento de transportistas; integración y normalización de sus APIs. | Sus adaptadores de UPS, FedEx, DHL, MRW, SEUR y los demás carriers permanecen dentro de `carriers/`. La entrada de notificaciones externas se gestiona en el límite de este dominio. |
| `returns/` | Autorización, recogida, recepción, inspección y decisión sobre el destino del producto. | Expone operaciones de devolución y coordina con shipments para la recogida y con inventory para el resultado de la inspección. |
| `clients/` | Perfiles de las marcas, configuración logística y datos necesarios para aplicar sus condiciones de servicio. | Evita duplicar la información de cliente en envíos, inventario o devoluciones. |
| `tracking/` | Estado normalizado de seguimiento, historial de eventos y consulta de envíos. | Consume eventos normalizados desde carriers y shipments; publica la consulta pública por código de seguimiento. |
| `analytics/` | Indicadores agregados de almacenes, envíos, carriers, devoluciones y clientes. | Lee información operativa mediante contratos definidos; no sustituye las fuentes transaccionales de los dominios. |

Esta separación mantiene juntos los cambios que responden a una misma capacidad logística y reduce el acoplamiento entre equipos y formatos externos. Los dominios principales representan el ciclo físico de stock, expedición, transporte y devolución; `clients`, `tracking` y `analytics` apoyan la configuración comercial, la visibilidad del envío y la lectura transversal de resultados.

## 3. Organización de Endpoints y Routers (FastAPI)

Cada dominio expone un router bajo el prefijo común `/api/v1`. El agregador versionado incluye un router por cada dominio de la sección anterior: `inventory`, `shipments`, `carriers`, `returns`, `clients`, `tracking` y `analytics`. El router valida la petición y delega las reglas de negocio y transacciones en el servicio correspondiente; no contiene lógica operativa.

| Dominio / router | Método | Ruta | Propósito |
|---|---|---|---|
| Inventory | GET | `/api/v1/inventory/skus/{sku}/stock` | Consultar el stock consolidado del SKU, con desglose por almacén y estado. |
| Inventory | POST | `/api/v1/inventory/reservations` | Reservar unidades para preparar pedidos. |
| Shipments | POST | `/api/v1/shipments` | Crear un envío asociado a un pedido preparado. |
| Shipments | GET | `/api/v1/shipments/{id}` | Consultar el detalle operativo de un envío. |
| Carriers | GET | `/api/v1/carriers` | Consultar los transportistas disponibles. |
| Carriers | POST | `/api/v1/carriers/recommendation` | Recomendar un transportista según destino, peso y urgencia. |
| Carriers | POST | `/api/v1/carriers/webhooks/{carrier}` | Recibir y validar notificaciones del transportista correspondiente. |
| Returns | POST | `/api/v1/returns` | Registrar una solicitud de devolución. |
| Returns | GET | `/api/v1/returns/{id}/decision` | Consultar la decisión y el estado de la devolución. |
| Clients | GET | `/api/v1/clients/{id}` | Consultar la configuración logística de una marca cliente. |
| Tracking | GET | `/api/v1/tracking/shipments/{id}` | Consultar el historial normalizado de un envío para usuarios autorizados. |
| Tracking | GET | `/api/v1/public/tracking/{code}` | Consultar públicamente el estado de un paquete mediante su código de seguimiento. |
| Analytics | GET | `/api/v1/analytics/carriers/performance` | Consultar indicadores agregados de rendimiento de transportistas. |
| Analytics | GET | `/api/v1/analytics/returns` | Consultar volumen y patrones de devolución. |

Las rutas de carriers mantienen las notificaciones externas dentro del dominio que conoce sus contratos, mientras tracking presenta un estado común a consumidores y operaciones. El router de cada dominio conserva su contrato HTTP; la creación de la aplicación y la configuración transversal, como CORS, logging y manejo de errores, permanecen en el punto de entrada de FastAPI.

## 4. Investigación e Influencia de Estructuras Estándar en FastAPI

FastAPI no prescribe una única estructura de proyecto. La propuesta toma como referencia tres fuentes con alcances complementarios: la documentación oficial de FastAPI, en su sección **Bigger Applications**; el repositorio **full-stack-fastapi-template**; y la guía **fastapi-best-practices**.

| Convención | Origen | Cómo se aplica en TrackFlow |
|---|---|---|
| Separar la aplicación en módulos y reunir routers mediante un punto de entrada común. | [Documentación oficial de FastAPI: Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) | Cada dominio expone su router y la API versionada los reúne bajo `/api/v1`. |
| Mantener una estructura explícita para la aplicación, su configuración y sus componentes transversales. | [Repositorio full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | `core/` concentra configuración, acceso a base de datos y seguridad; las pruebas se agrupan en `tests/`. |
| Organizar los módulos por dominio y mantener las rutas enfocadas en HTTP, separadas de la lógica de aplicación y el acceso a datos. | [Guía fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) | La organización por dominio de TrackFlow se basa en esta guía; cada dominio mantiene `router.py`, `schemas.py`, `service.py`, `repository.py` y `models.py`. |
| Separar los esquemas Pydantic de entrada y salida de los modelos de persistencia. | [Documentación oficial de FastAPI: Extra Models](https://fastapi.tiangolo.com/tutorial/extra-models/) y [repositorio full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | `schemas.py` define los contratos HTTP y `models.py` representa los datos persistidos. |
| Cargar los settings desde variables de entorno y concentrarlos en `core/config.py`. | [Repositorio full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | `core/config.py` centraliza la configuración de cada entorno para el backend. |
| Aplicar el prefijo `/api/v1` y usar `Depends` para inyectar la sesión de base de datos y la autenticación. | [Documentación oficial de FastAPI: Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) y [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) | Los routers se publican bajo `/api/v1`; las dependencias entregan a cada endpoint la sesión y el usuario autenticado que necesita. |

TrackFlow elige organizarse **por dominio** en lugar de reunir todos los routers, modelos o repositorios en carpetas globales. Una operación logística suele cambiar dentro de un mismo contexto —por ejemplo, una devolución y sus reglas—, y repartirla por tipo de archivo obligaría a recorrer y coordinar varias áreas técnicas. Mantener juntos los componentes de inventario, envíos, transportistas, devoluciones y los dominios de apoyo hace más claro el alcance de cada cambio para un equipo técnico de siete personas. La separación por responsabilidad se conserva dentro de cada dominio y `core/` sigue siendo el lugar para capacidades realmente compartidas.

## 5. Coexistencia Frontend y Backend como Sistemas Separados

El monorepo mantiene las interfaces de `uis/` y los servicios de `services/` como partes separadas, desplegadas de forma independiente. El frontend consume contratos HTTP versionados y no importa modelos ni lógica Python del backend.

- **Comunicación:** las interfaces se comunican con la API mediante REST y JSON.
- **URL de la API:** cada frontend usa `API_BASE_URL` como nombre genérico para resolver la dirección de la API según el entorno. Las variables incorporadas al frontend son públicas y nunca contienen secretos; solo incluyen configuración que puede exponerse al navegador, como la URL base.
- **Configuración del backend:** el backend obtiene valores como `DATABASE_URL` y `CORS_ORIGINS` del entorno. `CORS_ORIGINS` se lee desde las variables de entorno para definir qué orígenes pueden acceder a la API.
- **CORS explícito:** `CORSMiddleware` en `main.py` permite únicamente los orígenes configurados para las interfaces de TrackFlow. No se debe usar `allow_origins=["*"]` en producción, especialmente si existen credenciales o cookies.
- **Contratos estables:** los esquemas Pydantic definen respuestas consistentes para stock, tracking y devoluciones. Los cambios incompatibles se publican bajo una nueva versión de API.
- **Credenciales:** las credenciales de base de datos, carriers y webhooks pertenecen a la configuración del backend y nunca se incluyen en el repositorio ni en el frontend.

## 6. Riesgos y Puntos de Atención

- **Lógica de negocio en routers:** insertar cálculos de disponibilidad, transiciones de tracking o consultas directas a la base de datos en `router.py` produce endpoints difíciles de probar y reutilizar. Los routers deben delegar en `service.py`.
- **Dependencias circulares entre dominios:** `shipments` puede necesitar una operación explícita de reserva de `inventory`, pero los módulos no deben importarse mutuamente de forma arbitraria. Deben comunicarse mediante servicios bien definidos y contratos compartidos mínimos.
- **Acoplamiento con APIs de carriers:** UPS, FedEx, MRW y SEUR tienen estados, errores, autenticación y formatos diferentes. Los adaptadores deben vivir en `carriers/adapters/`, y el resto de TrackFlow debe trabajar con un modelo normalizado. También deben existir límites de tiempo, reintentos controlados, idempotencia y trazabilidad.
- **Consistencia del inventario:** las reservas y movimientos deben ser transaccionales e idempotentes (repetir la misma operación no duplica su efecto) para evitar sobreventa, especialmente cuando llegan reintentos de webhooks o procesos concurrentes de almacén.
- **Eventos duplicados o fuera de orden:** los cambios de tracking y las notificaciones de retorno deben validar firma, conservar un identificador idempotente y gestionar estados que lleguen tarde sin corromper el ciclo operativo.
- **CORS y credenciales mal configurados:** permitir cualquier origen o incluir credenciales en archivos versionados puede exponer operaciones y datos de clientes. La configuración debe variar por entorno y revisarse.
- **Monolito sin límites:** un monolito modular solo aporta valor si se respetan los límites de `inventory`, `shipments`, `carriers` y `returns`. Las dependencias globales y los accesos directos a tablas ajenas recrearían un monolito desestructurado.
