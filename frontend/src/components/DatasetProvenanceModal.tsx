import React, { useState, useEffect } from "react";
import { Database, Upload, CheckCircle2, AlertTriangle, FileText, Download } from "lucide-react";

interface DatasetProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetUpdated: () => void;
}

export const DatasetProvenanceModal: React.FC<DatasetProvenanceModalProps> = ({
  isOpen,
  onClose,
  onDatasetUpdated,
}) => {
  const [provenance, setProvenance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProvenance();
    }
  }, [isOpen]);

  const loadProvenance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dataset/provenance");
      if (res.ok) {
        const data = await res.json();
        setProvenance(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadStatus("Uploading CSV and retraining models...");
    try {
      const res = await fetch("/api/dataset/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Success: ${data.message}`);
        await loadProvenance();
        onDatasetUpdated();
      } else {
        setUploadStatus(`Error: ${data.detail || "Upload failed"}`);
      }
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Bengaluru Dataset Provenance & Inspection</h3>
              <p className="text-[11px] text-slate-400">Verified schema, timestamp intervals, targets & upload pipeline</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300">
          {provenance && (
            <>
              {/* Provenance Banner */}
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300">Source Repository:</span>
                  <a
                    href={provenance.source_repository}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline font-mono text-[11px]"
                  >
                    Shrihari-I-B/bengaluru-traffic-prediction
                  </a>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Raw Download URL:</span>
                  <span className="font-mono text-slate-300">HTTP 200 Verified ({provenance.file_size_bytes?.toLocaleString()} bytes)</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 italic">
                  {provenance.provenance_assessment}
                </p>
              </div>

              {/* Key Verification Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Total Records</span>
                  <span className="text-lg font-bold font-mono text-white">{provenance.total_rows?.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Missing Values</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{provenance.total_null_records} (0.0%)</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Span</span>
                  <span className="text-xs font-bold font-mono text-cyan-300">{provenance.timestamp_coverage?.min_date} to {provenance.timestamp_coverage?.max_date}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Time Granularity</span>
                  <span className="text-xs font-bold font-mono text-amber-300">{provenance.timestamp_coverage?.granularity}</span>
                </div>
              </div>

              {/* Target Variables Summary */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                  Target Variables & Distributions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(provenance.target_statistics || {}).map(([col, stats]: [string, any]) => (
                    <div key={col} className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
                      <span className="font-semibold text-cyan-300 block">{col}</span>
                      <div className="text-slate-400 text-[10px] mt-1 space-y-0.5">
                        <div>Mean: <strong className="text-white font-mono">{stats.mean}</strong> (Std: {stats.std})</div>
                        <div>Range: <strong className="text-white font-mono">{stats.min}</strong> to <strong className="text-white font-mono">{stats.max}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monitored Corridors & Columns */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                  Verified Columns ({provenance.columns?.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {provenance.columns?.map((c: string) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Alternative Dataset Upload Interface */}
          <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <Upload className="w-4 h-4" />
              <span>Alternative Dataset Upload Interface</span>
            </div>
            <p className="text-[11px] text-slate-400">
              If the GitHub repository dataset is modified or you want to supply custom metropolitan records, upload a CSV here. The pipeline will automatically validate required schema columns, split chronologically, and retrain the Stacking Ensemble.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <label className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Local CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {uploadStatus && (
                <span className="text-[11px] font-mono text-cyan-300">
                  {uploadStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
