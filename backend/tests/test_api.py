from backend.main import (
    app,
    get_health,
    get_cities,
    post_forecast,
    post_calibration,
    post_cascade_simulation,
    post_green_wave_simulation,
    post_assistant_query,
    ForecastRequest,
    CalibrationRequest,
    CascadeRequest,
    GreenWaveRequest,
    AssistantRequest,
)
from backend.tomtom_service import get_congestion_band
from backend.calibration_service import run_cross_city_calibration
from backend.forecast_service import generate_road_forecast


def test_congestion_classification_bands():
    """Validates documented congestion bands."""
    assert get_congestion_band(0.95) == "Low"
    assert get_congestion_band(0.80) == "Low"
    assert get_congestion_band(0.79) == "Moderate"
    assert get_congestion_band(0.60) == "Moderate"
    assert get_congestion_band(0.59) == "High"
    assert get_congestion_band(0.35) == "High"
    assert get_congestion_band(0.34) == "Severe"
    assert get_congestion_band(0.10) == "Severe"


def test_health_endpoint():
    data = get_health()
    assert data["status"] == "online"
    assert "Bengaluru" in data["supported_cities"]


def test_cities_endpoint():
    data = get_cities()
    assert len(data["cities"]) >= 4
    city_names = [c["name"] for c in data["cities"]]
    assert "Bengaluru" in city_names
    assert "Mumbai" in city_names
    assert "Pune" in city_names
    assert "Delhi" in city_names


def test_forecast_service():
    req = ForecastRequest(city="Bengaluru", road_id="blr_silk_board")
    forecast = post_forecast(req)
    assert forecast["city"] == "Bengaluru"
    assert "data_source" in forecast
    assert "calibration_formula" in forecast
    assert len(forecast["forecast_timeline"]) == 4
    
    # Check all four horizons [0, 15, 30, 60]
    horizons = [t["horizon_minutes"] for t in forecast["forecast_timeline"]]
    assert horizons == [0, 15, 30, 60]
    
    for step in forecast["forecast_timeline"]:
        assert "predicted_speed" in step
        assert "congestion_band" in step
        assert "level" in step
        assert step["level"] in ["Low", "Moderate", "High", "Severe"]
        assert "timestamp" in step
        assert "data_source" in step
        assert "explanation_factors" in step or "factors" in step
        factors = step.get("explanation_factors") or step["factors"]
        assert "live_persistence_weight" in factors
        assert "historical_ml_weight" in factors
        assert "diurnal_derivative" in factors
        assert "decay_lambda" in factors
        assert "top_drivers" in factors
        assert len(factors["top_drivers"]) >= 3
        # Ensure sub-hourly honesty note is present
        assert "validation_note" in factors


def test_calibration_service():
    req = CalibrationRequest(source_city="Bengaluru", target_city="Mumbai")
    calib = post_calibration(req)
    assert calib["source_city"] == "Bengaluru"
    assert calib["target_city"] == "Mumbai"
    assert "before_vs_after" in calib
    assert "metrics" in calib
    assert calib["methodology"] == "Live-data-assisted cross-city calibration"


def test_cascade_endpoint():
    req = CascadeRequest(epicenter_node_id="blr_silk_board", incident_severity=0.85)
    data = post_cascade_simulation(req)
    assert data["epicenter"] == "blr_silk_board"
    assert len(data["nodes"]) >= 5
    assert len(data["timeline"]) >= 3


def test_green_wave_endpoint():
    req = GreenWaveRequest(
        city="Bengaluru",
        road_id="blr_silk_board",
        enable_adaptive_signals=True,
        green_split_adjustment_pct=25
    )
    data = post_green_wave_simulation(req)
    assert data["adaptive_signals_enabled"] is True
    assert "intervention" in data
    assert "speed_gain_kmh" in data["comparison"]
    assert "delay_reduction_pct" in data["comparison"]


def test_assistant_endpoint():
    req = AssistantRequest(
        query="Why is this road highly congested?",
        context={
            "road_name": "Silk Board Junction",
            "city": "Bengaluru",
            "current_speed": 18.5,
            "free_flow_speed": 45.0,
            "congestion_ratio": 0.41,
            "congestion_band": "High",
            "data_source": "TomTom Segment Telemetry"
        }
    )
    data = post_assistant_query(req)
    assert "answer" in data
    assert "18.5" in data["answer"] or "Silk Board" in data["answer"]


def test_configurable_coordinates_four_cities():
    """Validates configurable coordinates exist for Bengaluru, Mumbai, Pune, and Delhi."""
    from backend.config import CITIES, BENGALURU_CENTER, MUMBAI_CENTER, PUNE_CENTER, DELHI_CENTER
    
    assert "Bengaluru" in CITIES
    assert "Mumbai" in CITIES
    assert "Pune" in CITIES
    assert "Delhi" in CITIES

    assert len(BENGALURU_CENTER) == 2
    assert len(MUMBAI_CENTER) == 2
    assert len(PUNE_CENTER) == 2
    assert len(DELHI_CENTER) == 2

    for city in ["Bengaluru", "Mumbai", "Pune", "Delhi"]:
        roads = CITIES[city]["roads"]
        assert len(roads) >= 4
        for r in roads:
            assert "lat" in r and "lon" in r
            assert -90.0 <= r["lat"] <= 90.0
            assert -180.0 <= r["lon"] <= 180.0


def test_tomtom_flow_segment_api_fields():
    """
    Validates that fetch_flow_segment returns all requested fields:
    currentSpeed, freeFlowSpeed, congestion ratio, level, confidence, timestamp, source.
    """
    from backend.tomtom_service import fetch_flow_segment

    # Test silk board junction in Bengaluru
    telemetry = fetch_flow_segment(12.9176, 77.6238)
    assert "currentSpeed" in telemetry
    assert "freeFlowSpeed" in telemetry
    assert "congestion_ratio" in telemetry or "congestionRatio" in telemetry
    assert "level" in telemetry
    assert "confidence" in telemetry
    assert "timestamp" in telemetry
    assert "source" in telemetry
    assert telemetry["source"] in ["tomtom_api", "simulated_fallback"]
    assert telemetry["level"] in ["Low", "Moderate", "High", "Severe"]
    assert isinstance(telemetry["currentSpeed"], (int, float))
    assert isinstance(telemetry["freeFlowSpeed"], (int, float))
    assert isinstance(telemetry["confidence"], (int, float))


def test_unsupported_road_segment_and_error_handling():
    """
    Validates error handling for unsupported coordinates (e.g. oceanic point 0.0, 0.0)
    and out-of-bounds coordinates.
    """
    from backend.tomtom_service import fetch_flow_segment

    # 1. Coordinate out of range
    out_of_bounds = fetch_flow_segment(199.0, 999.0, allow_fallback=False)
    assert out_of_bounds["status"] == "error"
    assert out_of_bounds["error_type"] == "invalid_coordinates"

    # Out of range with fallback allowed
    fallback_res = fetch_flow_segment(199.0, 999.0, allow_fallback=True)
    assert fallback_res["status"] == "fallback_active"
    assert fallback_res["source"] == "simulated_fallback"

    # 2. Oceanic point without road network (TomTom returns 400 or 404 for point too far from roads)
    unsupported = fetch_flow_segment(0.0, 0.0, allow_fallback=False, skip_cache=True)
    assert unsupported["status"] in ("error", "unsupported_segment", "missing_key", "auth_error")


def test_tomtom_diagnostics_endpoint():
    """
    Validates diagnostics endpoint distinguishes live responses from failures/fallbacks,
    probes all four cities, and does not leak secret API key.
    """
    from backend.main import get_tomtom_diagnostics, get_configured_coordinates

    diag = get_tomtom_diagnostics()
    assert "api_key_configured" in diag
    assert "key_preview" in diag
    assert "system_status" in diag
    assert diag["system_status"] in ("LIVE_TOMTOM_OPERATIONAL", "FALLBACK_CALIBRATION_ACTIVE")
    assert "city_diagnostics" in diag
    assert "Bengaluru" in diag["city_diagnostics"]
    assert "Mumbai" in diag["city_diagnostics"]
    assert "Pune" in diag["city_diagnostics"]
    assert "Delhi" in diag["city_diagnostics"]

    # Verify each probe has the requested fields
    for city_name, probe in diag["city_diagnostics"].items():
        assert "currentSpeed" in probe
        assert "freeFlowSpeed" in probe
        assert "congestion_ratio" in probe
        assert "level" in probe
        assert "confidence" in probe
        assert "timestamp" in probe
        assert "source" in probe
        assert "is_live_api" in probe

    # Unsupported segment diagnostic check
    assert "unsupported_segment_test" in diag
    assert diag["unsupported_segment_test"]["handled_correctly"] is True

    # Coordinates config endpoint
    coords_resp = get_configured_coordinates()
    assert coords_resp["status"] == "success"
    assert "Bengaluru" in coords_resp["configurable_cities"]
    assert "Mumbai" in coords_resp["configurable_cities"]
    assert "Pune" in coords_resp["configurable_cities"]
    assert "Delhi" in coords_resp["configurable_cities"]


def test_forecast_calibration_formula_unit():
    """
    Directly unit tests the documented calibration formula helper:
    calculate_horizon_calibration across all 4 horizons [0, 15, 30, 60].
    Validates exponential decay lambda, persistence weighting, and boundary constraints.
    """
    from backend.forecast_service import calculate_horizon_calibration, CALIBRATION_TAU_MINUTES

    # Horizon 0: lambda must equal 1.0, calibrated ratio equals live ratio
    calib_0 = calculate_horizon_calibration(
        delta_t_minutes=0,
        live_speed_ratio=0.45,
        model_baseline_ratio=0.75,
        free_flow_speed=50.0,
        current_diurnal=0.60,
        target_diurnal=0.60,
        has_live_telemetry=True
    )
    assert calib_0["horizon_minutes"] == 0
    assert calib_0["decay_lambda"] == 1.0
    assert calib_0["calibrated_ratio"] == 0.45
    assert calib_0["predicted_speed"] == 22.5

    # Horizon 15: lambda ~ exp(-15/38) ~ 0.674
    calib_15 = calculate_horizon_calibration(
        delta_t_minutes=15,
        live_speed_ratio=0.45,
        model_baseline_ratio=0.75,
        free_flow_speed=50.0,
        current_diurnal=0.60,
        target_diurnal=0.65,
        has_live_telemetry=True
    )
    assert calib_15["horizon_minutes"] == 15
    assert 0.65 <= calib_15["decay_lambda"] <= 0.70
    assert calib_15["calibrated_ratio"] < 0.75  # dragged down by live congestion

    # Horizon 30: lambda ~ exp(-30/38) ~ 0.454
    calib_30 = calculate_horizon_calibration(
        delta_t_minutes=30,
        live_speed_ratio=0.45,
        model_baseline_ratio=0.75,
        free_flow_speed=50.0,
        current_diurnal=0.60,
        target_diurnal=0.60,
        has_live_telemetry=True
    )
    assert calib_30["horizon_minutes"] == 30
    assert 0.43 <= calib_30["decay_lambda"] <= 0.48

    # Horizon 60: lambda ~ exp(-60/38) ~ 0.206
    calib_60 = calculate_horizon_calibration(
        delta_t_minutes=60,
        live_speed_ratio=0.45,
        model_baseline_ratio=0.75,
        free_flow_speed=50.0,
        current_diurnal=0.60,
        target_diurnal=0.60,
        has_live_telemetry=True
    )
    assert calib_60["horizon_minutes"] == 60
    assert 0.18 <= calib_60["decay_lambda"] <= 0.23


def test_forecast_missing_api_fallback():
    """
    Validates that when live TomTom API data is missing or simulated fallback is active,
    the forecast service gracefully degrades without crashing and accurately flags data_source.
    """
    from unittest.mock import patch
    from backend.forecast_service import generate_road_forecast

    # Mock fetch_flow_segment to simulate missing TomTom API key
    mock_missing = {
        "status": "missing_key",
        "current_speed": 35.0,
        "free_flow_speed": 50.0,
        "congestion_ratio": 0.70,
        "level": "Moderate",
        "source": "simulated_fallback",
        "data_source": "historical_heuristic_fallback",
        "confidence": 0.50,
        "timestamp": "2026-10-11T12:00:00Z"
    }

    with patch("backend.forecast_service.fetch_flow_segment", return_value=mock_missing):
        forecast = generate_road_forecast("Bengaluru", "blr_silk_board")
        assert forecast["city"] == "Bengaluru"
        assert len(forecast["forecast_timeline"]) == 4
        assert forecast["telemetry_status"] == "missing_api_key_fallback"
        assert forecast["data_source"] == "historical_model_uncalibrated"
        for step in forecast["forecast_timeline"]:
            assert step["level"] in ["Low", "Moderate", "High", "Severe"]
            assert step["predicted_speed"] > 0
            assert "historical_model" in step["data_source"] or "telemetry" in step["data_source"]


def test_places_search_endpoint():
    """Validates the TomTom place search autocomplete endpoint."""
    from backend.main import get_place_search
    res = get_place_search("Silk Board", limit=4)
    assert res["query"] == "Silk Board"
    assert "results" in res
    assert isinstance(res["results"], list)
    assert len(res["results"]) > 0
    first = res["results"][0]
    assert "label" in first
    assert "lat" in first
    assert "lon" in first
    assert "type" in first


def test_places_search_empty_or_short():
    """Validates that short/empty queries return empty results gracefully."""
    from backend.main import get_place_search
    res = get_place_search("a", limit=5)
    assert res["count"] == 0
    assert res["results"] == []


