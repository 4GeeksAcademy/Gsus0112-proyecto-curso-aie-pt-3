import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

from . import seed
from .main import app
from .models import SupplierCreate
from .routes import suppliers as supplier_routes
from .security import create_access_token


class SupplierTests(unittest.TestCase):
    def setUp(self) -> None:
        self.database = TinyDB(storage=MemoryStorage)
        self.suppliers = self.database.table("suppliers")
        self.users = self.database.table("users")
        self.users.insert({
            "email": "operator@example.com",
            "role": "user",
            "created_at": "2026-10-22T00:00:00+00:00",
            "hashed_password": "unused",
        })
        for patcher in (
            patch.object(supplier_routes, "suppliers", self.suppliers),
            patch.object(seed, "suppliers", self.suppliers),
            patch("services.api.security.users", self.users),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.database.close)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.headers = {"Authorization": f"Bearer {create_access_token({'sub': '1'})}"}
        self.payload = dict(seed.SUPPLIERS_SEED[0])

    def create_supplier(self) -> dict:
        response = self.client.post("/api/suppliers", json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_all_routes_require_authentication(self) -> None:
        for method, path, payload in [
            ("GET", "", None),
            ("POST", "", self.payload),
            ("GET", "/1", None),
            ("PATCH", "/1/rate", {"rate_per_shipment": 5}),
            ("PATCH", "/1/status", {"status": "suspended"}),
            ("DELETE", "/1", None),
        ]:
            with self.subTest(method=method, path=path):
                response = self.client.request(method, f"/api/suppliers{path}", json=payload)
                self.assertEqual(response.status_code, 401)

    def test_authenticated_crud_and_filters(self) -> None:
        supplier = self.create_supplier()
        supplier_id = supplier["id"]
        for key, value in self.payload.items():
            self.assertEqual(supplier[key], value)
        self.assertNotIn("rate", supplier)
        self.assertEqual(self.client.get(f"/api/suppliers/{supplier_id}", headers=self.headers).status_code, 200)
        filtered = self.client.get("/api/suppliers?country=US&category=last%20mile%20delivery", headers=self.headers)
        self.assertEqual(len(filtered.json()), 1)
        self.assertEqual(self.client.get("/api/suppliers?country=ES", headers=self.headers).json(), [])
        response = self.client.patch(f"/api/suppliers/{supplier_id}/rate", json={"rate_per_shipment": 9.5}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rate_per_shipment"], 9.5)
        self.assertEqual(self.suppliers.get(doc_id=supplier_id)["rate_per_shipment"], 9.5)
        self.assertNotIn("rate", self.suppliers.get(doc_id=supplier_id))
        response = self.client.patch(f"/api/suppliers/{supplier_id}/status", json={"status": "suspended"}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "suspended")
        self.assertEqual(self.client.delete(f"/api/suppliers/{supplier_id}", headers=self.headers).status_code, 204)
        self.assertEqual(self.client.get(f"/api/suppliers/{supplier_id}", headers=self.headers).status_code, 404)

    def test_rejects_nonpositive_rates_on_create_and_patch(self) -> None:
        supplier = self.create_supplier()
        for rate in (0, -1):
            with self.subTest(rate=rate):
                response = self.client.post("/api/suppliers", json={**self.payload, "rate_per_shipment": rate}, headers=self.headers)
                self.assertEqual(response.status_code, 422)
                response = self.client.patch(f"/api/suppliers/{supplier['id']}/rate", json={"rate_per_shipment": rate}, headers=self.headers)
                self.assertEqual(response.status_code, 422)

    def test_rejects_legacy_rate_payload(self) -> None:
        supplier = self.create_supplier()
        response = self.client.patch(f"/api/suppliers/{supplier['id']}/rate", json={"rate": 5}, headers=self.headers)
        self.assertEqual(response.status_code, 422)

    def test_required_fields_email_and_optional_notes(self) -> None:
        for field in ("currency", "service_zone", "contact_email", "rate_per_shipment"):
            with self.subTest(field=field):
                payload = {key: value for key, value in self.payload.items() if key != field}
                self.assertEqual(self.client.post("/api/suppliers", json=payload, headers=self.headers).status_code, 422)
        response = self.client.post("/api/suppliers", json={**self.payload, "contact_email": "invalid"}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        payload = {key: value for key, value in self.payload.items() if key != "notes"}
        response = self.client.post("/api/suppliers", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()["notes"])

    def test_seed_is_valid_and_idempotent(self) -> None:
        seed.main()
        original = self.suppliers.all()
        self.assertEqual(len(original), 8)
        for supplier in original:
            SupplierCreate(**supplier)
        seed.main()
        self.assertEqual(self.suppliers.all(), original)

    def test_seed_migrates_legacy_records_without_losing_data(self) -> None:
        legacy = {"name": "Existing supplier", "country": "ES", "categories": ["packaging"], "rate": 3, "status": "suspended", "updated_at": "original"}
        supplier_id = self.suppliers.insert(legacy)
        seed.main()
        migrated = self.suppliers.get(doc_id=supplier_id)
        self.assertEqual(len(self.suppliers), 1)
        self.assertEqual(migrated["rate_per_shipment"], 3)
        self.assertEqual(migrated["name"], legacy["name"])
        self.assertEqual(migrated["status"], "suspended")
        self.assertEqual(migrated["updated_at"], "original")
        self.assertNotIn("rate", migrated)
        SupplierCreate(**migrated)
        seed.main()
        self.assertEqual(self.suppliers.get(doc_id=supplier_id), migrated)


if __name__ == "__main__":
    unittest.main()