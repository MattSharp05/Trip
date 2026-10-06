// Native animation modules aren't available under Jest: use the libraries' own mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// The library's mock has no `__esModule` flag, so its default export (BottomSheet) needs one.
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...require('@gorhom/bottom-sheet/mock'),
}));
