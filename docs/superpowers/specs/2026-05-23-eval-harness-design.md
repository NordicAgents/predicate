# Predicate — Real Eval Harness Design

**Status:** Approved design (brainstorming) — ready for implementation plan
**Date:** 2026-05-23
**Package:** extends `packages/predicate-eval`

---

## 1. Motivation

Predicate's entire thesis is that a reasoning knowledge graph **compounds with use** — accuracy
on multi-hop questions rises across sessions, contradictions surface instead of averaging out, and
the graph stays bounded as it grows. PRD §12 stakes the product on four measurable claims (multi-hop
correct-answer rate over time, boundedness, continuity, compounding). **None of them is currently
measured.** Today `predicate-eval` is a smoke test: 5 hardcoded questions, no answer keys, no scoring,
no over-time tracking.

This harness makes the thesis falsifiable. It produces a number that says whether reasoning earns its
keep, and a curve that says whether the graph compounds — or tells us the premise is wrong, now,
before more machinery is built on top of it.

A buggy eval is worse than no eval, so the harness itself is built test-first.

## 2. Goals / Non-goals

**Goals**
- Measure multi-hop answer accuracy against oracle-derived answer keys.
- Show compounding as an accuracy-vs-episode curve, per domain.
- Isolate the *value of reasoning* via an inference-on vs inference-off control (the "lift" number).
- Track boundedness (triple count, inferred count, unused-concept ratio, materialization latency).
- Separate "is the reasoning correct" (Tier 1) from "can the model use it" (Tier 2).
- Be domain-agnostic: adding a domain = adding fixture data, no code changes.

**Non-goals (v1)** — YAGNI
- No API-key model provider; no unattended CI scoreboard for Tier 2.
- No real-transcript replay (kept as a future "field test", interface left open).
- No web dashboard; no cross-domain aggregate score.
- No pass/fail performance thresholds — scaling numbers are **recorded**, not gated.

## 3. Core principle: domain-agnostic by construction

`world.ttl` + `oracle.json` + `questions.yaml` + `episodes/` are pure **data**. `scorer.ts`,
`metrics.ts`, `episode-runner.ts`, `oracle.ts`, and both rigs are domain-**independent** code.
Adding a domain is adding a fixture folder. If a domain is painful to add, that is itself a finding
about the v2 domain-agnostic bootstrap.

## 4. Domains shipped in v1

| Domain | Role | Exercises |
|---|---|---|
| **Organizational knowledge** | Primary | transitive reporting chains (r01/r03), inverse manages↔reportsTo (r04), functional-property dual-manager conflict (r08/r21), departure blast-radius, Contractor⊓FullTime disjointness (r11) |
| **Research / claim provenance** | Secondary | citation/influence chains, inverse cites/citedBy, contradicting findings across sources (r21), superseded/retracted claims (r20), evidence-path explanation (`kg_explain`) |
| **Coding (seed)** | Pluggability proof | import/call/dependency graph, hotspots (r17), env-var blast radius; reuses existing `load-corpus` fixtures |

Deferred domains (need expertise to author a trustworthy oracle, which would undermine the
"answer key correct by construction" guarantee): supply-chain, biomedical/drug-interaction,
regulatory compliance.

## 5. Layout

```
packages/predicate-eval/
  fixtures/
    <domain>/
      world.ttl            # ground-truth TBox+ABox seed for the domain
      oracle.json          # machine-readable truth: edges, derived facts, conflicts, provenance
      episodes/
        e01.jsonl ...       # ordered captured-triple batches (one per simulated session)
      questions.yaml        # frozen question set; answer keys DERIVED from oracle
  src/
    oracle.ts              # load oracle.json; compute derivations (transitive closures, etc.)
    episode-runner.ts      # apply episode N; trigger (or skip) re-materialization
    scorer.ts              # set | boolean | path | conflict scoring
    metrics.ts             # boundedness: triples, inferred, unused-concept ratio, materialize latency
    rigs/
      tier1-deterministic.ts   # vetted golden SPARQL, no model
      tier2-hostsample.ts      # model writes SPARQL via provider seam
    providers/
      provider.ts              # ModelProvider interface
      host-sampling.ts         # MCP sampling/createMessage impl (no API key)
    soundness/
      closure-check.ts         # random-graph closure check for standard OWL rules
      scaling-probe.ts         # latency vs triple-count at 1k/5k/25k/50k (record-only)
    report.ts              # write results/scoreboard.jsonl + ASCII curve renderer
  results/
    scoreboard.jsonl       # append-only, committed: one row per (run, domain, tier, episode)
```

## 6. The oracle (linchpin)

`oracle.json` is the single source of truth. **Every answer key is derived from it, never authored
per-question** — so keys stay correct by construction when a fixture changes. Illustrative shape
(organizational domain):

```jsonc
{
  "facts": [
    { "s": "person:dana",  "p": "reportsTo", "o": "person:erin", "episode": 1 },
    { "s": "person:erin",  "p": "reportsTo", "o": "person:omar", "episode": 2 },
    { "s": "person:dana",  "p": "memberOf",  "o": "team:payments", "episode": 1 }
  ],
  "conflicts": [
    { "id": "c1", "about": "person:lee", "predicate": "reportsTo",
      "values": ["person:omar", "person:nadia"], "episode": 4 }
  ],
  "disjoint": [ { "classes": ["Contractor", "FullTime"] } ]
}
```

`oracle.ts` computes derivations (e.g. transitive closure of `reportsTo`) so the answer to
"who is in Dana's management chain?" is *computed* from `facts`, not typed by hand.

## 7. Questions and scoring

`questions.yaml` (per domain). Each question declares how its key is derived and the earliest
episode at which it becomes answerable:

```yaml
- id: org-q03
  text: "Who is in Dana's management chain?"
  type: set                       # set | boolean | path | conflict
  key: { derive: transitive, rel: reportsTo, from: person:dana }
  needs_episode: 2                # facts required first appear in episode 2
  rule_under_test: [r01, r03]
  reasoning_dependent: true       # false => answerable from raw ABox without inference
  golden_sparql: |                # vetted query used by Tier 1 only
    SELECT ?p WHERE { <person:dana> (reportsTo)+ ?p }
```

Four scorer types in `scorer.ts`, all objective/set-theoretic:

- **set** — precision / recall / F1 of returned IRIs vs oracle-derived set (exact match → F1 = 1.0).
- **boolean** — yes/no (e.g. "are there contradictory claims about X?").
- **path** — for `kg_explain`: returned derivation chain contains the oracle's true edge sequence
  (ordered-subset match).
- **conflict** — system *flags* a known conflict (true positive) without inventing conflicts absent
  from the oracle (false positive penalized).

## 8. The compounding curve (the point of the harness)

Episodes `e01..eNN` drip facts into the store over simulated sessions. After applying each episode and
re-materializing, the **entire frozen question set** is scored. Per domain this yields:

- **Accuracy(episode)** — climbs toward 1.0 as each question's `needs_episode` facts arrive.
  *Asymmetry guard:* a question scored correct **before** its needed facts exist is a red flag
  (hallucination); the harness asserts accuracy stays 0 until `needs_episode`, then rises. That
  asymmetry is the actual evidence that "the graph remembers."
- **Reasoning lift** — every episode is scored twice: inference **ON** vs an inference-**OFF** control
  (materialization skipped). `reasoning_dependent` questions should be ~0 in the control and rise with
  inference on. `lift = acc_on − acc_off` is the one-number answer to "does the reasoner earn its keep?"
  If lift ≈ 0, the thesis is falsified — and we learn it here.

## 9. Boundedness metrics (`metrics.ts`)

Recorded per episode alongside accuracy:
- total triples, inferred triples
- `unused_concept_ratio` — TBox terms with zero usage references / total TBox terms
- `materialize_latency_ms`

Plotting `materialize_latency_ms` vs triple count across episodes makes the naive-fixpoint cost
visible — the eval doubles as the scaling canary that motivated the 25k scale-gate.

## 10. The two rigs (shared scoring core)

Both rigs consume the same fixtures, episodes, and `questions.yaml`, and score through the same
`scorer.ts`. Only **who writes the SPARQL** differs — so every failure attributes to either "reasoning
wrong" or "model couldn't query it."

**Tier 1 — deterministic (CI gate, key-free, fast).**
- Runs each question's vetted `golden_sparql` directly against the materialized store; no model.
- Produces correctness, the compounding curve, the inference on/off lift, and boundedness.
- Deterministic → runs on every commit in CI. Answers *"is the reasoning correct and is growth bounded?"*
- It is **not** the product experience; the harness output labels it as such so a green Tier 1 is never
  mistaken for "the product works."

**Tier 2 — host-sampling (local, no API key, the real product test).**
- Drives the actual loop: `kg_explore_schema` → model drafts SPARQL → execute → (bounded retry on
  empty/error) → interpret → score against the same answer key.
- Reaches the model through `ModelProvider`, implemented by `HostSamplingProvider` using MCP
  `sampling/createMessage` — no key; uses whatever host model drives the session.
- Extra metrics Tier 1 cannot see: **sparql_success** (valid, non-empty query produced),
  **retries_to_answer**, **end-to-end accuracy**. The gap `tier1_accuracy − tier2_accuracy`
  quantifies the "LLM-writes-SPARQL reliability" risk.
- Appends to `results/scoreboard.jsonl` tagged with run timestamp + host model, so the local
  scoreboard accumulates across sessions.

**Provider seam** (`providers/provider.ts`):

```ts
interface ModelProvider {
  name: string;
  complete(input: { system: string; prompt: string }): Promise<string>;
}
```

`HostSamplingProvider` is the only v1 impl. The interface lets an API-key provider drop in later for
unattended CI **without touching the rig** — but neither that nor the key path is built now.

**Risk requiring a spike first.** Whether Claude Code (and Codex/Gemini) actually expose
`sampling/createMessage` to MCP servers is unverified. If they do not, Tier 2 falls back to
**manual-agent mode**: the harness emits prompts and ingests structured answers from the host agent
turn — still key-free, just not push-button. The implementation plan front-loads this spike so Tier 2
is not designed around a capability that may not exist.

## 11. Reasoner-soundness sidecar (approach C, slim)

Separate, fully deterministic, not LLM-touched, independent of domain fixtures:
- **`closure-check.ts`** — generate small random graphs with a known closure for the *standard* OWL
  rules (subclass/subproperty transitivity, inverse, property-chain, transitive, functional/sameAs),
  assert the reasoner's materialized output equals the independently-computed closure. Catches
  soundness regressions in the naive fixpoint.
- **`scaling-probe.ts`** — materialize at 1k / 5k / 25k / 50k triples; record latency + iteration
  count. **No pass/fail threshold** — record-only, so the fixpoint cost curve becomes a tracked number
  and the evidence base for any future semi-naive work.
- Scoped to standard rules; the 5 domain rules (r17–r21) are exercised by the domain fixtures.

## 12. Reporting (`report.ts`)

- Append-only `results/scoreboard.jsonl`: one row per
  `(run_id, timestamp, domain, tier, episode, host_model?)` with
  `{accuracy, lift, sparql_success, retries_to_answer, triples, inferred, unused_ratio, materialize_ms}`.
  Committed, so the trend lives in git history.
- Per-run console summary table.
- `predicate eval report` renders the accuracy & lift curve vs episode (per domain) as a simple ASCII
  chart from the JSONL — no dashboard, no extra deps.

## 13. Testing the harness itself (TDD)

- `scorer.ts` — unit tests per scorer type, incl. partial credit and the false-positive-conflict case.
- `oracle.ts` derivations — transitive-closure deriver checked against tiny hand-verified graphs, so
  answer keys are provably correct.
- `episode-runner.ts` — episode N's facts land and re-materialization fires; the inference-off control
  path genuinely skips materialization.
- **Fixture-integrity test** per domain — every question's `needs_episode` is honored (unanswerable
  before, answerable after), guarding the compounding signal against fixture rot.
- `tier1` end-to-end on the organizational fixture as the canonical golden-path test.

## 14. Open questions for the plan

- MCP `sampling/createMessage` support across hosts (spike — gates Tier 2 driver shape).
- Episode count per domain (enough to show a curve without bloating fixtures — target ~5–8).
- Exact `unused_concept_ratio` definition against `kg:usage` semantics.
- Whether the inference-off control reuses the existing materialize path with a flag or a separate
  no-op materializer.
