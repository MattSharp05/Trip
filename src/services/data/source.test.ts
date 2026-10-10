import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from './source';

describe('demo source', () => {
  it('writes in memory without touching the fixtures or other sessions', async () => {
    const a = createDemoSource(vegasSnapshot);
    const b = createDemoSource(vegasSnapshot);
    const [first] = (await a.getTripData('trip-vegas'))!.items;
    await a.saveItineraryItem({ ...first, startTime: '12:00' });
    await a.deleteBucketItem('bucket-pinball');
    await a.saveExpense({ ...vegasSnapshot.expenses[0], id: 'expense-new', amountMinor: 999 });

    const changed = (await a.getTripData('trip-vegas'))!;
    expect(changed.items.find((i) => i.id === first.id)?.startTime).toBe('12:00');
    expect(changed.bucketItems).toHaveLength(4);
    expect(changed.expenses).toHaveLength(vegasSnapshot.expenses.length + 1);

    const untouched = (await b.getTripData('trip-vegas'))!;
    expect(untouched.items.find((i) => i.id === first.id)?.startTime).toBe('11:02');
    expect(vegasSnapshot.items[0].startTime).toBe('11:02');
    expect(a.id).not.toBe(b.id);
  });

  it('returns copies, so callers cannot change stored data', async () => {
    const source = createDemoSource(vegasSnapshot);
    (await source.listTrips())[0].city = 'Changed';
    expect((await source.listTrips())[0].city).toBe('New York');
  });
});
