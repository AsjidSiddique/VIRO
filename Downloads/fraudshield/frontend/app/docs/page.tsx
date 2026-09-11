import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

const ENDPOINTS = [
  { method: "GET", path: "/health", desc: "Service + model load status." },
  { method: "GET", path: "/api/model", desc: "Full model metadata (name, threshold, metrics, limitations)." },
  { method: "GET", path: "/api/metrics", desc: "Model comparison table and threshold curve." },
  { method: "GET", path: "/api/config", desc: "Required columns, batch limits, SHAP availability." },
  { method: "GET", path: "/api/samples", desc: "Bundled real sample transactions (legitimate/fraud if available)." },
  { method: "POST", path: "/api/predict", desc: "Score a single transaction." },
  { method: "POST", path: "/api/predict/batch", desc: "Score a CSV of transactions (multipart/form-data)." },
  { method: "POST", path: "/api/explain", desc: "Score a transaction and return SHAP feature contributions." },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PageHeader title="Documentation" description="API reference and integration notes for FraudShield." />

      <Card className="mb-6">
        <CardHeader><CardTitle>REST API</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">Path</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-mono text-accent">{e.method}</td>
                  <td className="py-2 pr-4 font-mono">{e.path}</td>
                  <td className="py-2 text-muted">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Request / Response Contract</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-muted">POST /api/predict — request body</p>
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 text-xs">
{`{
  "Time": 12345,
  "V1": -1.35, "V2": -0.07, ..., "V28": -0.02,
  "Amount": 149.50
}`}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-muted">Response</p>
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 text-xs">
{`{
  "prediction": 1,
  "label": "Fraud",
  "fraud_probability": 0.914,
  "risk_level": "HIGH",
  "threshold_used": 0.44
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>The web application does not retrain the model. It loads the saved production artifacts once at startup and performs inference only.</p>
          <p>V1&ndash;V28 are anonymized PCA-derived features from the original dataset owners and carry no disclosed real-world meaning.</p>
          <p>See the project README for local setup, deployment, and environment variable instructions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
