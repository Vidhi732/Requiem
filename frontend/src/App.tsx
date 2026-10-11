import React, { useState, useEffect } from "react";
import {
  fetchHealth,
  fetchCities,
  fetchLiveTraffic,
  fetchForecast,
  fetchModelMetadata,
  fetchHistory,
} from "./api";
import {
  CityTrafficData,
  ForecastResponse,
  ModelMetadata,
  HistoryResponse,
  RoadSegment,
  RouteHorizonPrediction,
} from "./types";
import { TrafficMap } from "./components/TrafficMap";
import { ForecastTimelinePanel } from "./components/ForecastTimelinePanel";
import { HistoricalChartPanel } from "./components/HistoricalChartPanel";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { CascadeDelayPanel } from "./components/CascadeDelayPanel";
import { GreenWavePanel } from "./components/GreenWavePanel";
import { RouteComparisonPanel } from "./components/RouteComparisonPanel";
import { TrafficAssistantModal } from "./components/TrafficAssistantModal";
import { DatasetProvenanceModal } from "./components/DatasetProvenanceModal";
import { TomTomDiagnosticsModal } from "./components/TomTomDiagnosticsModal";
import { PredictiveTimeTravel } from "./components/PredictiveTimeTravel";

import {
  Activity,
  Gauge,
  MapPin,
  Bot,
  Zap,
  GitFork,
  Building2,
  Leaf,
  ShieldCheck,
  AlertOctagon,
  Clock,
  AlertTriangle,
  Database,
  Navigation,
} from "lucide-react";

export function App() {
  const [selectedCity, setSelectedCity] = useState("Bengaluru");
  const [citiesList, setCitiesList] = useState<any[]>([]);
  const [cityTraffic, setCityTraffic] = useState<CityTrafficData | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string>("blr_silk_board");
  const [horizon, setHorizon] = useState<number>(0); // 0, 15, 30, 60
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);

  // Temporal & Contextual Prediction State
  const [targetDateTime, setTargetDateTime] = useState<string>(() => {
    const now = new Date();
    // Default to today at 18:30 (evening rush hour)
    now.setHours(18, 30, 0, 0);
    return now.toISOString().slice(0, 16);
  });
  const [weatherCondition, setWeatherCondition] = useState<string>("Clear");
  const [roadworkCondition, setRoadworkCondition] = useState<string>("No");
  const [festivalScenario, setFestivalScenario] = useState<string>("None");
  const [isCustomPredictionActive, setIsCustomPredictionActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    "historical" | "calibration" | "cascade" | "greenwave" | "routes"
  >("routes");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Active Map Route Navigation State (Inter-City & Intra-City)
  const [activeRoutePolyline, setActiveRoutePolyline] = useState<[number, number][] | undefined>(undefined);
  const [activeRouteOrigin, setActiveRouteOrigin] = useState<{ label: string; coords: [number, number] } | undefined>(undefined);
  const [activeRouteDest, setActiveRouteDest] = useState<{ label: string; coords: [number, number] } | undefined>(undefined);
  const [activeRouteInfo, setActiveRouteInfo] = useState<{ distance_km: number; travel_time_min: number; title: string } | undefined>(undefined);
  const [activeRoutePredictions, setActiveRoutePredictions] = useState<RouteHorizonPrediction[] | undefined>(undefined);

  // Initial load: health check, cities, model metadata
  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth();
        setBackendHealth(health);
        const citiesData = await fetchCities();
        setCitiesList(citiesData.cities);
        const meta = await fetchModelMetadata();
        setMetadata(meta);
      } catch (err: any) {
        console.error("Initialization error:", err);
        setApiError(`FastAPI Connection Alert: ${err.message || "Failed to reach backend services"}`);
      }
    }
    init();
  }, []);

  // Load city live traffic when selectedCity changes
  useEffect(() => {
    async function loadTraffic() {
      setLoading(true);
      setApiError(null);
      try {
        const data = await fetchLiveTraffic(selectedCity);
        setCityTraffic(data);

        // Pick first road if current selection not in city
        const roadExists = data.roads.some((r) => r.id === selectedRoadId);
        if (!roadExists && data.roads.length > 0) {
          setSelectedRoadId(data.roads[0].id);
        }
      } catch (err: any) {
        console.error("Traffic load error:", err);
        setApiError(`Live traffic fetch error for ${selectedCity}: ${err.message || "Request failed"}`);
      } finally {
        setLoading(false);
      }
    }
    loadTraffic();
  }, [selectedCity]);

  // Load forecast whenever selectedRoadId, selectedCity, or contextual parameters change
  const executeForecastFetch = async (
    customTs?: string,
    customFest?: string,
    customWeather?: string,
    customRoadwork?: string
  ) => {
    if (!selectedRoadId) return;
    setForecastLoading(true);
    try {
      const ts = customTs !== undefined ? customTs : (isCustomPredictionActive ? targetDateTime : undefined);
      const fest = customFest !== undefined ? customFest : (isCustomPredictionActive ? festivalScenario : undefined);
      const w = customWeather !== undefined ? customWeather : weatherCondition;
      const rw = customRoadwork !== undefined ? customRoadwork : roadworkCondition;

      const f = await fetchForecast(
        selectedCity,
        selectedRoadId,
        w,
        rw,
        ts,
        fest,
        horizon
      );
      setForecast(f);
    } catch (err: any) {
      console.error("Forecast error:", err);
      setApiError(`Forecast computation error for corridor ${selectedRoadId}: ${err.message || "Request failed"}`);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    executeForecastFetch();
  }, [selectedCity, selectedRoadId]);

  const handleApplyTemporalPrediction = () => {
    setIsCustomPredictionActive(true);
    executeForecastFetch(targetDateTime, festivalScenario, weatherCondition, roadworkCondition);
  };

  const handleResetToLive = () => {
    setIsCustomPredictionActive(false);
    setWeatherCondition("Clear");
    setRoadworkCondition("No");
    setFestivalScenario("None");
    executeForecastFetch(undefined, undefined, "Clear", "No");
  };

  // Load historical data for selected road
  useEffect(() => {
    async function loadHist() {
      const activeRoad = cityTraffic?.roads.find((r) => r.id === selectedRoadId);
      const roadName = activeRoad?.historical_area || "100 Feet Road";
      try {
        const h = await fetchHistory(roadName);
        setHistory(h);
      } catch (err) {
        console.warn("History fetch warning:", err);
      }
    }
    loadHist();
  }, [selectedRoadId, cityTraffic]);

  const activeRoad: RoadSegment | undefined = cityTraffic?.roads.find(
    (r) => r.id === selectedRoadId
  );

  const worstSegment = cityTraffic?.roads.reduce(
    (worst, curr) => (curr.congestion_ratio < worst.congestion_ratio ? curr : worst),
    cityTraffic.roads[0]
  );

  const assistantContext = {
    city: selectedCity,
    road_name: activeRoad?.name || "Silk Board Junction",
    current_speed: activeRoad?.current_speed || 24.5,
    free_flow_speed: activeRoad?.free_flow_speed || 45.0,
    congestion_ratio: activeRoad?.congestion_ratio || 0.54,
    congestion_band: activeRoad?.congestion_band || "High",
    data_source: cityTraffic?.data_source || "TomTom Segment Telemetry",
    forecast_timeline: forecast?.forecast_timeline || [],
    worst_segment: worstSegment,
    active_model: metadata?.selected_production_model || "Stacking Ridge Ensemble",
    target_timestamp: forecast?.target_timestamp,
    target_time_display: forecast?.target_time_display,
    is_custom_point_in_time: isCustomPredictionActive,
    context: forecast?.context,
    festival: forecast?.context?.festival_name || festivalScenario,
    weather: forecast?.context?.weather || weatherCondition,
    roadwork: forecast?.context?.roadwork || roadworkCondition,
  };

  // Determine active telemetry status indicator
  const isLiveTomTom = cityTraffic?.data_source === "live_tomtom_api";

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header Control Room HUD */}
      <header className="border-b border-cyan-500/20 bg-slate-950/95 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-6 py-2.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & System Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.6)]">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-wider text-white">
                  TrafficPulse <span className="text-cyan-400">AI</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  TRAFFIC CONTROL ROOM
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Indian Metropolitan Multi-Horizon Traffic Forecasting
              </p>
            </div>
          </div>

          {/* City Selector, Diagnostics & Global Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* City Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs shadow-inner">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                {citiesList.map((c) => (
                  <option key={c.id} value={c.name} className="bg-slate-900">
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </div>

            {/* Live Telemetry Status Button */}
            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs transition cursor-pointer group shadow-sm"
              title="Open TomTom API Diagnostics & Flow Segment Inspector"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLiveTomTom
                    ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
                    : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                }`}
              />
              <span className="text-slate-300 font-mono text-[11px] group-hover:text-cyan-300 font-bold">
                {isLiveTomTom ? "TomTom Live API" : "Fallback Telemetry"}
              </span>
              <Activity className="w-3.5 h-3.5 text-cyan-400 opacity-80 group-hover:opacity-100" />
            </button>

            {/* Dataset Provenance Modal */}
            <button
              onClick={() => setIsDatasetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Dataset Provenance</span>
            </button>

            {/* AI Assistant Button */}
            <button
              onClick={() => setIsAssistantOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-[0_0_15px_rgba(6,182,212,0.35)] transition cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>AI Assistant</span>
            </button>
          </div>
        </div>
      </header>

      {/* Prominent API Error Alert Display */}
      {apiError && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-2.5 text-xs text-rose-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span><strong>API Telemetry Warning:</strong> {apiError}</span>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="text-rose-300 hover:text-white font-mono font-bold px-2 py-0.5 rounded hover:bg-rose-900/60 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Control Room Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-5">
        {/* Top KPI Cards Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: City Average Velocity */}
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 bg-slate-900/80 hover:border-cyan-500/40 transition">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>City Velocity</span>
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {cityTraffic?.summary.average_speed || "--"}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Free-flow baseline:{" "}
              <strong className="text-slate-200 font-mono">
                {cityTraffic?.summary.average_free_flow_speed || "--"} km/h
              </strong>
            </div>
          </div>

          {/* Card 2: Congestion Ratio & Band */}
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 bg-slate-900/80 hover:border-cyan-500/40 transition">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Congestion Level</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-base font-extrabold uppercase px-2 py-0.5 rounded font-mono"
                style={{
                  backgroundColor: `${cityTraffic?.summary.congestion_color}22`,
                  color: cityTraffic?.summary.congestion_color,
                  border: `1px solid ${cityTraffic?.summary.congestion_color}55`,
                }}
              >
                {cityTraffic?.summary.congestion_band || "Moderate"}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({cityTraffic?.summary.congestion_ratio || "--"})
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Corridors active:{" "}
              <strong className="text-slate-200">
                {cityTraffic?.summary.monitored_segments || "--"} segments
              </strong>
            </div>
          </div>

          {/* Card 3: Active Production ML Model */}
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 bg-slate-900/80 hover:border-cyan-500/40 transition">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Production Model</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1 text-sm font-bold text-cyan-300 truncate font-mono">
              {metadata?.selected_production_model || "Stacking Ensemble"}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>
                Test MAE:{" "}
                <strong className="text-emerald-400 font-mono">
                  {metadata?.models?.model_3_stacking_ensemble?.mae?.toFixed(2) || "8.40"} km/h
                </strong>
              </span>
            </div>
          </div>

          {/* Card 4: Worst Bottleneck Corridor */}
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 bg-slate-900/80 hover:border-cyan-500/40 transition">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Worst Bottleneck</span>
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-1 text-sm font-bold text-rose-400 truncate">
              {worstSegment?.name || "Silk Board Junction"}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Flow: <strong className="text-rose-400 font-mono">{worstSegment?.current_speed} km/h</strong>{" "}
              ({worstSegment?.congestion_band})
            </div>
          </div>
        </section>

        {/* Predictive Time Travel & Contextual Simulator (User Time, Festival & Weather Selection) */}
        <section>
          <PredictiveTimeTravel
            selectedDateTime={targetDateTime}
            onChangeDateTime={(dt) => setTargetDateTime(dt)}
            selectedWeather={weatherCondition}
            onChangeWeather={(w) => setWeatherCondition(w)}
            selectedRoadwork={roadworkCondition}
            onChangeRoadwork={(rw) => setRoadworkCondition(rw)}
            selectedFestival={festivalScenario}
            onChangeFestival={(fest) => setFestivalScenario(fest)}
            onApplyPrediction={handleApplyTemporalPrediction}
            onResetToLive={handleResetToLive}
            isCustomActive={isCustomPredictionActive}
            loading={forecastLoading}
          />
        </section>

        {/* Central Map & Multi-Horizon Forecast Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Leaflet Traffic Control Map (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="h-[500px] w-full">
              {cityTraffic ? (
                <TrafficMap
                  cityCenter={cityTraffic.center}
                  roads={cityTraffic.roads}
                  selectedRoadId={selectedRoadId}
                  onSelectRoad={(id) => setSelectedRoadId(id)}
                  horizon={horizon}
                  forecastTimeline={forecast?.forecast_timeline}
                  dataSource={cityTraffic.data_source}
                  activeRoutePolyline={activeRoutePolyline}
                  activeRouteOrigin={activeRouteOrigin}
                  activeRouteDest={activeRouteDest}
                  activeRouteInfo={activeRouteInfo}
                  activeRoutePredictions={activeRoutePredictions}
                  onClearActiveRoute={() => {
                    setActiveRoutePolyline(undefined);
                    setActiveRouteOrigin(undefined);
                    setActiveRouteDest(undefined);
                    setActiveRouteInfo(undefined);
                    setActiveRoutePredictions(undefined);
                  }}
                />
              ) : (
                <div className="glass-panel w-full h-full flex items-center justify-center text-slate-500">
                  Initializing control map tiles...
                </div>
              )}
            </div>

            {/* Now / +15 / +30 / +60 Time Slider & Stepper Bar */}
            <div className="glass-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs border border-cyan-500/30 bg-slate-900/90 shadow-xl">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  Horizon Time Stepper:
                </span>
              </div>

              {/* Slider & Quick Buttons */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={[0, 15, 30, 60].indexOf(horizon)}
                  onChange={(e) => {
                    const horizons = [0, 15, 30, 60];
                    setHorizon(horizons[parseInt(e.target.value, 10)]);
                  }}
                  className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                />

                <div className="flex items-center gap-1.5">
                  {[0, 15, 30, 60].map((h) => (
                    <button
                      key={h}
                      onClick={() => setHorizon(h)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer font-mono ${
                        horizon === h
                          ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] border border-cyan-400"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {h === 0 ? "Now (t=0)" : `+${h}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-Horizon Forecast Timeline (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <ForecastTimelinePanel
              forecast={forecast}
              activeHorizon={horizon}
              onSelectHorizon={(h) => setHorizon(h)}
              loading={forecastLoading}
            />
          </div>
        </section>

        {/* Feature Modules Tabbed Container (Historical Patterns, Explanations, Cascade, GreenWave) */}
        <section className="space-y-4 pt-2">
          {/* Tab Navigation Buttons */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("historical")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "historical"
                  ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Historical Patterns & Forecast Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab("calibration")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "calibration"
                  ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cross-City Domain Calibration</span>
            </button>

            <button
              onClick={() => setActiveTab("cascade")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "cascade"
                  ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Cascade Delay Propagation</span>
            </button>

            <button
              onClick={() => setActiveTab("greenwave")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "greenwave"
                  ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Dynamic Green Wave Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab("routes")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "routes"
                  ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Precise Maps, Distance & Predictive Routes</span>
            </button>
          </div>

          {/* Active Tab Panel Render */}
          <div>
            {activeTab === "historical" && (
              <HistoricalChartPanel
                history={history}
                metadata={metadata}
                forecast={forecast}
                roadName={activeRoad?.name || "100 Feet Road"}
              />
            )}
            {activeTab === "calibration" && <CalibrationPanel currentCity={selectedCity} />}
            {activeTab === "cascade" && <CascadeDelayPanel />}
            {activeTab === "greenwave" && (
              <GreenWavePanel city={selectedCity} roadId={selectedRoadId} />
            )}
            {activeTab === "routes" && (
              <RouteComparisonPanel
                allCitiesData={citiesList}
                activeHorizon={horizon}
                onSelectHorizon={(h) => setHorizon(h)}
                onRouteSelected={(polyline, origin, dest, info, predictions) => {
                  setActiveRoutePolyline(polyline);
                  setActiveRouteOrigin(origin);
                  setActiveRouteDest(dest);
                  setActiveRouteInfo(info);
                  setActiveRoutePredictions(predictions);
                }}
              />
            )}
          </div>
        </section>
      </main>

      {/* Control Room Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>TrafficPulse AI — Full-Stack Indian Traffic Control Room</span>
          <span className="font-mono text-[11px] text-slate-400">
            Backend: FastAPI + LightGBM/Ridge • Frontend: React + Leaflet + Recharts
          </span>
        </div>
      </footer>

      {/* Floating AI Assistant Modal */}
      <TrafficAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        context={assistantContext}
      />

      {/* Dataset Provenance & Upload Modal */}
      <DatasetProvenanceModal
        isOpen={isDatasetModalOpen}
        onClose={() => setIsDatasetModalOpen(false)}
        onDatasetUpdated={() => {
          fetchModelMetadata().then(setMetadata);
          fetchHistory().then(setHistory);
        }}
      />

      {/* TomTom Flow Segment API Diagnostics Modal */}
      <TomTomDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
}

export default App;
