import React, { useState, useEffect } from "react";
import { GreenWaveResponse } from "../types";
import { runGreenWaveSimulation } from "../api";
import { Zap, Timer, ArrowUpRight, ShieldCheck, CheckCircle2 } from "lucide-react";

interface GreenWavePanelProps {
  city: string;
  roadId: string;
}

export const GreenWavePanel: React.FC<GreenWavePanelProps> = ({ city, roadId }) => {
  const [enabled, setEnabled] = useState(true);
  const [splitPct, setSplitPct] = useState(25);
  const [simData, setSimData] = useState<GreenWaveResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const data = await runGreenWaveSimulation(city, roadId, enabled, splitPct);
      setSimData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [city, roadId, enabled, splitPct]);

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Dynamic Green Wave Simulator
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            What-If model for adaptive arterial traffic signal green-split coordination
          </p>
        </div>

        {/* Enable Toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/80">
          <span className="text-xs font-semibold text-slate-300">AI Signal Optimization</span>
          <div className="relative inline-block w-9 h-5">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </div>
        </label>
      </div>

      {/* Split Control */}
      {enabled && (
        <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-semibold text-slate-200 block">
              Coordinated Green Phase Reallocation (+{splitPct}%)
            </span>
            <span className="text-[11px] text-slate-400">
              Shift non-critical phase green seconds to heavy flow platoon
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={splitPct}
              onChange={(e) => setSplitPct(parseInt(e.target.value))}
              className="w-36 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-emerald-400 font-mono w-10 text-right">
              +{splitPct}%
            </span>
          </div>
        </div>
      )}

      {/* Metrics Comparison */}
      {simData && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Baseline */}
            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Baseline (Fixed Cycle)
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-300 font-mono">
                  {simData.baseline.speed_kmh}
                </span>
                <span className="text-xs text-slate-500">km/h</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Cycle: <strong className="text-slate-300">{simData.baseline.cycle_time_seconds}s</strong> (Green:{" "}
                {simData.baseline.green_split_seconds}s)
              </div>
              <div className="text-[11px] text-slate-400">
                Idle Delay: <span className="text-amber-400 font-mono font-bold">{simData.baseline.idle_delay_seconds}s</span>
              </div>
            </div>

            {/* Performance Gain */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex flex-col justify-center items-center text-center">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">
                Simulated Velocity Gain
              </span>
              <div className="mt-1 text-2xl font-black font-mono text-emerald-400">
                +{simData.comparison.speed_gain_kmh} km/h
              </div>
              <span className="text-[11px] text-slate-300 mt-1">
                Delay Saved:{" "}
                <strong className="text-emerald-300 font-mono">
                  -{simData.comparison.delay_saved_seconds}s
                </strong>{" "}
                ({simData.comparison.delay_reduction_pct}%)
              </span>
            </div>

            {/* Intervention */}
            <div className="p-3 bg-slate-900/70 border border-emerald-500/40 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider block">
                Adaptive Signal Outcome
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-white font-mono">
                  {simData.intervention?.speed_kmh || simData.baseline.speed_kmh}
                </span>
                <span className="text-xs text-slate-400">km/h</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Green Split:{" "}
                <strong className="text-emerald-400">
                  {simData.intervention?.green_split_seconds || simData.baseline.green_split_seconds}s
                </strong>
              </div>
              <div className="text-[11px] text-slate-400">
                Congestion Band:{" "}
                <span className="text-emerald-400 font-bold">
                  {simData.intervention?.congestion_band || simData.baseline.congestion_band}
                </span>
              </div>
            </div>
          </div>

          {/* Intervention Recommendation & Disclaimer */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-slate-200">
                <strong>Recommended Signal Timing:</strong> {simData.recommendation}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 italic">
              {simData.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
