import type { BackendName } from './storage/adapter.js';

export interface Config {
  backend: BackendName;
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
  oxigraphStorePath: string;
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  const backend = (process.env.PREDICATE_BACKEND ?? 'oxigraph') as BackendName;
  const home = process.env.HOME ?? '';
  const xdg = process.env.XDG_DATA_HOME;
  const oxigraphStorePath =
    process.env.PREDICATE_STORE_PATH ??
    (xdg ? `${xdg}/predicate/store` : `${home}/.predicate/store`);
  return {
    backend,
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`,
    oxigraphStorePath,
  };
}
