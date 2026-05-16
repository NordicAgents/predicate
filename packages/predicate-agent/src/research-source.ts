import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { ResearchArtifact, ResearchQuery } from './types.js';

export interface ResearchSource {
  readonly name: string;
  fetch(query: ResearchQuery): Promise<ResearchArtifact[]>;
}

export interface DocsResearchSourceOptions {
  root: string;
  extensions: string[];
}

export class DocsResearchSource implements ResearchSource {
  readonly name = 'docs';
  private readonly root: string;
  private readonly extensions: Set<string>;

  constructor(opts: DocsResearchSourceOptions) {
    this.root = opts.root;
    this.extensions = new Set(opts.extensions);
  }

  async fetch(_query: ResearchQuery): Promise<ResearchArtifact[]> {
    const out: ResearchArtifact[] = [];
    this.walk(this.root, out);
    return out;
  }

  private walk(dir: string, out: ResearchArtifact[]): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        this.walk(full, out);
        continue;
      }
      if (!this.extensions.has(extname(entry))) continue;
      const content = readFileSync(full, 'utf8');
      out.push({
        source: this.name,
        uri: `file://${full}`,
        content,
        metadata: { extension: extname(entry) },
      });
    }
  }
}
