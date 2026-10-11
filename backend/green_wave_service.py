import logging
from typing import Dict, Any

from backend.config import CITIES
from backend.forecast_service import generate_road_forecast
from backend.tomtom_service import get_congestion_band, get_congestion_color

logger = logging.getLogger(__name__)


def simulate_green_wave(
    city_name: str = "Bengaluru",
    road_id: str = "blr_silk_board",
    enable_adaptive_signals: bool = True,
    green_split_adjustment_pct: int = 25
) -> Dict[str, Any]:
    """
    Dynamic Green Wave what-if simulator for adaptive traffic signal optimization.
    Evaluates baseline vs simulated intervention traffic dynamics.
    """
    # Obtain current forecast for road
    base_forecast = generate_road_forecast(city_name=city_name, road_id=road_id)
    timeline = base_forecast["forecast_timeline"]
    now_step = timeline[0]

    baseline_speed = now_step["predicted_speed"]
    free_flow = now_step["free_flow_speed"]
    baseline_ratio = now_step["congestion_ratio"]
    baseline_band = now_step["congestion_band"]

    # Typical fixed signal timing: 120s total cycle time, 40s green phase
    fixed_cycle_seconds = 120
    baseline_green_seconds = 40
    baseline_idle_delay_seconds = round((fixed_cycle_seconds - baseline_green_seconds) * (1.0 - baseline_ratio * 0.7), 1)

    if not enable_adaptive_signals:
        return {
            "city": city_name,
            "road_id": road_id,
            "road_name": base_forecast["road_name"],
            "adaptive_signals_enabled": False,
            "baseline": {
                "speed_kmh": baseline_speed,
                "congestion_ratio": baseline_ratio,
                "congestion_band": baseline_band,
                "idle_delay_seconds": baseline_idle_delay_seconds,
                "cycle_time_seconds": fixed_cycle_seconds,
                "green_split_seconds": baseline_green_seconds,
            },
            "intervention": None,
            "comparison": {
                "speed_gain_kmh": 0.0,
                "congestion_reduction_pct": 0.0,
                "delay_saved_seconds": 0.0,
            },
            "recommendation": "Adaptive optimization is disabled. Signal operates on standard fixed time of day schedule.",
            "disclaimer": "Hypothetical what-if simulation model. Does not actuate real municipal traffic controllers.",
        }

    # Optimization model: Reallocate green split dynamically based on demand
    extra_green_seconds = round(baseline_green_seconds * (green_split_adjustment_pct / 100.0), 1)
    optimized_green_seconds = min(75.0, baseline_green_seconds + extra_green_seconds)

    # Elasticity factor: 10% more green time yields ~6% throughput improvement in saturated queues
    speed_boost_factor = 1.0 + (0.55 * (extra_green_seconds / baseline_green_seconds))
    simulated_speed = round(min(free_flow * 0.95, baseline_speed * speed_boost_factor), 1)
    simulated_ratio = round(min(0.95, simulated_speed / free_flow), 3)
    simulated_band = get_congestion_band(simulated_ratio)

    simulated_idle_delay = round(max(10.0, baseline_idle_delay_seconds * (1.0 - (extra_green_seconds / fixed_cycle_seconds) * 1.4)), 1)
    delay_saved = round(baseline_idle_delay_seconds - simulated_idle_delay, 1)
    congestion_reduction = round((baseline_ratio - simulated_ratio) * 100, 1)

    # Future timeline comparison (+15, +30, +60 min)
    projected_timeline = []
    for step in timeline:
        h = step["horizon_minutes"]
        # Adaptive signal efficacy holds better during mid-term peak
        decay = 0.92 if h == 15 else (0.85 if h == 30 else 0.75)
        adj_speed = round(min(free_flow * 0.95, step["predicted_speed"] + (simulated_speed - baseline_speed) * decay), 1)
        adj_ratio = round(adj_speed / free_flow, 3)
        adj_band = get_congestion_band(adj_ratio)

        projected_timeline.append({
            "horizon_label": step["horizon_label"],
            "baseline_speed": step["predicted_speed"],
            "intervention_speed": adj_speed,
            "speed_gain": round(adj_speed - step["predicted_speed"], 1),
            "baseline_band": step["congestion_band"],
            "intervention_band": adj_band,
        })

    return {
        "city": city_name,
        "road_id": road_id,
        "road_name": base_forecast["road_name"],
        "adaptive_signals_enabled": True,
        "baseline": {
            "speed_kmh": baseline_speed,
            "congestion_ratio": baseline_ratio,
            "congestion_band": baseline_band,
            "idle_delay_seconds": baseline_idle_delay_seconds,
            "cycle_time_seconds": fixed_cycle_seconds,
            "green_split_seconds": baseline_green_seconds,
        },
        "intervention": {
            "speed_kmh": simulated_speed,
            "congestion_ratio": simulated_ratio,
            "congestion_band": simulated_band,
            "color": get_congestion_color(simulated_band),
            "idle_delay_seconds": simulated_idle_delay,
            "cycle_time_seconds": fixed_cycle_seconds,
            "green_split_seconds": optimized_green_seconds,
            "recommended_timing_adjustment": f"+{extra_green_seconds}s green allocation on primary flow phase (offset sync)",
        },
        "comparison": {
            "speed_gain_kmh": round(simulated_speed - baseline_speed, 1),
            "congestion_ratio_delta": round(simulated_ratio - baseline_ratio, 3),
            "delay_saved_seconds": delay_saved,
            "delay_reduction_pct": round((delay_saved / max(baseline_idle_delay_seconds, 1)) * 100, 1),
        },
        "projected_timeline": projected_timeline,
        "recommendation": (
            f"Allocate +{extra_green_seconds:.0f}s green phase to {base_forecast['road_name']} "
            f"and coordinate platoon offset with upstream junction for continuous green progression."
        ),
        "disclaimer": (
            "Hypothetical What-If Traffic Signal Simulation. "
            "TrafficPulse AI does not control municipal physical signal controllers. "
            "Outcomes reflect macroscopic queue dissipation models."
        )
    }
