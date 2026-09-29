"""Analiza un CSV de incidencias de TrackFlow desde la consola."""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "services" / "api"))
from incident_analyzer import process_csv_data


def print_breakdown(title, counts):
    print(f"{title}:")
    if not counts:
        print("|- None")
    for category, value in counts.items():
        print(f"|- {category}: {value}")


def export_results(results, destination):
    with destination.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["Métrica", "Categoría", "Valor"])
        for metric in ("total_records", "valid_records", "invalid_records"):
            writer.writerow([metric, "", results[metric]])
        for metric in (
            "invalid_reasons",
            "categories",
            "statuses",
            "countries",
            "satisfaction_scores",
        ):
            for category, value in results[metric].items():
                writer.writerow([metric, category, value])
        writer.writerow(["average_satisfaction", "", results["average_satisfaction"]])


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {Path(__file__).name} <incidents.csv>", file=sys.stderr)
        return 2

    try:
        with open(sys.argv[1], newline="", encoding="utf-8-sig") as input_file:
            results = process_csv_data(input_file)
    except (OSError, UnicodeError) as error:
        print(f"Could not read CSV: {error}", file=sys.stderr)
        return 1

    print("Incident analysis")
    print(f"|- Total records: {results['total_records']}")
    print(f"|- Valid records: {results['valid_records']}")
    print(f"|- Invalid records: {results['invalid_records']}")
    print_breakdown("Invalid reasons", results["invalid_reasons"])
    print_breakdown("Categories", results["categories"])
    print_breakdown("Statuses", results["statuses"])
    print_breakdown("Countries", results["countries"])
    print_breakdown("Satisfaction scores", results["satisfaction_scores"])
    average = results["average_satisfaction"]
    print(f"|- Average satisfaction: {average if average is not None else 'N/A'}")

    try:
        answer = input("Export results to results.csv? [y/n]: ").strip().lower()
    except EOFError:
        return 0
    if answer == "y":
        try:
            export_results(results, Path("results.csv"))
        except OSError as error:
            print(f"Could not write results.csv: {error}", file=sys.stderr)
            return 1
        print("Saved results.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())