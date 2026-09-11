import Link from "next/link";
import { ShieldCheck, Brain, Scale, Cpu, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { HeroRiskVisual } from "@/components/dashboard/HeroRiskVisual";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Fraud Detection",
    description:
      "An imbalance-aware Random Forest classifier trained on a highly skewed, real-world-style transaction dataset (~0.17% fraud).",
  },
  {
    icon: Brain,
    title: "Explainable AI",
    description:
      "SHAP explanations show which anonymized model features pushed each prediction toward or away from fraud — never a causal claim.",
  },
  {
    icon: Scale,
    title: "Cost-Sensitive Decisions",
    description:
      "The decision threshold is chosen to minimize an illustrative business cost, not fixed arbitrarily at 0.5.",
  },
  {
    icon: Cpu,
    title: "Production Inference",
    description:
      "A FastAPI service loads the exact trained artifacts once at startup and never retrains — the same pipeline as the research notebook.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur-sm">
          <Activity className="h-3 w-3 text-accent" aria-hidden /> Research / Portfolio Project
        </span>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="text-gradient-signal">FraudShield</span>
        </h1>
        <p className="mt-3 text-lg text-foreground/90 sm:text-xl">
          Explainable, Cost-Sensitive Fraud Detection
        </p>
        <p className="mt-6 max-w-2xl text-balance text-sm text-muted sm:text-base">
          An ML-powered fraud detection system combining imbalance-aware machine learning,
          cost-sensitive threshold optimization, and explainable AI — built on the public Kaggle
          Credit Card Fraud dataset.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/predict">
            <Button variant="primary" className="gap-2">
              Analyze Transaction <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/model">
            <Button variant="secondary">Explore Model</Button>
          </Link>
        </div>

        <div className="mt-16 w-full max-w-3xl">
          <HeroRiskVisual />
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="glow-accent group relative overflow-hidden">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(45,212,240,0.18),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <CardContent className="flex flex-col gap-3 pt-5">
                <f.icon className="h-5 w-5 text-accent" aria-hidden />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-sm text-muted">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
