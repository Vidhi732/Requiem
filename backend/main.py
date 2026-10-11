import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.config import (
    CITIES,
    METADATA_PATH,
    DATA_PATH,
    TOMTOM_API_KEY,
    GEMINI_API_KEY,
    get_tomtom_api_key,
    BENGALURU_CENTER,
    MUMBAI_CENTER,
    PUNE_CENTER,
    DELHI_CENTER,
)
from backend.tomtom_service import get_city_live_traffic, fetch_flow_segment, get_congestion_band
from backend.forecast_service import generate_road_forecast, get_loaded_model
from backend.calibration_service import run_cross_city_calibration
from backend.cascade_service import simulate_cascade_propagation, PROPAGATION_GRAPH
from backend.green_wave_service import simulate_green_wave
from backend.route_service import compare_corridor_routes, calculate_custom_point_to_point, CORRIDOR_ROUTES, search_places
from backend.assistant_service import answer_traffic_query
from backend.emission_service import compute_micro_segment_emissions
from backend.train_model import train_models
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("trafficpulse_api")

app = FastAPI(
    title="TrafficPulse AI — Indian Traffic Forecasting & Smart Mobility API",
    description="Full-stack ML traffic forecasting and smart mobility intelligence engine for Indian cities.",
    version="1.0.0"
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Models
class ForecastRequest(BaseModel):
    city: str = Field(default="Bengaluru", description="Indian city name")
    road_id: str = Field(default="blr_silk_board", description="Corridor identifier")
    weather: Optional[str] = Field(default="Clear", description="Weather condition (Clear, Rain, Fog, Overcast, Windy, Heavy Rain)")
    roadwork: Optional[str] = Field(default="No", description="Active construction (Yes/No)")
    horizon: Optional[int] = Field(default=None, description="Optional single horizon in minutes (0, 15, 30, 60); if omitted returns all 4")
    target_timestamp: Optional[str] = Field(default=None, description="Specific date & time to predict traffic (ISO format YYYY-MM-DDTHH:MM)")
    festival: Optional[str] = Field(default=None, description="Festival name or scenario (e.g. Diwali, Ganesh Chaturthi, Eid, New Year)")



class CalibrationRequest(BaseModel):
    source_city: str = Field(default="Bengaluru")
    target_city: str = Field(default="Mumbai")
    calibration_elasticity: Optional[float] = Field(default=0.55, ge=0.1, le=1.0)


class CascadeRequest(BaseModel):
    epicenter_node_id: str = Field(default="blr_silk_board")
    incident_severity: float = Field(default=0.80, ge=0.1, le=1.0)


class GreenWaveRequest(BaseModel):
    city: str = Field(default="Bengaluru")
    road_id: str = Field(default="blr_silk_board")
    enable_adaptive_signals: bool = Field(default=True)
    green_split_adjustment_pct: int = Field(default=25, ge=5, le=60)


class AssistantRequest(BaseModel):
    query: str
    context: Dict[str, Any] = Field(default_factory=dict)


class RouteCalculationRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    origin_label: Optional[str] = "Origin Point"
    dest_label: Optional[str] = "Destination Point"
    origin_city: Optional[str] = ""
    dest_city: Optional[str] = ""


# Endpoints

@app.get("/api/health")
def get_health():
    """Health check endpoint indicating model and API integration readiness."""
    model_loaded = False
    metadata_exists = METADATA_PATH.exists()
    try:
        model, _ = get_loaded_model()
        model_loaded = model is not None
    except Exception:
        pass

    current_tomtom_key = get_tomtom_api_key()
    return {
        "status": "online",
        "service": "TrafficPulse AI Core Backend",
        "model_loaded": model_loaded,
        "metadata_available": metadata_exists,
        "tomtom_api_configured": bool(current_tomtom_key),
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "supported_cities": list(CITIES.keys()),
    }


@app.get("/api/cities")
def get_cities():
    """Returns available Indian cities with coordinate centers and road segment manifests."""
    cities_summary = []
    for city_key, city_obj in CITIES.items():
        cities_summary.append({
            "id": city_key,
            "name": city_obj["name"],
            "state": city_obj["state"],
            "center": city_obj["center"],
            "roads_count": len(city_obj["roads"]),
            "roads": city_obj["roads"],
        })
    return {"cities": cities_summary}


@app.get("/api/config/coordinates")
def get_configured_coordinates():
    """
    Returns active configurable coordinates for Bengaluru, Mumbai, Pune, and Delhi.
    Supports environment variable overrides (BENGALURU_COORDS, MUMBAI_COORDS, etc.).
    """
    city_coords = {}
    for city_name in ["Bengaluru", "Mumbai", "Pune", "Delhi"]:
        if city_name in CITIES:
            c = CITIES[city_name]
            city_coords[city_name] = {
                "center": c["center"],
                "roads": [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "corridor": r.get("corridor", ""),
                        "lat": r["lat"],
                        "lon": r["lon"],
                        "free_flow_speed": r.get("free_flow_speed", 45.0)
                    }
                    for r in c["roads"]
                ]
            }

    return {
        "status": "success",
        "configurable_cities": city_coords,
        "env_variables": {
            "Bengaluru": "BENGALURU_COORDS (format: lat,lon)",
            "Mumbai": "MUMBAI_COORDS (format: lat,lon)",
            "Pune": "PUNE_COORDS (format: lat,lon)",
            "Delhi": "DELHI_COORDS (format: lat,lon)",
        }
    }


@app.get("/api/traffic/flow-segment")
def get_flow_segment_telemetry(
    lat: float = Query(..., description="Latitude of segment coordinate"),
    lon: float = Query(..., description="Longitude of segment coordinate"),
    allow_fallback: bool = Query(True, description="Fall back gracefully to deterministic telemetry if live API fails"),
    skip_cache: bool = Query(False, description="Bypass in-memory cache to force a fresh API probe")
):
    """
    Direct endpoint for TomTom Flow Segment Data API.
    Returns:
    currentSpeed, freeFlowSpeed, congestion ratio, level, confidence, timestamp, source,
    and handles errors & unsupported road segments gracefully.
    """
    telemetry = fetch_flow_segment(
        lat=lat,
        lon=lon,
        allow_fallback=allow_fallback,
        skip_cache=skip_cache
    )

    if not allow_fallback and telemetry.get("status") in (
        "unsupported_segment", "invalid_coordinates", "missing_key", "auth_error", "rate_limit", "error", "network_error"
    ):
        status_code = 404 if telemetry.get("status") == "unsupported_segment" else (telemetry.get("http_status") or 400)
        raise HTTPException(status_code=status_code, detail=telemetry)

    return telemetry


@app.get("/api/traffic/live")
def get_live_traffic(city: str = Query("Bengaluru", description="Target Indian city")):
    """Fetches real-time TomTom segment telemetry for all configured road corridors in the city."""
    if city not in CITIES:
        raise HTTPException(status_code=404, detail=f"City '{city}' not supported.")
    try:
        return get_city_live_traffic(city)
    except Exception as e:
        logger.error(f"Error fetching live traffic for {city}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tomtom/diagnostics")
def get_tomtom_diagnostics():
    """
    Diagnostic endpoint testing live TomTom API reachability across configured Indian cities.
    Distinguishes live API responses from fallback/failure responses, verifies unsupported segment handling,
    and exposes raw flow attributes without exposing the API key.
    """
    active_key = get_tomtom_api_key()
    key_configured = bool(active_key)
    city_probes = {}
    total_segments_tested = 0
    live_successful_count = 0
    fallback_count = 0

    for city_name in ["Bengaluru", "Mumbai", "Pune", "Delhi"]:
        city_data = CITIES.get(city_name)
        if not city_data or not city_data["roads"]:
            continue

        # Test first road segment in each city (fresh probe, bypass cache)
        first_road = city_data["roads"][0]
        telemetry = fetch_flow_segment(first_road["lat"], first_road["lon"], skip_cache=True)
        total_segments_tested += 1

        is_live = (telemetry.get("source") == "tomtom_api" or telemetry.get("data_source") == "live_tomtom_api")
        if is_live:
            live_successful_count += 1
        else:
            fallback_count += 1

        city_probes[city_name] = {
            "tested_corridor": first_road["name"],
            "coordinates": [first_road["lat"], first_road["lon"]],
            "source": telemetry.get("source", "simulated_fallback"),
            "data_source": telemetry.get("data_source"),
            "status": telemetry.get("status"),
            "currentSpeed": telemetry.get("currentSpeed", telemetry.get("current_speed")),
            "freeFlowSpeed": telemetry.get("freeFlowSpeed", telemetry.get("free_flow_speed")),
            "current_speed": telemetry.get("current_speed"),
            "free_flow_speed": telemetry.get("free_flow_speed"),
            "congestion_ratio": telemetry.get("congestion_ratio"),
            "congestionRatio": telemetry.get("congestionRatio", telemetry.get("congestion_ratio")),
            "level": telemetry.get("level") or telemetry.get("congestion_band"),
            "congestion_band": telemetry.get("congestion_band"),
            "confidence": telemetry.get("confidence"),
            "road_closure": telemetry.get("road_closure"),
            "is_live_api": is_live,
            "fallback_reason": telemetry.get("fallback_reason"),
            "error_type": telemetry.get("error_type"),
            "http_status": telemetry.get("http_status"),
            "timestamp": telemetry.get("timestamp"),
            "api_endpoint": "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
        }

    # Probe deliberate unsupported road segment (0.0, 0.0) without fallback to verify error handling
    unsupported_test = fetch_flow_segment(0.0, 0.0, allow_fallback=False, skip_cache=True)

    # Securely masked preview of the key (never returns the full key)
    if key_configured:
        key_preview = f"{active_key[:4]}...{active_key[-4:]}" if len(active_key) >= 8 else "configured (masked)"
    else:
        key_preview = "not_configured"

    return {
        "api_key_configured": key_configured,
        "key_preview": key_preview,
        "total_probes": total_segments_tested,
        "live_api_successes": live_successful_count,
        "fallbacks_active": fallback_count,
        "system_status": "LIVE_TOMTOM_OPERATIONAL" if live_successful_count > 0 else "FALLBACK_CALIBRATION_ACTIVE",
        "city_diagnostics": city_probes,
        "unsupported_segment_test": {
            "test_coordinate": [0.0, 0.0],
            "handled_correctly": unsupported_test.get("status") in ("unsupported_segment", "missing_key", "auth_error", "rate_limit", "error", "bad_request"),
            "result_status": unsupported_test.get("status"),
            "result_message": unsupported_test.get("message"),
        },
        "documentation": "https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data",
    }


@app.post("/api/forecast")
def post_forecast(req: ForecastRequest):
    """Produces multi-horizon (+0m, +15m, +30m, +60m) or point-in-time congestion forecasts."""
    try:
        return generate_road_forecast(
            city_name=req.city,
            road_id=req.road_id,
            weather=req.weather or "Clear",
            roadwork=req.roadwork or "No",
            horizon_minutes=req.horizon,
            target_timestamp=req.target_timestamp,
            festival=req.festival,
        )
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history")
def get_historical_trends(road: Optional[str] = None, limit: int = 40):
    """
    Returns verified Bengaluru historical traffic patterns, day-of-week averages,
    and weather impact statistics from the source dataset.
    """
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="Bengaluru historical dataset not found.")

    try:
        df = pd.read_csv(DATA_PATH)
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df = df.dropna(subset=["Date"])

        if road and road in df["Road/Intersection Name"].values:
            subset = df[df["Road/Intersection Name"] == road].sort_values("Date").tail(limit)
        else:
            subset = df[df["Road/Intersection Name"] == "100 Feet Road"].sort_values("Date").tail(limit)

        recent_trends = []
        for _, row in subset.iterrows():
            recent_trends.append({
                "date": str(row["Date"].date()),
                "speed": round(float(row["Average Speed"]), 1),
                "volume": int(row["Traffic Volume"]),
                "congestion": round(float(row["Congestion Level"]), 1),
                "weather": str(row.get("Weather Conditions", "Clear")),
            })

        # Day-of-week profile across entire dataset
        df["day_name"] = df["Date"].dt.day_name()
        dow_profile = df.groupby("day_name")[["Average Speed", "Traffic Volume"]].mean().reset_index()
        days_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        dow_profile["sort_order"] = dow_profile["day_name"].apply(lambda x: days_order.index(x) if x in days_order else 99)
        dow_profile = dow_profile.sort_values("sort_order")

        dow_summary = [
            {
                "day": r["day_name"],
                "avg_speed": round(float(r["Average Speed"]), 1),
                "avg_volume": int(r["Traffic Volume"]),
            }
            for _, r in dow_profile.iterrows()
        ]

        return {
            "source": "Bengaluru Historical Traffic Dataset",
            "road_name": road or "100 Feet Road",
            "recent_series": recent_trends,
            "day_of_week_profile": dow_summary,
            "total_records": len(df),
        }
    except Exception as e:
        logger.error(f"Error reading historical data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model/metadata")
def get_model_metadata():
    """Returns model architecture status, training scores (MAE/RMSE), and feature importances."""
    if not METADATA_PATH.exists():
        raise HTTPException(status_code=404, detail="Model metadata not yet generated.")
    try:
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calibration")
def post_calibration(req: CalibrationRequest):
    """Executes transparent cross-city domain calibration between source and target cities."""
    try:
        return run_cross_city_calibration(
            source_city=req.source_city,
            target_city=req.target_city,
            calibration_elasticity=req.calibration_elasticity or 0.55
        )
    except Exception as e:
        logger.error(f"Calibration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/cascade")
def post_cascade_simulation(req: CascadeRequest):
    """Simulates shockwave cascade propagation across connected urban road network corridors."""
    try:
        return simulate_cascade_propagation(
            epicenter_node_id=req.epicenter_node_id,
            incident_severity=req.incident_severity
        )
    except Exception as e:
        logger.error(f"Cascade simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/graph")
def get_cascade_graph():
    """Returns static network graph topology of Bengaluru corridors for visual inspection."""
    return PROPAGATION_GRAPH


@app.post("/api/simulation/green-wave")
def post_green_wave_simulation(req: GreenWaveRequest):
    """Simulates dynamic Green Wave adaptive signal optimization outcomes."""
    try:
        return simulate_green_wave(
            city_name=req.city,
            road_id=req.road_id,
            enable_adaptive_signals=req.enable_adaptive_signals,
            green_split_adjustment_pct=req.green_split_adjustment_pct
        )
    except Exception as e:
        logger.error(f"Green wave error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/routes/comparison")
def get_route_comparison(corridor_id: str = Query("intercity_mumbai_to_pune")):
    """Compares alternative routes across travel time, delays, carbon emissions, and highway coordinates."""
    try:
        return compare_corridor_routes(corridor_id)
    except Exception as e:
        logger.error(f"Route comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/routes/calculate")
def post_calculate_route(req: RouteCalculationRequest):
    """
    Calculates precise road distance, live travel time, traffic delays, polyline coordinates,
    and multi-horizon AI predictions between ANY two cities or locations in India.
    """
    try:
        return calculate_custom_point_to_point(
            origin_lat=req.origin_lat,
            origin_lon=req.origin_lon,
            dest_lat=req.dest_lat,
            dest_lon=req.dest_lon,
            origin_label=req.origin_label or "Origin",
            dest_label=req.dest_label or "Destination",
            origin_city=req.origin_city or "",
            dest_city=req.dest_city or ""
        )
    except Exception as e:
        logger.error(f"Custom route calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/emissions/micro")
def get_micro_emissions(
    lat: float = Query(..., description="Latitude of target micro-location"),
    lon: float = Query(..., description="Longitude of target micro-location"),
    length_km: float = Query(1.0, ge=0.1, le=25.0, description="Segment or corridor radius length in km"),
    name: Optional[str] = Query(None, description="Location or junction label"),
    city: Optional[str] = Query(None, description="City name"),
    target_timestamp: Optional[str] = Query(None, description="Target time (ISO string or YYYY-MM-DDTHH:MM)"),
    weather: str = Query("Clear", description="Weather condition (Clear, Rain, Fog, Overcast, Windy)")
):
    """
    Computes micro-level hourly carbon emissions (kg CO2), excess idling emissions,
    estimated active vehicle density (veh/hr), and road capacity overload status
    for ANY micro-location, street, or intersection in ANY city in India.
    """
    target_dt = None
    if target_timestamp:
        try:
            clean_ts = target_timestamp.replace("Z", "").split("+")[0]
            if "T" in clean_ts:
                target_dt = datetime.fromisoformat(clean_ts)
            else:
                target_dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M")
        except Exception:
            target_dt = None

    try:
        lat_val = float(getattr(lat, "default", lat))
        lon_val = float(getattr(lon, "default", lon))
        len_val = float(getattr(length_km, "default", length_km))
        w_val = str(getattr(weather, "default", weather)) if weather else "Clear"
        name_val = str(getattr(name, "default", name)) if name is not None else None
        city_val = str(getattr(city, "default", city)) if city is not None else None

        return compute_micro_segment_emissions(
            lat=lat_val,
            lon=lon_val,
            segment_length_km=len_val,
            location_name=name_val,
            city_hint=city_val,
            target_dt=target_dt,
            weather=w_val
        )
    except Exception as e:
        logger.error(f"Micro emission calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/routes/catalog")
def get_routes_catalog():
    """Returns catalog of all supported inter-city expressways and intra-city corridors."""
    catalog = []
    for k, v in CORRIDOR_ROUTES.items():
        catalog.append({
            "id": k,
            "title": v["title"],
            "corridor_type": v.get("corridor_type", "intercity"),
            "origin_city": v.get("origin_city", ""),
            "dest_city": v.get("dest_city", ""),
            "origin": v.get("origin", ""),
            "destination": v.get("destination", ""),
            "origin_coords": v.get("origin_coords"),
            "dest_coords": v.get("dest_coords"),
            "routes_count": len(v.get("routes", [])),
        })
@app.get("/api/places/search")
def get_place_search(
    query: str = Query("", description="Place, street, station, or landmark name to search"),
    limit: int = Query(6, ge=1, le=15),
    country_set: str = Query("IN", description="ISO country code")
):
    """
    TomTom Places Fuzzy Search & Autocomplete API for precise micro-locations,
    railway stations, highway junctions, colleges, IT parks, and streets across India.
    """
    # Safeguard if called directly in python tests
    q_str = str(query) if isinstance(query, str) else str(getattr(query, "default", ""))
    c_set = str(country_set) if isinstance(country_set, str) else "IN"
    l_val = int(limit) if isinstance(limit, int) else 6

    if not q_str or len(q_str.strip()) < 2:
        return {"query": q_str, "results": [], "count": 0}

    try:
        results = search_places(query=q_str.strip(), limit=l_val, country_set=c_set)
        return {"query": q_str, "results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Place search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/assistant")
def post_assistant_query(req: AssistantRequest):
    """Conversational traffic intelligence assistant grounded in current forecast and telemetry JSON."""
    try:
        return answer_traffic_query(req.query, req.context)
    except Exception as e:
        logger.error(f"Assistant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dataset/provenance")
def get_dataset_provenance():
    """
    Returns exact provenance, columns, timestamp coverage, missing values,
    and target information for the Bengaluru traffic dataset.
    """
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Local dataset not found. Use POST /api/dataset/upload to supply a CSV."
        )

    try:
        df = pd.read_csv(DATA_PATH)
        df["Date_parsed"] = pd.to_datetime(df["Date"], errors="coerce")

        null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
        dtypes = {col: str(df[col].dtype) for col in df.columns}

        return {
            "source_repository": "https://github.com/Shrihari-I-B/bengaluru-traffic-prediction",
            "raw_url": "https://raw.githubusercontent.com/Shrihari-I-B/bengaluru-traffic-prediction/main/Banglore_traffic_Dataset.csv",
            "file_size_bytes": DATA_PATH.stat().st_size,
            "total_rows": len(df),
            "total_columns": len(df.columns) - 1,  # excluding Date_parsed
            "columns": [c for c in df.columns if c != "Date_parsed"],
            "column_data_types": dtypes,
            "missing_values_count": null_counts,
            "total_null_records": sum(null_counts.values()),
            "timestamp_coverage": {
                "min_date": str(df["Date_parsed"].min().date()),
                "max_date": str(df["Date_parsed"].max().date()),
                "total_calendar_days": int((df["Date_parsed"].max() - df["Date_parsed"].min()).days + 1),
                "unique_dates": int(df["Date_parsed"].nunique()),
                "granularity": "Daily (YYYY-MM-DD)",
                "sub_hourly_available": False,
            },
            "corridors_monitored": {
                "areas_count": int(df["Area Name"].nunique()),
                "areas": sorted(df["Area Name"].unique().tolist()),
                "roads_count": int(df["Road/Intersection Name"].nunique()),
                "roads": sorted(df["Road/Intersection Name"].unique().tolist()),
            },
            "target_statistics": {
                "Average Speed (km/h)": {
                    "min": float(df["Average Speed"].min()),
                    "max": float(df["Average Speed"].max()),
                    "mean": round(float(df["Average Speed"].mean()), 2),
                    "std": round(float(df["Average Speed"].std()), 2),
                },
                "Traffic Volume": {
                    "min": int(df["Traffic Volume"].min()),
                    "max": int(df["Traffic Volume"].max()),
                    "mean": round(float(df["Traffic Volume"].mean()), 2),
                    "std": round(float(df["Traffic Volume"].std()), 2),
                },
                "Congestion Level": {
                    "min": float(df["Congestion Level"].min()),
                    "max": float(df["Congestion Level"].max()),
                    "mean": round(float(df["Congestion Level"].mean()), 2),
                    "std": round(float(df["Congestion Level"].std()), 2),
                }
            },
            "provenance_assessment": (
                "Verified open repository dataset containing daily aggregate observations "
                "across 16 Bengaluru urban corridors (2022-01-01 to 2024-08-09). Zero missing values. "
                "Sub-hourly horizons (+15m, +30m) require fusing live TomTom telemetry with "
                "the model's learned seasonal expectations."
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Allows uploading an alternative or updated traffic CSV dataset and validates schema."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    try:
        # Validate that it parses as CSV and has required columns
        import io
        test_df = pd.read_csv(io.BytesIO(content))
        required = ["Date", "Road/Intersection Name", "Average Speed"]
        missing = [c for c in required if c not in test_df.columns]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded CSV is missing mandatory columns: {missing}"
            )

        # Write to DATA_PATH
        with open(DATA_PATH, "wb") as f:
            f.write(content)

        # Retrain models
        new_metadata = train_models()

        return {
            "status": "success",
            "message": f"Dataset '{file.filename}' uploaded successfully with {len(test_df)} records.",
            "metadata": new_metadata
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded dataset: {str(e)}")


@app.post("/api/dataset/train")
def retrain_pipeline():
    """Triggers ML training pipeline on the currently loaded dataset."""
    try:
        meta = train_models()
        return {"status": "success", "metadata": meta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

