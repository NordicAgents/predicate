# When Is Agent Memory Conflict-Complete? Minimal Proof-Witness Retrieval under Bounded Context

**Working draft — anonymous submission version.** Target: AAAI-28 main track (KRR area);
alternative NeurIPS Evaluations & Datasets. Every quantitative claim in §5–§6 is traced to a
committed evidence artifact at git tag `phase1-hardening-2026-07-13` and is reproducible via the
one-command build described in §5.1 and Appendix A. This draft reflects the Phase-1 (synthetic,
mechanism-controlled) evidence state; external-validity claims are explicitly deferred (§4.4, §8).
Implementation names ("Predicate", "MCP", "OWL 2 RL") are confined to the reproducibility appendix.

---

## Abstract

An LLM agent that stores facts across sessions can *silently select* one side of a contradiction:
when two records disagree about a single-valued attribute of the same entity, a query-local
retriever may surface only one, and the agent answers with unwarranted confidence. We argue this is
not primarily a reasoning failure but a **retrieval-completeness** failure — the policy never
returns both halves of the contradiction — and we make that precise. We define **conflict
completeness** as a property of a *retrieval policy* under a bounded context budget: whenever a
query-relevant conflict witness exists in the store, the policy returns enough of that witness, in
budget, for a sound detector to establish the conflict. We prove a lower bound — bounded-hop
retrieval over IRI adjacency alone is conflict-incomplete for any finite hop bound when the two
records are connected only through a shared key *literal* — and we give an incremental **Conflict
Witness Index (CWI)** that returns minimal, source-grounded witnesses at a context cost equal to the
witness itself, independent of the graph distance between the records. On a pre-registered,
mechanism-controlled benchmark spanning cross-record duplicates, multi-hop key chains, non-key
shared literals, and record-level valid-time/scope annotations, CWI is conflict-complete on every
family with returned context exactly the gold witness size (2–12 triples), where the strongest
witness-complete neighborhood policy pays 8–95 triples and grows with hop depth; its update
amplification is flat (~1.9 index writes per assertion) and its query latency stays in the
microseconds as the store grows to 56k triples, where an OWL-style materializer is already 40× more
expensive at 5.6k triples and does not scale. We are explicit about what this is *not*: **detection**
in the exercised fragment is a textbook key join, and we claim no advantage there; the contribution
is the completeness-under-budget framing, the lower bound, and the measured cost of returning whole,
machine-checkable witnesses versus the weaker "flag + pointer" contracts we also measure. All results
are on synthetic fixtures under an oracle schema; a prevalence probe on real vulnerability records
(80.7% of CVE-keyed groups span ≥2 independently authored records; 48.4% disagree on affected
ranges) motivates but does not establish external validity, which we defer to a released benchmark.

---

## 1. Introduction

Agent memory systems accumulate facts about users, entities, and the world across many sessions and
retrieve a relevant subset into a bounded context window at query time. When two stored records
disagree — the user's office was recorded as *Building A* in one session and *Building C* in another,
under the same email address — the agent should surface the contradiction, or at least not answer as
though one value were uncontested. In practice, production memory systems either overwrite on write
(last-write-wins), judge conflicts with an LLM at ingest time, or, increasingly, append everything
and never reconcile it at all [Mem0; Mem0-v3 append-only]. The downstream failure is concrete: an
agent that silently selects the stale office routes a delivery, schedules a meeting, or files a
compliance record against a fact its own memory contradicts, with no signal that a contradiction was
ever present.

It is tempting to frame this as a reasoning deficiency — "the model should have noticed." But a
model can only reason over what is in its context. In a controlled ingest study, a memory system that
processes the two conflicting records one at a time retained *both* values on **0 of 8** same-record
conflicts and linked **0 of 12** key-co-referent duplicate pairs; the contradiction was destroyed at
write time, before any reader saw it (§4.5, exploratory). And when both records *are* placed in
context, a frontier model detects the planted conflict perfectly (a control we rely on throughout).
The locus of the failure is therefore *what the retrieval policy returns*, not what the reader can
infer. This paper takes that seriously and asks a completeness question about retrieval itself.

**The question.** *What must an agent-memory retrieval policy index to be conflict-complete under a
bounded context budget, and at what context cost does each policy return the source-grounded conflict
witness?*

We answer it in three parts.

1. **A property (§2).** We model each memory assertion as a tuple $(s,p,o,\tau,\sigma,\pi)$ with
   valid time $\tau$, scope $\sigma$, and provenance $\pi$, define a *conflict witness* as the minimal
   set of source assertions that establishes a contradiction under a bounded rule fragment, and define
   **$(B,\mu)$-conflict-completeness**: a retrieval policy $R$ is conflict-complete for a query $q$ if,
   for every $q$-relevant witness $W$ in the store, $W \subseteq R(q,S)$, and it is $B$-bounded if
   $\mu(R(q,S)) \le B$ for a cost measure $\mu$ (tokens/bytes). The interesting regime is
   $B \ll \mu(S)$: the identity policy is trivially complete but not bounded.

2. **A lower bound and a method (§3).** We prove that the class of policies whose returned set is
   determined *only* by IRI–IRI adjacency (of which plain $k$-hop BFS is a deliberately weak member) is
   conflict-incomplete whenever the two records of a witness are connected only through a shared key
   literal — there the graph distance is infinite and no finite hop bound suffices — while raising the
   hop bound to recover completeness drives the returned context toward the whole store. We then give the
   **Conflict Witness Index (CWI)**: an incremental index over key-equivalence classes that, at query
   time, returns the *minimal* witness by a shortest record-to-record path through the shared keys. Its
   context cost is the witness size, independent of hop distance.

3. **A measurement (§4–§6).** On a pre-registered benchmark of controlled conflict families, we
   measure completeness-per-budget for exact baselines, four retrieval policies, an OWL-style reasoner,
   and CWI, plus a maintenance ledger (update amplification, index size, query latency) at increasing
   store sizes. We report the phase diagram: where witness indexing returns whole witnesses cheaply and
   where standard retrieval cannot, and — equally — where the exact machinery earns *nothing* because
   detection is already a cheap join.

**What we claim, and what we do not.** We are deliberate about the boundary, because a KRR reviewer
will (correctly) recognize every ingredient as classical. The *witness* is a justification / minimal
axiom set (MinA) [Schlobach & Cornet 2003; Kalyanpur et al. 2007; Baader & Peñaloza 2010], a minimal
conflict set in model-based diagnosis [Reiter 1987], a minimal unsatisfiable subset, and a
why-provenance witness [Buneman et al. 2001; Green et al. 2007]; the incremental index reduces, in
the exercised fragment, to incremental view maintenance over key-equivalence classes. We claim
**none** of these as novel. Our contribution is their **composition into a completeness property of a
retrieval policy under a context budget**, the lower bound for the IRI-adjacency policy class, and the
empirical cost study of returning whole machine-checkable witnesses versus weaker contracts. We
**do not** claim symbolic detection beats an LLM in-context (with both records present, the LLM is
perfect); we **do not** claim our detector beats a hash join (it does not — detection in the
exercised fragment *is* a hash join, and we head every table with that baseline); and we **do not**
claim external validity beyond the synthetic, oracle-schema regime evaluated here (§4.4, §8). These
are not hedges bolted on at the end; they are the load-bearing scope of the guarantee, and they are
stated in the propositions themselves.

---

## 2. Problem

### 2.1 Assertions, stores, and schema

Fix disjoint countable sets of IRIs $\mathcal{I}$ and literals $\mathcal{L}$, a set of predicates
$\mathcal{P}\subseteq\mathcal{I}$, classes $\mathcal{C}\subseteq\mathcal{I}$, and a reserved
$\mathsf{type}\in\mathcal{P}$. An **assertion** is a tuple $a=(s,p,o,\tau,\sigma,\pi)$ with subject
$s\in\mathcal{I}$, predicate $p$, object $o\in\mathcal{I}\cup\mathcal{L}$, valid-time interval
$\tau\in\mathbb{T}\cup\{\bot\}$, scope $\sigma\in\Sigma\cup\{\bot\}$, and provenance $\pi$ (of which we
use the confidence $c(a)\in[0,1]\cup\{\bot\}$). $\bot$ means *unspecified*. $\mathrm{tr}(a)=(s,p,o)$ is
the underlying triple. A **store** $S$ is a finite set of assertions. A confidence gate
$S_\theta=\{a\in S: c(a)\ge\theta\}$ filters premises (deployed $\theta=0.5$); every result below is a
statement about $S_\theta$. Two literals are equal iff identical as terms — **no** normalization,
similarity, or entity linking is assumed anywhere in this section; that is a scoping decision, not an
oversight, and §8 states its consequences.

A **key declaration** assigns keyed classes a single key predicate $k_C$ (the implemented fragment;
longer key tuples are defined but inert). Records $x\neq y$ are *directly co-keyed*,
$x\approx_K y$, when both are typed $C$ and share a key value $v$: $\{(x,\mathsf{type},C),
(y,\mathsf{type},C),(x,k_C,v),(y,k_C,v)\}\subseteq\mathrm{tr}(S_\theta)$. The **key-induced
equivalence** $\sim_K$ is the reflexive–symmetric–transitive closure of $\approx_K$. An **exclusivity
constraint set** $E\subseteq\mathcal{P}$ marks predicates single-valued per entity per $(\tau,\sigma)$
cell. Crucially, exclusivity is **not** OWL functionality: two distinct $E$-values do not license
equating the objects (no merge, no equality generation); they constitute a *conflict*, a first-class
derived fact, while both source assertions are preserved verbatim. This preserve-and-surface reading
relates to consistent query answering over repairs [Arenas et al. 1999] and AR/IAR semantics [Lembo et
al. 2010; Bienvenu & Bourgaux 2016] but **materializes** the violation instead of answering around it.

### 2.2 Conflict witnesses (classical objects, cited as such)

A bounded rule fragment $F$ over $\mathrm{tr}(S_\theta)$ has three rules: **F1** derives $x\sim y$ from
the four co-key premises; **F2** copies $E$-predicate values across $\sim$ (and *only* $E$-values — not
the full $\mathsf{sameAs}$ congruence, so the closure does not explode); **F3** emits
$\mathsf{conflict}(x,p,\{v_1,v_2\},\tau_1\sqcap\tau_2,\sigma_1\sqcap\sigma_2)$ for $p\in E$,
$v_1\neq v_2$, when the two values' time intervals overlap ($\tau_1\between\tau_2$) and scopes are
compatible ($\sigma_1\between\sigma_2$). F3 flags; it never merges.

**Definition (conflict witness).** For a derived conflict $\gamma$, a set $W\subseteq S_\theta$ is a
*witness* iff $F\vdash_W\gamma$ (there is a derivation whose leaves are exactly $W$) and no proper
subset of $W$ derives $\gamma$. A same-record witness has $|W|=2$; a cross-record witness over a
$\sim_K$-chain of length $m$ has $|W|=3m+3$ (the $m{+}1$ type assertions, $2m$ key assertions, and $2$
value assertions). **We claim no novelty for this definition**: it is a justification/MinA, a minimal
conflict set [Reiter 1987], a minimal unsatisfiable subset, and a why-provenance witness [Green et al.
2007]; the soundness of emitted witnesses (Prop. 1) is the standard correctness of any pinpointing
materializer.

### 2.3 Conflict completeness under a bounded budget (the contribution)

A **retrieval policy** is a function $R(q,S)\subseteq S$; each query $q$ carries a footprint of touched
entities $\mathrm{ent}(q)$ (retrieval seeds) and predicates $\mathrm{pred}(q)$. A witness $W$ for
$\mathsf{conflict}(e,p,\cdot)$ is **relevant** to $q$ iff $[e]_{\sim_K}\cap\mathrm{ent}(q)\neq\emptyset$
and $p\in\mathrm{pred}(q)$: the conflict sits on an entity the query touches, on a predicate it touches.

**Definition (conflict completeness; the central definition).** $R$ is *conflict-complete* for $(S,q)$
iff for every $q$-relevant witness $W$, $W\subseteq R(q,S)$. Let $\mu$ be a cost measure on assertion
sets (tokens, bytes) and $B>0$ a budget. $R$ is *$B$-bounded* iff $\mu(R(q,S))\le B$ for all $q$ in a
query class, and *$(B,\mu)$-conflict-complete* iff both.

Three points make this the right property. (i) *Whole witnesses.* Requiring $W\subseteq R(q,S)$ — not
"some of $W$" — guarantees that any sound downstream detector, symbolic or LLM, has the complete premise
set, and that the claimed conflict is *machine-checkable from the returned context alone*. This is the
strictest member of a family; we also measure the weaker "flag" and "flag + pointer" contracts (§5.5).
(ii) *Only interesting with $B$.* The identity policy $R(q,S)=S$ is trivially complete but $B$-bounded
only for $B\ge\mu(S)$; the regime of interest is $B\ll\mu(S)$. (iii) *Detector/policy separation.*
Conflict completeness is a property of $R$ alone; it says nothing about whether the consumer *notices*
the conflict. That separation is exactly what makes the property falsifiable per component and
distinguishes it from detection, resolution, and repair, which are downstream of it.

The **witness-completeness rate** $\mathrm{WCR}(R,S,Q)$ is the fraction of $q$-relevant witnesses fully
contained in $R(q,S)$ over a query set $Q$; scoring is all-or-nothing at witness granularity (a proper
subset is, by minimality, insufficient for any sound detector). The **$B$-bounded completeness curve**
$\mathrm{WCR}_R(B)$ — the rate as a function of the budget $B$ — is the primary empirical object of the
paper (§5.2).

---

## 3. Method

### 3.1 The lower bound

Define the **IRI graph** $G(S)$: vertices are the IRIs of $\mathrm{tr}(S)$; edges join $s$ and $o$ for
each triple $(s,p,o)$ with $o\in\mathcal{I}$, $p\neq\mathsf{type}$ (class hubs excluded; **literal-valued
assertions contribute no edges**). The $k$-hop IRI-BFS policy returns the assertions whose subject lies
in the radius-$k$ ball around $\mathrm{ent}(q)$.

**Proposition 3 (impossibility).** Let $W$ be a cross-record witness whose records are $x\in\mathrm{ent}(q)$
and $y$, with $G(S)$-distance $d(x,y)$. For every $k<d(x,y)$, $k$-hop IRI-BFS is not conflict-complete for
$(S,q)$: the witness assertions with subject $y$ are not returned. More generally, any policy whose
neighborhood is generated only by IRI–IRI adjacency (one that never traverses the key-literal
co-occurrence relation) is conflict-incomplete on every store with a cross-record witness whose records
share only a key *literal* — there $d(x,y)=\infty$ and no finite $k$ suffices, while the witness itself
has "distance 2" through the literal. *Proof:* the shared key value is a literal, hence not a vertex of
$G(S)$ and not an edge generator; $y\notin N_k(\mathrm{ent}(q))$, so the three $y$-subject witness
assertions lie outside the returned set. $\square$

The cost horn is the other blade: on connected stores, raising $k$ until $N_k$ covers the component
drives $\mu(R^{\mathrm{bfs}}_k)\to\mu(S)$, destroying $B$-boundedness. This is not a theorem about all
retrieval — key-aware, literal-aware, lexical, dense, and hybrid policies are *outside* its hypothesis
and are evaluated empirically, not dismissed (§5.2). What Prop. 3 pins down is that IRI adjacency, the
default structural signal, is the wrong index for this class of witness.

### 3.2 The honest baseline (why detection is not the contribution)

**Proposition 4 (exact baseline).** A hash join over $(k_C,v)$ that, within each co-typed bucket,
compares the $E$-predicate values of its members enumerates **all** direct-co-key ("single-join")
witnesses in expected $O(|S_\theta|+\mathrm{out})$; closing $\sim_K$ over longer chains adds a union–find
pass, giving $O(|S_\theta|\cdot\alpha(|S_\theta|)+\mathrm{out})$ for the full fragment. Equivalently a
`GROUP BY key HAVING COUNT(DISTINCT val) > 1` computes the same set.

We state this bluntly: **store-side detection in the exercised fragment is a textbook incremental join,
and we claim no algorithmic novelty for it.** It is a mandatory baseline and heads every detection table
(§5.1). What Prop. 4 does *not* provide is Def. 2.3: it characterizes what a store-side detector can
compute, not what a *budget-bounded retrieval policy must return* to a downstream consumer — the property
Prop. 3 shows IRI-neighborhood retrieval lacks. The paper's claim lives in that gap.

### 3.3 The Conflict Witness Index

CWI maintains, under insertion: (i) buckets keyed by $(C,k_C,v)$ with an incremental union–find closure
of $\sim_K$ (union-by-size); (ii) per-equivalence-class, per-$E$-predicate value lists carrying each
supporting record's $(\tau,\sigma)$; (iii) conflict cells re-evaluated at **equivalence-class
granularity** on every touching insert (a new value, a class merge, or a late-arriving $\tau/\sigma$
annotation — the last only *retracts*, since $\bot$ overlaps everything). At query time, `query(seed)`
returns the conflicts on the seed's class, each with a **minimal witness** assembled by a shortest
record–bucket–record path (BFS inside the class), yielding $|W|=3m+3$ cross-record and $|W|=2$
same-record witnesses, plus the two records' $\tau/\sigma$ annotation triples (F3 premises) where present.

**Proposition 5 (CWI).** In the single-predicate-key fragment: (1) the emitted conflict set equals that
of the Prop. 4 full-fragment detector, and each assembled $W$ is a minimal witness (Def. 2.2); (2) the
policy $R^{\mathrm{cwi}}(q,S)=\bigcup_\gamma W_\gamma$ is conflict-complete with
$\mu(R^{\mathrm{cwi}})=\sum_\gamma\mu(W_\gamma)$ — the budget is the witnesses themselves, independent of
the hop radius $k\ge m$ a key-aware neighborhood policy needs (whose ball grows with $k$); (3) total
insertion work is $O(|S_\theta|\cdot\alpha(|S_\theta|)+\sum_{\text{touches}}|\text{cell}|)$ — per-insert
work bounded by the affected class, never the store — and a query costs $O(|\text{class}|+\sum_\gamma
|W_\gamma|)$. *Honest reading:* statement 1 again concedes the detector is a join; the claim is statement
2, the retrieval contract, and statement 3's constants are **measured, not assumed** (§5.4).

### 3.4 The retrieval contract and its weaker variants

CWI's `query` supports three contracts, corresponding to strengths of Def. 2.3's "whole witness"
requirement. **`cwi-witness`** returns the witness triples serialized (machine-checkable from context
alone). **`cwi-pointer`** returns the conflict tuple plus witness triple *ids* only (premises absent;
checkable only after dereference). **`cwi-flag`** returns the conflict tuple with no witness. A
consumer that trusts the index can act on the flag; a consumer that must *verify* needs the witness.
Which contract a benchmark should headline is an empirical question about the byte overhead of the
strict form, which we pre-committed to adjudicate by a fixed rule (§5.5).

---

## 4. Benchmark

### 4.1 Design and the "engineers the failure" objection

A benchmark for a retrieval-completeness property must separate *retrieval* failure from *detection*
and *resolution* failure, and must not quietly hand the win to the method by constructing a store only
the method can read. We address the standard objection — "the generator places the duplicate outside
the IRI ball, so the zero recall is by construction" — head-on, in two ways. First, the construction is
**disclosed and is the point**: Prop. 3 says the zero recall is *forced for the entire IRI-adjacency
policy class*, not an artifact of one generator; the fixture instantiates a store shape, and the
theorem tells us the outcome holds for every store of that shape. Second, we include the policies the
objection implies we omitted — **key-aware and literal-aware** retrieval — in every figure, and report
exactly where they succeed (they *do* recover completeness) and at what growing context cost. The
benchmark is not "IRI-BFS fails"; it is "here is the completeness-per-budget frontier for a battery of
policies, and here is where each sits."

### 4.2 The controlled families (mechanism-v0 and phase1-v3)

All fixtures are synthetic, deterministic (seeded PRNG), and frozen; the build regenerates them into a
temporary directory and fails on any byte drift. Eight families span the controlled axes:

| Family | Axis exercised | Persons | Conflicts | Structure |
|---|---|---|---|---|
| `conflict-d20` | same-record baseline | 40 | 8 | two values on one record |
| `conflict-xr-small` / `-scale` | cross-record, key-literal co-reference | 60 / 300 | 12 / 60 | twin records sharing only an email literal |
| `conflict-chain-m2` / `-m3` | $\sim_K$-chain depth $m$ | 40 / 24 | 10 / 6 | sparse intermediates carrying two keys, no value, no IRI object |
| `conflict-h3-nk1` / `-nk3` | non-key shared literals (nk = 1, 3) | 60 | 12 | twin mechanism + shared city/title/building strings |
| `conflict-tausig` | valid-time $\tau$ and scope $\sigma$ | 60 | 12 | overlapping (conflict), disjoint (temporal), differing-scope (scoped) |

Positives are `conflict` instances; every family carries hard negatives — benign co-references (same
value), shared-value pairs (different entities, same object), and, for `tausig`, **temporal-supersession**
and **scoped-fact** near-misses where two differing values are *both correct* and must not be flagged.
The nine-way conflict taxonomy of the design (exact-key duplicates, chain-mediated, concurrent
disagreement, temporal supersession, scoped facts, legitimately multi-valued, abstention, …) is covered
across these families; disjoint-type and deep relation-chain conflicts are carried by the
controlled-synthetic layer only and are not claimed as natural prevalence.

### 4.3 Instance-level protocol and pre-registration

The unit of analysis is the **instance**, never the seed or the aggregate question set: random seeds of
one generator are regression checks, not replications. Each instance carries its kind, gold witness
triple set, and key-equivalence entity; every system emits one prediction row per instance (flagged
yes/no, returned values, returned context in triples and bytes, cost). A single scorer computes conflict
precision/recall/F1 (positives = `conflict`, negatives = all benign kinds), witness recall, and the
$B$-bounded completeness curves. Hypotheses, primary metrics, exclusion rules (parse failures counted as
misses, never dropped; no post-hoc fixture edits), and the analysis scripts were **pre-registered before
the confirmatory runs**, with dated amendments for every fixture and system added in Phase 1; the
registration and its amendments are released with the artifact. Twelve directional hypotheses (H1–H12)
were registered; all resolved in the registered direction (§5).

### 4.4 Scope: what this benchmark does and does not establish

mechanism-v0 and phase1-v3 are **constructed mechanism demonstrations under an oracle schema**: keys and
exclusivity constraints are given, key matching is exact-literal, and all conflicts are witness-groundable
(both sides stored). They establish the completeness/cost *mechanism* and let us measure it cleanly. They
do **not** establish that the mechanism occurs at material rates in the wild, nor that it survives noisy
keys, schema induction, or extraction error. As a *prevalence probe only* (exploratory, no benchmark
instance built from it), we grouped a dated OSV vulnerability-record export (PyPI ecosystem, 23,137
records) by shared CVE identifier: **80.7%** of the 5,649 CVE-keyed groups contain ≥2 independently
authored records — the cross-record mechanism is the norm in this domain — and within comparable groups,
**13.3%** disagree on severity and **48.4%** on affected version ranges (a syntactic upper bound;
semantic adjudication is future annotation work). This motivates a released, human-annotated benchmark
across ≥3 realistic domains with a held-out fourth; that benchmark, not this one, is what would support
an external-validity claim (§8).

---

## 5. Experiments

### 5.1 Setup and the detection null result

All non-LLM systems are deterministic and run in an in-process RDF store; the full evidence build is one
command and reproduces every decision value exactly (only wall-clock fields vary). We evaluate three
exact/symbolic detectors — `exact-key-join`, `sparql-groupby`, and a full-fragment
`exact-key-join-x` (union–find + $\tau/\sigma$ partitioning) — an OWL-style forward reasoner
(`reasoner`, a key→sameAs→value-propagation→conflict chain) and its $\tau/\sigma$-aware variant
(`reasoner-tau`), four retrieval policies (`iri-bfs`, `literal-aware`, `key-aware` at hops 1–4), and
CWI. Detection accuracy (Table 1):

**Table 1. Conflict detection (P / R / F1; benign false positives).**

| System | mechanism-v0 (d20, xr) | chain-m2/m3 | h3-nk1/nk3 | tausig |
|---|---|---|---|---|
| exact-key-join | 1.00 / 1.00 / 1.00 · 0 FP | **0.00 / 0.00** (structural) | 1.00 / 1.00 · 0 FP | 0.33 / 1.00 · **24 FP** |
| sparql-groupby | 1.00 / 1.00 / 1.00 · 0 FP | **0.00 / 0.00** | 1.00 / 1.00 · 0 FP | 0.33 / 1.00 · **24 FP** |
| exact-key-join-x | 1.00 / 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP |
| reasoner (blind) | 1.00 / 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 0.33 / 1.00 · **24 FP** |
| reasoner-tau | 1.00 / 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP |
| CWI (`cwi-witness`) | 1.00 / 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP | 1.00 / 1.00 · 0 FP |

Three readings, all load-bearing. (a) On mechanism-v0 and h3, **every** detector ties at
$P=R=F1=1.0$ with zero benign false positives: detection accuracy separates *nothing*, exactly as
Prop. 4 predicts, and the mechanism-v0 detection story is a **closed null result** (pre-committed).
(b) On chains, the single-join detectors score **0 recall by construction** — no single key-value bucket
holds two distinct values — while the full-fragment join, the reasoner, and CWI recover $1.0$: this is a
*structural* separation among detectors, not a tuning artifact. (c) On `tausig`, every $\tau/\sigma$-blind
detector, **including the OWL reasoner**, flags all 24 temporal/scoped near-misses ($P=0.33$); only the
overlap-aware systems (`exact-key-join-x`, `reasoner-tau`, CWI) are perfect. The reasoner's blind failure
is not hidden: it is a registered result, and closing it required implementing F3's side conditions as new
rules (`reasoner-tau`), which we date as a Phase-1 addition rather than retrofit into the frozen arm.

### 5.2 Completeness per budget (the phase diagram)

Table 2 is the paper's core: the witness-completeness rate over conflict instances and the mean returned
context (triples) for each retrieval policy and for CWI. IRI-BFS is either incomplete or complete-only-by-
returning-the-store; key/literal-aware recover completeness but pay a hop- and literal-dependent cost;
CWI returns exactly the witness.

**Table 2. Witness-complete rate (context in triples), conflict instances.**

| Policy | xr-small | chain-m2 (m=2) | chain-m3 (m=3) | h3-nk3 | tausig |
|---|---|---|---|---|---|
| iri-bfs @1 | 0/12 (5) | 0/10 (3) | 0/6 (3) | 0/12 (8) | 0/12 (7) |
| iri-bfs @4 | 12/12 (**345** = store) | 0/10 (3) | 0/6 (3) | 12/12 (**525** = store) | 12/12 (**648** = store) |
| key-aware @1 | 12/12 (8) | 0/10 (8) | 0/6 (8) | 12/12 (11) | 12/12 (12) |
| key-aware @2 | 12/12 (112) | 12/12 (95) | 0/6 (54) | 12/12 (173) | 12/12 (185) |
| key-aware @3 | 12/12 (185) | 12/12 (135) | 12/12 (91) | 12/12 (279) | 12/12 (370) |
| literal-aware @1 | 12/12 (8) | 0/10 (8) | 0/6 (8) | 12/12 (**227**) | 12/12 (**141**) |
| **CWI** (`cwi-witness`) | **12/12 (6)** | **10/10 (9)** | **6/6 (12)** | **12/12 (6)** | **12/12 (10)** |

The structure the table exposes:

- **IRI-BFS is the wrong index (Prop. 3, empirically).** On chains it is 0/·  at *every* hop, because the
  sparse intermediate records carry no IRI object and are isolated vertices — no hop budget reaches them.
  On cross-record and $\tau/\sigma$ families it "succeeds" at $k=4$ only by returning the entire store
  (345, 525, 648 triples).
- **Key-aware retrieval works but its budget grows with depth.** On `chain-m2` it flips from 0 to complete
  exactly at $k=m=2$ (95 triples); on `chain-m3` only at $k=3$ (91 triples). Completeness costs the whole
  radius-$m$ ball, and the ball grows with $m$.
- **Literal-aware retrieval pays for indiscriminate literals.** On `h3-nk3` (three non-key shared literals)
  it is complete at $k=1$ but at **227** context triples — a **20.6×** triple premium over key-aware's 11 —
  and the premium grows monotonically with the number of non-key shared literals (7× at nk=1 → 20.6× at
  nk=3), because it traverses every shared string, keys or not.
- **CWI returns the witness and nothing else.** Its context is exactly $|W|$ (6, 9, 12, 6, 10 triples),
  and — the point of Prop. 5(2) — **independent of $m$**: 9 triples on `chain-m2` where the smallest
  witness-complete key-aware ball is 95, and 12 on `chain-m3` where the ball is 91. Where a neighborhood
  policy pays the radius, the witness pays only the witness.

### 5.3 Cross-engine agreement

CWI's emitted conflict set is **identical to `exact-key-join-x`'s on all eight families** (test-enforced),
and `reasoner-tau`'s flagged-instance set is identical to the blind reasoner's on all seven $\tau/\sigma$-
free families and perfect on `tausig`. This is the independent-implementation check the method section
promises: the retrieval index, the union–find detector, and the forward reasoner agree on *what* the
conflicts are; they differ only in what they *cost to return*.

### 5.4 The maintenance ledger at scale

Prop. 5's cost constants are measured on a load-scale ledger over cost-only strata (v2/xr topology,
persons 300 → 10,000, i.e. 1,689 → 56,009 triples; single-run wall-clock, disclosed run-variable).

**Table 3. Maintenance and query cost vs store size.**

| Persons | Triples | exact-key-join-x | sparql | reasoner (materialize) | CWI ingest | CWI ampl. | CWI query p50 |
|---|---|---|---|---|---|---|---|
| 300 | 1,689 | 4.4 ms | 39 ms | 3,852 ms | 2.6 ms | 1.895 | 6 µs |
| 1,000 | 5,609 | 11.4 ms | 33 ms | 40,571 ms | 8.3 ms | 1.894 | 5 µs |
| 3,000 | 16,809 | 35.5 ms | 90 ms | — (skipped, > cap) | 15.1 ms | 1.893 | 7 µs |
| 10,000 | 56,009 | 119.7 ms | 308 ms | — (skipped) | 52.6 ms | 1.893 | 8 µs |

The headline: **CWI update amplification is flat at ~1.89 index writes per source assertion across a 33×
size increase**, its per-query latency stays in the single-digit microseconds, and its full ingest at
56k triples (52.6 ms) is *cheaper* than a one-shot `exact-key-join-x` detection pass (119.7 ms) — the
price of incrementality is effectively zero here, and turns negative at scale because queries stop
re-scanning the store. The OWL-style materializer, by contrast, is superlinear (3.9 s → 40.6 s for a 3.3×
data increase) and uncomputable past a few thousand triples; we cap it at 1,000 persons. This is the
"update/query complexity vs full materialization" comparison the design demanded, and it is the empirical
face of Prop. 5(3). Caveat: 56k triples is still modest, and all figures are single-run, single-machine.

### 5.5 Which contract to headline (the flag-vs-witness question)

Def. 2.3's strict "whole witness in context" form is only worth adopting if it does not cost dramatically
more than a bare flag-plus-pointer. We pre-committed the decision rule: adopt the strict form iff the mean
`cwi-witness`/`cwi-pointer` byte ratio is ≤ 5× on every family. Measured ratios: **0.78× to 3.08×** (max
on `chain-m3`; on same-record `d20` the pointer is actually *larger* than the 2-triple witness, since ids
carry full IRIs). The strict machine-checkable witness costs at most ~3× a pointer and 129–957 bytes
absolute — so **the strict form is adopted**, and the flag/pointer variants are reported as ablations
rather than as the headline contract. Concretely, "return the derived flag and let the consumer trust the
index" does **not** dominate "return the whole checkable witness" on cost, which is why the completeness
property is worth stating in its strict form.

### 5.6 Exploratory motivation (not confirmatory)

Two exploratory results motivate the problem but are reported as such. A production memory system in its
recommended ingest configuration retained both values on **0/8** same-record conflicts and linked **0/12**
key-co-referent pairs (an append-additive variant recovered 1/8); the contradiction is lost at write time.
And the OSV prevalence probe (§4.4) shows the cross-record mechanism is common in real records. Neither is
a confirmatory test of any hypothesis; both indicate the mechanism is not a synthetic curiosity.

---

## 6. Analysis

**When witness indexing earns its cost.** The phase diagram (Table 2) is readable from measurable problem
parameters. The advantage of witness-indexed retrieval over neighborhood retrieval grows with (i) the
*graph distance* between the witness records — infinite through a key literal, where IRI-BFS never
completes and CWI is unaffected; (ii) the *$\sim_K$-chain depth* $m$ — key-aware retrieval's
witness-complete budget is the radius-$m$ ball (95 triples at $m{=}2$, 91 at $m{=}3$) while CWI's is
$3m{+}3$ (9, 12); and (iii) the density of *non-key shared literals* — each one inflates literal-aware
retrieval's context (7×→20.6× as nk goes 1→3) while leaving CWI untouched. Where all three parameters are
small — same-record conflicts, no chains, no shared literals — the witness *is* essentially the
neighborhood, and the machinery earns little: on `d20` the CWI witness is 2 triples and any policy that
returns the record suffices.

**Where the exact machinery earns nothing — and we say so.** Detection is the clearest case. In the whole
exercised fragment, the strongest exact detector (`exact-key-join-x`) is complete *and* cheapest — flat
amplification, no materialization — and CWI's detector is byte-identical to it. If a deployment needs only
a boolean "is there a conflict here," a union–find join answers it at store-side cost and the retrieval
machinery is unnecessary. The witness index earns its keep precisely when a *budget-bounded consumer must
see and check the premises* — the retrieval contract of §3.4 — and we showed (§5.5) that the strict form
of that contract is cheap enough to prefer. The honest boundary of the contribution is therefore: the
completeness-per-budget frontier and its lower bound, not detection, and not the data structure.

**Robustness of the separation.** The separations that survive are structural, not statistical: the
single-join detectors' 0-recall on chains and the blind detectors' 24 false positives on $\tau/\sigma$
negatives are forced by construction, and CWI's witness-sized context and flat amplification are
properties of the index, not of a tuned threshold. What does *not* yet survive to a claim is any statement
about realistic data, noisy keys, induced schemas, or LLM readers under these contexts — all deferred.

---

## 7. Related work

**The composition, and its classical ingredients.** No prior work states a completeness property of what
a *retrieval policy* must return for conflict detection under a bounded context budget; verified by search,
the phrases "conflict-complete retrieval," "conflict completeness" in this sense, and "conflict witness
index" are unclaimed. But every *ingredient* has a classical name, and we cite them as the raw material,
not as our invention: justifications / MinA and axiom pinpointing [Schlobach & Cornet 2003; Kalyanpur et
al. 2007; Baader & Peñaloza 2010], minimal conflict sets in diagnosis [Reiter 1987], minimal unsatisfiable
subsets, why-provenance and provenance semirings [Buneman et al. 2001; Green et al. 2007], proof extraction
in consequence-based reasoners, and inconsistency-tolerant (AR/IAR, preferred-repair) query answering
[Lembo et al. 2010; Bienvenu & Bourgaux 2016; and 2025–26 continuations on preference-based repairs and
ASP(Q)/argumentation]. If we claimed the witness *concept* or the index *data structure* as novel, the
work would reduce to a renaming; we do not.

**Conflict-aware agent memory (the 2025–26 cluster).** A wave of systems now target conflict in memory —
MRMS ("preservation, not resolution"), TOKI (bitemporal triples + K-semiring provenance), SLM-V3
(geometric contradiction score), NeuSymMS (CLIPS rules), BeliefMem, Spectron, and the append-only shift in
production Mem0. Each occupies one or two axes of a five-property composition — (1) deterministic,
(2) inference-derived (through chains), (3) both values preserved and co-surfaced as a first-class object,
(4) per-triple provenance, (5) a machine-checkable derivation citing the source triples — but none reports
a *completeness statement about retrieval under budget*, and per-fact provenance is now table stakes
(Eywa, MemIR), claimable only as a component. Detection-F1 in *RAG* (not memory) is reported by ConflictRAG
(88.7%) and TCR; we scope our metric to detection over agent-memory stores with witness-citation scoring,
which remains unclaimed.

**Memory-and-reasoning benchmarks.** ActMem/ActMemEval is the closest benchmark-adjacent neighbor: an
LLM causal-semantic memory graph with counterfactual retrieval, evaluated on *implicit-constraint*
scenarios (e.g., a stored fact conflicts with a current intention via world knowledge). It contains no
conflict formalism, no keys, no provenance, and no formal results; its conflicts are memory-vs-intention
and commonsense-groundable, whereas ours are *witness-groundable* — both sides stored as assertions. That
distinction is exactly the boundary of our guarantee and we state it as such: our fragment intentionally
does **not** cover commonsense constraints. MemConflict, STALE, BEAM (contradiction/abstention slices),
and MemoryAgentBench are cited as external slices; the controlled independent variables here — conflict
density, $\sim_K$-chain depth, non-key-literal density, $\tau/\sigma$ near-misses — with witness-citation
scoring are, to our knowledge, unclaimed in the memory setting.

**Certified retrieval ≠ conflict coverage.** A "provable guarantees for retrieval" line exists
(ReliabilityRAG, RobustRAG, C-RAG) but certifies *robustness to adversarial passages*, a different
property; we flag the distinction to pre-empt confusion.

*(Novelty scans were run monthly through the drafting window; the cluster moved fast — five adjacent
papers landed within eight weeks — and a submission-week rescan is scheduled.)*

---

## 8. Limitations and responsible release

**The guarantee's boundary is the fragment boundary.** Completeness (Prop. 5) holds for single-predicate
keys, exact-literal key matching, types asserted, witness premises above the confidence gate, and
$\tau/\sigma$ handled by the overlap side conditions. It fails — *by design, not accident* — for noisy or
composite keys, entity equivalence needing a source other than declared keys, sub-threshold premises, and
conflicts requiring world knowledge rather than two stored assertions (the ActMem regime). These are the
scope, not fine print.

**Synthetic, oracle-schema scope.** Every confirmatory number here is on constructed fixtures with a given
schema. We make no external-validity claim; the OSV prevalence probe is exploratory and builds no benchmark
instance. The next milestone is a released, human-annotated benchmark over ≥3 realistic domains
(vulnerability records, clinical-trial versions, scholarly records) with a held-out fourth, two annotators
plus adjudication, and a data statement — the artifact that would let the completeness/cost mechanism claim
external validity.

**Extraction is the unsolved end-to-end bottleneck.** We evaluate an oracle-structure track; turning raw
text into $(s,p,o,\tau,\sigma,\pi)$ assertions with correct keys and constraints is a separate, unsolved
problem, and end-to-end conflict completeness is bounded by it. We name this rather than hide it.

**No LLM-reader comparison yet.** A pinned frontier-model track (does an LLM reading each policy's returned
context detect the conflict?) is built and dry-run-verified but unexecuted pending API access; the
completeness property is about what the *policy* returns, and the reader arm measures the *interface*, not
model intelligence, but it is not yet run.

**Reproducibility and release.** Fixtures, generators, all prediction rows, scorers, the pre-registration
with dated amendments, and a one-command evidence build are released; the build regenerates every decision
value from a clean checkout (only wall-clock fields vary) and hard-fails on fixture drift. The
inconsistency-tolerant, preserve-and-surface semantics is a deliberate design choice with stated
consequences (it materializes violations rather than repairing around them), not standard OWL functional-
property behavior.

---

## References (selected)

*Formal-section lineage.* Arenas, Bertossi, Chomicki, *Consistent query answers in inconsistent databases*,
PODS 1999. Baader & Peñaloza, *Axiom pinpointing in general tableaux*, J. Logic & Comput. 2010. Bienvenu &
Bourgaux, *Inconsistency-tolerant querying of DL knowledge bases*, Reasoning Web 2016. Buneman, Khanna, Tan,
*Why and where: a characterization of data provenance*, ICDT 2001. Green, Karvounarakis, Tannen, *Provenance
semirings*, PODS 2007. Horridge, *Justification based explanation in ontologies*, PhD thesis, Manchester,
2011. Kalyanpur, Parsia, Sirin, Horridge, *Finding all justifications of OWL DL entailments*, ISWC 2007.
Lembo, Lenzerini, Rosati, Ruzzi, Savo, *Inconsistency-tolerant semantics for DLs*, RR 2010. Reiter, *A theory
of diagnosis from first principles*, AIJ 1987. Schlobach & Cornet, *Non-standard reasoning services for
debugging DL terminologies*, IJCAI 2003.

*Conflict-aware memory and benchmarks (2024–2026).* Mem0 (arXiv 2504.19413) and its append-only v3; MRMS
(2607.04617); TOKI (2606.06240); SLM-V3 (2603.14588); NeuSymMS (2605.17596); BeliefMem (2605.05583); Eywa
(2605.30771); MemIR (2605.25869); ActMem / ActMemEval (2603.00026); MemConflict (2605.20926); STALE
(2605.06527); BEAM (2510.27246, ICLR 2026); MemoryAgentBench (2507.05257, ICLR 2026); ConflictRAG
(2605.17301); TCR (2601.06842); ConflictBank (2408.12076, NeurIPS 2024); WikiContradict (2406.13805).
*Certified RAG (distinct property).* ReliabilityRAG (2509.23519); RobustRAG (2405.15556); C-RAG (2402.03181).

*(Bibliographic IDs are carried from the project's prior-art validation log; a submission version will
resolve them to full citations and add the DB/temporal-database and entity-resolution lines cited in §2.)*

---

## Appendix A. Reproducibility

Every §5–§6 number is an artifact at tag `phase1-hardening-2026-07-13`. Detection and witness-recall:
`results/instances/summary.<family>.json`. Completeness curves: `results/curves/bcurves.<family>.json`
(primary Def-5.3 truncation reading and the conditional reading, over triples/bytes grids). Retrieval
matrix: `results/retrieval/retrieval.<family>.jsonl`. CWI rows and per-family maintenance:
`results/cwi/cwi.<family>.jsonl`, `results/cwi/ledger.<family>.json`. Scale ledger (Table 3):
`results/scale/scale-ledger.json`. Hypothesis verdicts (H1–H12) and the clause-3 adjudication:
`results/instances/phase1-verdicts.json`. Rebuild: `./scripts/build-evidence.sh` (in-process store,
no network, no API keys). Decision values reproduce exactly across rebuilds; only timing fields vary.
