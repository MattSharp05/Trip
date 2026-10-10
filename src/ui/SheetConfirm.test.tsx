import { fireEvent, render, screen } from '@testing-library/react-native';

import { SheetConfirm } from './SheetConfirm';

describe('SheetConfirm', () => {
  it('asks with a header, a message, the action and Cancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <SheetConfirm
        title="Remove Blake from the trip?"
        message="What they added stays on the trip."
        confirmLabel="Remove"
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID="ask"
      />,
    );
    expect(screen.getByRole('header', { name: 'Remove Blake from the trip?' })).toBeOnTheScreen();
    expect(screen.getByText('What they added stays on the trip.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('ask-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a menu has no message', () => {
    render(
      <SheetConfirm
        title="Blake"
        confirmLabel="Remove from trip"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('sheet-confirm')).toHaveTextContent('BlakeRemove from tripCancel');
  });
});
