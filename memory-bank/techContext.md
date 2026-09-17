# Contexto técnico

## Stack actual

- TypeScript con modo estricto.
- Node.js y módulos ESM.
- Next.js 16 y React 19 para aplicaciones web.
- Tailwind CSS 4 para estilos.

## Estructura del monorepo

- `uis/`: interfaces públicas e internas, incluidas `website` y `backoffice`.
- `services/`: APIs, workers y lógica backend.
- `agents/`: agentes de IA con objetivos y herramientas concretas.
- `skills/`: capacidades reutilizables para agentes.
- `data/`: datos y recursos de procesamiento.
- `docs/`: documentación transversal de arquitectura y operación.

## Decisiones de arquitectura

- Monorepo con separación explícita entre frontend, backend y agentes.
- TypeScript strict mode como base de compilación.
- Cada aplicación o servicio mantiene su configuración, scripts y documentación de ejecución.
- Los contratos de dominio compartidos viven fuera de las interfaces concretas.

## Restricciones técnicas

- Los dos almacenes usan SGA diferentes: Los Ángeles utiliza software comercial y Zaragoza una hoja de cálculo avanzada.
- El ERP legacy procede de principios de la década de 2010.
- Existen 8 APIs de transportistas con contratos y portales diferentes.
- Las bases de datos están repartidas entre dos proveedores cloud.
- No existe telemetría centralizada ni alertas operativas fiables.
- Persisten integraciones punto a punto en Python sin documentación suficiente.

## Convenciones

- Usar módulos ESM.
- Aplicar Tailwind CSS para estilos de interfaz.
- Implementar funciones puras y completamente tipadas.
- Usar imports de tipo explícitos cuando no se importe un valor.
- Manejar de forma explícita valores vacíos, `null` y `undefined`.

## Dependencias clave

- `typescript`
- `next`
- `react` y `react-dom`
- `tailwindcss` y `@tailwindcss/postcss`
