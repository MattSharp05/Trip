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
