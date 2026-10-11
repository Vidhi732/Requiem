import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CloudRain,
  Construction,
  Sparkles,
  Zap,
  RotateCcw,
  Sun,
  CloudFog,
  Wind,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface PredictiveTimeTravelProps {
  selectedDateTime: string; // ISO string YYYY-MM-DDTHH:MM
  onChangeDateTime: (val: string) => void;
  selectedWeather: string;
  onChangeWeather: (val: string) => void;
  selectedRoadwork: string;
  onChangeRoadwork: (val: string) => void;
  selectedFestival: string;
  onChangeFestival: (val: string) => void;
  onApplyPrediction: () => void;
  onResetToLive: () => void;
  isCustomActive: boolean;
  loading: boolean;
}

export const PredictiveTimeTravel: React.FC<PredictiveTimeTravelProps> = ({
  selectedDateTime,
  onChangeDateTime,
  selectedWeather,
  onChangeWeather,
  selectedRoadwork,
  onChangeRoadwork,
  selectedFestival,
  onChangeFestival,
  onApplyPrediction,
  onResetToLive,
  isCustomActive,
  loading,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Notable preset times for rapid analysis
  const quickTimePresets = [
    { label: "Morning Peak (9:15 AM)", time: "09:15", icon: "🌅" },
    { label: "Midday (2:00 PM)", time: "14:00", icon: "☀️" },
    { label: "Evening Rush (7:00 PM)", time: "19:00", icon: "🌆" },
    { label: "Night Lull (11:30 PM)", time: "23:30", icon: "🌙" },
  ];

  // Notable Indian Festival Scenarios
  const festivalPresets = [
    { label: "No Active Festival", value: "None" },
    { label: "Diwali / Deepavali (Shopping & Travel)", value: "Diwali / Deepavali" },
    { label: "Ganesh Chaturthi (Pandals & Processions)", value: "Ganesh Chaturthi" },
    { label: "Anant Chaturdashi (Visarjan Gridlock)", value: "Anant Chaturdashi (Visarjan)" },
    { label: "Eid-ul-Fitr (Market Surges)", value: "Eid-ul-Fitr" },
    { label: "New Year's Eve (Night CBD Choke)", value: "New Year's Eve" },
    { label: "Makar Sankranti / Pongal", value: "Makar Sankranti / Pongal" },
    { label: "Republic Day (Clear Corridors)", value: "Republic Day" },
  ];

  const weatherOptions = [
    { label: "Clear", icon: Sun, color: "text-amber-400" },
    { label: "Rain", icon: CloudRain, color: "text-blue-400" },
    { label: "Heavy Rain", icon: CloudRain, color: "text-indigo-400" },
    { label: "Fog", icon: CloudFog, color: "text-slate-300" },
    { label: "Overcast", icon: Layers, color: "text-slate-400" },
    { label: "Windy", icon: Wind, color: "text-teal-300" },
  ];

  const handleApplyPresetTime = (timeStr: string) => {
    const currentDatePart = selectedDateTime.split("T")[0] || new Date().toISOString().split("T")[0];
    onChangeDateTime(`${currentDatePart}T${timeStr}`);
  };

  const handleApplyPresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const datePart = d.toISOString().split("T")[0];
    const timePart = selectedDateTime.split("T")[1] || "18:30";
    onChangeDateTime(`${datePart}T${timePart}`);
  };

  return (
    <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 bg-slate-950/85 shadow-2xl space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Temporal & Contextual Traffic Predictor
              </h3>
              {isCustomActive ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 animate-pulse flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> PREDICTION ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  LIVE REAL-TIME TELEMETRY
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Select any specific date, hour, weather condition, or Indian festival to model predictive congestion
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isCustomActive && (
            <button
              onClick={onResetToLive}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              title="Revert to real-time TomTom live observations"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              Reset to Live
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900 border border-slate-800"
          >
            {isExpanded ? "Collapse Controls" : "Expand Controls"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3.5">
          {/* Row 1: Target Date & Time Picker + Quick Steppers */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Custom Input */}
            <div className="md:col-span-5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                <span>Select Target Date & Time (IST)</span>
                <span className="font-mono text-slate-400 font-normal">YYYY-MM-DD HH:MM</span>
              </label>
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(e) => onChangeDateTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Quick Time Rush Hours */}
            <div className="md:col-span-7 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Standard Commuting Windows (Quick Jump)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickTimePresets.map((p) => (
                  <button
                    key={p.time}
                    onClick={() => handleApplyPresetTime(p.time)}
                    className="px-2 py-1 rounded text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => handleApplyPresetDate(1)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/80 transition cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => handleApplyPresetDate(7)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/80 transition cursor-pointer"
                >
                  Next Week
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Weather, Roadwork Construction, and Indian Festivals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Weather Impact */}
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-blue-400" /> Weather Simulation
                </span>
                <span className="text-slate-400 font-mono text-[9px]">Rain/Fog Slowdowns</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                {weatherOptions.map((w) => {
                  const Icon = w.icon;
                  const isSelected = selectedWeather === w.label;
                  return (
                    <button
                      key={w.label}
                      type="button"
                      onClick={() => onChangeWeather(w.label)}
                      className={`px-2 py-1.5 rounded text-[11px] font-semibold transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        isSelected
                          ? "bg-blue-950 text-blue-200 border-blue-500 shadow-sm"
                          : "bg-slate-950 text-slate-400 hover:text-white border-slate-800"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${w.color}`} />
                      <span>{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Indian Festivals & Special Surges */}
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Cultural & Festival Surges
                </span>
                <span className="text-slate-400 font-mono text-[9px]">Diwali/Ganesh Puja</span>
              </label>

              <select
                value={selectedFestival}
                onChange={(e) => onChangeFestival(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400"
              >
                {festivalPresets.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <p className="text-[10px] text-slate-400 leading-tight">
                Simulates pre-festival shopping rushes, market gridlocks, and regional procession slowdowns.
              </p>
            </div>

            {/* 3. Roadwork & Construction Status */}
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Construction className="w-3 h-3 text-rose-400" /> Active Roadwork / Metro
                </span>
                <span className="text-slate-400 font-mono text-[9px]">-30% Lane Width</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeRoadwork("No")}
                  className={`py-2 px-3 rounded text-xs font-bold transition cursor-pointer border ${
                    selectedRoadwork === "No"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  No Active Work
                </button>
                <button
                  type="button"
                  onClick={() => onChangeRoadwork("Yes")}
                  className={`py-2 px-3 rounded text-xs font-bold transition cursor-pointer border ${
                    selectedRoadwork === "Yes"
                      ? "bg-rose-950 text-rose-300 border-rose-600 shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  Active Construction
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                Reflects lane blockages, barricades, and detour chokepoints along urban flyovers.
              </p>
            </div>
          </div>

          {/* Row 3: Execute Prediction Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>
                Target Time: <strong className="text-white font-mono">{selectedDateTime.replace("T", " ")} IST</strong>
              </span>
              <span>•</span>
              <span>
                Weather: <strong className="text-blue-300">{selectedWeather}</strong>
              </span>
              <span>•</span>
              <span>
                Festival: <strong className="text-amber-300">{selectedFestival}</strong>
              </span>
            </div>

            <button
              onClick={onApplyPrediction}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Zap className="w-4 h-4 animate-spin" />
                  Calculating Predictive Congestion...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  Predict Congestion at This Time
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
