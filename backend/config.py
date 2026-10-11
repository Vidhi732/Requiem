import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

def get_tomtom_api_key() -> str:
    """Reads TOMTOM_API_KEY from environment or .env file."""
    key = os.getenv("TOMTOM_API_KEY", "").strip()
    if not key or key.startswith("YOUR_"):
        load_dotenv(BASE_DIR / ".env", override=True)
        key = os.getenv("TOMTOM_API_KEY", "").strip()
    if key.startswith("YOUR_"):
        return ""
    return key

TOMTOM_API_KEY = get_tomtom_api_key()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

DATA_PATH = BASE_DIR / "Banglore_traffic_Dataset.csv"
MODEL_DIR = BASE_DIR / "backend" / "models"
MODEL_PATH = MODEL_DIR / "traffic_model.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

# Ensure model directory exists
MODEL_DIR.mkdir(parents=True, exist_ok=True)

def parse_coords(env_var: str, default: list) -> list:
    """Parses 'lat,lon' from environment variable, falling back to default."""
    raw = os.getenv(env_var, "").strip()
    if raw:
        try:
            parts = [float(p.strip()) for p in raw.split(",")]
            if len(parts) == 2:
                return parts
        except Exception:
            pass
    return default

# Configurable center coordinates for Major Indian Cities
BENGALURU_CENTER = parse_coords("BENGALURU_COORDS", [12.9716, 77.5946])
MUMBAI_CENTER = parse_coords("MUMBAI_COORDS", [19.0760, 72.8777])
PUNE_CENTER = parse_coords("PUNE_COORDS", [18.5204, 73.8567])
DELHI_CENTER = parse_coords("DELHI_COORDS", [28.6139, 77.2090])
HYDERABAD_CENTER = parse_coords("HYDERABAD_COORDS", [17.3850, 78.4867])
CHENNAI_CENTER = parse_coords("CHENNAI_COORDS", [13.0827, 80.2707])
KOLKATA_CENTER = parse_coords("KOLKATA_COORDS", [22.5726, 88.3639])

# Comprehensive Road Segments & Corridors per City
CITIES = {
    "Mumbai": {
        "name": "Mumbai",
        "state": "Maharashtra",
        "center": MUMBAI_CENTER,
        "roads": [
            {
                "id": "mum_weh_andheri",
                "name": "Western Express Highway (Andheri)",
                "corridor": "Andheri Flyover / Gundavali",
                "lat": 19.1197,
                "lon": 72.8468,
                "free_flow_speed": 60.0,
                "historical_area": "Highway"
            },
            {
                "id": "mum_bandra_sealink",
                "name": "Bandra-Worli Sea Link",
                "corridor": "Bandra Toll Plaza / Worli Sea Face",
                "lat": 19.0330,
                "lon": 72.8180,
                "free_flow_speed": 75.0,
                "historical_area": "Coastal Corridor"
            },
            {
                "id": "mum_eeh_ghatkopar",
                "name": "Eastern Express Highway (Ghatkopar)",
                "corridor": "Chheda Nagar / Ghatkopar Junction",
                "lat": 19.0860,
                "lon": 72.9090,
                "free_flow_speed": 55.0,
                "historical_area": "Highway"
            },
            {
                "id": "mum_atal_setu_mthl",
                "name": "Atal Setu (MTHL Trans Harbour Link)",
                "corridor": "Sewri Interchange to Nhava Sheva",
                "lat": 18.9950,
                "lon": 72.8800,
                "free_flow_speed": 95.0,
                "historical_area": "Sea Crossing Expressway"
            },
            {
                "id": "mum_bkc_connector",
                "name": "BKC Connector / Kalanagar",
                "corridor": "Bandra Kurla Complex Central Avenue",
                "lat": 19.0657,
                "lon": 72.8685,
                "free_flow_speed": 40.0,
                "historical_area": "Financial District"
            },
            {
                "id": "mum_eastern_freeway",
                "name": "Eastern Freeway (Orange Gate)",
                "corridor": "Wadi Bunder to Panjarpol",
                "lat": 18.9550,
                "lon": 72.8420,
                "free_flow_speed": 70.0,
                "historical_area": "Elevated Expressway"
            },
            {
                "id": "mum_sclr_chembur",
                "name": "Santacruz-Chembur Link Road (SCLR)",
                "corridor": "Kurla-Chembur Double Decker Flyover",
                "lat": 19.0710,
                "lon": 72.8840,
                "free_flow_speed": 45.0,
                "historical_area": "Cross Arterial"
            },
            {
                "id": "mum_jvlr_powai",
                "name": "Jogeshwari-Vikhroli Link Road (JVLR)",
                "corridor": "Powai Lake / IIT Bombay Corridor",
                "lat": 19.1275,
                "lon": 72.9045,
                "free_flow_speed": 48.0,
                "historical_area": "East-West Arterial"
            },
            {
                "id": "mum_weh_borivali",
                "name": "WEH - Borivali National Park",
                "corridor": "Dahisar Toll / Sanjay Gandhi NP Gate",
                "lat": 19.2290,
                "lon": 72.8640,
                "free_flow_speed": 65.0,
                "historical_area": "Northern Highway"
            },
            {
                "id": "mum_sion_circle",
                "name": "Sion Circle / Bhaudaji Road",
                "corridor": "Dr. Ambedkar Road Junction",
                "lat": 19.0390,
                "lon": 72.8619,
                "free_flow_speed": 35.0,
                "historical_area": "Arterial Choke Point"
            },
            {
                "id": "mum_marine_drive",
                "name": "Marine Drive / Nariman Point",
                "corridor": "Netaji Subhash Chandra Bose Road",
                "lat": 18.9438,
                "lon": 72.8232,
                "free_flow_speed": 50.0,
                "historical_area": "Promenade Boulevard"
            },
            {
                "id": "mum_vashi_bridge",
                "name": "Vashi Bridge / Sion-Panvel Expressway",
                "corridor": "Thane Creek Crossing to Navi Mumbai",
                "lat": 19.0620,
                "lon": 72.9860,
                "free_flow_speed": 65.0,
                "historical_area": "Creek Tollway"
            },
            {
                "id": "mum_eeh_thane_toll",
                "name": "EEH - Thane Majiwada Junction",
                "corridor": "Ghodbunder Road / Nashik Highway Split",
                "lat": 19.2130,
                "lon": 72.9780,
                "free_flow_speed": 50.0,
                "historical_area": "Thane Hub"
            },
            {
                "id": "mum_palm_beach_road",
                "name": "Palm Beach Road (Navi Mumbai)",
                "corridor": "Vashi to CBD Belapur Coastal Road",
                "lat": 19.0280,
                "lon": 73.0180,
                "free_flow_speed": 65.0,
                "historical_area": "High-Speed Sector"
            }
        ]
    },
    "Pune": {
        "name": "Pune",
        "state": "Maharashtra",
        "center": PUNE_CENTER,
        "roads": [
            {
                "id": "pune_hinjewadi_ph1",
                "name": "Hinjewadi Phase 1",
                "corridor": "Rajiv Gandhi Infotech Park Main Gate",
                "lat": 18.5913,
                "lon": 73.7389,
                "free_flow_speed": 45.0,
                "historical_area": "IT Park"
            },
            {
                "id": "pune_hinjewadi_ph3",
                "name": "Hinjewadi Phase 3 (Megapolis)",
                "corridor": "Tech Mahindra / TCS Sahyadri Corridor",
                "lat": 18.5830,
                "lon": 73.7020,
                "free_flow_speed": 50.0,
                "historical_area": "Tech Corridor"
            },
            {
                "id": "pune_wakad_bridge",
                "name": "Wakad Bridge / Chowk",
                "corridor": "Mumbai-Bangalore Bypass NH-48",
                "lat": 18.5987,
                "lon": 73.7634,
                "free_flow_speed": 55.0,
                "historical_area": "Bypass Junction"
            },
            {
                "id": "pune_chandani_chowk",
                "name": "Chandani Chowk Flyover",
                "corridor": "Paud Road / Kothrud Expressway Cloverleaf",
                "lat": 18.5080,
                "lon": 73.7850,
                "free_flow_speed": 55.0,
                "historical_area": "Multi-Level Interchange"
            },
            {
                "id": "pune_kiwale_expressway",
                "name": "Kiwale Interchange (MPEW Start)",
                "corridor": "Yashwantrao Chavan Mumbai-Pune Expressway",
                "lat": 18.6630,
                "lon": 73.7370,
                "free_flow_speed": 85.0,
                "historical_area": "Expressway Terminal"
            },
            {
                "id": "pune_baner_road",
                "name": "Baner Road High Street",
                "corridor": "Aundh to Balewadi Sports Complex",
                "lat": 18.5590,
                "lon": 73.7890,
                "free_flow_speed": 42.0,
                "historical_area": "Commercial Corridor"
            },
            {
                "id": "pune_fc_road",
                "name": "Fergusson College Road",
                "corridor": "Shivaji Nagar / Ghole Road",
                "lat": 18.5284,
                "lon": 73.8427,
                "free_flow_speed": 35.0,
                "historical_area": "Central City Arterial"
            },
            {
                "id": "pune_swargate",
                "name": "Swargate Chowk",
                "corridor": "Satara Road / Jedhe Flyover",
                "lat": 18.5018,
                "lon": 73.8586,
                "free_flow_speed": 30.0,
                "historical_area": "Transit Hub"
            },
            {
                "id": "pune_magarpatta_hadapsar",
                "name": "Magarpatta Cybercity / Hadapsar",
                "corridor": "Pune-Solapur Road",
                "lat": 18.5140,
                "lon": 73.9280,
                "free_flow_speed": 45.0,
                "historical_area": "Eastern Tech Hub"
            },
            {
                "id": "pune_kharadi_eon",
                "name": "Kharadi Bypass (EON Free Zone)",
                "corridor": "Ahmednagar Highway / World Trade Center",
                "lat": 18.5520,
                "lon": 73.9480,
                "free_flow_speed": 48.0,
                "historical_area": "IT Corridor"
            },
            {
                "id": "pune_airport_viman_nagar",
                "name": "Viman Nagar / Airport Road",
                "corridor": "Symbiosis to Pune International Airport",
                "lat": 18.5720,
                "lon": 73.9130,
                "free_flow_speed": 40.0,
                "historical_area": "Airport Arterial"
            },
            {
                "id": "pune_katraj_tunnel",
                "name": "New Katraj Tunnel",
                "corridor": "NH-48 Pune-Satara-Bengaluru Highway",
                "lat": 18.4230,
                "lon": 73.8580,
                "free_flow_speed": 65.0,
                "historical_area": "Mountain Pass Highway"
            }
        ]
    },
    "Bengaluru": {
        "name": "Bengaluru",
        "state": "Karnataka",
        "center": BENGALURU_CENTER,
        "roads": [
            {
                "id": "blr_silk_board",
                "name": "Silk Board Junction",
                "corridor": "Hosur Road / Outer Ring Road",
                "lat": 12.9176,
                "lon": 77.6238,
                "free_flow_speed": 45.0,
                "historical_area": "Electronic City"
            },
            {
                "id": "blr_sony_world",
                "name": "Sony World Junction",
                "corridor": "80 Feet Road Koramangala",
                "lat": 12.9345,
                "lon": 77.6265,
                "free_flow_speed": 40.0,
                "historical_area": "Koramangala"
            },
            {
                "id": "blr_100ft_indiranagar",
                "name": "100 Feet Road",
                "corridor": "Indiranagar 12th Main",
                "lat": 12.9719,
                "lon": 77.6412,
                "free_flow_speed": 40.0,
                "historical_area": "Indiranagar"
            },
            {
                "id": "blr_marathahalli",
                "name": "Marathahalli Bridge",
                "corridor": "HAL Airport / Varthur Rd",
                "lat": 12.9562,
                "lon": 77.7011,
                "free_flow_speed": 50.0,
                "historical_area": "Whitefield"
            },
            {
                "id": "blr_hebbal",
                "name": "Hebbal Flyover",
                "corridor": "Airport Expressway / Bellary Rd",
                "lat": 13.0358,
                "lon": 77.5970,
                "free_flow_speed": 55.0,
                "historical_area": "Hebbal"
            },
            {
                "id": "blr_bellandur_ecospace",
                "name": "Bellandur EcoSpace (ORR)",
                "corridor": "Outer Ring Road Tech Corridor",
                "lat": 12.9260,
                "lon": 77.6770,
                "free_flow_speed": 48.0,
                "historical_area": "ORR Tech Parks"
            },
            {
                "id": "blr_kr_puram",
                "name": "KR Puram Hanging Bridge",
                "corridor": "Old Madras Road NH-75 Junction",
                "lat": 13.0010,
                "lon": 77.6970,
                "free_flow_speed": 45.0,
                "historical_area": "Eastern Transit Gateway"
            },
            {
                "id": "blr_electronic_city_elevated",
                "name": "Electronic City Tollway",
                "corridor": "Hosur Road NH-44 Elevated Highway",
                "lat": 12.8450,
                "lon": 77.6650,
                "free_flow_speed": 75.0,
                "historical_area": "Elevated Expressway"
            },
            {
                "id": "blr_whitefield_itpl",
                "name": "ITPL Main Road (Whitefield)",
                "corridor": "Hope Farm to Pattandur Agrahara",
                "lat": 12.9860,
                "lon": 77.7380,
                "free_flow_speed": 42.0,
                "historical_area": "Whitefield IT Cluster"
            },
            {
                "id": "blr_trinity",
                "name": "Trinity Circle",
                "corridor": "M.G. Road Corridor",
                "lat": 12.9734,
                "lon": 77.6186,
                "free_flow_speed": 35.0,
                "historical_area": "M.G. Road"
            },
            {
                "id": "blr_jayanagar",
                "name": "Jayanagar 4th Block",
                "corridor": "Rashtriya Vidyalaya Road",
                "lat": 12.9298,
                "lon": 77.5833,
                "free_flow_speed": 38.0,
                "historical_area": "Jayanagar"
            },
            {
                "id": "blr_yeshwanthpur",
                "name": "Yeshwanthpur Circle",
                "corridor": "Tumkur Road Junction NH-48",
                "lat": 13.0238,
                "lon": 77.5503,
                "free_flow_speed": 42.0,
                "historical_area": "Yeshwanthpur"
            },
            {
                "id": "blr_peenya_goraguntepalya",
                "name": "Goraguntepalya / Peenya",
                "corridor": "Bangalore-Pune Highway Elevated Flyover",
                "lat": 13.0290,
                "lon": 77.5380,
                "free_flow_speed": 60.0,
                "historical_area": "Industrial Gateway"
            },
            {
                "id": "blr_mysore_road_flyover",
                "name": "Mysore Road Satellite Bus Station",
                "corridor": "Bangalore-Mysore Expressway Entry",
                "lat": 12.9540,
                "lon": 77.5450,
                "free_flow_speed": 45.0,
                "historical_area": "Interstate Terminal"
            }
        ]
    },
    "Delhi": {
        "name": "Delhi",
        "state": "Delhi NCR",
        "center": DELHI_CENTER,
        "roads": [
            {
                "id": "del_ito",
                "name": "ITO Junction",
                "corridor": "Vikas Marg Intersection",
                "lat": 28.6304,
                "lon": 77.2410,
                "free_flow_speed": 40.0,
                "historical_area": "Commercial"
            },
            {
                "id": "del_cp",
                "name": "Connaught Place Outer Circle",
                "corridor": "Connaught Circus",
                "lat": 28.6328,
                "lon": 77.2197,
                "free_flow_speed": 35.0,
                "historical_area": "CBD"
            },
            {
                "id": "del_aiims",
                "name": "AIIMS Ring Road Flyover",
                "corridor": "Mahatma Gandhi Marg",
                "lat": 28.5672,
                "lon": 77.2100,
                "free_flow_speed": 50.0,
                "historical_area": "Ring Road"
            },
            {
                "id": "del_dhaula_kuan",
                "name": "Dhaula Kuan Interchange",
                "corridor": "NH-48 / Ring Road",
                "lat": 28.5916,
                "lon": 77.1614,
                "free_flow_speed": 55.0,
                "historical_area": "Interchange"
            },
            {
                "id": "del_dnd_flyway",
                "name": "DND Flyway",
                "corridor": "Delhi-Noida Direct Toll Bridge",
                "lat": 28.5780,
                "lon": 77.2890,
                "free_flow_speed": 70.0,
                "historical_area": "Tollway"
            },
            {
                "id": "del_gurgaon_cyberhub",
                "name": "Delhi-Gurgaon Expressway (Cyber Hub)",
                "corridor": "NH-48 Shankar Chowk / DLF Cyber City",
                "lat": 28.4980,
                "lon": 77.0910,
                "free_flow_speed": 65.0,
                "historical_area": "Corporate Corridor"
            },
            {
                "id": "del_ashram_flyover",
                "name": "Ashram Chowk Underpass",
                "corridor": "Mathura Road / Ring Road Bypass",
                "lat": 28.5710,
                "lon": 77.2600,
                "free_flow_speed": 45.0,
                "historical_area": "Southern Arterial"
            },
            {
                "id": "del_noida_expressway",
                "name": "Noida-Greater Noida Expressway",
                "corridor": "Sector 18 to Pari Chowk",
                "lat": 28.5350,
                "lon": 77.3620,
                "free_flow_speed": 75.0,
                "historical_area": "NCR Expressway"
            }
        ]
    },
    "Hyderabad": {
        "name": "Hyderabad",
        "state": "Telangana",
        "center": HYDERABAD_CENTER,
        "roads": [
            {
                "id": "hyd_hitec_city",
                "name": "HITEC City Cyber Towers",
                "corridor": "Madhapur IT Hub / Inorbit Mall Road",
                "lat": 17.4504,
                "lon": 78.3808,
                "free_flow_speed": 45.0,
                "historical_area": "Cyberabad IT Corridor"
            },
            {
                "id": "hyd_gachibowli_junction",
                "name": "Gachibowli Junction",
                "corridor": "Financial District / Wipro Circle",
                "lat": 17.4401,
                "lon": 78.3489,
                "free_flow_speed": 50.0,
                "historical_area": "Financial District"
            },
            {
                "id": "hyd_orr_nanakramguda",
                "name": "Outer Ring Road (ORR Nanakramguda)",
                "corridor": "Nehru Outer Ring Road Expressway",
                "lat": 17.4180,
                "lon": 78.3440,
                "free_flow_speed": 85.0,
                "historical_area": "Expressway"
            },
            {
                "id": "hyd_pvnr_expressway",
                "name": "PVNR Elevated Expressway",
                "corridor": "Mehdipatnam to RGIA Airport Corridor",
                "lat": 17.3820,
                "lon": 78.4350,
                "free_flow_speed": 75.0,
                "historical_area": "Airport Expressway"
            },
            {
                "id": "hyd_begumpet_flyover",
                "name": "Begumpet Flyover",
                "corridor": "Old Airport Road / Rashtrapati Road",
                "lat": 17.4440,
                "lon": 78.4680,
                "free_flow_speed": 40.0,
                "historical_area": "Central Arterial"
            },
            {
                "id": "hyd_jubilee_hills",
                "name": "Jubilee Hills Checkpost",
                "corridor": "Road No. 36 Commercial District",
                "lat": 17.4310,
                "lon": 78.4110,
                "free_flow_speed": 42.0,
                "historical_area": "Urban Spine"
            }
        ]
    },
    "Chennai": {
        "name": "Chennai",
        "state": "Tamil Nadu",
        "center": CHENNAI_CENTER,
        "roads": [
            {
                "id": "chn_omr_tidel",
                "name": "OMR Rajiv Gandhi Salai (TIDEL Park)",
                "corridor": "Tharamani to Sholinganallur IT Expressway",
                "lat": 12.9890,
                "lon": 80.2480,
                "free_flow_speed": 55.0,
                "historical_area": "IT Corridor"
            },
            {
                "id": "chn_kathipara_cloverleaf",
                "name": "Kathipara Cloverleaf Flyover",
                "corridor": "Guindy / GST Road Intersection",
                "lat": 13.0070,
                "lon": 80.2050,
                "free_flow_speed": 60.0,
                "historical_area": "Major Interchange"
            },
            {
                "id": "chn_anna_salai",
                "name": "Anna Salai (Gemini Flyover)",
                "corridor": "Mount Road Arterial Backbone",
                "lat": 13.0530,
                "lon": 80.2520,
                "free_flow_speed": 40.0,
                "historical_area": "Central CBD"
            },
            {
                "id": "chn_gst_airport",
                "name": "GST Road (Chennai Airport)",
                "corridor": "Grand Southern Trunk Road NH-32",
                "lat": 12.9810,
                "lon": 80.1630,
                "free_flow_speed": 60.0,
                "historical_area": "Airport Gateway"
            },
            {
                "id": "chn_koyambedu_cmbt",
                "name": "Koyambedu CMBT Junction",
                "corridor": "Inner Ring Road 100 Feet Road",
                "lat": 13.0690,
                "lon": 80.1940,
                "free_flow_speed": 40.0,
                "historical_area": "Intercity Terminal"
            }
        ]
    },
    "Kolkata": {
        "name": "Kolkata",
        "state": "West Bengal",
        "center": KOLKATA_CENTER,
        "roads": [
            {
                "id": "kol_maa_flyover",
                "name": "Maa Flyover (Science City)",
                "corridor": "Park Circus to EM Bypass Connector",
                "lat": 22.5390,
                "lon": 88.3970,
                "free_flow_speed": 60.0,
                "historical_area": "Elevated Flyover"
            },
            {
                "id": "kol_vidyasagar_setu",
                "name": "Vidyasagar Setu (2nd Hooghly Bridge)",
                "corridor": "Kolkata-Howrah Cable-Stayed Tollway",
                "lat": 22.5580,
                "lon": 72.8200 if False else 88.3240,
                "free_flow_speed": 65.0,
                "historical_area": "River Crossing"
            },
            {
                "id": "kol_newtown_major_arterial",
                "name": "Newtown Major Arterial Road",
                "corridor": "Biswa Bangla Gate to Eco Park",
                "lat": 22.5850,
                "lon": 88.4680,
                "free_flow_speed": 60.0,
                "historical_area": "Smart City Spine"
            },
            {
                "id": "kol_sector_v_saltlake",
                "name": "Sector V Salt Lake",
                "corridor": "Webel Bhavan / College More IT Hub",
                "lat": 22.5760,
                "lon": 88.4340,
                "free_flow_speed": 40.0,
                "historical_area": "IT Cluster"
            },
            {
                "id": "kol_howrah_bridge",
                "name": "Howrah Bridge (Rabindra Setu)",
                "corridor": "Strand Road to Howrah Station",
                "lat": 22.5850,
                "lon": 88.3470,
                "free_flow_speed": 35.0,
                "historical_area": "Historic Transit Spine"
            }
        ]
    }
}
