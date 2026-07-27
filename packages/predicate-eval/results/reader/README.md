# Reader results: exploratory, excluded from confirmatory paper claims

These JSONL files are preserved as an audit trail of the registered reader
arm. They are not used for a causal or confirmatory claim in the main paper.

Reasons:

1. The `cwi-witness` versus `flat-all` contrast changes context size,
   distractor content, and serialization/order simultaneously. It therefore
   cannot identify a causal effect of minimality.
2. The original “competence gate” selected readers using performance on a
   whole-store condition and then compared gated groups on that same outcome.
   This is descriptive stratification, not independent evidence that
   minimality helps only weaker readers.
3. One registered model (Qwen) did not complete the two hardest domains, so a
   five-model seven-domain aggregate is unbalanced. The retained matched-panel
   analysis avoids that aggregation but does not repair points 1–2.
4. The run contains no same-witness distractor ladder with randomized
   placement, which is the necessary control for a context-size robustness
   claim.

What remains valid as a descriptive observation is narrower: under the frozen
prompts, readers usually returned the single visible value when their context
contained one side of a conflict. This does not establish behavior in deployed
agents or under alternative prompts.

A publishable follow-up should hold the logical witness fixed, add sampled
benign distractors at predeclared sizes, randomize witness placement, use a
balanced model panel, and analyze all models without an outcome-defined
competence split.
