import type { SelectResult } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat, BackendName } from './adapter.js';
import { OxigraphServerAdapter } from './oxigraph-server.js';
import { OxigraphAdapter } from './oxigraph.js';
import { BackendUnavailable } from './oxigraph-binary.js';

export interface DefaultOxigraphAdapterOptions {
  storePath: string;
}

/** The `backend=oxigraph` default: try the native disk-backed daemon; on
 *  BackendUnavailable, transparently fall back to the in-process WASM store.
 *  Worst case equals the previous default behavior. */
export class DefaultOxigraphAdapter implements StorageAdapter {
  private storePath: string;
  private inner: StorageAdapter | null = null;
  private active: Extract<BackendName, 'oxigraph' | 'oxigraph-wasm'> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(opts: DefaultOxigraphAdapterOptions) {
    this.storePath = opts.storePath;
  }

  async ready(): Promise<void> {
    if (this.initPromise === null) {
      this.initPromise = this.init().catch((e) => { this.initPromise = null; throw e; });
    }
    await this.initPromise;
  }

  private async init(): Promise<void> {
    const server = new OxigraphServerAdapter({ storePath: this.storePath });
    try {
      await server.ready();
      this.inner = server;
      this.active = 'oxigraph';
    } catch (e) {
      if (!(e instanceof BackendUnavailable)) throw e;
      console.error(
        `predicate: native Oxigraph unavailable (${e.message}); using in-process WASM store.`,
      );
      const wasm = new OxigraphAdapter({ storePath: this.storePath });
      await wasm.ready();
      this.inner = wasm;
      this.active = 'oxigraph-wasm';
    }
  }

  /** Which backend ended up live. Valid after `ready()`. */
  activeBackend(): 'oxigraph' | 'oxigraph-wasm' {
    if (!this.active) throw new Error('activeBackend() called before ready()');
    return this.active;
  }

  private async use(): Promise<StorageAdapter> {
    await this.ready();
    return this.inner!;
  }

  async select(q: string): Promise<SelectResult> { return (await this.use()).select(q); }
  async ask(q: string): Promise<boolean> { return (await this.use()).ask(q); }
  async update(q: string): Promise<void> { return (await this.use()).update(q); }
  async knownGraphs(): Promise<string[]> { return (await this.use()).knownGraphs(); }
  async loadTurtle(t: string, g: string): Promise<void> { return (await this.use()).loadTurtle(t, g); }
  async serializeGraph(g: string, f: TurtleFormat): Promise<string> { return (await this.use()).serializeGraph(g, f); }
  async clearGraph(g: string): Promise<void> { return (await this.use()).clearGraph(g); }
  async close(): Promise<void> { if (this.inner) await this.inner.close(); }
}
