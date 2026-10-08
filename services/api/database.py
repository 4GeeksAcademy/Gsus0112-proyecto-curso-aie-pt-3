from pathlib import Path

from tinydb import TinyDB

db = TinyDB(Path(__file__).resolve().parent / "db.json")
suppliers = db.table("suppliers")