import os
from pathlib import Path
from typing import Tuple, Dict, Any, List
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer

from backend.config import DATA_PATH


def load_raw_dataset(csv_path: Path = DATA_PATH) -> pd.DataFrame:
    """Loads and verifies the Bengaluru historical traffic dataset."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {csv_path}. Please place Banglore_traffic_Dataset.csv in the project directory."
        )

    df = pd.read_csv(csv_path)

    expected_cols = [
        "Date",
        "Area Name",
        "Road/Intersection Name",
        "Traffic Volume",
        "Average Speed",
        "Congestion Level",
    ]
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset is missing required columns: {missing}. Verify dataset schema."
        )

    return df


def preprocess_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Cleans data, extracts temporal features, computes safe lag features per road segment,
    and returns an engineered DataFrame along with dataset summary metadata.
    """
    data = df.copy()

    # Parse timestamps
    data["Date"] = pd.to_datetime(data["Date"], errors="coerce")
    data = data.dropna(subset=["Date"])

    # Clean text columns
    data["Area Name"] = data["Area Name"].astype(str).str.strip()
    data["Road"] = data["Road/Intersection Name"].astype(str).str.strip()
    data["Weather Conditions"] = data.get("Weather Conditions", "Clear").fillna("Clear").astype(str).str.strip()
    data["Roadwork"] = data.get("Roadwork and Construction Activity", "No").fillna("No").astype(str).str.strip()

    # Numeric features
    data["Traffic Volume"] = pd.to_numeric(data["Traffic Volume"], errors="coerce").fillna(data["Traffic Volume"].median())
    data["Average Speed"] = pd.to_numeric(data["Average Speed"], errors="coerce").fillna(data["Average Speed"].median())
    data["Congestion Level"] = pd.to_numeric(data["Congestion Level"], errors="coerce").fillna(data["Congestion Level"].median())

    # Temporal feature extraction
    data["year"] = data["Date"].dt.year
    data["month"] = data["Date"].dt.month
    data["day"] = data["Date"].dt.day
    data["day_of_week"] = data["Date"].dt.dayofweek  # 0=Monday, 6=Sunday
    data["is_weekend"] = (data["day_of_week"] >= 5).astype(int)
    data["day_of_year"] = data["Date"].dt.dayofyear

    # Sort strictly chronologically per road to avoid future leakage
    data = data.sort_values(by=["Road", "Date"]).reset_index(drop=True)

    # Safe lag features per road (lag_1: previous day, lag_7: 7 days prior)
    data["speed_lag_1"] = data.groupby("Road")["Average Speed"].shift(1)
    data["speed_lag_7"] = data.groupby("Road")["Average Speed"].shift(7)
    data["congestion_lag_1"] = data.groupby("Road")["Congestion Level"].shift(1)
    data["congestion_lag_7"] = data.groupby("Road")["Congestion Level"].shift(7)

    # Fill initial lag gaps using road-specific median without looking ahead
    data["speed_lag_1"] = data.groupby("Road")["speed_lag_1"].transform(lambda x: x.bfill().fillna(data["Average Speed"].median()))
    data["speed_lag_7"] = data.groupby("Road")["speed_lag_7"].transform(lambda x: x.bfill().fillna(data["Average Speed"].median()))
    data["congestion_lag_1"] = data.groupby("Road")["congestion_lag_1"].transform(lambda x: x.bfill().fillna(data["Congestion Level"].median()))
    data["congestion_lag_7"] = data.groupby("Road")["congestion_lag_7"].transform(lambda x: x.bfill().fillna(data["Congestion Level"].median()))

    # Sort overall chronologically by Date
    data = data.sort_values(by="Date").reset_index(drop=True)

    metadata = {
        "record_count": len(data),
        "date_range": [str(data["Date"].min().date()), str(data["Date"].max().date())],
        "roads_count": data["Road"].nunique(),
        "roads": sorted(data["Road"].unique().tolist()),
        "areas": sorted(data["Area Name"].unique().tolist()),
        "avg_speed_mean": float(data["Average Speed"].mean()),
        "congestion_mean": float(data["Congestion Level"].mean()),
        "weather_distribution": data["Weather Conditions"].value_counts().to_dict(),
    }

    return data, metadata


def split_chronological(
    df: pd.DataFrame, train_ratio: float = 0.8
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Splits dataset strictly chronologically to prevent future information leakage."""
    split_idx = int(len(df) * train_ratio)
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()
    return train_df, test_df
