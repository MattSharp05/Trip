import { equalShares } from './split';
import {
  history,
  netBetween,
  overallNet,
  pairBalances,
  type Ledger,
  type LedgerExpense,
  type LedgerPayment,
} from './settle';

const ME = 'me';
const BLAKE = 'blake';
const WILLEM = 'willem';

let n = 0;
function expense(
  paidBy: string,
  amountMinor: number,
  participants: string[],
  extra: Partial<LedgerExpense> = {},
): LedgerExpense {
  n += 1;
  const currency = extra.currency ?? 'USD';
  return {
    id: `e${n}`,
    title: `Expense ${n}`,
    paidAt: `2026-11-${String(10 + n).padStart(2, '0')}T12:00:00Z`,
    paidBy,
    amountMinor,
    currency,
    shares: equalShares(amountMinor, participants),
    rateToTrip: currency === 'USD' ? 1 : null,
    tripCurrency: 'USD',
    ...extra,
  };
}

const ledger = (
  expenses: LedgerExpense[],
  payments: LedgerPayment[] = [],
  tripCurrency = 'USD',
): Ledger => ({ expenses, payments, tripCurrency });

describe('pairBalances', () => {
  it("offsets Matthew's example: you owe Blake $10, Blake owes you $6 → You owe Blake $4.00", () => {
    // Blake paid $20 split with you ($10 yours); you paid $12 split with Blake ($6 his).
    const l = ledger([expense(BLAKE, 2000, [ME, BLAKE]), expense(ME, 1200, [ME, BLAKE])]);
    expect(pairBalances(l, ME, [ME, BLAKE])).toEqual([
      { memberId: BLAKE, amountMinor: 400, direction: 'youOwe' },
    ]);
    expect(netBetween(BLAKE, ME, l)).toBe(400);
  });

  it('works out three people with mixed currencies at the stored rates', () => {
    const l = ledger([
      // Sphere: Blake paid $450 for all three.
      expense(BLAKE, 45000, [ME, BLAKE, WILLEM]),
      // Dinner: you paid €120 for you and Willem at 1.16 → Willem's €60 is $69.60.
      expense(ME, 12000, [ME, WILLEM], { currency: 'EUR', rateToTrip: 1.16 }),
      // Uber: Willem paid $36 for all three.
      expense(WILLEM, 3600, [ME, BLAKE, WILLEM]),
    ]);
    const balances = pairBalances(l, ME, [ME, BLAKE, WILLEM]);
    expect(balances).toEqual([
      { memberId: BLAKE, amountMinor: 15000, direction: 'youOwe' },
      { memberId: WILLEM, amountMinor: 5760, direction: 'owesYou' },
    ]);
    expect(overallNet(balances)).toBe(-9240);
    // Blake and Willem: Willem owes Blake $150, Blake owes Willem $12.
    expect(netBetween(BLAKE, WILLEM, l)).toBe(13800);
  });

  it('rounds each converted share half-up once, at the stored rate', () => {
    // ¥1,000 split two ways at 0.006675: each ¥500 is $3.3375 → $3.34.
    const l = ledger([expense(ME, 1000, [ME, BLAKE], { currency: 'JPY', rateToTrip: 0.006675 })]);
    expect(netBetween(ME, BLAKE, l)).toBe(334);
  });

  it("never creates or loses a cent: everyone's balances add up to zero", () => {
    const people = [ME, BLAKE, WILLEM, 'alex'];
    const l = ledger([
      expense(ME, 1000, people),
      expense(BLAKE, 1001, [ME, BLAKE, WILLEM]),
      expense(WILLEM, 333, [BLAKE, 'alex']),
      expense('alex', 12345, people, { currency: 'EUR', rateToTrip: 1.0937 }),
      expense(BLAKE, 777, [ME, 'alex'], { currency: 'GBP', rateToTrip: 1.2711 }),
    ]);
    const totals = people.map((p) => overallNet(pairBalances(l, p, people)));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(0);
    // And each pair agrees from both sides.
    for (const a of people) {
      for (const b of people) expect(netBetween(a, b, l) + netBetween(b, a, l)).toBe(0);
    }
  });

  it('shows a pair that evens out, and a member with no expenses, as settled', () => {
    const l = ledger([expense(BLAKE, 1000, [ME, BLAKE]), expense(ME, 1000, [ME, BLAKE])]);
    expect(pairBalances(l, ME, [ME, BLAKE, WILLEM])).toEqual([
      { memberId: BLAKE, amountMinor: 0, direction: 'settled' },
      { memberId: WILLEM, amountMinor: 0, direction: 'settled' },
    ]);
  });

  it('counts payments against the debt, in either direction', () => {
    const l = ledger(
      [expense(BLAKE, 2000, [ME, BLAKE])],
      [
        {
          id: 'p1',
          fromUser: ME,
          toUser: BLAKE,
          amountMinor: 1000,
          currency: 'USD',
          createdAt: '2026-11-20T10:00:00Z',
        },
      ],
    );
    expect(pairBalances(l, ME, [BLAKE])).toEqual([
      { memberId: BLAKE, amountMinor: 0, direction: 'settled' },
    ]);
  });

  it('ignores your own share of what you paid, and expenses between the others', () => {
    const l = ledger([expense(ME, 3000, [ME]), expense(BLAKE, 3000, [BLAKE, WILLEM])]);
    expect(pairBalances(l, ME, [BLAKE, WILLEM]).map((b) => b.direction)).toEqual([
      'settled',
      'settled',
    ]);
  });

  it('uses today’s rates without a stored rate, and leaves out what nothing converts', () => {
    const withoutRate = expense(ME, 2000, [ME, BLAKE], { currency: 'EUR', rateToTrip: null });
    const l = ledger([withoutRate]);
    expect(netBetween(ME, BLAKE, l)).toBe(0);
    const rates = { base: 'USD', date: '2026-11-13', rates: { EUR: 0.8 } };
    expect(netBetween(ME, BLAKE, { ...l, rates })).toBe(1250); // €10 / 0.8
  });
});

describe('history', () => {
  it('lists the lines between two people newest first, with each share and effect', () => {
    const sphere = expense(BLAKE, 45000, [ME, BLAKE, WILLEM], {
      paidAt: '2026-10-20T19:00:00Z',
    });
    const dinner = expense(ME, 12000, [ME, BLAKE], {
      currency: 'EUR',
      rateToTrip: 1.16,
      paidAt: '2026-11-13T05:30:00Z',
    });
    const others = expense(WILLEM, 3000, [WILLEM, BLAKE]);
    const lines = history(ME, BLAKE, ledger([sphere, dinner, others]));
    expect(lines.map((l) => [l.id, l.paidBy, l.shareOf, l.share, l.effectMinor])).toEqual([
      [dinner.id, ME, BLAKE, { amountMinor: 6000, currency: 'EUR' }, 6960],
      [sphere.id, BLAKE, ME, { amountMinor: 15000, currency: 'USD' }, -15000],
    ]);
  });

  it('includes payments, and nothing between you and yourself', () => {
    const payment: LedgerPayment = {
      id: 'p1',
      fromUser: BLAKE,
      toUser: ME,
      amountMinor: 500,
      currency: 'USD',
      createdAt: '2026-12-01T00:00:00Z',
    };
    const l = ledger([], [payment]);
    expect(history(ME, BLAKE, l)).toMatchObject([
      { kind: 'payment', id: 'p1', paidBy: BLAKE, effectMinor: -500 },
    ]);
    expect(history(ME, ME, l)).toEqual([]);
  });
});
