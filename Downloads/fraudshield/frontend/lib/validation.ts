import { z } from "zod";

const vFeature = z
  .number({ error: "Must be a number" })
  .finite("Must be a finite number");

export const transactionSchema = z.object({
  Time: z.number({ error: "Time is required" }).min(0, "Time cannot be negative"),
  V1: vFeature, V2: vFeature, V3: vFeature, V4: vFeature, V5: vFeature,
  V6: vFeature, V7: vFeature, V8: vFeature, V9: vFeature, V10: vFeature,
  V11: vFeature, V12: vFeature, V13: vFeature, V14: vFeature, V15: vFeature,
  V16: vFeature, V17: vFeature, V18: vFeature, V19: vFeature, V20: vFeature,
  V21: vFeature, V22: vFeature, V23: vFeature, V24: vFeature, V25: vFeature,
  V26: vFeature, V27: vFeature, V28: vFeature,
  Amount: z.number({ error: "Amount is required" }).min(0, "Amount cannot be negative"),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const V_FEATURE_NAMES = Array.from({ length: 28 }, (_, i) => `V${i + 1}`) as (keyof TransactionFormValues)[];
