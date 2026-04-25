from pathlib import Path
import joblib
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor


def get_models() -> dict:
    """Create primary and baseline models."""
    return {
        "xgb": XGBRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
            verbosity=0,
        ),
        "linear": LinearRegression(),
    }


def train_model(model, X, y):
    """Train a scikit-learn compatible regressor."""
    model.fit(X, y)
    return model


def evaluate_model(model, X, y) -> dict:
    """Evaluate a regressor using RMSE and MAE."""
    predictions = model.predict(X)
    mae = mean_absolute_error(y, predictions)
    rmse = np.sqrt(mean_squared_error(y, predictions))
    return {"mae": float(mae), "rmse": float(rmse)}


def save_model(model, output_path: str) -> None:
    """Persist a trained model to disk using joblib."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)


def load_model(model_path: str):
    """Load a persisted model from disk."""
    return joblib.load(model_path)
