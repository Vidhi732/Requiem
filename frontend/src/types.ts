export interface RoadSegment {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lon: number;
  free_flow_speed: number;
  historical_area?: string;
  current_speed: number;
  congestion_ratio: number;
  congestion_band: "Low" | "Moderate" | "High" | "Severe";
  congestion_color: string;
  confidence: number;
  road_closure: boolean;
  data_source: string;
  is_cached?: boolean;
  fallback_reason?: string;
}

export interface CityTrafficData {
  city: string;
  state: string;
  center: [number, number];
  data_source: string;
  roads: RoadSegment[];
  summary: {
    average_speed: number;
    average_free_flow_speed: number;
    congestion_ratio: number;
    congestion_band: "Low" | "Moderate" | "High" | "Severe";
    congestion_color: string;
    monitored_segments: number;
  };
  timestamp: string;
}

export interface ForecastHorizonStep {
  horizon_minutes: number;
  horizon_label: string;
  timestamp: string;
  iso_timestamp?: string;
  predicted_speed: number;
  free_flow_speed: number;
  congestion_ratio: number;
  congestion_score: number;
  congestion_band: "Low" | "Moderate" | "High" | "Severe";
  level?: "Low" | "Moderate" | "High" | "Severe" | string;
  congestion_color: string;
  data_source?: string;
  factors: {
    top_drivers?: string[];
    live_persistence_weight: number;
    historical_ml_weight: number;
    decay_lambda?: number;
    diurnal_derivative: number;
    live_anomaly_delta?: number;
    weather_impact: string;
    roadwork_active: boolean;
    validation_note?: string;
  };
  explanation_factors?: {
    top_drivers?: string[];
    live_persistence_weight: number;
    historical_ml_weight: number;
    decay_lambda?: number;
    diurnal_derivative: number;
    live_anomaly_delta?: number;
    weather_impact: string;
    roadwork_active: boolean;
    validation_note?: string;
  };
}

export interface ForecastResponse {
  city: string;
  road_id: string;
  road_name: string;
  corridor: string;
  coordinates: [number, number];
  active_model: string;
  ml_pipeline_status: string;
  telemetry_status?: string;
  data_source: string;
  live_telemetry_source?: string;
  target_timestamp?: string;
  target_time_display?: string;
  is_custom_point_in_time?: boolean;
  context?: {
    target_time_ist: string;
    time_slot_label: string;
    day_of_week: string;
    is_weekend: boolean;
    diurnal_pressure: number;
    weather: string;
    weather_speed_factor: number;
    weather_description: string;
    roadwork: string;
    roadwork_speed_factor: number;
    roadwork_description: string;
    festival?: {
      name: string;
      type: string;
      speed_factor: number;
      volume_factor: number;
      impact: string;
    };
    festival_name: string;
    festival_impact: string;
    festival_speed_factor: number;
    combined_context_factor: number;
  };
  forecast_timeline: ForecastHorizonStep[];
  historical_learned_baseline_speed: number;
  free_flow_speed: number;
  calibration_formula?: {
    formula: string;
    decay_function: string;
    context_multipliers?: Record<string, number>;
    parameters: Record<string, any>;
    horizons_covered: number[];
    provenance_disclaimer: string;
  };
  disclaimer: string;
}

export interface ModelMetadata {
  status: string;
  selected_production_model: string;
  target: string;
  train_samples: number;
  test_samples: number;
  models: {
    model_1_tabular: {
      name: string;
      status: string;
      mae: number;
      rmse: number;
      r2: number;
      description: string;
    };
    model_2_spatial_temporal: {
      name: string;
      status: string;
      trained: boolean;
      explanation: string;
    };
    model_3_stacking_ensemble: {
      name: string;
      status: string;
      mae: number;
      rmse: number;
      r2: number;
      description: string;
    };
  };
  top_feature_importances: Record<string, number>;
  dataset_summary: {
    record_count: number;
    date_range: [string, string];
    roads_count: number;
    roads: string[];
    avg_speed_mean: number;
    congestion_mean: number;
  };
}

export interface CascadeNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity_vph: number;
  base_delay_min: number;
  corridor: string;
  is_epicenter: boolean;
  simulated_risk_score: number;
  downstream_hop: number;
  estimated_added_delay_min: number;
  propagation_status: string;
}

export interface CascadeEdge {
  from: string;
  to: string;
  distance_km: number;
  coupling_strength: number;
}

export interface CascadeResponse {
  epicenter: string;
  epicenter_name: string;
  incident_severity: number;
  simulation_disclaimer: string;
  nodes: CascadeNode[];
  edges: CascadeEdge[];
  timeline: Array<{
    step: number;
    relative_time: string;
    node_id: string;
    node_name: string;
    event: string;
    affected_risk: number;
  }>;
}

export interface GreenWaveResponse {
  city: string;
  road_id: string;
  road_name: string;
  adaptive_signals_enabled: boolean;
  baseline: {
    speed_kmh: number;
    congestion_ratio: number;
    congestion_band: string;
    idle_delay_seconds: number;
    cycle_time_seconds: number;
    green_split_seconds: number;
  };
  intervention: {
    speed_kmh: number;
    congestion_ratio: number;
    congestion_band: string;
    color: string;
    idle_delay_seconds: number;
    cycle_time_seconds: number;
    green_split_seconds: number;
    recommended_timing_adjustment: string;
  } | null;
  comparison: {
    speed_gain_kmh: number;
    congestion_ratio_delta: number;
    delay_saved_seconds: number;
    delay_reduction_pct: number;
  };
  projected_timeline: Array<{
    horizon_label: string;
    baseline_speed: number;
    intervention_speed: number;
    speed_gain: number;
    baseline_band: string;
    intervention_band: string;
  }>;
  recommendation: string;
  disclaimer: string;
}

export interface CalibrationResponse {
  source_city: string;
  target_city: string;
  methodology: string;
  methodology_note: string;
  data_availability: {
    source_historical_records: number;
    source_date_range: [string, string];
    target_monitored_segments: number;
    target_data_source: string;
  };
  metrics: {
    source_reference_speed_kmh: number;
    target_live_speed_kmh: number;
    target_free_flow_speed_kmh: number;
    target_live_congestion_ratio: number;
    relative_domain_ratio_gamma: number;
    calibration_elasticity: number;
    calibration_adjustment_factor: number;
  };
  before_vs_after: {
    before: {
      predicted_speed: number;
      congestion_ratio: number;
      congestion_band: string;
      color: string;
    };
    after: {
      predicted_speed: number;
      congestion_ratio: number;
      congestion_band: string;
      color: string;
    };
    net_speed_delta_kmh: number;
  };
  corridor_comparisons: Array<{
    road_id: string;
    name: string;
    live_speed: number;
    free_flow_speed: number;
    before_calibration_speed: number;
    after_calibration_speed: number;
    speed_difference: number;
    before_band: string;
    after_band: string;
  }>;
}

export interface RouteHorizonPrediction {
  horizon_minutes: number;
  label: string;
  travel_time_min: number;
  predicted_speed: number;
  congestion_ratio: number;
  congestion_band: string;
  congestion_color: string;
  delay_min: number;
}

export interface RouteItem {
  id: string;
  name: string;
  description: string;
  distance_km: number;
  current_speed_kmh: number;
  free_flow_speed_kmh: number;
  congestion_ratio: number;
  congestion_band: string;
  current_travel_time_min: number;
  free_flow_travel_time_min: number;
  traffic_delay_min: number;
  forecast_congestion_30m: string;
  co2_emissions_kg: number;
  excess_co2_congestion_kg: number;
  fuel_wasted_litres: number;
  polyline?: [number, number][];
  predictions?: RouteHorizonPrediction[];
  is_live_tomtom?: boolean;
  source?: string;
  is_toll?: boolean;
}

export interface RouteCatalogItem {
  id: string;
  title: string;
  corridor_type: "intercity" | "intracity";
  origin_city: string;
  dest_city: string;
  origin?: string;
  destination?: string;
  origin_coords?: [number, number];
  dest_coords?: [number, number];
  routes_count?: number;
}

export interface RouteComparisonResponse {
  corridor_id: string;
  title: string;
  corridor_type?: "intercity" | "intracity";
  origin_city?: string;
  dest_city?: string;
  origin: string;
  destination: string;
  origin_coords?: [number, number];
  dest_coords?: [number, number];
  available_corridors: RouteCatalogItem[];
  fastest_route_id: string;
  greenest_route_id: string;
  routes: RouteItem[];
  disclaimer: string;
}

export interface RouteCalculationRequest {
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  origin_label?: string;
  dest_label?: string;
  origin_city?: string;
  dest_city?: string;
}

export interface RouteCalculationResult {
  origin_label: string;
  dest_label: string;
  origin_city?: string;
  dest_city?: string;
  origin_coords: [number, number];
  dest_coords: [number, number];
  distance_km: number;
  current_speed_kmh: number;
  free_flow_speed_kmh: number;
  congestion_ratio: number;
  congestion_band: string;
  congestion_color: string;
  current_travel_time_min: number;
  free_flow_travel_time_min: number;
  traffic_delay_min: number;
  co2_emissions_kg: number;
  excess_co2_congestion_kg: number;
  fuel_wasted_litres: number;
  is_live_tomtom: boolean;
  source: string;
  polyline: [number, number][];
  predictions: RouteHorizonPrediction[];
  timestamp: string;
  provenance: string;
}

export interface HistoryResponse {
  source: string;
  road_name: string;
  recent_series: Array<{
    date: string;
    speed: number;
    volume: number;
    congestion: number;
    weather: string;
  }>;
  day_of_week_profile: Array<{
    day: string;
    avg_speed: number;
    avg_volume: number;
  }>;
  total_records: number;
}

export interface CityDiagnosticProbe {
  tested_corridor: string;
  coordinates: [number, number];
  source: string;
  data_source: string;
  status: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  current_speed?: number;
  free_flow_speed?: number;
  congestion_ratio: number;
  congestionRatio?: number;
  level: string;
  congestion_band?: string;
  confidence: number;
  road_closure?: boolean;
  is_live_api: boolean;
  fallback_reason?: string;
  error_type?: string;
  http_status?: number;
  timestamp: string;
  api_endpoint: string;
}

export interface TomTomDiagnosticReport {
  api_key_configured: boolean;
  key_preview: string;
  total_probes: number;
  live_api_successes: number;
  fallbacks_active: number;
  system_status: "LIVE_TOMTOM_OPERATIONAL" | "FALLBACK_CALIBRATION_ACTIVE" | string;
  city_diagnostics: Record<string, CityDiagnosticProbe>;
  unsupported_segment_test: {
    test_coordinate: [number, number];
    handled_correctly: boolean;
    result_status: string;
    result_message: string;
  };
  documentation: string;
}

export interface FlowSegmentResponse {
  currentSpeed: number;
  freeFlowSpeed: number;
  congestion_ratio: number;
  congestionRatio: number;
  level: string;
  confidence: number;
  timestamp: string;
  source: string;
  status: string;
  is_live?: boolean;
  road_closure?: boolean;
  frc?: string;
  currentTravelTime?: number;
  freeFlowTravelTime?: number;
  coordinates?: Array<{ latitude: number; longitude: number }>;
  fallback_reason?: string;
  error_type?: string;
  http_status?: number;
  message?: string;
  api_disclaimer?: string;
  raw_flow?: any;
}

export interface PlaceSearchResult {
  id?: string;
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
  municipality: string;
  country?: string;
  type: string;
  source?: string;
}

export interface PlaceSearchResponse {
  query: string;
  results: PlaceSearchResult[];
  count: number;
}

