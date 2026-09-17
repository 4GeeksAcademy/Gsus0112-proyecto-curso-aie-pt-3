# Skill: Revisión de código TypeScript

## Objetivo único

Revisar código TypeScript antes de hacer merge, verificando que cumple las convenciones del proyecto y las reglas de negocio de TrackFlow.

## Inputs

- **Ruta:** archivo o conjunto de archivos que se revisarán.
- **Tipo de revisión:** `full` para revisar todo el contenido o `diff` para revisar únicamente los cambios.

## Criterios de aceptación

1. ✅ No hay errores de compilación TypeScript, verificable con `npx tsc --noEmit`.
2. ✅ No se usa `any` en ningún lugar del código.
3. ✅ Todas las funciones tienen tipos explícitos en parámetros y retornos.
4. ✅ Los nombres de variables y funciones siguen `camelCase`, y las interfaces y tipos siguen `PascalCase`.
5. ✅ Las funciones son puras y no modifican estado externo.
6. ✅ Los casos vacíos están manejados: los arrays vacíos retornan `[]` y las búsquedas sin resultado retornan `null`.
7. ✅ Los imports usan `import type` cuando corresponde.
8. ✅ El código es coherente con las entidades y reglas de negocio definidas en `CONTEXT.md`.

## Procedimiento

1. Ejecutar `npx tsc --noEmit` y reportar cualquier error.
2. Buscar usos de `any` con `grep` en los archivos incluidos en la revisión.
3. Verificar que todas las funciones exportadas tengan JSDoc en español.
4. Verificar el manejo explícito de arrays vacíos, `null`, `undefined` y búsquedas sin resultados.
5. Generar un reporte con ✅ o ❌ para cada criterio de aceptación e indicar archivo y línea de cada hallazgo.
