import React, { useState, useEffect } from "react";
import { CascadeResponse } from "../types";
import { runCascadeSimulation } from "../api";
import { Network, AlertCircle, FastForward, GitFork } from "lucide-react";

export const CascadeDelayPanel: React.FC = () => {
  const [epicenter, setEpicenter] = useState("blr_silk_board");
  const [severity, setSeverity] = useState(0.8);
  const [cascadeData, setCascadeData] = useState<CascadeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const data = await runCascadeSimulation(epicenter, severity);
      setCascadeData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [epicenter, severity]);

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Cascade-Delay Propagation Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulates dynamic queue diffusion across topologically coupled Bengaluru corridors
          </p>
        </div>

        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 uppercase">
          Theoretical Network Simulation
        </span>
      </div>

      {/* Simulator Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
            Choke-Point Origin (Epicenter Node)
          </label>
          <select
            value={epicenter}
            onChange={(e) => setEpicenter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="blr_silk_board">Silk Board Junction (Primary Bottleneck)</option>
            <option value="blr_hsr_layout">HSR Layout Ring Road</option>
            <option value="blr_sony_world">Sony World (Koramangala 80ft Rd)</option>
            <option value="blr_orr_bellandur">Outer Ring Road (Bellandur Tech Zone)</option>
            <option value="blr_sarjapur_rd">Sarjapur Road Junction</option>
            <option value="blr_marathahalli">Marathahalli Bridge Underpass</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
            <span>Incident Shock Severity</span>
            <span className="text-rose-400 font-mono font-bold">{Math.round(severity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={severity}
            onChange={(e) => setSeverity(parseFloat(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Network Nodes Grid */}
      {cascadeData && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Coupled Corridors Risk Distribution:</span>
            <span className="text-[11px] text-slate-400">Physical Attenuation Factor: exp(-0.18 · d)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {cascadeData.nodes.map((node) => {
              const risk = node.simulated_risk_score;
              const isEpicenter = node.is_epicenter;
              return (
                <div
                  key={node.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isEpicenter
                      ? "bg-rose-950/40 border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                      : "bg-slate-900/70 border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={`font-bold ${isEpicenter ? "text-rose-300" : "text-slate-200"}`}>
                      {node.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{node.corridor}</span>
                  </div>

                  <div className="flex items-baseline justify-between mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Downstream Risk</span>
                      <span
                        className={`text-lg font-black font-mono ${
                          risk > 60 ? "text-rose-400" : risk > 35 ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {risk}%
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Est. Added Delay</span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        +{node.estimated_added_delay_min} min
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                    {node.propagation_status}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sequential Diffusion Timeline */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-300 block">
              Simulated Spillover Arrival Timeline:
            </span>
            <div className="space-y-1.5">
              {cascadeData.timeline.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-cyan-400 font-bold">
                    {step.relative_time}
                  </span>
                  <span>{step.event}</span>
                  <span className="ml-auto font-mono text-rose-400 font-bold">{step.affected_risk}% risk</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic">
            {cascadeData.simulation_disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};
