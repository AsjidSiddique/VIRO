"""
Validation helpers for batch CSV uploads — kept separate from the model service so
input-shape/size problems are rejected before any preprocessing or inference is attempted.
"""
import io
import pandas as pd

from app.config import settings, REQUIRED_COLUMNS


class BatchValidationError(ValueError):
    pass


def validate_csv_bytes(raw_bytes: bytes) -> pd.DataFrame:
    if len(raw_bytes) > settings.MAX_UPLOAD_BYTES:
        raise BatchValidationError(
            f"File too large ({len(raw_bytes)} bytes). Limit is {settings.MAX_UPLOAD_BYTES} bytes."
        )

    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise BatchValidationError(f"Could not parse CSV: {exc}") from exc

    if df.empty:
        raise BatchValidationError("Uploaded CSV has no rows.")

    if len(df) > settings.MAX_BATCH_ROWS:
        raise BatchValidationError(
            f"CSV has {len(df)} rows, which exceeds the {settings.MAX_BATCH_ROWS}-row batch limit."
        )

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise BatchValidationError(f"CSV is missing required column(s): {missing}")

    non_numeric = [c for c in REQUIRED_COLUMNS if not pd.api.types.is_numeric_dtype(df[c])]
    if non_numeric:
        raise BatchValidationError(f"Column(s) contain non-numeric values: {non_numeric}")

    if df[REQUIRED_COLUMNS].isna().any().any():
        raise BatchValidationError("CSV contains missing values in one or more required columns.")

    return df
