import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

from .main import app
from .routes import auth as auth_routes
from .security import create_access_token, get_password_hash, verify_password


class PasswordFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.database = TinyDB(storage=MemoryStorage)
        self.users = self.database.table("users")
        self.users.insert({
            "email": "user@example.com",
            "role": "user",
            "is_active": True,
            "created_at": "2026-10-22T00:00:00+00:00",
            "hashed_password": get_password_hash("old-password"),
        })
        self.send_email = patch.object(auth_routes, "send_password_reset_email").start()
        for patcher in (
            patch.object(auth_routes, "users", self.users),
            patch("services.api.security.users", self.users),
        ):
            patcher.start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.database.close)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def request_reset_token(self) -> str:
        response = self.client.post("/auth/forgot-password", json={"email": "user@example.com"})
        self.assertEqual(response.status_code, 200)
        return self.send_email.call_args.args[1]

    def test_forgot_password_does_not_reveal_unknown_emails(self) -> None:
        unknown = self.client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
        known = self.client.post("/auth/forgot-password", json={"email": "user@example.com"})
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.json(), known.json())
        self.send_email.assert_called_once()

    def test_reset_password_updates_hash_and_token_is_single_use(self) -> None:
        token = self.request_reset_token()
        payload = {"token": token, "new_password": "new-password"}

        self.assertEqual(self.client.post("/auth/reset-password", json=payload).status_code, 200)
        self.assertTrue(verify_password("new-password", self.users.get(doc_id=1)["hashed_password"]))

        reused = self.client.post("/auth/reset-password", json={**payload, "new_password": "x"})
        self.assertEqual(reused.status_code, 400)

    def test_tokens_are_not_interchangeable(self) -> None:
        session_token = create_access_token({"sub": "1"})
        response = self.client.post(
            "/auth/reset-password", json={"token": session_token, "new_password": "new-password"}
        )
        self.assertEqual(response.status_code, 400)

        reset_token = self.request_reset_token()
        response = self.client.get("/auth/me", headers={"Authorization": f"Bearer {reset_token}"})
        self.assertEqual(response.status_code, 401)

    def test_change_password(self) -> None:
        headers = {"Authorization": f"Bearer {create_access_token({'sub': '1'})}"}
        wrong = self.client.post(
            "/auth/change-password",
            json={"current_password": "wrong", "new_password": "new-password"},
            headers=headers,
        )
        self.assertEqual(wrong.status_code, 400)

        ok = self.client.post(
            "/auth/change-password",
            json={"current_password": "old-password", "new_password": "new-password"},
            headers=headers,
        )
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(verify_password("new-password", self.users.get(doc_id=1)["hashed_password"]))

    def test_change_password_requires_authentication(self) -> None:
        response = self.client.post(
            "/auth/change-password",
            json={"current_password": "old-password", "new_password": "new-password"},
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
