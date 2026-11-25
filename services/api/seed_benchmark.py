r"""Seeder de volumen realista y benchmark de latencia con `TimingMiddleware` para TrackFlow API.

Genera datos coherentes de dominio logístico en bases temporales aisladas (sin ensuciar archivos
versionados) para evaluar el impacto real del caching bajo carga realista:
- 300 SKUs distribuidos entre Los Ángeles (`LA`) y Zaragoza (`ZGZ`) para 12 marcas cliente reales.
- 8,000 recepciones (`StockEntry`) y 12,000 salidas (`StockExit`) = 20,000 movimientos con FKs reales.
- 5,000 incidencias operativas (`incidents` SQLite) con sedes, categorías, orígenes y descripciones variadas.
- 250 proveedores logísticos (`suppliers` TinyDB) en EE. UU. y España.

Ejecución:
    .\.venv\Scripts\python.exe -m services.api.seed_benchmark
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import random
import sqlite3
import sys
import tempfile
import time
from typing import Any
from urllib.parse import urlsplit

import anyio.to_thread
from sqlmodel import Session, create_engine
import starlette.concurrency
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import services.api.database as db_module  # noqa: E402
from services.api.cache import app_cache  # noqa: E402
from services.api.main import app  # noqa: E402
from services.api.models import SKU, StockEntry, StockExit  # noqa: E402
from services.api.routes import suppliers as suppliers_routes  # noqa: E402

CLIENT_BRANDS = [
    ("PureStep Footwear", "fashion", "CLT"),
    ("UrbanThread Studio", "fashion", "URB"),
    ("Boreal Athletics", "fashion", "BOR"),
    ("SoundWave Electronics", "electronics", "TEC"),
    ("Kova Smart Devices", "electronics", "KOV"),
    ("VoltEdge Mobility", "electronics", "VLT"),
    ("GlowLab Cosmetics", "cosmetics", "CSM"),
    ("Lumière Dermocare", "cosmetics", "LUM"),
    ("Botanica Iberia", "cosmetics", "BOT"),
    ("Pacific Apparel Co.", "fashion", "PAC"),
    ("Aether Audio Labs", "electronics", "AET"),
    ("Solstice Skincare", "cosmetics", "SOL"),
]

PRODUCT_TEMPLATES: dict[str, list[str]] = {
    "fashion": [
        "Zapatilla técnica running",
        "Chaqueta impermeable cortavientos",
        "Pantalón chino elástico",
        "Sudadera algodón orgánico",
        "Mochila urbana antirrobo",
    ],
    "electronics": [
        "Auriculares inalámbricos ANC",
        "Cargador GaN USB-C 65W",
        "Batería externa 20000mAh",
        "Hub multipuerto Thunderbolt",
        "Localizador Bluetooth logístico",
    ],
    "cosmetics": [
        "Sérum facial ácido hialurónico 30ml",
        "Crema hidratante barrera cerámica",
        "Protector solar fluido SPF50",
        "Limpiador enzimático suave 150ml",
        "Contorno de ojos cafeína 15ml",
    ],
}

INCIDENT_TITLES: dict[str, list[str]] = {
    "lost_parcel": [
        "Bulto sin lectura de escáner en cinta de clasificación nocturna",
        "Expedición extraviada en enlace troncal interestatal",
        "Paquete no localizado tras consolidación de palé europeo",
    ],
    "carrier_issue": [
        "Incumplimiento de ventana horaria por avería en ruta de reparto",
        "Embalaje secundario humedecido durante tránsito regional",
        "Retraso en recogida de muelle por saturación del transportista",
    ],
    "delivery_failure": [
        "Dirección incompleta sin número de portal ni teléfono operativo",
        " Segundo intento de entrega fallido por local comercial cerrado",
        "Código postal discordante con provincia de destino declarada",
    ],
    "returns_issue": [
        "Devolución recibida en muelle inverso sin etiqueta RMA legible",
        "Discrepancia de estado de calidad en prenda devuelta por cliente",
        "Paquete de logística inversa enrutado al almacén equivocado",
    ],
    "inventory_discrepancy": [
        "Diferencia de conteo cíclico en estantería de picking rápido",
        "Merma detectada en lote recepcionado frente a albarán proveedor",
        "Ajuste pendiente por unidades bloqueadas en control de calidad",
    ],
}


def populate_realistic_dataset(
    *,
    sqlite_incidents_path: Path,
    inventory_sqlite_path: Path,
    tinydb_instance: TinyDB,
    num_skus: int = 300,
    num_entries: int = 8000,
    num_exits: int = 12000,
    num_incidents: int = 5000,
    num_suppliers: int = 250,
    seed: int = 42,
) -> dict[str, int]:
    """Inserta datos logísticos realistas y coherentes en las tres capas de almacenamiento."""
    rng = random.Random(seed)
    base_dt = datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc)

    # 1. Inicializar y poblar SQLite de incidencias (5,000 filas variadas)
    db_module.init_db(sqlite_incidents_path)
    statuses = ["open", "in_progress", "resolved", "discarded"]
    status_weights = [0.22, 0.28, 0.42, 0.08]
    origins = ["customer", "branch", "internal"]
    branches = [
        "la_warehouse",
        "zaragoza_warehouse",
        "central",
        "la_office",
        "zaragoza_office",
    ]
    categories = list(INCIDENT_TITLES.keys())

    incident_rows: list[tuple[Any, ...]] = []
    for idx in range(1, num_incidents + 1):
        cat = rng.choice(categories)
        st = rng.choices(statuses, weights=status_weights, k=1)[0]
        orig = rng.choice(origins)
        br = rng.choice(branches)
        title_base = rng.choice(INCIDENT_TITLES[cat]).strip()
        title = f"{title_base} · Ref #{idx:05d}"
        desc = (
            f"Reporte operativo registrado en sede {br} (origen: {orig}). "
            f"Seguimiento de lote logístico #{rng.randint(10000, 99999)} con prioridad estándar."
        )
        created = base_dt + timedelta(minutes=idx * 12)
        updated = created + timedelta(hours=rng.randint(1, 72))
        incident_rows.append(
            (
                title,
                desc,
                cat,
                st,
                orig,
                br,
                created.strftime("%Y-%m-%dT%H:%M:%SZ"),
                updated.strftime("%Y-%m-%dT%H:%M:%SZ"),
                f"BENCH-INC-{idx:06d}",
            )
        )

    with sqlite3.connect(str(sqlite_incidents_path)) as conn:
        conn.executemany(
            """
            INSERT INTO incidents (
                title, description, category, status, origin, branch, created_at, updated_at, source_ref
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            incident_rows,
        )
        conn.commit()

    # 2. Inicializar y poblar inventario ORM SQLModel (300 SKUs + 20,000 movimientos)
    inv_engine = create_engine(f"sqlite:///{inventory_sqlite_path}")
    db_module.create_inventory_tables(inv_engine)

    operator_uuids = [f"op-{zone}-{n:02d}" for zone in ("la", "zgz") for n in range(1, 16)]
    carriers_by_wh = {
        "LA": ["1Z999AA1", "FDX7782", "DHLUS90"],
        "ZGZ": ["ESSEUR88", "MRW2026X", "DHLES44"],
    }

    with Session(inv_engine) as session:
        sku_objects: list[SKU] = []
        for idx in range(1, num_skus + 1):
            brand_name, category, prefix = CLIENT_BRANDS[idx % len(CLIENT_BRANDS)]
            warehouse = "LA" if idx % 2 == 0 else "ZGZ"
            template = PRODUCT_TEMPLATES[category][idx % len(PRODUCT_TEMPLATES[category])]
            sku_objects.append(
                SKU(
                    name=f"{template} Ed.{idx:03d}",
                    sku=f"{prefix}-{warehouse}-{idx:04d}",
                    client_name=brand_name,
                    category=category,
                    warehouse=warehouse,
                )
            )
        session.add_all(sku_objects)
        session.commit()
        for obj in sku_objects:
            session.refresh(obj)

        sku_ids_by_wh: dict[str, list[int]] = {"LA": [], "ZGZ": []}
        for obj in sku_objects:
            if obj.id is not None:
                sku_ids_by_wh[obj.warehouse].append(obj.id)

        entries_batch: list[StockEntry] = []
        for idx in range(1, num_entries + 1):
            wh = "LA" if idx % 2 == 0 else "ZGZ"
            chosen_sku_id = rng.choice(sku_ids_by_wh[wh])
            entries_batch.append(
                StockEntry(
                    sku_id=chosen_sku_id,
                    quantity=rng.randint(40, 180),
                    reference=f"PO-2026-{wh}-{idx:05d}",
                    warehouse=wh,
                    created_at=base_dt + timedelta(minutes=idx * 5),
                    user_uuid=rng.choice(operator_uuids),
                )
            )
        session.add_all(entries_batch)
        session.commit()

        exits_batch: list[StockExit] = []
        for idx in range(1, num_exits + 1):
            wh = "LA" if idx % 2 == 0 else "ZGZ"
            chosen_sku_id = rng.choice(sku_ids_by_wh[wh])
            is_loss = idx % 15 == 0
            exit_type = "loss" if is_loss else "dispatch"
            carrier_prefix = rng.choice(carriers_by_wh[wh])
            tracking = None if is_loss else f"{carrier_prefix}{idx:07d}"
            exits_batch.append(
                StockExit(
                    sku_id=chosen_sku_id,
                    quantity=rng.randint(1, 15),
                    exit_type=exit_type,
                    tracking_number=tracking,
                    warehouse=wh,
                    created_at=base_dt + timedelta(days=10, minutes=idx * 4),
                    user_uuid=rng.choice(operator_uuids),
                )
            )
        session.add_all(exits_batch)
        session.commit()

    # 3. Poblar proveedores en TinyDB (250 proveedores)
    suppliers_table = tinydb_instance.table("suppliers")
    cat_pool = [
        ["last mile delivery"],
        ["cold chain", "last mile delivery"],
        ["packaging", "warehouse supplies"],
        ["linehaul", "customs"],
        ["reverse logistics"],
    ]
    supplier_docs = []
    for idx in range(1, num_suppliers + 1):
        is_es = idx % 2 == 0
        country = "ES" if is_es else "US"
        currency = "EUR" if is_es else "USD"
        zone = rng.choice(["Península", "Aragón", "Levante"] if is_es else ["West Coast", "Southwest", "California"])
        supplier_docs.append(
            {
                "name": f"Operador Logístico {'Ibérico' if is_es else 'Pacific'} #{idx:03d}",
                "country": country,
                "categories": rng.choice(cat_pool),
                "rate_per_shipment": round(rng.uniform(3.2, 24.5), 2),
                "currency": currency,
                "service_zone": zone,
                "contact_email": f"trafico{idx:03d}@carrier-network.example",
                "notes": "Contrato anual auditado SLA 24/48h",
                "status": "suspended" if idx % 9 == 0 else "active",
                "updated_at": base_dt.isoformat(),
            }
        )
    suppliers_table.insert_multiple(supplier_docs)

    return {
        "skus": num_skus,
        "stock_entries": num_entries,
        "stock_exits": num_exits,
        "total_movements": num_entries + num_exits,
        "incidents": num_incidents,
        "suppliers": num_suppliers,
    }


def _run_coro_sync(coro: Any) -> Any:
    try:
        while True:
            coro.send(None)
    except StopIteration as exc:
        return exc.value
    finally:
        coro.close()


def _probe_endpoint(method: str, url: str) -> tuple[int, float, int]:
    """Invoca la app ASGI pasando por `timing_middleware` y devuelve `(status, ms, bytes)`."""
    parsed = urlsplit(url)
    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": parsed.path,
        "raw_path": parsed.path.encode("ascii"),
        "query_string": parsed.query.encode("ascii"),
        "headers": [(b"host", b"benchmark.local")],
        "client": ("127.0.0.1", 51000),
        "server": ("benchmark.local", 80),
    }
    sent = False
    status_code = 500
    res_headers: dict[str, str] = {}
    chunks: list[bytes] = []

    async def receive() -> dict[str, Any]:
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.disconnect"}

    async def send(msg: dict[str, Any]) -> None:
        nonlocal status_code
        if msg["type"] == "http.response.start":
            status_code = int(msg["status"])
            for k, v in msg.get("headers", []):
                res_headers[k.decode("latin-1").lower()] = v.decode("latin-1")
        elif msg["type"] == "http.response.body":
            chunks.append(msg.get("body", b""))

    start = time.perf_counter()
    _run_coro_sync(app(scope, receive, send))
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    header_ms = float(res_headers.get("x-response-time-ms", f"{elapsed_ms:.2f}"))
    return status_code, header_ms, sum(len(c) for c in chunks)


def run_benchmark() -> dict[str, Any]:
    """Ejecuta el benchmark completo (volumen pequeño vs carga realista en frío vs caché caliente)."""
    logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")

    orig_run_sync = anyio.to_thread.run_sync
    orig_starlette_sync = starlette.concurrency.run_in_threadpool

    async def _inline_anyio(func: Any, *args: Any, **_kwargs: Any) -> Any:
        return func(*args)

    async def _inline_starlette(func: Any, *args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

    anyio.to_thread.run_sync = _inline_anyio  # type: ignore[assignment]
    starlette.concurrency.run_in_threadpool = _inline_starlette  # type: ignore[assignment]

    endpoints = [
        "/api/incidents/summary",
        "/inventory/products",
        "/inventory/products?warehouse=LA",
        "/inventory/orders",
        "/inventory/orders?warehouse=ZGZ",
    ]

    try:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            tmp_dir = Path(tmp)

            # Fase A: Dataset mínimo (6 SKUs, 12 movimientos, 10 incidencias)
            small_inc = tmp_dir / "small_incidents.db"
            small_inv = tmp_dir / "small_inventory.db"
            small_tiny = TinyDB(storage=MemoryStorage)
            populate_realistic_dataset(
                sqlite_incidents_path=small_inc,
                inventory_sqlite_path=small_inv,
                tinydb_instance=small_tiny,
                num_skus=6,
                num_entries=6,
                num_exits=6,
                num_incidents=10,
                num_suppliers=8,
            )
            import os

            os.environ["INCIDENTS_DB_PATH"] = str(small_inc)
            db_module.engine = create_engine(f"sqlite:///{small_inv}")
            suppliers_routes.suppliers = small_tiny.table("suppliers")

            small_timings: dict[str, float] = {}
            for ep in endpoints:
                app_cache.clear_all()
                _, ms, _ = _probe_endpoint("GET", ep)
                small_timings[ep] = round(ms, 2)

            # Fase B: Dataset realista (300 SKUs, 20,000 movimientos, 5,000 incidencias, 250 proveedores)
            heavy_inc = tmp_dir / "heavy_incidents.db"
            heavy_inv = tmp_dir / "heavy_inventory.db"
            heavy_tiny = TinyDB(storage=MemoryStorage)
            counts = populate_realistic_dataset(
                sqlite_incidents_path=heavy_inc,
                inventory_sqlite_path=heavy_inv,
                tinydb_instance=heavy_tiny,
            )

            os.environ["INCIDENTS_DB_PATH"] = str(heavy_inc)
            db_module.engine = create_engine(f"sqlite:///{heavy_inv}")
            suppliers_routes.suppliers = heavy_tiny.table("suppliers")

            cold_timings: dict[str, float] = {}
            warm_timings: dict[str, float] = {}
            payload_bytes: dict[str, int] = {}

            app_cache.clear_all()
            for ep in endpoints:
                # 1ª llamada: Cache MISS (frío sobre volumen realista)
                _, cold_ms, size_b = _probe_endpoint("GET", ep)
                cold_timings[ep] = round(cold_ms, 2)
                payload_bytes[ep] = size_b

                # Promedio de 5 llamadas consecutivas: Cache HIT (caliente)
                hit_samples = [_probe_endpoint("GET", ep)[1] for _ in range(5)]
                warm_timings[ep] = round(sum(hit_samples) / len(hit_samples), 2)

            report = {
                "dataset_counts": counts,
                "small_db_cold_ms": small_timings,
                "realistic_db_cold_miss_ms": cold_timings,
                "realistic_db_warm_hit_ms": warm_timings,
                "payload_bytes": payload_bytes,
                "cache_stats": app_cache.stats(),
            }
            print(json.dumps(report, indent=2))
            return report
    finally:
        anyio.to_thread.run_sync = orig_run_sync  # type: ignore[assignment]
        starlette.concurrency.run_in_threadpool = orig_starlette_sync  # type: ignore[assignment]


if __name__ == "__main__":
    run_benchmark()
