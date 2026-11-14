# syntax=docker/dockerfile:1
# Imagen del servicio FastAPI de TrackFlow (/services).
# Contexto de build: ./services. El paquete compartido ./packages se inyecta
# como contexto adicional "packages" desde docker-compose.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# uv como instalador de dependencias.
RUN pip install --no-cache-dir uv

# Capa de dependencias (se cachea mientras requirements.txt no cambie).
COPY requirements.txt /tmp/requirements.txt
RUN uv pip install --system --no-cache -r /tmp/requirements.txt

# Codigo fuente: /app/services y /app/packages reproducen la estructura del monorepo
# para que funcionen los imports "services.api..." y "packages.shared...".
COPY . /app/services
COPY --from=packages . /app/packages

EXPOSE 8000

# Desarrollo: recarga en caliente sobre el codigo montado por bind mount.
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/services", "--reload-dir", "/app/packages"]
