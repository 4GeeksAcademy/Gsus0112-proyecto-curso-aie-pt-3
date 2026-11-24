# Auditoría de Rendimiento Frontend — TrackFlow Monorepo

**Fecha de auditoría:** Noviembre 2026  
**Entorno de ejecución:** Compilación de producción (`next build` + `next start`), Node.js v22  
**Herramienta de diagnóstico:** Google Lighthouse (Chrome DevTools)  
**Alcance:** Sitio corporativo público (`uis/website`) y panel operativo interno (`uis/backoffice`)

---

## 1. Resumen Ejecutivo

Esta auditoría técnica evalúa el rendimiento, la accesibilidad, las buenas prácticas y la optimización para motores de búsqueda (SEO) de las dos interfaces web del monorepo TrackFlow:
1. **Sitio Corporativo (`uis/website`):** Página de inicio pública orientada a captación, conversión y posicionamiento de marca.
2. **Backoffice Operativo (`uis/backoffice`):** Dashboard autenticado para operadores logísticos con métricas en tiempo real, gestión de incidencias y control de inventario.

Las mediciones se realizaron **estrictamente en modo producción**, simulando condiciones tanto de escritorio como de dispositivos móviles bajo perfiles de red y CPU estándar de Lighthouse.

---

## 2. Puntuaciones Iniciales (Lighthouse Baseline)

Las capturas de pantalla de cada auditoría se encuentran versionadas en el directorio [`/audit/before/`](./audit/before/).

| Aplicación | Vista / Ruta | Dispositivo | Performance | Accessibility | Best Practices | SEO | Captura de Evidencia |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Sitio Corporativo** (`website`) | Home (`/`) | Desktop | **89** | **95** | **77** | **63** | [`audit/before/website-desktop.png`](./audit/before/website-desktop.png) |
| **Sitio Corporativo** (`website`) | Home (`/`) | Mobile | **98** | **95** | **77** | **63** | [`audit/before/website-mobile.png`](./audit/before/website-mobile.png) |
| **Backoffice** (`backoffice`) | Dashboard (`/`) | Desktop | **98** | **92** | **100** | **60** | [`audit/before/backoffice-desktop.png`](./audit/before/backoffice-desktop.png) |
| **Backoffice** (`backoffice`) | Dashboard (`/`) | Mobile | **91** | **92** | **100** | **60** | [`audit/before/backoffice-mobile.png`](./audit/before/backoffice-mobile.png) |

---

## 3. Diagnóstico y Análisis de Causa Raíz

A continuación se detalla el análisis de causa raíz para cada área de oportunidad identificada por Lighthouse:

### 3.1. Rendimiento (Performance) & Core Web Vitals
* **Métrica afectada:** Largest Contentful Paint (LCP) en Desktop (89 en Website).
* **Causa raíz:** En `uis/website/app/page.tsx`, la imagen principal de cabecera (Hero) se carga mediante una etiqueta estándar `<img>` apuntando a una URL externa no optimizada de Unsplash (`photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=2000&q=90`). Al usar `<img>` en lugar de `next/image`:
  - No se generan formatos modernos (WebP/AVIF).
  - No se aplica compresión automática responsiva según la resolución del cliente.
  - La imagen carece del atributo de precarga `priority`, lo que retrasa la renderización del elemento LCP principal de la pantalla.
  - No se especifican dimensiones intrínsecas (`width` / `height` o `fill`), lo que introduce riesgo de Cumulative Layout Shift (CLS).

### 3.2. Buenas Prácticas (Best Practices — 77 en Website)
* **Causa raíz 1 (Resolución excesiva de imágenes):** Tanto la imagen del Hero como las imágenes de los almacenes en `WarehouseSection.tsx` solicitan anchos de 1200px a 2000px incluso en viewports reducidos, descargando hasta 4x más bytes de los necesarios.
* **Causa raíz 2 (Seguridad en enlaces externos):** Enlaces con `target="_blank"` sin `rel="noopener noreferrer"`, lo que expone a vulnerabilidades de tipo tab-nabbing y consumo de hilo en navegadores antiguos.
* **Causa raíz 3 (Aspect Ratio no explícito):** Las etiquetas `<img>` sin atributos de relación de aspecto provocan advertencias de layout y recalculado de estilo durante la carga.

### 3.3. Optimización para Motores de Búsqueda (SEO — 60 a 63 en ambos frontends)
* **Causa raíz 1 (Meta description ausente o genérica):** En `uis/backoffice`, el archivo `layout.tsx` carece de una meta description personalizada adecuada para indexación interna y snippets.
* **Causa raíz 2 (Texto de anclaje no descriptivo):** Varios enlaces utilizan textos genéricos ("Explorar", "Ver", iconos de flecha) sin atributos `aria-label` descriptivos que indiquen claramente el destino al rastreador de motores de búsqueda.
* **Causa raíz 3 (Robots y Crawlability):** En el backoffice no está configurada la directiva `robots: { index: false, follow: false }` para evitar la indexación indebida de paneles internos protegidos.

### 3.4. Accesibilidad (Accessibility — 92 en Backoffice, 95 en Website)
* **Causa raíz 1 (Contraste de color insuficiente):** En `KpiGrid.tsx` y badges secundarios, los textos en gris claro (`text-slate-400` y `text-slate-500` sobre fondos tenues) no alcanzan el ratio de contraste mínimo WCAG AA (4.5:1).
* **Causa raíz 2 (Nombres accesibles ausentes):** Determinados botones de icono o indicadores de estado carecen de `aria-label` o texto alternativo audible para lectores de pantalla.

---

## 4. Análisis de Refactorización y Componentes Duplicados

Siguiendo las directrices del brief, se identificaron bloques de lógica y componentes duplicados entre ambos frontends aptos para extracción y consolidación:

### Caso 1: Tarjeta de Métricas e Indicadores de Negocio (`MetricCard` / `KpiCard`)
* **Dónde aparece actualmente:**
  - `uis/website/app/page.tsx` (líneas 33–42): sección de cifras clave (130 personas, 2 países, 8 transportistas, €9M).
  - `uis/backoffice/src/components/KpiGrid.tsx` (líneas 11–22): tarjetas de KPIs operativos (Red activa, Huella operativa, Tasa de devoluciones, Potencial CX).
* **Por qué es candidato a refactorización:**
  Ambos componentes comparten la misma estructura semántica y de presentación: un contenedor estilizado, una etiqueta descriptiva, un valor numérico destacado con tipografía pesada (`font-extrabold` / `font-bold`), y una unidad o indicador visual de estado. Mantenerlos duplicados duplica el markup, las clases CSS y dificulta la coherencia visual de la marca TrackFlow.
* **Abstracción propuesta:**
  Crear un componente unificado `MetricCard` (que pueda compartirse o reutilizarse en los frontends):
  ```tsx
  interface MetricCardProps {
    value: string;
    label: string;
    unit?: string;
    indicatorColor?: string;
    variant?: 'minimal' | 'bordered';
  }
  ```

### Caso 2: Carga y Optimización de Imágenes con `next/image`
* **Dónde aparece actualmente:**
  - `uis/website/app/page.tsx`: Hero background image (`<img>` de Unsplash 2000px).
  - `uis/website/src/components/WarehouseSection.tsx`: Tarjetas de almacenes Los Ángeles y Zaragoza (`<img>` de Unsplash 1200px).
* **Por qué es candidato a refactorización:**
  Ambas implementaciones recurren a `<img>` directos, omitiendo la infraestructura nativa de Next.js para optimización bajo demanda, lazy-loading nativo, generación de `srcset` automático y control estricto de LCP y CLS.
* **Abstracción propuesta:**
  Reemplazar las etiquetas crudas `<img>` por el componente `<Image />` de `next/image` con:
  - `priority` exclusivo para la imagen Hero (LCP crítico).
  - `sizes` adaptativo para las tarjetas de almacén.
  - Dimensiones `fill` con contenedor relativo y `sizes="(max-width: 768px) 100vw, 50vw"`.

### Caso 3: Custom Hook de Ejecución Asíncrona con Estados Resilientes (`useAsyncAction`)
* **Dónde aparece actualmente:**
  - `uis/backoffice/src/components/IncidentRegistrationForm.tsx`
  - `uis/backoffice/src/components/IncidentListPanel.tsx`
  - `uis/backoffice/app/inventory/orders/inbound/page.tsx`
  - `uis/backoffice/app/inventory/orders/outbound/page.tsx`
* **Por qué es candidato a refactorización:**
  En cada formulario o panel con peticiones a la API se repite la gestión manual de tres estados (`isLoading`, `error`, `success`), la captura en bloques `try/catch`, y la limpieza de mensajes.
* **Abstracción propuesta:**
  Extraer un Custom Hook `useAsyncAction` que encapsule la invocación de promesas, el manejo de estados de carga, la propagación de errores legibles y la limpieza reactiva.

---

## 5. Plan de Correcciones Incremental (Commit por Commit)

Para asegurar la trazabilidad y la reproducibilidad requerida en el ticket del CTO, las mejoras se aplicarán en pasos aislados y comprobables:

1. **Commit 1 — `docs(audit)`:** Registro de puntuaciones iniciales y capturas en `/audit/before/` *(Completado)*.
2. **Commit 2 — `docs(audit)`:** Adición del documento formal de auditoría `AUDIT.md`.
3. **Commit 3 — `refactor(ui)`:** Extracción del componente compartido `MetricCard` y refactorización en `website` y `backoffice`.
4. **Commit 4 — `perf(website)`:** Optimización de imágenes Hero y Warehouse con `next/image` (`priority`, `sizes`, WebP/AVIF).
5. **Commit 5 — `feat(seo)`:** Enriquecimiento de metadatos SEO (`description`, OpenGraph, directivas robots) y accesibilidad (contraste y `aria-label`).
6. **Commit 6 — `refactor(hooks)`:** Implementación del Custom Hook `useAsyncAction` en operaciones del backoffice.
7. **Commit 7 — `test(audit)`:** Re-ejecución de Lighthouse en modo producción, captura de métricas finales en `/audit/after/` y redacción de `REPORT.md`.
