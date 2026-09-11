# Limitations

- **Static dataset.** The model is trained on a fixed, historical (September 2013) snapshot.
  Real-world fraud patterns and transaction distributions drift over time; this model is not
  continuously retrained or monitored for drift.
- **Anonymized features.** `V1`-`V28` are PCA-derived and carry no disclosed real-world meaning.
  Any interpretation beyond "this model feature" is speculation, not documented fact.
- **Illustrative costs.** `COST_FN`/`COST_FP` (and the resulting decision threshold) are
  configurable business assumptions chosen for demonstration purposes, not verified figures from
  a real financial institution's loss data.
- **No live fraud example bundled.** The small sampled test set used for `/api/samples` happened
  to contain only legitimate transactions; the frontend disables the "Try Fraud Example" button
  rather than fabricating one.
- **Not production-validated.** This system has not been validated against live transaction
  streams, has no automated retraining pipeline, and has not undergone the security/compliance
  review a real banking deployment would require.
- **scikit-learn version pinning.** The bundled `preprocessor.pkl` was trained under
  scikit-learn 1.6.1 and fails to load under 1.8+ due to an internal `ColumnTransformer` change.
  `requirements.txt` pins the version accordingly; do not upgrade without re-validating.
