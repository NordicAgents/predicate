import type { SelectResult } from '../sparql/types.js';

export type TurtleFormat = 'turtle' | 'nt' | 'nt-star';

export interface StorageAdapter {
  // Query
  select(query: string): Promise<SelectResult>;
  ask(query: string): Promise<boolean>;
  update(query: string): Promise<void>;

  // Graph inspection
  knownGraphs(): Promise<string[]>;

  // Bulk I/O
  loadTurtle(turtle: string, graph: string): Promise<void>;
  serializeGraph(graph: string, format: TurtleFormat): Promise<string>;
  clearGraph(graph: string): Promise<void>;

  // Lifecycle
  ready(): Promise<void>;
  close(): Promise<void>;
}

export type BackendName = 'oxigraph' | 'fuseki';
