# Conflict-Complete Retrieval under Bounded Context: Formal Core

Status: draft formal section for the AAAI-28 paper (KRR area). Implementation names are
confined to the footnote in §7. Novelty discipline per `prior-art-validation.md` R3: the
witness notion and the soundness of emitted witnesses are classical and cited as such
(§2); the claimed contribution is confined to §3 (conflict completeness as a property of
a retrieval policy under a context budget) and Proposition 3 (the lower bound for
IRI-only retrieval), together with the cost model of §5.

---

## 1. Preliminaries

### 1.1 Assertions and stores

Fix countable, pairwise disjoint sets $\mathcal{I}$ (IRIs), $\mathcal{L}$ (literals),
and let $\mathcal{T} = \mathcal{I} \cup \mathcal{L}$ be the set of *terms*. Distinguish
$\mathcal{P} \subseteq \mathcal{I}$ (predicates), $\mathcal{C} \subseteq \mathcal{I}$
(classes), and a reserved predicate $\mathsf{type} \in \mathcal{P}$. Fix a time domain
$\mathbb{T}$ of intervals and a scope domain $\Sigma$, each extended with a bottom
element $\bot$ meaning *unspecified*.

**Definition 1.1 (Assertion).** An *assertion* is a tuple

$$a = (s, p, o, \tau, \sigma, \pi)$$

with subject $s \in \mathcal{I}$, predicate $p \in \mathcal{P}$, object
$o \in \mathcal{T}$, valid time $\tau \in \mathbb{T} \cup \{\bot\}$, scope
$\sigma \in \Sigma \cup \{\bot\}$, and provenance record $\pi$, of which we use only the
*confidence* $c(a) \in [0,1] \cup \{\bot\}$ ($\bot$: no provenance recorded). We write
$\mathrm{tr}(a) = (s,p,o)$ for the underlying triple and lift $\mathrm{tr}$ to sets.

A *store* $S$ is a finite set of assertions. Two literals are equal iff they are
identical as terms (same lexical form and datatype); no normalization, similarity, or
entity linking is assumed anywhere in this section (see the scope table, §6).

**Definition 1.2 (Confidence gate).** For a cutoff $\theta \in [0,1]$, the *gated store*
is

$$S_\theta = \{\, a \in S \;:\; c(a) \neq \bot \ \text{and}\ c(a) \geq \theta \,\}.$$

Assertions without recorded confidence are excluded ("no provenance, not reasoned
about"). All inference below reads $S_\theta$ only; the deployed cutoff is
$\theta = 0.5$. The gate thus acts as a *premise filter*: every result in §4 is a
statement about $S_\theta$, never about sub-threshold content of $S$.

Overlap of time and scope annotations is written $\tau_1 \between \tau_2$
(interval intersection, with $\bot$ overlapping everything) and
$\sigma_1 \between \sigma_2$ (equality, or either side $\bot$). In the current fixtures
every assertion carries $\tau = \sigma = \bot$, so all overlap side conditions hold
vacuously; §6 records precisely which results are exercised beyond that fragment.

### 1.2 Schema: keys and exclusivity constraints

**Definition 1.3 (Key declarations).** A *key declaration set* $K$ is a partial map
from classes to nonempty tuples of predicates. The *implemented restriction* used
throughout §4 is that every declared key is a **single** predicate:
$K(C) = k_C \in \mathcal{P}$ for each keyed class $C$ (declarations with longer tuples
exist syntactically but induce nothing in the fragment below).

**Definition 1.4 (Key-induced equivalence $\sim_K$).** Define the *direct co-key
relation* $\approx_K$ on $\mathcal{I}$: $x \approx_K y$ iff $x \neq y$ and there exist a
keyed class $C$ with $K(C) = k_C$ and a term $v \in \mathcal{T}$ such that

$$\{(x,\mathsf{type},C),\ (y,\mathsf{type},C),\ (x,k_C,v),\ (y,k_C,v)\} \subseteq \mathrm{tr}(S_\theta).$$

Both membership assertions are required; a record sharing the key value but lacking the
class assertion is *not* co-keyed. $\sim_K$ is the reflexive–symmetric–transitive
closure of $\approx_K$, and $[x]_{\sim_K}$ denotes the equivalence class of $x$. In the
benchmark $v$ is always a literal (e.g., an email string), compared by term identity.

**Definition 1.5 (Exclusivity constraints).** An *exclusivity constraint set* is a set
$E \subseteq \mathcal{P}$ of predicates declared *single-valued per entity, per
$(\tau,\sigma)$ cell*: the intended reading of $p \in E$ is that a real-world entity
holds at most one $p$-value at any time point within any one scope. Crucially,
exclusivity here is **not** functionality in the OWL sense: two distinct values do
*not* license the inference that the values are equal (no merge, no equality
generation on objects); they constitute a *conflict*, a first-class derived fact, while
both source assertions are preserved verbatim. This preserve-and-surface reading is the
inconsistency-tolerant design choice; it relates to consistent query answering over
repairs [Arenas, Bertossi & Chomicki 1999] and AR/IAR semantics
[Lembo et al. 2010; Bienvenu & Bourgaux 2016] but materializes the violation instead of
answering around it.

### 1.3 The bounded rule fragment $F$

$F$ consists of three inference rules over premises drawn from $\mathrm{tr}(S_\theta)$
(annotations carried along) plus previously derived facts. Schema declarations
($K$, $E$) are fixed background, not premises.

**(F1) key-equivalence** — for keyed class $C$ with $K(C)=k_C$, $x \neq y$:

$$\frac{(x,\mathsf{type},C)\qquad (y,\mathsf{type},C)\qquad (x,k_C,v)\qquad (y,k_C,v)}{x \sim y}$$

**(F2) equivalence propagation over constrained predicates** — for $p \in E$ only
($\sim$ used symmetrically):

$$\frac{x \sim y \qquad (y, p, v, \tau, \sigma)}{(x, p, v, \tau, \sigma)}$$

**(F3) pairwise exclusivity violation** — for $p \in E$, $v_1 \neq v_2$,
$\tau_1 \between \tau_2$, $\sigma_1 \between \sigma_2$:

$$\frac{(x, p, v_1, \tau_1, \sigma_1) \qquad (x, p, v_2, \tau_2, \sigma_2)}{\mathsf{conflict}(x,\, p,\, \{v_1, v_2\},\, \tau_1 \sqcap \tau_2,\, \sigma_1 \sqcap \sigma_2)}$$

Three deliberate boundedness properties: (i) F2 copies **only** $E$-predicate values
across $\sim$ — it is not the full $\mathsf{sameAs}$ congruence (no replacement in
subject/object position of arbitrary triples), so the closure does not explode;
(ii) $F$ contains **no** transitivity rule for $\sim$ itself — Lemma 4.1 shows that
iterating F2 to fixpoint nevertheless converges $E$-values on every member of a
$\sim_K$-class; (iii) F3 flags, it never merges. $F \vdash_W \varphi$ means there is a
finite derivation tree of $\varphi$ under $F$ whose leaf premises are exactly the
assertions of $W \subseteq S_\theta$. $\mathrm{Cl}_F(S_\theta)$ denotes the (finite,
see Prop. 2) least fixpoint.

### 1.4 Semantic conflict

**Definition 1.6 (Quotient structure and semantic conflict).** Let $D(S_\theta)$ be the
structure whose individuals are the classes $[x]_{\sim_K}$ and which contains the fact
$([s]_{\sim_K}, p, o, \tau, \sigma)$ for every $(s,p,o,\tau,\sigma,\pi) \in S_\theta$.
Then

$$S_\theta \models \mathsf{conflict}(e, p, \{v_1, v_2\}, \tau, \sigma)$$

iff $p \in E$, $v_1 \neq v_2$, and $D(S_\theta)$ contains facts
$([e], p, v_1, \tau_1, \sigma_1)$ and $([e], p, v_2, \tau_2, \sigma_2)$ with
$\tau_1 \between \tau_2$, $\sigma_1 \between \sigma_2$ (and $\tau, \sigma$ the
respective intersections). Equivalently: reading $K$ as equality-generating
dependencies on entity identifiers and $E$ as per-cell functional dependencies,
$S_\theta$ violates the FD for $(e,p)$ in the standard database sense.

---

## 2. Conflict witnesses

**Definition 2.1 (Conflict witness).** Let
$\gamma = \mathsf{conflict}(e,p,\{v_1,v_2\},\tau,\sigma)$. A set $W \subseteq S_\theta$
is a *witness* for $\gamma$ iff

1. $F \vdash_W \gamma$, and
2. (minimality) no proper subset $W' \subsetneq W$ satisfies $F \vdash_{W'} \gamma$.

$\mathcal{W}(S_\theta)$ denotes the set of all witnesses of all conflicts derivable
from $S_\theta$.

**Canonical shapes.** A *same-record* witness has the form
$W = \{(x,p,v_1,\ldots), (x,p,v_2,\ldots)\}$, $|W| = 2$. A *cross-record* witness over a
direct co-key pair has the form

$$W = \{(x,\mathsf{type},C),\ (y,\mathsf{type},C),\ (x,k_C,v),\ (y,k_C,v),\ (x,p,u_1),\ (y,p,u_2)\},\quad |W| = 6,$$

and witnesses whose records are linked by a $\sim_K$-chain of length $m$ contain the
type and key assertions of each intermediate record ($|W| = 4m + 2$ for a chain of $m$
co-key links).

**Lineage and non-claims.** Definition 2.1 is an instance of well-studied notions and
**no novelty is claimed for it**: a witness is a *justification* / *MinA* (minimal
axiom set entailing a consequence) in the sense of axiom pinpointing
[Schlobach & Cornet 2003; Kalyanpur, Parsia, Sirin & Horridge 2007;
Baader & Peñaloza 2010; Horridge 2011]; read as a minimal set of premises jointly
inconsistent with the constraint theory, it is a *minimal conflict set* in model-based
diagnosis [Reiter 1987] and a *minimal unsatisfiable subset* (MUS); as the set of source
tuples on which a derived fact depends, it is a *why-provenance* witness
[Buneman, Khanna & Tan 2001], and the set of *minimal* such witnesses is exactly the
witness basis computable in the provenance-semiring framework
[Green, Karvounarakis & Tannen 2007]. Likewise the soundness of emitted witnesses
(Prop. 1) is the standard correctness property of any pinpointing-capable materializer.
What this paper builds *on top of* these classical objects is Definition 3.2: a
completeness property of a **retrieval policy**, quantified over witnesses and
parameterized by a context budget.

---

## 3. Conflict-complete retrieval

**Definition 3.1 (Retrieval policy; query footprint).** A *retrieval policy* is a
function $R$ mapping a query $q$ and a store $S$ to a subset
$R(q, S) \subseteq S$. Each query $q$ carries a *footprint*: a finite set of touched
entities $\mathrm{ent}(q) \subseteq \mathcal{I}$ (the retrieval seeds: entities the
query names or resolves to) and touched predicates
$\mathrm{pred}(q) \subseteq \mathcal{P}$, with $\mathrm{pred}(q) = \mathcal{P}$ when
unrestricted.

**Definition 3.2 (Relevance).** A witness
$W \in \mathcal{W}(S_\theta)$ for $\mathsf{conflict}(e,p,\cdot,\cdot,\cdot)$ is
*relevant to* $q$ iff

$$[e]_{\sim_K} \cap \mathrm{ent}(q) \neq \emptyset \quad\text{and}\quad p \in \mathrm{pred}(q).$$

That is: the conflict sits on (a record co-referent with) an entity the query touches,
on a predicate the query touches. $\mathcal{W}(S_\theta, q)$ denotes the set of
$q$-relevant witnesses.

**Definition 3.3 (Conflict completeness; the central definition).** A retrieval policy
$R$ is *conflict-complete* for $(S, q)$ iff

$$\forall\, W \in \mathcal{W}(S_\theta, q): \quad W \subseteq R(q, S).$$

$R$ is conflict-complete for a query class $Q$ over $S$ iff it is conflict-complete for
every $q \in Q$. Let $\mu$ be a cost measure on assertion sets (tokens, bytes; §5) and
$B > 0$ a *context budget*. $R$ is *$B$-bounded* iff $\mu(R(q,S)) \leq B$ for all
$q \in Q$, and *$(B,\mu)$-conflict-complete* iff it is both $B$-bounded and
conflict-complete.

**Remarks.**
1. *Why whole witnesses.* Requiring $W \subseteq R(q,S)$ (not "some of $W$") is the
   strictest member of a family: it guarantees that *any* sound detector downstream —
   symbolic or LLM — has the complete premise set in context, and that the claimed
   conflict is machine-checkable from the returned context alone. Weaker variants
   (return the derived flag plus a pointer, return $W$ up to type assertions) are
   possible; we adopt the strict form and measure the others empirically.
2. *The definition is only interesting jointly with $B$.* The identity policy
   $R(q,S) = S$ is trivially conflict-complete but $B$-bounded only for
   $B \geq \mu(S)$; the empirical regime of interest is $B \ll \mu(S)$. Conversely a
   policy can be cheap and conflict-incomplete (Prop. 3). The paper's question is which
   policies occupy the quadrant *complete and bounded*, and at what index/update cost.
3. *Detector/policy separation.* Conflict completeness is a property of $R$ alone. It
   deliberately says nothing about whether the consumer of $R(q,S)$ *notices* the
   conflict; that separation is what makes the property falsifiable per-component.

---

## 4. Propositions

Throughout: single-predicate keys (Def. 1.3), term-identity value comparison,
$\theta$-gated store. Propositions 1–2 concern the fragment with
$\tau = \sigma = \bot$ everywhere (the implemented and benchmarked case); the
statements generalize verbatim to annotated assertions provided F3's overlap side
conditions implement $\between$, but only the $\bot$ case is exercised (§6).

**Proposition 1 (Soundness of $F$).** If
$\mathsf{conflict}(x, p, \{v_1,v_2\}, \tau, \sigma) \in \mathrm{Cl}_F(S_\theta)$, then
$S_\theta \models \mathsf{conflict}(x, p, \{v_1,v_2\}, \tau, \sigma)$, and every
minimal premise set of its derivation is a witness in the sense of Def. 2.1.

*Proof sketch.* Induction on the derivation. (F1): the four premises are precisely the
membership condition of $\approx_K$ (Def. 1.4), so $x \sim_K y$ and
$[x]_{\sim_K} = [y]_{\sim_K}$. (F2): if $x \sim y$ was derived, then by the induction
hypothesis $[x]_{\sim_K} = [y]_{\sim_K}$, so the fact $([y],p,v,\tau,\sigma)$ already in
$D(S_\theta)$ equals $([x],p,v,\tau,\sigma)$; the derived assertion adds nothing false
to the quotient. (F3): its premises exhibit exactly the two facts required by
Def. 1.6. Since all leaves lie in $S_\theta$, the gate guarantees the conflict is
supported entirely by assertions of confidence $\geq \theta$; nothing is asserted about
$S \setminus S_\theta$. Minimal premise sets are witnesses by construction. This is the
standard soundness of a pinpointing materializer and is not claimed as a contribution.
$\square$

**Proposition 2 (Completeness of $F$ for single-property keys + single-valued
constraints).** Assume:

- (a) every key is a single predicate and key values are compared by term identity;
- (b) for every record participating in a conflict, its $\mathsf{type}$ assertion for
  the keyed class is present in $S_\theta$ (types asserted, not merely inferable
  outside $F$);
- (c) all assertions of the corresponding witness are in $S_\theta$ (i.e., each carries
  recorded confidence $\geq \theta$);
- (d) $\mathrm{Cl}_F(S_\theta)$ is computed to fixpoint.

Then for every semantic conflict
$S_\theta \models \mathsf{conflict}(e, p, \{v_1,v_2\}, \bot, \bot)$ and **every** record
$x \in [e]_{\sim_K}$, the fixpoint contains
$\mathsf{conflict}(x, p, \{v_1, v_2\}, \bot, \bot)$ — in particular the flag lands on
both source records.

*Proof sketch.* First, termination: derivable facts are contained in the finite set
$\{x \sim y\} \cup \{(x,p,v) : x \in \mathcal{I}_S,\, p \in E,\, v \in \mathcal{T}_S\}$
over the finitely many terms of $S_\theta$, and $F$ is monotone, so the least fixpoint
exists and is reached in finitely many rounds.

*Lemma 4.1 (class-wide value convergence).* If $x \sim_K y$ and
$(y, p, v) \in \mathrm{tr}(S_\theta)$ with $p \in E$, then
$(x,p,v) \in \mathrm{Cl}_F(S_\theta)$. Induction on the length $m$ of the
$\approx_K$-chain $x = z_0 \approx_K z_1 \approx_K \cdots \approx_K z_m = y$. Each link
$z_i \approx_K z_{i+1}$ is derivable by F1 under (a)–(c). For $m$: by the induction
hypothesis $(z_1, p, v)$ is in the fixpoint (as an $S_\theta$ assertion or an F2
derivation), and one further F2 application across $z_0 \sim z_1$ (symmetric use)
yields $(z_0,p,v)$. Note $F$ never derives $\sim$ transitively; convergence of
$E$-values on the whole class is achieved by iterating F2 along chain edges to
fixpoint — this is exactly the bounded design of §1.3(ii). $\blacksquare$

Now let the semantic conflict be witnessed by
$(s_1, p, v_1), (s_2, p, v_2) \in \mathrm{tr}(S_\theta)$ with
$s_1 \sim_K s_2 \sim_K e$. By Lemma 4.1 any $x \in [e]_{\sim_K}$ has both $(x,p,v_1)$
and $(x,p,v_2)$ in the fixpoint; F3 then emits the flag on $x$ ($v_1 \neq v_2$ by term
identity; overlap conditions vacuous at $\bot$). $\square$

*Exact preconditions, stated once:* completeness fails — by design, not accident — if a
type assertion is missing (b), if a witness assertion is sub-threshold or lacks
provenance (c), if key values differ syntactically while denoting the same key
("noisy keys"), if the key is multi-property, or if equivalence would need a source
other than declared keys. These are the boundary of the guarantee, not fine print.

**Proposition 3 (Impossibility: IRI-only bounded-hop retrieval is
conflict-incomplete).** Define the *IRI graph* $G(S) = (V, \mathcal{E})$: $V$ is the
set of IRIs occurring in $\mathrm{tr}(S)$, and $\{s, o\} \in \mathcal{E}$ for each
$(s,p,o) \in \mathrm{tr}(S)$ with $o \in \mathcal{I}$ and $p \neq \mathsf{type}$
(undirected; class hubs excluded; **literal-valued assertions contribute no edges**).
The *$k$-hop IRI-BFS policy* is

$$R^{\mathrm{bfs}}_k(q, S) = \{\, a \in S : \text{subject of } a \in N_k(\mathrm{ent}(q)) \,\},$$

where $N_k$ is the radius-$k$ ball in $G(S)$. Let $W \in \mathcal{W}(S_\theta, q)$ be a
cross-record witness whose two records are $x \in \mathrm{ent}(q)$ and $y$, and let
$d(x,y)$ be their distance in $G(S)$ (possibly $\infty$). Then for every hop bound
$k < d(x,y)$, $R^{\mathrm{bfs}}_k$ is **not** conflict-complete for $(S,q)$: the
witness assertions with subject $y$ — at least $(y, p, u_2)$, $(y, k_C, v)$,
$(y, \mathsf{type}, C)$ — are not returned, so $W \not\subseteq R^{\mathrm{bfs}}_k(q,S)$.

More generally, any policy whose returned set is determined by a neighbourhood relation
generated **only** by IRI–IRI adjacency (i.e., one that never traverses the key-literal
co-occurrence relation $\{(x,y) : \exists k_C, v \in \mathcal{L}.\ (x,k_C,v),
(y,k_C,v) \in \mathrm{tr}(S)\}$) is conflict-incomplete on every store containing a
cross-record witness whose records are connected in $G(S)$ only through their shared
key literal — there $d(x,y) = \infty$ and **no** finite hop bound suffices, while the
witness itself has "distance 2" through the literal.

*Proof.* Immediate from the definitions: the shared key value $v$ is a literal, hence
not a vertex of $G(S)$ and not an edge generator; $y \notin N_k(\mathrm{ent}(q))$
whenever $k < d(x,y)$; the three $y$-subject assertions of $W$ are therefore outside
$R^{\mathrm{bfs}}_k(q,S)$. $\square$

*Discussion.* This is the formal version of the observed $0/12$ cross-record retrieval
failure: the benchmark generator places the duplicate record outside the IRI ball, and
Prop. 3 says that outcome is forced for the entire policy class, not an artifact of one
run. It also formalizes the cost horn of the dilemma: on connected stores, raising $k$
until $N_k$ covers the component drives $\mu(R^{\mathrm{bfs}}_k(q,S)) \to \mu(S)$,
destroying $B$-boundedness for any nontrivial $B$; empirically $k=4$ already retrieves
nearly the whole store. Prop. 3 is a statement about a *policy class*, and a
deliberately weak member of it; key-aware, literal-aware, lexical, dense, and hybrid
policies are outside its hypothesis and are evaluated empirically (§5), not dismissed
formally.

**Proposition 4 (Exact baseline: the single-join subfragment is linear).** Call a
witness *single-join* if its $\sim_K$-chain has length $\leq 1$ (same-record witnesses
and direct co-key pairs — every witness in the current fixtures). A hash join over
$(k_C, v)$ — bucket all key assertions by key predicate and value, and within each
bucket compare the $E$-predicate values of the (typed) bucket members — enumerates
**all** single-join witnesses of $S_\theta$ in expected time
$O(|S_\theta| + \mathrm{out})$ and space $O(|S_\theta|)$, where $\mathrm{out}$ is total
witness size. Closing $\sim_K$ over longer chains adds a union–find pass over co-key
pairs, giving $O(|S_\theta| \cdot \alpha(|S_\theta|) + \mathrm{out})$ for the full
fragment of §1.3.

*Proof sketch.* One pass builds buckets and per-entity $E$-value lists; a bucket of
$r$ co-typed members with $\geq 2$ distinct values for some $p \in E$ yields exactly
the direct co-key witnesses among its pairs; correctness is immediate from Defs. 1.4
and 2.1, cost from standard hashing/union–find bounds. $\square$

*Honest reading (Gate A).* Prop. 4 states outright that **detection** in the currently
exercised subfragment is a textbook incremental join: an inverted key index or a
`GROUP BY key HAVING COUNT(DISTINCT val) > 1` computes the same witness set. No
algorithmic novelty is claimed for it, and it is a mandatory baseline. What Prop. 4
does *not* provide is Definition 3.3: it characterizes what a *store-side detector*
can compute, not what a *retrieval policy* must return to a budget-bounded consumer —
the property Prop. 3 shows standard neighbourhood retrieval lacks. The paper's claim
lives in that gap, and dies if the gap closes.

---

## 5. Witness cost model and empirical quantities

Fix a serialization of assertion sets (the benchmark uses sorted N-Triples plus the
constraint text; every policy is measured under the same serialization).

**Definition 5.1 (Cost measures).** For $X \subseteq S$:

- $\mu_{\mathrm{tok}}(X)$: tokens of the serialization under a fixed tokenizer
  (the budget $B$ of Def. 3.3 is denominated in $\mu_{\mathrm{tok}}$ unless stated);
- $\mu_{\mathrm{byte}}(X)$: bytes of the serialization;
- $L(R, q)$: wall-clock latency of computing $R(q,S)$, reported p50/p95;
- $U(R, a)$: *update work* — writes performed to maintain $R$'s index state on inserting
  assertion $a$, reported as update amplification (index writes per source assertion)
  together with index size.

**Definition 5.2 (Witness-completeness rate).** For a query set $Q$ over store $S$:

$$\mathrm{WCR}(R, S, Q) \;=\; \frac{\sum_{q \in Q} \bigl|\{\, W \in \mathcal{W}(S_\theta, q) : W \subseteq R(q,S) \,\}\bigr|}{\sum_{q \in Q} \bigl|\mathcal{W}(S_\theta, q)\bigr|}.$$

Scoring is all-or-nothing at witness granularity: a partial witness scores $0$, because
a proper subset of $W$ is, by minimality (Def. 2.1), insufficient for any sound
detector to establish the conflict, and is not machine-checkable from context.
$\mathrm{WCR} = 1$ on $Q$ iff $R$ is conflict-complete for every $q \in Q$
(Def. 3.3 restricted to $Q$).

**Definition 5.3 ($B$-bounded completeness curve).** For a policy family
$\{R_B\}_{B > 0}$ (each $R_B$ B-bounded, e.g., by truncation under a fixed priority
order),

$$\mathrm{WCR}_R(B) \;=\; \mathrm{WCR}(R_B, S, Q),$$

the *completeness curve* of $R$. **These are the primary empirical quantities of the
benchmark:** for each policy, (i) the curve $\mathrm{WCR}_R(B)$, (ii) the cost frontier
$(\mu_{\mathrm{tok}}(R(q,S)),\ \mathrm{WCR})$ across policies at matched budgets, and
(iii) the maintenance ledger $(U, \text{index size}, L)$ against the exact baselines of
Prop. 4 (query-time join with no index vs. incrementally maintained index vs. full
materialization). Downstream detection accuracy given the retrieved context is measured
separately and is deliberately *not* part of $\mathrm{WCR}$ (Remark 3, §3).

---

## 6. Scope and limitations

| Dimension | Full definitions (§1–§3) cover | Current fixtures / implementation exercise |
|---|---|---|
| Key arity | tuples $K(C) = (k_1,\ldots,k_n)$ (Def. 1.3 general form) | single predicate only; multi-property declarations inert (F1 pattern) |
| Key matching | term identity (stated restriction) | exact literal (email string); no noisy/composite keys anywhere |
| Equivalence source | declared keys only ($\sim_K$) | same; no entity linker, no inverse-functional chains in $F$ |
| Valid time $\tau$ | interval overlap $\between$ in F3 and Def. 1.6 | all $\tau = \bot$; overlap vacuous; temporal supersession untested |
| Scope $\sigma$ | scope overlap in F3 and Def. 1.6 | all $\sigma = \bot$; scoped-fact non-conflicts untested |
| Confidence gate | arbitrary $\theta$ as premise filter (Def. 1.2) | fixed $\theta = 0.5$; ungated assertions excluded, not down-weighted |
| Witness chain length | any $m \geq 0$ ($|W| = 4m+2$); Prop. 2 covers all $m$ | fixtures contain only $m \leq 1$ (single-join, Prop. 4 regime) |
| Prop. 1 (soundness) | annotated fragment, given $\between$-correct F3 | proved and exercised at $\tau=\sigma=\bot$ |
| Prop. 2 (completeness) | $\tau=\sigma=\bot$ proved; annotated case stated, conditional on F3 implementing $\between$ | exercised at $\tau=\sigma=\bot$, types asserted, oracle schema |
| Prop. 3 (impossibility) | the IRI-only neighbourhood policy class | implemented $k$-hop undirected IRI-BFS (type edges excluded, literals non-traversable); other retrieval classes are empirical, not covered by the theorem |
| Prop. 4 (exact baseline) | single-join subfragment $O(n)$; full fragment $O(n\,\alpha(n))$ | hash-join baseline on fixtures = single-join regime |
| Constraint origin | $K, E$ given (oracle schema) | oracle schema throughout; schema induction/extraction out of scope for every result above |

Non-conflicts the fragment deliberately does not flag — temporal updates
($\neg(\tau_1 \between \tau_2)$), scoped facts ($\neg(\sigma_1 \between \sigma_2)$),
legitimately multi-valued predicates ($p \notin E$) — are defined by the annotated
side conditions but are exercised only once fixtures populate $\tau, \sigma$;
conflicts requiring world knowledge rather than two stored assertions
(commonsense/intention constraints) are outside Def. 1.6 by construction, and the
guarantee is scoped to witness-groundable conflicts only.

---

## 7. Implementation note

*(Footnote in the paper; the only place system names may appear.)* The fragment $F$ is
implemented in the accompanying system as forward rules over an RDF quad-store:
F1 = rule `r14` (single-property `owl:hasKey` $\to$ `owl:sameAs`, both membership
triples required, asserted or previously inferred); F2 = rule `r23` (`owl:sameAs`-
mediated copying of values of predicates marked `j:SingleValued`, applied in both
directions, semi-naive to fixpoint); F3 = rule `r22` (materializes a `j:ValueConflict`
flag with `j:conflictOn` naming the predicate; both source triples preserved).
`j:SingleValued` is deliberately **not** `owl:FunctionalProperty`: the functional
reading would equate the two values via the equality-generation rule and silently merge
distinct individuals — the exact failure the semantics of Def. 1.5 is designed to
exclude. The confidence gate of Def. 1.2 is an RDF-star annotation filter
(`meta#confidence` $\geq 0.5$) applied to every ABox premise position; assertions
without an annotation are invisible to the rules. Each rule carries a backward premise
extractor, so every emitted flag is accompanied by the premise set of its derivation;
minimization to Def. 2.1 witnesses is a post-processing step. The $k$-hop policy of
Prop. 3 is the benchmark's `flat-retrieved` arm: undirected BFS over ABox triples with
`isIRI` frontier filtering and `rdf:type` edges excluded.

---

## References (formal-section citations)

- M. Arenas, L. Bertossi, J. Chomicki. *Consistent query answers in inconsistent
  databases.* PODS 1999.
- F. Baader, R. Peñaloza. *Axiom pinpointing in general tableaux.* J. Logic and
  Computation, 2010.
- M. Bienvenu, C. Bourgaux. *Inconsistency-tolerant querying of description logic
  knowledge bases.* Reasoning Web 2016.
- P. Buneman, S. Khanna, W.-C. Tan. *Why and where: a characterization of data
  provenance.* ICDT 2001.
- T. J. Green, G. Karvounarakis, V. Tannen. *Provenance semirings.* PODS 2007.
- M. Horridge. *Justification based explanation in ontologies.* PhD thesis,
  University of Manchester, 2011.
- A. Kalyanpur, B. Parsia, E. Sirin, M. Horridge. *Finding all justifications of OWL DL
  entailments.* ISWC 2007.
- D. Lembo, M. Lenzerini, R. Rosati, M. Ruzzi, D. F. Savo. *Inconsistency-tolerant
  semantics for description logics.* RR 2010.
- R. Reiter. *A theory of diagnosis from first principles.* Artificial Intelligence,
  1987.
- S. Schlobach, R. Cornet. *Non-standard reasoning services for the debugging of
  description logic terminologies.* IJCAI 2003.
