// Native animation modules aren't available under Jest: use the libraries' own mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// The library's mock has no `__esModule` flag, so its default export (BottomSheet) needs one.
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...require('@gorhom/bottom-sheet/mock'),
}));

// Swipeable rows run their gestures as worklets, which Jest can't: draw the row and its actions.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { createElement, Fragment } = require('react');
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: unknown;
      renderRightActions?: () => unknown;
    }) => createElement(Fragment, null, children, renderRightActions?.()),
  };
});

// The sortable list's drag is a worklet gesture on the UI thread, which Jest can't run: draw the
// items in the data's order and keep the latest grid's props, so a test can drive a drag through
// its callbacks (`dragRow` in `__tests__/itinerary-edit.test.tsx`).
jest.mock('react-native-sortables', () => {
  const { createElement, Fragment, useState } = require('react');
  const { View } = require('react-native');
  let last: any;
  let mounts = 0;
  const Grid = (props: any) => {
    last = props;
    useState(() => (mounts += 1));
    return createElement(
      View,
      { testID: 'sortable-grid' },
      props.data.map((item: unknown, index: number) =>
        createElement(
          Fragment,
          { key: props.keyExtractor(item) },
          props.renderItem({ item, index }),
        ),
      ),
    );
  };
  const Handle = ({ children }: { children: unknown }) => createElement(Fragment, null, children);
  return {
    __esModule: true,
    default: { Grid, Handle },
    /** The props of the grid rendered last. */
    lastGrid: () => last,
    /** How many grids have mounted (a new `key` mounts a new one). */
    mounts: () => mounts,
  };
});
