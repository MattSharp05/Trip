import { BLAKE, groupSnapshot } from '@/scenarios/fixtures/group';
import { ME } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

const SPHERE = 'expense-group-sphere';

describe('demo expense shares (TR-66)', () => {
  it('replaces the shares when they add up to the amount', async () => {
    const source = createDemoSource(groupSnapshot);
    const shares = [
      { userId: BLAKE, shareMinor: 22500 },
      { userId: ME, shareMinor: 22500 },
    ];
    await source.setExpenseShares(SPHERE, shares);
    const sphere = (await source.getTripData('trip-vegas'))?.expenses.find((e) => e.id === SPHERE);
    expect(sphere?.shares).toEqual(shares);
    await expect(source.setExpenseShares(SPHERE, [{ userId: ME, shareMinor: 1 }])).rejects.toThrow(
      'add up',
    );
    await expect(source.setExpenseShares('expense-nope', shares)).rejects.toThrow();
  });
});
