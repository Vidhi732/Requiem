# TrafficPulse AI — Indian Traffic Forecasting & Smart Mobility Intelligence

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_19_TypeScript-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Styles-Tailwind_CSS_v4-38bdf8.svg)](https://tailwindcss.com/)
[![ML](https://img.shields.io/badge/Model-LightGBM_&_Ridge_Stacking-orange.svg)](https://lightgbm.readthedocs.io/)

A full-stack machine-learning traffic forecasting and mobility intelligence platform designed specifically for Indian metropolitan road networks (Bengaluru, Mumbai, Pune, and Delhi). The system learns empirical seasonal and diurnal velocity patterns from 8,936 verified Bengaluru traffic records, integrates live TomTom Traffic Flow segment telemetry, forecasts multi-horizon congestion for +15, +30, and +60 minutes, and explains predictions through a dark transport-control-room dashboard.

---

## Key Features

1. **Defensible Machine Learning Pipeline**:
   - Trained on historical Bengaluru traffic data (8,936 observations across 16 major corridors, 2022–2024).
   - Chronological train/test split (80/20) with safe chronological lag features (`speed_lag_1`, `speed_lag_7`, `congestion_lag_1`) strictly eliminating future data leakage.
   - Production model: **Multi-Model Ridge Stacking Ensemble** (combining LightGBM Gradient Boosted Trees and Random Forest with L2 Ridge meta-learner). Test MAE: **8.40 km/h**, RMSE: **10.50 km/h**.
   - Model 2 (Graph STGCN / Spatial LSTM) is transparently registered as an architectural standby module (not deceptively claimed as trained since continuous sub-hourly network topology sequences are not present in daily records).

2. **Real-Time TomTom Traffic API Integration**:
   - Integrates the TomTom Traffic Flow Segment Data API (`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`).
   - Query points configured for critical transportation corridors in **Bengaluru**, **Mumbai**, **Pune**, and **Delhi**.
   - Computes live $congestion\_ratio = current\_speed / free\_flow\_speed$.
   - Documented congestion bands:
     - **Low**: $\ge 80\%$ (Emerald Green)
     - **Moderate**: $60\% - 80\%$ (Amber Yellow)
     - **High**: $35\% - 60\%$ (Orange)
     - **Severe**: $< 35\%$ (Crimson Red)
   - Graceful fallback: when `TOMTOM_API_KEY` is unconfigured or rate-limited, deterministic simulated calibration traffic is displayed with clear labeling so the dashboard never breaks.

3. **Multi-Horizon Traffic Forecasting (+0m, +15m, +30m, +60m)**:
   - Formulated as an autoregressive diurnal decay model blending live TomTom flow speed with learned historical seasonal baselines.
   - Weight progression: 80% live at +15m $\rightarrow$ 60% live at +30m $\rightarrow$ 35% live at +60m.
   - Models empirical Indian commuter rush-hour surges (8:30–10:30 AM and 5:30–8:30 PM).
   - Clear disclosure that +15m sub-hourly predictions are approximate and not independently validated against 15-minute sensor ground truth.

4. **Cross-City Domain Calibration**:
   - Transfers learned historical temporal patterns from source city (Bengaluru) to target cities (Mumbai, Pune, Delhi).
   - Calibrates using target city's live speed ratio $\gamma = R_{target} / R_{source}$ with adjustable domain elasticity $\beta \in [0.2, 0.9]$.
   - Honest labeling: *Live-data-assisted cross-city calibration (Not validated zero-shot transfer learning)*.

5. **Cascade-Delay Propagation Engine**:
   - Graph network connecting coupled arterial hubs (Silk Board $\rightarrow$ HSR Layout $\rightarrow$ Sarjapur $\rightarrow$ Bellandur $\rightarrow$ Marathahalli).
   - Configurable shock severity slider and epicenter selector.
   - Physical attenuation diffusion rule: $Risk_{downstream} = Severity \times Coupling \times e^{-0.18 \cdot distance}$.
   - Displays simulated spillover arrival timelines.

6. **Dynamic Green Wave Adaptive Signal Simulator**:
   - What-if simulator evaluating adaptive green split reallocation (+10% to +50%).
   - Displays simulated velocity improvements (+15% to +28%) and idle delay reductions (-25% to -40%).
   - Explicit disclaimer that the tool does not actuate real-world municipal controllers.

7. **Carbon & Smart Route Comparison**:
   - Compares alternative routes for high-volume corridors (e.g. Koramangala to Whitefield via ORR vs Old Airport Rd vs Sarjapur).
   - Computes defensible CO2 footprint using DEFRA vehicle baseline (140g/km) with non-linear congestion penalty: $E = Distance \times 140 \times [1 + 1.6 \times (1 - ratio)^2]$.

8. **Conversational Traffic Intelligence Assistant**:
   - Grounded in live telemetry and ML forecast JSON outputs.
   - Supports Gemini API if `GEMINI_API_KEY` is provided; otherwise runs an intelligent deterministic rule-based transport reasoning engine.

9. **Interactive Leaflet Map**:
   - Dark cartographic styling with OpenStreetMap tiles.
   - Color-coded glowing corridor marker pins with live/forecast velocity badges.
   - Interactive horizon switcher: Now, +15 min, +30 min, +60 min.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |         TrafficPulse AI Frontend      |
                      |   React 19 + TypeScript + Vite 8      |
                      |    Tailwind CSS v4 + Leaflet Map      |
                      +-------------------+-------------------+
                                          | HTTP /api/*
                                          v
                      +---------------------------------------+
                      |          FastAPI REST Backend         |
                      |        (Python 3.11+ / Uvicorn)       |
                      +----+--------------+---------------+---+
                           |              |               |
             +-------------+              |               +-------------+
             v                            v                             v
  +--------------------+       +--------------------+       +--------------------+
  | TomTom Flow API    |       | ML Forecast Engine |       | Domain Calibration |
  | Live road segments |       | Stacking Ensemble  |       | Cross-city Live    |
  | in BLR/BOM/PNQ/DEL |       | LightGBM + Ridge   |       | Telemetry Scaling  |
  +--------------------+       +--------------------+       +--------------------+
             |                            |                             |
             +-------------+--------------+-----------------------------+
                           v
              +--------------------------+
              | Multi-Horizon Forecasts  |
              | Cascade Delay Simulation |
              | Green Wave Optimization  |
              | Carbon & Route Engine    |
              | Grounded AI Assistant    |
              +--------------------------+
```

---

## Directory Structure

```
requim/
├── Banglore_traffic_Dataset.csv   # Historical dataset (8,936 records, 2022-2024)
├── .env.example                   # Environment configuration template
├── .env                           # Local environment variables
├── README.md                      # Complete setup & technical documentation
├── backend/
│   ├── config.py                  # Cities, corridors, API keys & paths
│   ├── data_pipeline.py           # Timestamp parsing, safe lags, train/test split
│   ├── train_model.py             # Trains LightGBM & Stacking Ensemble, saves joblib
│   ├── tomtom_service.py          # TomTom Flow Segment API client & fallback
│   ├── forecast_service.py        # Multi-horizon (+15/30/60m) blended ML forecast
│   ├── calibration_service.py     # Cross-city domain calibration service
│   ├── cascade_service.py         # Network propagation graph simulation
│   ├── green_wave_service.py      # Adaptive traffic signal what-if simulator
│   ├── route_service.py           # Carbon footprint & route comparison engine
│   ├── assistant_service.py       # Grounded AI assistant (Gemini / rule engine)
│   ├── main.py                    # FastAPI application & REST endpoints
│   ├── models/
│   │   ├── traffic_model.joblib   # Trained production stacking pipeline
│   │   └── model_metadata.json    # Evaluated MAE, RMSE, and feature importances
│   └── tests/
│       └── test_api.py            # Unit tests for classification, API & services
└── frontend/
    ├── package.json
    ├── vite.config.ts             # Vite with Tailwind v4 & /api proxy
    ├── tsconfig.app.json
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx                # Main dashboard control room layout
    │   ├── index.css              # Dark theme tokens and Leaflet styles
    │   ├── types.ts               # TypeScript data models
    │   ├── api.ts                 # Typed fetch client
    │   └── components/
    │       ├── TrafficMap.tsx              # Leaflet map with colored pins & lines
    │       ├── ForecastTimelinePanel.tsx   # Horizon buttons (+15/30/60m) & factors
    │       ├── HistoricalChartPanel.tsx    # Recharts trends & ML importances
    │       ├── CalibrationPanel.tsx        # Cross-city before/after cards
    │       ├── CascadeDelayPanel.tsx       # Graph shockwave cascade simulator
    │       ├── GreenWavePanel.tsx          # Adaptive signal simulator
    │       ├── RouteComparisonPanel.tsx    # CO2 & delay comparison
    │       └── TrafficAssistantModal.tsx   # Conversational assistant
```

---

## Setup & Run Instructions (Windows PowerShell)

### Prerequisites
- **Python 3.11+** installed and added to PATH
- **Node.js v18+** & **npm** installed
- Windows PowerShell

### Step 1: Clone or Navigate to Project Directory
```powershell
cd c:\Users\Admin\Downloads\APSIT_files\requim
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
*(Optional: Add your free TomTom API key in `.env` under `TOMTOM_API_KEY`. If left empty, the application automatically runs in deterministic demonstration fallback mode).*

### Step 3: Verify or Re-Train ML Model
The trained model (`traffic_model.joblib`) and evaluated metadata (`model_metadata.json`) are already generated. If you wish to re-train the model pipeline from the raw CSV:
```powershell
python -m backend.train_model
```
Output:
```
Tabular Model (LightGBM) -> MAE: 8.484 km/h, RMSE: 10.642 km/h
Stacking Ensemble        -> MAE: 8.397 km/h, RMSE: 10.500 km/h
Model saved to backend/models/traffic_model.joblib
```

### Step 4: Run Backend Tests
Run the automated test suite verifying all 8 core services and endpoints:
```powershell
python -c "from backend.tests.test_api import test_congestion_classification_bands, test_health_endpoint, test_cities_endpoint, test_forecast_service, test_calibration_service, test_cascade_endpoint, test_green_wave_endpoint, test_assistant_endpoint; test_congestion_classification_bands(); test_health_endpoint(); test_cities_endpoint(); test_forecast_service(); test_calibration_service(); test_cascade_endpoint(); test_green_wave_endpoint(); test_assistant_endpoint(); print('ALL 8 TESTS PASSED!')"
```

### Step 5: Start the FastAPI Backend Server
In PowerShell:
```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API docs will be accessible at: `http://127.0.0.1:8000/docs`

### Step 6: Start the Frontend Application
Open a new PowerShell window, navigate to the `frontend` folder, and launch Vite:
```powershell
cd c:\Users\Admin\Downloads\APSIT_files\requim\frontend
npm run dev
```
Open your browser and navigate to:
```
http://localhost:5173
```

---

## Documented API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status, model readiness, TomTom/Gemini config status |
| `GET` | `/api/cities` | List of supported Indian cities with corridor coordinates |
| `GET` | `/api/traffic/live?city=Bengaluru` | Real-time TomTom flow segment telemetry for city corridors |
| `POST` | `/api/forecast` | Generates +0m, +15m, +30m, +60m forecasts with explanatory factors |
| `GET` | `/api/history?road=100 Feet Road` | Bengaluru verified historical time-series & day-of-week profiles |
| `GET` | `/api/model/metadata` | Model evaluation metrics (MAE, RMSE, R2) and top feature importances |
| `POST` | `/api/calibration` | Executes cross-city domain calibration with elasticity adjustment |
| `POST` | `/api/simulation/cascade` | Simulates shockwave queue spillover across connected network nodes |
| `POST` | `/api/simulation/green-wave` | What-if adaptive signal split optimization simulator |
| `GET` | `/api/routes/comparison` | Compares corridor routes on travel times, delay, and CO2 emissions |
| `POST` | `/api/assistant` | Conversational assistant query grounded in current telemetry JSON |

---

## Limitations & Engineering Disclosures

1. **Temporal Dataset Granularity**:
   - The historical Bengaluru dataset aggregates observations on a daily basis.
   - Consequently, sub-hourly horizons (+15m, +30m, +60m) are modeled by synthesizing the trained model's learned seasonal expectations with real-time TomTom segment speed and empirical metropolitan diurnal commuter curves. They are approximate and have not been independently validated against 15-minute sensor ground truth.
2. **Point Segment Telemetry**:
   - TomTom Flow Segment Data queries return flow for the nearest indexed road segment to the target coordinate, representing critical corridors rather than an entire city's aggregate road grid.
3. **Simulated Modules**:
   - Cascade-delay propagation, Green Wave adaptive signal timing, and cross-city calibration are theoretical what-if engineering models and do not actuate real-world municipal traffic controllers.
