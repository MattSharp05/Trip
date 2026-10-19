import { useQuery } from '@tanstack/react-query';

import { now } from '@/core/clock';
import type { Rates } from '@/core/money';
import { demoRates } from '@/scenarios/fixtures/rates';
import { queryClient } from '@/services/data/hooks';
import { useScenarioStore } from '@/stores/scenario';

/** Frankfurter: ECB reference rates, free, no key (TDD → External services). */
const FRANKFURTER = 'https://api.frankfurter.dev/v1';
const RATES_URL = `${FRANKFURTER}/latest`;

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

/**
 * How many `to` one `from` bought on `date` (`YYYY-MM-DD`): Frankfurter's ECB rate for that day,
 * or the previous working day's on weekends and holidays (ADR 0030). A future date asks for today
 * (Frankfurter has nothing yet). Same currency → 1, with no request. Cached by (date, from, to)
 * for the session: a past day's rate never changes.
 */
export function fetchRateOn(date: string, from: string, to: string): Promise<number> {
  if (from === to) return Promise.resolve(1);
  const today = now().toISOString().slice(0, 10);
  const day = date > today ? today : date;
  return queryClient.fetchQuery({
    queryKey: ['rate-on', day, from, to],
    queryFn: async () => {
      const res = await fetch(
        `${FRANKFURTER}/${day}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
      );
      if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
      const body = (await res.json()) as { rates?: Record<string, number> };
      const rate = body.rates?.[to];
      if (typeof rate !== 'number' || !(rate > 0)) throw new Error('Frankfurter: no rate');
      return rate;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/**
 * The rate an expense paid in `from` on `date` stores for the trip currency `to`: the day's rate,
 * or the fixed demo rate in a demo session (never the network). Null when it can't be loaded;
 * screens then convert at today's rates.
 */
export async function expenseRate(
  date: string,
  from: string,
  to: string,
  { demo }: { demo: boolean },
): Promise<number | null> {
  if (from === to) return 1;
  if (demo) {
    const rate = demoRates(from).rates[to];
    return typeof rate === 'number' && rate > 0 ? rate : null;
  }
  try {
    return await fetchRateOn(date, from, to);
  } catch {
    return null;
  }
}
