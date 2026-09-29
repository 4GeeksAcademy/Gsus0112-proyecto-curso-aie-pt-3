"""API de análisis de incidencias de TrackFlow."""

import csv
import io
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .incident_analyzer import process_csv_data

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

last_analysis: dict[str, Any] | None = None


@app.post("/api/incidents/analyze")
async def analyze_incidents(file: UploadFile = File(...)) -> dict[str, Any]:
    global last_analysis

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must have a .csv extension")

    try:
        content = (await file.read()).decode("utf-8-sig")
        results = process_csv_data(io.StringIO(content, newline=""))
    except (UnicodeDecodeError, csv.Error) as error:
        raise HTTPException(status_code=400, detail="Invalid CSV file") from error

    last_analysis = results
    return results


@app.get("/api/incidents/results/export")
def export_results() -> StreamingResponse:
    analysis = last_analysis
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis available")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Métrica", "Categoría", "Valor"])
    for metric in ("total_records", "valid_records", "invalid_records"):
        writer.writerow([metric, "", analysis[metric]])
    for metric in (
        "invalid_reasons",
        "categories",
        "statuses",
        "countries",
        "satisfaction_scores",
    ):
        for category, value in analysis[metric].items():
            writer.writerow([metric, category, value])
    writer.writerow(["average_satisfaction", "", analysis["average_satisfaction"]])
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="results.csv"'},
    )