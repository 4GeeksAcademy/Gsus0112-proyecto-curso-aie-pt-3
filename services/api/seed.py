from datetime import datetime, timezone
import sys

from pydantic import ValidationError

if __package__:
    from .database import suppliers
    from .models import SupplierCreate
else:
    from database import suppliers
    from models import SupplierCreate


SUPPLIERS_SEED = [
    {"name": "UPS", "country": "US", "categories": ["last mile delivery"],
     "rate_per_shipment": 6.5, "currency": "USD", "service_zone": "United States",
     "contact_email": "ups@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "FedEx", "country": "US", "categories": ["last mile delivery"],
     "rate_per_shipment": 7.0, "currency": "USD", "service_zone": "United States",
     "contact_email": "fedex@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "DHL US", "country": "US", "categories": ["last mile delivery"],
     "rate_per_shipment": 7.5, "currency": "USD", "service_zone": "United States",
     "contact_email": "dhl-us@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "MRW", "country": "ES", "categories": ["last mile delivery"],
     "rate_per_shipment": 4.5, "currency": "EUR", "service_zone": "Spain",
     "contact_email": "mrw@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "SEUR", "country": "ES", "categories": ["last mile delivery"],
     "rate_per_shipment": 5.0, "currency": "EUR", "service_zone": "Spain",
     "contact_email": "seur@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "DHL ES", "country": "ES", "categories": ["last mile delivery"],
     "rate_per_shipment": 5.5, "currency": "EUR", "service_zone": "Spain",
     "contact_email": "dhl-es@example.com", "notes": "Demo rates and contact.", "status": "active"},
    {"name": "Los Angeles Local Carrier", "country": "US", "categories": ["last mile delivery"],
     "rate_per_shipment": 4.0, "currency": "USD", "service_zone": "Los Angeles",
     "contact_email": "local-la@example.com", "notes": "Demo local carrier.", "status": "active"},
    {"name": "Zaragoza Local Carrier", "country": "ES", "categories": ["last mile delivery"],
     "rate_per_shipment": 3.5, "currency": "EUR", "service_zone": "Zaragoza",
     "contact_email": "local-zaragoza@example.com", "notes": "Demo local carrier.", "status": "active"},
]


def main() -> int:
    if not SUPPLIERS_SEED:
        print("Error: la lista SUPPLIERS_SEED está vacía.", file=sys.stderr)
        return 1

    try:
        existing_count = len(suppliers)
    except OSError as error:
        print(f"Error al acceder a la base de datos de proveedores: {error}", file=sys.stderr)
        return 1

    if existing_count > 0:
        try:
            existing_records = suppliers.all()
        except OSError as error:
            print(f"Error al leer los proveedores existentes: {error}", file=sys.stderr)
            return 1

        for record in existing_records:
            if "rate" not in record:
                continue
            data = dict(record)
            country = str(data.get("country") or "US").upper()
            data["country"] = country
            data.setdefault("rate_per_shipment", data.pop("rate"))
            data.setdefault("currency", "EUR" if country == "ES" else "USD")
            data.setdefault("service_zone", country)
            data.setdefault("contact_email", "supplier@example.com")
            data.setdefault("notes", "Migrated demo supplier; verify contact and service zone.")

            try:
                SupplierCreate(**data)
            except ValidationError as error:
                print(
                    f"Error de validación al migrar proveedor id={record.doc_id}: {error}",
                    file=sys.stderr,
                )
                return 1

            def replace_record(document: dict, replacement: dict = data) -> None:
                document.clear()
                document.update(replacement)

            try:
                suppliers.update(replace_record, doc_ids=[record.doc_id])
            except OSError as error:
                print(
                    f"Error al guardar el proveedor migrado id={record.doc_id}: {error}",
                    file=sys.stderr,
                )
                return 1

        print("La base de datos ya está inicializada; esquema actualizado")
        return 0

    updated_at = datetime.now(timezone.utc).isoformat()
    records: list[dict] = []
    for index, supplier in enumerate(SUPPLIERS_SEED, start=1):
        try:
            validated = SupplierCreate(**supplier).model_dump(mode="json")
        except ValidationError as error:
            print(
                f"Error de validación en el registro semilla #{index}: {error}",
                file=sys.stderr,
            )
            return 1
        records.append({**validated, "updated_at": updated_at})

    try:
        inserted_ids = suppliers.insert_multiple(records)
    except OSError as error:
        print(f"Error al insertar los proveedores semilla: {error}", file=sys.stderr)
        return 1

    print(f"Seeder ejecutado con éxito. Se insertaron {len(inserted_ids)} registros.")
    return 0


if __name__ == "__main__":
    sys.exit(main())