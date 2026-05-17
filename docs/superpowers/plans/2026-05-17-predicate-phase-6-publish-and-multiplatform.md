# Predicate Phase 6 — npm Publish + Slash Commands + Multi-Platform Install Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three deferred Phase-5b items, packaged into a coherent v1.2:

1. **npm publish-ready** — the `predicate-skill` package can be published to npm under a scoped public name so users can `npm install -g predicate` or `npx predicate up`. Removes `private: true`, adds `prepublishOnly`, `files`, and a `publishConfig` block.
2. **Slash commands proper** — add a `commands/` directory with one markdown file per command (`/predicate:up`, `/predicate:down`, `/predicate:doctor`, `/predicate:stats`, `/predicate:ask`), exposing the most common operator actions as first-class slash entries inside Claude Code.
3. **Multi-platform install matrix** — add per-platform install blocks to the README covering Claude Code (existing), Cursor, Continue.dev, OpenCode, generic MCP-only (Gemini CLI / Codex / any-MCP). Hook integration stays Claude-Code-only for now; the other platforms get MCP-only because the 8 `kg_*` tools work without hooks.

**Architecture:** No new packages, no new runtime code. This is packaging + docs + a thin `commands/` directory. The `predicate-skill` package becomes the public-facing npm package; we keep it `private` until the implementer is ready to push (`npm publish` is a manual step gated by the user's npm credentials). Slash command files are markdown with frontmatter — each one's body is a short prompt that tells Claude what MCP tool to invoke. README gets a per-platform install matrix near the top, replacing the existing single "Claude Code" block.

**Tech Stack:** No new deps. esbuild bundler from Phase 5 already produces self-contained `.mjs` files for `npm publish`.

**Spec reference:** No design-spec changes — this is distribution/packaging work. The Phase 5 plan's "Phase 5b candidates" list (npm publish, slash commands, multi-platform) is what we're cashing in.

**Phase exit criteria:**
- `npm pack --dry-run` from the workspace root succeeds and the listed file set is minimal (bundles + skills/hooks/compose/README/LICENSE, nothing else).
- `predicate-skill/package.json` has the correct public name, `files` array, `publishConfig.access: "public"`, and a working `prepublishOnly` script. Still `private: true` until the human publishes; the package is structurally publish-ready.
- `packages/predicate-skill/commands/` contains 5 command files (`up.md`, `down.md`, `doctor.md`, `stats.md`, `ask.md`), each with frontmatter declaring the slash command name.
- The root `README.md` has a "Install" section with four platform blocks (Claude Code, Cursor, Continue.dev, generic MCP).
- All 148 existing tests still pass; no test regressions (this phase is pure packaging + docs).
- Phase tag `v1.2.0-multiplatform` at the final commit.

---

## File structure (created or modified in Phase 6)

```
predicate/
├── packages/
│   └── predicate-skill/                                (modified)
│       ├── package.json                                ← public name, files, prepublishOnly
│       ├── commands/                                   ← new
│       │   ├── up.md
│       │   ├── down.md
│       │   ├── doctor.md
│       │   ├── stats.md
│       │   └── ask.md
│       └── LICENSE                                     ← new (Apache-2.0, required for npm)
└── README.md                                            ← Install matrix
```

That's it — four directory entries, no source code, no tests beyond verifying the existing suite still passes.

---

## Task 1: Make `predicate-skill` npm publish-ready (still private)

This task **does not actually publish**. It makes the package structurally ready — correct name, license, file allow-list, publish script — so a future `npm publish` is one command after a human flips `private: false`.

**Files:**
- Modify: `packages/predicate-skill/package.json`
- Create: `packages/predicate-skill/LICENSE` (Apache-2.0)

- [ ] **Step 1: Add the Apache-2.0 LICENSE file**

Create `packages/predicate-skill/LICENSE` with the standard Apache-2.0 text. Get it from `https://www.apache.org/licenses/LICENSE-2.0.txt` or any existing Apache-licensed project. The file should be the full 11.4 KB Apache 2.0 license text starting with `Apache License / Version 2.0, January 2004 / ...`.

If you have `curl` and network access:

```bash
curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt > packages/predicate-skill/LICENSE
```

Otherwise paste the canonical text. Verify the file is ~11.3 KB and starts with `                                 Apache License`.

- [ ] **Step 2: Rewrite `packages/predicate-skill/package.json`**

Read the current file. Replace with:

```json
{
  "name": "predicate-skill",
  "version": "1.2.0",
  "description": "Local reasoning knowledge graph (RDF/OWL) for AI agents — Claude Code plugin + MCP server + predicate CLI.",
  "author": {
    "name": "Nordic Agents Research",
    "email": "midhunxavier@outlook.com"
  },
  "license": "Apache-2.0",
  "homepage": "https://github.com/midhunxavier/predicate#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/midhunxavier/predicate.git",
    "directory": "packages/predicate-skill"
  },
  "bugs": "https://github.com/midhunxavier/predicate/issues",
  "keywords": [
    "mcp", "claude-code", "knowledge-graph", "rdf", "owl",
    "sparql", "reasoning", "fuseki", "agent"
  ],
  "type": "module",
  "bin": {
    "predicate": "./cli.bundle.mjs"
  },
  "files": [
    "server.bundle.mjs",
    "cli.bundle.mjs",
    ".claude-plugin",
    "skills",
    "commands",
    "hooks",
    "compose",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "bundle": "node scripts/bundle.mjs",
    "prepublishOnly": "node scripts/bundle.mjs && node -e \"const fs=require('fs');for(const f of ['server.bundle.mjs','cli.bundle.mjs']){if(!fs.existsSync(f)){console.error('missing '+f);process.exit(1)}}\""
  },
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public"
  },
  "private": true
}
```

Key points:
- `version` bumped to `1.2.0` (Phase 6 release).
- `name` stays `predicate-skill` (unscoped). If unavailable on npm, fall back to `@nordic-agents/predicate-skill` and add a note in the README.
- `files` is a strict allow-list — only the runtime artifacts ship, no source or `scripts/`. This keeps the published tarball small.
- `prepublishOnly` runs the bundler + verifies both `.mjs` files exist before npm publishes.
- `publishConfig.access: "public"` is required for unscoped public packages on npm.
- `private: true` stays for safety. The human flips it to `false` and runs `npm publish` when ready.

- [ ] **Step 3: Dry-run the publish**

```bash
cd packages/predicate-skill
npm pack --dry-run 2>&1
cd ../..
```

Expected output: a list of files that would be in the published tarball, ending with a summary like:

```
npm notice 📦  predicate-skill@1.2.0
npm notice Tarball Contents
npm notice 1.4MB server.bundle.mjs
npm notice 9.5KB cli.bundle.mjs
npm notice ... .claude-plugin/plugin.json
npm notice ... skills/predicate/SKILL.md
npm notice ... skills/predicate-doctor/SKILL.md
npm notice ... skills/predicate-stats/SKILL.md
npm notice ... commands/...   <-- this will be empty until Task 2
npm notice ... hooks/hooks.json
npm notice ... hooks/session-start.sh
npm notice ... compose/docker-compose.yml
npm notice ... compose/fuseki/config.ttl
npm notice ... LICENSE
npm notice ... README.md
npm notice ... package.json
npm notice === Tarball Details ===
npm notice name: predicate-skill
npm notice version: 1.2.0
```

If `npm` flags the package as private and refuses to pack (depending on npm version), `npm pack --dry-run` may still print the file list with a warning — that's fine. The point is the `files` list correctly enumerates the artifacts.

Confirm the file list contains **only** items from the `files` array. If it includes `node_modules`, `tsconfig.json`, or anything else, the `files` array is wrong — fix and re-run.

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: 148/148 passing. This task only touches package metadata.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-skill/package.json packages/predicate-skill/LICENSE
git commit -m "feat(skill): publish-ready package.json (still private) + Apache-2.0 LICENSE"
```

## Manual publish step (for the human, NOT the implementer)

After this task lands, the human can publish with:

```bash
cd packages/predicate-skill
# Edit package.json to set "private": false  (or use jq)
npm publish
# Set "private": true back if you don't want accidental future publishes
```

The implementer **does not** run `npm publish` — that requires credentials and is the human's call. Document this flow in the README in Task 3.

---

## Task 2: Slash commands

Add five command files under `packages/predicate-skill/commands/`. Each is a markdown file with frontmatter declaring the command name and the body telling Claude what to do.

Format follows the same shape as the existing `skills/predicate-doctor/SKILL.md` — Claude reads the body when the command is invoked. Slash command syntax inside Claude Code resolves these as `/predicate:<command>`.

**Files:**
- Create: `packages/predicate-skill/commands/up.md`
- Create: `packages/predicate-skill/commands/down.md`
- Create: `packages/predicate-skill/commands/doctor.md`
- Create: `packages/predicate-skill/commands/stats.md`
- Create: `packages/predicate-skill/commands/ask.md`

- [ ] **Step 1: Write `packages/predicate-skill/commands/up.md`**

```markdown
---
name: up
description: Bring Fuseki up via `predicate up` (Docker Compose + bootstrap graphs + load seed TBox).
---

# /predicate:up

Run the shell command `predicate up` for the user.

If `predicate` is not on PATH, fall back to:
`node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs up`

Report the exit code. If non-zero, run `predicate doctor` and report what's failing.
```

- [ ] **Step 2: Write `packages/predicate-skill/commands/down.md`**

```markdown
---
name: down
description: Stop Fuseki via `predicate down` (preserves the data volume).
---

# /predicate:down

Run the shell command `predicate down` for the user. Fallback to
`node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs down` if not on PATH.

Report the exit code.
```

- [ ] **Step 3: Write `packages/predicate-skill/commands/doctor.md`**

```markdown
---
name: doctor
description: Run health checks on the Predicate stack — Docker + Fuseki + TBox.
---

# /predicate:doctor

Run the shell command `predicate doctor` for the user. Fallback to
`node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs doctor` if not on PATH.

Read the output. For each `[ ]` (failed) check, give the user the
one-line fix from the doctor's `— ...` detail field.

Then call `kg_stats` via MCP to sanity-check that tools actually respond.
```

- [ ] **Step 4: Write `packages/predicate-skill/commands/stats.md`**

```markdown
---
name: stats
description: Show current Predicate graph metrics via `kg_stats`.
---

# /predicate:stats

Call the `kg_stats` MCP tool. Format the result as a compact table:

```
triples              N
abox                 N
inferred             N
tbox                 N
classes              N
inferredRatio        N.NNN
unusedConceptRatio   N.NNN
materializationLatencyMsP95   N
```

Flag if `unusedConceptRatio > 0.15` (PRD §16 bounded-growth target) — suggest
`/predicate:maintain` (or `kg_maintain` MCP call) to reclaim space.
```

- [ ] **Step 5: Write `packages/predicate-skill/commands/ask.md`**

```markdown
---
name: ask
description: Ask the knowledge graph a structural question. Composes kg_explore_schema → kg_ask → kg_explain.
---

# /predicate:ask <question>

Treat the arguments as the user's question. Follow the SKILL.md workflow:

1. Call `kg_explore_schema(concept)` for the main subject in the question.
2. Draft fresh SPARQL against `kg:abox ∪ kg:inferred` using predicates from
   the schema slice.
3. Call `kg_ask` to execute.
4. Call `kg_explain` for each load-bearing claim in the answer, with cited
   provenance.

Do NOT invent predicates — use only what `kg_explore_schema` returned. If a
predicate is missing, call `kg_propose_schema` instead of fabricating.
```

- [ ] **Step 6: Verify the commands directory**

```bash
ls packages/predicate-skill/commands/
```

Expected: 5 files — `ask.md`, `doctor.md`, `down.md`, `stats.md`, `up.md`.

- [ ] **Step 7: Verify each frontmatter parses**

Quick sanity check that every file starts with `---` and has a `name:` field:

```bash
for f in packages/predicate-skill/commands/*.md; do
  head -1 "$f" | grep -q '^---$' && echo "$f: ok" || echo "$f: BAD frontmatter"
done
```

Expected: 5 `ok` lines.

- [ ] **Step 8: Run the test suite**

```bash
pnpm test
```

Expected: 148/148 still passing. No code touched.

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-skill/commands
git commit -m "feat(skill): add /predicate:up/down/doctor/stats/ask slash commands"
```

---

## Task 3: Multi-platform install matrix in README

Rewrite the README's "Install" section to cover Claude Code (existing, but reordered into a multi-block), Cursor, Continue.dev, OpenCode, and generic MCP-only.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current `README.md`**

The Phase 5 README has two install paths: Claude Code marketplace, and MCP-only generic. This task expands the MCP-only section into per-platform blocks.

- [ ] **Step 2: Replace the "Quick install" + "MCP-only install" sections**

Find the section starting with `## Quick install (Claude Code)`. Replace through the end of `## MCP-only install (any tool that speaks MCP)` (just before `## Tools`) with:

````markdown
## Install

Prerequisites everywhere: **Docker** (for Fuseki) and **Node 20+**.

<details open>
<summary><strong>Claude Code</strong> — marketplace, full plugin (SKILL.md + hooks + slash commands)</summary>

```
/plugin marketplace add midhunxavier/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then:

```bash
predicate up           # starts Fuseki, loads seed TBox + meta + shapes
predicate doctor       # confirms everything is green
```

Slash commands available: `/predicate:up`, `/predicate:down`, `/predicate:doctor`,
`/predicate:stats`, `/predicate:ask <question>`.

</details>

<details>
<summary><strong>Cursor</strong> — MCP-only via settings.json</summary>

Cursor reads MCP servers from `~/.cursor/mcp.json` (or the project-local
`.cursor/mcp.json`). Add this entry:

```json
{
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  }
}
```

Substitute the absolute path to your local clone of this repo. Then in Cursor,
invoke the 8 `kg_*` tools directly — Cursor doesn't read `SKILL.md`, so you'll
need to guide it. (Bring Fuseki up first: `predicate up`.)

</details>

<details>
<summary><strong>Continue.dev</strong> — MCP-only via config.yaml</summary>

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: predicate
    command: node
    args:
      - /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
    env:
      FUSEKI_URL: http://localhost:3030
      PREDICATE_DATASET: predicate
```

</details>

<details>
<summary><strong>OpenCode</strong> — MCP-only via plugin manifest</summary>

OpenCode reads plugins via `openclaw.plugin.json`. Add an MCP server entry
pointing at the bundle, or wrap as a plugin if your version supports it. For a
minimal MCP server registration consult the OpenCode docs; the bundle path is:

```
/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
```

Env vars: `FUSEKI_URL`, `PREDICATE_DATASET`.

</details>

<details>
<summary><strong>Any-MCP / Gemini CLI / Codex CLI / generic</strong></summary>

Any client that speaks MCP over stdio can use the bundled server directly:

```bash
git clone https://github.com/midhunxavier/predicate
cd predicate
pnpm install && pnpm build
predicate up

# Then point your MCP-capable tool at:
#   node /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
# with env FUSEKI_URL=http://localhost:3030 PREDICATE_DATASET=predicate
```

For Gemini CLI specifically, the MCP block in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs"]
    }
  }
}
```

Hook adapters (`BeforeTool`/`AfterTool` integration like context-mode has)
are Claude-Code-only in v1.2. Other platforms get the 8 `kg_*` tools, which
work without hooks.

</details>

<details>
<summary><strong>From npm (after publish)</strong></summary>

Once `predicate-skill` is published to npm (see `docs/superpowers/plans/2026-05-17-predicate-phase-6-publish-and-multiplatform.md` for the publish flow), users can:

```bash
npm install -g predicate-skill
predicate up
predicate doctor

# Or one-shot MCP without global install:
claude mcp add predicate -- npx -y predicate-skill
```

Status: package metadata is publish-ready (Phase 6); the `npm publish`
itself is gated by maintainer credentials.

</details>
````

Important: GitHub Markdown renders `<details>` blocks as collapsibles. The first one (`Claude Code`) has `open` so it's expanded by default.

- [ ] **Step 3: Update the "Status" section at the bottom**

Find the existing `## Status` section. Replace with:

```markdown
## Status

**v1.2 — multi-platform.** Distributable via Claude Code marketplace, Cursor,
Continue.dev, OpenCode, and any generic MCP client. npm publish prep complete
(maintainer-gated). Slash commands shipped for the five common ops.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform`.

Deferred to v1.3 (see spec §17): materialization caching, tag-while-deriving
for `kg_explain`, intent-aware `ResearchSource` filtering, journal-based
cross-system promotion atomicity, LLM-augmented decomposer + extractor,
non-Claude-Code hook adapters.
```

- [ ] **Step 4: Verify the README still renders**

```bash
node -e "const fs=require('fs'); const r=fs.readFileSync('README.md','utf8'); console.log('lines:', r.split('\n').length); console.log('details blocks:', (r.match(/<details/g)||[]).length)"
```

Expected output:
- `lines: N` where N > 100 (the file grew with the matrix)
- `details blocks: 6` (Claude Code, Cursor, Continue.dev, OpenCode, generic, npm)

- [ ] **Step 5: Run the test suite**

```bash
pnpm test
```

Expected: 148/148.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: multi-platform install matrix (Cursor, Continue.dev, OpenCode, generic MCP) + npm path"
```

---

## Task 4: Phase 6 exit — verify + tag `v1.2.0-multiplatform`

**Files:**
- (no source changes; this is verification + tagging)

- [ ] **Step 1: Final verification chain**

```bash
pnpm test                          # 148/148
pnpm typecheck                     # clean
pnpm lint                          # clean
pnpm build                         # rebuilds packages + bundles
```

CLI smoke:

```bash
node packages/predicate-skill/cli.bundle.mjs --version
node packages/predicate-skill/cli.bundle.mjs doctor
```

Expected:
- `1.0.0` (the CLI version is 1.0.0; the skill/package version is 1.2.0)
- 3 health check lines

- [ ] **Step 2: Verify `npm pack --dry-run` still works after Tasks 1–3**

```bash
cd packages/predicate-skill
npm pack --dry-run 2>&1 | tail -30
cd ../..
```

Expected: file list now includes `commands/up.md`, `commands/down.md`, `commands/doctor.md`, `commands/stats.md`, `commands/ask.md` — confirming the `commands/` directory is part of the published tarball.

- [ ] **Step 3: Tag**

```bash
git tag v1.2.0-multiplatform
```

- [ ] **Step 4: Confirm final state**

```bash
git log --oneline -10
git tag --list 'v*'
```

Expected tags through Phase 6: `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps`, `v0.3b.0-research-execution`, `v0.3c.0-schema-evolution`, `v1.0.0`, `v1.1.0-distribution`, `v1.2.0-multiplatform`.

- [ ] **Step 5: Print a summary**

```bash
echo "Phase 6 done."
echo "Install paths now documented for: Claude Code, Cursor, Continue.dev, OpenCode, generic MCP."
echo "npm publish flow (maintainer): cd packages/predicate-skill && jq '.private = false' package.json > /tmp/p && mv /tmp/p package.json && npm publish"
```

---

## Self-review

- **Spec coverage:** Phase 6 is distribution work; no design-spec sections. The Phase 5 plan's three "Phase 5b candidates" map 1:1 to Tasks 1, 2, 3.
- **Placeholder scan:** zero "TBD" / "implement later" / "handle errors". Every step shows actual commands or content.
- **Type consistency:** No code changes, so no type drift risk. All command files reference MCP tool names that already exist (`kg_stats`, `kg_explore_schema`, `kg_ask`, `kg_explain`, `kg_propose_schema`, `kg_maintain`).
- **Known follow-ups (v1.3 candidates):**
  - **Actual `npm publish`.** Requires npm credentials; gated by the human. Documented in Task 1 manual-step note.
  - **Per-platform hook adapters.** Each non-Claude-Code platform (Gemini CLI, Cursor, etc.) has its own hook spec; the SessionStart-equivalent for each is a separate per-platform engineering task. Out of scope here.
  - **Marketplace listing.** Beyond `/plugin marketplace add midhunxavier/predicate`, Claude Code may have a curated marketplace listing; submit to it when ready.
  - **CLI binary distribution beyond npm.** Homebrew tap, Scoop manifest, or a precompiled single binary via `pkg`/`nexe`. Defer; npm covers most cases.
- **Test surface unchanged.** No new tests because no new runtime code. The existing 148 cover the underlying surfaces this phase repackages.
- **Manual publish is intentional.** The plan stops before `npm publish` because (a) credentials are required, (b) publishing is irrevocable for that version, (c) the human should choose the name (`predicate-skill` vs `@nordic-agents/predicate-skill`) based on what's available. The plan makes the package structurally ready; the human pulls the trigger.
