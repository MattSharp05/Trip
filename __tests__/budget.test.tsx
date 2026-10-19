import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import OrganizeRoute from '../app/(tabs)/organize/index';
import { exitScenario, loadScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data';

const savedTrip = () => useActiveSource.getState().source.getTripData('trip-vegas');

// The native date picker: a button that reports the date it was given.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, testID }: any) => (
      <Pressable testID={testID} onPress={() => onChange({ type: 'set' }, value)}>
        <Text>{value.toDateString()}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
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

async function openBudget() {
  act(() => {
    loadScenario('vegas-budget-eur');
  });
  renderRouter(routes, { initialUrl: '/organize' });
  await screen.findByTestId('budget-summary');
}

const text = (testID: string) => {
  const children = screen.getByTestId(testID).props.children;
  return Array.isArray(children) ? children.join('') : String(children);
};

describe('Organize → Budget', () => {
  it('shows the Vegas budget in euros, with originals kept in their currency', async () => {
    await openBudget();
    expect(screen.getByTestId('budget-currency')).toHaveTextContent('EUR');
    // $2,500 at 1.16 USD per EUR; expenses converted one by one, then summed.
    expect(text('budget-total-amount')).toBe('€2,155');
    expect(text('budget-spent')).toBe('€1,594 spent');
    expect(text('budget-left')).toBe('€561 left');
    expect(screen.getByTestId('budget-progress').props.accessibilityValue.now).toBe(74);

    const categories = within(screen.getByTestId('budget-categories'));
    expect(categories.getByText('€419')).toBeOnTheScreen(); // Flights, $486
    expect(categories.getByText('€638')).toBeOnTheScreen(); // Hotels, $740
    expect(categories.getByText('€188')).toBeOnTheScreen(); // Food & Drinks, $6 + $212
    expect(categories.getByText('€130')).toBeOnTheScreen(); // Other: insurance, paid in EUR

    fireEvent.press(screen.getByText('All'));
    // The amount as paid, with the trip-currency amount underneath.
    expect(text('expense-row-expense-carbone-amount')).toBe('$212.00');
    expect(text('expense-row-expense-carbone-converted')).toBe('€182.76');
    // Already in euros: one amount, no second line.
    expect(text('expense-row-expense-insurance-amount')).toBe('€130.00');
    expect(screen.queryByTestId('expense-row-expense-insurance-converted')).toBeNull();
    // A trip with only you: the category and day, not who paid.
    expect(text('expense-row-expense-carbone-who')).toBe('Food & Drinks · Fri, Nov 13');
    // Scenario sessions use fixture rates, never the network.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('switches the display currency to JPY in whole yen; originals never change', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-currency'));
    fireEvent.press(screen.getByTestId('budget-currency-JPY'));
    expect(await screen.findByText('¥383,621')).toBeOnTheScreen();
    expect(screen.getByTestId('budget-currency')).toHaveTextContent('JPY');
    expect(text('budget-spent')).toMatch(/^¥[\d,]+ spent$/);

    fireEvent.press(screen.getByText('All'));
    expect(text('expense-row-expense-insurance-converted')).toBe('¥23,140');
    expect(text('expense-row-expense-insurance-amount')).toBe('€130.00');
    expect(text('expense-row-expense-carbone-amount')).toBe('$212.00');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds ¥8,400 of food: shows ≈ its dollar value and updates the totals', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-currency'));
    fireEvent.press(screen.getByTestId('budget-currency-USD'));
    expect(await screen.findByText('$2,500')).toBeOnTheScreen();
    expect(text('budget-spent')).toBe('$1,849 spent'); // $1,698 + €130 ($150.80)

    fireEvent.press(screen.getByTestId('budget-add-expense'));
    // Las Vegas is in the United States: the form starts in dollars.
    expect(screen.getByTestId('expense-amount').props.accessibilityLabel).toBe('Amount (USD)');
    fireEvent.press(screen.getByTestId('expense-currency-JPY'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '8400');
    fireEvent.press(screen.getByTestId('expense-category-Food & Drinks'));
    fireEvent.changeText(screen.getByTestId('expense-note'), 'Ramen');
    await act(async () => {
      fireEvent.press(screen.getByTestId('expense-save'));
    });

    const ramen = await screen.findByLabelText(/^Ramen, Food & Drinks/);
    expect(within(ramen).getByText('$54.74')).toBeOnTheScreen();
    expect(within(ramen).getByText('¥8,400')).toBeOnTheScreen();
    expect(text('budget-spent')).toBe('$1,904 spent');
    expect(text('budget-left')).toBe('$596 left');

    fireEvent.press(screen.getByText('Categories'));
    expect(
      within(screen.getByTestId('budget-category-Food & Drinks')).getByText('$273'),
    ).toBeOnTheScreen();
  });

  it('rejects a fractional yen amount', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-add-expense'));
    fireEvent.press(screen.getByTestId('expense-currency-JPY'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '1.5');
    await act(async () => {
      fireEvent.press(screen.getByTestId('expense-save'));
    });
    expect(screen.getByTestId('expense-amount-error')).toHaveTextContent(
      'JPY has no cents: enter a whole amount, like 8400.',
    );
  });

  it('edits the total budget in its own currency', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-total'));
    expect(screen.getByTestId('budget-total-input').props.accessibilityLabel).toBe('Amount (USD)');
    expect(screen.getByTestId('budget-total-input').props.value).toBe('2500.00');
    fireEvent.changeText(screen.getByTestId('budget-total-input'), '3000');
    await act(async () => {
      fireEvent.press(screen.getByTestId('budget-total-save'));
    });
    // $3,000 / 1.16 = €2,586.
    expect(await screen.findByText('€2,586')).toBeOnTheScreen();
  });

  it('filters expenses by category from the summary', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-category-Food & Drinks'));
    const list = within(screen.getByTestId('budget-expenses'));
    expect(list.getAllByTestId(/^expense-row-[^-]+-[^-]+$/).map((r) => r.props.testID)).toEqual([
      'expense-row-expense-carbone',
      'expense-row-expense-coffee',
    ]);
    fireEvent.press(screen.getByTestId('budget-filter-clear'));
    expect(
      within(screen.getByTestId('budget-expenses')).getAllByTestId(/^expense-row-[^-]+-[^-]+$/),
    ).toHaveLength(7);
  });

  it('shows the trip currency picker as the trip currency and saves a change for everyone', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-currency'));
    expect(screen.getByText('Trip currency')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('budget-currency-GBP'));
    expect(await screen.findByText(/^£[\d,]+ spent$/)).toBeOnTheScreen();
    expect((await savedTrip())?.trip.currency).toBe('GBP');
  });

  it('keeps the solo-trip sheet short: no Paid by or Split', async () => {
    await openBudget();
    fireEvent.press(screen.getByTestId('budget-add-expense'));
    expect(screen.queryByTestId('expense-paid-by')).toBeNull();
    expect(screen.queryByTestId('expense-split')).toBeNull();
    expect(screen.getByTestId('expense-activity')).toBeOnTheScreen();
  });
});

describe('Organize → Expenses on a group trip', () => {
  async function openGroup() {
    act(() => {
      loadScenario('group-expenses');
    });
    renderRouter(routes, { initialUrl: '/organize' });
    await screen.findByTestId('budget-summary');
    fireEvent.press(screen.getByText('All'));
  }

  it('lists the shared expenses with who paid and the split', async () => {
    await openGroup();
    expect(text('expense-row-expense-group-sphere-who')).toBe('Blake paid · split 3 ways');
    expect(text('expense-row-expense-group-sphere-amount')).toBe('$450.00');
    expect(text('expense-row-expense-group-dinner-who')).toBe('You paid · split 2 ways');
    expect(text('expense-row-expense-group-dinner-amount')).toBe('€120.00');
    // At the rate stored on it: €120 × 1.16.
    expect(text('expense-row-expense-group-dinner-converted')).toBe('$139.20');
    expect(text('expense-row-expense-group-uber-who')).toBe('Willem paid · split 3 ways');
    // v1 expenses on the same trip read as one share for the person who added them.
    expect(text('expense-row-expense-carbone-who')).toBe('You paid');
    expect(screen.getByText('Expenses')).toBeOnTheScreen(); // the Organize segment
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds an expense paid by Blake, split with Blake and you: two shares', async () => {
    await openGroup();
    fireEvent.press(screen.getByTestId('budget-add-expense'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '50');
    fireEvent.changeText(screen.getByTestId('expense-note'), 'Tacos');
    fireEvent.press(screen.getByTestId('expense-paid-by-user-blake'));
    expect(screen.getByTestId('expense-split-everyone').props.accessibilityState.selected).toBe(
      true,
    );
    fireEvent.press(screen.getByTestId('expense-split-user-blake'));
    fireEvent.press(screen.getByTestId('expense-split-user-matthew'));
    expect(screen.getByTestId('expense-split-everyone').props.accessibilityState.selected).toBe(
      false,
    );
    fireEvent.press(screen.getByTestId('expense-activity-item-04'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('expense-save'));
    });

    const tacos = await screen.findByLabelText(/^Tacos, Blake paid · split 2 ways/);
    expect(within(tacos).getByText('$50.00')).toBeOnTheScreen();
    const saved = (await savedTrip())?.expenses.find((e) => e.description === 'Tacos');
    expect(saved).toMatchObject({
      paidBy: 'user-blake',
      itineraryItemId: 'item-04',
      rateToTrip: 1,
      tripCurrency: 'USD',
      shares: [
        { userId: 'user-blake', shareMinor: 2500 },
        { userId: 'user-matthew', shareMinor: 2500 },
      ],
    });
  });

  it('splits an activity between everyone going by default: Willem is out of the Fountains', async () => {
    await openGroup();
    fireEvent.press(screen.getByTestId('budget-add-expense'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '30');
    fireEvent.changeText(screen.getByTestId('expense-note'), 'Gelato');
    expect(screen.getByTestId('expense-split-everyone')).toHaveTextContent('Everyone');
    fireEvent.press(screen.getByTestId('expense-activity-item-06'));
    expect(screen.getByTestId('expense-split-everyone')).toHaveTextContent('Everyone going');
    expect(screen.getByTestId('expense-split-everyone').props.accessibilityState.selected).toBe(
      true,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('expense-save'));
    });

    await screen.findByLabelText(/^Gelato, You paid · split 2 ways/);
    const saved = (await savedTrip())?.expenses.find((e) => e.description === 'Gelato');
    expect(saved?.shares).toEqual([
      { userId: 'user-blake', shareMinor: 1500 },
      { userId: 'user-matthew', shareMinor: 1500 },
    ]);
  });

  it('picking everyone one by one is Everyone again', async () => {
    await openGroup();
    fireEvent.press(screen.getByTestId('budget-add-expense'));
    fireEvent.press(screen.getByTestId('expense-split-user-blake'));
    fireEvent.press(screen.getByTestId('expense-split-user-willem'));
    fireEvent.press(screen.getByTestId('expense-split-user-matthew'));
    expect(screen.getByTestId('expense-split-everyone').props.accessibilityState.selected).toBe(
      true,
    );
  });
});
