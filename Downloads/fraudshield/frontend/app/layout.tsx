import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SignalField } from "@/components/effects/SignalField";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "FraudShield — Explainable, Cost-Sensitive Fraud Detection",
  description:
    "An ML-powered fraud detection research project combining imbalance-aware machine learning, cost-sensitive threshold optimization, and explainable AI.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "FraudShield",
    description: "Explainable, cost-sensitive credit card fraud detection.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased font-sans">
        <ToastProvider>
          <SignalField />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
