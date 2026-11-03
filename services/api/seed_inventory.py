"""Seeder idempotente para las tablas ORM de inventario (`SKU`, `StockEntry`, `StockExit`) en Supabase."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from typing import Any

from pydantic import ValidationError
from sqlmodel import Session, select

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from services.api.database import create_inventory_tables, get_engine, users  # noqa: E402
from services.api.models import SKU, StockEntry, StockExit  # noqa: E402
from services.api.schemas import SKUCreate, StockEntryCreate, StockExitCreate  # noqa: E402


SKUS_SEED: list[dict[str, str]] = [
    {
        "name": "Zapatilla blanca clásica - Talla 42",
        "sku": "CLT-SNK-W-42",
        "client_name": "PureStep Footwear",
        "category": "fashion",
        "warehouse": "LA",
    },
    {
        "name": "Zapatilla blanca clásica - Talla 42",
        "sku": "CLT-SNK-W-42-Z",
        "client_name": "PureStep Footwear",
        "category": "fashion",
        "warehouse": "ZGZ",
    },
    {
        "name": "Auriculares inalámbricos Pro",
        "sku": "TEC-EAR-001",
        "client_name": "SoundWave Electronics",
        "category": "electronics",
        "warehouse": "LA",
    },
    {
        "name": "Sérum facial hidratante 30ml",
        "sku": "CSM-SRM-030",
        "client_name": "GlowLab Cosmetics",
        "category": "cosmetics",
        "warehouse": "ZGZ",
    },
    {
        "name": "Chino slim fit - marino 32/32",
        "sku": "CLT-CHN-N-32",
        "client_name": "UrbanThread",
        "category": "fashion",
        "warehouse": "LA",
    },
    {
        "name": "Cargador rápido USB-C 65W",
        "sku": "TEC-CHG-065",
        "client_name": "SoundWave Electronics",
        "category": "electronics",
        "warehouse": "ZGZ",
    },
]

# Al menos 4 entradas, incluyendo 2 recepciones del mismo SKU (CLT-SNK-W-42) con cantidades distintas y ambos almacenes
STOCK_ENTRIES_SEED: list[dict[str, Any]] = [
    {
        "sku_code": "CLT-SNK-W-42",
        "warehouse": "LA",
        "quantity": 80,
        "reference": "PO-2024-0098",
        "minutes_ago": 180,
    },
    {
        "sku_code": "CLT-SNK-W-42",
        "warehouse": "LA",
        "quantity": 45,
        "reference": "GR-LA-0234",
        "minutes_ago": 150,
    },
    {
        "sku_code": "CLT-SNK-W-42-Z",
        "warehouse": "ZGZ",
        "quantity": 60,
        "reference": "PO-2024-0112",
        "minutes_ago": 140,
    },
    {
        "sku_code": "TEC-EAR-001",
        "warehouse": "LA",
        "quantity": 50,
        "reference": "GR-LA-0289",
        "minutes_ago": 120,
    },
    {
        "sku_code": "CSM-SRM-030",
        "warehouse": "ZGZ",
        "quantity": 120,
        "reference": "GR-ZGZ-0415",
        "minutes_ago": 100,
    },
    {
        "sku_code": "CLT-CHN-N-32",
        "warehouse": "LA",
        "quantity": 70,
        "reference": "PO-2024-0145",
        "minutes_ago": 90,
    },
    {
        "sku_code": "TEC-CHG-065",
        "warehouse": "ZGZ",
        "quantity": 90,
        "reference": "GR-ZGZ-0450",
        "minutes_ago": 75,
    },
]

# Al menos 3 salidas, combinando 'dispatch' (con tracking_number) y 'loss' (tracking_number=None), sin exceder stock por almacén
STOCK_EXITS_SEED: list[dict[str, Any]] = [
    {
        "sku_code": "CLT-SNK-W-42",
        "warehouse": "LA",
        "quantity": 25,
        "exit_type": "dispatch",
        "tracking_number": "1Z999AA10123456784",
        "minutes_ago": 60,
    },
    {
        "sku_code": "TEC-EAR-001",
        "warehouse": "LA",
        "quantity": 3,
        "exit_type": "loss",
        "tracking_number": None,
        "minutes_ago": 45,
    },
    {
        "sku_code": "CSM-SRM-030",
        "warehouse": "ZGZ",
        "quantity": 20,
        "exit_type": "dispatch",
        "tracking_number": "ESMRW0098451203",
        "minutes_ago": 30,
    },
    {
        "sku_code": "CLT-SNK-W-42-Z",
        "warehouse": "ZGZ",
        "quantity": 2,
        "exit_type": "loss",
        "tracking_number": None,
        "minutes_ago": 15,
    },
]


def _resolve_seed_user_uuid(explicit_uuid: str | None = None) -> str:
    """Obtiene el UUID/ID en cadena de un usuario existente en TinyDB para trazar las semillas."""
    if explicit_uuid and explicit_uuid.strip():
        return explicit_uuid.strip()
    if users is not None:
        try:
            existing_users = users.all()
            if existing_users:
                first_user = existing_users[0]
                raw_uuid = first_user.get("uuid")
                if isinstance(raw_uuid, str) and raw_uuid.strip():
                    return raw_uuid.strip()
                return str(first_user.doc_id)
        except OSError:
            pass
    return "1"


def seed_inventory(
    target_engine: Any = None,
    *,
    default_user_uuid: str | None = None,
) -> dict[str, int]:
    """Siembra de forma idempotente SKUs, entradas y salidas iniciales en la base SQLModel."""
    active_engine = target_engine if target_engine is not None else get_engine()
    if active_engine is None:
        raise RuntimeError(
            "La variable de entorno DATABASE_URL no está configurada. "
            "Añade la cadena Transaction Pooler de Supabase en .env antes de ejecutar el seeder."
        )

    create_inventory_tables(active_engine)
    seed_user_uuid = _resolve_seed_user_uuid(default_user_uuid)
    base_time = datetime.now(timezone.utc)

    inserted_skus = 0
    inserted_entries = 0
    inserted_exits = 0

    with Session(active_engine) as session:
        existing_skus = session.exec(select(SKU)).all()
        sku_by_key: dict[tuple[str, str], SKU] = {
            (item.sku, item.warehouse): item for item in existing_skus
        }

        for raw_sku in SKUS_SEED:
            validated_sku = SKUCreate(**raw_sku)
            key = (validated_sku.sku, validated_sku.warehouse)
            if key in sku_by_key:
                continue
            sku_record = SKU(
                name=validated_sku.name,
                sku=validated_sku.sku,
                client_name=validated_sku.client_name,
                category=validated_sku.category,
                warehouse=validated_sku.warehouse,
            )
            session.add(sku_record)
            session.flush()
            sku_by_key[key] = sku_record
            inserted_skus += 1

        has_entries = session.exec(select(StockEntry)).first() is not None
        has_exits = session.exec(select(StockExit)).first() is not None

        if not has_entries and not has_exits:
            for raw_entry in STOCK_ENTRIES_SEED:
                target_sku = sku_by_key[(raw_entry["sku_code"], raw_entry["warehouse"])]
                if target_sku.id is None:
                    raise RuntimeError("No se pudo resolver el ID del SKU sembrado.")
                validated_entry = StockEntryCreate(
                    sku_id=target_sku.id,
                    quantity=raw_entry["quantity"],
                    reference=raw_entry["reference"],
                    warehouse=raw_entry["warehouse"],
                )
                entry_record = StockEntry(
                    sku_id=validated_entry.sku_id,
                    quantity=validated_entry.quantity,
                    reference=validated_entry.reference,
                    warehouse=validated_entry.warehouse,
                    created_at=base_time - timedelta(minutes=int(raw_entry["minutes_ago"])),
                    user_uuid=seed_user_uuid,
                )
                session.add(entry_record)
                inserted_entries += 1

            for raw_exit in STOCK_EXITS_SEED:
                target_sku = sku_by_key[(raw_exit["sku_code"], raw_exit["warehouse"])]
                if target_sku.id is None:
                    raise RuntimeError("No se pudo resolver el ID del SKU sembrado.")
                validated_exit = StockExitCreate(
                    sku_id=target_sku.id,
                    quantity=raw_exit["quantity"],
                    exit_type=raw_exit["exit_type"],
                    tracking_number=raw_exit["tracking_number"],
                    warehouse=raw_exit["warehouse"],
                )
                exit_record = StockExit(
                    sku_id=validated_exit.sku_id,
                    quantity=validated_exit.quantity,
                    exit_type=validated_exit.exit_type,
                    tracking_number=validated_exit.tracking_number,
                    warehouse=validated_exit.warehouse,
                    created_at=base_time - timedelta(minutes=int(raw_exit["minutes_ago"])),
                    user_uuid=seed_user_uuid,
                )
                session.add(exit_record)
                inserted_exits += 1

        session.commit()

    return {
        "skus": inserted_skus,
        "entries": inserted_entries,
        "exits": inserted_exits,
    }


def main() -> int:
    try:
        counts = seed_inventory()
    except ValidationError as error:
        print(
            f"Error de validación en los datos semilla de inventario: {error}",
            file=sys.stderr,
        )
        return 1
    except RuntimeError as error:
        print(f"Error de configuración: {error}", file=sys.stderr)
        return 1
    except Exception:
        # Evitar imprimir trazas crudas que puedan incluir parámetros de conexión de DATABASE_URL
        print(
            "Error al conectar o sembrar las tablas de inventario en Supabase. "
            "Verifica que DATABASE_URL en .env use el Transaction Pooler (puerto 6543) y credenciales válidas.",
            file=sys.stderr,
        )
        return 1

    if counts["skus"] == 0 and counts["entries"] == 0 and counts["exits"] == 0:
        print("El inventario semilla ya estaba inicializado; no se duplicaron registros.")
    else:
        print(
            "Seeder de inventario ejecutado con éxito: "
            f"{counts['skus']} SKUs, {counts['entries']} entradas y {counts['exits']} salidas insertadas."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
