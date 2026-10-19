import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import OrganizeRoute from '../app/(tabs)/organize/index';
import PersonRoute from '../app/(tabs)/organize/person/[id]';
import { exitScenario, loadScenario } from '@/scenarios';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/person/[id]': PersonRoute,
};

const fetchSpy = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  fetchSpy.mockReset();
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
  act(() => exitScenario());
});

const text = (testID: string) => {
  const node = screen.getByTestId(testID);
  return [node.props.children]
    .flat()
    .map((c) => (typeof c === 'string' ? c : ''))
    .join('');
};

async function openBalances() {
  act(() => {
    loadScenario('group-balances');
  });
  renderRouter(routes, { initialUrl: '/organize' });
  await screen.findByTestId('balances');
}

describe('Organize → Expenses → Balances (group-balances)', () => {
  it('shows each traveller with what you owe or they owe, and the overall line', async () => {
    await openBalances();
    // Sphere: Blake paid $450 for three → you owe Blake $150.00.
    expect(text('balance-row-user-blake-label')).toBe('You owe');
    expect(text('balance-row-user-blake-amount')).toBe(' $150.00');
    // Dinner: Willem's €60 at the stored 1.16 is $69.60; Uber: your $12 to Willem → $57.60.
    expect(text('balance-row-user-willem-label')).toBe('Owes you');
    expect(text('balance-row-user-willem-amount')).toBe(' $57.60');
    expect(screen.getByTestId('balances-overall')).toHaveTextContent('Overall you owe $92.40');
    // You aren't a row of your own; and stored rates need no live ones.
    expect(screen.queryByTestId('balance-row-user-matthew')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens a traveller: the balance, then the history newest first with the shares', async () => {
    await openBalances();
    fireEvent.press(screen.getByTestId('balance-row-user-willem'));
    const balance = await screen.findByTestId('person-balance');
    expect(within(balance).getByText('Willem owes you')).toBeOnTheScreen();
    expect(screen.getByTestId('person-balance-amount')).toHaveTextContent('$57.60');

    const history = screen.getByTestId('person-history');
    const ids = within(history)
      .getAllByTestId(/^person-history-expense-group-[a-z]+$/)
      .map((n) => n.props.testID);
    // Uber (Nov 13) before dinner (Nov 12); Sphere has nothing between you and Willem.
    expect(ids).toEqual([
      'person-history-expense-group-uber',
      'person-history-expense-group-dinner',
    ]);
    expect(screen.getByTestId('person-history-expense-group-uber-who')).toHaveTextContent(
      'Nov 13 · Willem paid',
    );
    expect(screen.getByTestId('person-history-expense-group-uber-share')).toHaveTextContent(
      '$12.00',
    );
    expect(screen.getByTestId('person-history-expense-group-uber-label')).toHaveTextContent(
      'Your share',
    );
    expect(screen.getByTestId('person-history-expense-group-dinner-who')).toHaveTextContent(
      'Nov 12 · You paid',
    );
    expect(screen.getByTestId('person-history-expense-group-dinner-share')).toHaveTextContent(
      '€60.00',
    );
    expect(screen.getByTestId('person-history-expense-group-dinner-label')).toHaveTextContent(
      "Willem's share · $69.60",
    );
  });

  it('shows Blake with the Sphere tickets', async () => {
    await openBalances();
    fireEvent.press(screen.getByTestId('balance-row-user-blake'));
    expect(await screen.findByText('You owe Blake')).toBeOnTheScreen();
    expect(screen.getByTestId('person-balance-amount')).toHaveTextContent('$150.00');
    expect(screen.getByTestId('person-history-expense-group-sphere-who')).toHaveTextContent(
      'Oct 20 · Blake paid',
    );
    expect(screen.getByTestId('person-history-expense-group-sphere-label')).toHaveTextContent(
      'Your share',
    );
  });

  it('has no Balances segment on a solo trip', async () => {
    act(() => {
      loadScenario('vegas-budget-eur');
    });
    renderRouter(routes, { initialUrl: '/organize' });
    await screen.findByTestId('budget-summary');
    expect(screen.queryByText('Balances')).toBeNull();
  });
});
