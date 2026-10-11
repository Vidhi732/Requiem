import math
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, Tuple, List

# Indian National & Major Cultural/Religious Festivals with observed dates (2024 - 2027)
# impact_level: 'High' | 'Severe' | 'Moderate' | 'Special'
# speed_factor: multiplier applied to traffic speed (lower = heavier slowdown around commercial/temple nodes)
# volume_factor: multiplier on vehicle density
# typical_congestion_zones: types of urban corridors most affected
INDIAN_FESTIVALS = {
    # 2024
    "2024-01-15": {"name": "Makar Sankranti / Pongal", "type": "Harvest Festival", "speed_factor": 0.82, "volume_factor": 1.25, "impact": "High"},
    "2024-01-26": {"name": "Republic Day", "type": "National Holiday", "speed_factor": 1.15, "volume_factor": 0.75, "impact": "Low (Holiday clearance)"},
    "2024-03-08": {"name": "Maha Shivratri", "type": "Religious Festival", "speed_factor": 0.85, "volume_factor": 1.20, "impact": "Moderate"},
    "2024-03-25": {"name": "Holi", "type": "Cultural Festival", "speed_factor": 1.10, "volume_factor": 0.70, "impact": "Low daytime, surge evening"},
    "2024-04-11": {"name": "Eid-ul-Fitr (Ramzan Eid)", "type": "Religious Festival", "speed_factor": 0.78, "volume_factor": 1.35, "impact": "Severe around markets"},
    "2024-08-15": {"name": "Independence Day", "type": "National Holiday", "speed_factor": 1.12, "volume_factor": 0.78, "impact": "Clear highway corridors"},
    "2024-09-07": {"name": "Ganesh Chaturthi", "type": "Major Festival (Mumbai/Pune/BLR)", "speed_factor": 0.68, "volume_factor": 1.55, "impact": "Severe (Processions & pandals)"},
    "2024-09-17": {"name": "Anant Chaturdashi (Visarjan)", "type": "Mega Procession Day", "speed_factor": 0.52, "volume_factor": 1.85, "impact": "Severe (Gridlock on arterial bypasses)"},
    "2024-10-12": {"name": "Dussehra / Vijayadashami", "type": "Major Festival", "speed_factor": 0.74, "volume_factor": 1.40, "impact": "High evening congestion"},
    "2024-10-31": {"name": "Diwali / Deepavali (Lakshmi Pujan)", "type": "Mega Festival Shopping & Travel", "speed_factor": 0.65, "volume_factor": 1.60, "impact": "Severe (Shopping & interstate travel)"},
    "2024-11-01": {"name": "Diwali (Govardhan Puja / New Year)", "type": "Mega Festival", "speed_factor": 0.70, "volume_factor": 1.45, "impact": "High arterial movement"},
    "2024-11-02": {"name": "Bhai Dooj", "type": "Family Festival", "speed_factor": 0.80, "volume_factor": 1.30, "impact": "Moderate intracity surge"},
    "2024-12-25": {"name": "Christmas", "type": "Holiday / Celebration", "speed_factor": 0.82, "volume_factor": 1.30, "impact": "High evening CBD crowds"},
    "2024-12-31": {"name": "New Year's Eve", "type": "Major Celebration", "speed_factor": 0.58, "volume_factor": 1.70, "impact": "Severe night choke (CBDs, MG Road, Marine Drive)"},

    # 2025
    "2025-01-14": {"name": "Makar Sankranti / Pongal", "type": "Harvest Festival", "speed_factor": 0.82, "volume_factor": 1.25, "impact": "High"},
    "2025-01-26": {"name": "Republic Day", "type": "National Holiday", "speed_factor": 1.15, "volume_factor": 0.75, "impact": "Low (Holiday clearance)"},
    "2025-02-26": {"name": "Maha Shivratri", "type": "Religious Festival", "speed_factor": 0.85, "volume_factor": 1.20, "impact": "Moderate"},
    "2025-03-14": {"name": "Holi", "type": "Cultural Festival", "speed_factor": 1.10, "volume_factor": 0.70, "impact": "Low daytime, surge evening"},
    "2025-03-31": {"name": "Eid-ul-Fitr", "type": "Religious Festival", "speed_factor": 0.78, "volume_factor": 1.35, "impact": "Severe around markets"},
    "2025-08-15": {"name": "Independence Day", "type": "National Holiday", "speed_factor": 1.12, "volume_factor": 0.78, "impact": "Clear highway corridors"},
    "2025-08-27": {"name": "Ganesh Chaturthi", "type": "Major Festival (Mumbai/Pune/BLR)", "speed_factor": 0.68, "volume_factor": 1.55, "impact": "Severe (Processions & pandals)"},
    "2025-09-06": {"name": "Anant Chaturdashi (Visarjan)", "type": "Mega Procession Day", "speed_factor": 0.52, "volume_factor": 1.85, "impact": "Severe (Gridlock on arterial bypasses)"},
    "2025-10-02": {"name": "Gandhi Jayanti / Dussehra", "type": "National Holiday & Festival", "speed_factor": 0.80, "volume_factor": 1.30, "impact": "High evening movement"},
    "2025-10-20": {"name": "Diwali / Deepavali", "type": "Mega Festival Shopping & Travel", "speed_factor": 0.65, "volume_factor": 1.60, "impact": "Severe (Shopping & interstate travel)"},
    "2025-10-21": {"name": "Diwali New Year / Govardhan Puja", "type": "Mega Festival", "speed_factor": 0.70, "volume_factor": 1.45, "impact": "High arterial movement"},
    "2025-11-05": {"name": "Guru Nanak Jayanti", "type": "Religious Festival", "speed_factor": 0.88, "volume_factor": 1.15, "impact": "Moderate"},
    "2025-12-25": {"name": "Christmas", "type": "Holiday / Celebration", "speed_factor": 0.82, "volume_factor": 1.30, "impact": "High evening CBD crowds"},
    "2025-12-31": {"name": "New Year's Eve", "type": "Major Celebration", "speed_factor": 0.58, "volume_factor": 1.70, "impact": "Severe night choke (CBDs, MG Road, Marine Drive)"},

    # 2026
    "2026-01-14": {"name": "Makar Sankranti / Pongal", "type": "Harvest Festival", "speed_factor": 0.82, "volume_factor": 1.25, "impact": "High"},
    "2026-01-26": {"name": "Republic Day", "type": "National Holiday", "speed_factor": 1.15, "volume_factor": 0.75, "impact": "Low (Holiday clearance)"},
    "2026-02-16": {"name": "Maha Shivratri", "type": "Religious Festival", "speed_factor": 0.85, "volume_factor": 1.20, "impact": "Moderate"},
    "2026-03-04": {"name": "Holi", "type": "Cultural Festival", "speed_factor": 1.10, "volume_factor": 0.70, "impact": "Low daytime, surge evening"},
    "2026-03-20": {"name": "Eid-ul-Fitr", "type": "Religious Festival", "speed_factor": 0.78, "volume_factor": 1.35, "impact": "Severe around markets"},
    "2026-08-15": {"name": "Independence Day", "type": "National Holiday", "speed_factor": 1.12, "volume_factor": 0.78, "impact": "Clear highway corridors"},
    "2026-09-14": {"name": "Ganesh Chaturthi", "type": "Major Festival (Mumbai/Pune/BLR)", "speed_factor": 0.68, "volume_factor": 1.55, "impact": "Severe (Processions & pandals)"},
    "2026-09-24": {"name": "Anant Chaturdashi (Visarjan)", "type": "Mega Procession Day", "speed_factor": 0.52, "volume_factor": 1.85, "impact": "Severe (Gridlock on arterial bypasses)"},
    "2026-10-20": {"name": "Dussehra", "type": "Major Festival", "speed_factor": 0.74, "volume_factor": 1.40, "impact": "High evening movement"},
    "2026-11-08": {"name": "Diwali / Deepavali", "type": "Mega Festival Shopping & Travel", "speed_factor": 0.65, "volume_factor": 1.60, "impact": "Severe (Shopping & interstate travel)"},
    "2026-11-09": {"name": "Diwali New Year / Govardhan Puja", "type": "Mega Festival", "speed_factor": 0.70, "volume_factor": 1.45, "impact": "High arterial movement"},
    "2026-12-25": {"name": "Christmas", "type": "Holiday / Celebration", "speed_factor": 0.82, "volume_factor": 1.30, "impact": "High evening CBD crowds"},
    "2026-12-31": {"name": "New Year's Eve", "type": "Major Celebration", "speed_factor": 0.58, "volume_factor": 1.70, "impact": "Severe night choke (CBDs, MG Road, Marine Drive)"},

    # 2027
    "2027-01-14": {"name": "Makar Sankranti / Pongal", "type": "Harvest Festival", "speed_factor": 0.82, "volume_factor": 1.25, "impact": "High"},
    "2027-01-26": {"name": "Republic Day", "type": "National Holiday", "speed_factor": 1.15, "volume_factor": 0.75, "impact": "Low (Holiday clearance)"},
    "2027-03-23": {"name": "Holi", "type": "Cultural Festival", "speed_factor": 1.10, "volume_factor": 0.70, "impact": "Low daytime, surge evening"},
    "2027-10-29": {"name": "Diwali / Deepavali", "type": "Mega Festival Shopping & Travel", "speed_factor": 0.65, "volume_factor": 1.60, "impact": "Severe (Shopping & interstate travel)"},
}

# Weather impact modifiers
WEATHER_MODIFIERS = {
    "Clear": {"speed_factor": 1.00, "delay_factor": 1.00, "description": "Optimal road visibility and surface friction."},
    "Overcast": {"speed_factor": 0.95, "delay_factor": 1.05, "description": "Mild dimming, standard urban vehicle speed."},
    "Fog": {"speed_factor": 0.72, "delay_factor": 1.38, "description": "Reduced visibility <200m; drivers slow down drastically on flyovers."},
    "Rain": {"speed_factor": 0.62, "delay_factor": 1.55, "description": "Waterlogging, wheel slippage, and significant bottleneck slowdowns."},
    "Heavy Rain": {"speed_factor": 0.45, "delay_factor": 2.10, "description": "Severe urban waterlogging, junction jams, and flooded underpasses."},
    "Windy": {"speed_factor": 0.90, "delay_factor": 1.10, "description": "Two-wheeler instability and cautious driving on elevated highways."},
}

# Active roadwork impact
ROADWORK_MODIFIERS = {
    "No": {"speed_factor": 1.00, "description": "Full corridor lane width available."},
    "Yes": {"speed_factor": 0.70, "description": "Lane blockage/metro construction; chokepoints and capacity drop by 30-45%."},
}


def get_festival_for_date(d: date) -> Optional[Dict[str, Any]]:
    """Returns festival details if the date matches an Indian festival or is within a festive surge window."""
    iso = d.isoformat()
    if iso in INDIAN_FESTIVALS:
        return INDIAN_FESTIVALS[iso]
    
    # Check 1 day before major festival (pre-festival shopping rush)
    tomorrow = (d + timedelta(days=1)).isoformat()
    if tomorrow in INDIAN_FESTIVALS and "Diwali" in INDIAN_FESTIVALS[tomorrow]["name"]:
        return {
            "name": f"Pre-{INDIAN_FESTIVALS[tomorrow]['name']} Shopping Rush",
            "type": "Pre-Festival Rush",
            "speed_factor": 0.72,
            "volume_factor": 1.45,
            "impact": "High (Pre-festival shopping & bus terminals)",
        }
    return None


def calculate_temporal_and_contextual_factors(
    target_dt: datetime,
    weather: str = "Clear",
    roadwork: str = "No",
    festival_override: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes comprehensive context vectors:
      1. Diurnal commuter rush index (time of day)
      2. Day of week profile (weekday peak vs weekend leisure)
      3. Weather degradation index
      4. Construction / roadwork bottleneck index
      5. Indian festival & holiday impact multiplier
    """
    # 1. Diurnal Commuter Rush Index
    minute_of_day = target_dt.hour * 60 + target_dt.minute
    morning_peak = math.exp(-((minute_of_day - 570) ** 2) / (2 * (55 ** 2)))
    evening_peak = 1.15 * math.exp(-((minute_of_day - 1155) ** 2) / (2 * (65 ** 2)))
    midday_base = 0.45 * math.exp(-((minute_of_day - 840) ** 2) / (2 * (150 ** 2)))
    night_lull = 0.15

    raw_diurnal = morning_peak + evening_peak + midday_base + night_lull
    diurnal_pressure = max(0.15, min(0.95, raw_diurnal))

    # Time description
    if 510 <= minute_of_day <= 660:
        time_slot_label = "Morning Commuter Peak (8:30 AM – 11:00 AM)"
    elif 1020 <= minute_of_day <= 1260:
        time_slot_label = "Evening Rush Hour (5:00 PM – 9:00 PM)"
    elif 720 <= minute_of_day <= 960:
        time_slot_label = "Midday Business Plateau (12:00 PM – 4:00 PM)"
    elif minute_of_day < 360 or minute_of_day > 1380:
        time_slot_label = "Night Clear Window (11:00 PM – 6:00 AM)"
    else:
        time_slot_label = "Standard Shoulder Hours"

    # 2. Day of week factor
    dow = target_dt.weekday()  # 0=Monday, 6=Sunday
    is_weekend = dow >= 5
    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow_label = dow_names[dow]
    dow_speed_factor = 1.08 if dow == 6 else (1.04 if dow == 5 else (0.94 if dow in (0, 4) else 0.98))

    # 3. Weather modifier
    w_info = WEATHER_MODIFIERS.get(weather, WEATHER_MODIFIERS["Clear"])
    weather_speed_factor = w_info["speed_factor"]

    # 4. Roadwork modifier
    rw_info = ROADWORK_MODIFIERS.get(roadwork, ROADWORK_MODIFIERS["No"])
    roadwork_speed_factor = rw_info["speed_factor"]

    # 5. Festival modifier
    fest_info = None
    if festival_override and festival_override != "None":
        # User explicitly picked a festival scenario
        fest_info = {
            "name": festival_override,
            "type": "User Specified Festival Simulation",
            "speed_factor": 0.65 if "Diwali" in festival_override or "Ganesh" in festival_override or "Visarjan" in festival_override else 0.78,
            "volume_factor": 1.55,
            "impact": "High / Severe Festival Surge",
        }
    else:
        fest_info = get_festival_for_date(target_dt.date())

    festival_speed_factor = fest_info["speed_factor"] if fest_info else 1.0
    festival_name = fest_info["name"] if fest_info else "Normal Calendar Day"
    festival_impact = fest_info["impact"] if fest_info else "No Active Festival Surge"

    # Combined contextual multiplier on speed
    combined_factor = (
        (1.0 - (diurnal_pressure - 0.40) * 0.45)
        * dow_speed_factor
        * weather_speed_factor
        * roadwork_speed_factor
        * festival_speed_factor
    )
    combined_factor = max(0.20, min(1.20, combined_factor))

    return {
        "target_time_ist": target_dt.strftime("%Y-%m-%d %H:%M IST"),
        "time_slot_label": time_slot_label,
        "day_of_week": dow_label,
        "is_weekend": is_weekend,
        "diurnal_pressure": round(diurnal_pressure, 3),
        "weather": weather,
        "weather_speed_factor": weather_speed_factor,
        "weather_description": w_info["description"],
        "roadwork": roadwork,
        "roadwork_speed_factor": roadwork_speed_factor,
        "roadwork_description": rw_info["description"],
        "festival": fest_info,
        "festival_name": festival_name,
        "festival_impact": festival_impact,
        "festival_speed_factor": festival_speed_factor,
        "combined_context_factor": round(combined_factor, 3),
    }
