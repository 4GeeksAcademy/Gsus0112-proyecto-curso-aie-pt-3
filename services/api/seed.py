from datetime import datetime, timezone

if __package__:
    from .database import suppliers
    from .models import SupplierCreate
else:
    from database import suppliers
    from models import SupplierCreate


def main() -> None:
    if len(suppliers) > 0:
        print("La base de datos ya está inicializada")
        return

    initial_suppliers = [
        {
            "name": "IberPack Embalajes",
            "country": "ES",
            "categories": ["packaging", "warehouse supplies"],
            "rate": 0.85,
            "status": "active",
        },
        {
            "name": "West Coast Fleet Services",
            "country": "US",
            "categories": ["fleet maintenance"],
            "rate": 85.0,
            "status": "active",
        },
        {
            "name": "RutaCloud Logistics Software",
            "country": "ES",
            "categories": ["software", "route optimization"],
            "rate": 120.0,
            "status": "active",
        },
        {
            "name": "Pacific Last Mile Partners",
            "country": "US",
            "categories": ["last mile delivery"],
            "rate": 4.5,
            "status": "suspended",
        },
    ]
    updated_at = datetime.now(timezone.utc).isoformat()
    records = [
        {
            **SupplierCreate(**supplier).model_dump(mode="json"),
            "updated_at": updated_at,
        }
        for supplier in initial_suppliers
    ]
    inserted_ids = suppliers.insert_multiple(records)
    print(f"Seeder ejecutado con éxito. Se insertaron {len(inserted_ids)} registros.")


if __name__ == "__main__":
    main()