// Single source of truth for per-platform adapter generation.
// gen-adapters.mjs reads this; never hand-edit generated manifests.

export const MCP_ENV = {
  PREDICATE_BACKEND: 'oxigraph',
  PREDICATE_DATASET: 'predicate',
};

// Tier 1 = full plugin bundle (skills + hooks + MCP). Tier 2 = MCP + instructions.
export const PLATFORMS = {
  codex:  { tier: 1, instructionFile: 'AGENTS.md' },
  gemini: { tier: 1, instructionFile: 'GEMINI.md' },
  vscode: { tier: 2, instructionFile: 'AGENTS.md' },
  cursor: { tier: 2, instructionFile: 'AGENTS.md' },
};
