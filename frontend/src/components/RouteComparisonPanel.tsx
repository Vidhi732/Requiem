import React, { useState, useEffect } from "react";
import {
  RouteComparisonResponse,
  RouteItem,
  RouteCalculationResult,
  RouteCatalogItem,
  RouteHorizonPrediction,
  PlaceSearchResult,
} from "../types";
import {
  fetchRouteComparison,
  calculateCustomRoute,
  fetchRouteCatalog,
} from "../api";
import { PlaceSearchInput } from "./PlaceSearchInput";
import {
  Leaf,
  Clock,
  Fuel,
  Route as RouteIcon,
  Award,
  AlertCircle,
  Navigation,
  ArrowRightLeft,
  Sparkles,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Search,
} from "lucide-react";

interface RouteComparisonPanelProps {
  onRouteSelected?: (
    polyline: [number, number][],
    origin: { label: string; coords: [number, number] },
    dest: { label: string; coords: [number, number] },
    info: { distance_km: number; travel_time_min: number; title: string },
    predictions?: RouteHorizonPrediction[]
  ) => void;
  allCitiesData?: any[];
  activeHorizon?: number;
  onSelectHorizon?: (h: number) => void;
}

export const RouteComparisonPanel: React.FC<RouteComparisonPanelProps> = ({
  onRouteSelected,
  allCitiesData = [],
  activeHorizon = 0,
  onSelectHorizon,
}) => {
  const [corridorId, setCorridorId] = useState("intercity_mumbai_to_pune");
  const [corridorCategory, setCorridorCategory] = useState<"all" | "intercity" | "intracity">("all");
  const [routeData, setRouteData] = useState<RouteComparisonResponse | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<RouteCatalogItem[]>([]);

  // Custom point-to-point calculator state
  const [plannerMode, setPlannerMode] = useState<"corridor" | "custom">("corridor");
  const [inputMethod, setInputMethod] = useState<"autocomplete" | "presets">("autocomplete");
  const [originPlace, setOriginPlace] = useState<PlaceSearchResult | null>({
    label: "Bandra Kurla Complex (BKC)",
    sublabel: "Bandra East, Mumbai, Maharashtra",
    lat: 19.0657,
    lon: 72.8687,
    municipality: "Mumbai",
    type: "Commercial Hub",
    source: "tomtom_live",
  });
  const [destPlace, setDestPlace] = useState<PlaceSearchResult | null>({
    label: "Hinjawadi IT Park Phase 1",
    sublabel: "Hinjawadi, Pune, Maharashtra",
    lat: 18.5912,
    lon: 73.7389,
    municipality: "Pune",
    type: "IT Corridor",
    source: "tomtom_live",
  });
  const [originCity, setOriginCity] = useState("Mumbai");
  const [destCity, setDestCity] = useState("Pune");
  const [originRoadId, setOriginRoadId] = useState("");
  const [destRoadId, setDestRoadId] = useState("");
  const [customResult, setCustomResult] = useState<RouteCalculationResult | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Load Corridor Catalog on Mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const catRes = await fetchRouteCatalog();
        if (catRes?.catalog) {
          setCatalog(catRes.catalog);
        }
      } catch (err) {
        console.error("Failed to load route catalog:", err);
      }
    }
    loadCatalog();
  }, []);

  // Load Route Data for Selected Corridor
  useEffect(() => {
    const loadRoutes = async () => {
      setLoading(true);
      try {
        const data = await fetchRouteComparison(corridorId);
        setRouteData(data);
        setSelectedRouteIndex(0);

        // Auto-feed first route to map if callback available
        if (data.routes && data.routes.length > 0 && onRouteSelected) {
          const first = data.routes[0];
          if (first.polyline && first.polyline.length > 0 && data.origin_coords && data.dest_coords) {
            onRouteSelected(
              first.polyline,
              { label: data.origin, coords: data.origin_coords },
              { label: data.destination, coords: data.dest_coords },
              {
                distance_km: first.distance_km,
                travel_time_min: first.current_travel_time_min,
                title: `${data.origin} → ${data.destination}`,
              },
              first.predictions
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (plannerMode === "corridor") {
      loadRoutes();
    }
  }, [corridorId, plannerMode]);

  // Handle route card click to update map polyline
  const handleSelectRouteCard = (route: RouteItem, idx: number) => {
    setSelectedRouteIndex(idx);
    if (route.polyline && route.polyline.length > 0 && onRouteSelected && routeData) {
      const origCoords = routeData.origin_coords || route.polyline[0];
      const destCoords = routeData.dest_coords || route.polyline[route.polyline.length - 1];
      onRouteSelected(
        route.polyline,
        { label: routeData.origin, coords: origCoords },
        { label: routeData.destination, coords: destCoords },
        {
          distance_km: route.distance_km,
          travel_time_min: route.current_travel_time_min,
          title: route.name,
        },
        route.predictions
      );
    }
  };

  // Run Custom Route Calculation
  const handleCalculateCustomRoute = async () => {
    setCustomLoading(true);
    setCustomError(null);

    let origCoords: [number, number];
    let destCoords: [number, number];
    let origLabel: string;
    let destLabel: string;
    let oCity = originCity;
    let dCity = destCity;

    if (inputMethod === "autocomplete" && originPlace && destPlace) {
      origCoords = [originPlace.lat, originPlace.lon];
      destCoords = [destPlace.lat, destPlace.lon];
      origLabel = originPlace.label;
      destLabel = destPlace.label;
      oCity = originPlace.municipality || originCity;
      dCity = destPlace.municipality || destCity;
    } else {
      // Resolve coords from allCitiesData
      const origCityObj = allCitiesData.find((c) => c.name === originCity || c.id === originCity);
      const destCityObj = allCitiesData.find((c) => c.name === destCity || c.id === destCity);

      origCoords = origCityObj?.center || [19.076, 72.8777];
      destCoords = destCityObj?.center || [18.5204, 73.8567];
      origLabel = `${originCity} Center`;
      destLabel = `${destCity} Center`;

      if (origCityObj && originRoadId) {
        const road = origCityObj.roads?.find((r: any) => r.id === originRoadId);
        if (road) {
          origCoords = [road.lat, road.lon];
          origLabel = `${road.name} (${originCity})`;
        }
      }

      if (destCityObj && destRoadId) {
        const road = destCityObj.roads?.find((r: any) => r.id === destRoadId);
        if (road) {
          destCoords = [road.lat, road.lon];
          destLabel = `${road.name} (${destCity})`;
        }
      }
    }

    try {
      const res = await calculateCustomRoute({
        origin_lat: origCoords[0],
        origin_lon: origCoords[1],
        dest_lat: destCoords[0],
        dest_lon: destCoords[1],
        origin_label: origLabel,
        dest_label: destLabel,
        origin_city: oCity,
        dest_city: dCity,
      });

      setCustomResult(res);

      if (onRouteSelected && res.polyline && res.polyline.length > 0) {
        onRouteSelected(
          res.polyline,
          { label: origLabel, coords: origCoords },
          { label: destLabel, coords: destCoords },
          {
            distance_km: res.distance_km,
            travel_time_min: res.current_travel_time_min,
            title: `${origLabel} → ${destLabel}`,
          },
          res.predictions
        );
      }
    } catch (err: any) {
      setCustomError(err.message || "Failed to calculate route");
    } finally {
      setCustomLoading(false);
    }
  };

  // Swap origin and destination
  const handleSwap = () => {
    // Swap autocomplete places
    const tempPlace = originPlace;
    setOriginPlace(destPlace);
    setDestPlace(tempPlace);

    // Swap preset dropdowns
    const tempCity = originCity;
    const tempRoad = originRoadId;
    setOriginCity(destCity);
    setOriginRoadId(destRoadId);
    setDestCity(tempCity);
    setDestRoadId(tempRoad);
  };

  const filteredCatalog = catalog.filter((c) => {
    if (corridorCategory === "all") return true;
    return c.corridor_type === corridorCategory;
  });

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Precise Maps, Distance & Predictive Route Intelligence
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Turn-by-turn TomTom telemetry, live expressway travel times, DEFRA emissions & multi-horizon AI forecasts
          </p>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setPlannerMode("corridor")}
            className={`px-3 py-1 rounded-md transition font-medium ${
              plannerMode === "corridor"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Major Corridors & Expressways
          </button>
          <button
            onClick={() => setPlannerMode("custom")}
            className={`px-3 py-1 rounded-md transition font-medium ${
              plannerMode === "custom"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            City-to-City Custom Calculator
          </button>
        </div>
      </div>

      {/* MODE 1: PRE-CONFIGURED CORRIDORS (MUMBAI, PUNE, BENGALURU, ETC) */}
      {plannerMode === "corridor" && (
        <div className="space-y-4">
          {/* Category Filter & Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Filter:</span>
              <button
                onClick={() => setCorridorCategory("all")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  corridorCategory === "all" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50" : "text-slate-400 hover:text-white"
                }`}
              >
                All Corridors ({catalog.length})
              </button>
              <button
                onClick={() => setCorridorCategory("intercity")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  corridorCategory === "intercity" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50" : "text-slate-400 hover:text-white"
                }`}
              >
                Inter-City Superhighways
              </button>
              <button
                onClick={() => setCorridorCategory("intracity")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  corridorCategory === "intracity" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50" : "text-slate-400 hover:text-white"
                }`}
              >
                Intra-City Arterials
              </button>
            </div>

            {/* Select Corridor */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Select Corridor:</span>
              <select
                value={corridorId}
                onChange={(e) => setCorridorId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500 max-w-xs md:max-w-md"
              >
                {filteredCatalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Corridor Terminal Info Bar */}
          {routeData && (
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded text-[10px] font-bold border border-emerald-800">
                  ORIGIN
                </span>
                <strong className="text-white">{routeData.origin}</strong>
                <span className="text-slate-500">➔</span>
                <span className="px-1.5 py-0.5 bg-rose-950 text-rose-400 rounded text-[10px] font-bold border border-rose-800">
                  DESTINATION
                </span>
                <strong className="text-white">{routeData.destination}</strong>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-cyan-400">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>Live Route Geometry Mapped</span>
              </div>
            </div>
          )}

          {/* Routes Cards Grid */}
          {loading ? (
            <div className="py-8 text-center text-sm text-cyan-300 animate-pulse">
              Computing live route telemetry and trajectory points via TomTom...
            </div>
          ) : (
            routeData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {routeData.routes.map((route, idx) => {
                  const isFastest = route.id === routeData.fastest_route_id;
                  const isGreenest = route.id === routeData.greenest_route_id;
                  const isSelected = selectedRouteIndex === idx;

                  return (
                    <div
                      key={route.id}
                      onClick={() => handleSelectRouteCard(route, idx)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-cyan-950/40 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Card Header & Badges */}
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span className="text-xs font-bold text-white line-clamp-1">{route.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isFastest && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-0.5 font-bold">
                              <Clock className="w-2.5 h-2.5" /> FASTEST
                            </span>
                          )}
                          {isGreenest && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-0.5 font-bold">
                              <Leaf className="w-2.5 h-2.5" /> GREENEST
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">{route.description}</p>

                      {/* Main Metrics: Distance & Travel Time */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-md border border-slate-800/80 mb-3">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                            Road Distance
                          </span>
                          <span className="text-base font-extrabold text-white font-mono">
                            {route.distance_km} <span className="text-xs text-slate-400">km</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                            Live Duration
                          </span>
                          <span className="text-base font-extrabold text-cyan-400 font-mono">
                            {Math.floor(route.current_travel_time_min / 60) > 0
                              ? `${Math.floor(route.current_travel_time_min / 60)}h `
                              : ""}
                            {Math.round(route.current_travel_time_min % 60)}
                            <span className="text-xs text-slate-400"> min</span>
                          </span>
                        </div>
                      </div>

                      {/* Secondary Metrics */}
                      <div className="space-y-1.5 text-[11px] border-t border-slate-800/70 pt-2 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Traffic Delay:</span>
                          <span className={`font-mono font-bold ${route.traffic_delay_min > 5 ? "text-rose-400" : "text-emerald-400"}`}>
                            {route.traffic_delay_min > 0 ? `+${route.traffic_delay_min} min` : "Free Flow (0 min)"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Avg Speed:</span>
                          <span className="font-mono text-slate-200">
                            {Math.round(route.current_speed_kmh)} km/h
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Est. Carbon CO2:</span>
                          <span className="font-mono text-emerald-400 font-semibold">
                            {route.co2_emissions_kg} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Excess Idle Burn:</span>
                          <span className="font-mono text-amber-400">
                            {route.fuel_wasted_litres} L
                          </span>
                        </div>
                      </div>

                      {/* Multi-Horizon Projections Bar */}
                      {route.predictions && route.predictions.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Time Horizon Forecast
                            </span>
                            <span className="text-[9px] text-cyan-400/80">Click time to map</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-center">
                            {route.predictions.map((p) => {
                              const isActive = activeHorizon === p.horizon_minutes;
                              return (
                                <button
                                  key={p.horizon_minutes}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectRouteCard(route, idx);
                                    if (onSelectHorizon) onSelectHorizon(p.horizon_minutes);
                                  }}
                                  className={`p-1.5 rounded transition text-center cursor-pointer border ${
                                    isActive
                                      ? "bg-cyan-950/80 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                      : "bg-slate-900/90 hover:bg-slate-800 border-slate-800"
                                  }`}
                                  title={`Switch map prediction to ${p.label}`}
                                >
                                  <span className={`text-[9px] font-bold block ${isActive ? "text-cyan-300" : "text-slate-400"}`}>
                                    {p.label}
                                  </span>
                                  <span className="text-[11px] font-mono font-bold text-white block">
                                    {Math.round(p.travel_time_min)}m
                                  </span>
                                  <span
                                    className="text-[8px] font-bold block"
                                    style={{ color: p.congestion_color }}
                                  >
                                    {p.congestion_band}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* View On Map Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRouteCard(route, idx);
                        }}
                        className={`w-full mt-3 py-1.5 px-3 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                            : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        {isSelected ? "Active on Map" : "View Route on Map"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* MODE 2: CUSTOM CITY-TO-CITY CALCULATOR */}
      {plannerMode === "custom" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-4">
            {/* Header and Method Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-cyan-400" /> Point-to-Point Route & Distance Calculator
                </span>
                <span className="text-[11px] text-slate-400">
                  Live TomTom GPS Search & multi-city transit engine
                </span>
              </div>

              {/* Input Method Toggle */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputMethod("autocomplete")}
                  className={`px-3 py-1 rounded-md transition font-semibold flex items-center gap-1.5 ${
                    inputMethod === "autocomplete"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Search className="w-3 h-3 text-cyan-300" />
                  Live Autocomplete Search
                </button>
                <button
                  type="button"
                  onClick={() => setInputMethod("presets")}
                  className={`px-3 py-1 rounded-md transition font-semibold flex items-center gap-1.5 ${
                    inputMethod === "presets"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3 h-3 text-slate-300" />
                  City Presets Dropdown
                </button>
              </div>
            </div>

            {/* Input Method 1: Live TomTom Autocomplete Search Inputs */}
            {inputMethod === "autocomplete" ? (
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                {/* Origin Autocomplete */}
                <div className="md:col-span-5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <PlaceSearchInput
                    label="ORIGIN TERMINAL / PLACE"
                    placeholder="Search any place in India (e.g. Silk Board, BKC, CSMT, Delhi...)"
                    selectedPlace={originPlace}
                    onSelectPlace={(place) => setOriginPlace(place)}
                    onClearPlace={() => setOriginPlace(null)}
                    accentColor="emerald"
                  />
                </div>

                {/* Swap Button */}
                <div className="md:col-span-1 flex justify-center py-1">
                  <button
                    type="button"
                    onClick={handleSwap}
                    className="p-2.5 rounded-full bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition-all shadow-md active:scale-95"
                    title="Swap Origin and Destination"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Destination Autocomplete */}
                <div className="md:col-span-5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <PlaceSearchInput
                    label="DESTINATION TERMINAL / PLACE"
                    placeholder="Search destination (e.g. Hinjawadi, Indiranagar, Cyber Hub...)"
                    selectedPlace={destPlace}
                    onSelectPlace={(place) => setDestPlace(place)}
                    onClearPlace={() => setDestPlace(null)}
                    accentColor="rose"
                  />
                </div>
              </div>
            ) : (
              /* Input Method 2: Classic City & Road Junction Dropdowns */
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                {/* Origin Selection */}
                <div className="md:col-span-5 space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> ORIGIN TERMINAL
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">City</span>
                      <select
                        value={originCity}
                        onChange={(e) => {
                          setOriginCity(e.target.value);
                          setOriginRoadId("");
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        {allCitiesData.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Road / Junction</span>
                      <select
                        value={originRoadId}
                        onChange={(e) => setOriginRoadId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">City Center (Default)</option>
                        {allCitiesData
                          .find((c) => c.name === originCity || c.id === originCity)
                          ?.roads?.map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="md:col-span-1 flex justify-center py-1">
                  <button
                    type="button"
                    onClick={handleSwap}
                    className="p-2.5 rounded-full bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition-all shadow-md active:scale-95"
                    title="Swap Origin and Destination"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Destination Selection */}
                <div className="md:col-span-5 space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span> DESTINATION TERMINAL
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">City</span>
                      <select
                        value={destCity}
                        onChange={(e) => {
                          setDestCity(e.target.value);
                          setDestRoadId("");
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        {allCitiesData.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Road / Junction</span>
                      <select
                        value={destRoadId}
                        onChange={(e) => setDestRoadId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">City Center (Default)</option>
                        {allCitiesData
                          .find((c) => c.name === destCity || c.id === destCity)
                          ?.roads?.map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calculate Button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleCalculateCustomRoute}
                disabled={customLoading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {customLoading ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    Calculating Live Route & Forecast...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Calculate Precise Route & Traffic Forecast
                  </>
                )}
              </button>
            </div>

            {customError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{customError}</span>
              </div>
            )}
          </div>

          {/* Custom Calculation Result Card */}
          {customResult && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    Calculated Highway Corridor
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">
                    {customResult.origin_label} ➔ {customResult.dest_label}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      customResult.is_live_tomtom
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : "bg-amber-950 text-amber-300 border-amber-800"
                    }`}
                  >
                    {customResult.is_live_tomtom ? "🟢 LIVE TOMTOM API" : "🟡 CALIBRATED GEODESIC"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {customResult.polyline.length} GPS road points
                  </span>
                </div>
              </div>

              {/* 4 Stat Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">
                    Exact Road Distance
                  </span>
                  <span className="text-xl font-extrabold text-white font-mono">
                    {customResult.distance_km} <span className="text-xs text-slate-400 font-normal">km</span>
                  </span>
                </div>
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">
                    Real-time Travel Time
                  </span>
                  <span className="text-xl font-extrabold text-cyan-400 font-mono">
                    {Math.floor(customResult.current_travel_time_min / 60) > 0
                      ? `${Math.floor(customResult.current_travel_time_min / 60)}h `
                      : ""}
                    {Math.round(customResult.current_travel_time_min % 60)}
                    <span className="text-xs text-slate-400 font-normal"> min</span>
                  </span>
                </div>
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">
                    Traffic Delay
                  </span>
                  <span className={`text-xl font-extrabold font-mono ${customResult.traffic_delay_min > 5 ? "text-rose-400" : "text-emerald-400"}`}>
                    {customResult.traffic_delay_min > 0 ? `+${customResult.traffic_delay_min} min` : "0 min"}
                  </span>
                </div>
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">
                    Carbon Emissions
                  </span>
                  <span className="text-xl font-extrabold text-emerald-400 font-mono">
                    {customResult.co2_emissions_kg} <span className="text-xs text-slate-400 font-normal">kg CO2</span>
                  </span>
                </div>
              </div>

              {/* Multi-Horizon Projections Grid */}
              {customResult.predictions && customResult.predictions.length > 0 && (
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Multi-Horizon AI Travel Time Forecast
                    </span>
                    <span className="text-[9px] text-cyan-400">Click time horizon to map prediction</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    {customResult.predictions.map((p) => {
                      const isActive = activeHorizon === p.horizon_minutes;
                      return (
                        <button
                          key={p.horizon_minutes}
                          type="button"
                          onClick={() => {
                            if (onSelectHorizon) onSelectHorizon(p.horizon_minutes);
                          }}
                          className={`p-2 rounded transition cursor-pointer text-center border ${
                            isActive
                              ? "bg-cyan-950/80 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                              : "bg-slate-900 hover:bg-slate-800 border-slate-800/80"
                          }`}
                          title={`Switch map prediction to ${p.label}`}
                        >
                          <span className={`text-[10px] font-bold block ${isActive ? "text-cyan-300" : "text-slate-400"}`}>
                            {p.label}
                          </span>
                          <span className="text-sm font-mono font-bold text-white block mt-0.5">
                            {Math.floor(p.travel_time_min / 60) > 0 ? `${Math.floor(p.travel_time_min / 60)}h ` : ""}
                            {Math.round(p.travel_time_min % 60)} min
                          </span>
                          <span className="text-[10px] font-bold block mt-0.5" style={{ color: p.congestion_color }}>
                            {p.congestion_band} ({Math.round(p.predicted_speed)} km/h)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-800/70">
        <span>Standard emissions: DEFRA 140g CO2/km baseline + non-linear congestion penalty.</span>
        <span>TomTom API Real-time routing v1</span>
      </div>
    </div>
  );
};
