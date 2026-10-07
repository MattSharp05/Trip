// Jest stand-in for expo-web-browser: tests check which link "Watch" opened.
export const openBrowserAsync = jest.fn(async () => ({ type: 'opened' }));
export const WebBrowserPresentationStyle = { PAGE_SHEET: 'pageSheet', AUTOMATIC: 'automatic' };
