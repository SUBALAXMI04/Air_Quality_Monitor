import pandas as pd
from typing import List

TARGET_COLUMN = "AQI"


def create_lag_features(df: pd.DataFrame, lags: List[int] = [1, 2, 3]) -> pd.DataFrame:
    """Add lag features for the target column."""
    df = df.copy()
    for lag in lags:
        df[f"{TARGET_COLUMN}_t-{lag}"] = df[TARGET_COLUMN].shift(lag)
    return df


def create_rolling_features(df: pd.DataFrame, windows: List[int] = [3, 6]) -> pd.DataFrame:
    """Add rolling mean features for the target column based on prior observations."""
    df = df.copy()
    for window in windows:
        df[f"{TARGET_COLUMN}_rolling_{window}h"] = (
            df[TARGET_COLUMN].shift(1).rolling(window=window, min_periods=1).mean()
        )
    return df


def create_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add time-based features from the datetime column."""
    df = df.copy()
    df["hour"] = df["datetime"].dt.hour
    df["day_of_week"] = df["datetime"].dt.dayofweek
    return df


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Build the training feature matrix with lag, rolling, and time features."""
    df = df.copy()
    df = create_lag_features(df)
    df = create_rolling_features(df)
    df = create_time_features(df)

    feature_columns = [
        col
        for col in df.columns
        if col not in ["datetime", TARGET_COLUMN]
    ]

    df = df.dropna(subset=feature_columns + [TARGET_COLUMN]).reset_index(drop=True)
    return df


def get_feature_columns(df: pd.DataFrame) -> List[str]:
    """Return the list of model feature columns after feature engineering."""
    return [col for col in df.columns if col not in ["datetime", TARGET_COLUMN]]
