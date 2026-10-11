import React, { useState, useEffect, useRef } from "react";
import { PlaceSearchResult } from "../types";
import { searchPlaces } from "../api";
import {
  Search,
  MapPin,
  Loader2,
  X,
  Compass,
  Building,
  Navigation,
  Train,
  CheckCircle,
} from "lucide-react";

interface PlaceSearchInputProps {
  label: string;
  placeholder?: string;
  selectedPlace: PlaceSearchResult | null;
  onSelectPlace: (place: PlaceSearchResult) => void;
  onClearPlace: () => void;
  accentColor?: "emerald" | "rose" | "cyan";
  popularSuggestions?: Array<{ label: string; sublabel: string; lat: number; lon: number; municipality: string; type: string }>;
}

export const PlaceSearchInput: React.FC<PlaceSearchInputProps> = ({
  label,
  placeholder = "Search station, landmark, IT park, junction in India...",
  selectedPlace,
  onSelectPlace,
  onClearPlace,
  accentColor = "emerald",
  popularSuggestions = [
    { label: "Silk Board Junction", sublabel: "Outer Ring Road / Hosur Road, Bengaluru", lat: 12.9176, lon: 77.6238, municipality: "Bengaluru", type: "Junction" },
    { label: "Bandra Kurla Complex (BKC)", sublabel: "Bandra East, Mumbai, Maharashtra", lat: 19.0657, lon: 72.8687, municipality: "Mumbai", type: "Commercial Hub" },
    { label: "Hinjawadi IT Park Phase 1", sublabel: "Hinjawadi, Pune, Maharashtra", lat: 18.5912, lon: 73.7389, municipality: "Pune", type: "IT Corridor" },
    { label: "Connaught Place", sublabel: "Radial Road / Rajiv Chowk, New Delhi", lat: 28.6315, lon: 77.2167, municipality: "Delhi", type: "Central Node" },
    { label: "Kempegowda Intl Airport (BLR)", sublabel: "Devanahalli, Bengaluru", lat: 13.1986, lon: 77.7066, municipality: "Bengaluru", type: "Airport" },
    { label: "Chhatrapati Shivaji Maharaj Terminus (CSMT)", sublabel: "Fort, South Mumbai", lat: 18.9401, lon: 72.8354, municipality: "Mumbai", type: "Railway Terminus" },
  ],
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync internal query when a place is selected externally
  useEffect(() => {
    if (selectedPlace) {
      setQuery(selectedPlace.label);
    } else {
      setQuery("");
    }
  }, [selectedPlace]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search when query changes
  useEffect(() => {
    if (selectedPlace && selectedPlace.label === query) {
      // Do not search if query matches currently selected place
      return;
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setSearchError(null);
      try {
        const resp = await searchPlaces(query, 6, "IN", controller.signal);
        setResults(resp.results || []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Place search failed:", err);
          setSearchError("Live search unavailable");
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedPlace]);

  const handleSelect = (place: PlaceSearchResult) => {
    onSelectPlace(place);
    setQuery(place.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onClearPlace();
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const listToNavigate = results.length > 0 ? results : popularSuggestions;
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < listToNavigate.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : listToNavigate.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < listToNavigate.length) {
        handleSelect(listToNavigate[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const colorStyles = {
    emerald: {
      badgeBg: "bg-emerald-950/80 text-emerald-400 border-emerald-800",
      dot: "bg-emerald-400",
      focusBorder: "focus-within:border-emerald-500 focus-within:ring-emerald-500/20",
      accentText: "text-emerald-400",
      hoverBg: "hover:bg-emerald-950/40",
      activeBg: "bg-emerald-950/60 text-emerald-200",
    },
    rose: {
      badgeBg: "bg-rose-950/80 text-rose-400 border-rose-800",
      dot: "bg-rose-400",
      focusBorder: "focus-within:border-rose-500 focus-within:ring-rose-500/20",
      accentText: "text-rose-400",
      hoverBg: "hover:bg-rose-950/40",
      activeBg: "bg-rose-950/60 text-rose-200",
    },
    cyan: {
      badgeBg: "bg-cyan-950/80 text-cyan-400 border-cyan-800",
      dot: "bg-cyan-400",
      focusBorder: "focus-within:border-cyan-500 focus-within:ring-cyan-500/20",
      accentText: "text-cyan-400",
      hoverBg: "hover:bg-cyan-950/40",
      activeBg: "bg-cyan-950/60 text-cyan-200",
    },
  }[accentColor];

  const getItemIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("station") || t.includes("rail") || t.includes("train")) {
      return <Train className="w-3.5 h-3.5 text-cyan-400" />;
    }
    if (t.includes("airport") || t.includes("corridor") || t.includes("road")) {
      return <Navigation className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (t.includes("commercial") || t.includes("poi") || t.includes("building")) {
      return <Building className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <MapPin className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Header Label and Status */}
      <div className="flex items-center justify-between">
        <label className={`text-[11px] font-bold flex items-center gap-1.5 ${colorStyles.accentText}`}>
          <span className={`w-2 h-2 rounded-full ${colorStyles.dot} animate-pulse`}></span>
          {label}
        </label>
        {selectedPlace && (
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            {selectedPlace.lat.toFixed(4)}, {selectedPlace.lon.toFixed(4)}
          </span>
        )}
      </div>

      {/* Input Field Container */}
      <div
        className={`relative flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 transition-all shadow-inner focus-within:ring-2 ${colorStyles.focusBorder}`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
        />

        {/* Loading Indicator */}
        {isLoading && (
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0 mx-1" />
        )}

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition shrink-0"
            title="Clear place"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
          {/* Active Results from Live TomTom API */}
          {results.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-cyan-400/90 bg-cyan-950/40 flex items-center justify-between">
                <span>TomTom Live Matches ({results.length})</span>
                <span className="text-[9px] text-slate-400 font-mono">Real-Time GPS</span>
              </div>
              {results.map((item, idx) => {
                const isSelected = highlightedIndex === idx;
                return (
                  <div
                    key={item.id || `${item.lat}_${item.lon}_${idx}`}
                    onMouseDown={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 cursor-pointer transition flex items-start justify-between gap-2 text-left ${
                      isSelected ? colorStyles.activeBg : colorStyles.hoverBg
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">{getItemIcon(item.type)}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.sublabel || item.municipality}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800/90 text-slate-300 font-mono">
                        {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                      </span>
                      {item.type && (
                        <span className="text-[9px] text-cyan-400 font-medium">
                          {item.type}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty search results fallback when query typed but 0 results */}
          {query.trim().length >= 2 && !isLoading && results.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400 space-y-1">
              <Compass className="w-5 h-5 text-slate-500 mx-auto" />
              <p>No TomTom results found for "{query}".</p>
              <p className="text-[10px] text-slate-500">
                Try searching by landmark, road junction, or transit station name.
              </p>
            </div>
          )}

          {/* Popular Hubs / Suggested Shortcuts when query is short or initial */}
          {query.trim().length < 2 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/60 flex items-center justify-between">
                <span>Frequently Traversed Indian Transit Hubs</span>
                <span className="text-[9px] text-slate-500">Quick Select</span>
              </div>
              {popularSuggestions.map((item, idx) => {
                const isSelected = highlightedIndex === idx;
                return (
                  <div
                    key={`popular_${item.lat}_${item.lon}_${idx}`}
                    onMouseDown={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 cursor-pointer transition flex items-start justify-between gap-2 text-left ${
                      isSelected ? colorStyles.activeBg : colorStyles.hoverBg
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">{getItemIcon(item.type)}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.sublabel}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                        {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-medium">
                        {item.municipality}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
