import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta

from backend.config import get_tomtom_api_key
from backend.tomtom_service import fetch_flow_segment, get_congestion_band, get_congestion_color
from backend.forecast_service import compute_diurnal_factor
from backend.temporal_context import WEATHER_MODIFIERS, get_festival_for_date

logger = logging.getLogger(__name__)

# Baseline passenger car emission according to UK DEFRA standard (kg CO2 per km)
BASE_EMISSION_KG_PER_KM = 0.140

# Reference hourly capacity by road classification (vehicles per hour)
ROAD_CAPACITY_PRESETS = {
    "expressway": 4200,      # High-speed multi-lane access controlled corridor
    "arterial": 2400,        # Major city arterial / link road
    "connector": 1300,       # Secondary distributor / sector road
    "local": 750,            # Narrow local street / market alley
}


def classify_road_hierarchy(free_flow_speed: float) -> str:
    """Classifies road type by its free flow speed threshold."""
    if free_flow_speed >= 70.0:
        return "expressway"
    elif free_flow_speed >= 40.0:
        return "arterial"
    elif free_flow_speed >= 25.0:
        return "connector"
    else:
        return "local"


def estimate_hourly_traffic_volume(
    speed_ratio: float,
    road_capacity: int,
    diurnal_pressure: float,
    festival_volume_factor: float = 1.0,
    weather_volume_factor: float = 1.0
) -> int:
    """
    Estimates active vehicular volume (veh/hour) using traffic flow curve:
    Volume peaks near moderate congestion and drops during severe jam/gridlock.
    """
    ratio = max(0.05, min(1.0, speed_ratio))
    # Empirical parabolic density-flow relationship:
    # Near free flow (ratio ~ 1.0): volume is light to moderate
    # Optimal capacity (ratio ~ 0.5 - 0.7): highest vehicle throughput
    # Severe gridlock (ratio < 0.25): vehicle throughput collapses as flow chokes
    if ratio >= 0.70:
        throughput_factor = 0.45 + (1.0 - ratio) * 1.5
    elif ratio >= 0.35:
        throughput_factor = 0.90 + (0.70 - ratio) * 0.25
    else:
        # Severe jam: vehicles are trapped in queue
        throughput_factor = max(0.30, ratio * 2.2)

    raw_volume = road_capacity * throughput_factor * diurnal_pressure * festival_volume_factor * weather_volume_factor
    return int(max(80, round(raw_volume)))


def compute_micro_segment_emissions(
    lat: float,
    lon: float,
    segment_length_km: float = 1.0,
    location_name: Optional[str] = None,
    city_hint: Optional[str] = None,
    target_dt: Optional[datetime] = None,
    weather: str = "Clear"
) -> Dict[str, Any]:
    """
    Computes precise micro-level hourly emissions, active vehicle density,
    and road capacity overload status for ANY given GPS coordinate in any city.
    """
    # 1. Determine target time and diurnal factor
    if target_dt is None:
        target_dt = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30) # IST
    
    diurnal = compute_diurnal_factor(target_dt)
    
    # 2. Check for festival surge
    fest = get_festival_for_date(target_dt.date())
    fest_vol_factor = fest.get("volume_factor", 1.0) if fest else 1.0
    fest_name = fest.get("name", "Standard Calendar Day") if fest else "Normal Day"

    # 3. Weather volume factor (rain slightly dampens non-essential 2-wheelers but increases cab demand)
    weather_info = WEATHER_MODIFIERS.get(weather, WEATHER_MODIFIERS["Clear"])
    weather_speed_mod = weather_info.get("speed_factor", 1.0)

    # 4. Fetch live micro-telemetry from TomTom Flow Segment API
    flow = fetch_flow_segment(lat, lon, allow_fallback=True)
    
    curr_speed = float(flow.get("current_speed") or flow.get("currentSpeed") or 30.0)
    free_speed = float(flow.get("free_flow_speed") or flow.get("freeFlowSpeed") or 45.0)
    
    # Apply weather degradation if simulated or live doesn't already reflect it
    if flow.get("source") != "tomtom_api" and weather != "Clear":
        curr_speed = round(max(10.0, curr_speed * weather_speed_mod), 1)

    speed_ratio = round(max(0.08, min(1.0, curr_speed / max(free_speed, 10.0))), 3)
    band = get_congestion_band(speed_ratio)
    color = get_congestion_color(band)

    # 5. Road hierarchy & capacity
    road_type = classify_road_hierarchy(free_speed)
    road_capacity = ROAD_CAPACITY_PRESETS.get(road_type, 2400)

    # 6. Estimate hourly vehicle count traversing / queued on this micro-segment
    hourly_vehicles = estimate_hourly_traffic_volume(
        speed_ratio=speed_ratio,
        road_capacity=road_capacity,
        diurnal_pressure=diurnal,
        festival_volume_factor=fest_vol_factor
    )

    # 7. Non-linear Congestion Emission Penalty
    # As speed drops and idle time increases, fuel burnt per km escalates
    # Idle & stop-and-go acceleration factor = 1.0 + 1.6 * (1.0 - speed_ratio)^2
    congestion_penalty = round(1.0 + 1.6 * ((1.0 - speed_ratio) ** 2), 3)
    
    emission_rate_g_per_km = round(BASE_EMISSION_KG_PER_KM * 1000.0 * congestion_penalty, 1) # g/km
    free_flow_rate_g_per_km = BASE_EMISSION_KG_PER_KM * 1000.0 # 140 g/km

    # Total emissions over this micro segment for 1 hour
    total_co2_kg = round((hourly_vehicles * segment_length_km * emission_rate_g_per_km) / 1000.0, 2)
    optimal_co2_kg = round((hourly_vehicles * segment_length_km * free_flow_rate_g_per_km) / 1000.0, 2)
    excess_co2_kg = round(max(0.0, total_co2_kg - optimal_co2_kg), 2)
    
    # Fuel wasted (2.31 kg CO2 per litre of standard petrol/diesel)
    fuel_wasted_litres = round(excess_co2_kg / 2.31, 2)

    # 8. Capacity Utilization and Overload Status
    utilization_pct = round((hourly_vehicles / float(road_capacity)) * 100.0, 1)
    
    # Diagnostic vehicle overload classification
    if speed_ratio <= 0.28 and utilization_pct >= 85.0:
        overload_status = "CRITICAL_GRIDLOCK_OVERLOAD"
        overload_label = "Critical Vehicle Overload (Severe Choke)"
        overload_severity = "severe"
        recommendation = "Immediate traffic diversion and adaptive green-wave signal clearance required."
    elif speed_ratio <= 0.45 or utilization_pct >= 80.0:
        overload_status = "HIGH_CONGESTION_SATURATION"
        overload_label = "High Vehicle Density (Approaching Capacity)"
        overload_severity = "high"
        recommendation = "Traffic volume exceeds optimal flow rate. Significant stop-and-go idling."
    elif utilization_pct >= 55.0:
        overload_status = "MODERATE_FLOW"
        overload_label = "Moderate Density (Stable Throughput)"
        overload_severity = "moderate"
        recommendation = "Corridor flowing with minor queues at signal intersections."
    else:
        overload_status = "FREE_FLOW_LOW_DENSITY"
        overload_label = "Optimal / Low Vehicle Density"
        overload_severity = "low"
        recommendation = "Free-flow conditions; optimal fuel efficiency and lowest carbon footprint."

    return {
        "location": {
            "name": location_name or f"Point ({lat:.4f}, {lon:.4f})",
            "city": city_hint or "Detected Area",
            "lat": lat,
            "lon": lon,
            "segment_length_km": segment_length_km,
            "road_type": road_type,
            "design_capacity_veh_per_hr": road_capacity
        },
        "telemetry": {
            "current_speed_kmh": curr_speed,
            "free_flow_speed_kmh": free_speed,
            "speed_ratio": speed_ratio,
            "congestion_band": band,
            "congestion_color": color,
            "data_source": flow.get("source", "tomtom_flow_api")
        },
        "emissions_hourly": {
            "total_co2_kg": total_co2_kg,
            "optimal_co2_kg": optimal_co2_kg,
            "excess_co2_kg": excess_co2_kg,
            "excess_co2_pct": round(((total_co2_kg - optimal_co2_kg) / max(optimal_co2_kg, 0.01)) * 100.0, 1),
            "fuel_wasted_litres": fuel_wasted_litres,
            "emission_rate_g_per_km": emission_rate_g_per_km,
            "congestion_penalty_factor": congestion_penalty,
            "time_window": f"{target_dt.strftime('%H:00')} - {((target_dt.hour + 1) % 24):02d}:00 IST"
        },
        "vehicle_density_metrics": {
            "estimated_vehicles_per_hour": hourly_vehicles,
            "capacity_utilization_pct": utilization_pct,
            "diurnal_commute_pressure": round(diurnal, 3),
            "overload_status": overload_status,
            "overload_label": overload_label,
            "overload_severity": overload_severity,
            "recommendation": recommendation
        },
        "context_applied": {
            "weather": weather,
            "festival": fest_name,
            "is_peak_hour": (8 <= target_dt.hour <= 11) or (17 <= target_dt.hour <= 21)
        }
    }
