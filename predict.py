import joblib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

USE_SAFETY_CHOOSER = False

REQUIRED_COLUMNS = [
    "datetime",
    "AQI",
    "PM2.5",
    "PM10",
    "NO2",
    "CO",
    "temperature",
    "humidity",
    "wind_speed",
    "pressure",
]


def load_model(model_path: str):
    """Load a model with error handling."""
    try:
        return joblib.load(model_path)
    except Exception as e:
        raise ValueError(f"Failed to load model from {model_path}: {str(e)}")


def load_feature_columns(columns_path: str) -> List[str]:
    """Load feature columns with error handling."""
    try:
        return joblib.load(columns_path)
    except Exception as e:
        raise ValueError(f"Failed to load feature columns from {columns_path}: {str(e)}")


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
        "SO2": 0.0,  
        "CO": float(latest_values["CO"]),
        "O3": 0.0, 
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


def predict_single_aqi(model, latest_payload: Dict, feature_columns: List[str], horizon: int = 1) -> float:
    """Predict AQI for a single future horizon using the given model."""
    validated = validate_latest_input(latest_payload)
    forecast_time = pd.to_datetime(validated["datetime"]) + timedelta(hours=horizon)

    last_aqi = float(validated["AQI"])
    recent_aqi = list(validated.get("previous_aqi", []))
    if len(recent_aqi) < 3:
        recent_aqi = [last_aqi] * (3 - len(recent_aqi)) + recent_aqi
    recent_aqi.append(last_aqi)

    row = build_future_feature_row(validated, recent_aqi, forecast_time)
    available_features = [col for col in feature_columns if col in row]
    X = pd.DataFrame([row], columns=available_features)
    predicted_aqi = float(model.predict(X)[0])

    predicted_aqi = max(0, predicted_aqi)
    return predicted_aqi


def dual_model_prediction(
    payload: Dict,
    xgb_model_path: str = "models/model_xgb.joblib",
    linear_model_path: str = "models/model_linear.joblib",
    feature_columns_path: str = "models/feature_columns.joblib",
) -> Dict:
    """Perform dual-model prediction with chooser mechanism."""
    xgb_model = load_model(xgb_model_path)
    linear_model = load_model(linear_model_path)
    feature_columns = load_feature_columns(feature_columns_path)

    xgb_prediction = predict_single_aqi(xgb_model, payload, feature_columns)
    linear_prediction = predict_single_aqi(linear_model, payload, feature_columns)

    if USE_SAFETY_CHOOSER:
        if xgb_prediction >= linear_prediction:
            selected_prediction = xgb_prediction
            selected_model = "XGBoost"
        else:
            selected_prediction = linear_prediction
            selected_model = "Linear Regression"
        reason = "Selected maximum AQI as worst-case safety prediction"
    else:
        selected_prediction = linear_prediction
        selected_model = "Linear Regression"
        reason = "Using Linear Regression as per configuration"

    print(f"XGBoost prediction: {xgb_prediction:.2f}")
    print(f"Linear Regression prediction: {linear_prediction:.2f}")
    print(f"Selected prediction: {selected_prediction:.2f} from {selected_model}")
    print(f"Reason: {reason}")

    return {
        "xgboost_prediction": round(xgb_prediction, 2),
        "linear_prediction": round(linear_prediction, 2),
        "selected_prediction": round(selected_prediction, 2),
        "selected_model": selected_model,
        "reason": reason
    }


def predict_from_saved_model(
    payload: Dict,
    model_path: str = "models/model_xgb.joblib",
    feature_columns_path: str = "models/feature_columns.joblib",
) -> Dict[str, float]:
    """Legacy function for single model prediction (XGBoost only)."""
    model = load_model(model_path)
    columns = load_feature_columns(feature_columns_path)
    prediction = predict_single_aqi(model, payload, columns)
    return {"AQI_prediction": prediction}


if __name__ == "__main__":
    sample_payload = {
        "datetime": "2026-04-30 02:37:00",
        "AQI": 120,
        "PM2.5": 25.5,
        "PM10": 45.2,
        "NO2": 20.1,
        "CO": 0.8,
        "temperature": 28.5,
        "humidity": 65.0,
        "wind_speed": 3.2,
        "pressure": 1013.2,
        "previous_aqi": [115, 118, 122]
    }

    result = dual_model_prediction(sample_payload)
    print("Prediction Result:", result)
