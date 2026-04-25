import joblib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
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


def load_model(model_path: str):
    return joblib.load(model_path)


def load_feature_columns(columns_path: str) -> List[str]:
    return joblib.load(columns_path)


def validate_latest_input(payload: Dict) -> Dict:
    """Validate the incoming payload for prediction."""
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object.")

    missing = [col for col in REQUIRED_COLUMNS if col not in payload]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")

    validated = payload.copy()
    validated["datetime"] = pd.to_datetime(validated["datetime"])
    return validated


def build_future_feature_row(latest_values: Dict, recent_aqi: List[float], forecast_time: datetime) -> Dict:
    """Create a single feature row for a future forecast timestamp."""
    row = {
        "PM2.5": float(latest_values["PM2.5"]),
        "PM10": float(latest_values["PM10"]),
        "NO2": float(latest_values["NO2"]),
        "SO2": float(latest_values["SO2"]),
        "CO": float(latest_values["CO"]),
        "O3": float(latest_values["O3"]),
        "temperature": float(latest_values["temperature"]),
        "humidity": float(latest_values["humidity"]),
        "wind_speed": float(latest_values["wind_speed"]),
        "pressure": float(latest_values["pressure"]),
        "hour": int(forecast_time.hour),
        "day_of_week": int(forecast_time.dayofweek),
        "AQI_t-1": float(recent_aqi[-1]),
        "AQI_t-2": float(recent_aqi[-2]) if len(recent_aqi) > 1 else float(recent_aqi[-1]),
        "AQI_t-3": float(recent_aqi[-3]) if len(recent_aqi) > 2 else float(recent_aqi[-1]),
        "AQI_rolling_3h": float(np.mean(recent_aqi[-3:])),
        "AQI_rolling_6h": float(np.mean(recent_aqi[-6:])),
    }
    return row


def forecast_aqi(
    latest_payload: Dict,
    model,
    feature_columns: List[str],
    horizons: Optional[List[int]] = None,
) -> Dict[str, float]:
    """Forecast AQI for future hour horizons using recursive prediction."""
    if horizons is None:
        horizons = [1, 3, 6, 12]

    validated = validate_latest_input(latest_payload)
    forecast_time = pd.to_datetime(validated["datetime"])

    last_aqi = float(validated["AQI"])
    recent_aqi = list(validated.get("previous_aqi", []))
    if len(recent_aqi) < 3:
        recent_aqi = [last_aqi] * (3 - len(recent_aqi)) + recent_aqi
    recent_aqi.append(last_aqi)

    predictions = {}
    max_horizon = max(horizons)

    for step in range(1, max_horizon + 1):
        target_time = forecast_time + timedelta(hours=step)
        row = build_future_feature_row(validated, recent_aqi, target_time)
        X = pd.DataFrame([row], columns=feature_columns)
        predicted_aqi = float(model.predict(X)[0])

        recent_aqi.append(predicted_aqi)
        if step in horizons:
            predictions[f"AQI_plus_{step}h"] = round(predicted_aqi, 2)

    return predictions


def predict_from_saved_model(
    payload: Dict,
    model_path: str = "models/model_xgb.joblib",
    feature_columns_path: str = "models/feature_columns.joblib",
) -> Dict[str, float]:
    model = load_model(model_path)
    columns = load_feature_columns(feature_columns_path)
    return forecast_aqi(payload, model, columns)
