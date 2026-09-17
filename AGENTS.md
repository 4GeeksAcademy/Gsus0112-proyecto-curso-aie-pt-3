# Instrucciones para agentes

## Inicio de cada sesión

Antes de analizar, proponer o modificar código, leer en este orden:

1. `CONTEXT.md` o, si se trabaja en español, `CONTEXT.es.md`.
2. `memory-bank/projectbrief.md`.
3. `memory-bank/techContext.md`.
4. `memory-bank/progress.md`.

## Flujo obligatorio antes de cada commit

1. Leer el banco de memoria completo y `CONTEXT.md`.
2. Verificar que los cambios sean coherentes con la arquitectura documentada en `memory-bank/techContext.md`.
3. Ejecutar `npx tsc --noEmit` y verificar que no existan errores de TypeScript.
4. Actualizar `memory-bank/progress.md` con los cambios realizados y la fecha correspondiente.
5. Crear un commit descriptivo con la convención `feat:`, `fix:`, `docs:` o `chore:`.

## Archivos protegidos

No modificar los siguientes archivos o rutas sin confirmación explícita del desarrollador:

- `CONTEXT.md` y `CONTEXT.es.md`.
- `package.json` cuando el cambio afecte dependencias.
- `tsconfig.json`.
- Las reglas existentes en `.agents/rules/`.
- Cualquier archivo de `memory-bank/` excepto `memory-bank/progress.md`.
