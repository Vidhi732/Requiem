import React, { useState, useEffect } from "react";
import { CalibrationResponse } from "../types";
import { runCalibration } from "../api";
import { Sliders, ArrowRight, ShieldAlert, Sparkles, Building2 } from "lucide-react";

interface CalibrationPanelProps {
  currentCity: string;
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ currentCity }) => {
  const [sourceCity, setSourceCity] = useState("Bengaluru");
  const [targetCity, setTargetCity] = useState(currentCity !== "Bengaluru" ? currentCity : "Mumbai");
  const [elasticity, setElasticity] = useState(0.55);
  const [calibrationData, setCalibrationData] = useState<CalibrationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const availableCities = ["Bengaluru", "Mumbai", "Pune", "Delhi"];

  const handleRun = async () => {
    setLoading(true);
    try {
      const data = await runCalibration(sourceCity, targetCity, elasticity);
      setCalibrationData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRun();
  }, [sourceCity, targetCity, elasticity]);

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4">
      {/* Title & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Cross-City Domain Calibration
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparently transfers learned temporal dynamics to new metropolitan target corridors
          </p>
        </div>

        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase">
          Live-Data-Assisted Calibration (Non Zero-Shot)
        </span>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
            Source City (Historical Base)
          </label>
          <select
            value={sourceCity}
            onChange={(e) => setSourceCity(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c} (8,936 Records)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
            Target City (Live Telemetry)
          </label>
          <select
            value={targetCity}
            onChange={(e) => setTargetCity(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c} (Target Corridors)
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
            <span>Domain Elasticity (β)</span>
            <span className="text-cyan-300 font-mono">{elasticity}</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.9"
            step="0.05"
            value={elasticity}
            onChange={(e) => setElasticity(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Before vs After Cards */}
      {calibrationData && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Before */}
            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Uncalibrated Model Transfer
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-300 font-mono">
                  {calibrationData.before_vs_after.before.predicted_speed}
                </span>
                <span className="text-xs text-slate-500">km/h</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Band:{" "}
                <span className="font-semibold text-slate-300">
                  {calibrationData.before_vs_after.before.congestion_band}
                </span>{" "}
                (Ratio: {calibrationData.before_vs_after.before.congestion_ratio})
              </div>
            </div>

            {/* Shift Delta */}
            <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-lg flex flex-col justify-center items-center text-center">
              <span className="text-[10px] text-cyan-300 uppercase tracking-wider">
                Live Domain Adaptation Delta
              </span>
              <div className="mt-1 text-2xl font-black font-mono text-cyan-400">
                {calibrationData.before_vs_after.net_speed_delta_kmh > 0 ? "+" : ""}
                {calibrationData.before_vs_after.net_speed_delta_kmh} km/h
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                Relative Ratio (γ): {calibrationData.metrics.relative_domain_ratio_gamma}
              </span>
            </div>

            {/* After */}
            <div className="p-3 bg-slate-900/70 border border-cyan-500/40 rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.15)]">
              <span className="text-[10px] text-cyan-300 uppercase tracking-wider block">
                Calibrated Target Velocity
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-white font-mono">
                  {calibrationData.before_vs_after.after.predicted_speed}
                </span>
                <span className="text-xs text-slate-400">km/h</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Band:{" "}
                <span
                  className="font-bold px-1.5 py-0.5 rounded text-[11px]"
                  style={{
                    backgroundColor: `${calibrationData.before_vs_after.after.color}22`,
                    color: calibrationData.before_vs_after.after.color,
                  }}
                >
                  {calibrationData.before_vs_after.after.congestion_band}
                </span>{" "}
                (Ratio: {calibrationData.before_vs_after.after.congestion_ratio})
              </div>
            </div>
          </div>

          {/* Target Corridors breakdown table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
            <table className="w-full text-[11px] text-left text-slate-300">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Target Corridor</th>
                  <th className="px-3 py-2">Live Speed</th>
                  <th className="px-3 py-2">Before Calibration</th>
                  <th className="px-3 py-2">After Calibration</th>
                  <th className="px-3 py-2">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {calibrationData.corridor_comparisons.map((c) => (
                  <tr key={c.road_id} className="hover:bg-slate-900/40">
                    <td className="px-3 py-2 font-medium text-slate-200">{c.name}</td>
                    <td className="px-3 py-2 font-mono text-cyan-400">{c.live_speed} km/h</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{c.before_calibration_speed} km/h</td>
                    <td className="px-3 py-2 font-mono font-bold text-white">{c.after_calibration_speed} km/h</td>
                    <td className="px-3 py-2 font-mono text-emerald-400">
                      {c.speed_difference > 0 ? "+" : ""}
                      {c.speed_difference} km/h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-400 italic">
            Note: Calibration scales source parameters by live TomTom speed ratio; does not invent unvalidated zero-shot transfer claims.
          </p>
        </div>
      )}
    </div>
  );
};
