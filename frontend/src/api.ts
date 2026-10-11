import {
  CityTrafficData,
  ForecastResponse,
  ModelMetadata,
  CascadeResponse,
  GreenWaveResponse,
  CalibrationResponse,
  RouteComparisonResponse,
  HistoryResponse,
  RouteCalculationRequest,
  RouteCalculationResult,
  RouteCatalogItem,
  PlaceSearchResponse,
} from "./types";

const API_BASE = "/api";

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchCities(): Promise<any> {
  const res = await fetch(`${API_BASE}/cities`);
  if (!res.ok) throw new Error("Failed to load cities");
  return res.json();
}

export async function fetchLiveTraffic(city: string): Promise<CityTrafficData> {
  const res = await fetch(`${API_BASE}/traffic/live?city=${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error(`Failed to load live traffic for ${city}`);
  return res.json();
}

export async function fetchForecast(
  city: string,
  roadId: string,
  weather: string = "Clear",
  roadwork: string = "No",
  targetTimestamp?: string,
  festival?: string,
  horizon?: number
): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city,
      road_id: roadId,
      weather,
      roadwork,
      target_timestamp: targetTimestamp,
      festival,
      horizon,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate forecast");
  return res.json();
}

export async function fetchModelMetadata(): Promise<ModelMetadata> {
  const res = await fetch(`${API_BASE}/model/metadata`);
  if (!res.ok) throw new Error("Failed to load model metadata");
  return res.json();
}

export async function fetchHistory(road?: string): Promise<HistoryResponse> {
  const url = road ? `${API_BASE}/history?road=${encodeURIComponent(road)}` : `${API_BASE}/history`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load historical data");
  return res.json();
}

export async function runCalibration(
  sourceCity: string,
  targetCity: string,
  elasticity: number = 0.55
): Promise<CalibrationResponse> {
  const res = await fetch(`${API_BASE}/calibration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_city: sourceCity,
      target_city: targetCity,
      calibration_elasticity: elasticity,
    }),
  });
  if (!res.ok) throw new Error("Failed to run cross-city calibration");
  return res.json();
}

export async function runCascadeSimulation(
  epicenterId: string,
  severity: number
): Promise<CascadeResponse> {
  const res = await fetch(`${API_BASE}/simulation/cascade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      epicenter_node_id: epicenterId,
      incident_severity: severity,
    }),
  });
  if (!res.ok) throw new Error("Failed to run cascade delay simulation");
  return res.json();
}

export async function runGreenWaveSimulation(
  city: string,
  roadId: string,
  enabled: boolean,
  adjustmentPct: number = 25
): Promise<GreenWaveResponse> {
  const res = await fetch(`${API_BASE}/simulation/green-wave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city,
      road_id: roadId,
      enable_adaptive_signals: enabled,
      green_split_adjustment_pct: adjustmentPct,
    }),
  });
  if (!res.ok) throw new Error("Failed to run Green Wave simulation");
  return res.json();
}

export async function fetchRouteComparison(corridorId: string): Promise<RouteComparisonResponse> {
  const res = await fetch(`${API_BASE}/routes/comparison?corridor_id=${encodeURIComponent(corridorId)}`);
  if (!res.ok) throw new Error("Failed to fetch route comparison");
  return res.json();
}

export async function askAssistant(query: string, context: any): Promise<any> {
  const res = await fetch(`${API_BASE}/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, context }),
  });
  if (!res.ok) throw new Error("Failed to get assistant response");
  return res.json();
}

export async function fetchTomTomDiagnostics(): Promise<any> {
  const res = await fetch(`${API_BASE}/tomtom/diagnostics`);
  if (!res.ok) throw new Error("Failed to fetch TomTom diagnostics");
  return res.json();
}

export async function fetchFlowSegment(
  lat: number,
  lon: number,
  allowFallback: boolean = true,
  skipCache: boolean = false
): Promise<any> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    allow_fallback: allowFallback.toString(),
    skip_cache: skipCache.toString(),
  });
  const res = await fetch(`${API_BASE}/traffic/flow-segment?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(
      errorData?.detail?.message ||
      errorData?.message ||
      `HTTP ${res.status}: Failed to fetch flow segment`
    );
  }
  return res.json();
}

export async function fetchConfiguredCoordinates(): Promise<any> {
  const res = await fetch(`${API_BASE}/config/coordinates`);
  if (!res.ok) throw new Error("Failed to fetch configured coordinates");
  return res.json();
}

export async function calculateCustomRoute(
  params: RouteCalculationRequest
): Promise<RouteCalculationResult> {
  const res = await fetch(`${API_BASE}/routes/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to calculate route");
  }
  return res.json();
}

export async function fetchRouteCatalog(): Promise<{ catalog: RouteCatalogItem[] }> {
  const res = await fetch(`${API_BASE}/routes/catalog`);
  if (!res.ok) throw new Error("Failed to load route catalog");
  return res.json();
}

export async function searchPlaces(
  query: string,
  limit: number = 6,
  countrySet: string = "IN",
  signal?: AbortSignal
): Promise<PlaceSearchResponse> {
  if (!query || query.trim().length < 2) {
    return { query, results: [], count: 0 };
  }
  const params = new URLSearchParams({
    query: query.trim(),
    limit: limit.toString(),
    country_set: countrySet,
  });
  const res = await fetch(`${API_BASE}/places/search?${params.toString()}`, { signal });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `Place search failed with status ${res.status}`);
  }
  return res.json();
}


