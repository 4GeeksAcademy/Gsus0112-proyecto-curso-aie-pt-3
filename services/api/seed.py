from datetime import datetime, timezone

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


def main() -> None:
    if len(suppliers) > 0:
        for record in suppliers.all():
            if "rate" not in record:
                continue
            data = dict(record)
            data.setdefault("rate_per_shipment", data.pop("rate"))
            data.setdefault("currency", "EUR" if data["country"] == "ES" else "USD")
            data.setdefault("service_zone", data["country"])
            data.setdefault("contact_email", "supplier@example.com")
            data.setdefault("notes", "Migrated demo supplier; verify contact and service zone.")
            SupplierCreate(**data)
            def replace_record(document: dict, replacement: dict = data) -> None:
                document.clear()
                document.update(replacement)
            suppliers.update(replace_record, doc_ids=[record.doc_id])
        print("La base de datos ya está inicializada; esquema actualizado")
        return

    updated_at = datetime.now(timezone.utc).isoformat()
    records = [
        {
            **SupplierCreate(**supplier).model_dump(mode="json"),
            "updated_at": updated_at,
        }
        for supplier in SUPPLIERS_SEED
    ]
    inserted_ids = suppliers.insert_multiple(records)
    print(f"Seeder ejecutado con éxito. Se insertaron {len(inserted_ids)} registros.")


if __name__ == "__main__":
    main()