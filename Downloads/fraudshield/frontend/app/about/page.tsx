import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader title="About FraudShield" />
      <Card>
        <CardContent className="space-y-4 pt-6 text-sm leading-relaxed text-muted">
          <p>
            FraudShield is a research/portfolio project demonstrating an end-to-end,
            explainable, cost-sensitive fraud detection pipeline built on the public Kaggle
            Credit Card Fraud Detection dataset (284,807 European cardholder transactions,
            September 2013).
          </p>
          <p>
            <strong className="text-foreground">This is not a real banking production system.</strong>{" "}
            It is a demonstration of imbalance-aware machine learning, cost-sensitive threshold
            optimization, and explainable AI, built to a production-style standard — a FastAPI
            inference service loading real trained artifacts, and a Next.js frontend that never
            fabricates results.
          </p>
          <p>
            The dataset&apos;s <code className="text-foreground">V1&ndash;V28</code> features are
            anonymized outputs of a PCA transformation performed by the original data owners for
            confidentiality; this project does not assign them invented real-world meaning
            anywhere in the notebook, backend, or UI.
          </p>
          <p>
            See <a href="/docs" className="text-accent underline">Documentation</a> for the API
            reference and the project README for setup and deployment instructions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
