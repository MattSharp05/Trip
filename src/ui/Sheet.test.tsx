import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sheet } from './Sheet';
import { Text } from './Text';

type MockModalProps = {
  children?: ReactNode;
  accessible?: boolean;
  onChange?: (index: number) => void;
  onDismiss?: () => void;
};

/**
 * The library's Jest mock always draws its children, so it can't show a sheet that never presents.
 * This fake keeps the rules of @gorhom/bottom-sheet 5.2.14's BottomSheetModal that matter here:
 * - dismiss() on a modal that isn't on screen sets its status to "dismissing" and has nothing to
 *   close, so the status stays there;
 * - a "dismissing" modal skips rendering its portal, so present() then shows nothing;
 * - a modal closed by the user (drag down) resets and calls onDismiss.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const { createElement, forwardRef, useImperativeHandle, useRef, useState } =
    jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  /** The last modal's close, for a test to drag the sheet down. */
  const userClose = { current: () => {} };
  const BottomSheetModal = forwardRef(function BottomSheetModal(
    { children, accessible, onChange, onDismiss }: MockModalProps,
    ref: unknown,
  ) {
    const status = useRef('initial');
    const [visible, setVisible] = useState(false);
    const close = () => {
      status.current = 'initial';
      setVisible(false);
      onChange?.(-1);
      onDismiss?.();
    };
    userClose.current = close;
    useImperativeHandle(ref, () => ({
      present: () => {
        if (status.current === 'dismissing') return;
        status.current = 'presented';
        setVisible(true);
        onChange?.(0);
      },
      dismiss: () => {
        if (status.current !== 'presented') status.current = 'dismissing';
        else close();
      },
    }));
    // The library's default is one accessibility element for the whole sheet.
    return visible
      ? createElement(View, { testID: 'modal', accessible: accessible ?? true }, children)
      : null;
  });
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetView: ({ children }: MockModalProps) => children,
    BottomSheetBackdrop: () => null,
    dragDown: () => userClose.current(),
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderSheet(open: boolean, onClose = jest.fn(), onClosed = jest.fn()) {
  const ui = (isOpen: boolean) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet open={isOpen} onClose={onClose} onClosed={onClosed} title="Fri, Nov 14">
        <Text>Brunch at Mon Ami Gabi</Text>
      </Sheet>
    </SafeAreaProvider>
  );
  const result = render(ui(open));
  return {
    ...result,
    setOpen: (isOpen: boolean) => result.rerender(ui(isOpen)),
    onClose,
    onClosed,
  };
}

describe('Sheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders its title and content', () => {
    renderSheet(true);
    expect(screen.getByRole('header', { name: 'Fri, Nov 14' })).toBeOnTheScreen();
    expect(screen.getByText('Brunch at Mon Ami Gabi')).toBeOnTheScreen();
  });

  it("doesn't fold its content into one accessibility element (VoiceOver, XCTest)", () => {
    renderSheet(true);
    expect(screen.getByTestId('modal')).toHaveProp('accessible', false);
  });

  it('opens when it was mounted closed (Add a place, Edit, Add a stop, Organize +)', () => {
    const { setOpen } = renderSheet(false);
    expect(screen.queryByText('Brunch at Mon Ami Gabi')).toBeNull();
    setOpen(true);
    expect(screen.getByText('Brunch at Mon Ami Gabi')).toBeOnTheScreen();
  });

  it('closes when the parent closes it, and opens again', () => {
    const { setOpen, onClose } = renderSheet(false);
    setOpen(true);
    setOpen(false);
    expect(screen.queryByText('Brunch at Mon Ami Gabi')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    setOpen(true);
    expect(screen.getByText('Brunch at Mon Ami Gabi')).toBeOnTheScreen();
  });

  it('opens again after the user dragged it down', () => {
    const { setOpen, onClose } = renderSheet(true);
    act(() => jest.requireMock('@gorhom/bottom-sheet').dragDown());
    expect(onClose).toHaveBeenCalledTimes(1);
    setOpen(false);
    expect(screen.queryByText('Brunch at Mon Ami Gabi')).toBeNull();
    setOpen(true);
    expect(screen.getByText('Brunch at Mon Ami Gabi')).toBeOnTheScreen();
  });

  it('reports when it is off screen, however it closed (native dialogs wait for it, TR-56)', () => {
    const { setOpen, onClosed } = renderSheet(true);
    expect(onClosed).not.toHaveBeenCalled();
    setOpen(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    setOpen(true);
    act(() => jest.requireMock('@gorhom/bottom-sheet').dragDown());
    expect(onClosed).toHaveBeenCalledTimes(2);
  });
});
