import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/theme';

/** "Watch": the original video in an in-app browser sheet (the video is never embedded). */
export function watchLink(url: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(url, {
    controlsColor: colors.accent,
    dismissButtonStyle: 'done',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => undefined);
}
