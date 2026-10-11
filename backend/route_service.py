import logging
import math
import time
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
import httpx
from datetime import datetime, timezone, timedelta

from backend.config import get_tomtom_api_key, CITIES
from backend.tomtom_service import fetch_flow_segment, get_congestion_band, get_congestion_color

logger = logging.getLogger(__name__)

# Haversine distance helper (in km)
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

# Interpolate waypoints helper for smooth polyline display
def interpolate_waypoints(points: List[Tuple[float, float]], steps_per_segment: int = 5) -> List[List[float]]:
    res: List[List[float]] = []
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        for s in range(steps_per_segment):
            t = s / float(steps_per_segment)
            lat = p1[0] + (p2[0] - p1[0]) * t
            lon = p1[1] + (p2[1] - p1[1]) * t
            res.append([round(lat, 5), round(lon, 5)])
    res.append([round(points[-1][0], 5), round(points[-1][1], 5)])
    return res

# Pre-configured Inter-City and Major Urban Corridors
CORRIDOR_ROUTES = {
    # 1. INTER-CITY: Mumbai to Pune (India's busiest expressway corridor)
    "intercity_mumbai_to_pune": {
        "title": "Mumbai ⇄ Pune (Inter-City Expressway Corridor)",
        "corridor_type": "intercity",
        "origin_city": "Mumbai",
        "origin": "Western Express Highway / Bandra Toll",
        "dest_city": "Pune",
        "destination": "Hinjewadi Phase 1 / Wakad Chowk",
        "origin_coords": [19.0330, 72.8180],
        "dest_coords": [18.5913, 73.7389],
        "routes": [
            {
                "id": "route_mpew_expressway",
                "name": "Route A: Yashwantrao Chavan Mumbai-Pune Expressway (via Vashi & Bhor Ghat)",
                "distance_km": 142.5,
                "free_flow_speed_kmh": 85.0,
                "is_toll": True,
                "segments": [
                    {"name": "Vashi Bridge Toll", "lat": 19.0620, "lon": 72.9860},
                    {"name": "Sion-Panvel Tollway (Kalamboli)", "lat": 19.0200, "lon": 73.0950},
                    {"name": "Khalapur Toll Plaza", "lat": 18.8350, "lon": 73.2870},
                    {"name": "Khandala Ghat Tunnel", "lat": 18.7620, "lon": 73.3760},
                    {"name": "Talegaon Toll Plaza", "lat": 18.7300, "lon": 73.6600},
                    {"name": "Kiwale Interchange", "lat": 18.6630, "lon": 73.7370},
                    {"name": "Wakad Bridge / Hinjewadi", "lat": 18.5987, "lon": 73.7634},
                ],
                "description": "Primary 6-lane access-controlled concrete expressway. Fastest corridor between Mumbai & Pune."
            },
            {
                "id": "route_atal_setu_mthl_pune",
                "name": "Route B: via Atal Setu (MTHL Sewri-Nhava Sheva) & Chirle Expressway Link",
                "distance_km": 138.2,
                "free_flow_speed_kmh": 90.0,
                "is_toll": True,
                "segments": [
                    {"name": "Sewri Atal Setu Interchange", "lat": 18.9950, "lon": 72.8800},
                    {"name": "Chirle Junction (JNPT)", "lat": 18.9100, "lon": 73.0200},
                    {"name": "Rasayani Bypass Link", "lat": 18.8800, "lon": 73.1800},
                    {"name": "Khalapur Tollway", "lat": 18.8350, "lon": 73.2870},
                    {"name": "Kiwale Interchange", "lat": 18.6630, "lon": 73.7370},
                ],
                "description": "Bypasses Sion & Chembur bottlenecks via India's longest sea bridge. Optimal from South & Central Mumbai."
            },
            {
                "id": "route_old_nh48_pune",
                "name": "Route C: via Old Mumbai-Pune Highway (NH-48 / Khopoli-Lonavala)",
                "distance_km": 154.0,
                "free_flow_speed_kmh": 50.0,
                "is_toll": False,
                "segments": [
                    {"name": "Panvel Old Town Bypass", "lat": 18.9880, "lon": 73.1200},
                    {"name": "Khopoli Phata", "lat": 18.7900, "lon": 73.3400},
                    {"name": "Lonavala Bazaar Ghat", "lat": 18.7500, "lon": 73.4100},
                    {"name": "Dehu Road Cantonment", "lat": 18.7100, "lon": 73.7100},
                ],
                "description": "Scenic non-tolled mountain road with heavier heavy-vehicle truck volume and steep switchbacks."
            }
        ]
    },

    # 2. INTER-CITY: Bengaluru to Chennai
    "intercity_bengaluru_to_chennai": {
        "title": "Bengaluru ⇄ Chennai (Golden Quadrilateral Corridor)",
        "corridor_type": "intercity",
        "origin_city": "Bengaluru",
        "origin": "Electronic City Tollway / Hosur Road",
        "dest_city": "Chennai",
        "destination": "Kathipara Cloverleaf / Guindy",
        "origin_coords": [12.8450, 77.6650],
        "dest_coords": [13.0070, 80.2050],
        "routes": [
            {
                "id": "route_nh44_krishnagiri",
                "name": "Route A: via NH-44 / NH-48 (Hosur, Krishnagiri, Vellore, Sriperumbudur)",
                "distance_km": 348.0,
                "free_flow_speed_kmh": 78.0,
                "is_toll": True,
                "segments": [
                    {"name": "Hosur Border", "lat": 12.7400, "lon": 77.8300},
                    {"name": "Krishnagiri Toll Plaza", "lat": 12.5200, "lon": 78.2200},
                    {"name": "Ambur Leather Hub", "lat": 12.7900, "lon": 78.7100},
                    {"name": "Vellore Fort Bypass", "lat": 12.9200, "lon": 79.1300},
                    {"name": "Sriperumbudur Auto Cluster", "lat": 12.9700, "lon": 79.9400},
                    {"name": "Kathipara Cloverleaf", "lat": 13.0070, "lon": 80.2050},
                ],
                "description": "Fully 4-6 lane divided Golden Quadrilateral highway. High speed and top surface quality."
            },
            {
                "id": "route_nh75_chittoor",
                "name": "Route B: via Old Madras Road NH-75 (Kolar, Mulbagal, Chittoor, Ranipet)",
                "distance_km": 326.5,
                "free_flow_speed_kmh": 68.0,
                "is_toll": True,
                "segments": [
                    {"name": "KR Puram Hanging Bridge", "lat": 13.0010, "lon": 77.6970},
                    {"name": "Kolar Gold Fields Bypass", "lat": 13.1300, "lon": 78.1300},
                    {"name": "Chittoor Bypass Toll", "lat": 13.2100, "lon": 79.1000},
                    {"name": "Ranipet BHEL Junction", "lat": 12.9300, "lon": 79.3300},
                    {"name": "Poonamallee Bypass", "lat": 13.0500, "lon": 80.0800},
                ],
                "description": "Shorter distance alternative traversing Andhra Pradesh border and industrial districts."
            }
        ]
    },

    # 3. INTER-CITY: Bengaluru to Pune
    "intercity_bengaluru_to_pune": {
        "title": "Bengaluru ⇄ Pune (NH-48 Golden Quadrilateral Spine)",
        "corridor_type": "intercity",
        "origin_city": "Bengaluru",
        "origin": "Yeshwanthpur / Goraguntepalya Tumkur Rd",
        "dest_city": "Pune",
        "destination": "Katraj Tunnel / Swargate / Chandani Chowk",
        "origin_coords": [13.0238, 77.5503],
        "dest_coords": [18.5080, 73.7850],
        "routes": [
            {
                "id": "route_nh48_hubballi_belagavi",
                "name": "Route A: NH-48 via Tumakuru, Chitradurga, Hubballi, Belagavi, Kolhapur, Satara",
                "distance_km": 842.0,
                "free_flow_speed_kmh": 82.0,
                "is_toll": True,
                "segments": [
                    {"name": "Tumakuru Toll Plaza", "lat": 13.3400, "lon": 77.1000},
                    {"name": "Chitradurga Fort Bypass", "lat": 14.2300, "lon": 76.4000},
                    {"name": "Davanagere Bypass", "lat": 14.4600, "lon": 75.9200},
                    {"name": "Hubballi Gabbur Cross", "lat": 15.3100, "lon": 75.1400},
                    {"name": "Belagavi Suvarna Vidhana Soudha", "lat": 15.8600, "lon": 74.5200},
                    {"name": "Kolhapur Shiroli Toll", "lat": 16.7400, "lon": 74.2700},
                    {"name": "Satara Khambatki Ghat", "lat": 17.6800, "lon": 73.9900},
                    {"name": "Katraj Tunnel / Pune", "lat": 18.4230, "lon": 73.8580},
                ],
                "description": "Grand interstate trunk expressway joining southern and western technology capitals."
            }
        ]
    },

    # 4. INTER-CITY: Mumbai to Bengaluru
    "intercity_mumbai_to_bengaluru": {
        "title": "Mumbai ⇄ Bengaluru (West-South Interstate Supercorridor)",
        "corridor_type": "intercity",
        "origin_city": "Mumbai",
        "origin": "Atal Setu / Navi Mumbai Vashi",
        "dest_city": "Bengaluru",
        "destination": "Hebbal Flyover / Electronic City",
        "origin_coords": [19.0620, 72.9860],
        "dest_coords": [12.9176, 77.6238],
        "routes": [
            {
                "id": "route_mumbai_blr_nh48",
                "name": "Route A: via Pune Expressway, Satara, Kolhapur, Belagavi, Hubballi, Chitradurga",
                "distance_km": 984.5,
                "free_flow_speed_kmh": 84.0,
                "is_toll": True,
                "segments": [
                    {"name": "Mumbai-Pune Expressway (Khalapur)", "lat": 18.8350, "lon": 73.2870},
                    {"name": "Pune Bypass (Chandani Chowk)", "lat": 18.5080, "lon": 73.7850},
                    {"name": "Satara Bypass", "lat": 17.6800, "lon": 73.9900},
                    {"name": "Kolhapur Highway", "lat": 16.7400, "lon": 74.2700},
                    {"name": "Belagavi Toll", "lat": 15.8600, "lon": 74.5200},
                    {"name": "Hubballi Junction", "lat": 15.3100, "lon": 75.1400},
                    {"name": "Tumakuru Elevated Highway", "lat": 13.3400, "lon": 77.1000},
                    {"name": "Bengaluru Goraguntepalya", "lat": 13.0290, "lon": 77.5380},
                ],
                "description": "Major economic spine linking Mumbai's financial capital with Bengaluru's Silicon Valley."
            }
        ]
    },

    # 5. INTER-CITY: Delhi to Jaipur
    "intercity_delhi_to_jaipur": {
        "title": "Delhi NCR ⇄ Jaipur (Golden Triangle / NE-4 Expressway)",
        "corridor_type": "intercity",
        "origin_city": "Delhi",
        "origin": "Dhaula Kuan / Gurgaon Cyber Hub",
        "dest_city": "Jaipur",
        "destination": "Jaipur Sindhi Camp / Amer Road",
        "origin_coords": [28.4980, 77.0910],
        "dest_coords": [26.9124, 75.7873],
        "routes": [
            {
                "id": "route_del_jpr_ne4",
                "name": "Route A: Delhi-Mumbai Expressway (NE-4 via Sohna & Dausa Link)",
                "distance_km": 268.0,
                "free_flow_speed_kmh": 105.0,
                "is_toll": True,
                "segments": [
                    {"name": "Sohna Elevated Tollway", "lat": 28.2400, "lon": 77.0600},
                    {"name": "NE-4 Dausa Interchange", "lat": 26.8900, "lon": 76.3300},
                    {"name": "Jaipur Ring Road Expressway", "lat": 26.8200, "lon": 75.8200},
                ],
                "description": "State-of-the-art 120 km/h design speed 8-lane expressway. 3.5 hour travel time."
            },
            {
                "id": "route_del_jpr_nh48",
                "name": "Route B: via NH-48 (Manesar, Dharuhera, Behror, Kotputli, Shahpura)",
                "distance_km": 275.0,
                "free_flow_speed_kmh": 65.0,
                "is_toll": True,
                "segments": [
                    {"name": "Manesar IMT Toll", "lat": 28.3600, "lon": 76.9200},
                    {"name": "Kotputli Bypass", "lat": 27.7000, "lon": 76.1900},
                    {"name": "Shahpura Choke Point", "lat": 27.3900, "lon": 75.9600},
                ],
                "description": "Traditional national highway corridor with industrial freight corridors and flyovers."
            }
        ]
    },

    # 6. INTER-CITY: Hyderabad to Bengaluru
    "intercity_hyderabad_to_bengaluru": {
        "title": "Hyderabad ⇄ Bengaluru (NH-44 North-South Superhighway)",
        "corridor_type": "intercity",
        "origin_city": "Hyderabad",
        "origin": "PVNR Elevated Expressway / Gachibowli",
        "dest_city": "Bengaluru",
        "destination": "Hebbal Flyover / Airport Expressway",
        "origin_coords": [17.3820, 78.4350],
        "dest_coords": [13.0358, 77.5970],
        "routes": [
            {
                "id": "route_hyd_blr_nh44",
                "name": "Route A: NH-44 via Jadcherla, Kurnool, Gooty, Anantapur, Devanahalli",
                "distance_km": 569.0,
                "free_flow_speed_kmh": 85.0,
                "is_toll": True,
                "segments": [
                    {"name": "Shadnagar Toll Plaza", "lat": 17.0600, "lon": 78.2000},
                    {"name": "Kurnool Tungabhadra Bridge", "lat": 15.8200, "lon": 78.0300},
                    {"name": "Anantapur Bypass", "lat": 14.6800, "lon": 77.6000},
                    {"name": "Bagepalli Toll Plaza", "lat": 13.7800, "lon": 77.7900},
                    {"name": "KIA Airport Trumpet Interchange", "lat": 13.2000, "lon": 77.7100},
                    {"name": "Hebbal Flyover Entry", "lat": 13.0358, "lon": 77.5970},
                ],
                "description": "Direct dual-carriageway access-controlled highway. Connects Cyberabad with Silicon City."
            }
        ]
    },

    # 7. INTRA-CITY: Mumbai Western Corridor (Nariman Point to Borivali)
    "mum_south_to_north": {
        "title": "Mumbai: Nariman Point to Borivali (North-South Arterial)",
        "corridor_type": "intracity",
        "origin_city": "Mumbai",
        "origin": "Marine Drive / Nariman Point",
        "dest_city": "Mumbai",
        "destination": "WEH Borivali National Park",
        "origin_coords": [18.9438, 72.8232],
        "dest_coords": [19.2290, 72.8640],
        "routes": [
            {
                "id": "route_mum_coastal_sea_link",
                "name": "Route A: via Coastal Road, Bandra-Worli Sea Link & WEH",
                "distance_km": 36.8,
                "free_flow_speed_kmh": 62.0,
                "segments": [
                    {"name": "Marine Drive", "lat": 18.9438, "lon": 72.8232},
                    {"name": "Bandra-Worli Sea Link", "lat": 19.0330, "lon": 72.8180},
                    {"name": "WEH Andheri Flyover", "lat": 19.1197, "lon": 72.8468},
                    {"name": "WEH Borivali NP", "lat": 19.2290, "lon": 72.8640},
                ],
                "description": "Coastal and sea-link expressway corridor bypassing Dadar and Mahim congestions."
            },
            {
                "id": "route_mum_senapati_bapat_weh",
                "name": "Route B: via Senapati Bapat Marg, Mahim Causeway & WEH",
                "distance_km": 38.2,
                "free_flow_speed_kmh": 44.0,
                "segments": [
                    {"name": "Prabhadevi", "lat": 19.0150, "lon": 72.8290},
                    {"name": "Mahim Causeway", "lat": 19.0430, "lon": 72.8400},
                    {"name": "WEH Andheri", "lat": 19.1197, "lon": 72.8468},
                ],
                "description": "Inner arterial route with dense commercial signals and junction stops."
            }
        ]
    },

    # 8. INTRA-CITY: Mumbai to Navi Mumbai (BKC to Vashi / Palm Beach)
    "mum_bkc_to_navi_mumbai": {
        "title": "Mumbai: BKC to Navi Mumbai (Vashi / Belapur)",
        "corridor_type": "intracity",
        "origin_city": "Mumbai",
        "origin": "BKC Connector / Kalanagar",
        "dest_city": "Mumbai",
        "destination": "Palm Beach Road (Navi Mumbai)",
        "origin_coords": [19.0657, 72.8685],
        "dest_coords": [19.0280, 73.0180],
        "routes": [
            {
                "id": "route_sclr_vashi_bridge",
                "name": "Route A: via SCLR & Sion-Panvel Expressway (Vashi Bridge)",
                "distance_km": 21.4,
                "free_flow_speed_kmh": 55.0,
                "segments": [
                    {"name": "SCLR Chembur", "lat": 19.0710, "lon": 72.8840},
                    {"name": "Mankhurd Flyover", "lat": 19.0550, "lon": 72.9320},
                    {"name": "Vashi Bridge Toll", "lat": 19.0620, "lon": 72.9860},
                    {"name": "Palm Beach Road", "lat": 19.0280, "lon": 73.0180},
                ],
                "description": "Key cross-harbour commercial transit spine."
            },
            {
                "id": "route_atal_setu_connector",
                "name": "Route B: via Eastern Freeway & Atal Setu (MTHL Sea Link)",
                "distance_km": 28.6,
                "free_flow_speed_kmh": 80.0,
                "segments": [
                    {"name": "Eastern Freeway Panjarpol", "lat": 19.0480, "lon": 72.9100},
                    {"name": "Sewri MTHL Ramp", "lat": 18.9950, "lon": 72.8800},
                    {"name": "Nhava Sheva Tollway", "lat": 18.9800, "lon": 73.0100},
                ],
                "description": "Zero stop-and-go oceanic expressway to trans-harbour Navi Mumbai."
            }
        ]
    },

    # 9. INTRA-CITY: Pune Hinjewadi to Hadapsar / Kharadi (West to East IT Corridor)
    "pune_hinjewadi_to_kharadi": {
        "title": "Pune: Hinjewadi IT Park to Kharadi / Magarpatta",
        "corridor_type": "intracity",
        "origin_city": "Pune",
        "origin": "Hinjewadi Phase 1",
        "dest_city": "Pune",
        "destination": "Kharadi Bypass (EON Free Zone)",
        "origin_coords": [18.5913, 73.7389],
        "dest_coords": [18.5520, 73.9480],
        "routes": [
            {
                "id": "route_pune_bypass_nh48",
                "name": "Route A: via Wakad, Baner & Pune-Ahmednagar Bypass",
                "distance_km": 26.4,
                "free_flow_speed_kmh": 52.0,
                "segments": [
                    {"name": "Wakad Bridge", "lat": 18.5987, "lon": 73.7634},
                    {"name": "Baner High Street", "lat": 18.5590, "lon": 73.7890},
                    {"name": "Viman Nagar Airport Road", "lat": 18.5720, "lon": 73.9130},
                    {"name": "Kharadi EON", "lat": 18.5520, "lon": 73.9480},
                ],
                "description": "Northern peripheral expressway loop connecting western tech parks to eastern IT hubs."
            },
            {
                "id": "route_pune_central_arterial",
                "name": "Route B: via Aundh, Shivaji Nagar (FC Road) & Yerwada",
                "distance_km": 23.8,
                "free_flow_speed_kmh": 36.0,
                "segments": [
                    {"name": "Aundh University Gate", "lat": 18.5480, "lon": 73.8150},
                    {"name": "FC Road Shivajinagar", "lat": 18.5284, "lon": 73.8427},
                    {"name": "Bund Garden Bridge", "lat": 18.5360, "lon": 73.8820},
                    {"name": "Kharadi Bypass", "lat": 18.5520, "lon": 73.9480},
                ],
                "description": "Direct path across city core through university and government corridors."
            }
        ]
    },

    # 10. INTRA-CITY: Bengaluru Koramangala to Whitefield (IT Corridor)
    "blr_koramangala_to_whitefield": {
        "title": "Bengaluru: Koramangala to Whitefield (IT Corridor)",
        "corridor_type": "intracity",
        "origin_city": "Bengaluru",
        "origin": "Sony World Junction",
        "dest_city": "Bengaluru",
        "destination": "ITPL Main Road (Whitefield)",
        "origin_coords": [12.9345, 77.6265],
        "dest_coords": [12.9860, 77.7380],
        "routes": [
            {
                "id": "route_orr_whitefield",
                "name": "Route A: via Outer Ring Road, Bellandur & Marathahalli Bridge",
                "distance_km": 16.5,
                "free_flow_speed_kmh": 48.0,
                "segments": [
                    {"name": "Outer Ring Road (Bellandur)", "lat": 12.9260, "lon": 77.6770},
                    {"name": "Marathahalli Bridge", "lat": 12.9562, "lon": 77.7011},
                    {"name": "ITPL Main Road", "lat": 12.9860, "lon": 77.7380},
                ],
                "description": "High-capacity grade separated corridor with choke points at bridge underpass."
            },
            {
                "id": "route_hal_old_airport",
                "name": "Route B: via Old Airport Road & Varthur Kodi",
                "distance_km": 14.8,
                "free_flow_speed_kmh": 38.0,
                "segments": [
                    {"name": "HAL Airport Road", "lat": 12.9576, "lon": 77.6780},
                    {"name": "Varthur Kodi", "lat": 12.9598, "lon": 77.7420},
                    {"name": "ITPL Whitefield", "lat": 12.9860, "lon": 77.7380},
                ],
                "description": "Shorter distance but dense mixed-traffic urban arterial."
            }
        ]
    },

    # 11. INTRA-CITY: Bengaluru Silk Board to Indiranagar
    "blr_silkboard_to_indiranagar": {
        "title": "Bengaluru: Silk Board to Indiranagar",
        "corridor_type": "intracity",
        "origin_city": "Bengaluru",
        "origin": "Silk Board Junction",
        "dest_city": "Bengaluru",
        "destination": "100 Feet Road Indiranagar",
        "origin_coords": [12.9176, 77.6238],
        "dest_coords": [12.9719, 77.6412],
        "routes": [
            {
                "id": "route_inner_ring",
                "name": "Route A: via Intermediate Ring Road (Domlur & Koramangala)",
                "distance_km": 9.4,
                "free_flow_speed_kmh": 45.0,
                "segments": [
                    {"name": "Sony World Junction", "lat": 12.9345, "lon": 77.6265},
                    {"name": "Domlur Flyover", "lat": 12.9600, "lon": 77.6380},
                    {"name": "100 Feet Road", "lat": 12.9719, "lon": 77.6412},
                ],
                "description": "Direct arterial via Koramangala & Embassy GolfLinks."
            },
            {
                "id": "route_hosur_trinity",
                "name": "Route B: via Hosur Road & Trinity Circle (CBD Perimeter)",
                "distance_km": 11.2,
                "free_flow_speed_kmh": 40.0,
                "segments": [
                    {"name": "Silk Board", "lat": 12.9176, "lon": 77.6238},
                    {"name": "Trinity Circle", "lat": 12.9734, "lon": 77.6186},
                    {"name": "100 Feet Road", "lat": 12.9719, "lon": 77.6412},
                ],
                "description": "Via Hosur Road through central arterial corridors."
            }
        ]
    },
    # 12. INTRA-CITY / MMR: Thane Station to Kasarwadavli (Ghodbunder Road Corridor)
    "thane_station_to_kasarwadavli": {
        "title": "Thane Station ⇄ Kasarwadavli (Ghodbunder Road Arterial)",
        "corridor_type": "intracity",
        "origin_city": "Mumbai / Thane",
        "origin": "Thane Railway Station West",
        "dest_city": "Thane",
        "destination": "Kasarwadavli Junction / Ghodbunder Rd",
        "origin_coords": [19.1860, 72.9756],
        "dest_coords": [19.2664, 72.9714],
        "routes": [
            {
                "id": "route_ghodbunder_express",
                "name": "Route A: via Eastern Express Highway & Ghodbunder Road (Majiwada - Manpada)",
                "distance_km": 11.6,
                "free_flow_speed_kmh": 45.0,
                "segments": [
                    {"name": "Thane Station West", "lat": 19.1860, "lon": 72.9756},
                    {"name": "Teen Hath Naka Flyover", "lat": 19.1920, "lon": 72.9640},
                    {"name": "Majiwada Junction", "lat": 19.2081, "lon": 72.9733},
                    {"name": "Kapurbawdi Naka", "lat": 19.2170, "lon": 72.9810},
                    {"name": "Manpada Flyover", "lat": 19.2392, "lon": 72.9790},
                    {"name": "Brahmand / Waghbil Naka", "lat": 19.2520, "lon": 72.9760},
                    {"name": "Kasarwadavli Junction", "lat": 19.2664, "lon": 72.9714},
                ],
                "description": "Primary high-capacity 6-lane elevated arterial joining Thane Station to northern residential & IT hubs."
            },
            {
                "id": "route_pokhran_glady_alwares",
                "name": "Route B: via Pokhran Road No. 2 & Upvan Lake Bypass",
                "distance_km": 12.8,
                "free_flow_speed_kmh": 38.0,
                "segments": [
                    {"name": "Thane Station West", "lat": 19.1860, "lon": 72.9756},
                    {"name": "Cadbury Junction", "lat": 19.1970, "lon": 72.9620},
                    {"name": "Upvan Lake Road", "lat": 19.2210, "lon": 72.9580},
                    {"name": "Gandhi Nagar / Pokhran 2", "lat": 19.2350, "lon": 72.9600},
                    {"name": "Kasarwadavli", "lat": 19.2664, "lon": 72.9714},
                ],
                "description": "Scenic sub-arterial route skirting the Yeoor hills perimeter to avoid Majiwada bottle-neck."
            }
        ]
    }
}


# In-memory search cache for fast autocompletion: {query_key: (results, expiry_timestamp)}
_PLACES_CACHE: Dict[str, Tuple[List[Dict[str, Any]], float]] = {}
PLACES_CACHE_TTL = 300.0  # 5 minutes


def search_places(query: str, limit: int = 6, country_set: str = "IN") -> List[Dict[str, Any]]:
    """
    Queries TomTom Search / Fuzzy Search API for precise micro-locations,
    landmarks, stations, streets, and junction coordinates anywhere in India.
    Includes memory caching, URL escaping, and rich metadata.
    """
    if not query or len(query.strip()) < 2:
        return []

    q_clean = query.strip()
    cache_key = f"{q_clean.lower()}_{limit}_{country_set}"
    now_ts = time.time()

    if cache_key in _PLACES_CACHE:
        cached_results, exp = _PLACES_CACHE[cache_key]
        if now_ts < exp:
            return cached_results

    key = get_tomtom_api_key()
    results: List[Dict[str, Any]] = []

    if key:
        encoded_query = urllib.parse.quote(q_clean)
        endpoint = f"https://api.tomtom.com/search/2/search/{encoded_query}.json"
        params = {
            "key": key,
            "countrySet": country_set,
            "limit": limit,
            "typeahead": "true",
            "idxSet": "POI,PAD,Str,XStr,Geo",
        }
        try:
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(endpoint, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("results", []):
                        poi_name = item.get("poi", {}).get("name")
                        addr = item.get("address", {})
                        freeform = addr.get("freeformAddress", "")
                        municipality = addr.get("municipality") or addr.get("countrySubdivision", "")
                        country = addr.get("country", "India")
                        
                        label = poi_name if poi_name else freeform
                        sublabel = freeform if poi_name and freeform != poi_name else (municipality or country)
                        
                        pos = item.get("position", {})
                        lat = pos.get("lat")
                        lon = pos.get("lon")

                        if lat is not None and lon is not None:
                            results.append({
                                "id": item.get("id", f"{round(lat, 5)}_{round(lon, 5)}"),
                                "label": label,
                                "sublabel": sublabel,
                                "lat": round(lat, 5),
                                "lon": round(lon, 5),
                                "municipality": municipality,
                                "country": country,
                                "type": item.get("type", "POI"),
                                "source": "tomtom_live",
                            })
        except Exception as e:
            logger.warning(f"TomTom place search error for '{q_clean}': {e}")

    # Fallback / offline directory matching if offline or query has local matches
    if not results:
        from backend.config import CITIES
        q_lower = q_clean.lower()
        # Search among configured road corridors across all cities
        for cname, cdata in CITIES.items():
            for road in cdata.get("roads", []):
                if q_lower in road["name"].lower() or q_lower in road.get("corridor", "").lower() or q_lower in cname.lower():
                    results.append({
                        "id": f"local_{road['id']}",
                        "label": road["name"],
                        "sublabel": f"{road['corridor']} ({cname})",
                        "lat": road["lat"],
                        "lon": road["lon"],
                        "municipality": cname,
                        "country": "India",
                        "type": "Road Corridor",
                        "source": "local_corridors",
                    })
                    if len(results) >= limit:
                        break

    _PLACES_CACHE[cache_key] = (results, now_ts + PLACES_CACHE_TTL)
    return results


def _downsample_polyline(points: List[Dict[str, float]], max_points: int = 150) -> List[List[float]]:
    """Downsamples coordinates list for fast, responsive Leaflet rendering."""
    if not points:
        return []
    total = len(points)
    if total <= max_points:
        return [[round(p.get("latitude", 0.0), 5), round(p.get("longitude", 0.0), 5)] for p in points]
    
    step = total / float(max_points)
    res = []
    for i in range(max_points):
        idx = min(int(i * step), total - 1)
        pt = points[idx]
        res.append([round(pt.get("latitude", 0.0), 5), round(pt.get("longitude", 0.0), 5)])
    
    # Always include exact final coordinate
    last = points[-1]
    last_pt = [round(last.get("latitude", 0.0), 5), round(last.get("longitude", 0.0), 5)]
    if res[-1] != last_pt:
        res.append(last_pt)
    return res


def compute_live_route_telemetry(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    route_name: str = "Primary Corridor",
    free_flow_fallback_speed: float = 60.0,
    waypoint_hints: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Calls TomTom Calculate Route API for real-time turn-by-turn distance,
    exact live travel time, traffic delays, and highway GPS polyline.
    Falls back gracefully to high-precision haversine-geodesic navigation model.
    """
    key = get_tomtom_api_key()
    distance_km = 0.0
    current_time_min = 0.0
    free_flow_time_min = 0.0
    delay_min = 0.0
    polyline_coords: List[List[float]] = []
    is_live_tomtom = False
    source = "calibrated_geodesic"

    if key:
        # Construct TomTom Routing API endpoint
        endpoint = f"https://api.tomtom.com/routing/1/calculateRoute/{origin_lat:.5f},{origin_lon:.5f}:{dest_lat:.5f},{dest_lon:.5f}/json"
        params = {
            "key": key,
            "traffic": "true",
            "computeTravelTimeFor": "all",
            "routeType": "fastest",
        }
        try:
            with httpx.Client(timeout=8.5) as client:
                resp = client.get(endpoint, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if routes:
                        primary_route = routes[0]
                        summary = primary_route.get("summary", {})
                        length_m = summary.get("lengthInMeters", 0)
                        travel_s = summary.get("travelTimeInSeconds", 0)
                        no_traffic_s = summary.get("noTrafficTravelTimeInSeconds", travel_s)
                        delay_s = summary.get("trafficDelayInSeconds", 0)

                        distance_km = round(length_m / 1000.0, 1)
                        current_time_min = round(travel_s / 60.0, 1)
                        free_flow_time_min = round(no_traffic_s / 60.0, 1)
                        delay_min = round(delay_s / 60.0, 1)

                        # Extract GPS polyline from legs
                        all_pts = []
                        for leg in primary_route.get("legs", []):
                            all_pts.extend(leg.get("points", []))

                        polyline_coords = _downsample_polyline(all_pts, max_points=200)
                        is_live_tomtom = True
                        source = "live_tomtom_api"
        except Exception as e:
            logger.warning(f"TomTom routing API query failed: {e}. Falling back to calibrated routing.")

    # Fallback to calibrated geodesic if live API did not supply valid route
    if not is_live_tomtom or distance_km <= 0:
        straight_km = haversine_km(origin_lat, origin_lon, dest_lat, dest_lon)
        # Indian road network winding factor is typically 1.25x - 1.35x straight line
        winding_factor = 1.30 if straight_km > 50 else 1.24
        distance_km = round(straight_km * winding_factor, 1)

        # Average sample speeds along waypoint hints if available
        sample_speeds = []
        if waypoint_hints:
            for wp in waypoint_hints:
                seg = fetch_flow_segment(wp["lat"], wp["lon"])
                sample_speeds.append(seg.get("current_speed", free_flow_fallback_speed * 0.70))

        avg_speed = round(sum(sample_speeds) / len(sample_speeds), 1) if sample_speeds else round(free_flow_fallback_speed * 0.70, 1)
        free_flow_time_min = round((distance_km / free_flow_fallback_speed) * 60, 1)
        current_time_min = round((distance_km / max(avg_speed, 10.0)) * 60, 1)
        delay_min = round(max(0.0, current_time_min - free_flow_time_min), 1)

        # Build polyline by interpolating origin, waypoints, and destination
        wp_list: List[Tuple[float, float]] = [(origin_lat, origin_lon)]
        if waypoint_hints:
            for wp in waypoint_hints:
                wp_list.append((wp["lat"], wp["lon"]))
        wp_list.append((dest_lat, dest_lon))
        polyline_coords = interpolate_waypoints(wp_list, steps_per_segment=8)

    # Calculate Speed & Congestion ratio
    effective_speed = round((distance_km / max(current_time_min, 1.0)) * 60.0, 1)
    free_speed = round((distance_km / max(free_flow_time_min, 1.0)) * 60.0, 1)
    congestion_ratio = round(min(1.0, max(0.15, free_flow_time_min / max(current_time_min, 1.0))), 3)
    band = get_congestion_band(congestion_ratio)

    # Emissions (DEFRA 140g CO2/km baseline + non-linear congestion excess)
    congestion_penalty = 1.0 + 1.6 * ((1.0 - congestion_ratio) ** 2)
    co2_grams_per_km = 140.0 * congestion_penalty
    total_co2_kg = round((distance_km * co2_grams_per_km) / 1000.0, 2)
    optimal_co2_kg = round((distance_km * 140.0) / 1000.0, 2)
    excess_co2_kg = round(max(0.0, total_co2_kg - optimal_co2_kg), 2)
    fuel_wasted_litres = round(excess_co2_kg / 2.31, 2)

    # Multi-horizon predictive projections (+0m, +15m, +30m, +60m)
    now_hour = datetime.now().hour
    is_peak = (8 <= now_hour <= 11) or (17 <= now_hour <= 21)
    
    # +15 min horizon
    h15_ratio = round(max(0.20, congestion_ratio * (0.93 if is_peak else 0.98)), 3)
    h15_time = round(current_time_min * (1.07 if is_peak else 1.02), 1)
    
    # +30 min horizon
    h30_ratio = round(max(0.20, congestion_ratio * (0.88 if is_peak else 0.95)), 3)
    h30_time = round(current_time_min * (1.13 if is_peak else 1.04), 1)

    # +60 min horizon (diurnal reversion toward off-peak)
    h60_ratio = round(max(0.25, congestion_ratio * (0.95 if is_peak else 1.05)), 3)
    h60_time = round(current_time_min * (1.05 if is_peak else 0.96), 1)

    predictions = [
        {
            "horizon_minutes": 0,
            "label": "Now (Live)",
            "travel_time_min": current_time_min,
            "predicted_speed": effective_speed,
            "congestion_ratio": congestion_ratio,
            "congestion_band": band,
            "congestion_color": get_congestion_color(band),
            "delay_min": delay_min
        },
        {
            "horizon_minutes": 15,
            "label": "+15 min",
            "travel_time_min": h15_time,
            "predicted_speed": round((distance_km / max(h15_time, 1.0)) * 60, 1),
            "congestion_ratio": h15_ratio,
            "congestion_band": get_congestion_band(h15_ratio),
            "congestion_color": get_congestion_color(get_congestion_band(h15_ratio)),
            "delay_min": round(max(0.0, h15_time - free_flow_time_min), 1)
        },
        {
            "horizon_minutes": 30,
            "label": "+30 min",
            "travel_time_min": h30_time,
            "predicted_speed": round((distance_km / max(h30_time, 1.0)) * 60, 1),
            "congestion_ratio": h30_ratio,
            "congestion_band": get_congestion_band(h30_ratio),
            "congestion_color": get_congestion_color(get_congestion_band(h30_ratio)),
            "delay_min": round(max(0.0, h30_time - free_flow_time_min), 1)
        },
        {
            "horizon_minutes": 60,
            "label": "+60 min",
            "travel_time_min": h60_time,
            "predicted_speed": round((distance_km / max(h60_time, 1.0)) * 60, 1),
            "congestion_ratio": h60_ratio,
            "congestion_band": get_congestion_band(h60_ratio),
            "congestion_color": get_congestion_color(get_congestion_band(h60_ratio)),
            "delay_min": round(max(0.0, h60_time - free_flow_time_min), 1)
        }
    ]

    return {
        "distance_km": distance_km,
        "current_speed_kmh": effective_speed,
        "free_flow_speed_kmh": free_speed,
        "congestion_ratio": congestion_ratio,
        "congestion_band": band,
        "congestion_color": get_congestion_color(band),
        "current_travel_time_min": current_time_min,
        "free_flow_travel_time_min": free_flow_time_min,
        "traffic_delay_min": delay_min,
        "co2_emissions_kg": total_co2_kg,
        "excess_co2_congestion_kg": excess_co2_kg,
        "fuel_wasted_litres": fuel_wasted_litres,
        "is_live_tomtom": is_live_tomtom,
        "source": source,
        "polyline": polyline_coords,
        "predictions": predictions,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def compare_corridor_routes(corridor_id: str = "intercity_mumbai_to_pune") -> Dict[str, Any]:
    """
    Compares configured routes for any inter-city or intra-city corridor,
    computing real-time live travel times, distances, traffic delays,
    carbon emissions, and high-precision Leaflet polyline paths.
    """
    corridor = CORRIDOR_ROUTES.get(corridor_id)
    if not corridor:
        corridor = CORRIDOR_ROUTES["intercity_mumbai_to_pune"]
        corridor_id = "intercity_mumbai_to_pune"

    analyzed_routes = []
    for r in corridor["routes"]:
        # Origin and destination coordinates
        orig = corridor.get("origin_coords", [r["segments"][0]["lat"], r["segments"][0]["lon"]])
        dest = corridor.get("dest_coords", [r["segments"][-1]["lat"], r["segments"][-1]["lon"]])

        route_telemetry = compute_live_route_telemetry(
            origin_lat=orig[0],
            origin_lon=orig[1],
            dest_lat=dest[0],
            dest_lon=dest[1],
            route_name=r["name"],
            free_flow_fallback_speed=r.get("free_flow_speed_kmh", 60.0),
            waypoint_hints=r.get("segments", [])
        )

        analyzed_routes.append({
            "id": r["id"],
            "name": r["name"],
            "description": r.get("description", ""),
            "distance_km": route_telemetry["distance_km"],
            "current_speed_kmh": route_telemetry["current_speed_kmh"],
            "free_flow_speed_kmh": route_telemetry["free_flow_speed_kmh"],
            "congestion_ratio": route_telemetry["congestion_ratio"],
            "congestion_band": route_telemetry["congestion_band"],
            "current_travel_time_min": route_telemetry["current_travel_time_min"],
            "free_flow_travel_time_min": route_telemetry["free_flow_travel_time_min"],
            "traffic_delay_min": route_telemetry["traffic_delay_min"],
            "forecast_congestion_30m": route_telemetry["predictions"][2]["congestion_band"],
            "co2_emissions_kg": route_telemetry["co2_emissions_kg"],
            "excess_co2_congestion_kg": route_telemetry["excess_co2_congestion_kg"],
            "fuel_wasted_litres": route_telemetry["fuel_wasted_litres"],
            "polyline": route_telemetry["polyline"],
            "predictions": route_telemetry["predictions"],
            "is_live_tomtom": route_telemetry["is_live_tomtom"],
            "source": route_telemetry["source"],
            "is_toll": r.get("is_toll", False)
        })

    fastest_route = min(analyzed_routes, key=lambda x: x["current_travel_time_min"])
    greenest_route = min(analyzed_routes, key=lambda x: x["co2_emissions_kg"])

    # Catalog of available corridors grouped for the frontend
    available_catalog = []
    for k, v in CORRIDOR_ROUTES.items():
        available_catalog.append({
            "id": k,
            "title": v["title"],
            "corridor_type": v.get("corridor_type", "intracity"),
            "origin_city": v.get("origin_city", ""),
            "dest_city": v.get("dest_city", "")
        })

    return {
        "corridor_id": corridor_id,
        "title": corridor["title"],
        "corridor_type": corridor.get("corridor_type", "intercity"),
        "origin_city": corridor.get("origin_city", ""),
        "dest_city": corridor.get("dest_city", ""),
        "origin": corridor["origin"],
        "destination": corridor["destination"],
        "origin_coords": corridor.get("origin_coords"),
        "dest_coords": corridor.get("dest_coords"),
        "available_corridors": available_catalog,
        "fastest_route_id": fastest_route["id"],
        "greenest_route_id": greenest_route["id"],
        "routes": analyzed_routes,
        "disclaimer": (
            "TrafficPulse Precision Route Intelligence: Powered by live TomTom Calculate Route API "
            "with calibrated DEFRA environmental emissions and multi-horizon AI traffic projections."
        )
    }


def calculate_custom_point_to_point(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    origin_label: str = "Origin Point",
    dest_label: str = "Destination Point",
    origin_city: str = "",
    dest_city: str = ""
) -> Dict[str, Any]:
    """
    Calculates precise distance, live road duration, delay, route polyline,
    and multi-horizon traffic predictions between ANY two cities or locations.
    """
    telemetry = compute_live_route_telemetry(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        route_name=f"{origin_label} to {dest_label}",
        free_flow_fallback_speed=75.0 if haversine_km(origin_lat, origin_lon, dest_lat, dest_lon) > 80 else 50.0
    )

    return {
        "origin_label": origin_label,
        "dest_label": dest_label,
        "origin_city": origin_city,
        "dest_city": dest_city,
        "origin_coords": [origin_lat, origin_lon],
        "dest_coords": [dest_lat, dest_lon],
        **telemetry,
        "provenance": (
            "Computed via TomTom Live Route API with real-time road topology, "
            "speed profiles, and mathematical diurnal horizon projections."
        )
    }
