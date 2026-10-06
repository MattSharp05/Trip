import { useQuery } from '@tanstack/react-query';

import { now } from '@/core/clock';
import type { Rates } from '@/core/money';
import { demoRates } from '@/scenarios/fixtures/rates';
import { queryClient } from '@/services/data/hooks';
import { useScenarioStore } from '@/stores/scenario';

/** Frankfurter: ECB reference rates, free, no key (TDD → External services). */
const RATES_URL = 'https://api.frankfurter.dev/v1/latest';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The latest daily rates against `base`, e.g. `{ base: 'USD', rates: { EUR: 0.88, … } }`. */
export async function fetchRates(base: string): Promise<Rates> {
  const res = await fetch(`${RATES_URL}?base=${encodeURIComponent(base)}`);
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  const body = (await res.json()) as {
    base?: string;
    date?: string;
    rates?: Record<string, number>;
  };
  if (!body.rates || typeof body.rates !== 'object') throw new Error('Frankfurter: no rates');
  return { base: body.base ?? base, date: body.date ?? '', rates: body.rates };
}

/**
 * Daily rates against the display currency. The ECB publishes once a working day, so a result is
 * cached for the (UTC) day and kept fresh for the whole day: switching currencies back and forth
 * costs one request per currency per day. A demo session (scenario) gets fixed rates and never
 * touches the network.
 */
export function useRates(base: string) {
  const scenario = useScenarioStore((s) => s.active);
  const day = now().toISOString().slice(0, 10);
  return useQuery(
    {
      queryKey: ['rates', scenario ? 'demo' : 'live', base, day],
      queryFn: (): Promise<Rates> =>
        scenario ? Promise.resolve(demoRates(base)) : fetchRates(base),
      staleTime: DAY_MS,
      gcTime: DAY_MS,
    },
    queryClient,
  );
}
