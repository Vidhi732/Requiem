import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Zap,
  Globe,
  Sliders,
  Play,
  Terminal,
  HelpCircle,
} from "lucide-react";
import { fetchTomTomDiagnostics, fetchFlowSegment } from "../api";
import { TomTomDiagnosticReport, FlowSegmentResponse } from "../types";

interface TomTomDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COORDINATES = [
  { label: "Bengaluru (Silk Board)", lat: 12.9176, lon: 77.6238, desc: "Key ORR artery" },
  { label: "Mumbai (WEH Andheri)", lat: 19.1197, lon: 72.8468, desc: "Western Express Hwy" },
  { label: "Pune (Hinjewadi Ph 1)", lat: 18.5913, lon: 73.7389, desc: "IT Park Corridor" },
  { label: "Delhi (ITO Junction)", lat: 28.6304, lon: 77.2410, desc: "Central CBD Arterial" },
  { label: "Ocean / No-Road (Test Error)", lat: 0.0, lon: 0.0, desc: "Simulates unsupported segment" },
];

export function TomTomDiagnosticsModal({ isOpen, onClose }: TomTomDiagnosticsModalProps) {
  const [report, setReport] = useState<TomTomDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Probe state
  const [probeLat, setProbeLat] = useState("12.9176");
  const [probeLon, setProbeLon] = useState("77.6238");
  const [allowFallback, setAllowFallback] = useState(true);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<FlowSegmentResponse | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const loadDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTomTomDiagnostics();
      setReport(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load TomTom diagnostics report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDiagnostics();
    }
  }, [isOpen]);

  const handleRunCustomProbe = async () => {
    const lat = parseFloat(probeLat);
    const lon = parseFloat(probeLon);
    if (isNaN(lat) || isNaN(lon)) {
      setProbeError("Please enter valid numeric latitude and longitude coordinates.");
      return;
    }

    setProbing(true);
    setProbeError(null);
    setProbeResult(null);

    try {
      const res = await fetchFlowSegment(lat, lon, allowFallback, true);
      setProbeResult(res);
    } catch (err: any) {
      setProbeError(err?.message || "Failed to probe flow segment");
    } finally {
      setProbing(false);
    }
  };

  if (!isOpen) return null;

  const isLiveOperational = report?.system_status === "LIVE_TOMTOM_OPERATIONAL";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  TomTom Flow Segment API Diagnostics
                </h2>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    isLiveOperational
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-600 flex items-center gap-1.5"
                      : "bg-amber-950/80 text-amber-300 border-amber-600 flex items-center gap-1.5"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveOperational ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  {isLiveOperational ? "LIVE TELEMETRY OPERATIONAL" : "FALLBACK CALIBRATION ACTIVE"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time validation of TomTom Traffic Flow Segment telemetry & Indian corridor coordinates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDiagnostics}
              disabled={loading}
              title="Refresh diagnostic probes"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Security & Key Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Backend Security Architecture
                </div>
                <div className="text-[11px] text-slate-400">
                  TOMTOM_API_KEY is read strictly from backend <code className="text-cyan-300 font-mono">.env</code> and is never bundled or exposed in client browser code.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Key Status
                </span>
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  {report?.api_key_configured
                    ? `Configured (${report.key_preview})`
                    : "Not Configured (.env default)"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Total City Probes
              </span>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {report?.total_probes ?? "--"}
              </div>
              <span className="text-[10px] text-slate-400">Bengaluru, Mumbai, Pune, Delhi</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Live API Successes
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {report?.live_api_successes ?? "--"}
              </div>
              <span className="text-[10px] text-emerald-500/80">HTTP 200 Live Segments</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Fallbacks Active
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {report?.fallbacks_active ?? "--"}
              </div>
              <span className="text-[10px] text-amber-500/80">Calibration fallback</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Unsupported Segments
              </span>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                {report?.unsupported_segment_test?.handled_correctly ? "Protected" : "--"}
              </div>
              <span className="text-[10px] text-slate-400">Error handling verified</span>
            </div>
          </div>

          {/* City Live Probes Grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Configured Indian Cities Segment Telemetry
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                Bypass Cache: Enabled for probe
              </span>
            </div>

            {loading && !report ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Probing TomTom Flow Segment Data across 4 cities...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {report &&
                  Object.entries(report.city_diagnostics).map(([cityName, probe]) => {
                    const isLive = probe.is_live_api;
                    return (
                      <div
                        key={cityName}
                        className={`rounded-xl border p-4 transition-all ${
                          isLive
                            ? "bg-slate-900/70 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
                            : "bg-slate-900/50 border-amber-500/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{cityName}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  isLive
                                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                    : "bg-amber-950 text-amber-300 border-amber-800"
                                }`}
                              >
                                {isLive ? "LIVE SUCCESS" : "FALLBACK ACTIVE"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 mt-0.5">
                              {probe.tested_corridor}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              [{probe.coordinates[0]}, {probe.coordinates[1]}]
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Source
                            </span>
                            <span className="text-xs font-mono font-medium text-cyan-300">
                              {probe.source || probe.data_source}
                            </span>
                          </div>
                        </div>

                        {/* Telemetry Metrics */}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
                          <div className="bg-slate-950/60 rounded p-1.5">
                            <span className="text-[9px] text-slate-400 block">Current</span>
                            <span className="text-xs font-mono font-bold text-white">
                              {probe.currentSpeed ?? probe.current_speed} km/h
                            </span>
                          </div>

                          <div className="bg-slate-950/60 rounded p-1.5">
                            <span className="text-[9px] text-slate-400 block">Free Flow</span>
                            <span className="text-xs font-mono font-bold text-slate-300">
                              {probe.freeFlowSpeed ?? probe.free_flow_speed} km/h
                            </span>
                          </div>

                          <div className="bg-slate-950/60 rounded p-1.5">
                            <span className="text-[9px] text-slate-400 block">Ratio</span>
                            <span className="text-xs font-mono font-bold text-cyan-300">
                              {probe.congestion_ratio}
                            </span>
                          </div>

                          <div className="bg-slate-950/60 rounded p-1.5">
                            <span className="text-[9px] text-slate-400 block">Level</span>
                            <span
                              className={`text-xs font-bold ${
                                probe.level === "Low"
                                  ? "text-emerald-400"
                                  : probe.level === "Moderate"
                                  ? "text-amber-400"
                                  : probe.level === "High"
                                  ? "text-orange-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {probe.level}
                            </span>
                          </div>
                        </div>

                        {/* Extra telemetry tags: Confidence & Timestamp */}
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                          <div>
                            Confidence:{" "}
                            <span className="font-mono text-slate-300 font-medium">
                              {Math.round(probe.confidence * 100)}%
                            </span>
                          </div>
                          <div className="font-mono">
                            {probe.timestamp ? new Date(probe.timestamp).toLocaleTimeString() : "--"}
                          </div>
                        </div>

                        {/* If Fallback Reason */}
                        {!isLive && probe.fallback_reason && (
                          <div className="mt-2 text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-900/50 rounded p-1.5">
                            Reason: {probe.fallback_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Interactive Live Segment Tester & Unsupported Segment Simulator */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Interactive Flow Segment Tester & Coordinate Inspector
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowFallback}
                    onChange={(e) => setAllowFallback(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Allow Fallback Simulation</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Test any arbitrary Indian coordinate or simulate an unsupported road segment to test TomTom's error responses.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 self-center mr-1">Presets:</span>
              {PRESET_COORDINATES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setProbeLat(p.lat.toString());
                    setProbeLon(p.lon.toString());
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Form Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={probeLat}
                  onChange={(e) => setProbeLat(e.target.value)}
                  placeholder="e.g. 12.9176"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={probeLon}
                  onChange={(e) => setProbeLon(e.target.value)}
                  placeholder="e.g. 77.6238"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunCustomProbe}
                  disabled={probing}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)] disabled:opacity-50"
                >
                  {probing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Test Flow Segment</span>
                </button>
              </div>
            </div>

            {/* Custom Probe Error */}
            {probeError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-300">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">TomTom Flow Segment Error</div>
                  <div className="text-[11px] text-rose-300/90">{probeError}</div>
                  <div className="text-[10px] text-rose-400 mt-1">
                    (Tip: If you tested an ocean or non-road coordinate with "Allow Fallback" disabled, TomTom correctly reports that no segment exists near the coordinate).
                  </div>
                </div>
              </div>
            )}

            {/* Custom Probe Output */}
            {probeResult && (
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  probeResult.is_live || probeResult.source === "tomtom_api"
                    ? "bg-slate-950 border-emerald-500/40"
                    : "bg-slate-950 border-amber-500/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        probeResult.is_live || probeResult.source === "tomtom_api"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                          : "bg-amber-950 text-amber-300 border-amber-700"
                      }`}
                    >
                      {probeResult.is_live || probeResult.source === "tomtom_api"
                        ? "SUCCESS: LIVE TOMTOM API"
                        : "FALLBACK / DETERMINISTIC RESPONSE"}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      Status: {probeResult.status}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
                  >
                    {showRawJson ? "Hide Raw JSON" : "View Raw JSON Payload"}
                  </button>
                </div>

                {/* Returned Fields Table */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">currentSpeed</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {probeResult.currentSpeed} km/h
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">freeFlowSpeed</span>
                    <span className="font-mono font-bold text-slate-300 text-sm">
                      {probeResult.freeFlowSpeed} km/h
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">congestion ratio</span>
                    <span className="font-mono font-bold text-cyan-300 text-sm">
                      {probeResult.congestion_ratio ?? probeResult.congestionRatio}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">level</span>
                    <span
                      className={`font-bold text-sm ${
                        probeResult.level === "Low"
                          ? "text-emerald-400"
                          : probeResult.level === "Moderate"
                          ? "text-amber-400"
                          : probeResult.level === "High"
                          ? "text-orange-400"
                          : "text-rose-400"
                      }`}
                    >
                      {probeResult.level}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">confidence</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(probeResult.confidence * 100)}%
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">source</span>
                    <span className="font-mono text-cyan-300">
                      {probeResult.source}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block font-mono">timestamp</span>
                    <span className="font-mono text-slate-300 text-[11px]">
                      {probeResult.timestamp}
                    </span>
                  </div>
                </div>

                {probeResult.fallback_reason && (
                  <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-900/60 rounded p-2">
                    Fallback reason: {probeResult.fallback_reason}
                  </div>
                )}

                {showRawJson && (
                  <pre className="p-3 rounded-lg bg-black border border-slate-800 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(probeResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>
              Documentation:{" "}
              <a
                href="https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline"
              >
                TomTom Flow Segment Data v4
              </a>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
