export interface ProvenanceMeta {
  source: string;
  confidence: number;
  method: string;
  timestamp: string;
}

export function buildProvenanceMeta(
  partial: Omit<ProvenanceMeta, 'timestamp'>,
): ProvenanceMeta {
  return { ...partial, timestamp: new Date().toISOString() };
}
