# Model

## Dataset

Kaggle "Credit Card Fraud Detection" — 284,807 European cardholder transactions from September
2013. Features: `Time` (seconds since first transaction), `V1`-`V28` (PCA-anonymized by the
original dataset owners for confidentiality), `Amount`, and the target `Class`
(1 = fraud, 0 = legitimate). Fraud is roughly 0.17% of transactions.

## Preprocessing

A single `ColumnTransformer`, fit only on training data:

- `Time`, `V1`-`V28`: mean imputation → `StandardScaler`
- `Amount`: median imputation → `log1p` → `StandardScaler`

The exact same fitted object (`preprocessor.pkl`) is used at training, validation, test, and
inference time — there is no reimplementation or approximation of this logic anywhere else.

## Class imbalance handling

Compared during model development (see the training notebook): no balancing, `class_weight`
weighting, SMOTE (training data only, never validation/test), and cost-sensitive sample/loss
weighting. The final selected Random Forest was trained on SMOTE-resampled training data.

## Model selection

Ranked by test-set **PR-AUC** first (the most reliable single summary metric under this class
imbalance — see the "Why PR-AUC" note on the `/analytics` page), with Business Cost as a
tie-breaker. Accuracy was explicitly **not** used as the selection criterion, since a trivial
"always legitimate" classifier scores ~99.8% accuracy while catching zero fraud.

## Threshold selection

Selected on a held-out **validation** set (never the test set) by minimizing:

```
Business Cost = FN × COST_FN + FP × COST_FP
```

subject to a minimum recall floor. `COST_FN` and `COST_FP` are illustrative, configurable
business assumptions — see `model_metadata.json` for the exact values used to produce the
currently deployed threshold.

## Metrics

The authoritative metrics live in `backend/models/model_metadata.json` (`final_metrics`) and
`backend/models/results/model_comparison.csv` — both are read live by the API
(`GET /api/model`, `GET /api/metrics`) rather than duplicated here, so this document can't drift
out of sync with the deployed model.

## Limitations

- Static historical dataset; no continuous retraining.
- `V1`-`V28` have no disclosed real-world meaning.
- Cost assumptions are illustrative, not verified banking figures.
- Not validated for production use in a real financial institution.
