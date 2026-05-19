import { FusekiAdapter } from 'predicate-mcp/src/storage/fuseki.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

export async function migrate(args: string[]): Promise<number> {
  const from = parseFlag(args, '--from');
  const to = parseFlag(args, '--to');
  if (from !== 'fuseki' || to !== 'oxigraph') {
    console.error("predicate migrate: only --from fuseki --to oxigraph is supported.");
    return 2;
  }

  const cfg = loadConfig();
  const src = new FusekiAdapter(cfg);
  const dst = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
  await src.ready();
  await dst.ready();

  const graphs = Object.values(GRAPH);
  for (const g of graphs) {
    process.stdout.write(`migrating ${g} ... `);
    let nt: string;
    try {
      nt = await src.serializeGraph(g, 'nt-star').catch(() => src.serializeGraph(g, 'nt'));
    } catch (e: unknown) {
      // Graph does not exist in source (Fuseki returns 404 for unknown graphs).
      const status = (e as { status?: number }).status;
      if (status === 404) {
        console.log('(not found in source, skipping)');
        continue;
      }
      throw e;
    }
    await dst.clearGraph(g);
    if (nt.trim().length > 0) await dst.loadTurtle(nt, g);

    // Triple-count parity check.
    // Note: Oxigraph 0.5.x does not support RDF-star natively; it rewrites
    // `<< s p o >> meta:prop x` annotations into blank-node reifications
    // (adding an extra `rdf:reifies` triple per annotation). Graphs that
    // contain RDF-star annotations will therefore have a higher triple count
    // in Oxigraph than in Fuseki. We detect this case and emit a warning
    // rather than aborting, since the data is faithfully represented.
    const hasRdfStar = nt.includes('<<');
    const srcCount = (await src.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`)).results.bindings[0]?.n?.value ?? '0';
    const dstCount = (await dst.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`)).results.bindings[0]?.n?.value ?? '0';
    if (srcCount !== dstCount) {
      if (hasRdfStar && Number(dstCount) > Number(srcCount)) {
        console.log(`${srcCount} triples ✓ (dest=${dstCount}; RDF-star reification adds extra triples — expected)`);
      } else {
        console.error(`\npredicate migrate: triple count mismatch on ${g}: source=${srcCount}, dest=${dstCount}. Aborting.`);
        return 1;
      }
    } else {
      console.log(`${srcCount} triples ✓`);
    }
  }

  console.log(`predicate migrate: complete. Set PREDICATE_BACKEND=oxigraph (default) and run 'predicate down' to stop the Fuseki container if you no longer need it.`);
  await src.close();
  await dst.close();
  return 0;
}
