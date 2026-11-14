#!/bin/sh
# Arranca website (3000) y backoffice (3001) dentro del mismo contenedor.
#   APP_MODE=development (por defecto) -> next dev con recarga en caliente
#   APP_MODE=production                -> next build + next start
set -e

APP_MODE="${APP_MODE:-development}"
DEV_FLAGS="${NEXT_DEV_FLAGS:-}"

start_app() {
  name="$1"
  port="$2"
  cd "/app/$name"
  if [ "$APP_MODE" = "production" ]; then
    echo "[start.sh] Compilando $name..."
    npx next build
    echo "[start.sh] $name en produccion -> puerto $port"
    exec npx next start -H 0.0.0.0 -p "$port"
  else
    echo "[start.sh] $name en desarrollo -> puerto $port"
    # shellcheck disable=SC2086
    exec npx next dev $DEV_FLAGS -H 0.0.0.0 -p "$port"
  fi
}

start_app website 3000 &
WEBSITE_PID=$!

start_app backoffice 3001 &
BACKOFFICE_PID=$!

shutdown() {
  echo "[start.sh] Deteniendo aplicaciones..."
  kill "$WEBSITE_PID" "$BACKOFFICE_PID" 2>/dev/null || true
  wait
  exit 0
}
trap shutdown INT TERM

# Si cualquiera de las dos apps termina, el contenedor se detiene
# (Docker / restart policy se encarga de relanzarlo).
while kill -0 "$WEBSITE_PID" 2>/dev/null && kill -0 "$BACKOFFICE_PID" 2>/dev/null; do
  sleep 2
done

echo "[start.sh] Una de las aplicaciones se detuvo; cerrando contenedor."
kill "$WEBSITE_PID" "$BACKOFFICE_PID" 2>/dev/null || true
exit 1
