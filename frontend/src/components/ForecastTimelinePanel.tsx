import React, { useState } from "react";
import { ForecastResponse, ForecastHorizonStep } from "../types";
import { Clock, TrendingUp, AlertTriangle, ShieldCheck, Gauge, Info, HelpCircle, Code, Layers } from "lucide-react";

interface ForecastTimelinePanelProps {
  forecast: ForecastResponse | null;
  activeHorizon: number;
  onSelectHorizon: (horizon: number) => void;
  loading: boolean;
}

export const ForecastTimelinePanel: React.FC<ForecastTimelinePanelProps> = ({
  forecast,
  activeHorizon,
  onSelectHorizon,
  loading,
}) => {
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  if (loading) {
    return (
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-800/60 rounded-lg"></div>
          ))}
        </div>
        <div className="h-24 bg-slate-800/40 rounded"></div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="glass-panel p-6 rounded-xl text-center text-slate-400">
        Select a road corridor on the map to inspect multi-horizon traffic forecasts.
      </div>
    );
  }

  const activeStep: ForecastHorizonStep =
    forecast.forecast_timeline.find((s) => s.horizon_minutes === activeHorizon) ||
    forecast.forecast_timeline[0];

  const factors = activeStep.explanation_factors || activeStep.factors;

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-wide">{forecast.road_name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono">
              {forecast.corridor}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span>Model: <strong className="text-slate-300 font-medium">{forecast.active_model}</strong></span>
            <span>•</span>
            <span>Baseline: <strong className="text-slate-300 font-mono">{forecast.historical_learned_baseline_speed} km/h</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {forecast.telemetry_status || forecast.data_source}
            </span>
          </div>

          {forecast.is_custom_point_in_time && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-1 rounded-md text-indigo-200">
              <span className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                Target Point-in-Time:
              </span>
              <strong className="text-white font-mono">{forecast.target_time_display || forecast.target_timestamp}</strong>
              {forecast.context?.festival_name && forecast.context?.festival_name !== "Normal Calendar Day" && (
                <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                  {forecast.context.festival_name}
                </span>
              )}
              {forecast.context?.weather && forecast.context.weather !== "Clear" && (
                <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                  Weather: {forecast.context.weather}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Horizon Selector Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-1 bg-slate-900/90 rounded-lg border border-slate-700/60">
            {forecast.forecast_timeline.map((step) => {
              const isSelected = activeHorizon === step.horizon_minutes;
              return (
                <button
                  key={step.horizon_minutes}
                  onClick={() => onSelectHorizon(step.horizon_minutes)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {step.horizon_label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowFormulaModal(!showFormulaModal)}
            title="Inspect Calibration Formula & Sub-hourly Provenance"
            className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-900/60 transition-colors cursor-pointer"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Horizon Progress Cards (Current, +15, +30, +60 min) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {forecast.forecast_timeline.map((step) => {
          const isSelected = activeHorizon === step.horizon_minutes;
          const level = step.level || step.congestion_band;
          return (
            <div
              key={step.horizon_minutes}
              onClick={() => onSelectHorizon(step.horizon_minutes)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? "bg-slate-850 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-semibold text-slate-200">{step.horizon_label}</span>
                <span className="font-mono text-[10px] text-cyan-400">{step.timestamp}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-white font-mono">{step.predicted_speed}</span>
                <span className="text-[11px] text-slate-400">km/h</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${step.congestion_color}22`,
                    color: step.congestion_color,
                    border: `1px solid ${step.congestion_color}55`,
                  }}
                >
                  {level}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Ratio: {step.congestion_ratio}
                </span>
              </div>
              <div className="mt-1 text-[9px] text-slate-400 truncate font-mono">
                Source: {step.data_source || forecast.data_source}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Horizon Detailed Factors Box */}
      <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Forecasting Factors & Calibration ({activeStep.horizon_label} at {activeStep.timestamp})</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Data Source: <strong className="text-cyan-300 font-mono">{activeStep.data_source || forecast.data_source}</strong></span>
            <span>•</span>
            <span>Free-flow: <strong className="text-white font-mono">{forecast.free_flow_speed} km/h</strong></span>
          </div>
        </div>

        {/* 4 Quantitative Factor Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Live Telemetry Persistence</div>
            <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
              {(factors.live_persistence_weight * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Decay λ: {factors.decay_lambda !== undefined ? factors.decay_lambda : (factors.live_persistence_weight).toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Historical Model Baseline</div>
            <div className="text-sm font-bold text-indigo-400 font-mono mt-0.5">
              {(factors.historical_ml_weight * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Diurnal hourly anchor
            </div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Diurnal Commute Shift</div>
            <div
              className={`text-sm font-bold font-mono mt-0.5 ${
                factors.diurnal_derivative > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {factors.diurnal_derivative > 0 ? "+" : ""}
              {(factors.diurnal_derivative * 100).toFixed(1)}% shift
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Rush-hour trajectory
            </div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Congestion Score / Band</div>
            <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
              {activeStep.congestion_score} / 100
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Level: <strong className="text-slate-200">{activeStep.level || activeStep.congestion_band}</strong>
            </div>
          </div>
        </div>

        {/* Top Explanation Factors List */}
        {factors.top_drivers && factors.top_drivers.length > 0 && (
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span>Explanation Factors for this Horizon</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-300">
              {factors.top_drivers.map((driver, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Honesty Disclaimer */}
        <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/50">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <span>{forecast.disclaimer}</span>
        </div>
      </div>

      {/* Formula Modal / Inspection Accordion */}
      {showFormulaModal && forecast.calibration_formula && (
        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Documented & Testable Calibration Formula</span>
            </div>
            <button
              onClick={() => setShowFormulaModal(false)}
              className="text-slate-400 hover:text-white cursor-pointer text-sm font-mono"
            >
              ✕
            </button>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg font-mono text-cyan-200 border border-slate-800 overflow-x-auto">
            {forecast.calibration_formula.formula}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
            <div className="space-y-1">
              <div className="font-semibold text-white">Autoregressive Decay:</div>
              <p className="font-mono text-cyan-400 text-[11px]">
                {forecast.calibration_formula.decay_function}
              </p>
              <p className="text-[10px] text-slate-400">
                At t=0m, λ=1.000. At +15m, λ≈0.674. At +30m, λ≈0.454. At +60m, λ≈0.206.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-white">Live Inputs & Elasticity:</div>
              <p className="text-[10px] text-slate-400">
                Elasticity η = {forecast.calibration_formula.parameters.elasticity_eta} • Live Speed Ratio = {forecast.calibration_formula.parameters.live_speed_ratio} • Model Ratio = {forecast.calibration_formula.parameters.historical_baseline_ratio}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200">
            <strong>Sub-hourly Provenance Policy:</strong> {forecast.calibration_formula.provenance_disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};
