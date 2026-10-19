import { groupSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import { ME } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

const VEGAS = 'trip-vegas';
const FOUNTAINS = 'item-06';

describe('demo itinerary opt-outs (TR-60)', () => {
  it('opts you out once and back in, leaving the others as they were', async () => {
    const source = createDemoSource(groupSnapshot);
    const optedOut = async () =>
      (await source.getTripData(VEGAS))?.items.find((i) => i.id === FOUNTAINS)?.optedOut;
    expect(await optedOut()).toEqual([WILLEM]);

    await source.optOut(FOUNTAINS, VEGAS);
    await source.optOut(FOUNTAINS, VEGAS);
    expect(await optedOut()).toEqual([WILLEM, ME]);

    await source.optIn(FOUNTAINS);
    expect(await optedOut()).toEqual([WILLEM]);
    await expect(source.optIn('item-nope')).rejects.toThrow();
  });
});
