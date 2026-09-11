"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldHalf, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { StatusPill } from "./StatusPill";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/predict", label: "Analyze Transaction" },
  { href: "/batch", label: "Batch Analysis" },
  { href: "/explainability", label: "Explainability" },
  { href: "/analytics", label: "Model Performance" },
  { href: "/docs", label: "Documentation" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#2dd4f0,#9b7bf6)]">
            <ShieldHalf className="h-4 w-4 text-background" aria-hidden />
          </span>
          <span>FraudShield</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground",
                pathname === item.href && "text-foreground",
              )}
            >
              {item.label}
              {pathname === item.href && (
                <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-[linear-gradient(90deg,#2dd4f0,#9b7bf6)]" />
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <StatusPill />
          <button
            className="rounded-md p-2 text-muted hover:text-foreground lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2.5 text-sm text-muted hover:text-foreground",
                pathname === item.href && "bg-surface-2 text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
