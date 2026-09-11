import { AlertTriangle } from "lucide-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-fraud/30 bg-fraud-soft py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-fraud" aria-hidden />
      <p className="max-w-md text-sm text-foreground">{message}</p>
    </div>
  );
}
