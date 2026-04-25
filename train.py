import argparse
from pathlib import Path

from data_loader import load_data
from feature_engineering import build_feature_matrix, get_feature_columns
from model import get_models, evaluate_model, save_model, train_model
from preprocessing import preprocess_data


def split_by_time(df, test_fraction=0.2):
    """Split the dataset by time order without randomization."""
    split_index = int(len(df) * (1 - test_fraction))
    train_df = df.iloc[:split_index].reset_index(drop=True)
    test_df = df.iloc[split_index:].reset_index(drop=True)
    return train_df, test_df


def main(csv_path: str, models_dir: str):
    df = load_data(csv_path)
    df = preprocess_data(df)
    df = build_feature_matrix(df)

    feature_columns = get_feature_columns(df)
    target_column = "AQI"

    train_df, test_df = split_by_time(df, test_fraction=0.2)

    X_train = train_df[feature_columns]
    y_train = train_df[target_column]
    X_test = test_df[feature_columns]
    y_test = test_df[target_column]

    models = get_models()
    output_dir = Path(models_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for name, model in models.items():
        trained = train_model(model, X_train, y_train)
        metrics = evaluate_model(trained, X_test, y_test)
        print(f"{name.upper()} evaluation:")
        print(f"  RMSE: {metrics['rmse']:.4f}")
        print(f"  MAE:  {metrics['mae']:.4f}")

        save_model(trained, str(output_dir / f"model_{name}.joblib"))

    save_model(feature_columns, str(output_dir / "feature_columns.joblib"))
    print(f"Saved trained models and feature metadata to: {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AQI prediction models.")
    parser.add_argument("--csv", required=True, help="Path to the input CSV file.")
    parser.add_argument("--output-dir", default="models", help="Directory to save trained models.")
    args = parser.parse_args()

    main(args.csv, args.output_dir)
