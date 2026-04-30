import pandas as pd

NUMERIC_COLUMNS = [
    "AQI",
    "PM2.5",
    "PM10",
    "NO2",
    # "SO2",
    "CO",
    # "O3",
    "temperature",
    "humidity",
    "wind_speed",
    "pressure",
]


def preprocess_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw data by sorting timestamps and interpolating missing numeric values."""
    df = df.copy()
    if "datetime" not in df.columns:
        raise ValueError("DataFrame must contain a 'datetime' column")

    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values("datetime").reset_index(drop=True)
    df = df.set_index("datetime")

    numeric_cols = [col for col in NUMERIC_COLUMNS if col in df.columns]
    df[numeric_cols] = df[numeric_cols].interpolate(method="time", limit_direction="both")
    df[numeric_cols] = df[numeric_cols].ffill().bfill()

    return df.reset_index()
