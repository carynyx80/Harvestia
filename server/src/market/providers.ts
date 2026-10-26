// Reference price providers. Each returns monthly points in the provider's own
// unit; the market service validates, normalises and stores them. Add a
// licensed real-time provider here later without touching the pricing rules.
import type { CommodityDef } from '../../../shared/market';

export interface RefPoint { period: Date; value: number }

export interface ReferenceProvider {
  id: string;
  name: string;
  /** shown wherever the price is shown */
  attribution: string;
  license: string;
  /** how often the provider publishes; used for staleness */
  frequency: 'monthly';
  sourceUrl(def: CommodityDef): string | null;
  fetch(def: CommodityDef, signal: AbortSignal): Promise<RefPoint[]>;
}

// IMF Primary Commodity Prices series, served as CSV by FRED (Federal Reserve Bank of St. Louis).
const IMF_SERIES: Record<string, string> = {
  wheat: 'PWHEAMTUSDM', corn: 'PMAIZMTUSDM', soy: 'PSOYBUSDM', coffee: 'PCOFFOTMUSDM', cocoa: 'PCOCOUSDM',
};

export const imfViaFred: ReferenceProvider = {
  id: 'imf-pcps',
  name: 'IMF Primary Commodity Prices',
  attribution: 'International Monetary Fund, Primary Commodity Prices (monthly averages), retrieved from FRED, Federal Reserve Bank of St. Louis',
  license: 'IMF data, free to reuse with attribution',
  frequency: 'monthly',
  sourceUrl: def => IMF_SERIES[def.key] ? `https://fred.stlouisfed.org/series/${IMF_SERIES[def.key]}` : null,
  async fetch(def, signal) {
    const id = IMF_SERIES[def.key];
    if (!id) return [];
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal, headers: { 'user-agent': 'Harvestia market data (game reference prices)' } });
    if (!res.ok) throw new Error(`FRED responded ${res.status}`);
    return parseFredCsv(await res.text());
  },
};

/** Parses FRED's `date,value` CSV; missing values (".") are skipped. */
export function parseFredCsv(text: string): RefPoint[] {
  const out: RefPoint[] = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    const period = new Date(`${d}T00:00:00Z`), value = Number(v);
    if (!Number.isNaN(period.getTime()) && Number.isFinite(value)) out.push({ period, value });
  }
  return out.sort((a, b) => +a.period - +b.period);
}
