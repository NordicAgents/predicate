<div align="center">

# Predicate

**Reasoning memory for AI agents — a self-improving knowledge graph that grows with use.**

*Every fact carries its provenance. Every answer carries its derivation. The schema sharpens itself the more your agent uses it.*

[![npm](https://img.shields.io/npm/v/predicate-skill?label=npm&color=blue)](https://www.npmjs.com/package/predicate-skill)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](packages/predicate-skill/LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/NordicAgents/predicate?style=flat&color=yellow)](https://github.com/NordicAgents/predicate/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/NordicAgents/predicate?color=green)](https://github.com/NordicAgents/predicate/commits)

[Install](#install--use-it-in-your-agent) · [How it works](#how-it-works) · [Architecture](#architecture) · [Packages](#packages)

</div>

---

## What is Predicate?

Most agent "memory" is a flat pile of text: the model re-reads it and takes it
on faith — no record of where a fact came from, no guarantee the same question
answers the same way twice, and no signal when two notes contradict each other.
It never gets smarter; it just gets bigger.

Predicate is different. It stores facts as RDF triples with per-triple
provenance and confidence, and answers questions through a deterministic
reasoner that produces an explanation path for every derived claim. And it
**learns its own shape**: the schema is versioned like code and evolves under a
propose → validate → use-gated promotion loop, so the structure your agent
relies on gets sharper the more it's used — and prunes what it doesn't.

The bet is **not** that a graph recalls facts better than a long context window —
at the scales we've measured ([`predicate-eval/SCALE-FINDINGS.md`](packages/predicate-eval/SCALE-FINDINGS.md)),
in-context recall is competitive and often simpler. The bet is that a graph makes
answers **auditable, reproducible, and contradiction-aware** in a way a flat pile
can't.

## Why it's different

- **Auditable answers.** `kg_explain` returns the chain of triples and rules
  that produced a claim — each step cited back to its source and confidence.
  Not "trust me," but "here's the derivation."
- **Contradictions surface instead of averaging out.** When two sources
  disagree about a fact the schema marks functional or disjoint, the reasoner
  flags the conflict rather than silently picking one.
- **The graph remembers, and the schema earns its keep.** Facts persist across
  sessions. New schema becomes durable only after real queries reference it
  within a TTL — unused proposals expire on their own, so the graph can't thrash.
- **Goal-conditioned growth.** Concepts enter the graph because a goal needed
  them, not because a document mentioned them.

## Install / use it in your agent

> **Prerequisite: Node 20+.** Nothing else — no Docker, no database to run.

The fastest path is the `predicate-skill` npm package, which bundles the MCP
server, the `predicate` CLI, and per-client integration adapters.

<details open>
<summary><strong>Claude Code</strong> — one-command marketplace install</summary>

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`), then:

```bash
predicate up        # creates the local store + the 8 named graphs
predicate doctor    # all checks green
```

Hooks, slash commands, and the `kg_*` tools are wired automatically. Slash
commands: `/predicate:up`, `/predicate:down`, `/predicate:status`,
`/predicate:ask <question>`.

> Marketplace install failing? Register Predicate as a plain MCP server
> instead — see **[Manual install](#manual-install-fallback-for-any-host)**
> below. The reasoning tools work; only automatic capture and slash commands
> are lost.

</details>

<details>
<summary><strong>Codex CLI</strong> (native plugin, capture supported)</summary>

```bash
codex plugin marketplace add NordicAgents/predicate
# then enable "predicate" in the interactive plugin browser
```

Set `[features] plugin_hooks = true` in `~/.codex/config.toml` and approve the
hooks once via `/hooks`. See `packages/predicate-skill/hooks/codex-cli/README.md`.

> Plugin install failing? Register Predicate as a plain MCP server instead —
> see **[Manual install](#manual-install-fallback-for-any-host)** below
> (reasoning tools work; no capture).

</details>

<details>
<summary><strong>VS Code Copilot</strong> / <strong>Cursor</strong> (MCP-only)</summary>

From your project root:

```bash
npx predicate-skill install vscode    # writes .vscode/mcp.json + AGENTS.md
npx predicate-skill install cursor    # writes .cursor/mcp.json + AGENTS.md
```

Restart the editor. Reasoning tools work; there is no automatic turn capture
(neither host exposes usable lifecycle hooks).

</details>

### Manual install (fallback for any host)

If a native plugin/marketplace install fails — or your host isn't listed above
(Continue.dev, OpenCode, any stdio MCP client) — run Predicate as a plain stdio
MCP server. You get all 10 `kg_*` reasoning tools on any MCP-capable host; the
only thing you lose is automatic Stop-hook capture (and, on Claude Code, the
slash commands).

```bash
npm install -g predicate-skill   # published package; ships the server + CLI
predicate up                     # create the local store + named graphs
predicate doctor                 # all checks green

# The MCP server command is (copy the resolved absolute path):
node "$(npm root -g)/predicate-skill/server.bundle.mjs"
```

No env vars are required: the server defaults to the disk-backed Oxigraph store
(`PREDICATE_BACKEND=oxigraph`, `PREDICATE_DATASET=predicate`) — identical to the
native installs. Set them only to override.

Register that command with your host:

**Claude Code**
```bash
claude mcp add predicate -- node "$(npm root -g)/predicate-skill/server.bundle.mjs"
```

**Codex CLI** — add to `~/.codex/config.toml` (use the absolute path printed by `npm root -g`):
```toml
[mcp_servers.predicate]
command = "node"
args = ["/ABSOLUTE/PATH/predicate-skill/server.bundle.mjs"]
```

**Continue.dev** — in `~/.continue/config.yaml`:
```yaml
mcpServers:
  - name: predicate
    command: node
    args: ["/ABSOLUTE/PATH/predicate-skill/server.bundle.mjs"]
```

> Full per-client matrix, the 10 MCP tools, the CLI reference, and config live in
> the package README: **[`packages/predicate-skill/README.md`](packages/predicate-skill/README.md)**.

## Architecture

```
                    ┌─────────────────────────────────────────────┐
   your agent       │                  Predicate                  │
  (Claude Code,     │                                             │
   Codex …)         │   ┌──────────┐         ┌─────────────────┐  │
        │           │   │ 10 kg_*  │  SPARQL │  Storage adapter │  │
        │  MCP      │   │   tools  │────────▶│  Oxigraph (def.) │  │
        ├──────────▶│   │ (stdio)  │         │  Fuseki (opt-in) │  │
        │           │   └────┬─────┘         └────────┬────────┘  │
        │           │        │                        │           │
   Stop hook        │        │                  8 named graphs    │
  (turn capture)    │        ▼                        │           │
        │           │   ┌──────────┐          tbox · tbox-staging │
        └──────────▶│   │ 21-rule  │  fixpoint  abox · inferred   │
                    │   │ reasoner │◀─────────▶ provenance · meta  │
                    │   │ + SHACL  │  CONSTRUCT goals · usage      │
                    │   └──────────┘                              │
                    └─────────────────────────────────────────────┘

  capture ──▶ kg_assert ──▶ reasoner materializes ──▶ kg:inferred ──▶ kg_ask / kg_explain
```

The agent reads the schema (`kg_explore_schema`), drafts SPARQL, asserts facts
with provenance (`kg_assert`), and asks questions (`kg_ask`). The reasoner does
the logic; the model formulates queries and interprets results.

## How it works

- **Storage.** 8 named graphs separate slow-changing schema (`kg:tbox`) from
  fast-flowing facts (`kg:abox`), materialized entailments (`kg:inferred`),
  per-triple metadata (`kg:provenance`), goals (`kg:goals`), usage logs
  (`kg:usage`), staging (`kg:tbox-staging`), and version history (`kg:meta`).
- **Reasoning.** A curated set of **21 rules — 16 OWL 2 RL rules plus 5 domain
  and judgment derivations** (`Hotspot`, `FlakyCommand`, `ActiveFile`,
  current-judgment, conflict detection). The entailment rules run as SPARQL
  `CONSTRUCT` forward-chained to a fixpoint; disjointness is checked as an
  inconsistency pass; SHACL shapes add closed-world validation. The OWL 2 RL
  coverage is a scoped subset — in v1, `owl:propertyChainAxiom` is limited to
  length-2 chains and `owl:hasKey` to single-property keys.
- **Provenance.** Every triple is annotated with source, time, confidence, and
  extraction method using RDF-star. Low-confidence triples stay visible to
  queries but are excluded from the inference closure, so they cannot poison
  entailment.
- **Schema lifecycle.** The agent proposes deltas to `kg:tbox-staging`, never to
  `kg:tbox` directly. A proposal is promoted only after the reasoner accepts it
  and it has been referenced by N successful queries inside a TTL; unused
  proposals expire quietly.
- **Cross-session continuity.** A Stop hook extracts typed triples from each turn
  — files modified, commands that passed or failed — into `kg:abox`. The reasoner
  derives `Hotspot`, `FlakyCommand`, and `ActiveFile` so the next session can
  ask "what's unstable here?" without re-reading the repo.

## Packages

This is a pnpm monorepo. Each package has its own README with details.

| Package | Purpose |
|---|---|
| [`predicate-mcp`](packages/predicate-mcp/README.md) | MCP server, the 10 `kg_*` tools, and the storage adapters (Oxigraph + Fuseki). |
| [`predicate-reasoner`](packages/predicate-reasoner/README.md) | 21-rule forward-chaining reasoner + SHACL validation + inference traces for `kg_explain`. |
| [`predicate-agent`](packages/predicate-agent/README.md) | Goal store, decomposer, gap detector, schema proposer, promotion sweeper, generalizer, lifecycle controller. |
| [`predicate-cli`](packages/predicate-cli/README.md) | The `predicate` command-line interface. |
| [`predicate-ontology`](packages/predicate-ontology/README.md) | Versioned TBox catalog, SHACL shapes, meta vocabulary. |
| [`predicate-server`](packages/predicate-server/README.md) | Backend bootstrap + Fuseki/TDB2 docker-compose for the opt-in backend. |
| [`predicate-eval`](packages/predicate-eval/README.md) | End-to-end demo + multi-hop eval + ontology CI harness. |
| [`predicate-skill`](packages/predicate-skill/README.md) | The distributable npm package — bundled server + CLI + SKILL.md + per-client hooks. |

## Development

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate
pnpm install
pnpm build            # builds all packages + the plugin bundle
pnpm test             # runs against the default Oxigraph backend, no Docker needed
                      # for the Fuseki leg: PREDICATE_BACKEND=fuseki + a running Fuseki
```

Other root scripts: `pnpm typecheck`, `pnpm lint`, `pnpm fuseki:up`,
`pnpm fuseki:down`.

## License

Elastic License 2.0 (ELv2) — source-available. See
[`LICENSE`](packages/predicate-skill/LICENSE).
