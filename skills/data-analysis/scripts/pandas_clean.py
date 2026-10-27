"""
Safe snippet for basic pandas cleaning. Copy and adapt for your dataset.
Run: python pandas_clean.py [data.csv]  (ensure pandas is installed)
"""
from pathlib import Path
import sys

import pandas as pd


def main() -> int:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data.csv")
    if not csv_path.exists() or not csv_path.is_file():
        print(f"Error: no se encontró el archivo de entrada '{csv_path.name}'.", file=sys.stderr)
        return 1

    try:
        df = pd.read_csv(csv_path)
    except (OSError, ValueError, pd.errors.EmptyDataError, pd.errors.ParserError) as error:
        print(f"Error al leer el archivo CSV '{csv_path.name}': {error}", file=sys.stderr)
        return 1

    if df.empty:
        print(f"Error: el archivo '{csv_path.name}' no contiene registros para procesar.", file=sys.stderr)
        return 1

    print("df_shape", df.shape)
    print("df_dtypes", df.dtypes)

    # Drop fully null columns
    df = df.dropna(axis=1, how="all")
    print("df_shape_after_drop_all_null_cols", df.shape)

    # Normalise column names (optional)
    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(" ", "_")
    print("df_columns", list(df.columns))

    # Deduplicate (optional)
    before = len(df)
    df = df.drop_duplicates()
    print("rows_dropped_duplicates", before - len(df))

    # Sample output
    print("df_head", df.head())
    return 0


if __name__ == "__main__":
    sys.exit(main())
