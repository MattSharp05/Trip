// Jest stand-in for expo-clipboard: tests set what the clipboard holds and check what was read.
export const hasUrlAsync = jest.fn(async () => false);
export const getStringAsync = jest.fn(async () => '');
export const getUrlAsync = jest.fn(async () => null);
export const setStringAsync = jest.fn(async () => true);
