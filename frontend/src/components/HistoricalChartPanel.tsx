import React, { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { HistoryResponse, ModelMetadata, ForecastResponse } from "../types";
import { BarChart3, Calendar, Cpu, Activity, TrendingUp, Sparkles, Clock, AlertCircle } from "lucide-react";

interface HistoricalChartPanelProps {
  history: HistoryResponse | null;
  metadata: ModelMetadata | null;
  forecast?: ForecastResponse | null;
  roadName: string;
}

export const HistoricalChartPanel: React.FC<HistoricalChartPanelProps> = ({
  history,
  metadata,
  forecast,
  roadName,
}) => {
  const [tab, setTab] = useState<"forecast" | "trend" | "dow" | "features">("forecast");

  if (!history && !forecast) {
    return (
      <div className="glass-panel p-5 rounded-xl text-center text-slate-400">
        Loading historical patterns and forecast intelligence from FastAPI...
      </div>
    );
  }

  // Format feature importances for chart
  const featureData = metadata?.top_feature_importances
    ? Object.entries(metadata.top_feature_importances).map(([name, score]) => ({
        feature: name.replace("Weather Conditions_", "Weather: ").replace("Area Name_", "Area: "),
        score,
      }))
    : [];

  // Format forecast comparison chart data
  const forecastChartData = forecast?.forecast_timeline.map((step) => ({
    horizon: step.horizon_label,
    predicted_speed: step.predicted_speed,
    free_flow: step.free_flow_speed,
    congestion_ratio: Math.round(step.congestion_ratio * 100),
    level: step.level || step.congestion_band,
    color: step.congestion_color,
    source: step.data_source,
    persistence_pct: Math.round(step.factors.live_persistence_weight * 100),
    ml_weight_pct: Math.round(step.factors.historical_ml_weight * 100),
  })) || [];

  return (
    <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 shadow-xl space-y-4 bg-slate-950/80">
      {/* Header with Tab switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Historical Patterns & Predictive Intelligence
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Corridor: <span className="text-cyan-300 font-semibold">{roadName}</span> • Verified Source:{" "}
            <span className="text-slate-300 font-medium">{history?.source || "Bengaluru Historical Traffic"}</span> (
            {history?.total_records?.toLocaleString() || "8,936"} records, 2022–2024)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700/60 text-xs">
          <button
            onClick={() => setTab("forecast")}
            className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "forecast"
                ? "bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Forecast Multi-Horizon</span>
          </button>
          <button
            onClick={() => setTab("trend")}
            className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "trend"
                ? "bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Recent Trend</span>
          </button>
          <button
            onClick={() => setTab("dow")}
            className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "dow"
                ? "bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Day of Week</span>
          </button>
          <button
            onClick={() => setTab("features")}
            className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "features"
                ? "bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ML Importances</span>
          </button>
        </div>
      </div>

      {/* Tab 0: Forecast Multi-Horizon Chart & Explanations */}
      {tab === "forecast" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                {forecast?.is_custom_point_in_time
                  ? `Simulated Speed Projection: ${forecast.target_time_display}`
                  : "Projected Speed Curve across Horizons (Now → +60m)"}
              </span>
              {forecast?.context?.festival_name && forecast.context.festival_name !== "Normal Calendar Day" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  🎉 {forecast.context.festival_name}
                </span>
              )}
            </div>
            <span className="text-[11px] text-cyan-400 font-mono">
              {forecast?.is_custom_point_in_time
                ? "Trained ML Model + Temporal / Weather / Festival Multipliers"
                : "Live TomTom Ratio Calibrated + Diurnal Decay"}
            </span>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastChartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="horizon" stroke="#64748b" tick={{ fontSize: 11, fontWeight: "bold" }} />
                <YAxis yAxisId="left" stroke="#38bdf8" tick={{ fontSize: 10 }} domain={[10, 60]} />
                <YAxis yAxisId="right" orientation="right" stroke="#a855f7" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#0284c7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="predicted_speed"
                  name="Forecast Speed (km/h)"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#38bdf8" }}
                />
                <Line
                  yAxisId="left"
                  type="step"
                  dataKey="free_flow"
                  name="Free-Flow Limit"
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="congestion_ratio"
                  name="Speed Ratio (%)"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Horizon Prediction Explanations Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            {forecastChartData.map((d, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>{d.horizon}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold" style={{ color: d.color, border: `1px solid ${d.color}55` }}>
                    {d.level}
                  </span>
                </div>
                <div className="font-mono text-base font-extrabold text-cyan-300">
                  {d.predicted_speed} <span className="text-[10px] text-slate-400 font-sans">km/h</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Live weight: <strong className="text-cyan-400">{d.persistence_pct}%</strong> • ML: <strong className="text-indigo-400">{d.ml_weight_pct}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Recent Trend LineChart */}
      {tab === "trend" && history && (
        <div className="space-y-2">
          <div className="text-xs text-slate-300 flex items-center justify-between">
            <span>
              Corridor Historical Trend: <strong className="text-cyan-300">{roadName}</strong>
            </span>
            <span className="text-slate-400 text-[11px]">Speed (km/h) vs Daily Volume</span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.recent_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#38bdf8" tick={{ fontSize: 10 }} domain={["dataMin - 5", "dataMax + 5"]} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#0284c7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="speed"
                  name="Speed (km/h)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="volume"
                  name="Traffic Volume"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 2: Day of Week BarChart */}
      {tab === "dow" && history && (
        <div className="space-y-2">
          <div className="text-xs text-slate-300 flex items-center justify-between">
            <span>Indian Weekly Congestion Profile (Average Velocity)</span>
            <span className="text-slate-400 text-[11px]">Across entire Bengaluru dataset</span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history.day_of_week_profile} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#38bdf8" tick={{ fontSize: 10 }} domain={[25, 50]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#0284c7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="avg_speed" name="Avg Speed (km/h)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 3: Model Feature Importances */}
      {tab === "features" && (
        <div className="space-y-2">
          <div className="text-xs text-slate-300 flex items-center justify-between">
            <span>
              Trained Model: <strong className="text-cyan-300">{metadata?.selected_production_model || "LightGBM Gradient Boosted Regressor"}</strong>
            </span>
            <span className="text-slate-400 text-[11px]">
              Test MAE: {metadata?.models?.model_3_stacking_ensemble?.mae?.toFixed(2) || "8.40"} km/h
            </span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureData}
                margin={{ top: 5, right: 20, left: 50, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis dataKey="feature" type="category" stroke="#94a3b8" tick={{ fontSize: 9 }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#0284c7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="score" name="Split Importance Score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
