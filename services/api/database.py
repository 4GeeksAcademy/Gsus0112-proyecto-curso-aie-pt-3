import os
from pathlib import Path

from tinydb import TinyDB

db = TinyDB(os.getenv("TRACKFLOW_DB_PATH", str(Path(__file__).resolve().parent / "db.json")))
suppliers = db.table("suppliers")
users = db.table("users")
profiles = db.table("profiles")