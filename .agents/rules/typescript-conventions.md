# Convenciones de TypeScript

## Alcance de aplicación

Esta regla se aplica a todos los archivos `.ts` y `.tsx` del repositorio.

## Reglas

- Usar siempre TypeScript strict mode.
- No usar nunca `any`; definir tipos explícitos o genéricos.
- Escribir funciones puras: no modificar estado global y trabajar únicamente con parámetros y valores locales.
- Usar nombres descriptivos: `camelCase` para variables y funciones, y `PascalCase` para interfaces y tipos.
- Preferir `const` sobre `let` y no usar nunca `var`.
- Usar la palabra clave `type` en imports que solo importen tipos: `import type { X } from '...'`.
- Manejar siempre casos vacíos, incluidos arrays vacíos, `null` y `undefined`.
- Mantener una única responsabilidad por función.
- Documentar con comentarios JSDoc en español todas las funciones públicas.
