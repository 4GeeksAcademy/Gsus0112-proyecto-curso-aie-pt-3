"""Motor de caché en memoria con expiración estricta por TTL e invalidación por prefijo.

Diseñado para endpoints de lectura de alto coste y alta frecuencia en TrackFlow API.
Reglas de seguridad y consistencia:
1. Toda entrada exige `ttl_seconds > 0` (ningún dato vive indefinidamente).
2. Nunca almacena respuestas privadas o dependientes de sesión bajo claves compartidas.
3. Devuelve copias profundas (`deepcopy`) para impedir mutaciones accidentales del estado cacheado.
4. Soporta invalidación selectiva por prefijo tras operaciones de escritura (`POST`, `PUT`, `PATCH`, `DELETE`).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
import threading
import time
from typing import Any, Callable


from pydantic import BaseModel


def _safe_clone(value: Any) -> Any:
    """Clona valores mutables; evita `deepcopy` O(N) en listas de modelos Pydantic congelados (`frozen=True`)."""
    if isinstance(value, list) and (
        len(value) == 0
        or (
            isinstance(value[0], BaseModel)
            and bool(value[0].model_config.get("frozen"))
        )
    ):
        return list(value)
    return copy.deepcopy(value)


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    """Caché en proceso thread-safe con reloj monótono inyectable y métricas de observabilidad."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._store: dict[str, _CacheEntry] = {}
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
        self._invalidations = 0

    def get(self, key: str) -> tuple[bool, Any]:
        """Devuelve `(True, valor)` si la clave existe y no ha expirado; `(False, None)` en caso contrario."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return False, None

            if self._clock() >= entry.expires_at:
                del self._store[key]
                self._misses += 1
                return False, None

            self._hits += 1
            return True, _safe_clone(entry.value)

    def set(self, key: str, value: Any, *, ttl_seconds: float) -> None:
        """Almacena una copia segura del valor con expiración obligatoria `ttl_seconds > 0`."""
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds debe ser estrictamente mayor que 0.")
        with self._lock:
            self._store[key] = _CacheEntry(
                value=_safe_clone(value),
                expires_at=self._clock() + ttl_seconds,
            )

    def invalidate(self, key: str) -> bool:
        """Elimina una clave exacta de la caché."""
        with self._lock:
            removed = self._store.pop(key, None) is not None
            if removed:
                self._invalidations += 1
            return removed

    def invalidate_prefix(self, prefix: str) -> int:
        """Elimina todas las entradas cuya clave comience con `prefix` (p. ej. `'inventory:'`)."""
        with self._lock:
            matching_keys = [k for k in self._store if k.startswith(prefix)]
            for key in matching_keys:
                del self._store[key]
            self._invalidations += len(matching_keys)
            return len(matching_keys)

    def clear_all(self) -> None:
        """Vacía completamente el almacén y reinicia contadores (útil en aislamiento de tests)."""
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0
            self._invalidations = 0

    def stats(self) -> dict[str, int]:
        """Expone contadores actuales de uso de caché."""
        with self._lock:
            now = self._clock()
            active_keys = sum(1 for entry in self._store.values() if now < entry.expires_at)
            return {
                "active_entries": active_keys,
                "hits": self._hits,
                "misses": self._misses,
                "invalidations": self._invalidations,
            }


# Instancia global compartida en el proceso FastAPI
app_cache = TTLCache()

# Constantes documentadas de TTL (segundos) según frecuencia de mutación vs. frescura aceptable
INCIDENTS_SUMMARY_TTL_SECONDS = 30.0
INVENTORY_PRODUCTS_TTL_SECONDS = 45.0
INVENTORY_ORDERS_TTL_SECONDS = 30.0
