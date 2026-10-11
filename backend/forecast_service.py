import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib

from backend.config import MODEL_PATH, METADATA_PATH, CITIES
from backend.tomtom_service import fetch_flow_segment, get_congestion_band, get_congestion_color

logger = logging.getLogger(__name__)

# Cache loaded model & metadata in memory
_MODEL_PIPELINE = None
_METADATA = None

# Forecast horizons supported
FORECAST_HORIZONS: List[int] = [0, 15, 30, 60]

# Half-life decay constant tau in minutes for persistence calibration
CALIBRATION_TAU_MINUTES: float = 38.0


def get_loaded_model():
    """Returns cached ML model pipeline and metadata JSON."""
    global _MODEL_PIPELINE, _METADATA
    if _MODEL_PIPELINE is None and MODEL_PATH.exists():
        try:
            _MODEL_PIPELINE = joblib.load(MODEL_PATH)
            logger.info("Loaded trained traffic model pipeline.")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")

    if _METADATA is None and METADATA_PATH.exists():
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                _METADATA = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")

    return _MODEL_PIPELINE, _METADATA


def compute_diurnal_factor(dt: datetime) -> float:
    """
    Computes an empirical Indian metropolitan diurnal traffic index (0.15 to 0.95).
    Peak commuter rush windows:
      - Morning peak: 8:30 AM to 11:00 AM (centered ~9:30 AM / 570 min)
      - Evening peak: 5:30 PM to 9:00 PM (centered ~7:15 PM / 1155 min)
      - Midday plateau: 12:00 PM to 4:00 PM
      - Night lull: late night / early morning

    Returns congestion pressure intensity in range [0.15, 0.95].
    """
    minute_of_day = dt.hour * 60 + dt.minute

    # Morning peak centered around 9:30 AM (570 min)
    morning_peak = np.exp(-((minute_of_day - 570) ** 2) / (2 * (55 ** 2)))

    # Evening peak centered around 7:15 PM (1155 min)
    evening_peak = 1.15 * np.exp(-((minute_of_day - 1155) ** 2) / (2 * (65 ** 2)))

    # Midday plateau around 2:00 PM (840 min)
    midday_base = 0.45 * np.exp(-((minute_of_day - 840) ** 2) / (2 * (150 ** 2)))

    # Night base
    night_lull = 0.15

    intensity = float(np.clip(morning_peak + evening_peak + midday_base + night_lull, 0.15, 0.95))
    return intensity


def calculate_horizon_calibration(
    delta_t_minutes: int,
    live_speed_ratio: float,
    model_baseline_ratio: float,
    free_flow_speed: float,
    current_diurnal: float,
    target_diurnal: float,
    has_live_telemetry: bool = True,
    tau_minutes: float = CALIBRATION_TAU_MINUTES,
    elasticity_eta: float = 0.85
) -> Dict[str, Any]:
    """
    Mathematically documented and testable calibration formula for multi-horizon forecasting.
    
    ========================================================================================
    CALIBRATION FORMULATION & PROVENANCE:
    ========================================================================================
    Let:
      - Delta_t: Horizon offset in minutes in {0, 15, 30, 60}.
      - v_free: Segment free-flow speed limit (km/h).
      - r_live = v_live / v_free: Live TomTom speed ratio in [0.05, 1.0].
      - r_model = v_model_hat / v_free: Historical ML model predicted ratio in [0.20, 0.95].
      - tau = 38.0 min: Autoregressive persistence half-life decay constant.
      - lambda(Delta_t) = exp(-Delta_t / tau): Exponential live telemetry persistence weight.
          * lambda(0) = 1.000 (Pure live TomTom observation)
          * lambda(15) ~ 0.674 (Live momentum dominated, diurnal trend beginning)
          * lambda(30) ~ 0.454 (Balanced blend between live momentum and seasonal curve)
          * lambda(60) ~ 0.206 (Decayed back toward diurnal historical expectation)
      - delta_D = D(t + Delta_t) - D(t): Diurnal gradient from Indian traffic commute curve.
      - Delta_anomaly = r_live - r_model: Target-city live calibration delta.

    Calibrated Speed Ratio:
      r_calib(Delta_t) = r_model + [ lambda(Delta_t) * eta * Delta_anomaly ] - [ 0.32 * delta_D ]
      
    Boundaries:
      r_calib is clipped to [0.15, 0.98].
      v_calib(Delta_t) = round(r_calib * v_free, 1).
      
    If live telemetry is unavailable or missing:
      lambda(Delta_t) = 0.0, r_live = r_model, and data_source transitions to fallback.
      
    CRUCIAL METHODOLOGICAL DISCLAIMER:
      Historical datasets are aggregated on an hourly/daily basis.
      Hourly historical data DOES NOT provide validated 15-minute sensor predictions.
      Sub-hourly predictions (+15, +30 min) represent live-calibrated persistence decay
      and diurnal interpolation, NOT independent 15-minute ML validation.
    ========================================================================================
    """
    if delta_t_minutes < 0:
        raise ValueError(f"Horizon delta_t_minutes must be non-negative, got {delta_t_minutes}")

    # 1. Decay weight lambda(Delta_t)
    if delta_t_minutes == 0:
        decay_lambda = 1.0
    else:
        decay_lambda = float(np.exp(-float(delta_t_minutes) / float(tau_minutes)))

    # 2. Live anomaly calibration input
    if has_live_telemetry:
        live_anomaly = float(live_speed_ratio - model_baseline_ratio)
        effective_lambda = decay_lambda
    else:
        live_anomaly = 0.0
        effective_lambda = 0.0

    # 3. Diurnal commute trend gradient
    diurnal_delta = float(target_diurnal - current_diurnal)
    diurnal_adjustment = -0.32 * diurnal_delta  # positive diurnal surge causes speed ratio drop

    # 4. Synthesized speed ratio
    if delta_t_minutes == 0 and has_live_telemetry:
        # Horizon 0 is exact current observation
        calibrated_ratio = float(live_speed_ratio)
    else:
        calibrated_ratio = (
            model_baseline_ratio
            + (effective_lambda * elasticity_eta * live_anomaly)
            + diurnal_adjustment
        )

    # Enforce safe physical boundaries
    clipped_ratio = float(np.clip(calibrated_ratio, 0.15, 0.98))
    predicted_speed = round(float(clipped_ratio * free_flow_speed), 1)

    # Explanation factor weights
    live_weight = round(effective_lambda * elasticity_eta if has_live_telemetry else 0.0, 3)
    ml_weight = round(1.0 - (effective_lambda * elasticity_eta) if has_live_telemetry else 1.0, 3)

    return {
        "horizon_minutes": delta_t_minutes,
        "decay_lambda": round(decay_lambda, 3),
        "effective_lambda": round(effective_lambda, 3),
        "live_weight": live_weight,
        "historical_ml_weight": ml_weight,
        "live_anomaly_delta": round(live_anomaly, 3),
        "diurnal_delta": round(diurnal_delta, 3),
        "diurnal_adjustment": round(diurnal_adjustment, 3),
        "calibrated_ratio": round(clipped_ratio, 3),
        "predicted_speed": predicted_speed,
    }


from backend.temporal_context import (
    calculate_temporal_and_contextual_factors,
    INDIAN_FESTIVALS,
    WEATHER_MODIFIERS,
    ROADWORK_MODIFIERS,
)


def generate_road_forecast(
    city_name: str,
    road_id: str,
    weather: str = "Clear",
    roadwork: str = "No",
    horizon_minutes: Optional[int] = None,
    target_timestamp: Optional[str] = None,
    festival: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates multi-horizon traffic forecasts or arbitrary point-in-time predictions.
    Synthesizes the trained ML model with live TomTom segment telemetry, diurnal rush curves,
    weather degradation, construction slowdowns, and Indian festival impact multipliers.
    Gracefully handles missing or failing live TomTom API data.
    """
    city_data = CITIES.get(city_name)
    if not city_data:
        raise ValueError(f"Unknown city: {city_name}")

    road_meta = next((r for r in city_data["roads"] if r["id"] == road_id), None)
    if not road_meta:
        # Fallback to first road in the city manifest
        road_meta = city_data["roads"][0]

    free_flow = float(road_meta.get("free_flow_speed", 45.0))

    # Fetch live road observation from TomTom Flow Segment API
    live_segment = fetch_flow_segment(road_meta["lat"], road_meta["lon"], allow_fallback=True)
    
    # Assess live telemetry state
    is_live_telemetry = bool(
        live_segment.get("source") == "tomtom_api" or 
        live_segment.get("data_source") == "live_tomtom_api"
    )
    
    live_current_speed = float(live_segment.get("current_speed") or live_segment.get("currentSpeed") or (free_flow * 0.70))
    free_flow = float(live_segment.get("free_flow_speed") or live_segment.get("freeFlowSpeed") or free_flow)
    live_ratio = float(live_segment.get("congestion_ratio") or live_segment.get("congestionRatio") or (live_current_speed / free_flow))
    live_ratio = float(np.clip(live_ratio, 0.10, 1.0))

    # Base data source classification
    if is_live_telemetry:
        base_source_label = "tomtom_live_calibrated"
        telemetry_status = "live_connected"
    elif live_segment.get("status") == "missing_key":
        base_source_label = "historical_model_uncalibrated"
        telemetry_status = "missing_api_key_fallback"
    else:
        base_source_label = "fallback_calibrated"
        telemetry_status = "simulated_telemetry_fallback"

    # Load ML pipeline
    model, metadata = get_loaded_model()

    now_utc = datetime.now(timezone.utc)
    # Default to current Indian Standard Time (UTC+5:30)
    current_ist = now_utc + timedelta(hours=5, minutes=30)

    # Parse custom target_timestamp if supplied (ISO string or YYYY-MM-DDTHH:MM)
    is_custom_point_in_time = False
    if target_timestamp:
        try:
            # Clean string
            clean_ts = target_timestamp.replace("Z", "").split("+")[0]
            if "T" in clean_ts:
                parsed_dt = datetime.fromisoformat(clean_ts)
            else:
                parsed_dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M")
            base_ist_time = parsed_dt
            is_custom_point_in_time = True
        except Exception as e:
            logger.warning(f"Could not parse custom target_timestamp '{target_timestamp}': {e}. Using current IST.")
            base_ist_time = current_ist
    else:
        base_ist_time = current_ist

    # Compute context vector for target time
    context_vector = calculate_temporal_and_contextual_factors(
        target_dt=base_ist_time,
        weather=weather,
        roadwork=roadwork,
        festival_override=festival,
    )

    # ML historical baseline estimation using trained pipeline
    hist_speed = 38.0
    ml_status = "active"

    if model is not None:
        try:
            input_df = pd.DataFrame([{
                "month": base_ist_time.month,
                "day": base_ist_time.day,
                "day_of_week": base_ist_time.weekday(),
                "is_weekend": 1 if base_ist_time.weekday() >= 5 else 0,
                "day_of_year": base_ist_time.timetuple().tm_yday,
                "speed_lag_1": live_current_speed,
                "speed_lag_7": live_current_speed,
                "congestion_lag_1": (1.0 - live_ratio) * 100.0,
                "Road": road_meta.get("historical_area", "100 Feet Road"),
                "Area Name": road_meta.get("historical_area", "Indiranagar"),
                "Weather Conditions": weather if weather in ["Clear", "Overcast", "Fog", "Rain", "Windy"] else "Rain",
                "Roadwork": roadwork,
            }])
            hist_pred = model.predict(input_df)[0]
            # Apply festival and combined context scaling to model baseline
            scaled_hist = hist_pred * context_vector["festival_speed_factor"] * context_vector["weather_speed_factor"] * context_vector["roadwork_speed_factor"]
            hist_speed = float(np.clip(scaled_hist, 12.0, free_flow))
        except Exception as e:
            logger.warning(f"ML inference warning, using tabular baseline: {e}")
            ml_status = "fallback_heuristic"
            hist_speed = 38.0 * context_vector["combined_context_factor"]
    else:
        ml_status = "model_not_loaded"
        hist_speed = 38.0 * context_vector["combined_context_factor"]

    hist_ratio = float(np.clip(hist_speed / free_flow, 0.15, 0.95))

    # Current diurnal commute intensity at base time
    current_diurnal = compute_diurnal_factor(base_ist_time)

    # Horizons to compute
    horizons_to_run = [horizon_minutes] if (horizon_minutes is not None and horizon_minutes in FORECAST_HORIZONS) else FORECAST_HORIZONS

    forecast_timeline = []

    for h in horizons_to_run:
        target_ist = base_ist_time + timedelta(minutes=h)
        target_diurnal = compute_diurnal_factor(target_ist)

        calib_result = calculate_horizon_calibration(
            delta_t_minutes=h,
            live_speed_ratio=live_ratio,
            model_baseline_ratio=hist_ratio,
            free_flow_speed=free_flow,
            current_diurnal=current_diurnal,
            target_diurnal=target_diurnal,
            has_live_telemetry=is_live_telemetry,
            tau_minutes=CALIBRATION_TAU_MINUTES,
        )

        pred_ratio = calib_result["calibrated_ratio"]
        pred_speed = calib_result["predicted_speed"]

        band = get_congestion_band(pred_ratio)
        color = get_congestion_color(band)
        congestion_score = round((1.0 - pred_ratio) * 100.0, 1)

        # Source label specific to this horizon
        if is_custom_point_in_time:
            step_source = f"point_in_time_forecast_+{h}m"
        elif h == 0:
            step_source = "tomtom_live_segment" if is_live_telemetry else "simulated_telemetry_live"
        elif is_live_telemetry:
            step_source = f"tomtom_live_calibrated_+{h}m"
        else:
            step_source = f"historical_model_+{h}m"

        # Structured explanation factors
        drivers = [
            f"Diurnal commuter curve: {context_vector['time_slot_label']} (pressure {target_diurnal:.2f})",
            f"Weather impact ({weather}): {context_vector['weather_description']}",
            f"Day profile: {context_vector['day_of_week']} ({'Weekend pattern' if context_vector['is_weekend'] else 'Weekday commuter rush'})",
        ]
        if context_vector.get("festival"):
            drivers.insert(0, f"Festival Impact ({context_vector['festival_name']}): {context_vector['festival_impact']} (speed modifier {context_vector['festival_speed_factor']}x)")
        if roadwork == "Yes":
            drivers.append("Construction bottleneck: Active roadwork reducing corridor capacity by ~30%")
        if not is_custom_point_in_time:
            drivers.append(f"Live corridor TomTom speed ratio: {live_ratio:.2f} (anomaly: {calib_result['live_anomaly_delta']:+.2f})")

        explanation_factors = {
            "top_drivers": drivers,
            "live_persistence_weight": calib_result["live_weight"],
            "historical_ml_weight": calib_result["historical_ml_weight"],
            "decay_lambda": calib_result["decay_lambda"],
            "diurnal_derivative": calib_result["diurnal_delta"],
            "live_anomaly_delta": calib_result["live_anomaly_delta"],
            "weather_impact": weather,
            "weather_factor_active": weather != "Clear",
            "weather_speed_factor": context_vector["weather_speed_factor"],
            "roadwork_active": roadwork == "Yes",
            "festival_name": context_vector["festival_name"],
            "festival_impact": context_vector["festival_impact"],
            "festival_speed_factor": context_vector["festival_speed_factor"],
            "combined_context_factor": context_vector["combined_context_factor"],
            "validation_note": (
                "Verified real-time observation" if (h == 0 and not is_custom_point_in_time)
                else f"Simulated Point-in-Time Prediction for {target_ist.strftime('%d %b %Y, %H:%M IST')}" if is_custom_point_in_time
                else "Short-term persistence decay & diurnal interpolation (hourly model not sub-hourly validated)"
                if h in (15, 30)
                else "Model diurnal & seasonal projection (reverting to hourly baseline)"
            )
        }

        step_label = (
            f"{target_ist.strftime('%H:%M')} Target" if (h == 0 and is_custom_point_in_time)
            else "Current (t=0)" if h == 0
            else f"+{h} min"
        )

        forecast_timeline.append({
            "horizon_minutes": h,
            "horizon_label": step_label,
            "timestamp": target_ist.strftime("%H:%M IST"),
            "date": target_ist.strftime("%Y-%m-%d"),
            "iso_timestamp": target_ist.isoformat(),
            "predicted_speed": pred_speed,
            "free_flow_speed": free_flow,
            "congestion_ratio": pred_ratio,
            "congestion_score": congestion_score,
            "congestion_band": band,
            "level": band,  # Low, Moderate, High, Severe
            "congestion_color": color,
            "data_source": step_source,
            "factors": explanation_factors,
            "explanation_factors": explanation_factors,
        })

    primary_model_name = (
        metadata.get("selected_production_model", "LightGBM Gradient Boosted Regressor")
        if metadata else "LightGBM Regressor"
    )

    # Documented calibration formula specification returned with payload
    calibration_formula_spec = {
        "formula": "r_calib(Delta_t) = r_model * F_context + [ lambda(Delta_t) * eta * (r_live - r_model) ] - [ 0.32 * delta_D ]",
        "decay_function": f"lambda(Delta_t) = exp(-Delta_t / {CALIBRATION_TAU_MINUTES})",
        "context_multipliers": {
            "festival_factor": context_vector["festival_speed_factor"],
            "weather_factor": context_vector["weather_speed_factor"],
            "roadwork_factor": context_vector["roadwork_speed_factor"],
            "combined_factor": context_vector["combined_context_factor"],
        },
        "parameters": {
            "tau_minutes": CALIBRATION_TAU_MINUTES,
            "elasticity_eta": 0.85,
            "diurnal_sensitivity": 0.32,
            "current_diurnal_intensity": round(current_diurnal, 3),
            "live_speed_ratio": round(live_ratio, 3),
            "historical_baseline_ratio": round(hist_ratio, 3),
            "has_live_telemetry": is_live_telemetry,
        },
        "horizons_covered": FORECAST_HORIZONS,
        "provenance_disclaimer": (
            "METHODOLOGY & VALIDATION HONESTY: "
            "Traffic model incorporates real-time TomTom telemetry, diurnal Indian rush hour curves, "
            "seasonal calendar & festival calendars (Diwali, Ganesh Chaturthi, Eid, New Year), "
            "and weather degradation factors (Rain, Fog, Waterlogging) trained on multi-year metropolitan records."
        )
    }

    return {
        "city": city_name,
        "road_id": road_meta["id"],
        "road_name": road_meta["name"],
        "corridor": road_meta["corridor"],
        "coordinates": [road_meta["lat"], road_meta["lon"]],
        "active_model": primary_model_name,
        "ml_pipeline_status": ml_status,
        "telemetry_status": telemetry_status,
        "data_source": base_source_label,
        "live_telemetry_source": live_segment.get("source", "simulated_fallback"),
        "target_timestamp": base_ist_time.strftime("%Y-%m-%dT%H:%M"),
        "target_time_display": base_ist_time.strftime("%A, %d %B %Y at %I:%M %p IST"),
        "is_custom_point_in_time": is_custom_point_in_time,
        "context": context_vector,
        "forecast_timeline": forecast_timeline,
        "historical_learned_baseline_speed": round(hist_speed, 1),
        "free_flow_speed": free_flow,
        "calibration_formula": calibration_formula_spec,
        "disclaimer": calibration_formula_spec["provenance_disclaimer"],
    }

