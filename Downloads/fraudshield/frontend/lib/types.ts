// Types mirror the backend's Pydantic schemas (app/schemas.py) exactly.

export interface Transaction {
  Time: number;
  V1: number; V2: number; V3: number; V4: number; V5: number;
  V6: number; V7: number; V8: number; V9: number; V10: number;
  V11: number; V12: number; V13: number; V14: number; V15: number;
  V16: number; V17: number; V18: number; V19: number; V20: number;
  V21: number; V22: number; V23: number; V24: number; V25: number;
  V26: number; V27: number; V28: number;
  Amount: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Label = "Fraud" | "Legitimate";

export interface PredictionResult {
  prediction: 0 | 1;
  label: Label;
  fraud_probability: number;
  risk_level: RiskLevel;
  threshold_used: number;
}

export interface FeatureContribution {
  feature: string;
  contribution: number;
}

export interface ExplanationResult {
  prediction: PredictionResult;
  top_increasing_risk: FeatureContribution[];
  top_decreasing_risk: FeatureContribution[];
  disclaimer: string;
}

export interface BatchRowResult {
  row_index: number;
  prediction: 0 | 1;
  label: Label;
  fraud_probability: number;
  risk_level: RiskLevel;
}

export interface BatchPredictionResult {
  row_count: number;
  fraud_count: number;
  legitimate_count: number;
  threshold_used: number;
  results: BatchRowResult[];
}

export interface ModelInfo {
  project_name: string;
  project_version: string;
  model_name: string;
  model_type: string;
  training_date: string;
  feature_names: string[];
  optimal_threshold: number;
  cost_fn: number;
  cost_fp: number;
  random_state: number;
  preprocessing_description: string;
  training_description: string;
  final_metrics: Record<string, number | string>;
  limitations: string[];
}

export interface ModelComparisonRow {
  Model: string;
  Threshold: number;
  Accuracy: number;
  Precision: number;
  Recall: number;
  F1: number;
  "ROC-AUC": number;
  "PR-AUC": number;
  FP: number;
  FN: number;
  "Business Cost": number;
}

export interface MetricsResponse {
  selected_model_metrics: Record<string, number | string>;
  model_comparison?: ModelComparisonRow[];
  threshold_curve?: Record<string, number | string>[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  model_loaded: boolean;
  model_name?: string;
  optimal_threshold?: number;
  sklearn_version?: string;
  detail?: string;
}

export interface ConfigResponse {
  required_columns: string[];
  max_batch_rows: number;
  max_upload_bytes: number;
  shap_enabled: boolean;
  environment: string;
}

export interface SamplesResponse {
  legitimate_example: Transaction | null;
  fraud_example: Transaction | null;
}
