# syntax=docker/dockerfile:1
# Contenedor unico de interfaces de TrackFlow:
#   - /uis/website    -> puerto 3000 (sitio publico)
#   - /uis/backoffice -> puerto 3001 (panel interno)
FROM node:22-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias de cada app instaladas por separado (capas cacheables).
COPY website/package.json website/package-lock.json ./website/
RUN cd website && npm ci

COPY backoffice/package.json backoffice/package-lock.json ./backoffice/
RUN cd backoffice && npm ci

# Codigo fuente y script de arranque.
COPY website ./website
COPY backoffice ./backoffice
COPY start.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

EXPOSE 3000 3001

CMD ["sh", "/app/start.sh"]
