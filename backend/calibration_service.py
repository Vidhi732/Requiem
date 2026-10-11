import logging
import math
from typing import Dict, Any, Optional
import numpy as np

from backend.config import CITIES
from backend.forecast_service import get_loaded_model
from backend.tomtom_service import get_city_live_traffic, get_congestion_band, get_congestion_color

logger = logging.getLogger(__name__)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes exact great-circle distance between two geographic coordinates in kilometers.
    Uses spherical haversine formula with WGS84 earth radius R = 6371.0 km.
    """
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(d_lon / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)


def run_cross_city_calibration(
    source_city: str = "Bengaluru",
    target_city: str = "Mumbai",
    calibration_elasticity: float = 0.55
) -> Dict[str, Any]:
    """
    Transparent domain-calibration service.
    Transfers temporal baseline from source city (Bengaluru historical training data)
    and calibrates to target city based on target city's live TomTom speed ratio.
    Computes geographic coordinates, exact inter-city distance, and road-level corridor predictions.
    """
    if source_city not in CITIES:
        raise ValueError(f"Unknown source city: {source_city}")
    if target_city not in CITIES:
        raise ValueError(f"Unknown target city: {target_city}")

    source_cfg = CITIES[source_city]
    target_cfg = CITIES[target_city]

    source_center = source_cfg["center"]
    target_center = target_cfg["center"]

    # Calculate exact distance between cities
    inter_city_distance_km = haversine_distance_km(
        source_center[0], source_center[1],
        target_center[0], target_center[1]
    )

    # Load source metadata
    _, metadata = get_loaded_model()
    source_dataset_summary = metadata.get("dataset_summary", {}) if metadata else {}
    source_ref_mean_speed = source_dataset_summary.get("avg_speed_mean", 39.45)
    source_ref_ratio = 0.72  # baseline empirical uncalibrated ratio

    # Obtain source city live traffic
    source_traffic = get_city_live_traffic(source_city)
    source_summary = source_traffic["summary"]

    # Obtain target city live traffic
    target_traffic = get_city_live_traffic(target_city)
    target_summary = target_traffic["summary"]
    target_live_speed = target_summary["average_speed"]
    target_free_flow = target_summary["average_free_flow_speed"]
    target_live_ratio = target_summary["congestion_ratio"]

    # Raw uncalibrated speed expectation transferred from source dataset
    uncalibrated_speed = round(min(target_free_flow * source_ref_ratio, source_ref_mean_speed), 1)
    uncalibrated_ratio = round(uncalibrated_speed / target_free_flow, 3)

    # Documented calibration adjustment rule:
    # gamma = target_live_ratio / source_ref_ratio
    # calibrated_speed = uncalibrated_speed * [1 + elasticity * (gamma - 1)]
    gamma = target_live_ratio / max(source_ref_ratio, 0.01)
    calibrated_multiplier = 1.0 + (calibration_elasticity * (gamma - 1.0))
    calibrated_speed = float(np.clip(uncalibrated_speed * calibrated_multiplier, 12.0, target_free_flow))
    calibrated_speed = round(calibrated_speed, 1)
    calibrated_ratio = round(calibrated_speed / target_free_flow, 3)

    uncalibrated_band = get_congestion_band(uncalibrated_ratio)
    calibrated_band = get_congestion_band(calibrated_ratio)

    # Per-corridor calibrated comparison
    corridor_comparisons = []
    for road in target_traffic["roads"]:
        raw_pred = round(road["free_flow_speed"] * uncalibrated_ratio, 1)
        adj_pred = round(road["free_flow_speed"] * calibrated_ratio, 1)
        corridor_comparisons.append({
            "road_id": road["id"],
            "name": road["name"],
            "corridor": road.get("corridor", ""),
            "lat": road["lat"],
            "lon": road["lon"],
            "live_speed": road["current_speed"],
            "free_flow_speed": road["free_flow_speed"],
            "before_calibration_speed": raw_pred,
            "after_calibration_speed": adj_pred,
            "speed_difference": round(adj_pred - raw_pred, 1),
            "before_band": get_congestion_band(round(raw_pred / road["free_flow_speed"], 3)),
            "after_band": get_congestion_band(round(adj_pred / road["free_flow_speed"], 3)),
        })

    # Transit estimate between the two cities based on current calibrated velocity
    transit_speed_kmh = max(calibrated_speed, 35.0)
    estimated_transit_hours = round(inter_city_distance_km / transit_speed_kmh, 1)

    return {
        "source_city": source_city,
        "target_city": target_city,
        "source_center": source_center,
        "target_center": target_center,
        "distance_km": inter_city_distance_km,
        "estimated_transit_hours": estimated_transit_hours,
        "methodology": "Live-data-assisted cross-city calibration",
        "methodology_note": "Initial version based on target-city live speed ratio calibration. NOT validated zero-shot transfer learning.",
        "data_availability": {
            "source_historical_records": source_dataset_summary.get("record_count", 8936),
            "source_date_range": source_dataset_summary.get("date_range", ["2022-01-01", "2024-08-09"]),
            "target_monitored_segments": target_summary["monitored_segments"],
            "target_data_source": target_traffic["data_source"],
        },
        "source_summary": {
            "city": source_city,
            "center": source_center,
            "live_speed": source_summary["average_speed"],
            "free_flow_speed": source_summary["average_free_flow_speed"],
            "congestion_ratio": source_summary["congestion_ratio"],
            "congestion_band": source_summary["congestion_band"],
            "roads": source_traffic["roads"],
        },
        "target_summary": {
            "city": target_city,
            "center": target_center,
            "live_speed": target_live_speed,
            "free_flow_speed": target_free_flow,
            "congestion_ratio": target_live_ratio,
            "congestion_band": target_summary["congestion_band"],
            "roads": target_traffic["roads"],
        },
        "metrics": {
            "source_reference_speed_kmh": round(source_ref_mean_speed, 1),
            "target_live_speed_kmh": target_live_speed,
            "target_free_flow_speed_kmh": target_free_flow,
            "target_live_congestion_ratio": target_live_ratio,
            "relative_domain_ratio_gamma": round(gamma, 3),
            "calibration_elasticity": calibration_elasticity,
            "calibration_adjustment_factor": round(calibrated_multiplier, 3),
        },
        "before_vs_after": {
            "before": {
                "predicted_speed": uncalibrated_speed,
                "congestion_ratio": uncalibrated_ratio,
                "congestion_band": uncalibrated_band,
                "color": get_congestion_color(uncalibrated_band),
            },
            "after": {
                "predicted_speed": calibrated_speed,
                "congestion_ratio": calibrated_ratio,
                "congestion_band": calibrated_band,
                "color": get_congestion_color(calibrated_band),
            },
            "net_speed_delta_kmh": round(calibrated_speed - uncalibrated_speed, 1),
        },
        "corridor_comparisons": corridor_comparisons,
    }
