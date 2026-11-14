# Contenedorización de TrackFlow (Ticket #infra-40)

## Arquitectura

| Servicio | Build | Puertos | Qué ejecuta |
|----------|-------|---------|-------------|
| `uis` | `./uis` (`node:22-alpine`) | 3000 (website), 3001 (backoffice) | `start.sh` → `next dev` en ambas apps |
| `api` | `./services` (`python:3.12-slim` + `uv`) | 8000 | `uvicorn services.api.main:app --reload` |

- Red Docker con nombre explícito: `trackflow-net`.
- El navegador llama al backoffice en `/backend/*` y Next.js reenvía la petición a `http://api:8000` (**nombre de servicio**, nunca `localhost`).
- Toda la configuración sale de `.env` en la raíz (ignorado por Git). Plantilla: `.env.example`.

## Desarrollo local

```bash
cp .env.example .env   # rellena DATABASE_URL y SECRET_KEY
docker compose up --build
```

- Website: http://localhost:3000
- Backoffice: http://localhost:3001
- API (Swagger): http://localhost:8000/docs

Los cambios en `uis/website`, `uis/backoffice`, `services/` y `packages/` se reflejan sin reconstruir la imagen (bind mounts + polling).

## Producción en el VPS

```bash
ssh usuario@IP_DEL_VPS
git clone https://github.com/4GeeksAcademy/Gsus0112-proyecto-curso-aie-pt-3.git trackflow
cd trackflow
git switch feature/docker-containerization   # o main tras el merge
nano .env                                     # variables de PRODUCCIÓN (no se suben a Git)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

`docker-compose.prod.yml` elimina los bind mounts, compila Next.js (`next build` + `next start`), arranca Uvicorn sin `--reload`, añade `restart: unless-stopped` y persiste TinyDB/SQLite en el volumen `api_data`.

En el `.env` del VPS ajusta `FRONTEND_URL` y `RESET_PASSWORD_URL` a `http://IP_DEL_VPS:3001`, y abre los puertos si usas firewall: `sudo ufw allow 3000,3001,8000/tcp`.
