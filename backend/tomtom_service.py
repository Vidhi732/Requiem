import time
import logging
from typing import Dict, Any, List, Optional
import httpx
from datetime import datetime, timezone

from backend.config import get_tomtom_api_key, CITIES

logger = logging.getLogger(__name__)

# In-memory short TTL cache to avoid redundant calls within 30 seconds
_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 30


def get_congestion_band(ratio: float) -> str:
    """Classifies congestion ratio into documented bands."""
    if ratio >= 0.80:
        return "Low"
    elif ratio >= 0.60:
        return "Moderate"
    elif ratio >= 0.35:
        return "High"
    else:
        return "Severe"


def get_congestion_color(band: str) -> str:
    colors = {
        "Low": "#10b981",       # Emerald green
        "Moderate": "#f59e0b",  # Amber yellow
        "High": "#f97316",      # Orange
        "Severe": "#ef4444",    # Crimson red
    }
    return colors.get(band, "#94a3b8")


def fetch_flow_segment(
    lat: float,
    lon: float,
    api_key: Optional[str] = None,
    allow_fallback: bool = True,
    skip_cache: bool = False
) -> Dict[str, Any]:
    """
    Calls the TomTom Flow Segment Data API:
    https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
    
    Returns currentSpeed, freeFlowSpeed, congestion ratio, level, confidence,
    timestamp, source, and detailed telemetry.
    Gracefully handles unsupported road segments and TomTom errors.
    """
    # Coordinate range validation
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        err_msg = f"Coordinates out of bounds: lat={lat}, lon={lon}. Valid ranges: lat [-90, 90], lon [-180, 180]."
        if not allow_fallback:
            return {
                "status": "error",
                "error_type": "invalid_coordinates",
                "message": err_msg,
                "is_live": False,
                "source": "error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return _generate_demonstration_segment(lat, lon, reason=err_msg, error_type="invalid_coordinates")

    key = api_key or get_tomtom_api_key()
    cache_key = f"{lat:.4f}_{lon:.4f}"
    now_ts = time.time()

    if not skip_cache and cache_key in _CACHE:
        cached_entry, exp = _CACHE[cache_key]
        if now_ts < exp:
            cached_copy = dict(cached_entry)
            cached_copy["is_cached"] = True
            return cached_copy

    if not key:
        reason = "TOMTOM_API_KEY is not configured in backend .env"
        if not allow_fallback:
            return {
                "status": "missing_key",
                "error_type": "missing_key",
                "message": reason,
                "is_live": False,
                "source": "unconfigured",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return _generate_demonstration_segment(lat, lon, reason=reason, error_type="missing_key")

    endpoint = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
    params = {
        "point": f"{lat},{lon}",
        "unit": "KMPH",
        "key": key
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(endpoint, params=params)

            if resp.status_code == 200:
                data = resp.json()
                flow = data.get("flowSegmentData", {})

                if not flow:
                    reason = f"No road segment flow data returned near ({lat}, {lon}) (unsupported road segment)."
                    if not allow_fallback:
                        return {
                            "status": "unsupported_segment",
                            "error_type": "unsupported_segment",
                            "message": reason,
                            "http_status": 200,
                            "is_live": False,
                            "source": "tomtom_api",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    return _generate_demonstration_segment(lat, lon, reason=reason, error_type="unsupported_segment", http_status=200)

                current_speed = float(flow.get("currentSpeed", 35.0))
                free_flow_speed = float(flow.get("freeFlowSpeed", max(current_speed, 45.0)))
                
                # Prevent zero division
                if free_flow_speed <= 0:
                    free_flow_speed = 40.0
                
                ratio = round(current_speed / free_flow_speed, 3)
                band = get_congestion_band(ratio)
                confidence = float(flow.get("confidence", 0.95))
                road_closure = bool(flow.get("roadClosure", False))
                coords = flow.get("coordinates", {}).get("coordinate", [])
                frc = str(flow.get("frc", ""))
                current_travel_time = flow.get("currentTravelTime")
                free_flow_travel_time = flow.get("freeFlowTravelTime")
                ts = datetime.now(timezone.utc).isoformat()

                result = {
                    # Explicit requested return keys
                    "currentSpeed": current_speed,
                    "freeFlowSpeed": free_flow_speed,
                    "congestion_ratio": ratio,
                    "congestionRatio": ratio,
                    "level": band,
                    "confidence": confidence,
                    "timestamp": ts,
                    "source": "tomtom_api",

                    # Backward compatibility and additional rich telemetry
                    "current_speed": current_speed,
                    "free_flow_speed": free_flow_speed,
                    "congestion_band": band,
                    "congestion_level": band,
                    "congestion_color": get_congestion_color(band),
                    "road_closure": road_closure,
                    "roadClosure": road_closure,
                    "frc": frc,
                    "currentTravelTime": current_travel_time,
                    "freeFlowTravelTime": free_flow_travel_time,
                    "coordinates": coords,
                    "data_source": "live_tomtom_api",
                    "status": "success",
                    "is_live": True,
                    "is_cached": False,
                    "raw_flow": flow,
                    "api_disclaimer": "TomTom real-time traffic for the nearest indexed road segment.",
                }
                _CACHE[cache_key] = (result, now_ts + CACHE_TTL_SECONDS)
                return result

            elif resp.status_code == 404:
                reason = f"Unsupported road segment: No indexed road found near coordinates ({lat}, {lon}) (HTTP 404)."
                logger.warning(reason)
                if not allow_fallback:
                    return {
                        "status": "unsupported_segment",
                        "error_type": "unsupported_segment",
                        "message": reason,
                        "http_status": 404,
                        "is_live": False,
                        "source": "tomtom_api_error",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                return _generate_demonstration_segment(lat, lon, reason=reason, error_type="unsupported_segment", http_status=404)

            elif resp.status_code in (401, 403):
                reason = f"TomTom API authorization failed ({resp.status_code}): Invalid or unapproved API key."
                logger.warning(reason)
                if not allow_fallback:
                    return {
                        "status": "auth_error",
                        "error_type": "auth_error",
                        "message": reason,
                        "http_status": resp.status_code,
                        "is_live": False,
                        "source": "tomtom_api_error",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                return _generate_demonstration_segment(lat, lon, reason=reason, error_type="auth_error", http_status=resp.status_code)

            elif resp.status_code == 429:
                reason = "TomTom API rate limit reached (HTTP 429)."
                logger.warning(reason)
                if not allow_fallback:
                    return {
                        "status": "rate_limit",
                        "error_type": "rate_limit",
                        "message": reason,
                        "http_status": 429,
                        "is_live": False,
                        "source": "tomtom_api_error",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                return _generate_demonstration_segment(lat, lon, reason=reason, error_type="rate_limit", http_status=429)

            elif resp.status_code == 400:
                reason = f"TomTom API Bad Request (HTTP 400): Malformed coordinate or parameter ({resp.text[:120]})."
                logger.warning(reason)
                if not allow_fallback:
                    return {
                        "status": "error",
                        "error_type": "bad_request",
                        "message": reason,
                        "http_status": 400,
                        "is_live": False,
                        "source": "tomtom_api_error",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                return _generate_demonstration_segment(lat, lon, reason=reason, error_type="bad_request", http_status=400)

            else:
                reason = f"TomTom API returned HTTP {resp.status_code}: {resp.text[:120]}"
                logger.warning(reason)
                if not allow_fallback:
                    return {
                        "status": "error",
                        "error_type": "api_error",
                        "message": reason,
                        "http_status": resp.status_code,
                        "is_live": False,
                        "source": "tomtom_api_error",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                return _generate_demonstration_segment(lat, lon, reason=reason, error_type="api_error", http_status=resp.status_code)

    except httpx.TimeoutException:
        reason = "TomTom API request timed out (connection exceeded 8s)."
        logger.error(reason)
        if not allow_fallback:
            return {
                "status": "timeout",
                "error_type": "timeout",
                "message": reason,
                "is_live": False,
                "source": "network_error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return _generate_demonstration_segment(lat, lon, reason=reason, error_type="timeout")

    except Exception as e:
        reason = f"TomTom API network or connection error: {str(e)}"
        logger.error(reason)
        if not allow_fallback:
            return {
                "status": "network_error",
                "error_type": "network_error",
                "message": reason,
                "is_live": False,
                "source": "network_error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return _generate_demonstration_segment(lat, lon, reason=reason, error_type="network_error")


def _generate_demonstration_segment(
    lat: float,
    lon: float,
    reason: str,
    error_type: Optional[str] = None,
    http_status: Optional[int] = None
) -> Dict[str, Any]:
    """
    Transparently supplies deterministic demonstration fallback observations when live API is unavailable.
    Never fabricates or masks fallback data as live API data.
    """
    # Deterministic simulation based on location hash and time of day
    now = datetime.now()
    hour = now.hour
    
    # Peak hour diurnal curve: 8-11 AM & 5-9 PM
    is_peak = (8 <= hour <= 11) or (17 <= hour <= 21)
    base_factor = 0.45 if is_peak else 0.78
    
    # Slight deterministic variation based on lat/lon
    loc_var = (abs(hash(f"{lat:.2f}{lon:.2f}")) % 30) / 100.0 - 0.15
    ratio = max(0.20, min(0.98, round(base_factor + loc_var, 3)))
    
    free_flow = 45.0
    current_speed = round(free_flow * ratio, 1)
    band = get_congestion_band(ratio)
    ts = datetime.now(timezone.utc).isoformat()

    return {
        # Explicit requested return keys
        "currentSpeed": current_speed,
        "freeFlowSpeed": free_flow,
        "congestion_ratio": ratio,
        "congestionRatio": ratio,
        "level": band,
        "confidence": 0.85,
        "timestamp": ts,
        "source": "simulated_fallback",

        # Compatibility keys
        "current_speed": current_speed,
        "free_flow_speed": free_flow,
        "congestion_band": band,
        "congestion_level": band,
        "congestion_color": get_congestion_color(band),
        "road_closure": False,
        "roadClosure": False,
        "coordinates": [{"latitude": lat, "longitude": lon}],
        "data_source": "demonstration_simulated",
        "status": "fallback_active",
        "is_live": False,
        "fallback_reason": reason,
        "error_type": error_type,
        "http_status": http_status,
        "is_cached": False,
        "api_disclaimer": "Demonstration mode: Live TomTom traffic API key is unconfigured, unauthorized, or coordinate is an unsupported road segment.",
    }


def get_city_live_traffic(city_name: str) -> Dict[str, Any]:
    """Retrieves live or simulated segment data for all configured corridors in a city."""
    city_data = CITIES.get(city_name)
    if not city_data:
        raise ValueError(f"City '{city_name}' is not supported. Choose from {list(CITIES.keys())}")

    roads_output = []
    has_live = False

    for road in city_data["roads"]:
        segment_info = fetch_flow_segment(road["lat"], road["lon"])
        if segment_info["data_source"] == "live_tomtom_api":
            has_live = True

        road_res = {
            **road,
            **segment_info
        }
        roads_output.append(road_res)

    # City-level aggregated speed and congestion
    avg_speed = sum(r["current_speed"] for r in roads_output) / len(roads_output)
    avg_free_flow = sum(r["free_flow_speed"] for r in roads_output) / len(roads_output)
    overall_ratio = round(avg_speed / avg_free_flow, 3)
    overall_band = get_congestion_band(overall_ratio)

    return {
        "city": city_name,
        "state": city_data["state"],
        "center": city_data["center"],
        "data_source": "live_tomtom_api" if has_live else "demonstration_simulated",
        "roads": roads_output,
        "summary": {
            "average_speed": round(avg_speed, 1),
            "average_free_flow_speed": round(avg_free_flow, 1),
            "congestion_ratio": overall_ratio,
            "congestion_band": overall_band,
            "congestion_color": get_congestion_color(overall_band),
            "monitored_segments": len(roads_output),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
