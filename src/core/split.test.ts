import { equalShares, goingIds, isEqualSplit, resplit, toTripCurrency } from './split';

describe('equalShares', () => {
  it('gives the remainder to the first participants by id', () => {
    expect(equalShares(1000, ['c', 'a', 'b'])).toEqual([
      { userId: 'a', shareMinor: 334 },
      { userId: 'b', shareMinor: 333 },
      { userId: 'c', shareMinor: 333 },
    ]);
  });

  it('splits evenly when it can', () => {
    expect(equalShares(12000, ['matthew', 'willem'])).toEqual([
      { userId: 'matthew', shareMinor: 6000 },
      { userId: 'willem', shareMinor: 6000 },
    ]);
  });

  it('gives one participant the whole amount, and nobody nothing', () => {
    expect(equalShares(4500, ['a'])).toEqual([{ userId: 'a', shareMinor: 4500 }]);
    expect(equalShares(4500, [])).toEqual([]);
  });

  it('counts a participant once', () => {
    expect(equalShares(100, ['a', 'a', 'b'])).toEqual([
      { userId: 'a', shareMinor: 50 },
      { userId: 'b', shareMinor: 50 },
    ]);
  });

  it('always adds up to the amount, with shares at most one unit apart', () => {
    const people = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];
    for (let amount = 1; amount <= 5000; amount += 7) {
      for (let n = 1; n <= people.length; n += 1) {
        const shares = equalShares(amount, people.slice(0, n));
        const values = shares.map((s) => s.shareMinor);
        expect(values.reduce((a, b) => a + b, 0)).toBe(amount);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        // Larger shares come first: the same order on every device.
        expect([...values].sort((a, b) => b - a)).toEqual(values);
      }
    }
  });

  it('does not depend on the order participants are given in', () => {
    expect(equalShares(1001, ['z', 'y', 'x'])).toEqual(equalShares(1001, ['x', 'y', 'z']));
  });
});

describe('toTripCurrency', () => {
  it('converts at the rate and rounds half up', () => {
    expect(toTripCurrency({ amountMinor: 6000, currency: 'EUR' }, 1.1298, 'USD')).toEqual({
      amountMinor: 6779,
      currency: 'USD',
    });
    expect(toTripCurrency({ amountMinor: 1, currency: 'EUR' }, 1.5, 'USD')).toEqual({
      amountMinor: 2,
      currency: 'USD',
    });
  });

  it('handles currencies without cents', () => {
    expect(toTripCurrency({ amountMinor: 1000, currency: 'USD' }, 150.25, 'JPY')).toEqual({
      amountMinor: 1503,
      currency: 'JPY',
    });
  });

  it('keeps an amount already in the trip currency', () => {
    expect(toTripCurrency({ amountMinor: 3600, currency: 'USD' }, 2, 'USD')).toEqual({
      amountMinor: 3600,
      currency: 'USD',
    });
  });
});

describe('opting out and the split (TR-66)', () => {
  const sphere = equalShares(45000, ['blake', 'matthew', 'willem']);

  it("defaults an activity's participants to the members going", () => {
    expect(goingIds(['matthew', 'blake', 'willem'], ['willem'])).toEqual(['matthew', 'blake']);
    expect(goingIds(['matthew', 'blake'], undefined)).toEqual(['matthew', 'blake']);
    expect(goingIds(['matthew'], ['matthew'])).toEqual([]);
  });

  it('knows a default split from a customised one', () => {
    expect(isEqualSplit(45000, sphere, ['willem', 'matthew', 'blake'])).toBe(true);
    expect(isEqualSplit(45000, sphere, ['matthew', 'blake'])).toBe(false);
    const custom = [
      { userId: 'blake', shareMinor: 20000 },
      { userId: 'matthew', shareMinor: 10000 },
      { userId: 'willem', shareMinor: 15000 },
    ];
    expect(isEqualSplit(45000, custom, ['blake', 'matthew', 'willem'])).toBe(false);
    expect(isEqualSplit(45000, [], [])).toBe(false);
  });

  it('recomputes a default split for who is going now', () => {
    expect(resplit(45000, sphere, ['matthew', 'blake', 'willem'], ['matthew', 'blake'])).toEqual([
      { userId: 'blake', shareMinor: 22500 },
      { userId: 'matthew', shareMinor: 22500 },
    ]);
    // And back in.
    const two = equalShares(45000, ['blake', 'matthew']);
    expect(resplit(45000, two, ['matthew', 'blake'], ['matthew', 'blake', 'willem'])).toEqual(
      sphere,
    );
  });

  it('leaves a customised split, an unchanged one and an empty one alone', () => {
    const forTwo = equalShares(45000, ['blake', 'matthew']);
    // Split between two while all three were going: someone picked who pays.
    expect(resplit(45000, forTwo, ['matthew', 'blake', 'willem'], ['matthew', 'blake'])).toBeNull();
    expect(
      resplit(45000, sphere, ['matthew', 'blake', 'willem'], ['matthew', 'blake', 'willem']),
    ).toBeNull();
    expect(resplit(4500, [{ userId: 'a', shareMinor: 4500 }], ['a'], [])).toBeNull();
  });
});
