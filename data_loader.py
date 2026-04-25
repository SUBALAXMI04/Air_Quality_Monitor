import pandas as pd

REQUIRED_COLUMNS = [
    "datetime",
    "AQI",
    "PM2.5",
    "PM10",
    "NO2",
    "SO2",
    "CO",
    "O3",
    "temperature",
    "humidity",
    "wind_speed",
    "pressure",
]


def load_data(csv_path: str) -> pd.DataFrame:
    """Load raw air quality CSV data and validate required fields."""
    df = pd.read_csv(csv_path)

    missing = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values("datetime").reset_index(drop=True)

    return df
