export interface Config {
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  return {
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`,
  };
}
