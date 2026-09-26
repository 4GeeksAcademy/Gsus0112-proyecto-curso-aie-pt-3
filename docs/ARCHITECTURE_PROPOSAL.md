Propuesta de Arquitectura Backend
1. Patrón Arquitectónico y Justificación
Para el backend de nuestro sitio corporativo, propongo adoptar una Arquitectura Monolítica Modular (Modular Monolith) basada en Capas.

¿Por qué este patrón? Dado el contexto de nuestra empresa y el estado actual del proyecto (donde el frontend ya está desplegado y operando), necesitamos una solución backend que nos permita iterar rápido, mantener un gobierno claro del código y escalar de forma predecible sin la complejidad inicial de operaciones y despliegue de los microservicios.

La naturaleza de nuestro negocio implica manejar distintos flujos de información (por ejemplo, perfiles de candidatos, flujos de talento, contenido corporativo). Un monolito modular nos permite mantener todo el código en un solo lugar de despliegue, pero lógicamente separado por dominios de negocio. La separación interna en capas (Controladores/Rutas -> Servicios -> Acceso a Datos) garantiza que la lógica de negocio no se mezcle con el código HTTP, facilitando la mantenibilidad, lectura y futuras pruebas.

2. Estructura de Carpetas y Módulos
El backend se alojará dentro del monorepo (por ejemplo, en la carpeta /services/api o un nuevo directorio backend). La estructura interna seguirá un criterio de agrupación por dominio o característica (Feature-based structure), en lugar de agrupar por tipo de archivo técnico.

text

Gsus0112-proyecto-curso-aie-pt-3/
├── uis/
│   └── talent-pipeline-tracker/ # Nuestro frontend actual (React/Next.js)
├── services/
│   └── api/                    # NUESTRO NUEVO BACKEND (FastAPI)
│       ├── app/
│       │   ├── main.py         # Punto de entrada de la aplicación FastAPI
│       │   ├── core/           # Configuraciones y utilidades globales
│       │   ├── api/            # Enrutador maestro (api/v1/router.py)
│       │   └── domains/        # Módulos de negocio (Feature-based)
│       │       ├── auth/       # Autenticación y control de acceso
│       │       ├── candidates/ # Dominio específico para el pipeline de talento
│       │       │   ├── router.py 
│       │       │   ├── schemas.py
│       │       │   ├── service.py
│       │       │   └── models.py
│       │       ├── pipeline/   # Gestión de estados del tracker
│       │       └── webhooks/   # Endpoints para comunicación con nuestros agentes de IA (skills/workflows)
│       ├── requirements.txt    # Dependencias de Python
│       └── .env                # Variables de entorno locales
├── skills/                     # Nuestros agentes de IA existentes
├── workflows/                  # Flujos de trabajo de los agentes
└── mcps/                       # Servidores de contexto
Criterio de separación: Cada subcarpeta dentro de domains/ representa un contexto delimitado del negocio real. Viendo que ya tenemos uis/talent-pipeline-tracker, nuestros primeros dominios lógicos deben ser candidates y pipeline. Además, como operamos con agentes de IA (ubicados en skills/ y workflows/), he propuesto un dominio de webhooks para que el backend pueda recibir señales y datos procesados de nuestros propios agentes de forma segura.

3. Organización de Endpoints y Routers (FastAPI)
En FastAPI, evitaremos registrar todos los endpoints en el archivo raíz main.py. Utilizaremos la clase APIRouter para modularizar las rutas según los dominios identificados.

Routers por Dominio: En cada carpeta de dominio (ej. domains/candidates/router.py), crearemos una instancia de APIRouter(prefix="/candidates", tags=["Candidates"]). Aquí se definirán los endpoints individuales.
Delegación a Servicios: Los endpoints en el router.py no contendrán lógica de negocio. Su única responsabilidad será: recibir la petición HTTP, validar los datos (vía esquemas de Pydantic), llamar a la función correspondiente en service.py y retornar la respuesta HTTP (o lanzar excepciones de HTTP).
Enrutador Principal: En api/v1/router.py, importaremos todos los routers individuales de los dominios y los conectaremos a un router principal (api_router.include_router(candidates.router)).
Registro en Main: Finalmente, en app/main.py, solo se incluirá el api_router maestro.
Esto garantiza un archivo principal sumamente limpio, una API versionada (ej. /api/v1/candidates/) y rutas fácilmente escalables a medida que el negocio crece.

4. Investigación e Influencia de Estructuras Estándar en FastAPI
Al investigar cómo se estructuran convencionalmente los proyectos en FastAPI, observamos que, a diferencia de frameworks como Django, FastAPI es "micro" y no impone una estructura estricta.

Sin embargo, la comunidad ha establecido convenciones sólidas: el uso extensivo de Pydantic para los "Schemas" y SQLAlchemy (u otros ORMs) para los "Models". Muchas plantillas estándar iniciales (como las de Tiangolo) organizan los archivos por "tipo" (una carpeta para todos los models, otra para routers, otra para schemas).

Influencia en esta decisión: Aunque la estructura por tipo es común, he decidido adoptar una estructura Feature-based (por dominios). Las arquitecturas por tipo tienden a fracturarse cuando el proyecto crece sustancialmente, obligando al desarrollador a saltar entre 4 o 5 carpetas distintas para entender una sola funcionalidad. Adoptar un enfoque orientado a dominio desde el inicio (como se refleja en /app/domains/) toma inspiración de los principios de Domain-Driven Design (DDD) y proporciona un límite claro para el desarrollo concurrente del equipo.

5. Coexistencia Frontend y Backend como Sistemas Separados
Dado que nuestro frontend corporativo y este nuevo backend operarán como sistemas separados (arquitectura decoupled), la estructura y configuración debe contemplar:

Comunicación vía API y Variables de Entorno: El frontend interactuará con el backend puramente a través de llamadas HTTP (REST). Es mandatorio que el frontend utilice variables de entorno (por ejemplo, VITE_API_URL si se usa Vite o NEXT_PUBLIC_API_URL) para no tener las URLs de la API quemadas en el código (hardcoded), permitiendo apuntar a localhost en desarrollo y al dominio real en producción.
Gestión de CORS (Cross-Origin Resource Sharing): Al estar separados, el navegador de los usuarios detectará que el frontend (ej. https://www.miempresa.com) está haciendo peticiones a otro dominio (ej. https://api.miempresa.com). Por razones de seguridad, esto se bloqueará si no lo permitimos explícitamente. En el backend, configuraremos el CORSMiddleware en main.py para incluir el dominio exacto del frontend en los orígenes permitidos.
6. Riesgos y Puntos de Atención
Si el equipo no respeta estos lineamientos arquitectónicos, enfrentaremos riesgos importantes:

Fuga de Lógica de Negocio a los Routers (Spaghetti Code): Si por prisa el equipo empieza a escribir cálculos, lógica de negocio o consultas a la base de datos directamente en las funciones de los endpoints (router.py) en lugar de en los services.py, perderemos la capacidad de hacer pruebas unitarias fácilmente y será casi imposible reutilizar esa lógica en otros endpoints sin duplicar código.
Mala Configuración de CORS en Producción: Es una práctica común y peligrosa configurar allow_origins=["*"] en CORS para salir del paso ante bloqueos en desarrollo local. Si esta configuración llega a producción, abriremos un riesgo de seguridad crítico, permitiendo que cualquier sitio web malicioso realice peticiones a nuestra API y aproveche las credenciales o sesiones de nuestros usuarios.
Dependencias Circulares entre Dominios: Al separar por módulos, existe el riesgo de que el dominio de "candidatos" importe cosas de "pipeline" y viceversa. En Python, esto causa errores ImportError o dependencias circulares que impiden arrancar el servidor. El equipo debe asegurar que los dominios sean independientes o se comuniquen a través de capas inferiores o utilidades compartidas.