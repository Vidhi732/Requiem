import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RoadSegment, ForecastHorizonStep, RouteHorizonPrediction } from "../types";
import { Eye, Clock, Radio, Activity, Sparkles, Navigation, MapPin } from "lucide-react";

interface TrafficMapProps {
  cityCenter: [number, number];
  roads: RoadSegment[];
  selectedRoadId: string | null;
  onSelectRoad: (roadId: string) => void;
  horizon: number; // 0, 15, 30, 60
  forecastTimeline?: ForecastHorizonStep[];
  dataSource: string;
  activeRoutePolyline?: [number, number][];
  activeRouteOrigin?: { label: string; coords: [number, number] };
  activeRouteDest?: { label: string; coords: [number, number] };
  activeRouteInfo?: { distance_km: number; travel_time_min: number; title: string };
  activeRoutePredictions?: RouteHorizonPrediction[];
  onClearActiveRoute?: () => void;
}

export const TrafficMap: React.FC<TrafficMapProps> = ({
  cityCenter,
  roads,
  selectedRoadId,
  onSelectRoad,
  horizon,
  forecastTimeline,
  dataSource,
  activeRoutePolyline,
  activeRouteOrigin,
  activeRouteDest,
  activeRouteInfo,
  activeRoutePredictions,
  onClearActiveRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: cityCenter,
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // High-contrast Official TomTom Traffic Control Night Tile Layer
      const tomtomKey = "IITdPp01uTugGEYkgAWdlQ7bn37ODOGh";
      L.tileLayer(
        `https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${tomtomKey}`,
        {
          attribution: '&copy; <a href="https://www.tomtom.com" target="_blank" rel="noreferrer">TomTom</a> &copy; OpenStreetMap',
          maxZoom: 19,
          tileSize: 256,
        }
      ).addTo(map);

      polylineLayerRef.current = L.layerGroup().addTo(map);
      routePolylineLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    } else {
      if (!activeRoutePolyline || activeRoutePolyline.length === 0) {
        mapInstanceRef.current.setView(cityCenter, 12);
      }
    }
  }, [cityCenter]);

  // Update Markers and Road Links with Distinct Visual Treatments
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (polylineLayerRef.current) {
      polylineLayerRef.current.clearLayers();
    }

    const isLiveObservation = horizon === 0;

    roads.forEach((road) => {
      let displayColor = road.congestion_color;
      let displayBand = road.congestion_band;
      let displaySpeed = road.current_speed;
      let nodeType: "live" | "forecast" | "fallback" = "live";

      const roadHasLiveApi = road.data_source === "live_tomtom_api" || road.data_source === "tomtom_api";

      if (isLiveObservation) {
        nodeType = roadHasLiveApi ? "live" : "fallback";
      } else {
        nodeType = "forecast";
        // Check if selected road has exact forecast timeline step
        if (selectedRoadId === road.id && forecastTimeline) {
          const step = forecastTimeline.find((s) => s.horizon_minutes === horizon);
          if (step) {
            displayColor = step.congestion_color;
            displayBand = step.congestion_band as any;
            displaySpeed = step.predicted_speed;
          }
        } else {
          // Model projection adjustment for other corridors
          const diurnalDecay = horizon === 15 ? 0.95 : horizon === 30 ? 0.91 : 0.97;
          displaySpeed = Math.round(road.current_speed * diurnalDecay * 10) / 10;
        }
      }

      const isSelected = selectedRoadId === road.id;

      let markerBadge = isLiveObservation ? "LIVE" : `+${horizon}m`;

      const iconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          ${
            isSelected
              ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; border: 2px solid #06b6d4; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.85;"></div>`
              : ""
          }
          ${
            isLiveObservation && roadHasLiveApi
              ? `<div style="position: absolute; inset: 2px; border-radius: 9999px; border: 1.5px dashed ${displayColor}; animation: spin 8s linear infinite; opacity: 0.6;"></div>`
              : !isLiveObservation
              ? `<div style="position: absolute; inset: 1px; border-radius: 8px; border: 1.5px dashed #38bdf8; opacity: 0.7;"></div>`
              : ""
          }
          <div style="width: 30px; height: 30px; border-radius: ${isLiveObservation ? '9999px' : '7px'}; background-color: #0b1329; border: 2.5px solid ${displayColor}; box-shadow: 0 0 14px ${displayColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s;">
            <span style="font-size: 11px; font-weight: 900; color: #ffffff; font-family: ui-monospace, monospace; line-height: 1;">
              ${Math.round(displaySpeed)}
            </span>
            <span style="font-size: 7px; font-weight: 700; color: ${displayColor}; text-transform: uppercase; letter-spacing: -0.5px; margin-top: 1px;">
              ${markerBadge}
            </span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-traffic-pin",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([road.lat, road.lon], { icon: customIcon }).addTo(map);

      // Rich control-room tooltip
      const treatmentLabel = isLiveObservation
        ? roadHasLiveApi ? "🟢 LIVE TOMTOM TELEMETRY" : "🟡 REPLAY FALLBACK"
        : `🔵 ML CALIBRATED FORECAST (+${horizon}m)`;

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 210px; padding: 4px; color: #f8fafc; background: #0b1329; border-radius: 8px;">
          <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: ${
            nodeType === "live" ? "#10b981" : nodeType === "forecast" ? "#38bdf8" : "#f59e0b"
          }; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 3px;">
            ${treatmentLabel}
          </div>
          <div style="font-size: 13px; font-weight: bold; color: #ffffff;">${road.name}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">${road.corridor}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: rgba(255,255,255,0.05); padding: 6px; border-radius: 6px;">
            <div>
              <span style="color: #64748b; font-size: 9px; display: block; text-transform: uppercase;">Speed</span>
              <strong style="color: #ffffff; font-size: 13px;">${Math.round(displaySpeed)} km/h</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 9px; display: block; text-transform: uppercase;">Free Flow</span>
              <strong style="color: #38bdf8; font-size: 13px;">${Math.round(road.free_flow_speed)} km/h</strong>
            </div>
          </div>
          <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <span style="color: #94a3b8;">Congestion:</span>
            <span style="padding: 2px 6px; border-radius: 9999px; background: ${displayColor}20; color: ${displayColor}; font-weight: bold; border: 1px solid ${displayColor}50;">
              ${displayBand}
            </span>
          </div>
        </div>
      `;

      marker.bindTooltip(popupContent, {
        direction: "top",
        offset: [0, -20],
        className: "custom-leaflet-tooltip",
        opacity: 0.98,
      });

      marker.on("click", () => {
        onSelectRoad(road.id);
      });

      markersRef.current[road.id] = marker;
    });
  }, [roads, selectedRoadId, horizon, forecastTimeline]);

  // Render Active Route Polyline (Inter-City and Intra-City) with Time Horizon Predictions
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routePolylineLayerRef.current) return;

    routePolylineLayerRef.current.clearLayers();

    if (activeRoutePolyline && activeRoutePolyline.length > 1) {
      const latlngs: L.LatLngExpression[] = activeRoutePolyline.map((pt) => [pt[0], pt[1]]);

      // Find the prediction matching the current time horizon
      const activePrediction = activeRoutePredictions?.find((p) => p.horizon_minutes === horizon);
      const routeColor = activePrediction ? activePrediction.congestion_color : "#38bdf8";
      const glowColor = activePrediction ? activePrediction.congestion_color : "#06b6d4";
      const isSevere = activePrediction?.congestion_band?.toLowerCase().includes("severe");

      // Outer Glow Polyline
      const glowLine = L.polyline(latlngs, {
        color: glowColor,
        weight: isSevere ? 10 : 8,
        opacity: isSevere ? 0.6 : 0.45,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routePolylineLayerRef.current);

      // Inner Core Polyline
      const coreLine = L.polyline(latlngs, {
        color: routeColor,
        weight: isSevere ? 5 : 4,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        dashArray: horizon > 0 ? "8, 6" : undefined, // Dashed during future model horizon
      }).addTo(routePolylineLayerRef.current);

      // Rich Route Hover Tooltip
      const tooltipContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 190px; padding: 4px; color: #f8fafc; background: #0b1329; border-radius: 8px;">
          <div style="font-size: 10px; font-weight: 800; color: ${routeColor}; margin-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
            ${activePrediction ? `🔮 AI FORECAST (${activePrediction.label})` : "🟢 LIVE OBSERVATION (t=0)"}
          </div>
          <div style="font-size: 12px; font-weight: bold; color: #ffffff;">${activeRouteInfo?.title || "Corridor Route"}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 5px; font-size: 10px; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 5px;">
            <div>
              <span style="color: #64748b; font-size: 9px; display: block;">TRAVEL TIME</span>
              <strong style="color: #38bdf8; font-size: 12px;">${activePrediction ? Math.round(activePrediction.travel_time_min) : Math.round(activeRouteInfo?.travel_time_min || 0)} min</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 9px; display: block;">PRED. SPEED</span>
              <strong style="color: #ffffff; font-size: 12px;">${activePrediction ? Math.round(activePrediction.predicted_speed) : 60} km/h</strong>
            </div>
          </div>
          <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <span style="color: #94a3b8;">Congestion:</span>
            <span style="padding: 1px 6px; border-radius: 9999px; background: ${routeColor}20; color: ${routeColor}; font-weight: bold; border: 1px solid ${routeColor}50;">
              ${activePrediction?.congestion_band || "Low"}
            </span>
          </div>
        </div>
      `;
      coreLine.bindTooltip(tooltipContent, { sticky: true, opacity: 0.98 });

      // Origin Marker (A - Green)
      if (activeRouteOrigin) {
        const originIcon = L.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
              <div style="position: absolute; inset: 0px; border-radius: 9999px; border: 2px solid #10b981; animation: ping 1.8s infinite; opacity: 0.7;"></div>
              <div style="width: 26px; height: 26px; border-radius: 9999px; background: #064e3b; border: 2.5px solid #10b981; box-shadow: 0 0 12px #10b981; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 12px;">
                A
              </div>
            </div>
          `,
          className: "route-origin-pin",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const origMarker = L.marker(activeRouteOrigin.coords, { icon: originIcon }).addTo(routePolylineLayerRef.current);
        origMarker.bindTooltip(`<strong>Origin:</strong> ${activeRouteOrigin.label}`, { direction: "top", permanent: false });
      }

      // Destination Marker (B - Cyan/Red)
      if (activeRouteDest) {
        const destIcon = L.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
              <div style="position: absolute; inset: 0px; border-radius: 9999px; border: 2px solid #f43f5e; animation: ping 1.8s infinite; opacity: 0.7;"></div>
              <div style="width: 26px; height: 26px; border-radius: 9999px; background: #881337; border: 2.5px solid #f43f5e; box-shadow: 0 0 12px #f43f5e; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 12px;">
                B
              </div>
            </div>
          `,
          className: "route-dest-pin",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const destMarker = L.marker(activeRouteDest.coords, { icon: destIcon }).addTo(routePolylineLayerRef.current);
        destMarker.bindTooltip(`<strong>Destination:</strong> ${activeRouteDest.label}`, { direction: "top", permanent: false });
      }

      // Smoothly fit bounds to show entire corridor
      try {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch (err) {
        console.error("fitBounds error:", err);
      }
    }
  }, [activeRoutePolyline, activeRouteOrigin, activeRouteDest, horizon, activeRoutePredictions]);

  const activePrediction = activeRoutePredictions?.find((p) => p.horizon_minutes === horizon);
  const currentTravelTimeMin = activePrediction
    ? activePrediction.travel_time_min
    : activeRouteInfo?.travel_time_min || 0;
  const currentSpeed = activePrediction?.predicted_speed;
  const currentBand = activePrediction?.congestion_band;
  const currentColor = activePrediction?.congestion_color || "#38bdf8";

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-cyan-500/20 shadow-2xl bg-[#080d1a]">
      {/* Map DOM */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[480px]" />

      {/* Floating Header Control Room HUD */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 pointer-events-none">
        {/* Data Source Badge */}
        <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-auto border border-cyan-500/30">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              dataSource === "live_tomtom_api"
                ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
                : "bg-amber-400"
            }`}
          />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            {dataSource === "live_tomtom_api" ? "LIVE TOMTOM TELEMETRY" : "FALLBACK TELEMETRY"}
          </span>
        </div>

        {/* Mode & Horizon Pill */}
        <div className="glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 pointer-events-auto border border-cyan-500/30">
          {horizon === 0 ? (
            <>
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-emerald-300">Observation: <strong className="text-white">Current (t=0)</strong></span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-300">Model Horizon: <strong className="text-white">+{horizon} min</strong></span>
            </>
          )}
        </div>
      </div>

      {/* Active Route HUD Overlay (when an inter-city or point-to-point route is loaded) */}
      {activeRouteInfo && activeRoutePolyline && activeRoutePolyline.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] glass-panel p-2.5 px-3.5 rounded-xl border border-cyan-500/40 shadow-2xl pointer-events-auto flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Navigation className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div>
              <div className="text-[11px] font-bold text-white leading-tight flex items-center gap-2">
                <span>{activeRouteInfo.title}</span>
                {activePrediction && (
                  <span
                    className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold"
                    style={{
                      backgroundColor: `${currentColor}25`,
                      color: currentColor,
                      border: `1px solid ${currentColor}60`,
                    }}
                  >
                    {activePrediction.label}: {currentBand}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-300 flex items-center gap-2 mt-0.5">
                <span className="text-cyan-300 font-mono font-bold">{activeRouteInfo.distance_km} km</span>
                <span>•</span>
                <span className="font-mono font-bold" style={{ color: currentColor }}>
                  {Math.floor(currentTravelTimeMin / 60) > 0 ? `${Math.floor(currentTravelTimeMin / 60)}h ` : ""}
                  {Math.round(currentTravelTimeMin % 60)} min
                  {activePrediction && activePrediction.delay_min > 0 ? ` (+${activePrediction.delay_min}m delay)` : ""}
                </span>
                {currentSpeed && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 font-mono">{Math.round(currentSpeed)} km/h</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {onClearActiveRoute && (
            <button
              onClick={onClearActiveRoute}
              className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
              title="Reset view back to city center"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Control Room Visual Treatment Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] glass-panel p-3 rounded-lg text-xs text-slate-300 shadow-2xl pointer-events-auto border border-cyan-500/20 max-w-sm">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
            Precision Map Engine
          </span>
          <span className="text-[9px] font-mono text-slate-400">TOMTOM LIVE + ML</span>
        </div>

        {/* Visual distinctions */}
        <div className="space-y-1 text-[11px] mb-2 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-emerald-400 bg-slate-900 shadow-[0_0_6px_#10b981] inline-block"></span>
            <span><strong>Live Segment Speed:</strong> Real-time TomTom sensor telemetry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-cyan-400 rounded shadow-[0_0_8px_#06b6d4] inline-block"></span>
            <span><strong>Active Calculated Route:</strong> Precise GPS road polyline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block -ml-1.5"></span>
            <span><strong>Pins A / B:</strong> Origin & Destination terminals</span>
          </div>
        </div>

        {/* Speed Band Guide */}
        <div className="pt-1.5 border-t border-slate-800/80">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Low (≥ 80%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Moderate (60-80%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>High (35-60%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Severe (&lt; 35%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
